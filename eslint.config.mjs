import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * ESLint flat config untuk EISD One (Lean Modular Fullstack).
 * Menegakkan aturan dependensi modul:
 * 1. src/core/** boleh mengimpor src/core/**, DILARANG mengimpor src/modules/**.
 * 2. src/modules/<A>/** boleh mengimpor src/core/**, internal src/modules/<A>/**,
 *    atau kontrak publik src/modules/<B>/public/** — DILARANG impor internal src/modules/<B>/**.
 */
export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'out/**',
      'coverage/**',
      'prisma/migrations/**',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['src/core/**/*.{ts,tsx}', 'src/modules/**/*.{ts,tsx}'],
    plugins: {
      boundaries,
    },
    settings: {
      'boundaries/root-path': repoRoot,
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: path.join(repoRoot, 'tsconfig.json'),
        },
        node: {
          extensions: ['.ts', '.tsx', '.js', '.mjs'],
        },
      },
      'boundaries/include': ['src/core/**/*.{ts,tsx}', 'src/modules/**/*.{ts,tsx}'],
      'boundaries/elements': [
        {
          type: 'core',
          pattern: 'src/core/**',
          mode: 'full',
        },
        {
          type: 'module-public',
          pattern: 'src/modules/([^/]+)/public/**',
          capture: ['moduleName'],
          mode: 'full',
        },
        {
          type: 'module-internal',
          pattern: 'src/modules/([^/]+)/**',
          capture: ['moduleName'],
          mode: 'full',
        },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          message:
            'Pelanggaran batas modul EISD One: ${file.type} tidak boleh mengimpor ${dependency.type}. Gunakan src/core atau kontrak public/ modul.',
          rules: [
            {
              from: 'core',
              allow: ['core'],
            },
            {
              from: 'module-public',
              allow: [
                'core',
                ['module-public', { moduleName: '${from.moduleName}' }],
                ['module-internal', { moduleName: '${from.moduleName}' }],
              ],
            },
            {
              from: 'module-internal',
              allow: [
                'core',
                'module-public',
                ['module-internal', { moduleName: '${from.moduleName}' }],
              ],
            },
          ],
        },
      ],
    },
  },
];
