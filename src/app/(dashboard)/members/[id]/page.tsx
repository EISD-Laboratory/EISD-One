'use client';

import { use, useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  Briefcase,
  Cake,
  CalendarDays,
  Check,
  Edit3,
  GraduationCap,
  Hash,
  Mail,
  Phone,
  Sparkles,
  StickyNote,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { FieldGroup, GlassSelect } from '@/components/glass-inputs';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface MemberDetail {
  id: string;
  nim: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  status: 'ACTIVE' | 'LEAVE' | 'ALUMNI';
  generation: string | null;
  batchYear: number | null;
  notes: string | null;
  createdAt: string;
  memberships: Array<{
    id: string;
    positionTitle: string;
    isHead: boolean;
    division: { id: string; code: string; name: string };
    period: { id: string; name: string; isActive: boolean };
  }>;
  kpiResults: Array<{
    id: string;
    year: number;
    month: number;
    finalScore: number;
    framework: { name: string; version: number };
  }>;
  eventActivities?: Array<{
    id: string;
    role: 'COMMITTEE' | 'ATTENDEE';
    position: string | null;
    attended: boolean;
    event: { id: string; title: string; startAt: string; status: string };
  }>;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('member.member.update');

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    birthDate: '',
    status: 'ACTIVE' as MemberDetail['status'],
    generation: '',
    batchYear: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setError(null);
    const data = await apiFetch<MemberDetail>(`/api/members/${id}`);
    setMember(data);
    setForm({
      fullName: data.fullName,
      email: data.email ?? '',
      phone: data.phone ?? '',
      birthDate: data.birthDate ? data.birthDate.slice(0, 10) : '',
      status: data.status,
      generation: data.generation ?? '',
      batchYear: data.batchYear ? String(data.batchYear) : '',
      notes: data.notes ?? '',
    });
  }, [id]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat profil.'));
  }, [load]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/members/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email || null,
          phone: form.phone || null,
          birthDate: form.birthDate || null,
          status: form.status,
          generation: form.generation || null,
          batchYear: form.batchYear ? Number(form.batchYear) : null,
          notes: form.notes || null,
        }),
      });
      setEditing(false);
      setMsg('Data diri anggota berhasil diperbarui.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui data.');
    } finally {
      setSaving(false);
    }
  }

  if (error && !member) {
    return (
      <div className="space-y-4">
        <Link
          href="/members"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Data Anggota
        </Link>
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 p-4 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!member) {
    return <p className="text-sm text-slate-500">Memuat profil anggota...</p>;
  }

  const activeMembership =
    member.memberships.find((m) => m.period.isActive) ?? member.memberships[0];

  return (
    <div className="space-y-6">
      {/* Bar Navigasi Kembali & Aksi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/members"
          className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-violet-800 transition hover:bg-white/95"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Data Anggota
        </Link>
        {canUpdate && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn-brand inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
          >
            <Edit3 className="h-3.5 w-3.5" /> Edit Data Diri
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-2.5 text-sm text-emerald-800">
          {msg}
        </div>
      )}

      {/* Hero Header Profil Anggota */}
      <Card className="aurora-card-blend overflow-hidden">
        <div className="h-2 w-full bg-brand-gradient" />
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-2xl font-bold text-white shadow-[0_12px_28px_-8px_rgba(124,58,237,0.5)]">
              {getInitials(member.fullName)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {member.fullName}
                </h1>
                <Badge variant={member.status === 'ACTIVE' ? 'success' : 'secondary'}>
                  ● {member.status}
                </Badge>
                {member.generation && (
                  <Badge variant={member.generation === 'v7' ? 'success' : 'purple'}>
                    Generasi {member.generation}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {activeMembership ? (
                  <>
                    <strong>{activeMembership.positionTitle}</strong> · Divisi{' '}
                    <strong className="text-violet-800">{activeMembership.division.name}</strong> (
                    {activeMembership.period.name})
                  </>
                ) : (
                  'Belum tergabung pada divisi periode aktif'
                )}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">NIM: {member.nim}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {member.email && (
              <a
                href={`mailto:${member.email}`}
                className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-white/95 hover:text-violet-700"
              >
                <Mail className="h-3.5 w-3.5 text-violet-600" /> Email
              </a>
            )}
            {member.phone && (
              <a
                href={`tel:${member.phone}`}
                className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-white/95 hover:text-emerald-700"
              >
                <Phone className="h-3.5 w-3.5 text-emerald-600" /> Hubungi
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Kiri: Data Diri Lengkap / Form Edit */}
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-white/60 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Data Diri Anggota
            </CardTitle>
            {editing && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-white/70 hover:text-slate-800"
              >
                <X className="h-3.5 w-3.5" /> Batal
              </button>
            )}
          </CardHeader>
          <CardContent className="pt-5">
            {editing ? (
              <form onSubmit={(e) => void handleSave(e)} className="grid gap-4 sm:grid-cols-2">
                <FieldGroup label="Nama Lengkap" required className="sm:col-span-2">
                  <input
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="No HP / WhatsApp">
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Tanggal Lahir">
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Status Keanggotaan">
                  <GlassSelect
                    value={form.status}
                    onChange={(v) => setForm({ ...form, status: v as MemberDetail['status'] })}
                    options={[
                      { value: 'ACTIVE', label: 'ACTIVE (Aktif)' },
                      { value: 'LEAVE', label: 'LEAVE (Cuti)' },
                      { value: 'ALUMNI', label: 'ALUMNI' },
                    ]}
                  />
                </FieldGroup>
                <FieldGroup label="Generasi Lab">
                  <input
                    placeholder="Mis. v6, v7"
                    value={form.generation}
                    onChange={(e) => setForm({ ...form, generation: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Tahun Angkatan Kuliah">
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    placeholder="Mis. 2023"
                    value={form.batchYear}
                    onChange={(e) => setForm({ ...form, batchYear: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Catatan" className="sm:col-span-2">
                  <textarea
                    rows={3}
                    placeholder="Keahlian, minat riset, atau catatan tambahan..."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm"
                  />
                </FieldGroup>
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="glass-tile rounded-xl px-4 py-2 text-xs font-semibold text-slate-700"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-brand inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {[
                  { icon: Hash, label: 'NIM', value: member.nim, mono: true },
                  { icon: Mail, label: 'Email', value: member.email || 'Belum diisi' },
                  { icon: Phone, label: 'No HP / WhatsApp', value: member.phone || 'Belum diisi' },
                  {
                    icon: Cake,
                    label: 'Tanggal Lahir',
                    value: member.birthDate
                      ? new Date(member.birthDate).toLocaleDateString('id-ID', {
                          dateStyle: 'long',
                          timeZone: 'Asia/Jakarta',
                        })
                      : 'Belum diisi',
                  },
                  {
                    icon: Sparkles,
                    label: 'Generasi EISD',
                    value: member.generation ? `Generasi ${member.generation}` : 'Belum diisi',
                  },
                  {
                    icon: GraduationCap,
                    label: 'Angkatan Kuliah',
                    value: member.batchYear ? String(member.batchYear) : 'Belum diisi',
                  },
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label} className="glass-tile rounded-xl p-3.5">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <Icon className="h-3.5 w-3.5 text-violet-600" />
                        {row.label}
                      </p>
                      <p
                        className={`mt-1 text-sm font-semibold text-slate-900 ${row.mono ? 'font-mono' : ''}`}
                      >
                        {row.value}
                      </p>
                    </div>
                  );
                })}

                <div className="glass-tile rounded-xl p-3.5 sm:col-span-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <StickyNote className="h-3.5 w-3.5 text-emerald-600" />
                    Catatan
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {member.notes || 'Tidak ada catatan tambahan.'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Kanan: Riwayat Divisi, KPI, & Kegiatan */}
        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardHeader className="border-b border-white/60 pb-3.5">
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-emerald-600" />
                Riwayat Divisi & Jabatan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-4">
              {member.memberships.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada riwayat keanggotaan divisi.</p>
              ) : (
                member.memberships.map((ms) => (
                  <div
                    key={ms.id}
                    className="glass-tile flex items-center justify-between gap-2 rounded-xl p-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {ms.division.name} — {ms.positionTitle}
                      </p>
                      <p className="mt-0.5 text-slate-500">Periode {ms.period.name}</p>
                    </div>
                    <div className="flex gap-1">
                      {ms.isHead && <Badge variant="default">Kadiv</Badge>}
                      {ms.period.isActive && <Badge variant="success">Aktif</Badge>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-white/60 pb-3.5">
              <CardTitle className="flex items-center gap-2">
                <Award className="h-4 w-4 text-violet-600" />
                Riwayat Skor KPI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              {member.kpiResults.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada hasil perhitungan KPI.</p>
              ) : (
                member.kpiResults.map((k) => (
                  <div
                    key={k.id}
                    className="glass-tile flex items-center justify-between rounded-xl px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {k.year}-{String(k.month).padStart(2, '0')}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {k.framework.name} (v{k.framework.version})
                      </p>
                    </div>
                    <Badge variant="success">{k.finalScore.toFixed(2)}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {member.eventActivities && member.eventActivities.length > 0 && (
            <Card>
              <CardHeader className="border-b border-white/60 pb-3.5">
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-emerald-600" />
                  Keterlibatan Event
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {member.eventActivities.map((ev) => (
                  <div
                    key={ev.id}
                    className="glass-tile flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{ev.event.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {new Date(ev.event.startAt).toLocaleDateString('id-ID', {
                          dateStyle: 'medium',
                          timeZone: 'Asia/Jakarta',
                        })}
                      </p>
                    </div>
                    <Badge variant="purple">
                      {ev.role === 'COMMITTEE' ? ev.position || 'Panitia' : 'Peserta'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
