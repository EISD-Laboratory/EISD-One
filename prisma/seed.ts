import {
  CalendarCategory,
  KpiFrameworkStatus,
  KpiSourceType,
  MemberStatus,
  PrismaClient,
  RoleScope,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_SETTINGS = [
  {
    key: 'lab.name',
    value: 'EISD Laboratory',
    description: 'Nama resmi laboratorium',
    isPublic: true,
  },
  {
    key: 'lab.timezone',
    value: 'Asia/Jakarta',
    description: 'Zona waktu tampilan',
    isPublic: true,
  },
  {
    key: 'lab.estimated_active_members',
    value: 69,
    description: 'Perkiraan anggota aktif',
    isPublic: false,
  },
  {
    key: 'rbac.extra_roles',
    value: false,
    description:
      'Aktifkan role tambahan (Wakadiv, Staf, Anggota) di luar 10 akun default + Administrator.',
    isPublic: false,
  },
];

const DIVISIONS = [
  { code: 'core', name: 'Core', description: 'Administrasi, rapat, surat, aset, dan kas lab.' },
  {
    code: 'event',
    name: 'Event',
    description: 'Acara, kuliah umum, kepanitiaan, registrasi publik, presensi, sertifikat.',
  },
  {
    code: 'enabler',
    name: 'Enabler',
    description: 'Partnership eksternal & kesejahteraan anggota.',
  },
  {
    code: 'research',
    name: 'Research and Community',
    description: 'Riset, publikasi, dan komunitas.',
  },
  {
    code: 'praktikum',
    name: 'Praktikum',
    description: 'Kelas, jadwal, asisten, presensi, dan nilai.',
  },
  { code: 'media', name: 'Media', description: 'Kalender konten, desain, dan aset brand.' },
  { code: 'competition', name: 'Competition', description: 'Lomba, tim, mentoring, dan prestasi.' },
  {
    code: 'study-group',
    name: 'Study Group',
    description: 'Kelompok belajar, sesi, materi, progres.',
  },
] as const;

const PERMISSIONS = [
  {
    code: 'member.member.read',
    module: 'member',
    entity: 'member',
    action: 'read',
    description: 'Lihat anggota (sesuai divisi)',
  },
  {
    code: 'member.member.view_all',
    module: 'member',
    entity: 'member',
    action: 'view_all',
    description: 'Lihat anggota semua divisi',
  },
  {
    code: 'member.member.create',
    module: 'member',
    entity: 'member',
    action: 'create',
    description: 'Tambah anggota',
  },
  {
    code: 'member.member.update',
    module: 'member',
    entity: 'member',
    action: 'update',
    description: 'Ubah data anggota',
  },
  {
    code: 'member.member.delete',
    module: 'member',
    entity: 'member',
    action: 'delete',
    description: 'Hapus (soft-delete) anggota',
  },
  {
    code: 'member.member.import',
    module: 'member',
    entity: 'member',
    action: 'import',
    description: 'Import Excel/CSV anggota & rollback',
  },
  {
    code: 'member.member.export',
    module: 'member',
    entity: 'member',
    action: 'export',
    description: 'Export Excel/CSV anggota',
  },
  {
    code: 'member.period.read',
    module: 'member',
    entity: 'period',
    action: 'read',
    description: 'Lihat periode kepengurusan',
  },
  {
    code: 'member.period.manage',
    module: 'member',
    entity: 'period',
    action: 'manage',
    description: 'Kelola periode kepengurusan',
  },
  {
    code: 'member.division.read',
    module: 'member',
    entity: 'division',
    action: 'read',
    description: 'Lihat daftar divisi & modul',
  },
  {
    code: 'member.division.manage',
    module: 'member',
    entity: 'division',
    action: 'manage',
    description: 'Toggle modul & buat custom modul/divisi',
  },
  {
    code: 'rbac.role.read',
    module: 'rbac',
    entity: 'role',
    action: 'read',
    description: 'Lihat role & permission',
  },
  {
    code: 'rbac.role.manage',
    module: 'rbac',
    entity: 'role',
    action: 'manage',
    description: 'Atur matriks role & permission',
  },
  {
    code: 'rbac.user.read',
    module: 'rbac',
    entity: 'user',
    action: 'read',
    description: 'Lihat akun login pengurus',
  },
  {
    code: 'rbac.user.manage',
    module: 'rbac',
    entity: 'user',
    action: 'manage',
    description: 'Kelola akun login & serah terima Kadiv',
  },
  {
    code: 'audit.log.read',
    module: 'audit',
    entity: 'log',
    action: 'read',
    description: 'Lihat audit log sistem',
  },
  {
    code: 'settings.system.read',
    module: 'settings',
    entity: 'system',
    action: 'read',
    description: 'Lihat pengaturan & feature flags',
  },
  {
    code: 'settings.system.manage',
    module: 'settings',
    entity: 'system',
    action: 'manage',
    description: 'Ubah pengaturan & feature flags',
  },
  {
    code: 'calendar.item.read',
    module: 'calendar',
    entity: 'item',
    action: 'read',
    description: 'Lihat kalender & ekspor .ics',
  },
  {
    code: 'calendar.item.manage',
    module: 'calendar',
    entity: 'item',
    action: 'manage',
    description: 'Kelola agenda kalender',
  },
  {
    code: 'kpi.framework.manage',
    module: 'kpi',
    entity: 'framework',
    action: 'manage',
    description: 'Kelola framework KPI, hitung ulang & tutup bulan',
  },
  {
    code: 'kpi.score.submit',
    module: 'kpi',
    entity: 'score',
    action: 'submit',
    description: 'Input nilai KPI manual anggota',
  },
  {
    code: 'kpi.score.approve',
    module: 'kpi',
    entity: 'score',
    action: 'approve',
    description: 'Setujui/tolak nilai KPI manual',
  },
  {
    code: 'kpi.result.read',
    module: 'kpi',
    entity: 'result',
    action: 'read',
    description: 'Lihat hasil KPI divisi sendiri',
  },
  {
    code: 'kpi.result.view_all',
    module: 'kpi',
    entity: 'result',
    action: 'view_all',
    description: 'Lihat ranking KPI seluruh divisi (Core & Kadiv Enabler)',
  },
  {
    code: 'kpi.result.export',
    module: 'kpi',
    entity: 'result',
    action: 'export',
    description: 'Ekspor rekap KPI ke Excel/CSV',
  },
  // Tahap 2: Core, Event, Praktikum, Enabler
  {
    code: 'core.finance.read',
    module: 'core',
    entity: 'finance',
    action: 'read',
    description: 'Lihat kas, transaksi, aset, dan rapat/surat Core',
  },
  {
    code: 'core.finance.manage',
    module: 'core',
    entity: 'finance',
    action: 'manage',
    description: 'Kelola kas, transaksi, dan inventaris aset Core',
  },
  {
    code: 'core.record.manage',
    module: 'core',
    entity: 'record',
    action: 'manage',
    description: 'Kelola rapat/notulen dan surat menyurat Core',
  },
  {
    code: 'event.event.read',
    module: 'event',
    entity: 'event',
    action: 'read',
    description: 'Lihat daftar event, panitia, dan peserta',
  },
  {
    code: 'event.event.manage',
    module: 'event',
    entity: 'event',
    action: 'manage',
    description: 'Kelola event, kepanitiaan, presensi, dan sertifikat',
  },
  {
    code: 'praktikum.course.read',
    module: 'praktikum',
    entity: 'course',
    action: 'read',
    description: 'Lihat kelas, jadwal, presensi, dan nilai praktikum',
  },
  {
    code: 'praktikum.course.manage',
    module: 'praktikum',
    entity: 'course',
    action: 'manage',
    description: 'Kelola kelas dan penugasan asisten praktikum',
  },
  {
    code: 'praktikum.grade.import',
    module: 'praktikum',
    entity: 'grade',
    action: 'import',
    description: 'Impor presensi & nilai praktikum dari Excel/CSV',
  },
  {
    code: 'enabler.partner.read',
    module: 'enabler',
    entity: 'partner',
    action: 'read',
    description: 'Lihat partner, pipeline, dan riwayat apresiasi',
  },
  {
    code: 'enabler.partner.manage',
    module: 'enabler',
    entity: 'partner',
    action: 'manage',
    description: 'Kelola partner, MoU, benefit, dan Staff of the Month',
  },
  // Tahap 3: Media, Competition, Research, Study Group, Custom Modules
  {
    code: 'media.request.read',
    module: 'media',
    entity: 'request',
    action: 'read',
    description: 'Lihat antrean permintaan desain & jadwal publikasi Media',
  },
  {
    code: 'media.request.manage',
    module: 'media',
    entity: 'request',
    action: 'manage',
    description: 'Kelola permintaan desain, status produksi, dan konten Media',
  },
  {
    code: 'competition.entry.read',
    module: 'competition',
    entity: 'entry',
    action: 'read',
    description: 'Lihat daftar lomba, tim, dan capaian Competition',
  },
  {
    code: 'competition.entry.manage',
    module: 'competition',
    entity: 'entry',
    action: 'manage',
    description: 'Kelola pendaftaran lomba, status finalis/juara, dan biaya lomba',
  },
  {
    code: 'research.project.read',
    module: 'research',
    entity: 'project',
    action: 'read',
    description: 'Lihat proyek riset, publikasi, dan pengabdian masyarakat',
  },
  {
    code: 'research.project.manage',
    module: 'research',
    entity: 'project',
    action: 'manage',
    description: 'Kelola proyek riset, publikasi, dan kegiatan komunitas',
  },
  {
    code: 'study_group.class.read',
    module: 'study_group',
    entity: 'class',
    action: 'read',
    description: 'Lihat kelompok belajar, mentor, dan sesi Study Group',
  },
  {
    code: 'study_group.class.manage',
    module: 'study_group',
    entity: 'class',
    action: 'manage',
    description: 'Kelola kelas, jadwal sesi, dan rekap kehadiran Study Group',
  },
  {
    code: 'custom_module.manage',
    module: 'custom_module',
    entity: 'schema',
    action: 'manage',
    description: 'Buat & ubah skema Custom Module dinamis (khusus Administrator)',
  },
  {
    code: 'custom_module.record.read',
    module: 'custom_module',
    entity: 'record',
    action: 'read',
    description: 'Lihat & ekspor data pada Custom Module',
  },
  {
    code: 'custom_module.record.manage',
    module: 'custom_module',
    entity: 'record',
    action: 'manage',
    description: 'Tambah, ubah, dan hapus data pada Custom Module',
  },
];

const DEMO_MEMBERS = [
  {
    nim: '1202220001',
    fullName: 'Alya Pratama',
    email: 'alya.pratama@example.edu',
    division: 'core',
    position: 'Ketua Lab',
    isHead: true,
  },
  {
    nim: '1202220002',
    fullName: 'Bima Mahendra',
    email: 'bima.mahendra@example.edu',
    division: 'core',
    position: 'Sekretaris Core',
  },
  {
    nim: '1202220003',
    fullName: 'Citra Lestari',
    email: 'citra.lestari@example.edu',
    division: 'core',
    position: 'Bendahara Core',
  },
  {
    nim: '1202220004',
    fullName: 'Dimas Saputra',
    email: 'dimas.saputra@example.edu',
    division: 'event',
    position: 'Kadiv Event',
    isHead: true,
  },
  {
    nim: '1202220005',
    fullName: 'Eka Wulandari',
    email: 'eka.wulandari@example.edu',
    division: 'event',
    position: 'Staf Event',
  },
  {
    nim: '1202220006',
    fullName: 'Fajar Nugroho',
    email: 'fajar.nugroho@example.edu',
    division: 'enabler',
    position: 'Kadiv Enabler',
    isHead: true,
  },
  {
    nim: '1202220007',
    fullName: 'Gita Rahmawati',
    email: 'gita.rahmawati@example.edu',
    division: 'research',
    position: 'Kadiv Research',
    isHead: true,
  },
  {
    nim: '1202220008',
    fullName: 'Hendra Wijaya',
    email: 'hendra.wijaya@example.edu',
    division: 'praktikum',
    position: 'Kadiv Praktikum',
    isHead: true,
  },
  {
    nim: '1202220009',
    fullName: 'Intan Permata',
    email: 'intan.permata@example.edu',
    division: 'media',
    position: 'Kadiv Media',
    isHead: true,
  },
  {
    nim: '1202220010',
    fullName: 'Joko Santoso',
    email: 'joko.santoso@example.edu',
    division: 'competition',
    position: 'Kadiv Competition',
    isHead: true,
  },
];

async function assignPerms(roleId: string, codes: string[]) {
  const perms = await prisma.permission.findMany({
    where: { code: { in: codes } },
    select: { id: true },
  });
  for (const p of perms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: p.id } },
      update: {},
      create: { roleId, permissionId: p.id },
    });
  }
}

