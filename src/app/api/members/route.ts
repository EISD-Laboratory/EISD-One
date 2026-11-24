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
  generation: z.string().max(20).optional(),
  batchYear: z.coerce.number().int().min(2000).max(2100).optional(),
  divisionId: z.string().uuid().optional(),
  positionTitle: z.string().optional(),
});

function sortGenerationsDesc(a: string, b: string): number {
  const numA = Number.parseInt(a.replace(/[^0-9]/g, ''), 10);
  const numB = Number.parseInt(b.replace(/[^0-9]/g, ''), 10);
  if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
    return numB - numA;
  }
  return a.localeCompare(b);
}

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(['member.member.read']);
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(sp.get('limit') || 20)));
    const search = sp.get('search')?.trim() || '';
    const status = sp.get('status') || '';
    const divisionId = sp.get('divisionId') || '';
    const generation = sp.get('generation')?.trim() || '';

    const canViewAll = user.isSuperAdmin || user.permissions.includes('member.member.view_all');
    if (!canViewAll && user.divisionIds.length === 0) {
      return NextResponse.json({
        items: [],
        meta: { total: 0, page, limit, totalPages: 1 },
        facets: { totalAll: 0, generations: [], divisions: [] },
      });
    }
    if (!canViewAll && divisionId && !user.divisionIds.includes(divisionId)) {
      throw new HttpError(403, 'Anda hanya dapat melihat anggota divisi Anda sendiri.');
    }

    const scopeWhere: Prisma.MemberWhereInput = {
      deletedAt: null,
      ...(!canViewAll
        ? { memberships: { some: { deletedAt: null, divisionId: { in: user.divisionIds } } } }
        : {}),
    };

    const where: Prisma.MemberWhereInput = { deletedAt: null };
    if (status && ['ACTIVE', 'LEAVE', 'ALUMNI'].includes(status)) {
      where.status = status as MemberStatus;
    }
    if (generation) {
      where.generation = { equals: generation, mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { nim: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { generation: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (!canViewAll) {
      where.memberships = {
        some: {
          deletedAt: null,
          divisionId: divisionId ? divisionId : { in: user.divisionIds },
        },
      };
    } else if (divisionId) {
      where.memberships = { some: { deletedAt: null, divisionId } };
    }

    const [items, total, scopedMembers, visibleDivisions] = await Promise.all([
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
      prisma.member.findMany({
        where: scopeWhere,
        select: {
          id: true,
          status: true,
          generation: true,
          memberships: {
            where: { deletedAt: null },
            select: { divisionId: true },
          },
        },
      }),
      prisma.division.findMany({
        where: {
          deletedAt: null,
          isEnabled: true,
          ...(!canViewAll ? { id: { in: user.divisionIds } } : {}),
        },
        select: { id: true, code: true, name: true },
        orderBy: [{ isCustom: 'asc' }, { name: 'asc' }],
      }),
    ]);

    // Hitung jumlah anggota per generasi & per divisi untuk sidebar filter
    const genMap = new Map<string, { count: number; activeCount: number }>();
    const divCounts = new Map<string, Set<string>>();

    for (const m of scopedMembers) {
      const g = m.generation?.trim();
      if (g) {
        const curr = genMap.get(g) ?? { count: 0, activeCount: 0 };
        curr.count += 1;
        if (m.status === MemberStatus.ACTIVE) curr.activeCount += 1;
        genMap.set(g, curr);
      }
      for (const ms of m.memberships) {
        const set = divCounts.get(ms.divisionId) ?? new Set<string>();
        set.add(m.id);
        divCounts.set(ms.divisionId, set);
      }
    }

    const generations = Array.from(genMap.entries())
      .sort(([a], [b]) => sortGenerationsDesc(a, b))
      .map(([gen, info]) => ({
        generation: gen,
        count: info.count,
        activeCount: info.activeCount,
      }));

    const divisions = visibleDivisions.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      count: divCounts.get(d.id)?.size ?? 0,
    }));

    return NextResponse.json({
      items,
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
      facets: {
        totalAll: scopedMembers.length,
        generations,
        divisions,
      },
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
        generation: data.generation?.trim() || null,
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
