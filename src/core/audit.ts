import { Prisma } from '@prisma/client';
import { prisma } from './db';

export interface AuditActor {
  id: string;
  email: string;
}

export interface RecordAuditInput {
  actor?: AuditActor | null;
  action: string;
  module: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown>;
}

/** Append-only audit log — tidak menyediakan fungsi update atau delete. */
export async function recordAudit(input: RecordAuditInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actor?.id ?? null,
      actorEmail: input.actor?.email ?? null,
      action: input.action,
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeData:
        input.beforeData !== undefined
          ? (JSON.parse(JSON.stringify(input.beforeData)) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      afterData:
        input.afterData !== undefined
          ? (JSON.parse(JSON.stringify(input.afterData)) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      metadata: input.metadata
        ? (JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });
}

export async function listAuditLogs(params: {
  page?: number;
  limit?: number;
  module?: string;
  search?: string;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 30));

  const where: Prisma.AuditLogWhereInput = {};
  if (params.module) where.module = params.module;
  if (params.search) {
    where.OR = [
      { actorEmail: { contains: params.search, mode: 'insensitive' } },
      { action: { contains: params.search, mode: 'insensitive' } },
      { entityType: { contains: params.search, mode: 'insensitive' } },
      { entityId: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}
