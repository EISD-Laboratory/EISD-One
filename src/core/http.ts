import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const details = error.errors.map((e) => `${e.path.join('.') || 'input'}: ${e.message}`);
    return NextResponse.json({ message: details.join('; ') }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : 'Terjadi kesalahan pada server.';
  console.error('[API Error]', error);
  return NextResponse.json({ message }, { status: 500 });
}

// Rate limiter ringan di memori untuk endpoint login & registrasi publik (tanpa Redis)
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function assertRateLimit(key: string, maxRequests = 15, windowMs = 60_000): void {
  const now = Date.now();
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (entry.count >= maxRequests) {
    throw new HttpError(429, 'Terlalu banyak percobaan. Silakan coba lagi beberapa saat.');
  }
  entry.count += 1;
}
