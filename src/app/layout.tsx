import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EISD One — Platform Manajemen Internal Lab EISD',
  description: 'Odoo-mini modular platform untuk laboratorium EISD.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={poppins.variable}>
      <body className={`${poppins.className} min-h-screen antialiased`}>{children}</body>
    </html>
  );
}