async function main() {
  for (const s of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { description: s.description, isPublic: s.isPublic },
      create: s,
    });
  }

  const divMap = new Map<string, string>();
  for (const d of DIVISIONS) {
    const saved = await prisma.division.upsert({
      where: { code: d.code },
      update: { name: d.name, description: d.description },
      create: { code: d.code, name: d.name, description: d.description },
    });
    divMap.set(d.code, saved.id);
  }

  const activePeriod = await prisma.period.upsert({
    where: { name: '2026/2027' },
    update: {},
    create: {
      name: '2026/2027',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2027-07-31T00:00:00.000Z'),
      isActive: true,
    },
  });

  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { description: p.description },
      create: p,
    });
  }
  const allPermCodes = PERMISSIONS.map((p) => p.code);

  // Super Admin (Administrator)
  const superAdminRole = await prisma.role.upsert({
    where: { code: 'super_admin' },
    update: { name: 'Administrator (Super Admin)', isSystem: true },
    create: {
      code: 'super_admin',
      name: 'Administrator (Super Admin)',
      description: 'Akses penuh ke seluruh modul, RBAC, pengaturan, dan custom modul.',
      scope: RoleScope.GLOBAL,
      isSystem: true,
    },
  });
  await assignPerms(superAdminRole.id, allPermCodes);

  // 3 Role Core terpisah
  const coreRoles = [
    {
      code: 'core_chair',
      name: 'Core — Ketua/Koordinator',
      perms: [
        'member.member.read',
        'member.member.view_all',
        'member.period.read',
        'member.period.manage',
        'member.division.read',
        'rbac.role.read',
        'rbac.user.read',
        'rbac.user.manage',
        'audit.log.read',
        'settings.system.read',
        'calendar.item.read',
        'calendar.item.manage',
        'kpi.framework.manage',
        'kpi.score.approve',
        'kpi.result.read',
        'kpi.result.view_all',
        'kpi.result.export',
        'core.finance.read',
        'core.record.manage',
        'event.event.read',
        'praktikum.course.read',
        'enabler.partner.read',
        'media.request.read',
        'competition.entry.read',
        'research.project.read',
        'study_group.class.read',
        'custom_module.record.read',
      ],
    },
    {
      code: 'core_secretary',
      name: 'Core — Sekretaris',
      perms: [
        'member.member.read',
        'member.member.view_all',
        'member.member.create',
        'member.member.update',
        'member.member.delete',
        'member.member.import',
        'member.member.export',
        'member.period.read',
        'member.period.manage',
        'member.division.read',
        'audit.log.read',
        'calendar.item.read',
        'calendar.item.manage',
        'kpi.result.read',
        'kpi.result.view_all',
        'kpi.result.export',
        'core.finance.read',
        'core.record.manage',
        'event.event.read',
      ],
    },
    {
      code: 'core_treasurer',
      name: 'Core — Bendahara',
      perms: [
        'member.member.read',
        'member.member.view_all',
        'member.period.read',
        'member.division.read',
        'audit.log.read',
        'calendar.item.read',
        'kpi.result.read',
        'kpi.result.view_all',
        'core.finance.read',
        'core.finance.manage',
      ],
    },
  ];
  for (const cr of coreRoles) {
    const saved = await prisma.role.upsert({
      where: { code: cr.code },
      update: { name: cr.name },
      create: {
        code: cr.code,
        name: cr.name,
        scope: RoleScope.GLOBAL,
        divisionId: divMap.get('core'),
        isSystem: true,
      },
    });
    await assignPerms(saved.id, cr.perms);
  }

  // 7 Role Kadiv
  const kadivBasePerms = [
    'member.member.read',
    'member.member.create',
    'member.member.update',
    'member.member.import',
    'member.member.export',
    'member.period.read',
    'member.division.read',
    'calendar.item.read',
    'calendar.item.manage',
    'kpi.score.submit',
    'kpi.result.read',
    'kpi.result.export',
  ];
  const kadivRoleMap = new Map<string, string>();
  for (const div of DIVISIONS.filter((d) => d.code !== 'core')) {
    const code = `kadiv_${div.code.replace(/-/g, '_')}`;
    const saved = await prisma.role.upsert({
      where: { code },
      update: { name: `Kadiv ${div.name}` },
      create: {
        code,
        name: `Kadiv ${div.name}`,
        description: `Ketua Divisi ${div.name} (akses terbatas pada divisi sendiri).`,
        scope: RoleScope.DIVISION,
        divisionId: divMap.get(div.code),
        isSystem: true,
      },
    });
    const extraByDivision: Record<string, string[]> = {
      event: ['event.event.read', 'event.event.manage'],
      praktikum: ['praktikum.course.read', 'praktikum.course.manage', 'praktikum.grade.import'],
      enabler: ['kpi.result.view_all', 'enabler.partner.read', 'enabler.partner.manage'],
      media: ['media.request.read', 'media.request.manage'],
      competition: ['competition.entry.read', 'competition.entry.manage'],
      research: ['research.project.read', 'research.project.manage'],
      'study-group': ['study_group.class.read', 'study_group.class.manage'],
    };
    const perms = [...kadivBasePerms, ...(extraByDivision[div.code] ?? [])];
    await assignPerms(saved.id, perms);
    kadivRoleMap.set(div.code, saved.id);
  }

  // 3 Extra roles (tersembunyi di balik rbac.extra_roles = false)
  for (const extra of [
    { code: 'wakadiv', name: 'Wakil Ketua Divisi' },
    { code: 'staf', name: 'Staf Divisi' },
    { code: 'anggota', name: 'Anggota Umum' },
  ]) {
    await prisma.role.upsert({
      where: { code: extra.code },
      update: { isExtraRole: true },
      create: { code: extra.code, name: extra.name, scope: RoleScope.DIVISION, isExtraRole: true },
    });
  }

  // Sample KPI Framework (100% bobot, 3 indikator contoh)
  const existingFw = await prisma.kpiFramework.findFirst({
    where: { periodId: activePeriod.id, name: 'KPI EISD 2026/2027 (Contoh)', deletedAt: null },
  });
  if (!existingFw) {
    const fw = await prisma.kpiFramework.create({
      data: {
        name: 'KPI EISD 2026/2027 (Contoh)',
        periodId: activePeriod.id,
        version: 1,
        status: KpiFrameworkStatus.ACTIVE,
        description:
          'Kerangka KPI contoh sementara (total bobot 100%). Dapat di-clone tanpa deploy ulang.',
      },
    });
    await prisma.kpiIndicator.createMany({
      data: [
        {
          frameworkId: fw.id,
          code: 'profile_readiness',
          name: 'Kelengkapan Data Anggota',
          weight: 30,
          sourceType: KpiSourceType.AUTO,
          unit: '%',
          minScale: 0,
          maxScale: 100,
          sourceCode: 'member.profile_completeness',
        },
        {
          frameworkId: fw.id,
          code: 'calendar_engagement',
          name: 'Agenda Kegiatan Divisi',
          weight: 30,
          sourceType: KpiSourceType.AUTO,
          unit: 'agenda',
          minScale: 0,
          maxScale: 4,
          sourceCode: 'calendar.activity_count',
        },
        {
          frameworkId: fw.id,
          code: 'initiative_manual',
          name: 'Inisiatif & Kolaborasi (Manual Kadiv)',
          weight: 40,
          sourceType: KpiSourceType.MANUAL,
          unit: 'skala 1-5',
          minScale: 1,
          maxScale: 5,
        },
      ],
    });
  }

  // Dev demo accounts & 10 fictitious members
  if (process.env.NODE_ENV !== 'production') {
    const pw = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'AdminEisd123!', 10);

    const admin = await prisma.user.upsert({
      where: { email: 'admin@eisd.local' },
      update: {},
      create: {
        email: 'admin@eisd.local',
        fullName: 'Administrator EISD (Demo)',
        passwordHash: pw,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: superAdminRole.id },
    });

    const kadivEventRoleId = kadivRoleMap.get('event');
    if (kadivEventRoleId) {
      const kadivEvent = await prisma.user.upsert({
        where: { email: 'kadiv.event@eisd.local' },
        update: {},
        create: {
          email: 'kadiv.event@eisd.local',
          fullName: 'Dimas Saputra (Kadiv Event Demo)',
          passwordHash: pw,
        },
      });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: kadivEvent.id, roleId: kadivEventRoleId } },
        update: {},
        create: { userId: kadivEvent.id, roleId: kadivEventRoleId },
      });
    }

    for (const demo of DEMO_MEMBERS) {
      const m = await prisma.member.upsert({
        where: { nim: demo.nim },
        update: {},
        create: {
          nim: demo.nim,
          fullName: demo.fullName,
          email: demo.email,
          birthDate: new Date('2004-05-15T00:00:00.000Z'),
          phone: '081200000000',
          status: MemberStatus.ACTIVE,
          batchYear: 2022,
        },
      });
      const divId = divMap.get(demo.division);
      if (divId) {
        await prisma.membership.upsert({
          where: {
            memberId_periodId_divisionId: {
              memberId: m.id,
              periodId: activePeriod.id,
              divisionId: divId,
            },
          },
          update: {},
          create: {
            memberId: m.id,
            periodId: activePeriod.id,
            divisionId: divId,
            positionTitle: demo.position,
            isHead: Boolean(demo.isHead),
          },
        });
      }
    }

    const existingCal = await prisma.calendarItem.findFirst({ where: { sourceModule: 'seed' } });
    if (!existingCal) {
      await prisma.calendarItem.create({
        data: {
          title: 'Rapat Koordinasi Awal Periode 2026/2027',
          category: CalendarCategory.MEETING,
          startAt: new Date('2026-11-25T09:00:00.000Z'),
          endAt: new Date('2026-11-25T11:00:00.000Z'),
          location: 'Ruang Lab EISD',
          sourceModule: 'seed',
        },
      });
    }

    // Demo data Tahap 2 (fiktif)
    const existingTx = await prisma.coreTransaction.findFirst();
    if (!existingTx) {
      await prisma.coreTransaction.create({
        data: {
          type: 'INCOME',
          category: 'Kas Awal',
          description: 'Saldo kas awal kepengurusan 2026/2027 (contoh fiktif)',
          amount: 5000000,
          transactionDate: new Date('2026-08-01T00:00:00.000Z'),
          sourceModule: 'core',
        },
      });
    }

    await prisma.coreAsset.upsert({
      where: { code: 'EISD-AST-001' },
      update: {},
      create: {
        code: 'EISD-AST-001',
        name: 'Proyektor Ruang Lab (Contoh)',
        category: 'Elektronik',
        condition: 'GOOD',
        location: 'Ruang Lab EISD',
        quantity: 1,
      },
    });

    await prisma.eventItem.upsert({
      where: { slug: 'kuliah-umum-enterprise-2026' },
      update: {},
      create: {
        slug: 'kuliah-umum-enterprise-2026',
        title: 'Kuliah Umum Enterprise Architecture 2026',
        description:
          'Kuliah umum terbuka untuk mahasiswa mengenai arsitektur sistem informasi (tanpa tiket QR).',
        speaker: 'Dr. Contoh Narasumber',
        startAt: new Date('2026-12-05T02:00:00.000Z'),
        endAt: new Date('2026-12-05T05:00:00.000Z'),
        location: 'Auditorium Gedung A / Zoom',
        status: 'APPROVED',
        budgetAmount: 750000,
        isPublicOpen: true,
        sponsorNeeded: true,
      },
    });

    await prisma.praktikumCourse.upsert({
      where: { code: 'EISD-PRK-101' },
      update: {},
      create: {
        code: 'EISD-PRK-101',
        name: 'Praktikum Pemrograman Enterprise',
        semester: 'Ganjil 2026/2027',
        schedule: 'Selasa 13:00 - 15:00 WIB',
      },
    });

    const existingPartner = await prisma.enablerPartner.findFirst();
    if (!existingPartner) {
      await prisma.enablerPartner.create({
        data: {
          name: 'PT Teknologi Nusantara (Contoh)',
          picName: 'Rina Wijaya',
          picContact: 'rina@contoh-partner.id',
          stage: 'ACTIVE',
          mouExpiresAt: new Date('2027-06-30T00:00:00.000Z'),
          obligationsJson: [
            { title: 'Logo di poster Kuliah Umum', done: true },
            { title: 'Publikasi media sosial EISD', done: false },
          ],
        },
      });
    }

    // Demo data Tahap 3 (fiktif)
    const existingMedia = await prisma.mediaRequest.findFirst();
    if (!existingMedia) {
      await prisma.mediaRequest.create({
        data: {
          title: 'Poster & Feeds Kuliah Umum Enterprise 2026',
          requesterDivision: 'Event',
          channel: 'Instagram',
          picName: 'Intan Permata',
          dueDate: new Date('2026-12-01T00:00:00.000Z'),
          publishAt: new Date('2026-12-02T05:00:00.000Z'),
          status: 'IN_PROGRESS',
          brief: 'Poster pengumuman kuliah umum (tanpa tiket QR, cukup tautan form registrasi).',
        },
      });
    }

    const existingComp = await prisma.competitionEntry.findFirst();
    if (!existingComp) {
      await prisma.competitionEntry.create({
        data: {
          competitionName: 'GEMASTIK Enterprise Architecture 2026 (Contoh)',
          organizer: 'Puspresnas',
          level: 'Nasional',
          teamName: 'EISD Garuda',
          memberNames: 'Joko Santoso, Dimas Saputra',
          eventDate: new Date('2026-12-18T00:00:00.000Z'),
          status: 'FINALIST',
          achievement: 'Lolos Final Nasional',
          registrationFee: 200000,
        },
      });
    }

    const existingResearch = await prisma.researchProject.findFirst();
    if (!existingResearch) {
      await prisma.researchProject.create({
        data: {
          title: 'Implementasi Modular ERP Ringan untuk Laboratorium Kampus (Contoh)',
          type: 'PUBLICATION',
          year: 2026,
          leadName: 'Gita Rahmawati',
          teamSummary: 'Gita Rahmawati, Alya Pratama',
          status: 'ONGOING',
          venueOrPartner: 'Jurnal Sistem Informasi Nasional',
        },
      });
    }

    const sg = await prisma.studyGroupClass.upsert({
      where: { code: 'SG-NEXT-2026' },
      update: {},
      create: {
        code: 'SG-NEXT-2026',
        name: 'Study Group Fullstack TypeScript',
        topic: 'Next.js, Prisma, dan Clean Architecture',
        mentorName: 'Hendra Wijaya',
        schedule: 'Jumat 16:00 - 17:30 WIB',
        maxParticipants: 25,
      },
    });
    const existingSgSession = await prisma.studyGroupSession.findFirst({
      where: { groupId: sg.id },
    });
    if (!existingSgSession) {
      await prisma.studyGroupSession.create({
        data: {
          groupId: sg.id,
          sessionNo: 1,
          title: 'Pertemuan 1: Pengenalan Next.js App Router & Prisma',
          sessionDate: new Date('2026-11-27T09:00:00.000Z'),
          attendeeCount: 18,
          notes: 'Demo awal arsitektur modular.',
        },
      });
    }
  }

  console.log(
    `Seed Lean EISD One selesai (${DIVISIONS.length} divisi, ${PERMISSIONS.length} permissions).`,
  );
}

main()
  .catch((err) => {
    console.error('Seed gagal:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
