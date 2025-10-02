# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [9.0.0-proxy.1] - 2025-10-02

### Changed

- JetBrains IDE で ESLint 8/9 相当として認識されるよう、パッケージバージョンを `9.0.0-proxy.1` に変更（実際のプロキシ機能の内部バージョンは `proxyVersion` で追跡）。
- ESLint API ラップを刷新し、`loadESLint` を含む公式エクスポートを再公開して IDE 連携を修正。
- レガシー `CLIEngine` パスにフォールバックせずに翻訳を適用できるよう、ESM/CJS 双方でプロキシクラスを動的生成。
- JetBrains 互換を検証するユニットテストを追加。

## [0.1.0] - 2025-10-02

### Added

- 初回リリース
- ESLint コアルールの日本語翻訳辞書
- @typescript-eslint プラグインの翻訳辞書
- @angular-eslint プラグインの翻訳辞書
- JetBrains IDE 対応（Manual ESLint configuration）
- VS Code 対応（npm エイリアス）
- CLI ラッパー（`eslint-ja` コマンド）
- Node.js `--require` フック（`eslint-ja-proxy/register`）
- 未訳メッセージの自動ログ機能（JSONL 形式）
- 辞書テンプレート生成ツール（`scripts/generate-keys.ts`）
- JSON スキーマ（TranslationEntry、DictPatch）
- ESM/CJS 両対応

### Features

- **非破壊**: ESLint の結果（件数、位置、ruleId）は変更しません
- **フォールバック**: 未訳メッセージは英語のまま表示されます
- **拡張可能**: 辞書は JSON ファイルで管理され、簡単に追加できます
- **バージョン対応**: プラグインのバージョンごとに辞書を切り替え可能

### Supported Versions

- Node.js: `>=18`
- ESLint: `^8.57.0 || ^9`

### Translations

初期リリースで以下のルールの翻訳を含みます：

**ESLint コア**:
- no-unused-vars
- no-undef
- no-console
- semi
- quotes
- eqeqeq
- no-var
- prefer-const
- その他多数

**@typescript-eslint**:
- no-unused-vars
- no-explicit-any
- explicit-function-return-type
- ban-ts-comment
- prefer-as-const
- その他多数

**@angular-eslint**:
- template/i18n
- template/no-negated-async
- component-class-suffix
- directive-class-suffix
- その他多数

[0.1.0]: https://github.com/your-org/eslint-ja-proxy/releases/tag/v0.1.0
