'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Calculator, Copy, Download } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface KpiIndicator {
  id: string;
  code: string;
  name: string;
  weight: number;
  sourceType: string;
  minScale: number;
  maxScale: number;
  sourceCode: string | null;
}
interface KpiFramework {
  id: string;
  name: string;
  version: number;
  status: string;
  indicators: KpiIndicator[];
}
interface KpiResult {
  rank: number;
  id: string;
  nim: string;
  fullName: string;
  division: string;
  finalScore: number;
}
interface PendingScore {
  id: string;
  rawValue: number;
  member: { nim: string; fullName: string };
  indicator: { name: string };
}

export default function KpiPage() {
  const { hasPermission } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [frameworks, setFrameworks] = useState<KpiFramework[]>([]);
  const [fwId, setFwId] = useState('');
  const [results, setResults] = useState<KpiResult[]>([]);
  const [pending, setPending] = useState<PendingScore[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; nim: string; fullName: string }>>([]);
  const [manual, setManual] = useState({ indicatorId: '', memberId: '', rawValue: '4' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ year: String(year), month: String(month) });
    if (fwId) qs.set('frameworkId', fwId);
    const data = await apiFetch<{
      frameworks: KpiFramework[];
      results: KpiResult[];
      pendingManualScores: PendingScore[];
    }>(`/api/kpi?${qs}`);
    setFrameworks(data.frameworks);
    setResults(data.results);
    setPending(data.pendingManualScores);
    if (!fwId && data.frameworks.length > 0) {
      setFwId(data.frameworks.find((f) => f.status === 'ACTIVE')?.id || data.frameworks[0].id);
    }
  }, [fwId, year, month]);

  useEffect(() => {
    void load().catch(() => undefined);
    void apiFetch<{ items: Array<{ id: string; nim: string; fullName: string }> }>(
      '/api/members?limit=100',
    )
      .then((d) => setMembers(d.items))
      .catch(() => undefined);
  }, [load]);

  const currentFw = frameworks.find((f) => f.id === fwId);
  const manualInds = currentFw?.indicators.filter((i) => i.sourceType === 'MANUAL') ?? [];

  async function calculate() {
    if (!fwId) return;
    const res = await apiFetch<{ membersCalculated: number }>('/api/kpi', {
      method: 'POST',
      body: JSON.stringify({ action: 'calculate', frameworkId: fwId, year, month }),
    });
    setMsg(`KPI dihitung untuk ${res.membersCalculated} anggota & dicatat di Audit Log.`);
    await load();
  }

  async function cloneFw() {
    if (!fwId) return;
    const res = await apiFetch<KpiFramework>('/api/kpi', {
      method: 'POST',
      body: JSON.stringify({ action: 'clone', frameworkId: fwId }),
    });
    setFwId(res.id);
    setMsg(`Framework disalin ke versi ${res.version} (DRAFT).`);
    await load();
  }

  async function submitManual(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/kpi', {
      method: 'POST',
      body: JSON.stringify({ action: 'submit_manual', frameworkId: fwId, year, month, ...manual }),
    });
    setMsg('Skor manual diajukan untuk persetujuan Core.');
    await load();
  }

  async function decideManual(scoreId: string, decision: 'APPROVED' | 'REJECTED') {
    await apiFetch('/api/kpi', {
      method: 'POST',
      body: JSON.stringify({ action: 'decide_manual', scoreId, decision }),
    });
    setMsg(`Skor manual ${decision}.`);
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">KPI Anggota (Dinamis)</h1>
          <p className="text-sm text-slate-500">
            Bobot 100%, normalisasi 0–100, clone versi baru tanpa deploy ulang.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={fwId}
            onChange={(e) => setFwId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            {frameworks.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} (v{f.version} · {f.status})
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          />
          {hasPermission('kpi.result.export') && (
            <a
              href={`/api/kpi/export?format=xlsx&frameworkId=${fwId}&year=${year}&month=${month}`}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5" /> Export XLSX
            </a>
          )}
        </div>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </div>
      )}

      {currentFw && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                Indikator ({currentFw.indicators.reduce((a, b) => a + b.weight, 0)}%)
              </CardTitle>
              {hasPermission('kpi.framework.manage') && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void cloneFw()}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium"
                  >
                    <Copy className="h-3.5 w-3.5" /> Clone Versi
                  </button>
                  <button
                    type="button"
                    onClick={() => void calculate()}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    <Calculator className="h-3.5 w-3.5" /> Hitung / Recalculate
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 text-sm">
            {currentFw.indicators.map((ind) => (
              <div key={ind.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">{ind.name}</p>
                  <p className="text-xs text-slate-500">
                    Skala {ind.minScale}–{ind.maxScale}{' '}
                    {ind.sourceCode ? `· ${ind.sourceCode}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{ind.sourceType}</Badge>
                  <Badge>{ind.weight}%</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {hasPermission('kpi.score.submit') && manualInds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Input Nilai Manual (Kadiv)</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void submitManual(e)} className="grid gap-2 md:grid-cols-4">
              <select
                required
                value={manual.indicatorId}
                onChange={(e) => setManual({ ...manual, indicatorId: e.target.value })}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              >
                <option value="">-- Indikator --</option>
                {manualInds.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <select
                required
                value={manual.memberId}
                onChange={(e) => setManual({ ...manual, memberId: e.target.value })}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              >
                <option value="">-- Anggota --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.nim})
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.1"
                required
                value={manual.rawValue}
                onChange={(e) => setManual({ ...manual, rawValue: e.target.value })}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="rounded bg-slate-900 py-1.5 text-xs font-medium text-white"
              >
                Ajukan Nilai
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {hasPermission('kpi.score.approve') && pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Persetujuan Nilai Manual ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 text-sm">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2">
                <span>
                  <strong>{p.member.fullName}</strong> · {p.indicator.name}:{' '}
                  <strong>{p.rawValue}</strong>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void decideManual(p.id, 'APPROVED')}
                    className="rounded bg-emerald-700 px-2.5 py-1 text-xs text-white"
                  >
                    Setujui
                  </button>
                  <button
                    type="button"
                    onClick={() => void decideManual(p.id, 'REJECTED')}
                    className="rounded bg-rose-700 px-2.5 py-1 text-xs text-white"
                  >
                    Tolak
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Rekap & Ranking ({year}-{String(month).padStart(2, '0')})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">#</th>
                <th className="py-2">NIM</th>
                <th className="py-2">Nama</th>
                <th className="py-2">Divisi</th>
                <th className="py-2">Skor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 font-semibold">{r.rank}</td>
                  <td className="py-2 font-mono text-xs">{r.nim}</td>
                  <td className="py-2 font-medium">{r.fullName}</td>
                  <td className="py-2">{r.division}</td>
                  <td className="py-2">
                    <Badge variant="success">{r.finalScore.toFixed(2)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
