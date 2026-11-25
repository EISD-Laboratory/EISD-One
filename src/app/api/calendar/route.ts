import { CalendarCategory } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/core/audit';
import { requirePermission } from '@/core/auth';
import { buildIcalFeed } from '@/core/calendar';
import { prisma } from '@/core/db';
import { handleRouteError, HttpError } from '@/core/http';

const createCalSchema = z.object({
  title: z.string().min(2, 'Judul kegiatan minimal 2 karakter.'),
  divisionId: z.string().uuid().nullable().optional(),
  category: z.nativeEnum(CalendarCategory).optional(),
  startAt: z.string(),
  endAt: z.string(),
  allDay: z.boolean().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});

function inferCategoryFromDivision(code: string | null | undefined): CalendarCategory {
  switch (code) {
    case 'event':
      return CalendarCategory.EVENT;
    case 'praktikum':
      return CalendarCategory.PRAKTIKUM;
    case 'competition':
      return CalendarCategory.COMPETITION;
    case 'core':
      return CalendarCategory.MEETING;
    default:
      return CalendarCategory.OTHER;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(['calendar.item.read']);
    const canViewAll = user.isSuperAdmin || user.permissions.includes('member.member.view_all');
    const [items, divisions] = await Promise.all([
      prisma.calendarItem.findMany({
        where: {
          deletedAt: null,
          ...(!canViewAll
            ? { OR: [{ divisionId: null }, { divisionId: { in: user.divisionIds } }] }
            : {}),
        },
        orderBy: { startAt: 'asc' },
        take: 500,
      }),
      prisma.division.findMany({
        where: { deletedAt: null },
        select: { id: true, code: true, name: true },
      }),
    ]);

    if (req.nextUrl.searchParams.get('format') === 'ics') {
      const ics = buildIcalFeed(items);
      return new NextResponse(ics, {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="eisd-one-calendar.ics"',
        },
      });
    }

    const divMap = new Map(divisions.map((d) => [d.id, d]));
    const enriched = items.map((item) => {
      const div = item.divisionId ? divMap.get(item.divisionId) : null;
      return {
        ...item,
        divisionName: div?.name ?? null,
        divisionCode: div?.code ?? null,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(['calendar.item.manage']);
    const data = createCalSchema.parse(await req.json());

    const startDate = new Date(data.startAt);
    const endDate = new Date(data.endAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new HttpError(400, 'Format tanggal atau jam mulai/selesai tidak valid.');
    }
    if (endDate.getTime() < startDate.getTime()) {
      throw new HttpError(400, 'Tanggal & jam selesai tidak boleh lebih awal dari waktu mulai.');
    }

    const canManageAll = user.isSuperAdmin || user.permissions.includes('member.member.view_all');
    let resolvedDivisionId: string | null = data.divisionId ?? null;

    if (!canManageAll) {
      if (resolvedDivisionId && !user.divisionIds.includes(resolvedDivisionId)) {
        throw new HttpError(403, 'Anda hanya dapat membuat agenda untuk divisi Anda atau Umum.');
      }
      if (!resolvedDivisionId && data.divisionId === undefined && user.divisionIds.length > 0) {
        resolvedDivisionId = user.divisionIds[0];
      }
    }

    let division: { id: string; code: string; name: string } | null = null;
    if (resolvedDivisionId) {
      division = await prisma.division.findFirst({
        where: { id: resolvedDivisionId, deletedAt: null },
        select: { id: true, code: true, name: true },
      });
      if (!division) {
        throw new HttpError(400, 'Divisi yang dipilih tidak ditemukan.');
      }
    }

    const resolvedCategory = data.category ?? inferCategoryFromDivision(division?.code);

    const created = await prisma.calendarItem.create({
      data: {
        title: data.title.trim(),
        category: resolvedCategory,
        startAt: startDate,
        endAt: endDate,
        allDay: Boolean(data.allDay),
        location: data.location?.trim() || null,
        description: data.description?.trim() || null,
        divisionId: resolvedDivisionId,
        sourceModule: 'calendar',
        createdBy: user.id,
      },
    });
    await recordAudit({
      actor: user,
      action: 'calendar.item.created',
      module: 'calendar',
      entityType: 'CalendarItem',
      entityId: created.id,
      afterData: created,
    });
    return NextResponse.json(
      {
        ...created,
        divisionName: division?.name ?? null,
        divisionCode: division?.code ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
