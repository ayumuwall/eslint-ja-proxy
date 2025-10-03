import type { LintMessage } from './translate.js';
import type { ESLintLikeConstructor } from './eslint-proxy-core.js';

const { createProxyHelpers } = require('./eslint-proxy-core.js');

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

const unsupportedModule = (loadProjectModule<UnsupportedApiModule>('eslint/use-at-your-own-risk') ??
  require('eslint/use-at-your-own-risk')) as UnsupportedApiModule;

const OriginalFlatESLint = unsupportedModule.FlatESLint as ESLintLikeConstructor | undefined;
const OriginalLegacyESLint = unsupportedModule.LegacyESLint as ESLintLikeConstructor | undefined;

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

const FlatESLintProxy = OriginalFlatESLint ? createProxyClass(OriginalFlatESLint) : OriginalFlatESLint ?? null;
const LegacyESLintProxy = OriginalLegacyESLint ? createProxyClass(OriginalLegacyESLint) : OriginalLegacyESLint ?? null;

const exported = {
  ...unsupportedModule,
  FlatESLint: FlatESLintProxy ?? OriginalFlatESLint,
  LegacyESLint: LegacyESLintProxy ?? OriginalLegacyESLint,
} as UnsupportedApiModule;

module.exports = exported;
module.exports.default = exported;

Object.defineProperty(module.exports, '__esModule', { value: true });
