# EISD One

Platform manajemen internal laboratorium **EISD** bergaya **"Odoo mini"** yang ringan dan mudah dirawat mahasiswa: **1 aplikasi Next.js Fullstack + 1 PostgreSQL** (hanya 2 container Docker).

## Quickstart

```bash
cp .env.example .env
docker compose up --build
```

- Aplikasi & Dashboard: http://localhost:3000
- Login Demo (non-production): `admin@eisd.local` atau `kadiv.event@eisd.local` (password: `AdminEisd123!`)
- Health Check: http://localhost:3000/api/health

## Perintah Pengembangan

| Perintah             | Fungsi                                                                                    |
| :------------------- | :---------------------------------------------------------------------------------------- |
| `npm run dev`        | Menjalankan Next.js development server                                                    |
| `npm run lint`       | ESLint + pengecekan batas dependensi antarmodul                                           |
| `npm run typecheck`  | TypeScript strict check                                                                   |
| `npm test`           | Menjalankan seluruh unit test Vitest (RBAC, KPI, Excel 200 baris + rollback, batas modul) |
| `npm run build`      | Build produksi Next.js                                                                    |
| `npm run db:migrate` | Prisma Migrate (dev)                                                                      |
| `npm run db:seed`    | Menjalankan seed idempotent                                                               |
