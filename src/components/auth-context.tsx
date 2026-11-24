'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from './client-api';

export interface ClientUser {
  id: string;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
  roles: Array<{
    id: string;
    code: string;
    name: string;
    scope: string;
    divisionId: string | null;
  }>;
  permissions: string[];
}

interface AuthCtx {
  user: ClientUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiFetch<{ user: ClientUser }>('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    router.push('/login');
  }, [router]);

  const logoutAll = useCallback(async () => {
    await apiFetch('/api/auth/logout-all', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    router.push('/login');
  }, [router]);

  const hasPermission = useCallback(
    (code: string) => Boolean(user && (user.isSuperAdmin || user.permissions.includes(code))),
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, logout, logoutAll, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus di dalam AuthProvider');
  return ctx;
}
