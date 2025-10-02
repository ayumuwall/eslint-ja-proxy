# AGENTS.md

*この文書は、LLMベースの Coding Agent / CI Bot / 自動翻訳スクリプト向けの運用ガイドです。*

## 目的

- `eslint-ja-proxy` の **翻訳辞書の拡充** と **互換性維持** を、エージェントが安全に自動化できるようにします。
- 人手のレビュー負荷を減らしつつ、**壊れない（未訳＝英語フォールバック）** を前提にします。

---

## リポジトリ構成（抜粋）

```
/dict/
  core.json                 # ESLintコアルール
  angular.json              # @angular-eslint 系
  typescript.json           # @typescript-eslint 系
  overrides/*.json          # バージョン条件付きの追加辞書（例: angular-18-19.json）
/src/
  index.mts                 # ESM エントリ（ESLint ラッパ）
  index.cts                 # CJS エントリ
  translate.ts              # 翻訳ロジック（messageId優先）
  load-dict.ts              # semver による辞書の選択・合成
  missing-logger.ts         # 未訳収集（JSONL）
/scripts/
  snapshot-fixtures/        # スナップショット用の最小プロジェクト群
  generate-keys.ts          # 未訳ログ→辞書テンプレ雛形の生成
```

---

## 翻訳ポリシー

1. **優先度**：`ruleId + messageId + data` → それが無い場合のみ **正規表現** を使用。
2. **可変部**：識別子/数値/プロパティ名は `{name}` `{attr}` `{n}` など **プレースホルダ** を使う。
3. **文体**：丁寧体だが簡潔（IDE の横幅制限を意識）。
4. **用語統一**：`warning=警告` `error=エラー` `attribute=属性` `pipe=パイプ` 等、`TERMS.md` を参照（なければ作成）。
5. **非破壊**：*翻訳に失敗しても英語にフォールバック*。ルールID/件数/位置は書き換えない。

---

## エージェントの標準タスク

### T1: 未訳の収集とテンプレ生成

- 入力：`~/.eslint-ja-proxy/missing.jsonl`（1行1JSON: `{ruleId, messageId, message, data, pluginVersion}`）
- 手順：
  1. `scripts/generate-keys.ts` を実行 → `PR_templates/dict.patch.json` を生成
  2. 既存辞書との差分を取り、**新規キーのみ**を提案
  3. `messageId` が空（未提供）の場合、**正規表現テンプレ**を自動推測（可変部をキャプチャ）
- 出力：`dict/*.json` への追加パッチ (Pull Request)

### T2: バージョン条件付き辞書の仕分け

- 入力：`pluginVersion`（`@angular-eslint/eslint-plugin` などの semver）
- 手順：`load-dict.ts` の条件（例: `>=18 <20`）に合う場合は `overrides/angular-18-19.json` に追加。合わない場合は共通辞書へ。

### T3: スナップショットテスト

- 行列：`ESLint` × `@angular-eslint`（複数レンジ）× Node `>=18`
- 手順：
  1. `scripts/snapshot-fixtures/*` をそれぞれ lint
  2. 生成された **日本語メッセージ** がスナップショットと一致することを確認
  3. **件数・ruleId・messageId・行列** が一致しているかを検証
- 出力：`__snapshots__` の更新（破壊的差分は要レビュー）

### T4: リリース準備

- `CHANGELOG.md` に **追加/修正したルール** と **対応バージョン範囲** を列挙
- `package.json` の `peerDependencies.eslint` / CI マトリクスを確認
- `npm version <patch|minor|major>` → `npm publish`

---

## 実装上の制約（守るべきルール）

- **ESLint API 非破壊**：`results[].messages[]` の `message` 以外は変更しない。
- **同期I/O禁止**：翻訳中にブロッキングI/Oを行わない（未訳ログは非同期でバッファリング）。
- **可観測性**：`LOG_MISSING` が true の場合のみ JSONL に追記。CI では `STRICT` を用いて未訳検出を fail-fast にできる。
- **セキュリティ**：辞書は**データ**であり、`eval` 等を使わない。正規表現は ReDoS を避ける（アンカー・上限・非貪欲）

---

## PR ガイドライン（エージェント/人間共通）

- 1 PR = 1 目的（辞書追加/リファクタ/CI更新の混在を避ける）
- テスト必須：少なくとも 1 つの fixture で新訳がヒットすること
- 命名：`dict/<plugin>.json` に **ruleId** → **messageId** の順でネスト
- コミット例：`feat(dict/angular): add translations for template/i18n (v19)`

---

## ローカル実行レシピ

```bash
# 未訳ログからテンプレ生成
pnpm tsx scripts/generate-keys.ts ~/.eslint-ja-proxy/missing.jsonl

# スナップショット
pnpm test

# 対象レンジの Angular ESLint で検証
pnpm -C scripts/snapshot-fixtures/angular19 test
```

---

## リリースの型

- **patch**: 訳語の微修正・既存ルールの追補
- **minor**: 新規ルール対応・辞書の大幅追加
- **major**: ESLint のメジャー更新に伴う内部変更

