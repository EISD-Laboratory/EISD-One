# Panduan Singkat Pengguna — EISD One

EISD One adalah platform internal terpadu berbasis konsep **modular ala Odoo mini** untuk operasional Laboratorium EISD (~69 anggota aktif, 10 akun pengurus default + 1 Administrator).

---

## 1. Peran & Akses Default

| Peran                                   | Akses Utama                                                                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Administrator (`super_admin`)**       | Akses penuh ke seluruh modul, RBAC, Pengaturan, Audit Log, aktivasi/nonaktivasi modul, dan **Custom Module Builder**.                     |
| **Core (Ketua, Sekretaris, Bendahara)** | Direktori seluruh anggota, KPI lintas divisi, Kas & Aset Core, arsip rapat/surat, serta persetujuan KPI & apresiasi.                      |
| **7 Ketua Divisi (Kadiv)**              | Mengelola anggota di divisinya sendiri (manual atau Import Excel/CSV), kalender divisi, input KPI manual, dan modul divisi masing-masing. |

> **Catatan:** Anggota biasa (~69 mahasiswa) tidak perlu akun login; datanya dikelola oleh Kadiv dan Core melalui menu **Anggota**.

---

## 2. Alur Penggunaan Harian

### A. Login & Dashboard (`/dashboard`)

1. Masuk di `/login` menggunakan email & password pengurus (akun demo lokal: `admin@eisd.local` / `AdminEisd123!`, atau `kadiv.event@eisd.local` / `AdminEisd123!`).
2. Setelah masuk, **Dashboard** menampilkan ringkasan sesuai peran (total anggota, saldo Kas Core bila berwenang, agenda 30 hari ke depan, status modul aktif, dan antrean persetujuan).

### B. Kelola Anggota & Import/Export Excel (`/members`, `/members/import`)

- **Tambah/Ubah:** buka menu **Anggota**, filter per divisi/periode, atau ekspor Excel/CSV.
- **Import Massal:** buka **Import Excel/CSV** → unduh template → unggah file → cek pratinjau error per baris → pilih strategi duplikat (`SKIP`, `OVERWRITE`, `MERGE`) → eksekusi.
- **Rollback Aman:** jika terjadi kesalahan unggah, klik **Rollback** pada riwayat batch import untuk mengembalikan data seperti semula.

### C. Mengaktifkan/Menonaktifkan Modul & Custom Module Builder (`/periods`, `/custom-modules`)

- **Toggle Modul:** Administrator dapat mematikan modul divisi yang belum dipakai di menu **Periode & Modul**; sidebar akan otomatis menyembunyikan modul yang nonaktif.
- **Buat Modul Custom (Administrator):** buka **Custom Module** → isi nama, kode URL, dan definisikan kolom dinamis (teks, angka, tanggal, dropdown, catatan) → klik **Terbitkan Custom Module**. Modul baru otomatis muncul di sidebar dan memiliki halaman input data + Export Excel/CSV di `/custom/<kode>`.

### D. Event Kuliah Umum & Seminar (`/event`, `/register/[slug]`)

- Event EISD dirancang **tanpa tiket QR**:
  1. Buat event lalu ubah status ke `APPROVED` → otomatis muncul di **Kalender EISD**.
  2. Centang pendaftaran publik terbuka → bagikan tautan `/register/<slug>` kepada calon peserta (tanpa perlu login).
  3. Saat hari-H, panitia cukup mencentang kehadiran pada daftar peserta → nomor sertifikat terbit otomatis dan **PDF Sertifikat** serta **Excel Peserta** dapat langsung diunduh.
  4. Saat event selesai (`COMPLETED`) dengan realisasi biaya, pengeluaran otomatis tercatat ke **Kas Core**.

### E. KPI Anggota & Staff of the Month (`/kpi`, `/enabler`)

- **KPI:** Administrator/Core mengatur bobot indikator (sumber otomatis lintas modul: kelengkapan profil, kalender, panitia Event, presensi Praktikum, konten Media, partisipasi Competition, proyek Research, dan sesi Study Group + indikator manual) lalu klik **Hitung KPI Bulanan**.
- **Staff of the Month (`/enabler`):** kandidat ditarik dari peringkat KPI; jika memilih selain peringkat #1, sistem **wajib meminta alasan override** dan mencatatnya di Audit Log. Saat disetujui dengan nominal hadiah, biaya apresiasi otomatis tercatat ke **Kas Core**.

### F. Modul Divisi Lainnya

- **Core (`/core`):** kas masuk/keluar, inventaris aset, notulen rapat & nomor surat.
- **Praktikum (`/praktikum`):** kelas, unduh template & import Excel/CSV nilai/presensi asisten (otomatis terhubung via NIM).
- **Media (`/media`):** antrean desain/konten antar-divisi & jadwal publikasi ke Kalender.
- **Competition (`/competition`):** daftar lomba, tim, capaian juara, jadwal ke Kalender, dan opsi catat biaya ke Kas Core.
- **Research & Community (`/research`):** katalog riset, publikasi/HAKI, dan pengabdian masyarakat.
- **Study Group (`/study-group`):** kelas belajar internal, sesi pertemuan ke Kalender, dan export rekap Excel/CSV.

---

## 3. Menjalankan Lokal & Backup Database

### Menjalankan Aplikasi secara Lokal (Hemat Disk C)

Pastikan database PostgreSQL aktif, lalu jalankan aplikasi dari folder proyek:

```powershell
docker compose up -d postgres
npm run start
```

(Untuk mode pengembangan, gunakan `npm run dev`.)

### Backup & Restore Database PostgreSQL

```powershell
# Backup otomatis ke folder backups/eisd_one_YYYYMMDD_HHMMSS.sql
.\scripts\backup-db.ps1

# Restore dari file backup tertentu (meminta konfirmasi)
.\scripts\restore-db.ps1 -BackupFile .\backups\eisd_one_20261123_220000.sql
```

> Simpan salinan file di folder `backups/` secara berkala ke penyimpanan eksternal atau cloud internal lab.
