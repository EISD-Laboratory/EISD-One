import { PraktikumRecordType } from '@prisma/client';
import { recordAudit, type AuditActor } from '@/core/audit';
import { prisma } from '@/core/db';
import {
  applyColumnMapping,
  buildSuggestedColumnMapping,
  generateCsvBuffer,
  generateXlsxBuffer,
  parseFlexibleDate,
  parseSpreadsheetBuffer,
  type SheetColumn,
} from '@/core/excel';
import { HttpError } from '@/core/http';

export const PRAKTIKUM_IMPORT_COLUMNS: SheetColumn[] = [
  { key: 'studentNim', label: 'NIM', required: true, example: '1202240001', aliases: ['nim'] },
  {
    key: 'studentName',
    label: 'Nama',
    required: true,
    example: 'Budi Santoso',
    aliases: ['nama', 'nama_lengkap'],
  },
  {
    key: 'sessionLabel',
    label: 'Modul / Sesi',
    required: true,
    example: 'Modul 1',
    aliases: ['sesi', 'modul', 'session'],
  },
  { key: 'recordDate', label: 'Tanggal', example: '2026-11-23', aliases: ['tanggal', 'date'] },
  {
    key: 'isPresent',
    label: 'Hadir (Y/N)',
    example: 'Y',
    aliases: ['hadir', 'kehadiran', 'present'],
  },
  { key: 'score', label: 'Nilai (0-100)', example: '88', aliases: ['nilai', 'grade', 'skor'] },
  { key: 'notes', label: 'Catatan', example: '', aliases: ['catatan'] },
];

export async function listPraktikumCourses() {
  return prisma.praktikumCourse.findMany({
    where: { deletedAt: null },
    include: {
      records: {
        where: { deletedAt: null },
        orderBy: [{ recordDate: 'desc' }, { studentName: 'asc' }],
        take: 200,
      },
    },
    orderBy: { code: 'asc' },
  });
}

export async function createPraktikumCourse(
  input: {
    code: string;
    name: string;
    semester: string;
    schedule?: string;
    assistantMemberIds?: string[];
    notes?: string;
  },
  actor: AuditActor,
) {
  const code = input.code.trim().toUpperCase();
  const dup = await prisma.praktikumCourse.findUnique({ where: { code } });
  if (dup) throw new HttpError(400, `Kode kelas praktikum "${code}" sudah ada.`);

  const created = await prisma.praktikumCourse.create({
    data: {
      code,
      name: input.name.trim(),
      semester: input.semester.trim(),
      schedule: input.schedule?.trim() || null,
      assistantMemberIds: input.assistantMemberIds ?? [],
      notes: input.notes?.trim() || null,
      createdBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'praktikum.course.created',
    module: 'praktikum',
    entityType: 'PraktikumCourse',
    entityId: created.id,
    afterData: created,
  });
  return created;
}

export async function importPraktikumExcel(
  courseId: string,
  recordType: PraktikumRecordType,
  file: { name: string; buffer: Buffer },
  actor: AuditActor,
) {
  const course = await prisma.praktikumCourse.findFirst({
    where: { id: courseId, deletedAt: null },
  });
  if (!course) throw new HttpError(404, 'Kelas praktikum tidak ditemukan.');

  const parsed = await parseSpreadsheetBuffer(file.buffer, file.name);
  const mapping = buildSuggestedColumnMapping(parsed.headers, PRAKTIKUM_IMPORT_COLUMNS);

  // Petakan NIM -> memberId agar presensi asisten otomatis terbaca KPI Engine
  const members = await prisma.member.findMany({
    where: { deletedAt: null },
    select: { id: true, nim: true },
  });
  const memberByNim = new Map(members.map((m) => [m.nim.toLowerCase(), m.id]));

  let successCount = 0;
  const errors: Array<{ rowNumber: number; error: string }> = [];

  for (const row of parsed.rows) {
    const mapped = applyColumnMapping(row.raw, mapping);
    const nim = (mapped.studentNim || '').trim();
    const name = (mapped.studentName || '').trim();
    const sessionLabel = (mapped.sessionLabel || 'Sesi 1').trim();
    if (!name) {
      errors.push({ rowNumber: row.rowNumber, error: 'Nama wajib diisi' });
      continue;
    }

    const recordDate = parseFlexibleDate(mapped.recordDate) ?? new Date();
    const presentRaw = (mapped.isPresent || '').trim().toUpperCase();
    const isPresent =
      recordType === PraktikumRecordType.ATTENDANCE
        ? ['Y', 'YA', 'YES', 'HADIR', '1', 'TRUE'].includes(presentRaw)
        : null;

    let score: number | null = null;
    if (recordType === PraktikumRecordType.GRADE) {
      const n = Number(mapped.score);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        errors.push({
          rowNumber: row.rowNumber,
          error: `Nilai tidak valid (0-100): "${mapped.score}"`,
        });
        continue;
      }
      score = n;
    }

    await prisma.praktikumRecord.create({
      data: {
        courseId,
        recordType,
        sessionLabel,
        recordDate,
        memberId: nim ? (memberByNim.get(nim.toLowerCase()) ?? null) : null,
        studentNim: nim || null,
        studentName: name,
        isPresent,
        score,
        notes: mapped.notes || null,
        createdBy: actor.id,
      },
    });
    successCount += 1;
  }

  await recordAudit({
    actor,
    action: 'praktikum.records.imported',
    module: 'praktikum',
    entityType: 'PraktikumCourse',
    entityId: courseId,
    afterData: { recordType, fileName: file.name, successCount, failedCount: errors.length },
  });

  return {
    courseId,
    recordType,
    totalRows: parsed.rows.length,
    successCount,
    failedCount: errors.length,
    errors,
  };
}

export async function exportPraktikumRecords(
  courseId: string,
  format: 'xlsx' | 'csv',
  actor: AuditActor,
) {
  const course = await prisma.praktikumCourse.findFirst({
    where: { id: courseId, deletedAt: null },
    include: {
      records: {
        where: { deletedAt: null },
        orderBy: [{ recordDate: 'desc' }, { studentName: 'asc' }],
      },
    },
  });
  if (!course) throw new HttpError(404, 'Kelas praktikum tidak ditemukan.');

  const rows = course.records.map((r) => ({
    studentNim: r.studentNim ?? '',
    studentName: r.studentName,
    sessionLabel: r.sessionLabel,
    recordDate: r.recordDate.toISOString().slice(0, 10),
    isPresent: r.isPresent === null ? '' : r.isPresent ? 'HADIR' : 'TIDAK',
    score: r.score ?? '',
    notes: r.notes ?? '',
  }));

  await recordAudit({
    actor,
    action: 'praktikum.records.exported',
    module: 'praktikum',
    entityType: 'PraktikumCourse',
    entityId: courseId,
    metadata: { format, rowCount: rows.length },
  });

  if (format === 'csv') {
    return {
      buffer: generateCsvBuffer(PRAKTIKUM_IMPORT_COLUMNS, rows),
      fileName: `praktikum-${course.code.toLowerCase()}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }
  return {
    buffer: await generateXlsxBuffer(`Praktikum ${course.code}`, PRAKTIKUM_IMPORT_COLUMNS, rows),
    fileName: `praktikum-${course.code.toLowerCase()}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
