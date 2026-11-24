import { prisma } from '@/core/db';
import { registerKpiSourceProvider } from '@/core/kpi';

let registered = false;

export function registerCompetitionKpiProvider(): void {
  if (registered) return;
  registered = true;

  registerKpiSourceProvider({
    code: 'competition.participation_count',
    name: 'Partisipasi Lomba Competition',
    description: 'Jumlah lomba yang diikuti anggota pada bulan penilaian.',
    compute: async ({ memberId, year, month }) => {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      const entries = await prisma.competitionEntry.findMany({
        where: { deletedAt: null, eventDate: { gte: start, lt: end } },
        select: { memberIdsJson: true },
      });
      return entries.filter((e) => {
        const ids = Array.isArray(e.memberIdsJson) ? e.memberIdsJson : [];
        return ids.includes(memberId);
      }).length;
    },
  });
}
