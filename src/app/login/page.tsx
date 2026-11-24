'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/components/client-api';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@eisd.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      router.push('/apps');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login gagal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="aurora-hero relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-400/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-violet-500/25 blur-3xl" />
      <Card className="relative w-full max-w-md overflow-hidden">
        <div className="aurora-card-blend h-2 w-full bg-brand-gradient" />
        <CardHeader className="aurora-card-purple pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="glass-tile flex h-10 w-10 items-center justify-center rounded-xl p-1.5 shadow-sm">
                <img
                  src="/images/eisd.png"
                  alt="Logo EISD"
                  className="h-full w-full object-contain"
                />
              </span>
              <CardTitle className="text-xl font-bold">
                EISD <span className="text-brand-gradient">One</span>
              </CardTitle>
            </div>
            <Badge variant="purple">Internal Lab</Badge>
          </div>
          <p className="pt-1 text-xs leading-relaxed text-slate-600">
            Masuk untuk mengakses dashboard pengurus: Administrator, 3 anggota Core, dan 7 Ketua
            Divisi EISD.
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          )}
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Email Pengurus
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm focus:bg-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm focus:bg-white"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-brand w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? 'Memproses...' : 'Masuk ke Workspace'}
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
