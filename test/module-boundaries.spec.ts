import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..');

describe('Aturan Dependensi Modul (ESLint boundaries)', () => {
  const eslint = new ESLint({
    cwd: repoRoot,
    overrideConfigFile: path.join(repoRoot, 'eslint.config.mjs'),
  });

  it('MENOLAK src/core mengimpor src/modules', async () => {
    const res = await eslint.lintText(
      `import { EVENT_INTERNAL_MARKER } from '../modules/event/internal';\nexport const x = EVENT_INTERNAL_MARKER;\n`,
      { filePath: path.join(repoRoot, 'src/core/violation.ts') },
    );
    expect(
      res[0].messages.filter((m) => m.ruleId === 'boundaries/element-types').length,
    ).toBeGreaterThan(0);
  }, 15_000);

  it('MENOLAK impor internal antar modul divisi yang berbeda', async () => {
    const res = await eslint.lintText(
      `import { CORE_INTERNAL_MARKER } from '../core/internal';\nexport const x = CORE_INTERNAL_MARKER;\n`,
      { filePath: path.join(repoRoot, 'src/modules/event/violation.ts') },
    );
    expect(
      res[0].messages.filter((m) => m.ruleId === 'boundaries/element-types').length,
    ).toBeGreaterThan(0);
  }, 15_000);

  it('MENGIZINKAN modul divisi mengimpor src/core dan kontrak publik modul lain', async () => {
    const res = await eslint.lintText(
      [
        `import { prisma } from '../../core/db';`,
        `import { CORE_MODULE_PUBLIC_VERSION } from '../core/public/index';`,
        `export const ok = { prisma, CORE_MODULE_PUBLIC_VERSION };`,
        ``,
      ].join('\n'),
      { filePath: path.join(repoRoot, 'src/modules/event/allowed.ts') },
    );
    expect(res[0].messages.filter((m) => m.ruleId === 'boundaries/element-types')).toHaveLength(0);
  }, 15_000);
});
