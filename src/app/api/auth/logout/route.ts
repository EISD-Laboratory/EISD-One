import { NextResponse } from 'next/server';
import { recordAudit } from '@/core/audit';
import { clearSessionCookie, getSessionUser } from '@/core/auth';

export async function POST() {
  const user = await getSessionUser();
  if (user) {
    await recordAudit({
      actor: { id: user.id, email: user.email },
      action: 'auth.logout',
      module: 'auth',
      entityType: 'User',
      entityId: user.id,
    });
  }
  const response = NextResponse.json({ loggedOut: true });
  clearSessionCookie(response);
  return response;
}
