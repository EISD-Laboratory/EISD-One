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
      upcomingCalendar,
      upcomingEvents,
      pendingKpiManual,
      pendingRecognitions,
      customModulesCount,
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
      prisma.calendarItem.findMany({
        where: {
          deletedAt: null,
          startAt: { gte: now, lte: in30Days },
          ...(isGlobal
            ? {}
            : { OR: [{ divisionId: null }, { divisionId: { in: user.divisionIds } }] }),
        },
        orderBy: { startAt: 'asc' },
        take: 6,
      }),
      prisma.eventItem.findMany({
        where: { deletedAt: null, startAt: { gte: now } },
        select: {
          id: true,
          slug: true,
          title: true,
          startAt: true,
          status: true,
          isPublicOpen: true,
        },
        orderBy: { startAt: 'asc' },
        take: 4,
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
      upcomingCalendar,
      upcomingEvents,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
