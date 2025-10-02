/**
 * ESLint の ESM エントリポイント
 * ESLint をラップして結果を日本語化する
 */

import { ESLint } from 'eslint';
import { getDictionary } from './load-dict.js';
import { translateMessages } from './translate.js';
import { bufferMissing } from './missing-logger.js';
import type { LintMessage } from './translate.js';

/**
 * ESLint をラップしたクラス
 */
export class ESLintJaProxy extends ESLint {
  constructor(options?: ESLint.Options) {
    super(options);
  }

  /**
   * lintFiles をオーバーライド
   */
  async lintFiles(patterns: string | string[]): Promise<ESLint.LintResult[]> {
    const results = await super.lintFiles(patterns);
    return this.translateResults(results);
  }

  /**
   * lintText をオーバーライド
   */
  async lintText(
    code: string,
    options?: { filePath?: string; warnIgnored?: boolean }
  ): Promise<ESLint.LintResult[]> {
    const results = await super.lintText(code, options);
    return this.translateResults(results);
  }

  /**
   * 結果を翻訳
   */
  private translateResults(results: ESLint.LintResult[]): ESLint.LintResult[] {
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
