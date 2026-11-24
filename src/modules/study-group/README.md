# Modul Study Group (`src/modules/study-group`)

- **Tanggung jawab:** Pengelolaan kelas/kelompok belajar internal, mentor, sesi pertemuan, materi, jumlah kehadiran, serta ekspor rekap Excel/CSV.
- **Tabel:** `study_group_classes`, `study_group_sessions`.
- **Integrasi:**
  - Kalender EISD: sesi pertemuan baru otomatis disinkronkan ke kalender.
  - KPI Engine: menyediakan sumber `study_group.session_count` melalui `src/modules/study-group/public/index.ts`.
