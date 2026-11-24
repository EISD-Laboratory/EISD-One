import { Prisma } from '@prisma/client';
import { recordAudit, type AuditActor } from './audit';
import { prisma } from './db';

export async function listSettings() {
  return prisma.setting.findMany({ orderBy: { key: 'asc' } });
}

export async function isFeatureEnabled(key: string, defaultValue = false): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return defaultValue;
  return row.value === true || row.value === 'true';
}

export async function setSetting(
  key: string,
  value: unknown,
  actor: AuditActor,
  description?: string,
) {
  const before = await prisma.setting.findUnique({ where: { key } });
  const saved = await prisma.setting.upsert({
    where: { key },
    update: {
      value: value as Prisma.InputJsonValue,
      description: description ?? before?.description,
      updatedBy: actor.id,
    },
    create: {
      key,
      value: value as Prisma.InputJsonValue,
      description,
      updatedBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'settings.updated',
    module: 'settings',
    entityType: 'Setting',
    entityId: key,
    beforeData: before ? { value: before.value } : null,
    afterData: { value: saved.value },
  });

  return saved;
}
