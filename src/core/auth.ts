import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { recordAudit } from './audit';
import { prisma } from './db';
import { HttpError } from './http';

export const SESSION_COOKIE_NAME = 'eisd_session';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
  roles: Array<{
    id: string;
    code: string;
    name: string;
    scope: 'GLOBAL' | 'DIVISION';
    divisionId: string | null;
  }>;
  permissions: string[];
  divisionIds: string[];
}

interface JwtPayload {
  sub: string;
  email: string;
  tokenVersion: number;
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'dev_only_jwt_secret_replace_in_production_32chars';
}

export function signSessionToken(user: {
  id: string;
  email: string;
  tokenVersion: number;
}): string {
  return jwt.sign(
    { sub: user.id, email: user.email, tokenVersion: user.tokenVersion },
    getJwtSecret(),
    { expiresIn: '7d' },
  );
}

export function attachSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: 0,
  });
}

export function assertAllowedEmailDomain(email: string, envDomains?: string): void {
  const raw = (envDomains ?? process.env.AUTH_ALLOWED_EMAIL_DOMAINS ?? '').trim();
  if (!raw) return;
  const allowed = raw
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
  if (allowed.length === 0) return;

  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!allowed.includes(domain)) {
    throw new HttpError(403, `Domain email "@${domain}" tidak diizinkan untuk login ke EISD One.`);
  }
}

export async function loadSessionUserById(
  userId: string,
  expectedTokenVersion?: number,
): Promise<SessionUser | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (!user) return null;
  if (expectedTokenVersion !== undefined && user.tokenVersion !== expectedTokenVersion) {
    return null;
  }

  const roles = user.userRoles
    .map((ur) => ur.role)
    .filter((r) => r.deletedAt === null)
    .map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      scope: r.scope,
      divisionId: r.divisionId,
    }));

  const perms = new Set<string>();
  for (const ur of user.userRoles) {
    if (ur.role.deletedAt !== null) continue;
    for (const rp of ur.role.rolePermissions) {
      perms.add(rp.permission.code);
    }
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isSuperAdmin: roles.some((r) => r.code === 'super_admin'),
    roles,
    permissions: Array.from(perms),
    divisionIds: roles
      .filter((r) => r.scope === 'DIVISION' && r.divisionId)
      .map((r) => r.divisionId as string),
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    return await loadSessionUserById(payload.sub, payload.tokenVersion);
  } catch {
    return null;
  }
}

/**
 * Default-deny authorization helper untuk semua Route Handler API.
 * - Jika belum login -> 401
 * - Role super_admin selalu diizinkan (termasuk custom modul)
 * - Jika requiredPermissions tidak diberikan dan allowAnyAuthenticated=false -> 403 (default-deny)
 */
export function authorizeUser(
  user: SessionUser | null,
  requiredPermissions: string[],
  allowAnyAuthenticated = false,
): SessionUser {
  if (!user) {
    throw new HttpError(401, 'Sesi tidak ditemukan. Silakan login terlebih dahulu.');
  }
  if (user.isSuperAdmin) {
    return user;
  }
  if (allowAnyAuthenticated) {
    return user;
  }
  if (requiredPermissions.length === 0) {
    throw new HttpError(403, 'Akses ditolak secara default: permission belum ditetapkan.');
  }
  const hasAll = requiredPermissions.every((p) => user.permissions.includes(p));
  if (!hasAll) {
    throw new HttpError(
      403,
      `Akses ditolak: membutuhkan izin [${requiredPermissions.join(', ')}].`,
    );
  }
  return user;
}

export async function requirePermission(
  requiredPermissions: string[],
  allowAnyAuthenticated = false,
): Promise<SessionUser> {
  const user = await getSessionUser();
  return authorizeUser(user, requiredPermissions, allowAnyAuthenticated);
}

export function assertDivisionAccess(user: SessionUser, divisionId: string): void {
  if (user.isSuperAdmin || user.permissions.includes('member.member.view_all')) {
    return;
  }
  if (!user.divisionIds.includes(divisionId)) {
    throw new HttpError(403, 'Anda hanya dapat mengakses data divisi Anda sendiri.');
  }
}

export async function loginWithPassword(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });

  if (!user || !user.passwordHash) {
    throw new HttpError(401, 'Email atau password tidak valid.');
  }
  if (!user.isActive) {
    throw new HttpError(403, 'Akun ini sudah dinonaktifkan. Hubungi Administrator atau Core.');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, 'Email atau password tidak valid.');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const sessionUser = await loadSessionUserById(user.id);
  if (!sessionUser) {
    throw new HttpError(401, 'Gagal memuat profil pengguna.');
  }

  await recordAudit({
    actor: { id: user.id, email: user.email },
    action: 'auth.login',
    module: 'auth',
    entityType: 'User',
    entityId: user.id,
  });

  return {
    token: signSessionToken(user),
    user: sessionUser,
  };
}
