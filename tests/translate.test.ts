import { describe, expect, it } from 'vitest';

import { translateMessage, translateMessages, mergeDicts } from '../src/translate.js';
import type { TranslationDict, LintMessage } from '../src/translate.js';

function createLintMessage(overrides: Partial<LintMessage> = {}): LintMessage {
  return {
    ruleId: '@eslint/no-test',
    messageId: 'example',
    message: 'Example message.',
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
    severity: 2,
    nodeType: 'Identifier',
    ...overrides,
  };
}

describe('translateMessage', () => {
  it('指定されたテンプレートに沿ってメッセージだけを差し替える', () => {
    const dict: TranslationDict = {
      '@eslint/no-test': {
        example: "'{name}' はテスト用の警告です。",
      },
    };

    const original = createLintMessage({
      ruleId: '@eslint/no-test',
      message: "'{name}' is a test warning.",
    });

    const translated = translateMessage(original, dict, { name: 'foo' });

    expect(translated.message).toBe("'foo' はテスト用の警告です。");
    expect({
      ...translated,
      message: original.message,
    }).toEqual(original);
  });

  it('辞書に無い場合はメッセージを変更しない', () => {
    const dict: TranslationDict = {
      '@eslint/no-test': {},
    };

    const original = createLintMessage({
      ruleId: '@eslint/no-test',
    });

    const translated = translateMessage(original, dict);

    expect(translated).toBe(original);
  });
});

describe('translateMessages', () => {
  it('複数メッセージをまとめて翻訳する', () => {
    const dict: TranslationDict = {
      '@eslint/no-test': {
        example: '翻訳されました。',
      },
    };

    const messages = [
      createLintMessage({
        ruleId: '@eslint/no-test',
        message: 'Original message.',
      }),
    ];

    const translated = translateMessages(messages, dict);

    expect(translated).toHaveLength(1);
    expect(translated[0].message).toBe('翻訳されました。');
  });
});

describe('mergeDicts', () => {
  it('後勝ちで辞書をマージする', () => {
    const base: TranslationDict = {
      rule: {
        id: 'base',
      },
    };
    const override: TranslationDict = {
      rule: {
        id: 'override',
      },
    };

    const merged = mergeDicts(base, override);

    expect(merged.rule.id).toBe('override');
  });
});
