import { EventParticipantRole } from '@prisma/client';
import { prisma } from '@/core/db';
import { registerKpiSourceProvider } from '@/core/kpi';

let registered = false;

/** Mendaftarkan KPI provider event.committee_count ke core KPI Engine. */
export function registerEventKpiProvider(): void {
  if (registered) return;
  registered = true;

  registerKpiSourceProvider({
    code: 'event.committee_count',
    name: 'Kontribusi Kepanitiaan Event',
    description: 'Jumlah event tempat anggota menjadi panitia pada bulan penilaian.',
    compute: async ({ memberId, year, month }) => {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      return prisma.eventParticipant.count({
        where: {
          memberId,
          role: EventParticipantRole.COMMITTEE,
          deletedAt: null,
          event: { deletedAt: null, startAt: { gte: start, lt: end } },
        },
      });
    },
  });
}
