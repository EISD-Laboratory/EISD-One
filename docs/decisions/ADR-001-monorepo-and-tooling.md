# ADR-001: Pilihan Monorepo (`npm workspaces`), Runtime, dan Tooling

- **Tanggal:** 2026-11-23
- **Status:** Diterima

## Konteks

EISD One dikembangkan dan dipelihara oleh tim mahasiswa yang berganti setiap periode kepengurusan. Keterbacaan, kesederhanaan setup, dan minimnya ketergantungan pada alat eksternal lebih diutamakan dibandingkan kompleksitas build tooling. Lingkungan lokal tim sudah memiliki Node.js (`v24`) dan `npm` bawaan tanpa `pnpm`.

## Keputusan

1. Menggunakan **npm workspaces** bawaan Node.js tanpa menambah orchestrator monorepo eksternal (seperti Turborepo/Nx) di Fase 0.
2. Menggunakan **Node 22 LTS (Alpine)** pada Docker image produksi/dev untuk stabilitas kompatibilitas Prisma dan NestJS, sambil tetap mendukung Node >= 22 di lingkungan lokal.
3. Menggunakan **Prisma ORM v6** dengan PostgreSQL 16 dan **Vitest** untuk unit testing di backend.
4. Menggunakan **Tailwind CSS v3** + konfigurasi **shadcn/ui** pada `apps/web` untuk stabilitas lintas platform (Windows & Linux container).
5. Menggunakan **`pgsty/minio:latest`** sebagai image MinIO drop-in pada Docker Compose (karena image publik `minio/minio` dan `minio/mc` tidak lagi tersedia di Docker Hub) serta membuat bucket otomatis melalui `S3Service` di backend agar tidak membutuhkan container inisialisasi terpisah.

## Konsekuensi

- Pengembang baru cukup menjalankan `npm install` dan `docker compose up` tanpa perlu menginstal package manager tambahan.
- Bila skala build bertambah di fase akhir, caching build (seperti Turborepo) tetap dapat ditambahkan secara non-breaking tanpa mengubah struktur workspace.
