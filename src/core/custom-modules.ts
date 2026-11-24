import { Prisma } from '@prisma/client';
import { recordAudit, type AuditActor } from '@/core/audit';
import { prisma } from '@/core/db';
import { generateCsvBuffer, generateXlsxBuffer, type SheetColumn } from '@/core/excel';
import { HttpError } from '@/core/http';

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'textarea';

export interface CustomFieldDef {
  key: string;
  label: string;
  type: CustomFieldType;
  required?: boolean;
  options?: string[];
}

const RESERVED_MODULE_CODES = new Set([
  'core',
  'event',
  'praktikum',
  'enabler',
  'media',
  'competition',
  'research',
  'study-group',
  'members',
  'kpi',
  'calendar',
  'periods',
  'rbac',
  'audit-logs',
  'settings',
  'custom-modules',
  'custom',
  'login',
  'register',
  'api',
]);

export function sanitizeModuleCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export function sanitizeFieldKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

/** Validasi murni definisi field Custom Module sebelum disimpan. */
export function normalizeCustomFields(fields: CustomFieldDef[]): CustomFieldDef[] {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new HttpError(400, 'Minimal 1 field dinamis wajib didefinisikan untuk Custom Module.');
  }
  const seen = new Set<string>();
  return fields.map((f) => {
    const key = sanitizeFieldKey(f.key || f.label);
    if (!key) throw new HttpError(400, `Key field tidak valid untuk "${f.label}".`);
    if (seen.has(key)) throw new HttpError(400, `Key field duplikat: "${key}".`);
    seen.add(key);

    const options =
      f.type === 'select' ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined;
    if (f.type === 'select' && (!options || options.length === 0)) {
      throw new HttpError(400, `Field bertipe dropdown "${f.label}" wajib memiliki opsi.`);
    }

    return {
      key,
      label: f.label.trim() || key,
      type: f.type,
      required: Boolean(f.required),
      options,
    };
  });
}

/** Validasi murni nilai record terhadap skema field Custom Module. */
export function validateCustomRecordData(
  fields: CustomFieldDef[],
  rawData: Record<string, unknown>,
): Record<string, string | number | null> {
  const cleaned: Record<string, string | number | null> = {};
  for (const field of fields) {
    const val = rawData[field.key];
    const isEmpty = val === undefined || val === null || String(val).trim() === '';
    if (field.required && isEmpty) {
      throw new HttpError(400, `Field "${field.label}" wajib diisi.`);
    }
    if (isEmpty) {
      cleaned[field.key] = null;
      continue;
    }
    if (field.type === 'number') {
      const n = Number(val);
      if (Number.isNaN(n)) {
        throw new HttpError(400, `Field "${field.label}" harus berupa angka.`);
      }
      cleaned[field.key] = n;
    } else if (field.type === 'select' && field.options && field.options.length > 0) {
      const str = String(val).trim();
      if (!field.options.includes(str)) {
        throw new HttpError(
          400,
          `Nilai "${str}" pada "${field.label}" tidak termasuk opsi yang tersedia.`,
        );
      }
      cleaned[field.key] = str;
    } else {
      cleaned[field.key] = String(val).trim();
    }
  }
  return cleaned;
}

