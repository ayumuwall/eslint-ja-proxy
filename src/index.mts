/**
 * ESLint の ESM エントリポイント
 * ESLint をラップして結果を日本語化する
 */

import { createRequire } from 'module';
import type { ESLint as ESLintType } from 'eslint';

const require = createRequire(import.meta.url);

// プロジェクトの eslint を使用（cwd から解決）
function loadProjectESLint() {
  try {
    // プロジェクトの cwd から eslint を解決
    const eslintPath = require.resolve('eslint', { paths: [process.cwd()] });
    // デバッグ: どのESLintを読み込んでいるか確認
    if (process.env.ESLINT_JA_DEBUG) {
      console.error('[eslint-ja-proxy] Loading ESLint from:', eslintPath);
      console.error('[eslint-ja-proxy] CWD:', process.cwd());
    }
    return require(eslintPath);
  } catch (err) {
    // フォールバック: このパッケージの eslint を使用
    if (process.env.ESLINT_JA_DEBUG) {
      console.error('[eslint-ja-proxy] Failed to load project ESLint, using fallback:', err);
    }
    return require('eslint');
  }
}

const { ESLint } = loadProjectESLint() as { ESLint: typeof ESLintType };

import { getDictionary } from './load-dict.js';
import { translateMessages } from './translate.js';
import { bufferMissing } from './missing-logger.js';
import type { LintMessage } from './translate.js';

/**
 * ESLint をラップしたクラス
 */
export class ESLintJaProxy extends ESLint {
  constructor(options?: ESLintType.Options) {
    // cwd が指定されていない場合はプロセスの cwd を使用
    super({
      ...options,
      cwd: options?.cwd || process.cwd(),
    });
  }

  /**
   * lintFiles をオーバーライド
   */
  async lintFiles(patterns: string | string[]): Promise<ESLintType.LintResult[]> {
    const results = await super.lintFiles(patterns);
    return this.translateResults(results);
  }

  /**
   * lintText をオーバーライド
   */
  async lintText(
    code: string,
    options?: { filePath?: string; warnIgnored?: boolean }
  ): Promise<ESLintType.LintResult[]> {
    const results = await super.lintText(code, options);
    return this.translateResults(results);
  }

  /**
   * 結果を翻訳
   */
  private translateResults(results: ESLintType.LintResult[]): ESLintType.LintResult[] {
    const dict = getDictionary();

    return results.map((result) => {
      const translatedMessages = result.messages.map((msg) => {
        const lintMsg = msg as LintMessage;

        // 翻訳を試みる
        const translated = translateMessages([lintMsg], dict)[0];

        // 翻訳されなかった場合は未訳ログに記録
        if (translated.message === lintMsg.message && lintMsg.ruleId) {
          bufferMissing(
            lintMsg.ruleId,
            lintMsg.messageId,
            lintMsg.message
          );
        }

        return translated;
      });

      return {
        ...result,
        messages: translatedMessages,
      };
    });
  }
}

// デフォルトエクスポート（ESLint の代わりに使えるようにする）
export default ESLintJaProxy;

// 名前付きエクスポート（互換性のため）
export { Linter } from 'eslint';
