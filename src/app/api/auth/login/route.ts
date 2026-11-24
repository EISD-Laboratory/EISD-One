import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attachSessionCookie, loginWithPassword } from '@/core/auth';
import { assertRateLimit, handleRouteError } from '@/core/http';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    assertRateLimit(`login:${ip}`, 15, 60_000);

    const body = loginSchema.parse(await req.json());
    const { token, user } = await loginWithPassword(body.email, body.password);

    const response = NextResponse.json({ user });
    attachSessionCookie(response, token);
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
