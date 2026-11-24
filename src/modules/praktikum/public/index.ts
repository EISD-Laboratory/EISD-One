import { PraktikumRecordType } from '@prisma/client';
import { prisma } from '@/core/db';
import { registerKpiSourceProvider } from '@/core/kpi';

let registered = false;

/** Mendaftarkan KPI provider praktikum.attendance_rate ke core KPI Engine. */
export function registerPraktikumKpiProvider(): void {
  if (registered) return;
  registered = true;

  registerKpiSourceProvider({
    code: 'praktikum.attendance_rate',
    name: 'Tingkat Kehadiran Asisten Praktikum',
    description: 'Persentase kehadiran asisten pada sesi praktikum bulan penilaian (0-100%).',
    compute: async ({ memberId, year, month }) => {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      const rows = await prisma.praktikumRecord.findMany({
        where: {
          memberId,
          recordType: PraktikumRecordType.ATTENDANCE,
          deletedAt: null,
          recordDate: { gte: start, lt: end },
        },
        select: { isPresent: true },
      });
      if (rows.length === 0) return 0;
      const present = rows.filter((r) => r.isPresent).length;
      return Math.round((present / rows.length) * 10000) / 100;
    },
  });
}
