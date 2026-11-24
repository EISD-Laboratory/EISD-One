import * as bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/core/audit';
import { requirePermission } from '@/core/auth';
import { prisma } from '@/core/db';
import { handleRouteError, HttpError } from '@/core/http';
import { isFeatureEnabled } from '@/core/settings';

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  password: z.string().min(8),
  roleId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    await requirePermission(['rbac.user.read']);
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        userRoles: { include: { role: { select: { id: true, code: true, name: true } } } },
      },
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    });
    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        roles: u.userRoles.map((ur) => ur.role),
      })),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission(['rbac.user.manage']);
    const data = createUserSchema.parse(await req.json());
    const email = data.email.trim().toLowerCase();

    const dup = await prisma.user.findUnique({ where: { email } });
    if (dup) throw new HttpError(400, `Email "${email}" sudah terdaftar.`);

    if (data.roleId) {
      const role = await prisma.role.findUnique({ where: { id: data.roleId } });
      if (!role) throw new HttpError(400, 'Role tidak valid.');
      const extraEnabled = await isFeatureEnabled('rbac.extra_roles', false);
      if (role.isExtraRole && !extraEnabled) {
        throw new HttpError(400, 'Aktifkan feature flag rbac.extra_roles terlebih dahulu.');
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const created = await prisma.user.create({
      data: {
        email,
        fullName: data.fullName.trim(),
        passwordHash,
        createdBy: actor.id,
        ...(data.roleId ? { userRoles: { create: { roleId: data.roleId } } } : {}),
      },
    });

    await recordAudit({
      actor,
      action: 'rbac.user.created',
      module: 'rbac',
      entityType: 'User',
      entityId: created.id,
      afterData: { email: created.email, fullName: created.fullName },
    });

    return NextResponse.json({ id: created.id, email: created.email }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requirePermission(['rbac.user.manage']);
    const body = z
      .object({
        userId: z.string().uuid(),
        isActive: z.boolean(),
      })
      .parse(await req.json());

    const before = await prisma.user.findFirst({ where: { id: body.userId, deletedAt: null } });
    if (!before) throw new HttpError(404, 'Akun tidak ditemukan.');

    const updated = await prisma.user.update({
      where: { id: body.userId },
      data: {
        isActive: body.isActive,
        tokenVersion: body.isActive ? before.tokenVersion : before.tokenVersion + 1,
        updatedBy: actor.id,
      },
    });

    await recordAudit({
      actor,
      action: 'rbac.user.status_updated',
      module: 'rbac',
      entityType: 'User',
      entityId: body.userId,
      beforeData: { isActive: before.isActive },
      afterData: { isActive: updated.isActive },
    });

    return NextResponse.json({ id: updated.id, isActive: updated.isActive });
  } catch (error) {
    return handleRouteError(error);
  }
}
