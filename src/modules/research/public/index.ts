import { prisma } from '@/core/db';
import { registerKpiSourceProvider } from '@/core/kpi';

let registered = false;

export function registerResearchKpiProvider(): void {
  if (registered) return;
  registered = true;

  registerKpiSourceProvider({
    code: 'research.project_count',
    name: 'Kontribusi Riset & Komunitas',
    description:
      'Jumlah proyek riset, publikasi, atau pengabdian yang dipimpin anggota di tahun penilaian.',
    compute: async ({ memberId, year }) => {
      return prisma.researchProject.count({
        where: { leadMemberId: memberId, year, deletedAt: null },
      });
    },
  });
}
