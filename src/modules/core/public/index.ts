import { ApprovalStatus, TransactionType } from '@prisma/client';
import { recordAudit, type AuditActor } from '@/core/audit';
import { prisma } from '@/core/db';

export const CORE_MODULE_PUBLIC_VERSION = '0.2.0';

/**
 * Kontrak publik modul Core agar modul divisi lain (Event, Enabler) dapat
 * mencatat transaksi kas secara terintegrasi tanpa mengimpor internal Core.
 */
export async function recordCoreTransaction(input: {
  type: TransactionType;
  category: string;
  description: string;
  amount: number;
  transactionDate?: Date;
  sourceModule: string;
  sourceEntityId: string;
  status?: ApprovalStatus;
  actor?: AuditActor | null;
}) {
  if (input.amount <= 0) return null;

  // Idempotent: hindari duplikasi transaksi untuk sumber & kategori yang sama
  const existing = await prisma.coreTransaction.findFirst({
    where: {
      sourceModule: input.sourceModule,
      sourceEntityId: input.sourceEntityId,
      category: input.category,
      deletedAt: null,
    },
  });
  if (existing) return existing;

  const created = await prisma.coreTransaction.create({
    data: {
      type: input.type,
      category: input.category,
      description: input.description,
      amount: Math.round(input.amount),
      transactionDate: input.transactionDate ?? new Date(),
      sourceModule: input.sourceModule,
      sourceEntityId: input.sourceEntityId,
      status: input.status ?? ApprovalStatus.APPROVED,
      createdBy: input.actor?.id ?? null,
    },
  });

  await recordAudit({
    actor: input.actor ?? null,
    action: 'core.transaction.recorded',
    module: 'core',
    entityType: 'CoreTransaction',
    entityId: created.id,
    afterData: {
      type: created.type,
      amount: created.amount,
      sourceModule: created.sourceModule,
      category: created.category,
    },
  });

  return created;
}
