'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface CalItem {
  id: string;
  title: string;
  category: string;
  startAt: string;
  location: string | null;
}

export default function CalendarPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<CalItem[]>([]);
  const [form, setForm] = useState({ title: '', category: 'MEETING', startAt: '', location: '' });

  const load = useCallback(async () => {
    setItems(await apiFetch<CalItem[]>('/api/calendar'));
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const iso = new Date(form.startAt).toISOString();
    await apiFetch('/api/calendar', {
      method: 'POST',
      body: JSON.stringify({ ...form, startAt: iso, endAt: iso }),
    });
    setForm({ title: '', category: 'MEETING', startAt: '', location: '' });
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kalender Terpadu</h1>
          <p className="text-sm text-slate-500">
            Agenda rapat, kegiatan, dan ulang tahun anggota + ekspor iCal.
          </p>
        </div>
        <a
          href="/api/calendar?format=ics"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
        >
          <Download className="h-3.5 w-3.5" /> Export iCal (.ics)
        </a>
      </div>

      {hasPermission('calendar.item.manage') && (
        <Card>
          <CardHeader>
            <CardTitle>Tambah Agenda</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleAdd(e)} className="grid gap-2 md:grid-cols-4">
              <input
                required
                placeholder="Judul agenda"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="MEETING">MEETING</option>
                <option value="EVENT">EVENT</option>
                <option value="PRAKTIKUM">PRAKTIKUM</option>
                <option value="COMPETITION">COMPETITION</option>
              </select>
              <input
                type="datetime-local"
                required
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
              <input
                placeholder="Lokasi"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="rounded bg-slate-900 py-1.5 text-xs font-medium text-white md:col-span-4"
              >
                Simpan
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daftar Agenda ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">
                  {new Date(item.startAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                  {item.location ? ` · ${item.location}` : ''}
                </p>
              </div>
              <Badge variant="secondary">{item.category}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
