'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}
interface Division {
  id: string;
  code: string;
  name: string;
  isCustom: boolean;
  isEnabled: boolean;
}

export default function PeriodsPage() {
  const { hasPermission } = useAuth();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [pForm, setPForm] = useState({ name: '', startDate: '', endDate: '' });
  const [dForm, setDForm] = useState({ code: '', name: '' });

  const load = useCallback(async () => {
    const [p, d] = await Promise.all([
      apiFetch<Period[]>('/api/periods'),
      apiFetch<Division[]>('/api/divisions'),
    ]);
    setPeriods(p);
    setDivisions(d);
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  async function addPeriod(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/periods', { method: 'POST', body: JSON.stringify(pForm) });
    setPForm({ name: '', startDate: '', endDate: '' });
    await load();
  }

  async function activate(periodId: string) {
    await apiFetch('/api/periods', { method: 'PATCH', body: JSON.stringify({ periodId }) });
    await load();
  }

  async function addCustomModule(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/divisions', { method: 'POST', body: JSON.stringify(dForm) });
    setDForm({ code: '', name: '' });
    await load();
  }

  async function toggleModule(d: Division) {
    await apiFetch('/api/divisions', {
      method: 'PATCH',
      body: JSON.stringify({ id: d.id, isEnabled: !d.isEnabled }),
    });
    await load();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Periode & Modul Divisi</h1>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Periode Kepengurusan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasPermission('member.period.manage') && (
              <form onSubmit={(e) => void addPeriod(e)} className="grid gap-2 sm:grid-cols-3">
                <input
                  required
                  placeholder="2027/2028"
                  value={pForm.name}
                  onChange={(e) => setPForm({ ...pForm, name: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  type="date"
                  required
                  value={pForm.startDate}
                  onChange={(e) => setPForm({ ...pForm, startDate: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  type="date"
                  required
                  value={pForm.endDate}
                  onChange={(e) => setPForm({ ...pForm, endDate: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="rounded bg-slate-900 py-1.5 text-xs font-medium text-white sm:col-span-3"
                >
                  Tambah Periode
                </button>
              </form>
            )}
            <div className="divide-y divide-slate-100 text-sm">
              {periods.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-semibold">
                      {p.name} {p.isActive && <Badge variant="success">Aktif</Badge>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.startDate.slice(0, 10)} s.d. {p.endDate.slice(0, 10)}
                    </p>
                  </div>
                  {!p.isActive && hasPermission('member.period.manage') && (
                    <button
                      type="button"
                      onClick={() => void activate(p.id)}
                      className="rounded border border-slate-300 px-2.5 py-1 text-xs"
                    >
                      Aktifkan
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modul Divisi & Custom Modul (Odoo-mini)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasPermission('member.division.manage') && (
              <form onSubmit={(e) => void addCustomModule(e)} className="grid gap-2 sm:grid-cols-2">
                <input
                  required
                  placeholder="kode-modul"
                  value={dForm.code}
                  onChange={(e) => setDForm({ ...dForm, code: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  required
                  placeholder="Nama Custom Modul"
                  value={dForm.name}
                  onChange={(e) => setDForm({ ...dForm, name: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="rounded bg-slate-900 py-1.5 text-xs font-medium text-white sm:col-span-2"
                >
                  Tambah Custom Modul (Administrator)
                </button>
              </form>
            )}
            <div className="divide-y divide-slate-100 text-sm">
              {divisions.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium">{d.name}</span>{' '}
                    {d.isCustom && <Badge>Custom</Badge>}
                  </div>
                  <button
                    type="button"
                    disabled={!hasPermission('member.division.manage')}
                    onClick={() => void toggleModule(d)}
                    className={`rounded-full px-3 py-0.5 text-xs font-semibold ${d.isEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {d.isEnabled ? 'AKTIF' : 'NONAKTIF'}
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
