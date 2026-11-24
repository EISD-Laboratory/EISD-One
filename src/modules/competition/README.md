# Modul Competition (`src/modules/competition`)

- **Tanggung jawab:** Pencatatan lomba, tim/anggota EISD, tingkat lomba, capaian (`REGISTERED → FINALIST → WINNER / PARTICIPANT`), dan biaya pendaftaran.
- **Tabel:** `competition_entries`.
- **Integrasi:**
  - Kalender EISD: jadwal lomba otomatis tersinkron ke kalender kategori `COMPETITION`.
  - Kas Core: biaya pendaftaran lomba dapat otomatis dicatat sebagai pengeluaran via kontrak publik `src/modules/core/public/index.ts`.
  - KPI Engine: menyediakan sumber `competition.participation_count` melalui `src/modules/competition/public/index.ts`.
