import { CalendarCategory } from '@prisma/client';
import { prisma } from './db';

function fmtIcal(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function escIcal(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildIcalFeed(
  items: Array<{
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    startAt: Date;
    endAt: Date;
    category: string;
    isRecurringYearly: boolean;
  }>,
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EISD Laboratory//EISD One//ID',
    'X-WR-CALNAME:EISD One Calendar',
    'X-WR-TIMEZONE:Asia/Jakarta',
  ];
  for (const item of items) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${item.id}@eisd-one.local`);
    lines.push(`DTSTAMP:${fmtIcal(new Date())}`);
    lines.push(`DTSTART:${fmtIcal(item.startAt)}`);
    lines.push(`DTEND:${fmtIcal(item.endAt)}`);
    lines.push(`SUMMARY:${escIcal(item.title)}`);
    lines.push(`CATEGORIES:${item.category}`);
    if (item.description) lines.push(`DESCRIPTION:${escIcal(item.description)}`);
    if (item.location) lines.push(`LOCATION:${escIcal(item.location)}`);
    if (item.isRecurringYearly) lines.push('RRULE:FREQ=YEARLY');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export async function ensureMemberBirthdayOnCalendar(member: {
  id: string;
  fullName: string;
  birthDate: Date | null;
}) {
  if (!member.birthDate) return;
  const existing = await prisma.calendarItem.findFirst({
    where: {
      sourceModule: 'member',
      sourceEntityId: member.id,
      category: CalendarCategory.BIRTHDAY,
      deletedAt: null,
    },
  });
  if (existing) return;

  const year = new Date().getUTCFullYear();
  const startAt = new Date(
    Date.UTC(year, member.birthDate.getUTCMonth(), member.birthDate.getUTCDate()),
  );
  const endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);

  await prisma.calendarItem.create({
    data: {
      title: `Ulang Tahun: ${member.fullName}`,
      category: CalendarCategory.BIRTHDAY,
      startAt,
      endAt,
      allDay: true,
      sourceModule: 'member',
      sourceEntityId: member.id,
      isRecurringYearly: true,
    },
  });
}
