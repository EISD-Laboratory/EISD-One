'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Cake, CheckSquare, Trophy } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface Partner {
  id: string;
  name: string;
  picName: string | null;
  picContact: string | null;
  stage: string;
  mouExpiresAt: string | null;
  obligationsJson: Array<{ title: string; done: boolean }> | null;
}

interface Recognition {
  id: string;
  year: number;
  month: number;
  memberName: string;
  title: string;
  kpiScore: number;
  isOverride: boolean;
  overrideReason: string | null;
  rewardAmount: number;
  status: string;
}

interface EnablerData {
  partners: Partner[];
  recognitions: Recognition[];
  kpiRanking: Array<{
    rank: number;
    memberId: string;
    fullName: string;
    division: string;
    finalScore: number;
  }>;
  birthdaysThisMonth: Array<{ id: string; fullName: string; birthDate: string }>;
}

export default function EnablerModulePage() {
  const { hasPermission } = useAuth();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month] = useState(now.getMonth() + 1);
  const [data, setData] = useState<EnablerData | null>(null);
  const [pForm, setPForm] = useState({
    name: '',
    picName: '',
    picContact: '',
    stage: 'PROSPECT',
    mouExpiresAt: '',
    benefitText: '',
  });
  const [recForm, setRecForm] = useState({
    memberId: '',
    overrideReason: '',
    rewardAmount: '150000',
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setData(await apiFetch<EnablerData>(`/api/modules/enabler?year=${year}&month=${month}`));
  }, [year, month]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  async function addPartner(e: FormEvent) {
    e.preventDefault();
    const obligations = pForm.benefitText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((title) => ({ title, done: false }));
    await apiFetch('/api/modules/enabler', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create_partner',
        name: pForm.name,
        picName: pForm.picName,
        picContact: pForm.picContact,
        stage: pForm.stage,
        mouExpiresAt: pForm.mouExpiresAt || undefined,
        obligations,
      }),
    });
    setPForm({
      name: '',
      picName: '',
      picContact: '',
      stage: 'PROSPECT',
      mouExpiresAt: '',
      benefitText: '',
    });
    await load();
  }

  async function toggleObligation(partner: Partner, idx: number) {
    const next = (partner.obligationsJson ?? []).map((o, i) =>
      i === idx ? { ...o, done: !o.done } : o,
    );
    await apiFetch('/api/modules/enabler', {
      method: 'POST',
      body: JSON.stringify({ action: 'update_partner', id: partner.id, obligations: next }),
    });
    await load();
  }

  async function proposeSotm(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch('/api/modules/enabler', {
        method: 'POST',
        body: JSON.stringify({
          action: 'propose_recognition',
          year,
          month,
          memberId: recForm.memberId,
          overrideReason: recForm.overrideReason || undefined,
          rewardAmount: Number(recForm.rewardAmount || 0),
        }),
      });
      setMsg('Usulan Staff of the Month berhasil dibuat.');
      await load();
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : 'Gagal mengusulkan.');
    }
  }

  async function approveSotm(id: string) {
    await apiFetch('/api/modules/enabler', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve_recognition', id }),
    });
    setMsg('Staff of the Month ditetapkan & anggaran hadiah otomatis dicatat ke Kas Core.');
    await load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Modul Enabler — Partnership & Member Engagement
        </h1>
        <p className="text-sm text-slate-500">
          Pipeline partner internal (tanpa portal partner), Staff of the Month berbasis KPI, dan
          pengingat ulang tahun.
        </p>
      </div>

      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4" /> Staff of the Month ({year}-
              {String(month).padStart(2, '0')})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {hasPermission('enabler.partner.manage') && (
              <form onSubmit={(e) => void proposeSotm(e)} className="space-y-2">
                <select
                  required
                  value={recForm.memberId}
                  onChange={(e) => setRecForm({ ...recForm, memberId: e.target.value })}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                >
                  <option value="">-- Pilih Pemenang dari Ranking KPI --</option>
                  {data?.kpiRanking.map((r) => (
                    <option key={r.memberId} value={r.memberId}>
                      #{r.rank} {r.fullName} ({r.division}) — Skor {r.finalScore}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Alasan override (WAJIB diisi jika bukan peringkat #1 KPI)"
                  value={recForm.overrideReason}
                  onChange={(e) => setRecForm({ ...recForm, overrideReason: e.target.value })}
                  className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    placeholder="Hadiah (Rp)"
                    value={recForm.rewardAmount}
                    onChange={(e) => setRecForm({ ...recForm, rewardAmount: e.target.value })}
                    className="w-40 rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    className="flex-1 rounded bg-slate-900 py-1.5 text-xs font-medium text-white"
                  >
                    Usulkan Pemenang
                  </button>
                </div>
              </form>
            )}

            <div className="divide-y divide-slate-100">
              {data?.recognitions.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">
                      {r.memberName}{' '}
                      <Badge variant={r.status === 'APPROVED' ? 'success' : 'secondary'}>
                        {r.status}
                      </Badge>
                    </p>
                    <p className="text-xs text-slate-500">
                      Skor KPI {r.kpiScore} · Hadiah Rp {r.rewardAmount.toLocaleString('id-ID')}
                      {r.isOverride ? ` · Override: "${r.overrideReason}"` : ''}
                    </p>
                  </div>
                  {r.status === 'PENDING' && hasPermission('enabler.partner.manage') && (
                    <button
                      type="button"
                      onClick={() => void approveSotm(r.id)}
                      className="rounded bg-emerald-700 px-2.5 py-1 text-xs text-white"
                    >
                      Setujui
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="h-4 w-4" /> Ulang Tahun Bulan Ini
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data?.birthdaysThisMonth.length === 0 ? (
              <p className="text-xs text-slate-500">
                Tidak ada anggota yang berulang tahun di bulan ini.
              </p>
            ) : (
              data?.birthdaysThisMonth.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded border border-slate-100 px-3 py-2"
                >
                  <span className="font-medium">{b.fullName}</span>
                  <Badge variant="secondary">{b.birthDate.slice(5, 10)}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Partnership Pipeline & Checklist Benefit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasPermission('enabler.partner.manage') && (
            <form onSubmit={(e) => void addPartner(e)} className="grid gap-2 md:grid-cols-3">
              <input
                required
                placeholder="Nama Partner *"
                value={pForm.name}
                onChange={(e) => setPForm({ ...pForm, name: e.target.value })}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              <input
                placeholder="Nama PIC"
                value={pForm.picName}
                onChange={(e) => setPForm({ ...pForm, picName: e.target.value })}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              <input
                placeholder="Kontak PIC"
                value={pForm.picContact}
                onChange={(e) => setPForm({ ...pForm, picContact: e.target.value })}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              <select
                value={pForm.stage}
                onChange={(e) => setPForm({ ...pForm, stage: e.target.value })}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              >
                {['PROSPECT', 'APPROACH', 'NEGOTIATION', 'DEAL', 'ACTIVE', 'COMPLETED'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                placeholder="Checklist benefit (pisahkan koma)"
                value={pForm.benefitText}
                onChange={(e) => setPForm({ ...pForm, benefitText: e.target.value })}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="rounded bg-slate-900 py-1.5 text-xs font-medium text-white"
              >
                Tambah Partner
              </button>
            </form>
          )}

          <div className="space-y-3 text-sm">
            {data?.partners.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      PIC: {p.picName || '-'} ({p.picContact || '-'})
                      {p.mouExpiresAt ? ` · MoU berlaku s.d. ${p.mouExpiresAt.slice(0, 10)}` : ''}
                    </p>
                  </div>
                  <Badge variant={p.stage === 'ACTIVE' ? 'success' : 'secondary'}>{p.stage}</Badge>
                </div>
                {(p.obligationsJson ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                    {(p.obligationsJson ?? []).map((ob, idx) => (
                      <button
                        key={ob.title}
                        type="button"
                        onClick={() => void toggleObligation(p, idx)}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${ob.done ? 'border-emerald-200 bg-emerald-50 text-emerald-800 line-through' : 'border-slate-300 text-slate-700'}`}
                      >
                        <CheckSquare className="h-3 w-3" /> {ob.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
