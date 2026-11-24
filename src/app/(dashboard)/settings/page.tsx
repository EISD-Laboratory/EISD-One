'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface SettingRow {
  key: string;
  value: unknown;
  description: string | null;
}

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState<SettingRow[]>([]);

  const load = useCallback(async () => {
    setRows(await apiFetch<SettingRow[]>('/api/settings'));
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  async function toggle(row: SettingRow) {
    await apiFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: row.key, value: !row.value }),
    });
    await load();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Pengaturan Sistem</h1>
      <Card>
        <CardHeader>
          <CardTitle>Konfigurasi & Feature Flags</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center justify-between py-2.5">
              <div>
                <p className="font-mono text-xs font-semibold">{r.key}</p>
                <p className="text-xs text-slate-500">{r.description}</p>
              </div>
              {typeof r.value === 'boolean' ? (
                <button
                  type="button"
                  disabled={!hasPermission('settings.system.manage')}
                  onClick={() => void toggle(r)}
                  className={`rounded-full px-3 py-0.5 text-xs font-semibold ${r.value ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                >
                  {r.value ? 'ENABLED' : 'DISABLED'}
                </button>
              ) : (
                <Badge variant="secondary">{String(r.value)}</Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
