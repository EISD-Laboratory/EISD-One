import { AssetCondition, CoreRecordType, TransactionType } from '@prisma/client';
import { recordAudit, type AuditActor } from '@/core/audit';
import { prisma } from '@/core/db';
import { generateCsvBuffer, generateXlsxBuffer, type SheetColumn } from '@/core/excel';
import { HttpError } from '@/core/http';

export async function getCoreOverview() {
  const [transactions, assets, records] = await Promise.all([
    prisma.coreTransaction.findMany({
      where: { deletedAt: null },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
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
  ]);

  let totalIncome = 0;
  let totalExpense = 0;
  for (const tx of transactions) {
    if (tx.status !== 'APPROVED') continue;
    if (tx.type === TransactionType.INCOME) totalIncome += tx.amount;
    else totalExpense += tx.amount;
  }

  return {
    summary: {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      assetCount: assets.length,
      recordCount: records.length,
    },
    transactions,
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

const TX_COLUMNS: SheetColumn[] = [
  { key: 'date', label: 'Tanggal' },
  { key: 'type', label: 'Jenis' },
  { key: 'category', label: 'Kategori' },
  { key: 'description', label: 'Keterangan' },
  { key: 'amount', label: 'Nominal (Rp)' },
  { key: 'source', label: 'Sumber Modul' },
];

export async function exportCoreTransactions(format: 'xlsx' | 'csv', actor: AuditActor) {
  const txs = await prisma.coreTransaction.findMany({
    where: { deletedAt: null },
    orderBy: { transactionDate: 'desc' },
  });
  const rows = txs.map((t) => ({
    date: t.transactionDate.toISOString().slice(0, 10),
    type: t.type,
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
    metadata: { format, rowCount: rows.length },
  });

  if (format === 'csv') {
    return {
      buffer: generateCsvBuffer(TX_COLUMNS, rows),
      fileName: 'kas-eisd.csv',
      contentType: 'text/csv; charset=utf-8',
    };
  }
  return {
    buffer: await generateXlsxBuffer('Kas Laboratorium EISD', TX_COLUMNS, rows),
    fileName: 'kas-eisd.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
