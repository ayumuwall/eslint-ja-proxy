/**
 * ESLint の ESM エントリポイント
 * ESLint をラップして結果を日本語化する
 */

import { createRequire } from 'module';
import type { ESLint as ESLintType } from 'eslint';

import { getDictionary } from './load-dict.js';
import { translateMessage } from './translate.js';
import { bufferMissing } from './missing-logger.js';
import type { LintMessage } from './translate.js';

const require = createRequire(import.meta.url);

type ESLintModule = typeof import('eslint');
type ESLintClass = ESLintModule['ESLint'];
type LoadESLintOptions = {
  useFlatConfig?: boolean;
  cwd?: string;
};

// プロジェクトの eslint を使用（cwd から解決）
function loadProjectESLint(): ESLintModule {
  try {
    const eslintPath = require.resolve('eslint', { paths: [process.cwd()] });
    if (process.env.ESLINT_JA_DEBUG) {
      console.error('[eslint-ja-proxy] Loading ESLint from:', eslintPath);
      console.error('[eslint-ja-proxy] CWD:', process.cwd());
    }
    return require(eslintPath);
  } catch (err) {
    if (process.env.ESLINT_JA_DEBUG) {
      console.error('[eslint-ja-proxy] Failed to load project ESLint, using fallback:', err);
    }
    return require('eslint');
  }
}

const eslintModule = loadProjectESLint();
const { ESLint: OriginalESLint, Linter, RuleTester, SourceCode } = eslintModule;
const originalLoadESLint = (eslintModule as Partial<ESLintModule> & {
  loadESLint?: (options?: LoadESLintOptions) => Promise<ESLintClass>;
}).loadESLint;

const proxyCache = new WeakMap<ESLintClass, ESLintClass>();

function translateLintResults(results: ESLintType.LintResult[]): ESLintType.LintResult[] {
  const dict = getDictionary();

  return results.map((result) => {
    const translatedMessages = result.messages.map((message) => {
      const lintMsg = message as LintMessage;
      const translated = translateMessage(lintMsg, dict);

      if (translated === lintMsg && lintMsg.ruleId) {
        bufferMissing(lintMsg.ruleId, lintMsg.messageId, lintMsg.message);
      }

      return translated;
    });

    return {
      ...result,
      messages: translatedMessages,
    };
  });
}

function createProxyClass(Base: ESLintClass): ESLintClass {
  if (proxyCache.has(Base)) {
    return proxyCache.get(Base)!;
  }

  class ESLintProxy extends Base {
    constructor(options?: ESLintType.Options) {
      super({
        ...options,
        cwd: options?.cwd || process.cwd(),
      });
    }

    async lintFiles(patterns: string | string[]): Promise<ESLintType.LintResult[]> {
      const results = await super.lintFiles(patterns);
      return translateLintResults(results as ESLintType.LintResult[]);
    }

    async lintText(
      code: string,
      options?: { filePath?: string; warnIgnored?: boolean }
    ): Promise<ESLintType.LintResult[]> {
      const results = await super.lintText(code, options as never);
      return translateLintResults(results as ESLintType.LintResult[]);
    }
  }

  proxyCache.set(Base, ESLintProxy as unknown as ESLintClass);
  return proxyCache.get(Base)!;
}

const ESLintJaProxy = createProxyClass(OriginalESLint as unknown as ESLintClass);

export { Linter, RuleTester, SourceCode };

export async function loadESLint(options?: LoadESLintOptions): Promise<ESLintClass> {
  if (!originalLoadESLint) {
    return ESLintJaProxy as ESLintClass;
  }

  const LoadedESLint = await originalLoadESLint(options);
  return createProxyClass(LoadedESLint as ESLintClass);
}

export { ESLintJaProxy };
export { ESLintJaProxy as ESLint };
export default ESLintJaProxy;
