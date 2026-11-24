'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Download, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { GlassSelect } from '@/components/glass-inputs';
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
  memberships: Array<{
    id: string;
    positionTitle: string;
    division: Division;
    period: { name: string };
  }>;
}

export default function MembersPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<Member[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    nim: '',
    fullName: '',
    email: '',
    phone: '',
    divisionId: '',
    positionTitle: 'Anggota',
  });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) qs.set('search', search);
    if (status) qs.set('status', status);
    if (divisionId) qs.set('divisionId', divisionId);
    const data = await apiFetch<{
      items: Member[];
      meta: { total: number; page: number; totalPages: number };
    }>(`/api/members?${qs}`);
    setItems(data.items);
    setMeta(data.meta);
  }, [page, search, status, divisionId]);

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
          divisionId: form.divisionId || undefined,
        }),
      });
      setShowAdd(false);
      setForm({
        nim: '',
        fullName: '',
        email: '',
        phone: '',
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

  const expQs = new URLSearchParams();
  if (search) expQs.set('search', search);
  if (status) expQs.set('status', status);
  if (divisionId) expQs.set('divisionId', divisionId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Anggota EISD</h1>
          <p className="text-sm text-slate-500">
            Total {meta.total} anggota tercatat (tanpa login otomatis).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission('member.member.export') && (
            <>
              <a
                href={`/api/members/export?format=xlsx&${expQs}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
              >
                <Download className="h-3.5 w-3.5" /> XLSX
              </a>
              <a
                href={`/api/members/export?format=csv&${expQs}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </a>
            </>
          )}
          {hasPermission('member.member.import') && (
            <Link
              href="/members/import"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            >
              <Upload className="h-3.5 w-3.5" /> Import Excel
            </Link>
          )}
          {hasPermission('member.member.create') && (
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>Tambah Anggota</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleAdd(e)} className="grid gap-3 md:grid-cols-3">
              <input
                required
                placeholder="NIM *"
                value={form.nim}
                onChange={(e) => setForm({ ...form, nim: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <input
                required
                placeholder="Nama Lengkap *"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <input
                placeholder="No HP"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <GlassSelect
                value={form.divisionId}
                onChange={(v) => setForm({ ...form, divisionId: v })}
                placeholder="-- Pilih Divisi --"
                options={[
                  { value: '', label: '-- Tanpa Divisi --' },
                  ...divisions.map((d) => ({ value: d.id, label: d.name, hint: d.code })),
                ]}
              />
              <input
                placeholder="Jabatan"
                value={form.positionTitle}
                onChange={(e) => setForm({ ...form, positionTitle: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-slate-900 py-1.5 text-xs font-medium text-white md:col-span-3"
              >
                Simpan Anggota
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                placeholder="Cari NIM, nama, email..."
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 py-1.5 pl-9 pr-3 text-sm"
              />
            </div>
            <GlassSelect
              size="sm"
              className="min-w-[155px]"
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
            <GlassSelect
              size="sm"
              className="min-w-[180px]"
              value={divisionId}
              onChange={(v) => {
                setPage(1);
                setDivisionId(v);
              }}
              placeholder="Semua Divisi"
              options={[
                { value: '', label: 'Semua Divisi' },
                ...divisions.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          </div>
        </CardHeader>
        <CardContent>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">NIM</th>
                <th className="py-2 pr-3">Nama</th>
                <th className="py-2 pr-3">Divisi & Jabatan</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 pr-3 font-mono text-xs">{m.nim}</td>
                  <td className="py-2 pr-3">
                    <p className="font-medium text-slate-900">{m.fullName}</p>
                    <p className="text-xs text-slate-500">{m.email || '—'}</p>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {m.memberships.map((ms) => (
                        <Badge key={ms.id} variant="secondary">
                          {ms.division.name} · {ms.positionTitle} ({ms.period.name})
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant={m.status === 'ACTIVE' ? 'success' : 'secondary'}>
                      {m.status}
                    </Badge>
                  </td>
                  <td className="py-2 text-right">
                    {hasPermission('member.member.delete') && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(m.id)}
                        className="rounded p-1 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
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
                className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
