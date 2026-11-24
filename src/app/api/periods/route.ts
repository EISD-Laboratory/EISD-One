import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/core/audit';
import { requirePermission } from '@/core/auth';
import { prisma } from '@/core/db';
import { handleRouteError, HttpError } from '@/core/http';

const createPeriodSchema = z.object({
  name: z.string().min(3),
  startDate: z.string(),
  endDate: z.string(),
});

export async function GET() {
  try {
    await requirePermission(['member.period.read']);
    const items = await prisma.period.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { memberships: true } } },
      orderBy: { startDate: 'desc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(['member.period.manage']);
    const data = createPeriodSchema.parse(await req.json());
    const created = await prisma.period.create({
      data: {
        name: data.name.trim(),
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        createdBy: user.id,
        updatedBy: user.id,
      },
    });
    await recordAudit({
      actor: user,
      action: 'period.created',
      module: 'member',
      entityType: 'Period',
      entityId: created.id,
      afterData: created,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requirePermission(['member.period.manage']);
    const { periodId } = z.object({ periodId: z.string().uuid() }).parse(await req.json());
    const target = await prisma.period.findFirst({ where: { id: periodId, deletedAt: null } });
    if (!target) throw new HttpError(404, 'Periode tidak ditemukan.');

    await prisma.$transaction([
      prisma.period.updateMany({ where: { isActive: true }, data: { isActive: false } }),
      prisma.period.update({
        where: { id: periodId },
        data: { isActive: true, updatedBy: user.id },
      }),
    ]);

    await recordAudit({
      actor: user,
      action: 'period.activated',
      module: 'member',
      entityType: 'Period',
      entityId: periodId,
      afterData: { name: target.name, isActive: true },
    });

    return NextResponse.json({ activated: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
