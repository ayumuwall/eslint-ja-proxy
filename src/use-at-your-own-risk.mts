import { createRequire } from 'module';

import { bufferMissing } from './missing-logger.js';
import { createProxyHelpers } from './eslint-proxy-core.js';
import type { ESLintLikeConstructor } from './eslint-proxy-core.js';

type UnsupportedApiModule = typeof import('eslint/use-at-your-own-risk');

const require = createRequire(import.meta.url);

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

const unsupportedModule = (loadProjectModule<UnsupportedApiModule>('eslint/use-at-your-own-risk') ??
  require('eslint/use-at-your-own-risk')) as UnsupportedApiModule;

const OriginalFlatESLint = unsupportedModule.FlatESLint as ESLintLikeConstructor | undefined;
const OriginalLegacyESLint = unsupportedModule.LegacyESLint as ESLintLikeConstructor | undefined;

const { createProxyClass } = createProxyHelpers((ruleId, messageId, message) => {
  bufferMissing(ruleId, messageId, message ?? '');
});

const FlatESLintProxy = OriginalFlatESLint ? createProxyClass(OriginalFlatESLint) : OriginalFlatESLint ?? null;
const LegacyESLintProxy = OriginalLegacyESLint ? createProxyClass(OriginalLegacyESLint) : OriginalLegacyESLint ?? null;

const exported = {
  ...unsupportedModule,
  FlatESLint: FlatESLintProxy ?? OriginalFlatESLint,
  LegacyESLint: LegacyESLintProxy ?? OriginalLegacyESLint,
} as UnsupportedApiModule;

export const builtinRules = exported.builtinRules;
export const shouldUseFlatConfig = exported.shouldUseFlatConfig;
export const FileEnumerator = exported.FileEnumerator;
export const FlatESLint = exported.FlatESLint;
export const LegacyESLint = exported.LegacyESLint;

export default exported;
