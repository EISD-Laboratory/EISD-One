import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth-context';

export default function AppsLauncherLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
