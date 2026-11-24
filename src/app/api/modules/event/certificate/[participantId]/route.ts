import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/core/auth';
import { prisma } from '@/core/db';
import { handleRouteError, HttpError } from '@/core/http';
import { generateCertificatePdfBuffer } from '@/modules/event/event.service';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ participantId: string }> },
) {
  try {
    await requirePermission(['event.event.read']);
    const { participantId } = await context.params;

    const participant = await prisma.eventParticipant.findFirst({
      where: { id: participantId, deletedAt: null },
      include: { event: true },
    });
    if (!participant) throw new HttpError(404, 'Peserta tidak ditemukan.');
    if (!participant.attended) {
      throw new HttpError(
        400,
        'Sertifikat hanya tersedia untuk peserta/panitia yang berstatus HADIR.',
      );
    }

    const certNo =
      participant.certificateNo ||
      `CERT-EISD-${new Date().getUTCFullYear()}-${participant.id.slice(0, 6).toUpperCase()}`;

    const pdf = await generateCertificatePdfBuffer({
      participantName: participant.name,
      roleLabel: participant.role === 'COMMITTEE' ? participant.position || 'Panitia' : 'Peserta',
      eventTitle: participant.event.title,
      eventDate: participant.event.startAt.toISOString().slice(0, 10),
      certificateNo: certNo,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="sertifikat-${participant.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
