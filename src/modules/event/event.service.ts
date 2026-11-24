import fs from 'node:fs';
import path from 'node:path';
import {
  CalendarCategory,
  EventParticipantRole,
  EventStatus,
  TransactionType,
} from '@prisma/client';
import PDFDocument from 'pdfkit';
import { recordAudit, type AuditActor } from '@/core/audit';
import { prisma } from '@/core/db';
import { generateCsvBuffer, generateXlsxBuffer, type SheetColumn } from '@/core/excel';
import { HttpError } from '@/core/http';
import { recordCoreTransaction } from '../core/public/index';

export function slugifyEventTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
  return `${base || 'event'}-${Date.now().toString(36).slice(-4)}`;
}

export function generateCertificatePdfBuffer(input: {
  participantName: string;
  roleLabel: string;
  eventTitle: string;
  eventDate: string;
  certificateNo: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 64 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(28, 28, doc.page.width - 56, doc.page.height - 56).stroke('#0f172a');
    const logoPath = path.join(process.cwd(), 'public', 'images', 'eisd.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, doc.page.width / 2 - 24, 48, {
        fit: [48, 48],
        align: 'center',
        valign: 'center',
      });
      doc.y = 104;
    } else {
      doc.moveDown(1.5);
    }
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#475569')
      .text('LABORATORIUM EISD', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(30)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text('SERTIFIKAT PENGHARGAAN', { align: 'center' });
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#64748b')
      .text(`Nomor: ${input.certificateNo}`, { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(13).fillColor('#334155').text('Diberikan kepada:', { align: 'center' });
    doc.moveDown(0.4);
    doc
      .fontSize(26)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text(input.participantName, { align: 'center' });
    doc.moveDown(0.6);
    doc
      .fontSize(13)
      .font('Helvetica')
      .fillColor('#334155')
      .text(`Atas partisipasinya sebagai ${input.roleLabel} dalam kegiatan:`, { align: 'center' });
    doc.moveDown(0.4);
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text(input.eventTitle, { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#475569')
      .text(`Diselenggarakan pada ${input.eventDate}`, { align: 'center' });
    doc.end();
  });
}

export async function listEvents() {
  return prisma.eventItem.findMany({
    where: { deletedAt: null },
    include: {
      participants: {
        where: { deletedAt: null },
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      },
    },
    orderBy: { startAt: 'desc' },
  });
}

export async function createEvent(
  input: {
    title: string;
    description?: string;
    speaker?: string;
    startAt: string;
    endAt: string;
    location?: string;
    budgetAmount?: number;
    isPublicOpen?: boolean;
    sponsorNeeded?: boolean;
  },
  actor: AuditActor,
) {
  const created = await prisma.eventItem.create({
    data: {
      slug: slugifyEventTitle(input.title),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      speaker: input.speaker?.trim() || null,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      location: input.location?.trim() || null,
      budgetAmount: Math.round(input.budgetAmount ?? 0),
      isPublicOpen: Boolean(input.isPublicOpen),
      sponsorNeeded: Boolean(input.sponsorNeeded),
      createdBy: actor.id,
    },
  });

  await recordAudit({
    actor,
    action: 'event.created',
    module: 'event',
    entityType: 'EventItem',
    entityId: created.id,
    afterData: created,
  });
  return created;
}

export async function updateEventStatus(
  eventId: string,
  input: { status: EventStatus; actualExpense?: number; lpjNotes?: string; isPublicOpen?: boolean },
  actor: AuditActor,
) {
  const before = await prisma.eventItem.findFirst({ where: { id: eventId, deletedAt: null } });
  if (!before) throw new HttpError(404, 'Event tidak ditemukan.');

  const updated = await prisma.eventItem.update({
    where: { id: eventId },
    data: {
      status: input.status,
      actualExpense:
        input.actualExpense !== undefined ? Math.round(input.actualExpense) : before.actualExpense,
      lpjNotes: input.lpjNotes !== undefined ? input.lpjNotes : before.lpjNotes,
      isPublicOpen: input.isPublicOpen !== undefined ? input.isPublicOpen : before.isPublicOpen,
      updatedBy: actor.id,
    },
  });

  // Integrasi Event -> Kalender & Kas Core (Bagian 7)
  if (input.status === EventStatus.APPROVED && before.status !== EventStatus.APPROVED) {
    const existingCal = await prisma.calendarItem.findFirst({
      where: { sourceModule: 'event', sourceEntityId: eventId, deletedAt: null },
    });
    if (!existingCal) {
      await prisma.calendarItem.create({
        data: {
          title: updated.title,
          description: updated.description,
          category: CalendarCategory.EVENT,
          startAt: updated.startAt,
          endAt: updated.endAt,
          location: updated.location,
          sourceModule: 'event',
          sourceEntityId: eventId,
          createdBy: actor.id,
        },
      });
    }
  }

  if (input.status === EventStatus.COMPLETED) {
    const expense = updated.actualExpense > 0 ? updated.actualExpense : updated.budgetAmount;
    if (expense > 0) {
      await recordCoreTransaction({
        type: TransactionType.EXPENSE,
        category: 'Realisasi Event',
        description: `Realisasi biaya event: ${updated.title}`,
        amount: expense,
        sourceModule: 'event',
        sourceEntityId: eventId,
        actor,
      });
    }
  }

  await recordAudit({
    actor,
    action: 'event.status_updated',
    module: 'event',
    entityType: 'EventItem',
    entityId: eventId,
    beforeData: { status: before.status, actualExpense: before.actualExpense },
    afterData: { status: updated.status, actualExpense: updated.actualExpense },
  });

  return updated;
}

export async function addCommitteeMember(
  input: { eventId: string; memberId: string; position?: string },
  actor: AuditActor,
) {
  const member = await prisma.member.findFirst({ where: { id: input.memberId, deletedAt: null } });
  if (!member) throw new HttpError(404, 'Anggota tidak ditemukan.');

  const created = await prisma.eventParticipant.create({
    data: {
      eventId: input.eventId,
      role: EventParticipantRole.COMMITTEE,
      memberId: member.id,
      name: member.fullName,
      nim: member.nim,
      email: member.email,
      position: input.position?.trim() || 'Panitia',
      attended: true,
      attendedAt: new Date(),
    },
  });

  await recordAudit({
    actor,
    action: 'event.committee.added',
    module: 'event',
    entityType: 'EventParticipant',
    entityId: created.id,
    afterData: created,
  });
  return created;
}

/** Pendaftaran publik sederhana (kuliah umum/seminar — tanpa login & tanpa tiket QR). */
export async function registerPublicAttendee(
  slug: string,
  input: { name: string; nim?: string; email?: string; institution?: string },
) {
  const event = await prisma.eventItem.findFirst({
    where: { slug, deletedAt: null },
  });
  if (!event) throw new HttpError(404, 'Event tidak ditemukan.');
  if (!event.isPublicOpen) {
    throw new HttpError(403, 'Pendaftaran publik untuk event ini belum dibuka atau sudah ditutup.');
  }

  const created = await prisma.eventParticipant.create({
    data: {
      eventId: event.id,
      role: EventParticipantRole.ATTENDEE,
      name: input.name.trim(),
      nim: input.nim?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      institution: input.institution?.trim() || null,
    },
  });

  return {
    participantId: created.id,
    eventTitle: event.title,
    startAt: event.startAt,
    location: event.location,
  };
}

export async function toggleParticipantAttendance(
  participantId: string,
  attended: boolean,
  actor: AuditActor,
) {
  const existing = await prisma.eventParticipant.findFirst({
    where: { id: participantId, deletedAt: null },
  });
  if (!existing) throw new HttpError(404, 'Peserta tidak ditemukan.');

  const certNo =
    attended && !existing.certificateNo
      ? `CERT-EISD-${new Date().getUTCFullYear()}-${existing.id.slice(0, 6).toUpperCase()}`
      : existing.certificateNo;

  const updated = await prisma.eventParticipant.update({
    where: { id: participantId },
    data: {
      attended,
      attendedAt: attended ? new Date() : null,
      certificateNo: certNo,
    },
  });

  await recordAudit({
    actor,
    action: 'event.attendance.updated',
    module: 'event',
    entityType: 'EventParticipant',
    entityId: participantId,
    afterData: { attended: updated.attended, certificateNo: updated.certificateNo },
  });
  return updated;
}

const PARTICIPANT_COLS: SheetColumn[] = [
  { key: 'role', label: 'Peran' },
  { key: 'name', label: 'Nama' },
  { key: 'nim', label: 'NIM' },
  { key: 'email', label: 'Email' },
  { key: 'institution', label: 'Instansi / Jabatan' },
  { key: 'attended', label: 'Kehadiran' },
  { key: 'certificateNo', label: 'No. Sertifikat' },
];

export async function exportEventParticipants(
  eventId: string,
  format: 'xlsx' | 'csv',
  actor: AuditActor,
) {
  const event = await prisma.eventItem.findFirst({
    where: { id: eventId, deletedAt: null },
    include: { participants: { where: { deletedAt: null }, orderBy: { name: 'asc' } } },
  });
  if (!event) throw new HttpError(404, 'Event tidak ditemukan.');

  const rows = event.participants.map((p) => ({
    role: p.role,
    name: p.name,
    nim: p.nim ?? '',
    email: p.email ?? '',
    institution: p.role === 'COMMITTEE' ? (p.position ?? 'Panitia') : (p.institution ?? ''),
    attended: p.attended ? 'HADIR' : 'BELUM',
    certificateNo: p.certificateNo ?? '',
  }));

  await recordAudit({
    actor,
    action: 'event.participants.exported',
    module: 'event',
    entityType: 'EventItem',
    entityId: eventId,
    metadata: { format, rowCount: rows.length },
  });

  if (format === 'csv') {
    return {
      buffer: generateCsvBuffer(PARTICIPANT_COLS, rows),
      fileName: `peserta-${event.slug}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }
  return {
    buffer: await generateXlsxBuffer('Daftar Peserta Event', PARTICIPANT_COLS, rows),
    fileName: `peserta-${event.slug}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
