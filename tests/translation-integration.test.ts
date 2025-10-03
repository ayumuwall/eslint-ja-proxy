import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function importProxyModule() {
  return import('../src/index.mts');
}

type SnapshotMessage = {
  ruleId: string | null;
  messageId: string | null;
  message: string;
};

function normalizeMessages(messages: Array<{ ruleId: string | null; messageId?: string | null; message: string }>): SnapshotMessage[] {
  return messages.map(({ ruleId, messageId, message }) => ({
    ruleId,
    messageId: messageId ?? null,
    message,
  }));
}

describe('翻訳統合テスト - Core Rules', () => {
  it('core-errors.js の各ルールが日本語化される', async () => {
    const mod = await importProxyModule();
    const { ESLint: ProxyESLint } = mod;

    const eslint = new ProxyESLint({
      overrideConfigFile: null,
      overrideConfig: [
        {
          files: ['**/*.js'],
          languageOptions: { ecmaVersion: 2020, sourceType: 'module' },
          rules: {
            'no-unused-vars': ['error'],
            'no-undef': ['error'],
            'no-console': ['error'],
            'semi': ['error', 'always'],
            'quotes': ['error', 'single'],
            'eqeqeq': ['error', 'always'],
            'no-var': ['error'],
            'prefer-const': ['error'],
            'no-const-assign': ['error'],
            'no-dupe-keys': ['error'],
            'no-duplicate-case': ['error'],
            'no-unreachable': ['error'],
            'no-empty': ['error'],
            'curly': ['error', 'all'],
            'no-redeclare': ['error'],
          },
        },
      ],
    });

    const filePath = resolve(__dirname, 'fixtures/core-errors.js');
    const code = readFileSync(filePath, 'utf-8');
    const [result] = await eslint.lintText(code, { filePath });

    // エラーが検出されていることを確認
    expect(result.messages.length).toBeGreaterThan(0);

    expect(normalizeMessages(result.messages)).toMatchSnapshot();
  });
});

describe('翻訳統合テスト - TypeScript Rules', () => {
  it('typescript-errors.ts の各ルールが日本語化される', async () => {
    const mod = await importProxyModule();
    const { ESLint: ProxyESLint } = mod;

    const eslint = new ProxyESLint({
      overrideConfigFile: null,
      overrideConfig: [
        {
          files: ['**/*.ts'],
          languageOptions: {
            parser: await import('@typescript-eslint/parser'),
            parserOptions: {
              project: './tsconfig.integration.json',
              tsconfigRootDir: __dirname,
              ecmaVersion: 2020,
              sourceType: 'module',
            },
          },
          plugins: {
            '@typescript-eslint': await import('@typescript-eslint/eslint-plugin').then(m => m.default),
          },
          rules: {
            '@typescript-eslint/no-unused-vars': ['error'],
            '@typescript-eslint/no-explicit-any': ['error'],
            '@typescript-eslint/explicit-function-return-type': ['error'],
            '@typescript-eslint/no-inferrable-types': ['error'],
            '@typescript-eslint/ban-ts-comment': ['error'],
            '@typescript-eslint/no-empty-interface': ['error'],
            '@typescript-eslint/no-var-requires': ['error'],
            '@typescript-eslint/prefer-as-const': ['error'],
            '@typescript-eslint/prefer-namespace-keyword': ['error'],
            '@typescript-eslint/no-namespace': ['error'],
            '@typescript-eslint/adjacent-overload-signatures': ['error'],
            '@typescript-eslint/array-type': ['error', { default: 'array' }],
            '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
            '@typescript-eslint/no-non-null-assertion': ['error'],
            '@typescript-eslint/prefer-optional-chain': ['error'],
          },
        },
      ],
    });

    const filePath = resolve(__dirname, 'fixtures/typescript-errors.ts');
    const code = readFileSync(filePath, 'utf-8');
    const [result] = await eslint.lintText(code, { filePath });

    // エラーが検出されていることを確認
    expect(result.messages.length).toBeGreaterThan(0);

    expect(normalizeMessages(result.messages)).toMatchSnapshot();
  });
});
