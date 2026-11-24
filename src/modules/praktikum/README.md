# Modul Praktikum (`src/modules/praktikum`)

Mengelola kelas praktikum, jadwal, presensi, dan penilaian dengan impor/ekspor Excel & CSV.

- **KPI Provider (`public/index.ts`)**: `praktikum.attendance_rate` (otomatis menghubungkan NIM asisten ke `core_members`).
- **Permissions**: `praktikum.course.read`, `praktikum.course.manage`, `praktikum.grade.import`.
