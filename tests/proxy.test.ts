import { describe, expect, it } from 'vitest';

async function importProxyModule() {
  // NodeNext module resolution allows importing the ESM entry directly.
  return import('../src/index.mts');
}

describe('ESLint proxy exports', () => {
  it('re-exports utilities and translates results via default export', async () => {
    const mod = await importProxyModule();
    const { ESLint: ProxyESLint, Linter, RuleTester, SourceCode, loadESLint } = mod;

    expect(typeof ProxyESLint).toBe('function');
    expect(typeof Linter).toBe('function');
    expect(typeof RuleTester).toBe('function');
    expect(typeof SourceCode).toBe('function');

    const Loaded = await loadESLint({ useFlatConfig: true });
    expect(Loaded).toBe(ProxyESLint);

    const eslint = new ProxyESLint({
      overrideConfig: [
        {
          files: ['**/*.js'],
          languageOptions: { ecmaVersion: 2020, sourceType: 'module' },
          rules: {
            'no-unused-vars': ['error'],
          },
        },
      ],
    });

    const [result] = await eslint.lintText('const unused = 1;', { filePath: 'test.js' });

    expect(result.messages).not.toHaveLength(0);
    expect(result.messages[0].message).toContain('使用されていません');
  });

  it('wraps legacy ESLint constructors returned via loadESLint', async () => {
    const mod = await importProxyModule();
    const { ESLint: ProxyESLint, loadESLint } = mod;

    const LegacyProxy = await loadESLint({ useFlatConfig: false });
    expect(typeof LegacyProxy).toBe('function');
    expect(LegacyProxy).not.toBe(ProxyESLint);

    const legacy = new LegacyProxy({
      useEslintrc: false,
      overrideConfig: {
        parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
        rules: {
          'no-unused-vars': ['error'],
        },
      },
    });

    const [result] = await legacy.lintText('const unused = 1;', { filePath: 'legacy.js' });

    expect(result.messages).not.toHaveLength(0);
    expect(result.messages[0].message).toContain('使用されていません');
  });
});
