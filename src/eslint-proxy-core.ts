import type { ESLint as ESLintType } from 'eslint';

import { getDictionary } from './load-dict.js';
import { translateMessage } from './translate.js';
import type { LintMessage } from './translate.js';

export type MissingLogger = (
  ruleId: string,
  messageId: LintMessage['messageId'],
  message: string | undefined
) => void;

export type ESLintLikeInstance = {
  lintFiles(patterns: string | string[]): Promise<ESLintType.LintResult[]>;
  lintText(code: string, options?: unknown): Promise<ESLintType.LintResult[]>;
};

export type ESLintLikeConstructor<T extends ESLintLikeInstance = ESLintLikeInstance> = new (
  ...args: any[]
) => T;

export function createProxyHelpers(logMissing: MissingLogger | null) {
  const proxyCache = new WeakMap<ESLintLikeConstructor, ESLintLikeConstructor>();

  function translateLintResults(results: ESLintType.LintResult[]): ESLintType.LintResult[] {
    const dict = getDictionary();

    return results.map((result) => {
      if (process.env.ESLINT_JA_DEBUG) {
        console.error(
          `[eslint-ja-proxy] translateLintResults file=${result.filePath ?? 'unknown'} messages=${result.messages.length}`
        );
      }

      const messages = result.messages.map((message) => {
        const lintMsg = message as LintMessage;
        const translated = translateMessage(lintMsg, dict);

        if (logMissing && translated === lintMsg && lintMsg.ruleId) {
          logMissing(lintMsg.ruleId, lintMsg.messageId, lintMsg.message);
        }

        if (process.env.ESLINT_JA_DEBUG) {
          const preview = (translated.message ?? '').slice(0, 80);
          console.error(`[eslint-ja-proxy] translated rule=${lintMsg.ruleId ?? 'unknown'} msg=${preview}`);
        }

        return translated;
      });

      return {
        ...result,
        messages,
      };
    });
  }

  function normalizeOptions(options: unknown): unknown {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      return options;
    }

    const normalized = { ...(options as Record<string, unknown>) };
    if (!('cwd' in normalized) || normalized.cwd == null) {
      normalized.cwd = process.cwd();
    }
    return normalized;
  }

  function createProxyClass<T extends ESLintLikeConstructor>(Base: T): T {
    if (proxyCache.has(Base)) {
      return proxyCache.get(Base)! as T;
    }

    class ESLintProxy extends Base {
      constructor(...args: any[]) {
        if (args.length > 0) {
          const [first, ...rest] = args;
          super(normalizeOptions(first), ...rest);
        } else {
          super();
        }
      }

      async lintFiles(...args: Parameters<ESLintLikeInstance['lintFiles']>): Promise<ESLintType.LintResult[]> {
        const results = await super.lintFiles(...args);
        return translateLintResults(results as ESLintType.LintResult[]);
      }

      async lintText(...args: Parameters<ESLintLikeInstance['lintText']>): Promise<ESLintType.LintResult[]> {
        const results = await super.lintText(...args);
        return translateLintResults(results as ESLintType.LintResult[]);
      }
    }

    proxyCache.set(Base, ESLintProxy as unknown as ESLintLikeConstructor);
    return proxyCache.get(Base)! as T;
  }

  return {
    createProxyClass,
    translateLintResults,
  } as const;
}
