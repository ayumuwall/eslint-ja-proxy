/**
 * ESLint の CJS エントリポイント
 * JetBrains など既存ツールと互換な API 形状を維持しつつ
 * lint 結果のメッセージを日本語に翻訳する
 */

import type { ESLint as ESLintType } from 'eslint';
import type { LintMessage } from './translate.js';
import type { ESLintLikeConstructor } from './eslint-proxy-core.js';

type ESLintModule = typeof import('eslint');
type UnsupportedApiModule = typeof import('eslint/use-at-your-own-risk');

type MissingLoggerModule = {
  bufferMissing?: (
    ruleId: string,
    messageId: LintMessage['messageId'],
    message: string,
    data?: Record<string, unknown>
  ) => void;
};

function loadProjectModule<T>(specifier: string): T | null {
  try {
    const resolved = require.resolve(specifier, { paths: [process.cwd()] });
    return require(resolved) as T;
  } catch (err) {
    if (process.env.ESLINT_JA_DEBUG) {
      console.error(`[eslint-ja-proxy] Failed to resolve ${specifier} from project`, err);
    }
    try {
      return require(specifier) as T;
    } catch (fallbackErr) {
      if (process.env.ESLINT_JA_DEBUG) {
        console.error(`[eslint-ja-proxy] Failed to fallback require for ${specifier}`, fallbackErr);
      }
      return null;
    }
  }
}

const eslintModule = (loadProjectModule<ESLintModule>('eslint') ?? require('eslint')) as ESLintModule;
const unsupportedModule = loadProjectModule<UnsupportedApiModule>('eslint/use-at-your-own-risk');

const { Linter, RuleTester, SourceCode } = eslintModule;
const OriginalESLint = eslintModule.ESLint as ESLintLikeConstructor | undefined;
const originalLoadESLint =
  typeof eslintModule.loadESLint === 'function'
    ? (eslintModule.loadESLint as ESLintModule['loadESLint']).bind(eslintModule)
    : null;

const OriginalFlatESLint = (unsupportedModule?.FlatESLint ?? null) as ESLintLikeConstructor | null;
const OriginalLegacyESLint = (unsupportedModule?.LegacyESLint ?? null) as ESLintLikeConstructor | null;

const { createProxyHelpers } = require('./eslint-proxy-core.js');

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

const { createProxyClass } = createProxyHelpers(logMissing);

const ESLintProxy = OriginalESLint ? createProxyClass(OriginalESLint) : null;
const FlatESLintProxy = OriginalFlatESLint ? createProxyClass(OriginalFlatESLint) : null;
const LegacyESLintProxy = OriginalLegacyESLint ? createProxyClass(OriginalLegacyESLint) : null;

async function loadESLintProxy(options?: Parameters<NonNullable<ESLintModule['loadESLint']>>[0]) {
  if (!originalLoadESLint) {
    if (options?.useFlatConfig === false && LegacyESLintProxy) {
      return LegacyESLintProxy;
    }
    if (options?.useFlatConfig && FlatESLintProxy) {
      return FlatESLintProxy;
    }
    return (ESLintProxy ?? OriginalESLint) as ESLintLikeConstructor;
  }

  const LoadedESLint = await originalLoadESLint(options);
  return createProxyClass(LoadedESLint as ESLintLikeConstructor);
}

const exported: Record<string, unknown> = {
  ...eslintModule,
  ESLint: (ESLintProxy ?? OriginalESLint) as ESLintModule['ESLint'],
  loadESLint: loadESLintProxy as ESLintModule['loadESLint'],
  Linter,
  RuleTester,
  SourceCode,
  FlatESLint: (FlatESLintProxy ?? OriginalFlatESLint) ?? undefined,
  LegacyESLint: (LegacyESLintProxy ?? OriginalLegacyESLint) ?? undefined,
};

module.exports = exported;
module.exports.default = exported;
module.exports.ESLint = exported.ESLint;
module.exports.loadESLint = exported.loadESLint;
module.exports.Linter = Linter;
module.exports.RuleTester = RuleTester;
module.exports.SourceCode = SourceCode;
module.exports.FlatESLint = exported.FlatESLint;
module.exports.LegacyESLint = exported.LegacyESLint;

Object.defineProperty(module.exports, '__esModule', { value: true });
