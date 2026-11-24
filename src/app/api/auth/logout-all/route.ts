import { NextResponse } from 'next/server';
import { recordAudit } from '@/core/audit';
import { clearSessionCookie, requirePermission } from '@/core/auth';
import { prisma } from '@/core/db';
import { handleRouteError } from '@/core/http';

export async function POST() {
  try {
    const user = await requirePermission([], true);
    await prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
    await recordAudit({
      actor: { id: user.id, email: user.email },
      action: 'auth.logout_all',
      module: 'auth',
      entityType: 'User',
      entityId: user.id,
    });
    const response = NextResponse.json({ loggedOutAll: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
