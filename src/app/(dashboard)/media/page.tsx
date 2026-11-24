'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface MediaItem {
  id: string;
  title: string;
  requesterDivision: string | null;
  channel: string;
  picName: string | null;
  dueDate: string | null;
  publishAt: string | null;
  status: 'REQUESTED' | 'IN_PROGRESS' | 'REVIEW' | 'PUBLISHED';
  brief: string | null;
  assetUrl: string | null;
}

const STATUS_OPTIONS: MediaItem['status'][] = ['REQUESTED', 'IN_PROGRESS', 'REVIEW', 'PUBLISHED'];

export default function MediaPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('media.request.manage');

  const [items, setItems] = useState<MediaItem[]>([]);
  const [title, setTitle] = useState('');
  const [requesterDivision, setRequesterDivision] = useState('Event');
  const [channel, setChannel] = useState('Instagram');
  const [picName, setPicName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [brief, setBrief] = useState('');
  const [syncCalendar, setSyncCalendar] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<MediaItem[]>('/api/modules/media');
    setItems(data);
  }

  useEffect(() => {
    void load().catch(() => {});
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    await apiFetch('/api/modules/media', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create',
        title,
        requesterDivision,
        channel,
        picName: picName || undefined,
        dueDate: dueDate || undefined,
        publishAt: publishAt ? new Date(publishAt).toISOString() : undefined,
        brief: brief || undefined,
        syncCalendar,
      }),
    });
    setTitle('');
    setBrief('');
    setMsg('Permintaan Media berhasil ditambahkan.');
    await load();
  }

  async function handleStatus(id: string, status: MediaItem['status']) {
    await apiFetch('/api/modules/media', {
      method: 'POST',
      body: JSON.stringify({ action: 'update', id, status }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Modul Media</h1>
        <p className="text-sm text-slate-500">
          Antrean permintaan desain, konten publikasi, dan sinkronisasi jadwal tayang ke Kalender
          EISD.
        </p>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </div>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Buat Permintaan Desain / Konten</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-3 md:grid-cols-3">
              <input
                required
                placeholder="Judul konten / desain *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              />
              <input
                placeholder="Divisi pemohon (mis. Event)"
                value={requesterDivision}
                onChange={(e) => setRequesterDivision(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="Instagram">Instagram</option>
                <option value="YouTube">YouTube</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Website">Website / Poster Cetak</option>
              </select>
              <input
                placeholder="Nama PIC Media"
                value={picName}
                onChange={(e) => setPicName(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                title="Deadline"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                title="Jadwal Publikasi"
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Brief singkat / tautan referensi"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              />
              <label className="flex items-center gap-2 text-xs text-slate-600 md:col-span-2">
                <input
                  type="checkbox"
                  checked={syncCalendar}
                  onChange={(e) => setSyncCalendar(e.target.checked)}
                />
                Masukkan jadwal publikasi ke Kalender EISD
              </label>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Simpan Permintaan
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daftar Antrean & Konten ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{item.title}</span>
                  <Badge variant="secondary">{item.channel}</Badge>
                  {item.requesterDivision && (
                    <Badge variant="secondary">Dari: {item.requesterDivision}</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  PIC: {item.picName || '-'} · Deadline:{' '}
                  {item.dueDate ? item.dueDate.slice(0, 10) : '-'}
                  {item.brief ? ` · ${item.brief}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canManage ? (
                  <select
                    value={item.status}
                    onChange={(e) =>
                      void handleStatus(item.id, e.target.value as MediaItem['status'])
                    }
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge variant={item.status === 'PUBLISHED' ? 'success' : 'secondary'}>
                    {item.status}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
