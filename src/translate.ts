/**
 * ESLint メッセージを日本語に翻訳する
 */

export interface TranslationDict {
  [ruleId: string]: {
    [messageId: string]: string;
  };
}

export interface LintMessage {
  ruleId: string | null;
  messageId?: string;
  message: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity: number;
  [key: string]: any;
}

/**
 * テンプレート文字列内のプレースホルダを data で置換
 * 例: "変数 '{name}' は未使用です" + {name: "foo"} → "変数 'foo' は未使用です"
 */
function replacePlaceholders(template: string, data: Record<string, any> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match;
  });
}

/**
 * 単一のメッセージを翻訳
 */
export function translateMessage(
  message: LintMessage,
  dict: TranslationDict,
  data?: Record<string, any>
): LintMessage {
  // ruleId または messageId が無い場合はスキップ
  if (!message.ruleId || !message.messageId) {
    return message;
  }

  const ruleTranslations = dict[message.ruleId];
  if (!ruleTranslations) {
    return message;
  }

  const template = ruleTranslations[message.messageId];
  if (!template) {
    return message;
  }

  // テンプレートを data で置換
  const translatedMessage = replacePlaceholders(template, data);

  // message のみを書き換える（他のフィールドは変更しない）
  return {
    ...message,
    message: translatedMessage,
  };
}

/**
 * 複数のメッセージを一括翻訳
 */
export function translateMessages(
  messages: LintMessage[],
  dict: TranslationDict
): LintMessage[] {
  return messages.map((msg) => {
    // ESLint が message に埋め込んだ data を抽出する試み
    // 実際の data は message オブジェクトの外に出ている場合もあるが、
    // ここでは messageId ベースの翻訳を優先する
    return translateMessage(msg, dict);
  });
}

/**
 * 複数の辞書をマージ（後のものが優先）
 */
export function mergeDicts(...dicts: TranslationDict[]): TranslationDict {
  const merged: TranslationDict = {};

  for (const dict of dicts) {
    for (const ruleId in dict) {
      if (!merged[ruleId]) {
        merged[ruleId] = {};
      }
      Object.assign(merged[ruleId], dict[ruleId]);
    }
  }

  return merged;
}
