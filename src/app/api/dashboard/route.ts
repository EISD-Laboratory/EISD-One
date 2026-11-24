import { ApprovalStatus, KpiSourceType, MemberStatus, TransactionType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { requirePermission } from '@/core/auth';
import { prisma } from '@/core/db';
import { handleRouteError } from '@/core/http';

export async function GET() {
  try {
    const user = await requirePermission([], true);
    const isGlobal = user.isSuperAdmin || user.roles.some((r) => r.scope === 'GLOBAL');
    const activePeriod = await prisma.period.findFirst({
      where: { isActive: true, deletedAt: null },
    });

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      activeMemberCount,
      divisions,
      memberships,
      upcomingCalendar,
      upcomingEvents,
      pendingKpiManual,
      pendingRecognitions,
      customModulesCount,
      recentAudits,
    ] = await Promise.all([
      isGlobal
        ? prisma.member.count({ where: { status: MemberStatus.ACTIVE, deletedAt: null } })
        : prisma.member.count({
            where: {
              status: MemberStatus.ACTIVE,
              deletedAt: null,
              memberships: {
                some: {
                  divisionId: { in: user.divisionIds },
                  ...(activePeriod ? { periodId: activePeriod.id } : {}),
                  deletedAt: null,
                },
              },
            },
          }),
      prisma.division.findMany({
        where: { deletedAt: null },
        select: { id: true, code: true, name: true, isCustom: true, isEnabled: true },
        orderBy: [{ isCustom: 'asc' }, { name: 'asc' }],
      }),
      prisma.membership.findMany({
        where: {
          deletedAt: null,
          ...(activePeriod ? { periodId: activePeriod.id } : {}),
          member: { status: MemberStatus.ACTIVE, deletedAt: null },
        },
        select: { divisionId: true, isHead: true },
      }),
      prisma.calendarItem.findMany({
        where: {
          deletedAt: null,
          startAt: { gte: now, lte: in30Days },
          ...(isGlobal
            ? {}
            : { OR: [{ divisionId: null }, { divisionId: { in: user.divisionIds } }] }),
        },
        orderBy: { startAt: 'asc' },
        take: 8,
      }),
      prisma.eventItem.findMany({
        where: { deletedAt: null, startAt: { gte: now } },
        select: {
          id: true,
          slug: true,
          title: true,
          startAt: true,
          location: true,
          status: true,
          isPublicOpen: true,
          _count: { select: { participants: { where: { deletedAt: null } } } },
        },
        orderBy: { startAt: 'asc' },
        take: 6,
      }),
      isGlobal
        ? prisma.kpiScore.count({
            where: { sourceType: KpiSourceType.MANUAL, approvalStatus: ApprovalStatus.PENDING },
          })
        : Promise.resolve(0),
      isGlobal
        ? prisma.enablerRecognition.count({
            where: { status: ApprovalStatus.PENDING, deletedAt: null },
          })
        : Promise.resolve(0),
      prisma.customModuleSchema.count({ where: { deletedAt: null } }),
      prisma.auditLog.findMany({
        where: isGlobal ? {} : { actorId: user.id },
        select: {
          id: true,
          actorEmail: true,
          action: true,
          module: true,
          entityType: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 7,
      }),
    ]);

    // Saldo kas Core hanya untuk pengguna yang punya izin membaca keuangan Core
    let cashBalance: number | null = null;
    if (user.isSuperAdmin || user.permissions.includes('core.finance.read')) {
      const txs = await prisma.coreTransaction.findMany({
        where: { deletedAt: null, status: ApprovalStatus.APPROVED },
        select: { type: true, amount: true },
      });
      cashBalance = txs.reduce(
        (sum, t) => sum + (t.type === TransactionType.INCOME ? t.amount : -t.amount),
        0,
      );
    }

    const memberCountByDiv = new Map<string, { total: number; heads: number }>();
    for (const m of memberships) {
      const curr = memberCountByDiv.get(m.divisionId) ?? { total: 0, heads: 0 };
      curr.total += 1;
      if (m.isHead) curr.heads += 1;
      memberCountByDiv.set(m.divisionId, curr);
    }

    const divisionStats = divisions
      .filter((d) => !d.isCustom)
      .map((d) => {
        const counts = memberCountByDiv.get(d.id) ?? { total: 0, heads: 0 };
        return {
          code: d.code,
          name: d.name,
          shortLabel:
            d.code === 'research'
              ? 'R&C'
              : d.code === 'study-group'
                ? 'SG'
                : d.code === 'competition'
                  ? 'COMP'
                  : d.code === 'praktikum'
                    ? 'PRK'
                    : d.code.toUpperCase().slice(0, 4),
          memberCount: counts.total,
          headCount: counts.heads,
          isEnabled: d.isEnabled,
        };
      });

    const userDivisions = divisions.filter((d) => user.divisionIds.includes(d.id));

    return NextResponse.json({
      roleView: user.isSuperAdmin ? 'ADMIN' : isGlobal ? 'CORE' : 'KADIV',
      activePeriod: activePeriod ? { id: activePeriod.id, name: activePeriod.name } : null,
      userDivisions,
      stats: {
        activeMemberCount,
        enabledModuleCount: divisions.filter((d) => d.isEnabled).length,
        totalModuleCount: divisions.length,
        customModulesCount,
        cashBalance,
        pendingApprovals: pendingKpiManual + pendingRecognitions,
        pendingKpiManual,
        pendingRecognitions,
      },
      divisions,
      divisionStats,
      upcomingCalendar,
      upcomingEvents: upcomingEvents.map((ev) => ({
        id: ev.id,
        slug: ev.slug,
        title: ev.title,
        startAt: ev.startAt,
        location: ev.location,
        status: ev.status,
        isPublicOpen: ev.isPublicOpen,
        participantCount: ev._count.participants,
      })),
      recentActivities: recentAudits,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
