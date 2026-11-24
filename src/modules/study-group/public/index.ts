import { prisma } from '@/core/db';
import { registerKpiSourceProvider } from '@/core/kpi';

let registered = false;

export function registerStudyGroupKpiProvider(): void {
  if (registered) return;
  registered = true;

  registerKpiSourceProvider({
    code: 'study_group.session_count',
    name: 'Sesi Mentoring Study Group',
    description: 'Jumlah sesi Study Group yang dilaksanakan oleh mentor pada bulan penilaian.',
    compute: async ({ memberId, year, month }) => {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      return prisma.studyGroupSession.count({
        where: {
          deletedAt: null,
          sessionDate: { gte: start, lt: end },
          group: { mentorMemberId: memberId, deletedAt: null },
        },
      });
    },
  });
}
