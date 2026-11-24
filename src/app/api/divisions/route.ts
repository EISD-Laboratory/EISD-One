import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/core/audit';
import { requirePermission } from '@/core/auth';
import { prisma } from '@/core/db';
import { handleRouteError, HttpError } from '@/core/http';

const createDivSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(120),
  description: z.string().optional(),
});

const toggleDivSchema = z.object({
  id: z.string().uuid(),
  isEnabled: z.boolean(),
});

export async function GET() {
  try {
    await requirePermission(['member.division.read']);
    const items = await prisma.division.findMany({
      where: { deletedAt: null },
      orderBy: [{ isCustom: 'asc' }, { name: 'asc' }],
    });
    return NextResponse.json(items);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission(['member.division.manage']);
    const data = createDivSchema.parse(await req.json());
    const code = data.code
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');

    const dup = await prisma.division.findUnique({ where: { code } });
    if (dup) throw new HttpError(400, `Kode modul/divisi "${code}" sudah ada.`);

    const created = await prisma.division.create({
      data: {
        code,
        name: data.name.trim(),
        description: data.description || null,
        isCustom: true,
        isEnabled: true,
        createdBy: user.id,
      },
    });
    await recordAudit({
      actor: user,
      action: 'division.created',
      module: 'member',
      entityType: 'Division',
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
    const user = await requirePermission(['member.division.manage']);
    const data = toggleDivSchema.parse(await req.json());
    const before = await prisma.division.findFirst({ where: { id: data.id, deletedAt: null } });
    if (!before) throw new HttpError(404, 'Divisi/modul tidak ditemukan.');

    const updated = await prisma.division.update({
      where: { id: data.id },
      data: { isEnabled: data.isEnabled, updatedBy: user.id },
    });
    await recordAudit({
      actor: user,
      action: 'division.toggled',
      module: 'member',
      entityType: 'Division',
      entityId: data.id,
      beforeData: { isEnabled: before.isEnabled },
      afterData: { isEnabled: updated.isEnabled },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
