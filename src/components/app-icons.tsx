import type { ReactNode } from 'react';

export type AppIconKey =
  | 'dashboard'
  | 'members'
  | 'import'
  | 'kpi'
  | 'calendar'
  | 'core'
  | 'administration'
  | 'event'
  | 'praktikum'
  | 'enabler'
  | 'media'
  | 'competition'
  | 'research'
  | 'study-group'
  | 'periods'
  | 'custom-modules'
  | 'rbac'
  | 'audit-logs'
  | 'settings'
  | 'custom-item';

/**
 * Ikon vektor multi-warna bergaya Odoo App Launcher untuk setiap modul EISD One.
 * Setiap modul memiliki bentuk & paduan warna berbeda agar mudah dikenali sekilas.
 */
export function AppModuleIcon({ iconKey, index = 0 }: { iconKey: AppIconKey; index?: number }) {
  const icons: Record<AppIconKey, ReactNode> = {
    dashboard: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <rect x="7" y="7" width="15" height="15" rx="4" fill="#8B5CF6" />
        <rect x="26" y="7" width="15" height="9" rx="3.5" fill="#F472B6" />
        <rect x="26" y="20" width="15" height="10" rx="3.5" fill="#34D399" />
        <rect x="7" y="26" width="15" height="15" rx="4" fill="#38BDF8" />
        <rect x="26" y="34" width="6.5" height="7" rx="2.5" fill="#10B981" />
        <rect x="34.5" y="34" width="6.5" height="7" rx="2.5" fill="#A78BFA" />
      </svg>
    ),
    members: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <rect x="8" y="8" width="32" height="32" rx="8" fill="#10B981" />
        <path
          d="M36 12v24a4 4 0 0 1-4 4H14"
          stroke="#FB7185"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="24" cy="19" r="5" fill="#FFFFFF" />
        <path d="M15.5 33.5c1.4-4.2 4.7-6.5 8.5-6.5s7.1 2.3 8.5 6.5" fill="#FFFFFF" />
      </svg>
    ),
    import: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <rect x="8" y="9" width="32" height="30" rx="7" fill="#059669" />
        <rect x="12" y="14" width="24" height="5" rx="2" fill="#A7F3D0" />
        <rect x="12" y="22" width="10" height="5" rx="2" fill="#FFFFFF" fillOpacity="0.9" />
        <rect x="25" y="22" width="11" height="5" rx="2" fill="#6EE7B7" />
        <rect x="12" y="30" width="10" height="5" rx="2" fill="#6EE7B7" />
        <circle cx="33" cy="33" r="8" fill="#7C3AED" />
        <path
          d="M33 36.5v-7m0 0-2.8 2.8M33 29.5l2.8 2.8"
          stroke="#FFFFFF"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    kpi: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <rect x="9" y="25" width="8" height="15" rx="3" fill="#8B5CF6" />
        <rect x="20" y="17" width="8" height="23" rx="3" fill="#EC4899" />
        <rect x="31" y="9" width="8" height="31" rx="3" fill="#F59E0B" />
        <path d="M11 19 22 12l13-4" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
        <circle cx="35" cy="8" r="3" fill="#10B981" />
      </svg>
    ),
    calendar: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <rect x="7" y="9" width="34" height="32" rx="8" fill="#1E1B4B" fillOpacity="0.08" />
        <path
          d="M12 19c1.5-2.5 5-3.5 7.8-1.8 2.3 1.4 2.1 4.8-.6 6.1 3 1.1 3.5 5.2.9 7.3-2.5 2-6.8 1.5-8.6-1.1"
          stroke="#8B5CF6"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M29 19l4.5-3.2V33"
          stroke="#10B981"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    core: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <circle cx="17" cy="17" r="6" fill="#F59E0B" />
        <circle cx="31" cy="31" r="6" fill="#10B981" />
        <path d="M33 15 15 33" stroke="#7C3AED" strokeWidth="5" strokeLinecap="round" />
      </svg>
    ),
    administration: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <path
          d="M8 14a4 4 0 0 1 4-4h9l3.5 4H36a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V14Z"
          fill="#6366F1"
        />
        <rect x="13" y="18" width="22" height="16" rx="3" fill="#FFFFFF" fillOpacity="0.92" />
        <path d="M17 23h14M17 28h9" stroke="#7C3AED" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="34" cy="33" r="6.5" fill="#10B981" />
        <path
          d="m31.4 33 1.8 1.8 3.4-3.6"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    event: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <path
          d="M11 21a4 4 0 0 1 4-4h6l13-6.5A2 2 0 0 1 37 12.3v23.4a2 2 0 0 1-3 1.8L21 31h-6a4 4 0 0 1-4-4v-6Z"
          fill="#F97316"
        />
        <path d="M21 17l13-6.5A2 2 0 0 1 37 12.3v23.4a2 2 0 0 1-3 1.8L21 31V17Z" fill="#8B5CF6" />
        <path d="M15 31l2.5 8h4.5l-2-8h-5Z" fill="#10B981" />
      </svg>
    ),
    praktikum: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <path d="M8 14c0-2.2 1.8-4 4-4h10v28H12a4 4 0 0 1-4-4V14Z" fill="#0EA5E9" />
        <path d="M26 10h10a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H26V10Z" fill="#10B981" />
        <rect x="22" y="10" width="4" height="28" fill="#7C3AED" />
        <path
          d="M13 18h5M13 24h5M30 18h5M30 24h5"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    enabler: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        {/* Lengan kiri (hijau emerald) */}
        <path
          d="M6 21.5 12.5 15l5 5-6.5 6.5a2 2 0 0 1-2.8 0L6 24.3a2 2 0 0 1 0-2.8Z"
          fill="#10B981"
        />
        {/* Lengan kanan (ungu violet) */}
        <path
          d="M42 21.5 35.5 15l-5 5 6.5 6.5a2 2 0 0 0 2.8 0l2.2-2.2a2 2 0 0 0 0-2.8Z"
          fill="#7C3AED"
        />
        {/* Telapak & genggaman tangan berjabat (emas & ungu muda) */}
        <path
          d="M15.5 18.5h5.2c1.2 0 2.3.5 3.1 1.3l1.2 1.2 4.6-4.1c1.3-1.1 3.2-1 4.4.2l.8.8-8.2 8.2-4.6-2.3-4.8 4.4-4.7-4.7 3-5Z"
          fill="#F59E0B"
        />
        <path
          d="M16.2 28.4 22.8 35a2.6 2.6 0 0 0 3.7 0l7.6-7.6-5.2-5.2-3.9 3.6a3 3 0 0 1-4.1-.1l-.6-.6-4.1 3.3Z"
          fill="#A78BFA"
        />
        {/* Detail jari saling menggenggam */}
        <path
          d="m23.5 31.8 2.6 2.6m1.8-5.1 2.5 2.5m1.8-5 2.2 2.2"
          stroke="#FFFFFF"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    ),
    media: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <path
          d="M24 8c-8.8 0-16 6.8-16 15.2 0 7.6 5.9 13.8 13.4 13.8h2.2c1.8 0 3.2-1.4 3.2-3.2 0-.8-.3-1.6-.8-2.2-.5-.6-.8-1.3-.8-2.1 0-1.7 1.4-3.1 3.1-3.1H32c4.4 0 8-3.5 8-7.8C40 12.7 32.8 8 24 8Z"
          fill="#EC4899"
        />
        <circle cx="17" cy="21" r="2.8" fill="#FDE047" />
        <circle cx="23" cy="15.5" r="2.8" fill="#34D399" />
        <circle cx="31" cy="18" r="2.8" fill="#38BDF8" />
        <circle cx="16.5" cy="28.5" r="2.5" fill="#FFFFFF" />
      </svg>
    ),
    competition: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <path d="M14 10h20v10c0 5.5-4.5 10-10 10s-10-4.5-10-10V10Z" fill="#F59E0B" />
        <path
          d="M14 13H9.5c0 4.5 2 7.5 4.5 8M34 13h4.5c0 4.5-2 7.5-4.5 8"
          stroke="#8B5CF6"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <rect x="21" y="29" width="6" height="6" fill="#D97706" />
        <rect x="15" y="35" width="18" height="4.5" rx="2.2" fill="#7C3AED" />
        <circle cx="24" cy="19" r="3.2" fill="#FEF3C7" />
      </svg>
    ),
    research: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <path
          d="M19 9h10M21 9v9.5l-9.2 15.8A3.5 3.5 0 0 0 14.8 39h18.4a3.5 3.5 0 0 0 3-4.7L27 18.5V9"
          stroke="#7C3AED"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15.2 28h17.6l3.2 5.7A2.6 2.6 0 0 1 33.7 37H14.3a2.6 2.6 0 0 1-2.3-3.3L15.2 28Z"
          fill="#10B981"
        />
        <circle cx="22" cy="32" r="2" fill="#D1FAE5" />
        <circle cx="28" cy="30.5" r="1.5" fill="#A7F3D0" />
      </svg>
    ),
    'study-group': (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <path d="M24 11 7 19l17 8 17-8-17-8Z" fill="#7C3AED" />
        <path d="M14 23v8.5c0 2.8 4.5 5 10 5s10-2.2 10-5V23l-10 4.8L14 23Z" fill="#10B981" />
        <path d="M39 20.5V30" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
        <circle cx="39" cy="31.5" r="2.2" fill="#F59E0B" />
      </svg>
    ),
    periods: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <path d="M22.5 9A14.5 14.5 0 0 0 9 22.5h13.5V9Z" fill="#10B981" />
        <path d="M25.5 9v13.5H39A14.5 14.5 0 0 0 25.5 9Z" fill="#8B5CF6" />
        <path d="M9 25.5A14.5 14.5 0 0 0 22.5 39V25.5H9Z" fill="#F43F5E" />
        <path d="M25.5 25.5V39A14.5 14.5 0 0 0 39 25.5H25.5Z" fill="#38BDF8" />
      </svg>
    ),
    'custom-modules': (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <path d="M24 8 38 15.5 24 23 10 15.5 24 8Z" fill="#34D399" />
        <path d="M10 15.5 24 23v16.5L10 32V15.5Z" fill="#7C3AED" />
        <path d="M38 15.5 24 23v16.5L38 32V15.5Z" fill="#F59E0B" />
      </svg>
    ),
    rbac: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <path d="M24 8 38 13v11c0 9-6 14.8-14 17-8-2.2-14-8-14-17V13l14-5Z" fill="#7C3AED" />
        <path d="M24 8 38 13v11c0 9-6 14.8-14 17V8Z" fill="#10B981" fillOpacity="0.88" />
        <circle cx="24" cy="22" r="3.6" fill="#FFFFFF" />
        <path d="M24 25.5V31" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
    'audit-logs': (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <rect x="10" y="8" width="28" height="32" rx="6" fill="#6366F1" />
        <path
          d="M16 17h16M16 24h16M16 31h9"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="34" cy="33" r="7" fill="#10B981" />
        <path
          d="m31.2 33 2 2 3.8-4"
          stroke="#FFFFFF"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    settings: (
      <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
        <path d="M24 8 37.8 16v16L24 40 10.2 32V16L24 8Z" fill="#F97316" />
        <path d="M24 8 37.8 16v16L24 24V8Z" fill="#F59E0B" />
        <path d="M24 24 37.8 32 24 40 10.2 32 24 24Z" fill="#7C3AED" />
        <circle cx="24" cy="24" r="6" fill="#FFFFFF" />
        <circle cx="24" cy="24" r="2.8" fill="#10B981" />
      </svg>
    ),
    'custom-item': (() => {
      const palettes = [
        ['#10B981', '#8B5CF6', '#F59E0B'],
        ['#06B6D4', '#EC4899', '#10B981'],
        ['#8B5CF6', '#14B8A6', '#FB7185'],
      ];
      const [c1, c2, c3] = palettes[index % palettes.length];
      return (
        <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none">
          <rect x="9" y="9" width="14" height="14" rx="4" fill={c1} />
          <rect x="25" y="9" width="14" height="14" rx="7" fill={c2} />
          <rect x="9" y="25" width="14" height="14" rx="7" fill={c3} />
          <rect x="25" y="25" width="14" height="14" rx="4" fill={c1} fillOpacity="0.85" />
        </svg>
      );
    })(),
  };

  return <>{icons[iconKey]}</>;
}
