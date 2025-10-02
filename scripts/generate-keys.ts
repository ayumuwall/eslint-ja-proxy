/**
 * 未訳ログ（missing.jsonl）から辞書テンプレート雛形を生成
 * 
 * Usage:
 *   tsx scripts/generate-keys.ts ~/.eslint-ja-proxy/missing.jsonl
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface MissingEntry {
  ruleId: string;
  messageId?: string;
  message: string;
  data?: Record<string, any>;
  pluginVersion?: string;
  timestamp: string;
}

interface TranslationEntry {
  ruleId: string;
  messageId: string;
  template: string;
  placeholders: string[];
  dataKeys: string[];
  sourceEnglish: string;
  notes?: string;
}

/**
 * プレースホルダを抽出（例: {name}, {type}）
 */
function extractPlaceholders(message: string): string[] {
  const matches = message.match(/\{(\w+)\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1, -1)))];
}

/**
 * JSONL を読み込んで解析
 */
function loadMissingLog(path: string): MissingEntry[] {
  try {
    const content = readFileSync(path, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch (err) {
    console.error(`エラー: ${path} を読み込めませんでした`, err);
    process.exit(1);
  }
}

/**
 * ruleId と messageId でグルーピング
 */
function groupByRuleAndMessage(entries: MissingEntry[]): Map<string, MissingEntry[]> {
  const map = new Map<string, MissingEntry[]>();

  for (const entry of entries) {
    if (!entry.ruleId || !entry.messageId) continue;

    const key = `${entry.ruleId}::${entry.messageId}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(entry);
  }

  return map;
}

/**
 * 辞書エントリを生成
 */
function generateEntries(grouped: Map<string, MissingEntry[]>): TranslationEntry[] {
  const entries: TranslationEntry[] = [];

  for (const [key, items] of grouped) {
    const first = items[0];
    const placeholders = extractPlaceholders(first.message);

    entries.push({
      ruleId: first.ruleId,
      messageId: first.messageId!,
      template: `[TODO] ${first.message}`, // 日本語訳は手動で記入
      placeholders,
      dataKeys: placeholders, // 通常は同じ
      sourceEnglish: first.message,
      notes: `出現回数: ${items.length}`,
    });
  }

  return entries;
}

/**
 * メイン処理
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('使い方: tsx scripts/generate-keys.ts <missing.jsonl>');
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = join(process.cwd(), 'PR_templates', 'dict.patch.json');

  console.log(`読み込み中: ${inputPath}`);
  const entries = loadMissingLog(inputPath);
  console.log(`${entries.length} 件のエントリを読み込みました`);

  const grouped = groupByRuleAndMessage(entries);
  console.log(`${grouped.size} 件のユニークな (ruleId, messageId) を検出`);

  const translationEntries = generateEntries(grouped);

  // 出力用フォーマット
  const output = {
    plugin: 'eslint', // 必要に応じて変更
    versionRange: '*', // 必要に応じて変更
    entries: translationEntries,
  };

  // 出力ディレクトリを作成
  const { mkdirSync } = require('fs');
  mkdirSync(join(process.cwd(), 'PR_templates'), { recursive: true });

  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n生成完了: ${outputPath}`);
  console.log(`\n次の手順:`);
  console.log(`1. ${outputPath} を開いて [TODO] 部分を日本語に翻訳`);
  console.log(`2. 該当する dict/*.json に追加`);
  console.log(`3. テストを実行して動作確認`);
}

main();
