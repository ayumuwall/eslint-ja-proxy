/**
 * ESLint の CJS エントリポイント
 * CommonJS 環境で使用するためのラッパー
 */

import type { ESLint as ESLintType } from 'eslint';
import type { LintMessage } from './translate.js';

type ESLintModule = typeof import('eslint');
type ESLintClass = ESLintModule['ESLint'];
type ESLintLoadFn = (options?: { useFlatConfig?: boolean; cwd?: string }) => Promise<ESLintClass>;

type MissingLoggerModule = {
  bufferMissing?: (
    ruleId: string,
    messageId: LintMessage['messageId'],
    message: string,
    data?: Record<string, unknown>
  ) => void;
};

// プロジェクトの eslint を直接使用
function loadProjectESLint(): ESLintModule {
  try {
    const eslintPath = require.resolve('eslint', { paths: [process.cwd()] });
    return require(eslintPath);
  } catch (err) {
    if (process.env.ESLINT_JA_DEBUG) {
      console.error('[eslint-ja-proxy] Failed to load project ESLint (CJS), using fallback:', err);
    }
    return require('eslint');
  }
}

const eslintModule = loadProjectESLint();
const { ESLint: OriginalESLint, Linter, RuleTester, SourceCode } = eslintModule;
const originalLoadESLint: ESLintLoadFn | null =
  typeof eslintModule.loadESLint === 'function'
    ? (eslintModule.loadESLint as ESLintLoadFn).bind(eslintModule)
    : null;

const { getDictionary }: { getDictionary: () => Record<string, Record<string, string>> } = require('./load-dict.js');
const { translateMessage }: { translateMessage: (message: LintMessage, dict: Record<string, any>) => LintMessage } =
  require('./translate.js');

let missingLoggerModule: MissingLoggerModule | null = null;
let missingLoggerLoad: Promise<MissingLoggerModule | null> | null = null;

function logMissing(ruleId: string, messageId: LintMessage['messageId'], message: string | undefined) {
  if (!ruleId) {
    return;
  }

  if (missingLoggerModule && typeof missingLoggerModule.bufferMissing === 'function') {
    missingLoggerModule.bufferMissing(ruleId, messageId, message ?? '');
    return;
  }

  if (!missingLoggerLoad) {
    missingLoggerLoad = import('./missing-logger.js')
      .then((mod) => {
        const resolved = mod as MissingLoggerModule;
        missingLoggerModule = resolved;
        return resolved;
      })
      .catch(() => {
        missingLoggerLoad = null;
        return null;
      });
  }

  const pending = missingLoggerLoad;
  if (!pending) {
    return;
  }

  pending.then((mod: MissingLoggerModule | null) => {
    if (mod && typeof mod.bufferMissing === 'function') {
      mod.bufferMissing(ruleId, messageId, message ?? '');
    }
  });
}

const proxyCache = new WeakMap<ESLintClass, ESLintClass>();

function translateLintResults(results: ESLintType.LintResult[]): ESLintType.LintResult[] {
  const dict = getDictionary();

  return results.map((result) => {
    const translatedMessages = result.messages.map((message) => {
      const lintMsg = message as LintMessage;
      const translated = translateMessage(lintMsg, dict);

      if (translated === lintMsg && lintMsg?.ruleId) {
        logMissing(lintMsg.ruleId, lintMsg.messageId, lintMsg.message);
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
        cwd: (options && options.cwd) || process.cwd(),
      });
    }

    async lintFiles(patterns: string | string[]): Promise<ESLintType.LintResult[]> {
      const results = await super.lintFiles(patterns);
      return translateLintResults(results as ESLintType.LintResult[]);
    }

    async lintText(
      code: string,
      options?: Parameters<ESLintType['lintText']>[1]
    ): Promise<ESLintType.LintResult[]> {
      const results = await super.lintText(code, options);
      return translateLintResults(results as ESLintType.LintResult[]);
    }
  }

  proxyCache.set(Base, ESLintProxy as unknown as ESLintClass);
  return proxyCache.get(Base)!;
}

const ESLintJaProxyCJS = createProxyClass(OriginalESLint as ESLintClass);

module.exports = ESLintJaProxyCJS;
module.exports.ESLint = ESLintJaProxyCJS;
module.exports.default = ESLintJaProxyCJS;
module.exports.Linter = Linter;
if (RuleTester) {
  module.exports.RuleTester = RuleTester;
}
if (SourceCode) {
  module.exports.SourceCode = SourceCode;
}

module.exports.loadESLint = async function loadESLint(options?: Parameters<NonNullable<ESLintLoadFn>>[0]) {
  if (!originalLoadESLint) {
    return ESLintJaProxyCJS;
  }

  const LoadedESLint = await originalLoadESLint(options);
  return createProxyClass(LoadedESLint as ESLintClass);
};
