import { NextRequest, NextResponse } from 'next/server';
import { recordAudit } from '@/core/audit';
import { requirePermission } from '@/core/auth';
import { prisma } from '@/core/db';
import { handleRouteError, HttpError } from '@/core/http';

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(['member.member.delete']);
    const { id } = await context.params;
    const before = await prisma.member.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new HttpError(404, 'Anggota tidak ditemukan.');

    await prisma.member.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: user.id },
    });

    await recordAudit({
      actor: user,
      action: 'member.deleted',
      module: 'member',
      entityType: 'Member',
      entityId: id,
      beforeData: before,
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
