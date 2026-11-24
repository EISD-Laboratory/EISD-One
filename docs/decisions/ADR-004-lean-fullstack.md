# ADR-004: Penyederhanaan ke Arsitektur Lean Modular Fullstack (Next.js + PostgreSQL)

- **Tanggal:** 2026-11-23
- **Status:** Diterima (menggantikan monorepo 5-container pada ADR-001)

## Konteks

EISD adalah laboratorium mahasiswa dengan ~69 anggota aktif, ~10 akun pengurus login (+ Administrator), dan tim pengembang mahasiswa yang berganti setiap periode kepengurusan. Arsitektur awal dengan 5 container (`Next.js`, `NestJS`, `PostgreSQL`, `Redis/BullMQ`, `MinIO`) serta 13 subsistem kernel bergaya ERP besar terlalu berat untuk dirawat jangka panjang.

## Keputusan

1. **Menyatukan seluruh aplikasi ke 1 proyek Next.js (App Router) Fullstack + Prisma + PostgreSQL** (hanya **2 container Docker**: `app` dan `postgres`).
2. **Menghapus Redis, BullMQ, MinIO, dan backend NestJS terpisah**:
   - Import/Export Excel & CSV untuk skala 69–500 baris dijalankan langsung _in-process_ (selesai `< 1 detik`) dengan tetap menjaga dry-run, error per baris, rollback per batch, dan proteksi CSV/formula injection.
   - Upload file disimpan ke volume disk lokal (`/app/uploads`) atau tautan eksternal.
3. **Tetap mempertahankan konsep modular ala "Odoo mini"**:
   - `src/core/` menyimpan inti bersama (Auth, RBAC, Audit Log, Settings, Member & Periode, Excel Exchange, KPI Engine, Calendar).
   - `src/modules/<divisi>/` menyimpan modul tiap divisi secara terpisah dan dapat dinyalakan/dimatikan oleh Administrator (`Super Admin`), termasuk dukungan custom modul/divisi.
   - Aturan batas dependensi tetap ditegakkan otomatis oleh `eslint-plugin-boundaries` (`core` tidak boleh impor `modules`, `modules/A` tidak boleh impor internal `modules/B`).

## Konsekuensi

- Pengembang mahasiswa baru cukup mempelajari **1 repositori, 1 bahasa (TypeScript), 2 container Docker**.
- Kompleksitas kode dan waktu build/deploy berkurang drastis tanpa mengorbankan integrasi lintas divisi, keamanan RBAC, Audit Log, KPI dinamis, maupun migrasi Excel/CSV.
