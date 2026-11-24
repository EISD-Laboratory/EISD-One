'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { GlassSelect } from '@/components/glass-inputs';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface CompetitionItem {
  id: string;
  competitionName: string;
  organizer: string | null;
  level: string;
  teamName: string;
  memberNames: string | null;
  eventDate: string;
  status: 'REGISTERED' | 'FINALIST' | 'WINNER' | 'PARTICIPANT';
  achievement: string | null;
  registrationFee: number;
  recordedToCash: boolean;
}

const STATUSES: CompetitionItem['status'][] = ['REGISTERED', 'FINALIST', 'WINNER', 'PARTICIPANT'];

export default function CompetitionPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('competition.entry.manage');

  const [items, setItems] = useState<CompetitionItem[]>([]);
  const [competitionName, setCompetitionName] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [level, setLevel] = useState('Nasional');
  const [teamName, setTeamName] = useState('');
  const [memberNames, setMemberNames] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [registrationFee, setRegistrationFee] = useState('0');
  const [recordToCash, setRecordToCash] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setItems(await apiFetch<CompetitionItem[]>('/api/modules/competition'));
  }

  useEffect(() => {
    void load().catch(() => {});
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    await apiFetch('/api/modules/competition', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create',
        competitionName,
        organizer: organizer || undefined,
        level,
        teamName,
        memberNames: memberNames || undefined,
        eventDate,
        registrationFee: Number(registrationFee) || 0,
        recordToCash,
        syncCalendar: true,
      }),
    });
    setCompetitionName('');
    setTeamName('');
    setMemberNames('');
    setRegistrationFee('0');
    setMsg('Data lomba disimpan & disinkronkan ke Kalender EISD.');
    await load();
  }

  async function handleUpdate(id: string, payload: Record<string, unknown>) {
    await apiFetch('/api/modules/competition', {
      method: 'POST',
      body: JSON.stringify({ action: 'update', id, ...payload }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Modul Competition</h1>
        <p className="text-sm text-slate-500">
          Daftar lomba, tim EISD, capaian prestasi, sinkronisasi Kalender, dan pencatatan biaya
          lomba ke Kas Core.
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
            <CardTitle>Daftarkan Lomba & Tim</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-3 md:grid-cols-3">
              <input
                required
                placeholder="Nama Lomba *"
                value={competitionName}
                onChange={(e) => setCompetitionName(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              />
              <input
                placeholder="Penyelenggara"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                placeholder="Nama Tim *"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <GlassSelect
                value={level}
                onChange={setLevel}
                options={[
                  { value: 'Kampus', label: 'Kampus' },
                  { value: 'Regional', label: 'Regional' },
                  { value: 'Nasional', label: 'Nasional' },
                  { value: 'Internasional', label: 'Internasional' },
                ]}
              />
              <input
                required
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Daftar anggota tim (pisahkan koma)"
                value={memberNames}
                onChange={(e) => setMemberNames(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              />
              <input
                type="number"
                min={0}
                placeholder="Biaya pendaftaran (Rp)"
                value={registrationFee}
                onChange={(e) => setRegistrationFee(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-xs text-slate-600 md:col-span-2">
                <input
                  type="checkbox"
                  checked={recordToCash}
                  onChange={(e) => setRecordToCash(e.target.checked)}
                />
                Catat biaya pendaftaran otomatis sebagai pengeluaran di Kas Core
              </label>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Simpan Lomba
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Riwayat & Progres Lomba ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{item.competitionName}</span>
                  <Badge variant="secondary">{item.level}</Badge>
                  <Badge variant={item.status === 'WINNER' ? 'success' : 'secondary'}>
                    {item.status}
                  </Badge>
                  {item.recordedToCash && <Badge variant="success">Tercatat di Kas</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Tim: <strong>{item.teamName}</strong> ({item.memberNames || '-'}) · Tanggal:{' '}
                  {item.eventDate.slice(0, 10)} · Biaya: Rp{' '}
                  {item.registrationFee.toLocaleString('id-ID')}
                  {item.achievement ? ` · Capaian: ${item.achievement}` : ''}
                </p>
              </div>
              {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                  <GlassSelect
                    size="sm"
                    className="min-w-[140px]"
                    value={item.status}
                    onChange={(v) => void handleUpdate(item.id, { status: v })}
                    options={STATUSES.map((s) => ({ value: s, label: s }))}
                  />
                  {!item.recordedToCash && item.registrationFee > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleUpdate(item.id, { recordToCash: true })}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-100"
                    >
                      Catat ke Kas Core
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
