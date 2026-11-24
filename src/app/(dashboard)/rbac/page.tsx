'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-context';
import { apiFetch } from '@/components/client-api';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface Role {
  id: string;
  code: string;
  name: string;
  scope: string;
  userCount: number;
  permissions: string[];
}
interface Perm {
  code: string;
  module: string;
  description: string | null;
}
interface UserItem {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: Array<{ id: string; name: string }>;
}

export default function RbacPage() {
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [draft, setDraft] = useState<string[]>([]);
  const [newUser, setNewUser] = useState({ email: '', fullName: '', password: '', roleId: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rData, uData] = await Promise.all([
      apiFetch<{ roles: Role[]; permissions: Perm[] }>('/api/rbac/roles'),
      hasPermission('rbac.user.read')
        ? apiFetch<UserItem[]>('/api/rbac/users')
        : Promise.resolve([]),
    ]);
    setRoles(rData.roles);
    setPerms(rData.permissions);
    setUsers(uData);
    if (!selectedRoleId && rData.roles.length > 0) {
      setSelectedRoleId(rData.roles[0].id);
      setDraft(rData.roles[0].permissions);
    }
  }, [hasPermission, selectedRoleId]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  async function savePerms() {
    await apiFetch('/api/rbac/roles', {
      method: 'PUT',
      body: JSON.stringify({ roleId: selectedRoleId, permissionCodes: draft }),
    });
    setMsg('Permission role diperbarui & dicatat di Audit Log.');
    await load();
  }

  async function addUser(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/rbac/users', {
      method: 'POST',
      body: JSON.stringify({ ...newUser, roleId: newUser.roleId || undefined }),
    });
    setNewUser({ email: '', fullName: '', password: '', roleId: '' });
    setMsg('Akun pengurus baru dibuat.');
    await load();
  }

  async function toggleActive(u: UserItem) {
    await apiFetch('/api/rbac/users', {
      method: 'PATCH',
      body: JSON.stringify({ userId: u.id, isActive: !u.isActive }),
    });
    await load();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">RBAC & Akun Login</h1>
      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Role ({roles.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedRoleId(r.id);
                  setDraft(r.permissions);
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${r.id === selectedRoleId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs opacity-75">
                  {r.scope} · {r.permissions.length} izin
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Matriks Permission</CardTitle>
              {hasPermission('rbac.role.manage') && (
                <button
                  type="button"
                  onClick={() => void savePerms()}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Simpan
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {perms.map((p) => (
              <label
                key={p.code}
                className="flex items-start gap-2 rounded border border-slate-100 p-2 text-xs"
              >
                <input
                  type="checkbox"
                  disabled={!hasPermission('rbac.role.manage')}
                  checked={draft.includes(p.code)}
                  onChange={() =>
                    setDraft((prev) =>
                      prev.includes(p.code) ? prev.filter((x) => x !== p.code) : [...prev, p.code],
                    )
                  }
                />
                <span>
                  <strong className="font-mono">{p.code}</strong>
                  <span className="block text-slate-500">{p.description}</span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>
      </div>

      {hasPermission('rbac.user.read') && (
        <Card>
          <CardHeader>
            <CardTitle>Akun Pengurus ({users.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasPermission('rbac.user.manage') && (
              <form onSubmit={(e) => void addUser(e)} className="grid gap-2 sm:grid-cols-4">
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  required
                  placeholder="Nama"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Password (min 8)"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <select
                  value={newUser.roleId}
                  onChange={(e) => setNewUser({ ...newUser, roleId: e.target.value })}
                  className="rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                >
                  <option value="">-- Role --</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded bg-slate-900 py-1.5 text-xs font-medium text-white sm:col-span-4"
                >
                  Tambah Akun Login
                </button>
              </form>
            )}
            <div className="divide-y divide-slate-100 text-sm">
              {users.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">
                      {u.fullName} <span className="text-xs text-slate-500">({u.email})</span>
                    </p>
                    <div className="mt-0.5 flex gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r.id} variant="secondary">
                          {r.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={u.isActive ? 'success' : 'danger'}>
                      {u.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                    {hasPermission('rbac.user.manage') && (
                      <button
                        type="button"
                        onClick={() => void toggleActive(u)}
                        className="rounded border border-slate-300 px-2.5 py-1 text-xs"
                      >
                        {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
