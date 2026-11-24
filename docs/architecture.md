# Arsitektur EISD One (Lean Modular Fullstack)

## 1. Gambaran Umum

EISD One adalah platform manajemen internal laboratorium EISD (~69 anggota aktif, 10 akun pengurus + Administrator) bergaya **"Odoo mini"**: satu inti bersama (`src/core/`) dan modul mandiri per divisi (`src/modules/`) dalam **1 aplikasi Next.js Fullstack + 1 PostgreSQL** (lihat [ADR-004](decisions/ADR-004-lean-fullstack.md)).

```text
Browser (Dashboard Next.js + Halaman Registrasi Event Publik)
        |
Next.js App Router (UI + REST API /api/* dengan Auth & RBAC default-deny)
        |
Modul Divisi (src/modules/):
  core | event | enabler | praktikum | media | competition | research | study-group | custom
        |
Inti Bersama (src/core/):
  auth | rbac | audit | settings | member-period | excel-exchange | kpi | calendar
        |
PostgreSQL + Local Upload Volume (/app/uploads)
```

## 2. Model Akses & Peran

- **Administrator (`super_admin`)**: akses penuh ke seluruh modul, pengaturan RBAC, toggle modul aktif/nonaktif, dan penambahan _custom modul/divisi_.
- **3 Anggota Core**: peran terpisah (`core_chair`, `core_secretary`, `core_treasurer`), dapat disesuaikan kapan saja di `/rbac`.
- **7 Ketua Divisi (Kadiv)**: masing-masing hanya melihat & mengelola data divisinya sendiri (Kadiv Enabler juga memiliki `kpi.result.view_all` untuk _Staff of the Month_).
- **Anggota Non-Login (~69 anggota aktif)**: tercatat di `members` tanpa akun login otomatis.
- **Extra Roles**: `wakadiv`, `staf`, `anggota` tersedia di balik feature flag `rbac.extra_roles` (`false` secara default).

## 3. Aturan Dependensi Modul (Ditegakkan ESLint)

1. `src/core/**` hanya boleh mengimpor dari `src/core/**` (**dilarang** impor `src/modules/**`).
2. `src/modules/<A>/**` boleh mengimpor `src/core/**`, internal `src/modules/<A>/**`, atau kontrak publik `src/modules/<B>/public/**` (**dilarang** impor internal `src/modules/<B>/**`).
3. Terverifikasi otomatis melalui `test/module-boundaries.spec.ts` pada setiap `npm test` dan CI.
