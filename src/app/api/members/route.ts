import { MemberStatus, Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/core/audit';
import { assertDivisionAccess, requirePermission } from '@/core/auth';
import { ensureMemberBirthdayOnCalendar } from '@/core/calendar';
import { prisma } from '@/core/db';
import { handleRouteError, HttpError } from '@/core/http';

const createMemberSchema = z.object({
  nim: z.string().min(3),
  fullName: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  birthDate: z.string().optional(),
  phone: z.string().optional(),
  status: z.nativeEnum(MemberStatus).default(MemberStatus.ACTIVE),
  batchYear: z.coerce.number().int().min(2000).max(2100).optional(),
  divisionId: z.string().uuid().optional(),
  positionTitle: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(['member.member.read']);
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') || 20)));
    const search = sp.get('search')?.trim() || '';
    const status = sp.get('status') || '';
    const divisionId = sp.get('divisionId') || '';

    const canViewAll = user.isSuperAdmin || user.permissions.includes('member.member.view_all');
    const where: Prisma.MemberWhereInput = { deletedAt: null };
    if (status && ['ACTIVE', 'LEAVE', 'ALUMNI'].includes(status)) {
      where.status = status as MemberStatus;
    }
    if (search) {
      where.OR = [
        { nim: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (!canViewAll) {
      if (user.divisionIds.length === 0) {
        return NextResponse.json({ items: [], meta: { total: 0, page, limit, totalPages: 1 } });
      }
      if (divisionId && !user.divisionIds.includes(divisionId)) {
        throw new HttpError(403, 'Anda hanya dapat melihat anggota divisi Anda sendiri.');
      }
      where.memberships = {
        some: {
          deletedAt: null,
          divisionId: divisionId ? divisionId : { in: user.divisionIds },
        },
      };
    } else if (divisionId) {
      where.memberships = { some: { deletedAt: null, divisionId } };
    }

    const [items, total] = await Promise.all([
      prisma.member.findMany({
        where,
        include: {
          memberships: {
            where: { deletedAt: null },
            include: {
              division: { select: { id: true, code: true, name: true } },
              period: { select: { id: true, name: true, isActive: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.member.count({ where }),
    ]);

    return NextResponse.json({
      items,
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(['member.member.create']);
    const data = createMemberSchema.parse(await req.json());

    const nim = data.nim.trim();
    const dup = await prisma.member.findUnique({ where: { nim } });
    if (dup && !dup.deletedAt) {
      throw new HttpError(400, `NIM "${nim}" sudah terdaftar.`);
    }

    let divisionId = data.divisionId;
    if (!divisionId && !user.isSuperAdmin && user.divisionIds.length > 0) {
      divisionId = user.divisionIds[0];
    }
    if (divisionId) assertDivisionAccess(user, divisionId);

    const activePeriod = divisionId
      ? await prisma.period.findFirst({ where: { isActive: true, deletedAt: null } })
      : null;

    const member = await prisma.member.create({
      data: {
        nim,
        fullName: data.fullName.trim(),
        email: data.email ? data.email.trim().toLowerCase() : null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        phone: data.phone?.trim() || null,
        status: data.status,
        batchYear: data.batchYear ?? null,
        createdBy: user.id,
        updatedBy: user.id,
        ...(divisionId && activePeriod
          ? {
              memberships: {
                create: {
                  divisionId,
                  periodId: activePeriod.id,
                  positionTitle: data.positionTitle?.trim() || 'Anggota',
                  createdBy: user.id,
                },
              },
            }
          : {}),
      },
      include: { memberships: { include: { division: true, period: true } } },
    });

    await ensureMemberBirthdayOnCalendar(member);
    await recordAudit({
      actor: user,
      action: 'member.created',
      module: 'member',
      entityType: 'Member',
      entityId: member.id,
      afterData: member,
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
