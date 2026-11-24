'use client';

import { use, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { GlassConfirmDialog, GlassSelect } from '@/components/glass-inputs';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required?: boolean;
  options?: string[];
}

interface CustomModuleDetail {
  id: string;
  code: string;
  name: string;
  description: string | null;
  fieldsJson: CustomField[];
  division: { isEnabled: boolean };
  records: Array<{
    id: string;
    title: string;
    dataJson: Record<string, string | number | null>;
    createdAt: string;
  }>;
}

export default function CustomModuleRuntimePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { hasPermission } = useAuth();
  const canManage = hasPermission('custom_module.record.manage');

  const [mod, setMod] = useState<CustomModuleDetail | null>(null);
  const [title, setTitle] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setErr(null);
    const data = await apiFetch<CustomModuleDetail>(`/api/custom-modules/${code}`);
    setMod(data);
  }

  useEffect(() => {
    void load().catch((e) => setErr(e instanceof Error ? e.message : 'Gagal memuat modul.'));
  }, [code]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await apiFetch(`/api/custom-modules/${code}`, {
        method: 'POST',
        body: JSON.stringify({ title, data: values }),
      });
      setTitle('');
      setValues({});
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Gagal menyimpan data.');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/custom-modules/${code}?id=${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }

  if (err && !mod) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {err}
      </div>
    );
  }
  if (!mod) return <p className="text-sm text-slate-500">Memuat modul...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{mod.name}</h1>
            <Badge variant="secondary">Custom Module</Badge>
          </div>
          {mod.description && <p className="text-sm text-slate-500">{mod.description}</p>}
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/custom-modules/${code}?export=xlsx`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Export Excel
          </a>
          <a
            href={`/api/custom-modules/${code}?export=csv`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Export CSV
          </a>
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Tambah Data {mod.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="grid gap-3 md:grid-cols-3">
              <input
                required
                placeholder="Judul / Nama Item *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3"
              />
              {mod.fieldsJson.map((f) => {
                const v = values[f.key] ?? '';
                const onChange = (val: string) => setValues((prev) => ({ ...prev, [f.key]: val }));
                if (f.type === 'select') {
                  return (
                    <GlassSelect
                      key={f.key}
                      value={v}
                      onChange={onChange}
                      placeholder={`-- ${f.label}${f.required ? ' *' : ''} --`}
                      options={(f.options ?? []).map((opt) => ({ value: opt, label: opt }))}
                    />
                  );
                }
                if (f.type === 'textarea') {
                  return (
                    <textarea
                      key={f.key}
                      required={f.required}
                      placeholder={`${f.label}${f.required ? ' *' : ''}`}
                      value={v}
                      onChange={(e) => onChange(e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3"
                      rows={2}
                    />
                  );
                }
                return (
                  <input
                    key={f.key}
                    type={f.type}
                    required={f.required}
                    placeholder={`${f.label}${f.required ? ' *' : ''}`}
                    value={v}
                    onChange={(e) => onChange(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                );
              })}
              <div className="md:col-span-3">
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daftar Data ({mod.records.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2 pr-4">Judul</th>
                {mod.fieldsJson.map((f) => (
                  <th key={f.key} className="py-2 pr-4">
                    {f.label}
                  </th>
                ))}
                {canManage && <th className="py-2 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {mod.records.map((rec) => (
                <tr key={rec.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-900">{rec.title}</td>
                  {mod.fieldsJson.map((f) => (
                    <td key={f.key} className="py-2 pr-4 text-slate-600">
                      {String(rec.dataJson?.[f.key] ?? '-')}
                    </td>
                  ))}
                  {canManage && (
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: rec.id, title: rec.title })}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Hapus
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <GlassConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Hapus Data ${mod.name}?`}
        itemLabel={deleteTarget?.title}
        description="Data yang dihapus akan dipindahkan ke arsip (soft delete) dan tercatat di Audit Log."
        confirmLabel="Ya, Hapus Data"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
