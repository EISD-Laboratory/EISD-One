'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  ChevronRight,
  Download,
  Layers,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { useBreadcrumb } from '@/components/app-shell';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { FieldGroup, GlassSelect } from '@/components/glass-inputs';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface Division {
  id: string;
  code: string;
  name: string;
}

interface Member {
  id: string;
  nim: string;
  fullName: string;
  email: string | null;
  status: string;
  generation: string | null;
  memberships: Array<{
    id: string;
    positionTitle: string;
    division: Division;
    period: { name: string };
  }>;
}

interface MemberFacets {
  totalAll: number;
  generations: Array<{ generation: string; count: number; activeCount: number }>;
  divisions: Array<{ id: string; code: string; name: string; count: number }>;
}

export default function MembersPage() {
  const { hasPermission } = useAuth();
  const { setExtraCrumbs } = useBreadcrumb();
  const router = useRouter();
  const [items, setItems] = useState<Member[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [facets, setFacets] = useState<MemberFacets>({
    totalAll: 0,
    generations: [],
    divisions: [],
  });
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [generation, setGeneration] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    nim: '',
    fullName: '',
    email: '',
    phone: '',
    generation: 'v7',
    divisionId: '',
    positionTitle: 'Anggota',
  });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) qs.set('search', search);
    if (status) qs.set('status', status);
    if (divisionId) qs.set('divisionId', divisionId);
    if (generation) qs.set('generation', generation);
    const data = await apiFetch<{
      items: Member[];
      meta: { total: number; page: number; totalPages: number };
      facets?: MemberFacets;
    }>(`/api/members?${qs}`);
    setItems(data.items);
    setMeta(data.meta);
    if (data.facets) setFacets(data.facets);
  }, [page, search, status, divisionId, generation]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat'));
  }, [load]);

  useEffect(() => {
    void apiFetch<Division[]>('/api/divisions')
      .then(setDivisions)
      .catch(() => undefined);
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/members', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          email: form.email || undefined,
          generation: form.generation || undefined,
          divisionId: form.divisionId || undefined,
        }),
      });
      setShowAdd(false);
      setForm({
        nim: '',
        fullName: '',
        email: '',
        phone: '',
        generation: 'v7',
        divisionId: '',
        positionTitle: 'Anggota',
      });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus anggota ini (soft delete)?')) return;
    await apiFetch(`/api/members/${id}`, { method: 'DELETE' });
    await load();
  }

  function resetSidebarFilters() {
    setGeneration('');
    setDivisionId('');
    setPage(1);
  }

  const expQs = new URLSearchParams();
  if (search) expQs.set('search', search);
  if (status) expQs.set('status', status);
  if (divisionId) expQs.set('divisionId', divisionId);
  if (generation) expQs.set('generation', generation);

  const selectedDivName = facets.divisions.find((d) => d.id === divisionId)?.name;
  const isAllSelected = !generation && !divisionId;

  useEffect(() => {
    const crumbs: Array<{ label: string; onClick?: () => void }> = [];
    if (generation) {
      crumbs.push({
        label: `Generasi ${generation}`,
        onClick: divisionId
          ? () => {
              setDivisionId('');
              setPage(1);
            }
          : undefined,
      });
    }
    if (selectedDivName) {
      crumbs.push({ label: selectedDivName });
    }
    setExtraCrumbs(crumbs);
  }, [generation, divisionId, selectedDivName, setExtraCrumbs]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col lg:flex-row">
      {/* Sidebar Filter Menempel Kiri Penuh & Memanjang ke Bawah */}
      <aside className="glass-sidebar flex w-full shrink-0 flex-col justify-between p-4 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-[272px] lg:overflow-y-auto lg:px-4 lg:py-6">
        <div className="space-y-6">
          {/* Semua Anggota */}
          <div>
            <button
              type="button"
              onClick={resetSidebarFilters}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                isAllSelected
                  ? 'bg-brand-gradient text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.5)]'
                  : 'text-slate-700 hover:bg-white/75 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Users className="h-4 w-4" />
                Semua Anggota
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  isAllSelected ? 'bg-white/20 text-white' : 'bg-white/80 text-slate-600'
                }`}
              >
                {facets.totalAll}
              </span>
            </button>
          </div>

          {/* Berdasarkan Generasi (v6, v7, dst.) */}
          <div className="space-y-2 border-t border-white/60 pt-5">
            <p className="flex items-center gap-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              <Layers className="h-3.5 w-3.5 text-emerald-600" />
              Generasi
            </p>
            {facets.generations.length === 0 ? (
              <p className="px-2.5 text-xs text-slate-400">Belum ada data generasi</p>
            ) : (
              <div className="space-y-1">
                {facets.generations.map((g) => {
                  const active = generation.toLowerCase() === g.generation.toLowerCase();
                  return (
                    <button
                      key={g.generation}
                      type="button"
                      onClick={() => {
                        setPage(1);
                        setGeneration(active ? '' : g.generation);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                        active
                          ? 'glass-tile font-semibold text-violet-900 ring-1 ring-violet-300/80'
                          : 'text-slate-700 hover:bg-white/65 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            g.activeCount > 0 ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                          title={g.activeCount > 0 ? 'Generasi aktif' : 'Alumni / nonaktif'}
                        />
                        <span>Generasi {g.generation}</span>
                        {g.activeCount > 0 && (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Aktif
                          </span>
                        )}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          active
                            ? 'bg-brand-gradient-soft text-violet-800'
                            : 'bg-white/70 text-slate-600'
                        }`}
                      >
                        {g.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Berdasarkan Divisi */}
          <div className="space-y-2 border-t border-white/60 pt-5">
            <p className="flex items-center gap-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              <Building2 className="h-3.5 w-3.5 text-violet-600" />
              Divisi
            </p>
            <div className="space-y-1">
              {facets.divisions.map((d) => {
                const active = divisionId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setPage(1);
                      setDivisionId(active ? '' : d.id);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                      active
                        ? 'glass-tile font-semibold text-violet-900 ring-1 ring-violet-300/80'
                        : 'text-slate-700 hover:bg-white/65 hover:text-slate-900'
                    }`}
                  >
                    <span className="truncate pr-2">{d.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        active
                          ? 'bg-brand-gradient-soft text-violet-800'
                          : 'bg-white/70 text-slate-600'
                      }`}
                    >
                      {d.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {!isAllSelected && (
          <div className="mt-6 border-t border-white/60 pt-4">
            <button
              type="button"
              onClick={resetSidebarFilters}
              className="glass-tile flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-violet-700 transition hover:bg-white/95"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset Filter
            </button>
          </div>
        )}
      </aside>

      {/* Area Utama Daftar Anggota */}
      <div className="min-w-0 flex-1 space-y-5 px-5 py-6 sm:px-7 lg:px-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Data Anggota EISD
              </h1>
              {generation && <Badge variant="success">Generasi {generation}</Badge>}
              {selectedDivName && <Badge variant="purple">{selectedDivName}</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Menampilkan <strong>{meta.total}</strong> anggota sesuai filter aktif.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasPermission('member.member.export') && (
              <>
                <a
                  href={`/api/members/export?format=xlsx&${expQs}`}
                  className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white/95"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" /> XLSX
                </a>
                <a
                  href={`/api/members/export?format=csv&${expQs}`}
                  className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white/95"
                >
                  <Download className="h-3.5 w-3.5 text-violet-600" /> CSV
                </a>
              </>
            )}
            {hasPermission('member.member.import') && (
              <Link
                href="/members/import"
                className="glass-tile inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-violet-800 transition hover:bg-white/95"
              >
                <Upload className="h-3.5 w-3.5 text-emerald-600" /> Import Excel
              </Link>
            )}
            {hasPermission('member.member.create') && (
              <button
                type="button"
                onClick={() => setShowAdd((v) => !v)}
                className="btn-brand inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-2.5 text-sm text-rose-700 backdrop-blur-sm">
            {error}
          </div>
        )}

        {showAdd && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Tambah Anggota Baru</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handleAdd(e)} className="grid gap-3 md:grid-cols-3">
                <FieldGroup label="NIM" required>
                  <input
                    required
                    placeholder="Contoh: 1202240101"
                    value={form.nim}
                    onChange={(e) => setForm({ ...form, nim: e.target.value })}
                    className="w-full px-3 py-2 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Nama Lengkap" required>
                  <input
                    required
                    placeholder="Nama lengkap anggota"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="w-full px-3 py-2 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Generasi">
                  <input
                    placeholder="Mis. v6, v7"
                    value={form.generation}
                    onChange={(e) => setForm({ ...form, generation: e.target.value })}
                    className="w-full px-3 py-2 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Email">
                  <input
                    type="email"
                    placeholder="email@student.edu"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="No HP">
                  <input
                    placeholder="08xxxxxxxxxx"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Divisi">
                  <GlassSelect
                    value={form.divisionId}
                    onChange={(v) => setForm({ ...form, divisionId: v })}
                    placeholder="-- Pilih Divisi --"
                    options={[
                      { value: '', label: '-- Tanpa Divisi --' },
                      ...divisions.map((d) => ({ value: d.id, label: d.name, hint: d.code })),
                    ]}
                  />
                </FieldGroup>
                <FieldGroup label="Jabatan" className="md:col-span-2">
                  <input
                    placeholder="Anggota / Staf / Kadiv"
                    value={form.positionTitle}
                    onChange={(e) => setForm({ ...form, positionTitle: e.target.value })}
                    className="w-full px-3 py-2 text-sm"
                  />
                </FieldGroup>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="btn-brand w-full rounded-xl py-2 text-xs font-semibold"
                  >
                    Simpan Anggota
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-violet-500" />
                <input
                  placeholder="Cari NIM, nama, email, generasi..."
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                  className="w-full py-2 pr-3 pl-10 text-sm"
                />
              </div>
              <GlassSelect
                size="sm"
                className="min-w-[160px]"
                value={status}
                onChange={(v) => {
                  setPage(1);
                  setStatus(v);
                }}
                placeholder="Semua Status"
                options={[
                  { value: '', label: 'Semua Status' },
                  { value: 'ACTIVE', label: 'ACTIVE' },
                  { value: 'LEAVE', label: 'LEAVE' },
                  { value: 'ALUMNI', label: 'ALUMNI' },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/70 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2.5 pr-3">NIM</th>
                  <th className="py-2.5 pr-3">Nama</th>
                  <th className="py-2.5 pr-3">Generasi</th>
                  <th className="py-2.5 pr-3">Divisi & Jabatan</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                      Tidak ada anggota yang cocok dengan filter saat ini.
                    </td>
                  </tr>
                ) : (
                  items.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => router.push(`/members/${m.id}`)}
                      className="group cursor-pointer"
                    >
                      <td className="py-2.5 pr-3 font-mono text-xs text-slate-600">{m.nim}</td>
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-slate-900 group-hover:text-violet-700">
                          {m.fullName}
                        </p>
                        <p className="text-xs text-slate-500">{m.email || '—'}</p>
                      </td>
                      <td className="py-2.5 pr-3">
                        {m.generation ? (
                          <Badge variant={m.generation === 'v7' ? 'success' : 'purple'}>
                            {m.generation}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {m.memberships.map((ms) => (
                            <Badge key={ms.id} variant="secondary">
                              {ms.division.name} · {ms.positionTitle} ({ms.period.name})
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={m.status === 'ACTIVE' ? 'success' : 'secondary'}>
                          ● {m.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {hasPermission('member.member.delete') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDelete(m.id);
                              }}
                              className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                              title="Hapus anggota"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>
                Halaman {meta.page} / {meta.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="glass-tile rounded-xl px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="glass-tile rounded-xl px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
