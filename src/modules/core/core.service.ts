import {
  ApprovalStatus,
  AssetCondition,
  CoreRecordType,
  MemberStatus,
  Prisma,
  TransactionType,
} from '@prisma/client';
import ExcelJS from 'exceljs';
import { recordAudit, type AuditActor } from '@/core/audit';
import { prisma } from '@/core/db';
import { generateCsvBuffer, sanitizeFormulaCell, type SheetColumn } from '@/core/excel';
import { HttpError } from '@/core/http';
import {
  formatAutoLetterNumber,
  getTemplateMeta,
  type LetterPayload,
  type LetterTemplateCode,
} from './letter-templates';

export const DEFAULT_MONTHLY_KAS_AMOUNT = 15000;

export const MONTH_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agt',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

export const MONTH_LONG_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export interface CoreFinanceFilter {
  type?: 'ALL' | 'INCOME' | 'EXPENSE';
  year?: number | null;
  month?: number | null;
  category?: string | null;
  sourceModule?: string | null;
  search?: string | null;
  analyticsYear?: number;
}

export async function getMonthlyKasAmount(): Promise<number> {
  const setting = await prisma.setting.findUnique({
    where: { key: 'finance.monthly_kas_amount' },
    select: { value: true },
  });
  const parsed = Number(setting?.value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : DEFAULT_MONTHLY_KAS_AMOUNT;
}

function buildTransactionWhere(filter: CoreFinanceFilter): Prisma.CoreTransactionWhereInput {
  const where: Prisma.CoreTransactionWhereInput = { deletedAt: null };

  if (filter.type === 'INCOME') {
    where.type = TransactionType.INCOME;
  } else if (filter.type === 'EXPENSE') {
    where.type = TransactionType.EXPENSE;
  }

  if (filter.category && filter.category !== 'ALL') {
    where.category = filter.category;
  }

  if (filter.sourceModule && filter.sourceModule !== 'ALL') {
    where.sourceModule = filter.sourceModule;
  }

  if (filter.year && filter.year >= 2000 && filter.year <= 2100) {
    if (filter.month && filter.month >= 1 && filter.month <= 12) {
      const start = new Date(Date.UTC(filter.year, filter.month - 1, 1));
      const end = new Date(Date.UTC(filter.year, filter.month, 1));
      where.transactionDate = { gte: start, lt: end };
    } else {
      const start = new Date(Date.UTC(filter.year, 0, 1));
      const end = new Date(Date.UTC(filter.year + 1, 0, 1));
      where.transactionDate = { gte: start, lt: end };
    }
  }

  if (filter.search?.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { description: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
      { sourceModule: { contains: q, mode: 'insensitive' } },
    ];
  }

  return where;
}

export async function getCoreOverview(filter: CoreFinanceFilter = {}) {
  const now = new Date();
  const analyticsYear =
    filter.analyticsYear && filter.analyticsYear >= 2000 && filter.analyticsYear <= 2100
      ? filter.analyticsYear
      : now.getUTCFullYear();

  const txWhere = buildTransactionWhere(filter);

  const [
    allTransactions,
    filteredTransactions,
    assets,
    records,
    activeMembers,
    kasPaymentsYear,
    monthlyFee,
  ] = await Promise.all([
    prisma.coreTransaction.findMany({
      where: { deletedAt: null },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.coreTransaction.findMany({
      where: txWhere,
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    }),
    prisma.coreAsset.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
    }),
    prisma.coreRecord.findMany({
      where: { deletedAt: null },
      orderBy: { recordDate: 'desc' },
      take: 100,
    }),
    prisma.member.findMany({
      where: { status: MemberStatus.ACTIVE, deletedAt: null },
      orderBy: [{ fullName: 'asc' }, { nim: 'asc' }],
      include: {
        memberships: {
          where: { deletedAt: null },
          include: {
            division: { select: { name: true, code: true } },
            period: { select: { isActive: true, startDate: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
    prisma.coreKasPayment.findMany({
      where: { year: analyticsYear },
    }),
    getMonthlyKasAmount(),
  ]);

  // If filter.month is set without filter.year, filter in memory by month across all years
  const effectiveFilteredTx =
    !filter.year && filter.month && filter.month >= 1 && filter.month <= 12
      ? filteredTransactions.filter((t) => t.transactionDate.getUTCMonth() + 1 === filter.month)
      : filteredTransactions;

  // Overall totals (all approved non-deleted transactions)
  let totalIncome = 0;
  let totalExpense = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  const categorySet = new Set<string>();
  const sourceModuleSet = new Set<string>();
  const yearSet = new Set<number>([now.getUTCFullYear(), analyticsYear]);

  // Pre-analytics balance before analyticsYear starts
  let openingBalanceBeforeYear = 0;
  const yearStartMs = Date.UTC(analyticsYear, 0, 1);

  const monthlyIncome = new Array<number>(12).fill(0);
  const monthlyExpense = new Array<number>(12).fill(0);
  const incomeCatMap = new Map<string, { total: number; count: number }>();
  const expenseCatMap = new Map<string, { total: number; count: number }>();

  for (const tx of allTransactions) {
    categorySet.add(tx.category);
    sourceModuleSet.add(tx.sourceModule || 'core');
    const txYear = tx.transactionDate.getUTCFullYear();
    const txMonthIdx = tx.transactionDate.getUTCMonth();
    yearSet.add(txYear);

    if (tx.status !== ApprovalStatus.APPROVED) continue;

    if (tx.type === TransactionType.INCOME) {
      totalIncome += tx.amount;
      incomeCount += 1;
    } else {
      totalExpense += tx.amount;
      expenseCount += 1;
    }

    if (tx.transactionDate.getTime() < yearStartMs) {
      openingBalanceBeforeYear += tx.type === TransactionType.INCOME ? tx.amount : -tx.amount;
    } else if (txYear === analyticsYear) {
      if (tx.type === TransactionType.INCOME) {
        monthlyIncome[txMonthIdx] += tx.amount;
        const cur = incomeCatMap.get(tx.category) ?? { total: 0, count: 0 };
        cur.total += tx.amount;
        cur.count += 1;
        incomeCatMap.set(tx.category, cur);
      } else {
        monthlyExpense[txMonthIdx] += tx.amount;
        const cur = expenseCatMap.get(tx.category) ?? { total: 0, count: 0 };
        cur.total += tx.amount;
        cur.count += 1;
        expenseCatMap.set(tx.category, cur);
      }
    }
  }

  // Filtered totals
  let filteredIncome = 0;
  let filteredExpense = 0;
  for (const tx of effectiveFilteredTx) {
    if (tx.status !== ApprovalStatus.APPROVED) continue;
    if (tx.type === TransactionType.INCOME) filteredIncome += tx.amount;
    else filteredExpense += tx.amount;
  }

  // Kas Tracker aggregation for analyticsYear
  const activeMemberIdSet = new Set(activeMembers.map((m) => m.id));
  const paymentsByMember = new Map<
    string,
    Record<number, { id: string; amount: number; paidAt: string; notes: string | null }>
  >();
  const kasPaidCountByMonth = new Array<number>(12).fill(0);
  const kasCollectedByMonth = new Array<number>(12).fill(0);

  for (const p of kasPaymentsYear) {
    if (!activeMemberIdSet.has(p.memberId)) continue;
    if (p.month < 1 || p.month > 12) continue;
    const memberMap = paymentsByMember.get(p.memberId) ?? {};
    memberMap[p.month] = {
      id: p.id,
      amount: p.amount,
      paidAt: p.paidAt.toISOString(),
      notes: p.notes,
    };
    paymentsByMember.set(p.memberId, memberMap);
    kasPaidCountByMonth[p.month - 1] += 1;
    kasCollectedByMonth[p.month - 1] += p.amount;
  }

  const totalActiveMembers = activeMembers.length;
  const currentMonth = now.getUTCMonth() + 1;
  const currentMonthIdx = currentMonth - 1;

  let runningBalance = openingBalanceBeforeYear;
  const monthlyAnalytics = MONTH_SHORT_ID.map((label, idx) => {
    const income = monthlyIncome[idx];
    const expense = monthlyExpense[idx];
    const net = income - expense;
    runningBalance += net;
    const kasTarget = totalActiveMembers * monthlyFee;
    return {
      month: idx + 1,
      label,
      fullLabel: MONTH_LONG_ID[idx],
      income,
      expense,
      net,
      cumulativeBalance: runningBalance,
      kasPaidCount: kasPaidCountByMonth[idx],
      kasTargetCount: totalActiveMembers,
      kasCollected: kasCollectedByMonth[idx],
      kasTarget,
    };
  });

  const yearIncome = monthlyIncome.reduce((a, b) => a + b, 0);
  const yearExpense = monthlyExpense.reduce((a, b) => a + b, 0);

  const incomeByCategory = Array.from(incomeCatMap.entries())
    .map(([category, v]) => ({ category, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);

  const expenseByCategory = Array.from(expenseCatMap.entries())
    .map(([category, v]) => ({ category, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);

  const kasMembers = activeMembers.map((m) => {
    const primaryMembership =
      m.memberships.find((ms) => ms.period.isActive) ?? m.memberships[0] ?? null;
    const payments = paymentsByMember.get(m.id) ?? {};
    const paidMonths = Object.keys(payments).length;
    const totalPaid = Object.values(payments).reduce((acc, p) => acc + p.amount, 0);
    return {
      id: m.id,
      nim: m.nim,
      fullName: m.fullName,
      generation: m.generation,
      divisionName: primaryMembership?.division.name ?? 'Umum',
      positionTitle: primaryMembership?.positionTitle ?? 'Anggota',
      payments,
      paidMonths,
      totalPaid,
    };
  });

  const annualCollected = kasCollectedByMonth.reduce((a, b) => a + b, 0);
  const annualPaidSlots = kasPaidCountByMonth.reduce((a, b) => a + b, 0);
  const annualTotalSlots = totalActiveMembers * 12;
  const annualTarget = annualTotalSlots * monthlyFee;

  // Hitung nomor urut surat otomatis berikutnya per tahun
  const maxSeqByYear: Record<number, number> = {};
  for (const rec of records) {
    if (rec.recordType === CoreRecordType.LETTER && rec.sequenceYear && rec.sequenceNo) {
      maxSeqByYear[rec.sequenceYear] = Math.max(
        maxSeqByYear[rec.sequenceYear] ?? 0,
        rec.sequenceNo,
      );
    }
  }
  const currentYearNum = now.getUTCFullYear();
  const nextLetterSeqByYear: Record<number, number> = {
    [currentYearNum]: (maxSeqByYear[currentYearNum] ?? 0) + 1,
    [analyticsYear]: (maxSeqByYear[analyticsYear] ?? 0) + 1,
  };
  for (const [yrKey, maxSeq] of Object.entries(maxSeqByYear)) {
    nextLetterSeqByYear[Number(yrKey)] = maxSeq + 1;
  }

  return {
    summary: {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      incomeCount,
      expenseCount,
      assetCount: assets.length,
      recordCount: records.length,
    },
    filteredSummary: {
      totalIncome: filteredIncome,
      totalExpense: filteredExpense,
      balance: filteredIncome - filteredExpense,
      count: effectiveFilteredTx.length,
    },
    meta: {
      categories: Array.from(categorySet).sort((a, b) => a.localeCompare(b)),
      sourceModules: Array.from(sourceModuleSet).sort((a, b) => a.localeCompare(b)),
      availableYears: Array.from(yearSet).sort((a, b) => b - a),
      nextLetterSeqByYear,
    },
    analytics: {
      year: analyticsYear,
      yearIncome,
      yearExpense,
      yearNet: yearIncome - yearExpense,
      openingBalanceBeforeYear,
      monthly: monthlyAnalytics,
      incomeByCategory,
      expenseByCategory,
    },
    kasTracker: {
      year: analyticsYear,
      monthlyFee,
      currentMonth,
      summary: {
        totalActiveMembers,
        currentMonthPaidCount: kasPaidCountByMonth[currentMonthIdx] ?? 0,
        currentMonthTarget: totalActiveMembers * monthlyFee,
        currentMonthCollected: kasCollectedByMonth[currentMonthIdx] ?? 0,
        annualTarget,
        annualCollected,
        annualPaidSlots,
        annualTotalSlots,
      },
      members: kasMembers,
    },
    transactions: effectiveFilteredTx,
    assets,
    records,
  };
}

export async function createManualTransaction(
  input: {
    type: TransactionType;
    category: string;
    description: string;
    amount: number;
    transactionDate: string;
  },
  actor: AuditActor,
) {
  const created = await prisma.coreTransaction.create({
    data: {
      type: input.type,
      category: input.category.trim(),
      description: input.description.trim(),
      amount: Math.round(input.amount),
      transactionDate: new Date(input.transactionDate),
      sourceModule: 'core',
      createdBy: actor.id,
      updatedBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'core.transaction.created',
    module: 'core',
    entityType: 'CoreTransaction',
    entityId: created.id,
    afterData: created,
  });

  return created;
}

export async function deleteTransaction(id: string, actor: AuditActor) {
  const existing = await prisma.coreTransaction.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new HttpError(404, 'Transaksi tidak ditemukan.');

  await prisma.$transaction(async (tx) => {
    await tx.coreTransaction.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor.id },
    });
    // Jika transaksi berasal dari tracker kas, hapus juga status bayarnya agar konsisten
    await tx.coreKasPayment.deleteMany({
      where: { transactionId: id },
    });
  });

  await recordAudit({
    actor,
    action: 'core.transaction.deleted',
    module: 'core',
    entityType: 'CoreTransaction',
    entityId: id,
    beforeData: existing,
  });

  return { deleted: true, id };
}

export async function toggleKasPayment(
  input: {
    memberId: string;
    year: number;
    month: number;
    paid: boolean;
    amount?: number;
    paidAt?: string;
    notes?: string;
  },
  actor: AuditActor,
) {
  if (input.month < 1 || input.month > 12) {
    throw new HttpError(400, 'Bulan harus berada di antara 1 sampai 12.');
  }
  if (input.year < 2020 || input.year > 2100) {
    throw new HttpError(400, 'Tahun tidak valid.');
  }

  const member = await prisma.member.findFirst({
    where: { id: input.memberId, deletedAt: null },
    select: { id: true, nim: true, fullName: true },
  });
  if (!member) throw new HttpError(404, 'Anggota tidak ditemukan.');

  const monthlyFee = await getMonthlyKasAmount();
  const amount = input.amount && input.amount > 0 ? Math.round(input.amount) : monthlyFee;
  const monthName = MONTH_LONG_ID[input.month - 1];
  const sourceEntityId = `${member.id}:${input.year}-${input.month}`;

  if (input.paid) {
    const paidDate = input.paidAt ? new Date(input.paidAt) : new Date();
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.coreKasPayment.findUnique({
        where: {
          memberId_year_month: {
            memberId: member.id,
            year: input.year,
            month: input.month,
          },
        },
      });

      let transactionId = existing?.transactionId ?? null;
      if (transactionId) {
        const linkedTx = await tx.coreTransaction.findFirst({
          where: { id: transactionId, deletedAt: null },
        });
        if (!linkedTx) transactionId = null;
      }

      if (!transactionId) {
        const createdTx = await tx.coreTransaction.create({
          data: {
            type: TransactionType.INCOME,
            category: 'Kas Bulanan',
            description: `Kas Bulanan ${monthName} ${input.year} — ${member.fullName} (${member.nim})`,
            amount,
            transactionDate: paidDate,
            sourceModule: 'kas',
            sourceEntityId,
            status: ApprovalStatus.APPROVED,
            createdBy: actor.id,
            updatedBy: actor.id,
          },
        });
        transactionId = createdTx.id;
      } else {
        await tx.coreTransaction.update({
          where: { id: transactionId },
          data: { amount, transactionDate: paidDate, updatedBy: actor.id },
        });
      }

      const payment = await tx.coreKasPayment.upsert({
        where: {
          memberId_year_month: {
            memberId: member.id,
            year: input.year,
            month: input.month,
          },
        },
        update: {
          amount,
          paidAt: paidDate,
          transactionId,
          notes: input.notes?.trim() || null,
          updatedBy: actor.id,
        },
        create: {
          memberId: member.id,
          year: input.year,
          month: input.month,
          amount,
          paidAt: paidDate,
          transactionId,
          notes: input.notes?.trim() || null,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
      });

      return payment;
    });

    await recordAudit({
      actor,
      action: 'core.kas.marked_paid',
      module: 'core',
      entityType: 'CoreKasPayment',
      entityId: result.id,
      afterData: {
        memberId: member.id,
        memberName: member.fullName,
        year: input.year,
        month: input.month,
        amount,
      },
    });

    return { paid: true, payment: result };
  }

  // Unmark / cancel payment
  const existing = await prisma.coreKasPayment.findUnique({
    where: {
      memberId_year_month: {
        memberId: member.id,
        year: input.year,
        month: input.month,
      },
    },
  });

  if (existing) {
    await prisma.$transaction(async (tx) => {
      if (existing.transactionId) {
        await tx.coreTransaction.updateMany({
          where: { id: existing.transactionId, deletedAt: null },
          data: { deletedAt: new Date(), updatedBy: actor.id },
        });
      }
      await tx.coreKasPayment.delete({ where: { id: existing.id } });
    });

    await recordAudit({
      actor,
      action: 'core.kas.marked_unpaid',
      module: 'core',
      entityType: 'CoreKasPayment',
      entityId: existing.id,
      beforeData: {
        memberId: member.id,
        memberName: member.fullName,
        year: input.year,
        month: input.month,
        amount: existing.amount,
      },
    });
  }

  return { paid: false, payment: null };
}

export async function bulkMarkKasPaid(
  input: { year: number; month: number; memberIds?: string[] },
  actor: AuditActor,
) {
  if (input.month < 1 || input.month > 12) {
    throw new HttpError(400, 'Bulan harus berada di antara 1 sampai 12.');
  }

  const members = await prisma.member.findMany({
    where: {
      status: MemberStatus.ACTIVE,
      deletedAt: null,
      ...(input.memberIds && input.memberIds.length > 0 ? { id: { in: input.memberIds } } : {}),
    },
    select: { id: true, nim: true, fullName: true },
  });

  const existingPayments = await prisma.coreKasPayment.findMany({
    where: {
      year: input.year,
      month: input.month,
      memberId: { in: members.map((m) => m.id) },
    },
    select: { memberId: true },
  });
  const alreadyPaid = new Set(existingPayments.map((p) => p.memberId));
  const pendingMembers = members.filter((m) => !alreadyPaid.has(m.id));

  if (pendingMembers.length === 0) {
    return { markedCount: 0, totalAmount: 0 };
  }

  const monthlyFee = await getMonthlyKasAmount();
  const monthName = MONTH_LONG_ID[input.month - 1];
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const m of pendingMembers) {
      const createdTx = await tx.coreTransaction.create({
        data: {
          type: TransactionType.INCOME,
          category: 'Kas Bulanan',
          description: `Kas Bulanan ${monthName} ${input.year} — ${m.fullName} (${m.nim})`,
          amount: monthlyFee,
          transactionDate: now,
          sourceModule: 'kas',
          sourceEntityId: `${m.id}:${input.year}-${input.month}`,
          status: ApprovalStatus.APPROVED,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
      });
      await tx.coreKasPayment.create({
        data: {
          memberId: m.id,
          year: input.year,
          month: input.month,
          amount: monthlyFee,
          paidAt: now,
          transactionId: createdTx.id,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
      });
    }
  });

  await recordAudit({
    actor,
    action: 'core.kas.bulk_marked_paid',
    module: 'core',
    entityType: 'CoreKasPayment',
    metadata: {
      year: input.year,
      month: input.month,
      markedCount: pendingMembers.length,
      monthlyFee,
    },
  });

  return {
    markedCount: pendingMembers.length,
    totalAmount: pendingMembers.length * monthlyFee,
  };
}

export async function createAsset(
  input: {
    code: string;
    name: string;
    category: string;
    condition: AssetCondition;
    location?: string;
    quantity: number;
    notes?: string;
  },
  actor: AuditActor,
) {
  const dup = await prisma.coreAsset.findUnique({ where: { code: input.code.trim() } });
  if (dup) throw new HttpError(400, `Kode aset "${input.code}" sudah terdaftar.`);

  const created = await prisma.coreAsset.create({
    data: {
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      category: input.category.trim(),
      condition: input.condition,
      location: input.location?.trim() || null,
      quantity: input.quantity,
      notes: input.notes?.trim() || null,
      createdBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'core.asset.created',
    module: 'core',
    entityType: 'CoreAsset',
    entityId: created.id,
    afterData: created,
  });
  return created;
}

export async function createCoreRecord(
  input: {
    recordType: CoreRecordType;
    referenceNo?: string;
    title: string;
    recordDate: string;
    summary?: string;
    documentUrl?: string;
  },
  actor: AuditActor,
) {
  const created = await prisma.coreRecord.create({
    data: {
      recordType: input.recordType,
      referenceNo: input.referenceNo?.trim() || null,
      title: input.title.trim(),
      recordDate: new Date(input.recordDate),
      summary: input.summary?.trim() || null,
      documentUrl: input.documentUrl?.trim() || null,
      createdBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'core.record.created',
    module: 'core',
    entityType: 'CoreRecord',
    entityId: created.id,
    afterData: created,
  });
  return created;
}

export async function createGeneratedLetter(payload: LetterPayload, actor: AuditActor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(payload.letterDate.trim());
  const seqYear = m ? Number(m[1]) : new Date().getUTCFullYear();
  const meta = getTemplateMeta(payload.templateCode);

  const created = await prisma.$transaction(async (tx) => {
    const agg = await tx.coreRecord.aggregate({
      where: {
        recordType: CoreRecordType.LETTER,
        sequenceYear: seqYear,
        deletedAt: null,
      },
      _max: { sequenceNo: true },
    });
    const nextSeq = (agg._max.sequenceNo ?? 0) + 1;
    const referenceNo = formatAutoLetterNumber(nextSeq, payload.templateCode, payload.letterDate);

    const summaryParts = [
      `Template: ${meta.name}`,
      payload.recipientName.trim() ? `Tujuan: ${payload.recipientName.trim()}` : null,
      payload.memberName.trim() ? `Anggota: ${payload.memberName.trim()}` : null,
      payload.purpose.trim() ? `Keperluan: ${payload.purpose.trim()}` : null,
    ].filter(Boolean);

    return tx.coreRecord.create({
      data: {
        recordType: CoreRecordType.LETTER,
        referenceNo,
        templateCode: payload.templateCode,
        sequenceYear: seqYear,
        sequenceNo: nextSeq,
        title: payload.subject.trim() || meta.defaultSubject,
        recordDate: new Date(payload.letterDate),
        summary: summaryParts.join(' · '),
        letterDataJson: payload as unknown as Prisma.InputJsonValue,
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    });
  });

  await recordAudit({
    actor,
    action: 'core.letter.generated',
    module: 'core',
    entityType: 'CoreRecord',
    entityId: created.id,
    afterData: {
      referenceNo: created.referenceNo,
      templateCode: created.templateCode,
      title: created.title,
    },
  });

  return created;
}

export async function deleteCoreRecord(id: string, actor: AuditActor) {
  const existing = await prisma.coreRecord.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw new HttpError(404, 'Arsip administrasi tidak ditemukan.');

  await prisma.coreRecord.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: actor.id },
  });

  await recordAudit({
    actor,
    action: 'core.record.deleted',
    module: 'core',
    entityType: 'CoreRecord',
    entityId: id,
    beforeData: { title: existing.title, referenceNo: existing.referenceNo },
  });

  return { deleted: true, id };
}

export async function getCoreLetterForPdf(id: string) {
  const record = await prisma.coreRecord.findFirst({
    where: { id, recordType: CoreRecordType.LETTER, deletedAt: null },
  });
  if (!record) throw new HttpError(404, 'Surat resmi tidak ditemukan.');
  if (!record.letterDataJson || typeof record.letterDataJson !== 'object') {
    throw new HttpError(400, 'Arsip surat ini tidak memiliki data template cetak.');
  }

  const raw = record.letterDataJson as Record<string, unknown>;
  const templateCode = (
    typeof raw.templateCode === 'string' ? raw.templateCode : record.templateCode || 'UMM'
  ) as LetterTemplateCode;

  const payload: LetterPayload = {
    templateCode,
    letterDate: String(raw.letterDate || record.recordDate.toISOString().slice(0, 10)),
    city: String(raw.city || 'Bandung'),
    attachment: String(raw.attachment || '-'),
    subject: String(raw.subject || record.title),
    recipientName: String(raw.recipientName || ''),
    recipientOrg: String(raw.recipientOrg || ''),
    recipientPlace: String(raw.recipientPlace || 'Tempat'),
    purpose: String(raw.purpose || ''),
    eventDate: String(raw.eventDate || ''),
    eventTime: String(raw.eventTime || ''),
    eventLocation: String(raw.eventLocation || ''),
    itemDetails: String(raw.itemDetails || ''),
    memberName: String(raw.memberName || ''),
    memberNim: String(raw.memberNim || ''),
    memberDivision: String(raw.memberDivision || ''),
    periodName: String(raw.periodName || '2026/2027'),
    customBody: String(raw.customBody || ''),
    chairName: String(raw.chairName || 'Alya Pratama'),
    chairId: String(raw.chairId || ''),
    secretaryName: String(raw.secretaryName || 'Bima Mahendra'),
    secretaryId: String(raw.secretaryId || ''),
  };

  return {
    id: record.id,
    referenceNo: record.referenceNo || '001/UMM/EISD/I/2026',
    title: record.title,
    payload,
  };
}

const TX_COLUMNS: SheetColumn[] = [
  { key: 'date', label: 'Tanggal' },
  { key: 'type', label: 'Jenis' },
  { key: 'category', label: 'Kategori' },
  { key: 'description', label: 'Keterangan' },
  { key: 'amount', label: 'Nominal (Rp)' },
  { key: 'source', label: 'Sumber Modul' },
];

const RP_NUM_FMT = '"Rp" #,##0';

function styleHeaderRow(row: ExcelJS.Row, bgArgb = 'FF0F172A') {
  row.height = 24;
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
}

export async function exportCoreTransactions(
  format: 'xlsx' | 'csv',
  actor: AuditActor,
  filter: CoreFinanceFilter = {},
  scope: 'full' | 'transactions' | 'kas' = 'full',
) {
  const overview = await getCoreOverview(filter);

  const txRows = overview.transactions.map((t) => ({
    date: t.transactionDate.toISOString().slice(0, 10),
    type: t.type === TransactionType.INCOME ? 'Pemasukan' : 'Pengeluaran',
    category: t.category,
    description: t.description,
    amount: t.amount,
    source: t.sourceModule || 'core',
  }));

  await recordAudit({
    actor,
    action: 'core.transactions.exported',
    module: 'core',
    entityType: 'CoreTransaction',
    metadata: { format, scope, rowCount: txRows.length, filter },
  });

  if (format === 'csv') {
    return {
      buffer: generateCsvBuffer(TX_COLUMNS, txRows),
      fileName: `keuangan-eisd-${overview.analytics.year}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'EISD One';
  wb.created = new Date();
  const yr = overview.analytics.year;

  // Sheet 1: Ringkasan & Analitik
  if (scope === 'full') {
    const wsSummary = wb.addWorksheet(`Ringkasan ${yr}`);
    wsSummary.columns = [
      { header: 'Bulan', key: 'bulan', width: 16 },
      { header: 'Pemasukan (Rp)', key: 'income', width: 20 },
      { header: 'Pengeluaran (Rp)', key: 'expense', width: 20 },
      { header: 'Selisih Bersih (Rp)', key: 'net', width: 20 },
      { header: 'Saldo Kumulatif (Rp)', key: 'cum', width: 22 },
      { header: 'Kas Terkumpul (Rp)', key: 'kas', width: 20 },
      { header: 'Anggota Lunas Kas', key: 'kasCount', width: 20 },
    ];

    // Title block at top
    wsSummary.spliceRows(1, 0, [`Laporan Analitik Keuangan Laboratorium EISD — Tahun ${yr}`]);
    wsSummary.mergeCells('A1:G1');
    const titleCell = wsSummary.getCell('A1');
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
    wsSummary.getRow(1).height = 28;

    wsSummary.spliceRows(2, 0, [
      'Total Pemasukan Keseluruhan',
      overview.summary.totalIncome,
      'Total Pengeluaran Keseluruhan',
      overview.summary.totalExpense,
      'Saldo Kas Bersih',
      overview.summary.balance,
      `Iuran Kas: Rp ${overview.kasTracker.monthlyFee.toLocaleString('id-ID')}/bln`,
    ]);
    const kpiRow = wsSummary.getRow(2);
    kpiRow.font = { bold: true, size: 10 };
    kpiRow.getCell(2).numFmt = RP_NUM_FMT;
    kpiRow.getCell(4).numFmt = RP_NUM_FMT;
    kpiRow.getCell(6).numFmt = RP_NUM_FMT;

    wsSummary.spliceRows(3, 0, []);
    styleHeaderRow(wsSummary.getRow(4), 'FF4F46E5');

    for (const m of overview.analytics.monthly) {
      const r = wsSummary.addRow({
        bulan: m.fullLabel,
        income: m.income,
        expense: m.expense,
        net: m.net,
        cum: m.cumulativeBalance,
        kas: m.kasCollected,
        kasCount: `${m.kasPaidCount} / ${m.kasTargetCount}`,
      });
      r.getCell(2).numFmt = RP_NUM_FMT;
      r.getCell(3).numFmt = RP_NUM_FMT;
      r.getCell(4).numFmt = RP_NUM_FMT;
      r.getCell(5).numFmt = RP_NUM_FMT;
      r.getCell(6).numFmt = RP_NUM_FMT;
    }

    const totalRow = wsSummary.addRow({
      bulan: `TOTAL ${yr}`,
      income: overview.analytics.yearIncome,
      expense: overview.analytics.yearExpense,
      net: overview.analytics.yearNet,
      cum:
        overview.analytics.monthly[overview.analytics.monthly.length - 1]?.cumulativeBalance ??
        overview.summary.balance,
      kas: overview.kasTracker.summary.annualCollected,
      kasCount: `${overview.kasTracker.summary.annualPaidSlots} / ${overview.kasTracker.summary.annualTotalSlots}`,
    });
    totalRow.font = { bold: true };
    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });
    totalRow.getCell(2).numFmt = RP_NUM_FMT;
    totalRow.getCell(3).numFmt = RP_NUM_FMT;
    totalRow.getCell(4).numFmt = RP_NUM_FMT;
    totalRow.getCell(5).numFmt = RP_NUM_FMT;
    totalRow.getCell(6).numFmt = RP_NUM_FMT;
  }

  // Sheet 2: Transaksi Kas (sesuai filter aktif)
  if (scope === 'full' || scope === 'transactions') {
    const wsTx = wb.addWorksheet('Transaksi Kas');
    wsTx.columns = [
      { header: 'Tanggal', key: 'date', width: 14 },
      { header: 'Jenis', key: 'type', width: 15 },
      { header: 'Kategori', key: 'category', width: 22 },
      { header: 'Keterangan', key: 'description', width: 46 },
      { header: 'Sumber Modul', key: 'source', width: 16 },
      { header: 'Nominal (Rp)', key: 'amount', width: 20 },
    ];
    styleHeaderRow(wsTx.getRow(1), 'FF0F172A');

    for (const row of txRows) {
      const r = wsTx.addRow({
        date: sanitizeFormulaCell(row.date),
        type: sanitizeFormulaCell(row.type),
        category: sanitizeFormulaCell(row.category),
        description: sanitizeFormulaCell(row.description),
        source: sanitizeFormulaCell(row.source),
        amount: row.amount,
      });
      r.getCell(6).numFmt = RP_NUM_FMT;
      r.getCell(2).font = {
        bold: true,
        color: { argb: row.type === 'Pemasukan' ? 'FF047857' : 'FFBE123C' },
      };
    }

    const subtotalRow = wsTx.addRow({
      date: '',
      type: 'RINGKASAN',
      category: `Pemasukan: Rp ${overview.filteredSummary.totalIncome.toLocaleString('id-ID')}`,
      description: `Pengeluaran: Rp ${overview.filteredSummary.totalExpense.toLocaleString('id-ID')}`,
      source: 'Selisih',
      amount: overview.filteredSummary.balance,
    });
    subtotalRow.font = { bold: true };
    subtotalRow.getCell(6).numFmt = RP_NUM_FMT;
    subtotalRow.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
    });
  }

  // Sheet 3: Tracker Kas Bulanan Anggota (Rp 15.000/bulan)
  if (scope === 'full' || scope === 'kas') {
    const wsKas = wb.addWorksheet(`Tracker Kas ${yr}`);
    wsKas.columns = [
      { header: 'NIM', key: 'nim', width: 15 },
      { header: 'Nama Anggota', key: 'name', width: 26 },
      { header: 'Generasi', key: 'gen', width: 11 },
      { header: 'Divisi', key: 'div', width: 22 },
      ...MONTH_SHORT_ID.map((m, i) => ({ header: m, key: `m${i + 1}`, width: 13 })),
      { header: 'Bulan Lunas', key: 'paidMonths', width: 14 },
      { header: 'Total Dibayar (Rp)', key: 'totalPaid', width: 20 },
      { header: 'Sisa Target Tahunan (Rp)', key: 'remaining', width: 24 },
    ];
    styleHeaderRow(wsKas.getRow(1), 'FF059669');

    const fee = overview.kasTracker.monthlyFee;
    for (const member of overview.kasTracker.members) {
      const rowData: Record<string, string | number> = {
        nim: sanitizeFormulaCell(member.nim),
        name: sanitizeFormulaCell(member.fullName),
        gen: sanitizeFormulaCell(member.generation || '-'),
        div: sanitizeFormulaCell(member.divisionName),
        paidMonths: `${member.paidMonths} / 12`,
        totalPaid: member.totalPaid,
        remaining: Math.max(0, 12 * fee - member.totalPaid),
      };
      for (let m = 1; m <= 12; m += 1) {
        const pay = member.payments[m];
        rowData[`m${m}`] = pay ? pay.amount : 'Belum';
      }
      const r = wsKas.addRow(rowData);
      for (let m = 1; m <= 12; m += 1) {
        const cell = r.getCell(4 + m);
        const pay = member.payments[m];
        if (pay) {
          cell.numFmt = RP_NUM_FMT;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
          cell.font = { bold: true, color: { argb: 'FF065F46' } };
        } else {
          cell.alignment = { horizontal: 'center' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
          cell.font = { color: { argb: 'FF9F1239' } };
        }
      }
      r.getCell(18).numFmt = RP_NUM_FMT;
      r.getCell(19).numFmt = RP_NUM_FMT;
    }

    const kasSummaryRow = wsKas.addRow({
      nim: '',
      name: `TOTAL TERKUMPUL (${overview.kasTracker.summary.totalActiveMembers} anggota × Rp ${fee.toLocaleString('id-ID')}/bln)`,
      gen: '',
      div: '',
      ...Object.fromEntries(overview.analytics.monthly.map((m) => [`m${m.month}`, m.kasCollected])),
      paidMonths: `${overview.kasTracker.summary.annualPaidSlots} / ${overview.kasTracker.summary.annualTotalSlots}`,
      totalPaid: overview.kasTracker.summary.annualCollected,
      remaining: Math.max(
        0,
        overview.kasTracker.summary.annualTarget - overview.kasTracker.summary.annualCollected,
      ),
    });
    kasSummaryRow.font = { bold: true };
    kasSummaryRow.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });
    for (let m = 1; m <= 12; m += 1) {
      kasSummaryRow.getCell(4 + m).numFmt = RP_NUM_FMT;
    }
    kasSummaryRow.getCell(18).numFmt = RP_NUM_FMT;
    kasSummaryRow.getCell(19).numFmt = RP_NUM_FMT;
  }

  // Sheet 4: Inventaris Aset
  if (scope === 'full') {
    const wsAssets = wb.addWorksheet('Inventaris Aset');
    wsAssets.columns = [
      { header: 'Kode Aset', key: 'code', width: 18 },
      { header: 'Nama Aset', key: 'name', width: 32 },
      { header: 'Kategori', key: 'category', width: 20 },
      { header: 'Kondisi', key: 'condition', width: 14 },
      { header: 'Lokasi', key: 'location', width: 24 },
      { header: 'Jumlah', key: 'quantity', width: 12 },
    ];
    styleHeaderRow(wsAssets.getRow(1), 'FF6D28D9');
    for (const a of overview.assets) {
      wsAssets.addRow({
        code: sanitizeFormulaCell(a.code),
        name: sanitizeFormulaCell(a.name),
        category: sanitizeFormulaCell(a.category),
        condition: sanitizeFormulaCell(a.condition),
        location: sanitizeFormulaCell(a.location || '-'),
        quantity: a.quantity,
      });
    }
  }

  const arr = await wb.xlsx.writeBuffer();
  const suffix =
    scope === 'kas'
      ? `tracker-kas-${yr}`
      : scope === 'transactions'
        ? `transaksi-kas-${yr}`
        : `laporan-keuangan-${yr}`;

  return {
    buffer: Buffer.from(arr),
    fileName: `eisd-${suffix}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
