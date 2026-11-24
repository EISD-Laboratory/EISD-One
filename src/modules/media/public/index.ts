import { MediaRequestStatus } from '@prisma/client';
import { prisma } from '@/core/db';
import { registerKpiSourceProvider } from '@/core/kpi';

let registered = false;

export function registerMediaKpiProvider(): void {
  if (registered) return;
  registered = true;

  registerKpiSourceProvider({
    code: 'media.completed_tasks',
    name: 'Konten & Desain Media Selesai',
    description:
      'Jumlah permintaan desain/konten Media berstatus PUBLISHED oleh PIC di bulan penilaian.',
    compute: async ({ memberId, year, month }) => {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      return prisma.mediaRequest.count({
        where: {
          picMemberId: memberId,
          status: MediaRequestStatus.PUBLISHED,
          deletedAt: null,
          updatedAt: { gte: start, lt: end },
        },
      });
    },
  });
}
