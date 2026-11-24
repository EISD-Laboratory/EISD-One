import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ImportBatchStatus,
  ImportDuplicateStrategy,
  ImportItemOperation,
  MemberStatus,
  Prisma,
} from '@prisma/client';
import { recordAudit } from './audit';
import { type SessionUser } from './auth';
import { prisma } from './db';
import {
  applyColumnMapping,
  buildSuggestedColumnMapping,
  generateCsvBuffer,
  generateXlsxBuffer,
  parseFlexibleDate,
  parseSpreadsheetBuffer,
  type SheetColumn,
} from './excel';
import { HttpError } from './http';

export const MEMBER_COLUMNS: SheetColumn[] = [
  {
    key: 'nim',
    label: 'NIM',
    required: true,
    example: '1202240101',
    aliases: ['student_id', 'nomor_induk'],
  },
  {
    key: 'fullName',
    label: 'Nama Lengkap',
    required: true,
    example: 'Nadia Kusuma',
    aliases: ['nama', 'full_name', 'name'],
  },
  { key: 'email', label: 'Email', example: 'nadia.kusuma@example.edu', aliases: ['email_kampus'] },
  {
    key: 'birthDate',
    label: 'Tanggal Lahir',
    example: '15/08/2004',
    aliases: ['birth_date', 'tgl_lahir', 'dob'],
  },
  {
    key: 'phone',
    label: 'No HP',
    example: '081234567890',
    aliases: ['phone', 'kontak', 'whatsapp'],
  },
  { key: 'status', label: 'Status', example: 'ACTIVE', aliases: ['status_anggota'] },
  {
    key: 'batchYear',
    label: 'Angkatan',
    example: '2024',
    aliases: ['batch_year', 'tahun_angkatan'],
  },
  { key: 'divisionCode', label: 'Divisi', example: 'event', aliases: ['division', 'kode_divisi'] },
  {
    key: 'positionTitle',
    label: 'Jabatan',
    example: 'Staf Event',
    aliases: ['position', 'posisi'],
  },
];

export interface ValidatedMemberRow {
  nim: string;
  fullName: string;
  email: string | null;
  birthDate: Date | null;
  phone: string | null;
  status: MemberStatus;
  batchYear: number | null;
  divisionId: string | null;
  positionTitle: string;
}

export function validateMemberRow(
  mapped: Record<string, string>,
  ctx: {
    actor: SessionUser;
    divByCode: Map<string, string>;
    existingNims: Set<string>;
    seenInBatch: Set<string>;
    strategy: ImportDuplicateStrategy;
  },
): { valid: boolean; wouldSkip?: boolean; errors: string[]; data?: ValidatedMemberRow } {
  const errors: string[] = [];
  const nim = (mapped.nim ?? '').trim();
  const fullName = (mapped.fullName ?? '').trim();
  const email = (mapped.email ?? '').trim().toLowerCase() || null;
  const phone = (mapped.phone ?? '').trim() || null;
  const birthDateRaw = (mapped.birthDate ?? '').trim();
  const statusRaw = (mapped.status ?? '').trim().toUpperCase();
  const batchYearRaw = (mapped.batchYear ?? '').trim();
  const divRaw = (mapped.divisionCode ?? '').trim().toLowerCase();
  const positionTitle = (mapped.positionTitle ?? '').trim() || 'Anggota';

  if (!nim) errors.push('NIM wajib diisi');
  if (!fullName) errors.push('Nama Lengkap wajib diisi');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push(`Format email tidak valid: "${email}"`);
  }

  let birthDate: Date | null = null;
  if (birthDateRaw) {
    birthDate = parseFlexibleDate(birthDateRaw);
    if (!birthDate)
      errors.push(`Tanggal lahir tidak valid (dd/mm/yyyy atau yyyy-mm-dd): "${birthDateRaw}"`);
  }

  let status: MemberStatus = MemberStatus.ACTIVE;
  if (statusRaw) {
    if (statusRaw === 'AKTIF' || statusRaw === 'ACTIVE') status = MemberStatus.ACTIVE;
    else if (statusRaw === 'CUTI' || statusRaw === 'LEAVE') status = MemberStatus.LEAVE;
    else if (statusRaw === 'ALUMNI') status = MemberStatus.ALUMNI;
    else errors.push(`Status tidak dikenal: "${statusRaw}"`);
  }

  let batchYear: number | null = null;
  if (batchYearRaw) {
    const n = Number(batchYearRaw);
    if (!Number.isInteger(n) || n < 2000 || n > 2100)
      errors.push(`Angkatan tidak valid: "${batchYearRaw}"`);
    else batchYear = n;
  }

  let divisionId: string | null = null;
  if (divRaw) {
    divisionId = ctx.divByCode.get(divRaw) ?? null;
    if (!divisionId) errors.push(`Divisi tidak ditemukan: "${mapped.divisionCode}"`);
  } else if (!ctx.actor.isSuperAdmin && ctx.actor.divisionIds.length > 0) {
    divisionId = ctx.actor.divisionIds[0];
  }

  const canViewAll =
    ctx.actor.isSuperAdmin || ctx.actor.permissions.includes('member.member.view_all');
  if (!canViewAll && divisionId && !ctx.actor.divisionIds.includes(divisionId)) {
    errors.push('Kadiv tidak dapat mengimpor anggota ke divisi lain');
  }

  if (errors.length > 0) return { valid: false, errors };

  const nimKey = nim.toLowerCase();
  const isDup = ctx.existingNims.has(nimKey) || ctx.seenInBatch.has(nimKey);
  ctx.seenInBatch.add(nimKey);

  return {
    valid: true,
    wouldSkip: isDup && ctx.strategy === ImportDuplicateStrategy.SKIP,
    errors: [],
    data: { nim, fullName, email, birthDate, phone, status, batchYear, divisionId, positionTitle },
  };
}

function getUploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || './uploads');
}

export async function previewMemberImport(
  file: { name: string; buffer: Buffer },
  strategy: ImportDuplicateStrategy,
  actor: SessionUser,
  customMapping?: Record<string, string>,
) {
  const parsed = await parseSpreadsheetBuffer(file.buffer, file.name);
  const suggestedMapping = buildSuggestedColumnMapping(parsed.headers, MEMBER_COLUMNS);
  const mapping =
    customMapping && Object.keys(customMapping).length > 0 ? customMapping : suggestedMapping;

  const [divisions, existingMembers] = await Promise.all([
    prisma.division.findMany({ where: { deletedAt: null } }),
    prisma.member.findMany({ where: { deletedAt: null }, select: { nim: true } }),
  ]);

  const divByCode = new Map<string, string>();
  for (const d of divisions) {
    divByCode.set(d.code.toLowerCase(), d.id);
    divByCode.set(d.name.toLowerCase(), d.id);
  }
  const existingNims = new Set(existingMembers.map((m) => m.nim.toLowerCase()));
  const seenInBatch = new Set<string>();

  const errors: Array<{ rowNumber: number; errors: string[] }> = [];
  const previewRows: Array<{
    rowNumber: number;
    mapped: Record<string, string>;
    valid: boolean;
    wouldSkip?: boolean;
    errors: string[];
  }> = [];

  let validCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const row of parsed.rows) {
    const mapped = applyColumnMapping(row.raw, mapping);
    const v = validateMemberRow(mapped, { actor, divByCode, existingNims, seenInBatch, strategy });
    if (!v.valid) {
      failedCount += 1;
      errors.push({ rowNumber: row.rowNumber, errors: v.errors });
    } else if (v.wouldSkip) {
      skippedCount += 1;
    } else {
      validCount += 1;
    }
    if (previewRows.length < 25) {
      previewRows.push({
        rowNumber: row.rowNumber,
        mapped,
        valid: v.valid,
        wouldSkip: v.wouldSkip,
        errors: v.errors,
      });
    }
  }

  const batch = await prisma.importBatch.create({
    data: {
      entityType: 'members',
      fileName: file.name,
      duplicateStrategy: strategy,
      status: ImportBatchStatus.VALIDATED,
      totalRows: parsed.rows.length,
      successCount: validCount,
      skippedCount,
      failedCount,
      columnMapping: mapping as Prisma.InputJsonValue,
      errorsJson: errors as Prisma.InputJsonValue,
      createdBy: actor.id,
    },
  });

  const importDir = path.join(getUploadDir(), 'imports');
  await fs.mkdir(importDir, { recursive: true });
  const savedFilePath = path.join(
    importDir,
    `${batch.id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
  );
  await fs.writeFile(savedFilePath, file.buffer);
  await prisma.importBatch.update({ where: { id: batch.id }, data: { filePath: savedFilePath } });

  await recordAudit({
    actor,
    action: 'import.previewed',
    module: 'member',
    entityType: 'ImportBatch',
    entityId: batch.id,
    metadata: {
      fileName: file.name,
      totalRows: parsed.rows.length,
      validCount,
      skippedCount,
      failedCount,
    },
  });

  return {
    batchId: batch.id,
    fileName: file.name,
    headers: parsed.headers,
    columns: MEMBER_COLUMNS,
    columnMapping: mapping,
    duplicateStrategy: strategy,
    totalRows: parsed.rows.length,
    validCount,
    skippedCount,
    failedCount,
    previewRows,
    errors,
  };
}

export async function commitMemberImport(
  batchId: string,
  options: { duplicateStrategy?: ImportDuplicateStrategy; columnMapping?: Record<string, string> },
  actor: SessionUser,
) {
  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!batch || !batch.filePath) throw new HttpError(404, 'Batch import tidak ditemukan.');
  if (batch.status !== ImportBatchStatus.VALIDATED) {
    throw new HttpError(400, `Batch sudah berstatus ${batch.status}.`);
  }

  const strategy = options.duplicateStrategy ?? batch.duplicateStrategy;
  const mapping =
    options.columnMapping && Object.keys(options.columnMapping).length > 0
      ? options.columnMapping
      : ((batch.columnMapping as Record<string, string>) ?? {});

  const buffer = await fs.readFile(batch.filePath);
  const parsed = await parseSpreadsheetBuffer(buffer, batch.fileName);

  const [divisions, activePeriod] = await Promise.all([
    prisma.division.findMany({ where: { deletedAt: null } }),
    prisma.period.findFirst({ where: { isActive: true, deletedAt: null } }),
  ]);

  const divByCode = new Map<string, string>();
  for (const d of divisions) {
    divByCode.set(d.code.toLowerCase(), d.id);
    divByCode.set(d.name.toLowerCase(), d.id);
  }

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const errors: Array<{ rowNumber: number; errors: string[] }> = [];
  const seenInBatch = new Set<string>();

  for (const row of parsed.rows) {
    const mapped = applyColumnMapping(row.raw, mapping);
    const v = validateMemberRow(mapped, {
      actor,
      divByCode,
      existingNims: new Set(),
      seenInBatch,
      strategy,
    });

    if (!v.valid || !v.data) {
      failedCount += 1;
      errors.push({ rowNumber: row.rowNumber, errors: v.errors });
      await prisma.importBatchItem.create({
        data: {
          batchId: batch.id,
          rowNumber: row.rowNumber,
          operation: ImportItemOperation.FAILED,
          errorMessage: v.errors.join('; '),
        },
      });
      continue;
    }

    const d = v.data;
    const existing = await prisma.member.findFirst({
      where: { OR: [{ nim: d.nim }, ...(d.email ? [{ email: d.email }] : [])] },
    });

    if (existing && !existing.deletedAt) {
      if (strategy === ImportDuplicateStrategy.SKIP) {
        skippedCount += 1;
        await prisma.importBatchItem.create({
          data: {
            batchId: batch.id,
            rowNumber: row.rowNumber,
            entityId: existing.id,
            operation: ImportItemOperation.SKIPPED,
          },
        });
        continue;
      }

      const snapshot = {
        fullName: existing.fullName,
        email: existing.email,
        birthDate: existing.birthDate?.toISOString() ?? null,
        phone: existing.phone,
        status: existing.status,
        batchYear: existing.batchYear,
      };
      const isMerge = strategy === ImportDuplicateStrategy.MERGE;
      await prisma.member.update({
        where: { id: existing.id },
        data: {
          fullName: isMerge ? d.fullName || existing.fullName : d.fullName,
          email: isMerge ? (d.email ?? existing.email) : d.email,
          birthDate: isMerge ? (d.birthDate ?? existing.birthDate) : d.birthDate,
          phone: isMerge ? (d.phone ?? existing.phone) : d.phone,
          status: d.status,
          batchYear: isMerge ? (d.batchYear ?? existing.batchYear) : d.batchYear,
          updatedBy: actor.id,
        },
      });
      if (d.divisionId && activePeriod) {
        await prisma.membership.upsert({
          where: {
            memberId_periodId_divisionId: {
              memberId: existing.id,
              periodId: activePeriod.id,
              divisionId: d.divisionId,
            },
          },
          update: { positionTitle: d.positionTitle, deletedAt: null, updatedBy: actor.id },
          create: {
            memberId: existing.id,
            periodId: activePeriod.id,
            divisionId: d.divisionId,
            positionTitle: d.positionTitle,
            createdBy: actor.id,
          },
        });
      }
      successCount += 1;
      await prisma.importBatchItem.create({
        data: {
          batchId: batch.id,
          rowNumber: row.rowNumber,
          entityId: existing.id,
          operation: ImportItemOperation.UPDATED,
          previousSnapshot: snapshot as Prisma.InputJsonValue,
        },
      });
      continue;
    }

    const member = existing
      ? await prisma.member.update({
          where: { id: existing.id },
          data: {
            fullName: d.fullName,
            email: d.email,
            birthDate: d.birthDate,
            phone: d.phone,
            status: d.status,
            batchYear: d.batchYear,
            deletedAt: null,
            updatedBy: actor.id,
          },
        })
      : await prisma.member.create({
          data: {
            nim: d.nim,
            fullName: d.fullName,
            email: d.email,
            birthDate: d.birthDate,
            phone: d.phone,
            status: d.status,
            batchYear: d.batchYear,
            createdBy: actor.id,
            updatedBy: actor.id,
          },
        });

    if (d.divisionId && activePeriod) {
      await prisma.membership.upsert({
        where: {
          memberId_periodId_divisionId: {
            memberId: member.id,
            periodId: activePeriod.id,
            divisionId: d.divisionId,
          },
        },
        update: { positionTitle: d.positionTitle, deletedAt: null, updatedBy: actor.id },
        create: {
          memberId: member.id,
          periodId: activePeriod.id,
          divisionId: d.divisionId,
          positionTitle: d.positionTitle,
          createdBy: actor.id,
        },
      });
    }

    successCount += 1;
    await prisma.importBatchItem.create({
      data: {
        batchId: batch.id,
        rowNumber: row.rowNumber,
        entityId: member.id,
        operation: ImportItemOperation.CREATED,
      },
    });
  }

  const completed = await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      duplicateStrategy: strategy,
      columnMapping: mapping as Prisma.InputJsonValue,
      status: ImportBatchStatus.COMPLETED,
      totalRows: parsed.rows.length,
      successCount,
      skippedCount,
      failedCount,
      errorsJson: errors as Prisma.InputJsonValue,
    },
  });

  await recordAudit({
    actor,
    action: 'import.completed',
    module: 'member',
    entityType: 'ImportBatch',
    entityId: batch.id,
    afterData: {
      fileName: batch.fileName,
      totalRows: parsed.rows.length,
      successCount,
      skippedCount,
      failedCount,
    },
  });

  return completed;
}

export async function rollbackImportBatch(batchId: string, actor: SessionUser) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      items: {
        where: { operation: { in: [ImportItemOperation.CREATED, ImportItemOperation.UPDATED] } },
        orderBy: { rowNumber: 'desc' },
      },
    },
  });
  if (!batch) throw new HttpError(404, 'Batch import tidak ditemukan.');
  if (batch.status !== ImportBatchStatus.COMPLETED) {
    throw new HttpError(
      400,
      `Hanya batch COMPLETED yang dapat di-rollback (status: ${batch.status}).`,
    );
  }

  let rolledBackCount = 0;
  for (const item of batch.items) {
    if (!item.entityId) continue;
    if (item.operation === ImportItemOperation.CREATED) {
      await prisma.member.updateMany({
        where: { id: item.entityId },
        data: { deletedAt: new Date(), updatedBy: actor.id },
      });
      await prisma.membership.updateMany({
        where: { memberId: item.entityId },
        data: { deletedAt: new Date(), updatedBy: actor.id },
      });
      rolledBackCount += 1;
    } else if (item.operation === ImportItemOperation.UPDATED && item.previousSnapshot) {
      const snap = item.previousSnapshot as Record<string, unknown>;
      await prisma.member.update({
        where: { id: item.entityId },
        data: {
          fullName: String(snap.fullName ?? ''),
          email: snap.email ? String(snap.email) : null,
          birthDate: snap.birthDate ? new Date(String(snap.birthDate)) : null,
          phone: snap.phone ? String(snap.phone) : null,
          status: (snap.status as MemberStatus) ?? MemberStatus.ACTIVE,
          batchYear: typeof snap.batchYear === 'number' ? snap.batchYear : null,
          updatedBy: actor.id,
        },
      });
      rolledBackCount += 1;
    }
  }

  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: ImportBatchStatus.ROLLED_BACK,
      rolledBackAt: new Date(),
      rolledBackBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'import.rolled_back',
    module: 'member',
    entityType: 'ImportBatch',
    entityId: batchId,
    afterData: { rolledBackCount },
  });

  return { batchId, status: ImportBatchStatus.ROLLED_BACK, rolledBackCount };
}

export async function generateMemberTemplate(format: 'xlsx' | 'csv') {
  const sample = Object.fromEntries(MEMBER_COLUMNS.map((c) => [c.key, c.example ?? '']));
  if (format === 'csv') {
    return {
      buffer: generateCsvBuffer(MEMBER_COLUMNS, [sample]),
      fileName: 'template-members.csv',
      contentType: 'text/csv; charset=utf-8',
    };
  }
  return {
    buffer: await generateXlsxBuffer('Data Anggota EISD', MEMBER_COLUMNS, [sample]),
    fileName: 'template-members.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

export async function exportMembersFile(
  format: 'xlsx' | 'csv',
  filters: { search?: string; status?: string; divisionId?: string },
  actor: SessionUser,
) {
  const canViewAll = actor.isSuperAdmin || actor.permissions.includes('member.member.view_all');
  const where: Prisma.MemberWhereInput = { deletedAt: null };
  if (filters.status && ['ACTIVE', 'LEAVE', 'ALUMNI'].includes(filters.status)) {
    where.status = filters.status as MemberStatus;
  }
  if (filters.search) {
    where.OR = [
      { nim: { contains: filters.search, mode: 'insensitive' } },
      { fullName: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (!canViewAll) {
    where.memberships = { some: { deletedAt: null, divisionId: { in: actor.divisionIds } } };
  } else if (filters.divisionId) {
    where.memberships = { some: { deletedAt: null, divisionId: filters.divisionId } };
  }

  const members = await prisma.member.findMany({
    where,
    include: {
      memberships: { where: { deletedAt: null }, include: { division: true }, take: 1 },
    },
    orderBy: { nim: 'asc' },
  });

  const rows = members.map((m) => ({
    nim: m.nim,
    fullName: m.fullName,
    email: m.email ?? '',
    birthDate: m.birthDate ? m.birthDate.toISOString().slice(0, 10) : '',
    phone: m.phone ?? '',
    status: m.status,
    batchYear: m.batchYear ?? '',
    divisionCode: m.memberships[0]?.division.code ?? '',
    positionTitle: m.memberships[0]?.positionTitle ?? '',
  }));

  await recordAudit({
    actor,
    action: 'member.exported',
    module: 'member',
    entityType: 'Member',
    metadata: { format, rowCount: rows.length, filters },
  });

  const date = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    return {
      buffer: generateCsvBuffer(MEMBER_COLUMNS, rows),
      fileName: `export-members-${date}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }
  return {
    buffer: await generateXlsxBuffer('Data Anggota EISD', MEMBER_COLUMNS, rows),
    fileName: `export-members-${date}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
