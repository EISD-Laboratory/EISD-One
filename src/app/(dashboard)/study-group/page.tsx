'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface StudyGroupItem {
  id: string;
  code: string;
  name: string;
  topic: string;
  mentorName: string | null;
  schedule: string | null;
  maxParticipants: number;
  sessions: Array<{
    id: string;
    sessionNo: number;
    title: string;
    sessionDate: string;
    attendeeCount: number;
    materialUrl: string | null;
  }>;
}

export default function StudyGroupPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('study_group.class.manage');

  const [groups, setGroups] = useState<StudyGroupItem[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [mentorName, setMentorName] = useState('');
  const [schedule, setSchedule] = useState('');

  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [sessionNo, setSessionNo] = useState('1');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [attendeeCount, setAttendeeCount] = useState('15');
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<StudyGroupItem[]>('/api/modules/study-group');
    setGroups(data);
    if (!selectedGroupId && data.length > 0) setSelectedGroupId(data[0].id);
  }

  useEffect(() => {
    void load().catch(() => {});
  }, []);

  async function handleCreateGroup(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    await apiFetch('/api/modules/study-group', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create_group',
        code,
        name,
        topic,
        mentorName: mentorName || undefined,
        schedule: schedule || undefined,
      }),
    });
    setCode('');
    setName('');
    setTopic('');
    setMsg('Kelas Study Group baru berhasil dibuat.');
    await load();
  }

  async function handleAddSession(e: FormEvent) {
    e.preventDefault();
    if (!selectedGroupId) return;
    setMsg(null);
    await apiFetch('/api/modules/study-group', {
      method: 'POST',
      body: JSON.stringify({
        action: 'add_session',
        groupId: selectedGroupId,
        sessionNo: Number(sessionNo) || 1,
        title: sessionTitle,
        sessionDate: new Date(sessionDate).toISOString(),
        attendeeCount: Number(attendeeCount) || 0,
        syncCalendar: true,
      }),
    });
    setSessionTitle('');
    setMsg('Sesi Study Group ditambahkan & masuk Kalender EISD.');
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Modul Study Group</h1>
        <p className="text-sm text-slate-500">
          Kelas belajar internal EISD, jadwal sesi pertemuan, rekap kehadiran, dan ekspor Excel/CSV.
        </p>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </div>
      )}

      {canManage && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Buat Kelas Study Group</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handleCreateGroup(e)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    required
                    placeholder="Kode (mis. SG-DATA-26) *"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    required
                    placeholder="Nama Kelas *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <input
                  required
                  placeholder="Topik utama *"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Mentor"
                    value={mentorName}
                    onChange={(e) => setMentorName(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Jadwal rutin"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Simpan Kelas
                </button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Catat Sesi Pertemuan</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handleAddSession(e)} className="space-y-3">
                <select
                  required
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code} — {g.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="number"
                    min={1}
                    required
                    placeholder="Ke-"
                    value={sessionNo}
                    onChange={(e) => setSessionNo(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    required
                    placeholder="Judul Materi *"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="datetime-local"
                    required
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Jumlah hadir"
                    value={attendeeCount}
                    onChange={(e) => setAttendeeCount(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Tambah Sesi
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((g) => (
          <Card key={g.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span>{g.name}</span>
                    <Badge variant="secondary">{g.code}</Badge>
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Topik: {g.topic} · Mentor: {g.mentorName || '-'} · Jadwal: {g.schedule || '-'}
                  </p>
                </div>
                <a
                  href={`/api/modules/study-group?exportGroupId=${g.id}&format=xlsx`}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Export Excel Rekap
                </a>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {g.sessions.length === 0 ? (
                <p className="text-xs text-slate-400">Belum ada sesi pertemuan.</p>
              ) : (
                g.sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">
                        Sesi #{s.sessionNo}: {s.title}
                      </span>
                      <span className="ml-2 text-slate-500">{s.sessionDate.slice(0, 10)}</span>
                    </div>
                    <Badge variant="secondary">{s.attendeeCount} hadir</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
