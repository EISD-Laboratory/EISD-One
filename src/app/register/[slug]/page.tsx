'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge variant="secondary">Pendaftaran Kegiatan EISD</Badge>
          </div>
          <CardTitle className="mt-2 text-xl">{event?.title || 'Memuat Event...'}</CardTitle>
          {event && (
            <p className="text-xs text-slate-500">
              {new Date(event.startAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} ·{' '}
              {event.location || '-'}
              {event.speaker ? ` · Narasumber: ${event.speaker}` : ''}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          {done ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="NIM (opsional)"
                value={form.nim}
                onChange={(e) => setForm({ ...form, nim: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="email"
                placeholder="Email (opsional)"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Prodi / Instansi"
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white"
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
