'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Award, CheckCircle2, Download, ExternalLink } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface EventParticipant {
  id: string;
  role: 'COMMITTEE' | 'ATTENDEE';
  name: string;
  nim: string | null;
  institution: string | null;
  position: string | null;
  attended: boolean;
  certificateNo: string | null;
}

interface EventRow {
  id: string;
  slug: string;
  title: string;
  speaker: string | null;
  startAt: string;
  location: string | null;
  status: string;
  budgetAmount: number;
  actualExpense: number;
  isPublicOpen: boolean;
  participants: EventParticipant[];
}

export default function EventModulePage() {
  const { hasPermission } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; nim: string; fullName: string }>>([]);
  const [form, setForm] = useState({
    title: '',
    speaker: '',
    startAt: '',
    location: '',
    budgetAmount: '0',
    isPublicOpen: true,
  });
  const [commForm, setCommForm] = useState({
    eventId: '',
    memberId: '',
    position: 'Panitia Acara',
  });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setEvents(await apiFetch<EventRow[]>('/api/modules/event'));
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
    void apiFetch<{ items: Array<{ id: string; nim: string; fullName: string }> }>(
      '/api/members?limit=100',
    )
      .then((d) => setMembers(d.items))
      .catch(() => undefined);
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const startIso = new Date(form.startAt).toISOString();
    const endIso = new Date(new Date(form.startAt).getTime() + 3 * 3600 * 1000).toISOString();
    await apiFetch('/api/modules/event', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create',
        title: form.title,
        speaker: form.speaker,
        startAt: startIso,
        endAt: endIso,
        location: form.location,
        budgetAmount: Number(form.budgetAmount || 0),
        isPublicOpen: form.isPublicOpen,
      }),
    });
    setForm({
      title: '',
      speaker: '',
      startAt: '',
      location: '',
      budgetAmount: '0',
      isPublicOpen: true,
    });
    setMsg('Event berhasil dibuat.');
    await load();
  }

  async function changeStatus(eventId: string, status: string) {
    await apiFetch('/api/modules/event', {
      method: 'POST',
      body: JSON.stringify({ action: 'status', eventId, status }),
    });
    setMsg(
      status === 'APPROVED'
        ? 'Event disetujui dan otomatis didaftarkan ke Kalender.'
        : status === 'COMPLETED'
          ? 'Event selesai dan realisasi biaya tercatat di Kas Core.'
          : `Status event diubah menjadi ${status}.`,
    );
    await load();
  }

  async function addCommittee(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/modules/event', {
      method: 'POST',
      body: JSON.stringify({ action: 'add_committee', ...commForm }),
    });
    setMsg('Panitia ditambahkan (otomatis dihitung pada KPI event.committee_count).');
    await load();
  }

  async function toggleAttend(p: EventParticipant) {
    await apiFetch('/api/modules/event', {
      method: 'POST',
      body: JSON.stringify({ action: 'attendance', participantId: p.id, attended: !p.attended }),
    });
    await load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Modul Event (Kuliah Umum & Kegiatan)</h1>
        <p className="text-sm text-slate-500">
          Tanpa tiket QR — fokus ke kuliah umum/seminar, pendaftaran publik ringan, kepanitiaan
          (KPI), presensi sederhana, sertifikat PDF, dan integrasi Kas Core.
        </p>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </div>
      )}

      {hasPermission('event.event.manage') && (
        <Card>
          <CardHeader>
            <CardTitle>Buat Event / Kuliah Umum Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-2 md:grid-cols-3">
              <input
                required
                placeholder="Judul Event *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
              <input
                placeholder="Pembicara / Narasumber"
                value={form.speaker}
                onChange={(e) => setForm({ ...form, speaker: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
              <input
                type="datetime-local"
                required
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
              <input
                placeholder="Lokasi / Link Meeting"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
              <input
                type="number"
                min={0}
                placeholder="Anggaran (Rp)"
                value={form.budgetAmount}
                onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="rounded bg-slate-900 py-1.5 text-xs font-medium text-white"
              >
                Simpan Event
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {events.map((ev) => (
        <Card key={ev.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{ev.title}</CardTitle>
                <p className="text-xs text-slate-500">
                  {new Date(ev.startAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} ·{' '}
                  {ev.location || '-'}
                  {ev.speaker ? ` · Pembicara: ${ev.speaker}` : ''} · Anggaran: Rp{' '}
                  {ev.budgetAmount.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={ev.status === 'COMPLETED' ? 'success' : 'secondary'}>
                  {ev.status}
                </Badge>
                {hasPermission('event.event.manage') && (
                  <select
                    value={ev.status}
                    onChange={(e) => void changeStatus(ev.id, e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    {['IDEA', 'PROPOSAL', 'APPROVED', 'ONGOING', 'COMPLETED'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
                {ev.isPublicOpen && (
                  <Link
                    href={`/register/${ev.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    <ExternalLink className="h-3 w-3" /> Form Publik
                  </Link>
                )}
                <a
                  href={`/api/modules/event?exportEventId=${ev.id}&format=xlsx`}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs"
                >
                  <Download className="h-3 w-3" /> Export Peserta
                </a>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasPermission('event.event.manage') && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setCommForm({ ...commForm, eventId: ev.id });
                  void addCommittee(e);
                }}
                className="flex flex-wrap gap-2"
              >
                <select
                  required
                  value={commForm.eventId === ev.id ? commForm.memberId : ''}
                  onChange={(e) =>
                    setCommForm({
                      eventId: ev.id,
                      memberId: e.target.value,
                      position: commForm.position,
                    })
                  }
                  className="rounded border border-slate-300 px-2.5 py-1 text-xs"
                >
                  <option value="">-- Tambah Panitia (Anggota EISD) --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.nim})
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Jabatan Panitia"
                  value={commForm.position}
                  onChange={(e) =>
                    setCommForm({ ...commForm, eventId: ev.id, position: e.target.value })
                  }
                  className="rounded border border-slate-300 px-2.5 py-1 text-xs"
                />
                <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-xs text-white">
                  Tambah Panitia
                </button>
              </form>
            )}

            <div className="divide-y divide-slate-100 text-xs">
              {ev.participants.length === 0 ? (
                <p className="py-2 text-slate-400">Belum ada panitia atau pendaftar.</p>
              ) : (
                ev.participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <div>
                      <span className="font-medium text-slate-900">{p.name}</span>{' '}
                      <Badge variant="secondary">
                        {p.role === 'COMMITTEE' ? p.position || 'Panitia' : 'Peserta'}
                      </Badge>
                      {p.nim && <span className="ml-2 font-mono text-slate-500">{p.nim}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasPermission('event.event.manage') && (
                        <button
                          type="button"
                          onClick={() => void toggleAttend(p)}
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium ${p.attended ? 'bg-emerald-100 text-emerald-800' : 'border border-slate-300 text-slate-600'}`}
                        >
                          <CheckCircle2 className="h-3 w-3" />{' '}
                          {p.attended ? 'Hadir' : 'Tandai Hadir'}
                        </button>
                      )}
                      {p.attended && (
                        <a
                          href={`/api/modules/event/certificate/${p.id}`}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 text-slate-700 hover:bg-slate-50"
                        >
                          <Award className="h-3 w-3" /> Sertifikat PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
