import { MemberStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/core/audit';
import { requirePermission } from '@/core/auth';
import { ensureMemberBirthdayOnCalendar } from '@/core/calendar';
import { prisma } from '@/core/db';
import { handleRouteError, HttpError } from '@/core/http';

const updateMemberSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().max(40).optional().nullable(),
  birthDate: z.string().optional().nullable(),
  status: z.nativeEnum(MemberStatus).optional(),
  generation: z.string().max(20).optional().nullable(),
  batchYear: z.coerce.number().int().min(2000).max(2100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

async function loadScopedMember(id: string, user: Awaited<ReturnType<typeof requirePermission>>) {
  const member = await prisma.member.findFirst({
    where: { id, deletedAt: null },
    include: {
      memberships: {
        where: { deletedAt: null },
        include: {
          division: { select: { id: true, code: true, name: true } },
          period: { select: { id: true, name: true, isActive: true, startDate: true } },
        },
        orderBy: { period: { startDate: 'desc' } },
      },
      kpiResults: {
        include: { framework: { select: { name: true, version: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 6,
      },
    },
  });
  if (!member) throw new HttpError(404, 'Anggota tidak ditemukan.');

  const canViewAll = user.isSuperAdmin || user.permissions.includes('member.member.view_all');
  if (!canViewAll) {
    const allowed = member.memberships.some((ms) => user.divisionIds.includes(ms.divisionId));
    if (!allowed) {
      throw new HttpError(403, 'Anda hanya dapat mengakses detail anggota di divisi Anda sendiri.');
    }
  }
  return member;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(['member.member.read']);
    const { id } = await context.params;
    const member = await loadScopedMember(id, user);

    const eventActivities = await prisma.eventParticipant.findMany({
      where: { memberId: id, deletedAt: null, event: { deletedAt: null } },
      include: {
        event: { select: { id: true, title: true, startAt: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({ ...member, eventActivities });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(['member.member.update']);
    const { id } = await context.params;
    const before = await loadScopedMember(id, user);
    const data = updateMemberSchema.parse(await req.json());

    const updated = await prisma.member.update({
      where: { id },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName.trim() } : {}),
        ...(data.email !== undefined
          ? { email: data.email ? data.email.trim().toLowerCase() : null }
          : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(data.birthDate !== undefined
          ? { birthDate: data.birthDate ? new Date(data.birthDate) : null }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.generation !== undefined ? { generation: data.generation?.trim() || null } : {}),
        ...(data.batchYear !== undefined ? { batchYear: data.batchYear ?? null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        updatedBy: user.id,
      },
    });

    await ensureMemberBirthdayOnCalendar(updated);
    await recordAudit({
      actor: user,
      action: 'member.updated',
      module: 'member',
      entityType: 'Member',
      entityId: id,
      beforeData: {
        fullName: before.fullName,
        email: before.email,
        phone: before.phone,
        status: before.status,
        generation: before.generation,
        batchYear: before.batchYear,
      },
      afterData: {
        fullName: updated.fullName,
        email: updated.email,
        phone: updated.phone,
        status: updated.status,
        generation: updated.generation,
        batchYear: updated.batchYear,
      },
    });

    const refreshed = await loadScopedMember(id, user);
    return NextResponse.json(refreshed);
  } catch (error) {
    return handleRouteError(error);
  }
}

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
