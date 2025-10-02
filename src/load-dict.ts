/**
 * 辞書の読み込みとバージョンごとの合成
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { TranslationDict } from './translate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// プロジェクトルートを推定（dist/配下にビルドされる想定）
const projectRoot = join(__dirname, '..');

/**
 * 辞書ファイルを読み込む
 */
function loadDictFile(path: string): TranslationDict {
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    // 辞書が見つからない場合は空オブジェクトを返す（非破壊）
    return {};
  }
}

/**
 * 環境変数からどの辞書を有効化するか決定
 * 例: DICT=core,angular,typescript
 */
function getEnabledDicts(): string[] {
  const envDict = process.env.DICT || process.env.eslintJaProxy_DICT;
  if (envDict) {
    return envDict.split(',').map((d) => d.trim());
  }

  // デフォルトは全て有効
  return ['core', 'angular', 'typescript'];
}

/**
 * 辞書を読み込んで合成
 */
export function loadDictionaries(): TranslationDict {
  const enabled = getEnabledDicts();
  const merged: TranslationDict = {};

  for (const name of enabled) {
    const dictPath = join(projectRoot, 'dict', `${name}.json`);
    const dict = loadDictFile(dictPath);

    // マージ
    for (const ruleId in dict) {
      if (!merged[ruleId]) {
        merged[ruleId] = {};
      }
      Object.assign(merged[ruleId], dict[ruleId]);
    }
  }

  // TODO: バージョン条件付き辞書（overrides/*.json）の読み込み
  // 例: angular-18-19.json を @angular-eslint のバージョンが >=18 <20 のときのみ読み込む
  // この実装は semver パッケージを使って package.json から依存バージョンを確認する必要がある

  return merged;
}

/**
 * 辞書のキャッシュ（起動時に一度だけ読み込む）
 */
let cachedDict: TranslationDict | null = null;

export function getDictionary(): TranslationDict {
  if (!cachedDict) {
    cachedDict = loadDictionaries();
  }
  return cachedDict;
}
