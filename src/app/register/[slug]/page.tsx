'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, Sparkles } from 'lucide-react';
import { apiFetch } from '@/components/client-api';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface PublicEvent {
  title: string;
  description: string | null;
  speaker: string | null;
  startAt: string;
  location: string | null;
  isPublicOpen: boolean;
}

export default function PublicEventRegisterPage() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [form, setForm] = useState({ name: '', nim: '', email: '', institution: '' });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<PublicEvent>(`/api/modules/event/public/${slug}`)
      .then(setEvent)
      .catch((e) => setError(e instanceof Error ? e.message : 'Event tidak ditemukan.'));
  }, [slug]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/modules/event/public/${slug}`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Pendaftaran gagal.');
    }
  }

  return (
    <main className="aurora-hero relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-400/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-violet-500/25 blur-3xl" />
      <Card className="relative w-full max-w-lg overflow-hidden">
        <div className="h-2 w-full bg-brand-gradient" />
        <CardHeader className="aurora-card-blend">
          <div className="flex items-center justify-between">
            <Badge variant="purple" className="gap-1.5">
              <Sparkles className="h-3 w-3 text-emerald-600" />
              Pendaftaran Kegiatan EISD
            </Badge>
          </div>
          <CardTitle className="mt-2 text-xl font-bold">
            {event?.title || 'Memuat Event...'}
          </CardTitle>
          {event && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
              <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
              {new Date(event.startAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} ·{' '}
              {event.location || '-'}
              {event.speaker ? ` · Narasumber: ${event.speaker}` : ''}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-4">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          )}
          {done ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-semibold">Pendaftaran berhasil tercatat!</p>
              <p className="mt-1 text-xs">
                Terima kasih, <strong>{form.name}</strong>. Anda sudah terdaftar untuk mengikuti
                kegiatan ini tanpa memerlukan tiket QR.
              </p>
            </div>
          ) : event && !event.isPublicOpen ? (
            <p className="text-sm text-slate-500">Pendaftaran untuk kegiatan ini sudah ditutup.</p>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
              {event?.description && <p className="text-sm text-slate-600">{event.description}</p>}
              <input
                required
                placeholder="Nama Lengkap *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm focus:bg-white"
              />
              <input
                placeholder="NIM (opsional)"
                value={form.nim}
                onChange={(e) => setForm({ ...form, nim: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm focus:bg-white"
              />
              <input
                type="email"
                placeholder="Email (opsional)"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm focus:bg-white"
              />
              <input
                placeholder="Prodi / Instansi"
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm focus:bg-white"
              />
              <button
                type="submit"
                className="btn-brand w-full rounded-xl py-2.5 text-sm font-semibold"
              >
                Daftar Sekarang
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
