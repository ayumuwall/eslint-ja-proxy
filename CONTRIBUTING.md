# コントリビューションガイド

`eslint-ja-proxy` へのコントリビューションをお待ちしています！

## 翻訳の追加方法

### 1. 未訳メッセージを見つける

実際に ESLint を使用して、英語のまま表示されるメッセージを見つけてください。

環境変数を設定すると、未訳メッセージが自動的にログに記録されます：

```bash
export LOG_MISSING=true
npx eslint-ja "src/**/*.ts"
```

ログは `~/.eslint-ja-proxy/missing.jsonl` に保存されます。

### 2. 辞書にエントリを追加

該当するプラグインの辞書ファイルを編集してください：

- ESLint コアルール → `dict/core.json`
- @angular-eslint → `dict/angular.json`
- @typescript-eslint → `dict/typescript.json`

フォーマット例：

```json
{
  "no-unused-vars": {
    "unusedVar": "'{name}' は定義されていますが使用されていません。"
  }
}
```

- **ruleId**: ESLint ルール ID
- **messageId**: メッセージ ID（ESLint が提供）
- **値**: 日本語テンプレート（`{name}` などのプレースホルダを含む）

### 3. テストを追加

簡単なテストケースを追加してください（任意ですが推奨）。

### 4. Pull Request を作成

以下の情報を含めてください：

- 追加したルール名とメッセージ ID
- 元の英語メッセージ
- 日本語訳

## 自動生成ツールの使用

未訳ログから辞書テンプレートを自動生成できます：

```bash
pnpm tsx scripts/generate-keys.ts ~/.eslint-ja-proxy/missing.jsonl
```

生成されたファイル `PR_templates/dict.patch.json` を確認し、`[TODO]` 部分を日本語に翻訳してください。

## 開発環境のセットアップ

```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# テスト
npm test
```

## コーディング規約

- **非破壊**: ESLint の結果（件数、位置、ruleId）は変更しません
- **フォールバック**: 未訳の場合は英語のまま表示
- **簡潔**: IDE の横幅を考慮して簡潔な日本語を使用
- **丁寧語**: 「です・ます」調を基本とします

## 用語統一

- warning → 警告
- error → エラー
- attribute → 属性
- property → プロパティ
- method → メソッド
- function → 関数
- variable → 変数
- constant → 定数

## バージョン固有の翻訳

特定のバージョン範囲でのみ有効な翻訳は `dict/overrides/` に配置します：

```
dict/overrides/angular-18-19.json  # @angular-eslint >=18 <20
```

詳細は `AGENTS.md` を参照してください。

## 質問・提案

Issue や Discussion でお気軽にご相談ください！