---

## 機械可読の仕様追加（LLM/Coding Agent 向け）

### 1) 辞書追記用の JSON スキーマ

**目的**: `ruleId / messageId / data` を軸に、1件ずつ安全に辞書を追加できるようにします。\
\*\*単一エントリ（TranslationEntry）\*\*のスキーマ（JSON Schema draft‑07 互換）：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://example.com/schemas/translation-entry.json",
  "title": "TranslationEntry",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "ruleId": { "type": "string", "minLength": 1 },
    "messageId": { "type": "string", "minLength": 1 },
    "template": { "type": "string", "minLength": 1 },
    "placeholders": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[a-zA-Z_][a-zA-Z0-9_]*$" },
      "uniqueItems": true
    },
    "dataKeys": {
      "description": "ESLint が渡す data オブジェクトで参照するキー。{name} などのテンプレ内プレースホルダと一致させる。",
      "type": "array",
      "items": { "type": "string", "pattern": "^[a-zA-Z_][a-zA-Z0-9_]*$" },
      "uniqueItems": true
    },
    "sourceEnglish": { "type": "string" },
    "notes": { "type": "string" },
    "regex": {
      "description": "messageId が無いルール等のフォールバック用（必要時のみ使用）。",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "pattern": { "type": "string", "minLength": 1 },
        "flags": { "type": "string", "pattern": "^[gimuyUS]*$", "default": "" },
        "template": { "type": "string", "minLength": 1 }
      },
      "required": ["pattern", "template"]
    }
  },
  "allOf": [
    { "required": ["ruleId", "messageId"] },
    {
      "oneOf": [
        { "required": ["template"], "not": { "required": ["regex"] } },
        { "required": ["regex"], "not": { "required": ["template"] } }
      ]
    }
  ]
}
```

- **基本**は `template` を使います。`"変数 '{name}' は未使用です"` のように、`{key}` 形式のプレースホルダを使ってください。
- `regex` は *最後の手段* です。可変部のみをグルーピングし、`template` では `{1}`, `{2}` のようにキャプチャ参照します（英語の細かな変更に強くするため、できるだけ `messageId` を使ってください）。

---

### 2) PR 同梱ファイル `dict.patch.json` の固定フォーマット

**目的**: 自動レビューとマージを簡単にします。

**キー順・型を固定**（トップレベル）:

```jsonc
{
  "plugin": "@angular-eslint/eslint-plugin",   // どのプラグイン用か
  "versionRange": ">=18 <20",                   // 追加辞書の適用レンジ（semver 範囲）
  "entries": [                                   // TranslationEntry の配列
    {
      "ruleId": "@angular-eslint/template/i18n",
      "messageId": "textRequiresI18n",
      "template": "テキストコンテンツには i18n 属性が必要です。",
      "placeholders": [],
      "dataKeys": [],
      "sourceEnglish": "Text content must have an i18n attribute.",
      "notes": "docs: https://..."
    }
  ]
}
```

**各エントリのキー順**（厳守）：

1. `ruleId`
2. `messageId`
3. `template` **または** `regex`
4. `placeholders`
5. `dataKeys`
6. `sourceEnglish`
7. `notes`

**検証**: リポジトリ同梱のスキーマ（`/schemas/translation-entry.json` と `/schemas/dict-patch.json`）で CI が自動検証します。無効な場合は PR をはねます。

---

### 3) 安全ガード（Do/Don't）

**Do（必ず守る）**

- `results[].messages[]` の \`\`\*\* だけ\*\*を書き換える。`ruleId` / `severity` / `line` / `column` / `endLine` など他のフィールドは **変更しない**。
- 未訳・範囲外は **英語のまま**返す（失敗しても壊れない）。
- 正規表現は **アンカー**と**最短量指定**を使い、キャプチャは最小限。ReDoS の恐れがあるパターンは使わない。
- `messageId` がある場合は **必ず ****\`\`**** を優先**し、`regex` は最後の手段にする。
- ログ（未訳収集）は **非同期**で行い、I/O エラーはアプリの結果に影響させない。

**Don't（禁止事項）**

- `message` 以外のフィールドを変更・追加・削除しない（件数や位置、ルールIDを変えない）。
- 同期 I/O（`fs.readFileSync` 等）で実行をブロックしない。ネットワークアクセスもしない。
- `eval` や動的コード生成を使わない。外部から取り込んだ文字列を実行しない。
- メッセージの **並び順を変えない**。新しいエラー/警告を**生成しない**。
- プロセスの終了コードを勝手に変えない（`STRICT` オプションの時だけ例外）。

---

#### 例: `regex` を使うべきかの判断

- `messageId` が存在 → **使わない**（`template` で十分）
- 可変部（識別子名や数値）だけ異なる → `template` に `{name}` などを使う
- サードパーティルールで `messageId` が無い → `regex` 可。`^…$` で全体を縛り、必要な可変部のみ `(…)` でキャプチャ

---

**備考**：この仕様に沿っていれば、LLM/Coding Agent が自動でパッチを作っても、CI とレビューで安全に取り込めます。

