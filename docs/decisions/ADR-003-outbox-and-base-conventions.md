# ADR-003: Fondasi Skema Database, Outbox Event, dan Role Administrator

- **Tanggal:** 2026-11-23
- **Status:** Diterima

## Konteks

Pada Fase 0, dibutuhkan fondasi database terversi (Prisma Migrate) dan seed awal tanpa mendahului detail bisnis modul Fase 1–5. Selain itu, komunikasi antarmodul membutuhkan jaminan keandalan (outbox pattern), dan organisasi menegaskan perlunya role **Administrator (`Super Admin`)** yang dapat mengakses seluruh modul dan _custom module_, sekaligus pemisahan wewenang pada 3 anggota Core.

## Keputusan

1. Skema Fase 0 memuat dua tabel fondasi kernel:
   - `kernel_outbox_events`: menyimpan setiap domain event dengan `idempotency_key` unik agar pengiriman event lintas modul tidak hilang dan aman terhadap pemrosesan ulang.
   - `kernel_settings`: menyimpan konfigurasi sistem dan feature flag (`rbac.extra_roles = false`, flag enable/disable per modul) yang dapat diubah tanpa deploy ulang.
2. Seluruh tabel mengikuti konvensi UUID, `snake_case`, jamak dengan prefix, waktu UTC, dan kolom audit standar (`created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`).
3. Mulai Fase 1, RBAC akan selalu menyediakan role global `Super Admin` (Administrator) dengan akses penuh ke seluruh modul serta pengelolaan _custom module_/feature flag, terpisah dari peran 3 anggota Core dan 7 Kadiv.

## Konsekuensi

- Migrasi Fase 0 tetap ringkas, stabil, dan tidak perlu diubah ulang di fase berikutnya.
- Infrastruktur domain event dan feature flag sudah siap dipakai sejak komponen kernel pertama di Fase 1.
