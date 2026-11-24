import { CalendarCategory } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/core/audit';
import { requirePermission } from '@/core/auth';
import { buildIcalFeed } from '@/core/calendar';
import { prisma } from '@/core/db';
import { handleRouteError } from '@/core/http';

const createCalSchema = z.object({
  title: z.string().min(2),
  category: z.nativeEnum(CalendarCategory).default(CalendarCategory.MEETING),
  startAt: z.string(),
  endAt: z.string(),
  location: z.string().optional(),
  description: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(['calendar.item.read']);
    const canViewAll = user.isSuperAdmin || user.permissions.includes('member.member.view_all');
    const items = await prisma.calendarItem.findMany({
      where: {
        deletedAt: null,
        ...(!canViewAll
          ? { OR: [{ divisionId: null }, { divisionId: { in: user.divisionIds } }] }
          : {}),
      },
      orderBy: { startAt: 'asc' },
      take: 200,
    });

    if (req.nextUrl.searchParams.get('format') === 'ics') {
      const ics = buildIcalFeed(items);
      return new NextResponse(ics, {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="eisd-one-calendar.ics"',
        },
      });
    }

    return NextResponse.json(items);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(['calendar.item.manage']);
    const data = createCalSchema.parse(await req.json());
    const created = await prisma.calendarItem.create({
      data: {
        title: data.title.trim(),
        category: data.category,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        location: data.location || null,
        description: data.description || null,
        divisionId: !user.isSuperAdmin && user.divisionIds.length > 0 ? user.divisionIds[0] : null,
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
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
