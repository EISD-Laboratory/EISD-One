'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/components/client-api';
import { GlassSelect } from '@/components/glass-inputs';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface FieldDraft {
  label: string;
  key: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  optionsText: string;
}

interface CustomModItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  fieldsJson: Array<{ key: string; label: string; type: string; required?: boolean }>;
  division: { id: string; isEnabled: boolean };
  _count: { records: number };
}

export default function CustomModulesBuilderPage() {
  const [modules, setModules] = useState<CustomModItem[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FieldDraft[]>([
    {
      label: 'Kategori',
      key: 'kategori',
      type: 'select',
      required: true,
      optionsText: 'Umum, Prioritas',
    },
    { label: 'Penanggung Jawab', key: 'pic', type: 'text', required: false, optionsText: '' },
  ]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setModules(await apiFetch<CustomModItem[]>('/api/custom-modules'));
  }

  useEffect(() => {
    void load().catch(() => {});
  }, []);

  function addField() {
    setFields((prev) => [
      ...prev,
      { label: '', key: '', type: 'text', required: false, optionsText: '' },
    ]);
  }

  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateField(idx: number, patch: Partial<FieldDraft>) {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      const payload = {
        name,
        code: code || name,
        description: description || undefined,
        fields: fields.map((f) => ({
          label: f.label,
          key: f.key || f.label,
          type: f.type,
          required: f.required,
          options:
            f.type === 'select'
              ? f.optionsText
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : undefined,
        })),
      };
      const created = await apiFetch<CustomModItem>('/api/custom-modules', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setName('');
      setCode('');
      setDescription('');
      setMsg(`Custom Module "${created.name}" berhasil dibuat & langsung muncul di Sidebar!`);
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Gagal membuat Custom Module.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Custom Module Builder</h1>
        <p className="text-sm text-slate-500">
          Khusus Administrator — buat modul/divisi baru beserta kolom dinamis tanpa menulis kode.
        </p>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Buat Modul Custom Baru</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <input
                required
                placeholder="Nama Modul (mis. Inventaris Buku) *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                required
                placeholder="Kode URL (mis. inventaris-buku) *"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Deskripsi singkat"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Definisi Kolom / Field
                </p>
                <button
                  type="button"
                  onClick={addField}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-100"
                >
                  + Tambah Field
                </button>
              </div>
              {fields.map((f, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-5"
                >
                  <input
                    required
                    placeholder="Label Field *"
                    value={f.label}
                    onChange={(e) => updateField(idx, { label: e.target.value })}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <input
                    placeholder="Key (opsional)"
                    value={f.key}
                    onChange={(e) => updateField(idx, { key: e.target.value })}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <GlassSelect
                    size="sm"
                    value={f.type}
                    onChange={(v) => updateField(idx, { type: v as FieldDraft['type'] })}
                    options={[
                      { value: 'text', label: 'Teks Singkat' },
                      { value: 'number', label: 'Angka' },
                      { value: 'date', label: 'Tanggal' },
                      { value: 'select', label: 'Dropdown Pilihan' },
                      { value: 'textarea', label: 'Catatan Panjang' },
                    ]}
                  />
                  {f.type === 'select' ? (
                    <input
                      required
                      placeholder="Opsi (pisah koma)"
                      value={f.optionsText}
                      onChange={(e) => updateField(idx, { optionsText: e.target.value })}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                    />
                  ) : (
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => updateField(idx, { required: e.target.checked })}
                      />
                      Wajib diisi
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={fields.length <= 1}
                    onClick={() => removeField(idx)}
                    className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                  >
                    Hapus
                  </button>
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Terbitkan Custom Module
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Custom Module ({modules.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {modules.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada Custom Module dibuat.</p>
          ) : (
            modules.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{m.name}</span>
                    <Badge variant="secondary">/{m.code}</Badge>
                    <Badge variant={m.division.isEnabled ? 'success' : 'danger'}>
                      {m.division.isEnabled ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {m.fieldsJson.length} kolom · {m._count.records} data tersimpan
                    {m.description ? ` · ${m.description}` : ''}
                  </p>
                </div>
                <Link
                  href={`/custom/${m.code}`}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Buka Modul →
                </Link>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
