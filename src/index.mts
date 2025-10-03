/**
 * ESLint の ESM エントリポイント
 * lint 結果を翻訳しつつ公式 API 互換の形状を維持する
 */

import { createRequire } from 'module';
import type { ESLint as ESLintType } from 'eslint';

import { bufferMissing } from './missing-logger.js';
import { createProxyHelpers } from './eslint-proxy-core.js';
import type { ESLintLikeConstructor } from './eslint-proxy-core.js';

const require = createRequire(import.meta.url);

type ESLintModule = typeof import('eslint');
type UnsupportedApiModule = typeof import('eslint/use-at-your-own-risk');

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
  typeof eslintModule.loadESLint === 'function' ? eslintModule.loadESLint.bind(eslintModule) : null;

const OriginalFlatESLint = (unsupportedModule?.FlatESLint ?? null) as ESLintLikeConstructor | null;
const OriginalLegacyESLint = (unsupportedModule?.LegacyESLint ?? null) as ESLintLikeConstructor | null;

const { createProxyClass } = createProxyHelpers((ruleId, messageId, message) => {
  bufferMissing(ruleId, messageId, message ?? '');
});

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

const ESLintExport = (ESLintProxy ?? OriginalESLint) as ESLintModule['ESLint'];
const FlatESLintExport = (FlatESLintProxy ?? OriginalFlatESLint) as
  | UnsupportedApiModule['FlatESLint']
  | null;
const LegacyESLintExport = (LegacyESLintProxy ?? OriginalLegacyESLint) as
  | UnsupportedApiModule['LegacyESLint']
  | null;
const loadESLintExport = loadESLintProxy as ESLintModule['loadESLint'];

export const ESLint = ESLintExport;
export const loadESLint = loadESLintExport;
export const FlatESLint = FlatESLintExport ?? undefined;
export const LegacyESLint = LegacyESLintExport ?? undefined;
export { Linter, RuleTester, SourceCode };

const defaultExport: Record<string, unknown> = {
  ...eslintModule,
  ESLint: ESLintExport,
  loadESLint: loadESLintExport,
  Linter,
  RuleTester,
  SourceCode,
  FlatESLint: FlatESLintExport ?? undefined,
  LegacyESLint: LegacyESLintExport ?? undefined,
};

export default defaultExport;
