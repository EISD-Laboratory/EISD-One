# ADR-002: Penegakan Batas Dependensi Modul dengan `eslint-plugin-boundaries`

- **Tanggal:** 2026-11-23
- **Status:** Diterima

## Konteks

EISD One memakai arsitektur modular monolith. Risiko utama modular monolith saat dikerjakan oleh banyak kontributor adalah terjadinya _spaghetti imports_ antarmodul divisi atau ketergantungan balik dari Platform Kernel ke modul divisi.

## Keputusan

1. Menegakkan aturan dependensi langsung di ESLint menggunakan `eslint-plugin-boundaries` pada seluruh berkas di `apps/api/src/**/*.ts`.
2. Membagi kode backend ke dalam empat zona:
   - `shared` (`apps/api/src/shared/**`)
   - `kernel` (`apps/api/src/kernel/**`)
   - `module-public` (`apps/api/src/modules/<nama>/public/**`)
   - `module-internal` (`apps/api/src/modules/<nama>/**`)
3. Aturan impor:
   - `shared` hanya boleh mengimpor `shared`.
   - `kernel` hanya boleh mengimpor `shared` dan `kernel`.
   - `modules/<A>` boleh mengimpor `shared`, `kernel`, internal `modules/<A>`, atau kontrak publik `modules/<B>/public/**`.
4. Menambahkan tes otomatis `apps/api/test/architecture/module-boundaries.spec.ts` yang menjalankan ESLint terhadap contoh impor terlarang untuk memastikan rule selalu aktif dan tidak mengalami regresi di CI.

## Konsekuensi

- Setiap pelanggaran arsitektur gagal seketika di editor, `npm run lint`, dan GitHub Actions CI.
- Jika suatu modul divisi membutuhkan layanan dari modul divisi lain secara sinkron, tim wajib mengekspose kontrak eksplisit di folder `public/` atau menggunakan domain event.