export async function listCustomModules() {
  return prisma.customModuleSchema.findMany({
    where: { deletedAt: null },
    include: {
      division: { select: { id: true, code: true, name: true, isEnabled: true } },
      _count: { select: { records: { where: { deletedAt: null } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createCustomModule(
  input: {
    code: string;
    name: string;
    description?: string;
    fields: CustomFieldDef[];
  },
  actor: AuditActor,
) {
  const code = sanitizeModuleCode(input.code || input.name);
  if (code.length < 2) throw new HttpError(400, 'Kode modul minimal 2 karakter huruf/angka.');
  if (RESERVED_MODULE_CODES.has(code)) {
    throw new HttpError(400, `Kode modul "${code}" sudah dipakai oleh sistem.`);
  }

  const normalizedFields = normalizeCustomFields(input.fields);
  const existingDiv = await prisma.division.findUnique({ where: { code } });
  if (existingDiv) {
    throw new HttpError(400, `Kode divisi/modul "${code}" sudah terdaftar.`);
  }

  const created = await prisma.$transaction(async (tx) => {
    const division = await tx.division.create({
      data: {
        code,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        isCustom: true,
        isEnabled: true,
        createdBy: actor.id,
      },
    });
    return tx.customModuleSchema.create({
      data: {
        divisionId: division.id,
        code,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        fieldsJson: normalizedFields as unknown as Prisma.InputJsonValue,
        createdBy: actor.id,
      },
      include: {
        division: { select: { id: true, code: true, name: true, isEnabled: true } },
      },
    });
  });

  await recordAudit({
    actor,
    action: 'custom_module.created',
    module: 'custom_module',
    entityType: 'CustomModuleSchema',
    entityId: created.id,
    afterData: created,
  });

  return created;
}

export async function getCustomModuleWithRecords(code: string) {
  const mod = await prisma.customModuleSchema.findFirst({
    where: { code, deletedAt: null },
    include: {
      division: { select: { id: true, code: true, name: true, isEnabled: true } },
      records: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 200 },
    },
  });
  if (!mod) throw new HttpError(404, `Custom Module "${code}" tidak ditemukan.`);
  return mod;
}

export async function createCustomRecord(
  code: string,
  input: { title: string; data: Record<string, unknown> },
  actor: AuditActor,
) {
  const mod = await prisma.customModuleSchema.findFirst({
    where: { code, deletedAt: null },
    include: { division: true },
  });
  if (!mod) throw new HttpError(404, `Custom Module "${code}" tidak ditemukan.`);
  if (!mod.division.isEnabled) {
    throw new HttpError(403, `Modul "${mod.name}" sedang dinonaktifkan.`);
  }

  const fields = (mod.fieldsJson as unknown as CustomFieldDef[]) ?? [];
  const cleaned = validateCustomRecordData(fields, input.data ?? {});

  const record = await prisma.customModuleRecord.create({
    data: {
      moduleId: mod.id,
      title: input.title.trim(),
      dataJson: cleaned as unknown as Prisma.InputJsonValue,
      createdBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'custom_module.record.created',
    module: 'custom_module',
    entityType: 'CustomModuleRecord',
    entityId: record.id,
    afterData: { moduleCode: code, title: record.title, data: cleaned },
  });

  return record;
}

export async function deleteCustomRecord(code: string, recordId: string, actor: AuditActor) {
  const mod = await prisma.customModuleSchema.findFirst({ where: { code, deletedAt: null } });
  if (!mod) throw new HttpError(404, `Custom Module "${code}" tidak ditemukan.`);

  const existing = await prisma.customModuleRecord.findFirst({
    where: { id: recordId, moduleId: mod.id, deletedAt: null },
  });
  if (!existing) throw new HttpError(404, 'Data tidak ditemukan.');

  await prisma.customModuleRecord.update({
    where: { id: recordId },
    data: { deletedAt: new Date(), updatedBy: actor.id },
  });

  await recordAudit({
    actor,
    action: 'custom_module.record.deleted',
    module: 'custom_module',
    entityType: 'CustomModuleRecord',
    entityId: recordId,
    beforeData: existing,
  });

  return { deleted: true };
}

export async function exportCustomModuleRecords(
  code: string,
  format: 'xlsx' | 'csv',
  actor: AuditActor,
) {
  const mod = await getCustomModuleWithRecords(code);
  const fields = (mod.fieldsJson as unknown as CustomFieldDef[]) ?? [];

  const columns: SheetColumn[] = [
    { key: 'title', label: 'Judul' },
    ...fields.map((f) => ({ key: f.key, label: f.label })),
    { key: 'createdAt', label: 'Dibuat Pada' },
  ];

  const rows = mod.records.map((rec) => {
    const data = (rec.dataJson as Record<string, unknown>) ?? {};
    const row: Record<string, unknown> = {
      title: rec.title,
      createdAt: rec.createdAt.toISOString().slice(0, 10),
    };
    for (const f of fields) {
      row[f.key] = data[f.key] ?? '';
    }
    return row;
  });

  await recordAudit({
    actor,
    action: 'custom_module.records.exported',
    module: 'custom_module',
    entityType: 'CustomModuleSchema',
    entityId: mod.id,
    metadata: { format, rowCount: rows.length },
  });

  if (format === 'csv') {
    return {
      buffer: generateCsvBuffer(columns, rows),
      fileName: `custom-${mod.code}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }
  return {
    buffer: await generateXlsxBuffer(mod.name.slice(0, 31), columns, rows),
    fileName: `custom-${mod.code}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
