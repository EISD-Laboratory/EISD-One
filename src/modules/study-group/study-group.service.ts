import { CalendarCategory } from '@prisma/client';
import { recordAudit, type AuditActor } from '@/core/audit';
import { prisma } from '@/core/db';
import { generateCsvBuffer, generateXlsxBuffer, type SheetColumn } from '@/core/excel';
import { HttpError } from '@/core/http';

export async function listStudyGroups() {
  return prisma.studyGroupClass.findMany({
    where: { deletedAt: null },
    include: {
      sessions: {
        where: { deletedAt: null },
        orderBy: [{ sessionNo: 'desc' }, { sessionDate: 'desc' }],
        take: 30,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createStudyGroup(
  input: {
    code: string;
    name: string;
    topic: string;
    mentorMemberId?: string;
    mentorName?: string;
    schedule?: string;
    maxParticipants?: number;
    notes?: string;
  },
  actor: AuditActor,
) {
  const code = input.code.trim().toUpperCase();
  const dup = await prisma.studyGroupClass.findUnique({ where: { code } });
  if (dup) throw new HttpError(400, `Kode Study Group "${code}" sudah terdaftar.`);

  let mentorName = input.mentorName?.trim() || null;
  if (input.mentorMemberId && !mentorName) {
    const member = await prisma.member.findFirst({
      where: { id: input.mentorMemberId, deletedAt: null },
      select: { fullName: true },
    });
    mentorName = member?.fullName ?? null;
  }

  const created = await prisma.studyGroupClass.create({
    data: {
      code,
      name: input.name.trim(),
      topic: input.topic.trim(),
      mentorMemberId: input.mentorMemberId || null,
      mentorName,
      schedule: input.schedule?.trim() || null,
      maxParticipants: Math.max(1, input.maxParticipants ?? 30),
      notes: input.notes?.trim() || null,
      createdBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'study_group.class.created',
    module: 'study_group',
    entityType: 'StudyGroupClass',
    entityId: created.id,
    afterData: created,
  });

  return created;
}

export async function addStudyGroupSession(
  input: {
    groupId: string;
    sessionNo: number;
    title: string;
    sessionDate: string;
    materialUrl?: string;
    attendeeCount?: number;
    attendeesText?: string;
    notes?: string;
    syncCalendar?: boolean;
  },
  actor: AuditActor,
) {
  const group = await prisma.studyGroupClass.findFirst({
    where: { id: input.groupId, deletedAt: null },
  });
  if (!group) throw new HttpError(404, 'Kelas Study Group tidak ditemukan.');

  const sessionDate = new Date(input.sessionDate);
  const created = await prisma.studyGroupSession.create({
    data: {
      groupId: group.id,
      sessionNo: input.sessionNo,
      title: input.title.trim(),
      sessionDate,
      materialUrl: input.materialUrl?.trim() || null,
      attendeeCount: Math.max(0, Math.round(input.attendeeCount ?? 0)),
      attendeesText: input.attendeesText?.trim() || null,
      notes: input.notes?.trim() || null,
      createdBy: actor.id,
    },
  });

  if (input.syncCalendar !== false) {
    await prisma.calendarItem.create({
      data: {
        title: `[Study Group] ${group.name} #${created.sessionNo}: ${created.title}`,
        description: created.notes,
        category: CalendarCategory.OTHER,
        startAt: sessionDate,
        endAt: new Date(sessionDate.getTime() + 90 * 60 * 1000),
        location: group.schedule,
        sourceModule: 'study-group',
        sourceEntityId: created.id,
        createdBy: actor.id,
      },
    });
  }

  await recordAudit({
    actor,
    action: 'study_group.session.created',
    module: 'study_group',
    entityType: 'StudyGroupSession',
    entityId: created.id,
    afterData: created,
  });

  return created;
}

const SESSION_EXPORT_COLS: SheetColumn[] = [
  { key: 'sessionNo', label: 'Pertemuan Ke' },
  { key: 'title', label: 'Judul Materi' },
  { key: 'sessionDate', label: 'Tanggal' },
  { key: 'attendeeCount', label: 'Jumlah Hadir' },
  { key: 'materialUrl', label: 'Tautan Materi' },
  { key: 'notes', label: 'Catatan' },
];

export async function exportStudyGroupSessions(
  groupId: string,
  format: 'xlsx' | 'csv',
  actor: AuditActor,
) {
  const group = await prisma.studyGroupClass.findFirst({
    where: { id: groupId, deletedAt: null },
    include: {
      sessions: { where: { deletedAt: null }, orderBy: { sessionNo: 'asc' } },
    },
  });
  if (!group) throw new HttpError(404, 'Kelas Study Group tidak ditemukan.');

  const rows = group.sessions.map((s) => ({
    sessionNo: s.sessionNo,
    title: s.title,
    sessionDate: s.sessionDate.toISOString().slice(0, 10),
    attendeeCount: s.attendeeCount,
    materialUrl: s.materialUrl ?? '',
    notes: s.notes ?? '',
  }));

  await recordAudit({
    actor,
    action: 'study_group.sessions.exported',
    module: 'study_group',
    entityType: 'StudyGroupClass',
    entityId: groupId,
    metadata: { format, rowCount: rows.length },
  });

  if (format === 'csv') {
    return {
      buffer: generateCsvBuffer(SESSION_EXPORT_COLS, rows),
      fileName: `study-group-${group.code.toLowerCase()}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }
  return {
    buffer: await generateXlsxBuffer('Rekap Study Group', SESSION_EXPORT_COLS, rows),
    fileName: `study-group-${group.code.toLowerCase()}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
