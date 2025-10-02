# eslint-ja-proxy

[![CI](https://github.com/ayumuwall/eslint-ja-proxy/actions/workflows/ci.yml/badge.svg)](https://github.com/ayumuwall/eslint-ja-proxy/actions/workflows/ci.yml)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/ayumuwall/eslint-ja-proxy/ci.yml?branch=main&label=tests)](https://github.com/ayumuwall/eslint-ja-proxy/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/eslint-ja-proxy.svg)](https://www.npmjs.com/package/eslint-ja-proxy)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

ESLint のエラーメッセージを **日本語**にします。  
JetBrains（WebStorm/IntelliJ）、VS Code、CLI/CI など **ESLint を使う場所ならどこでも**動きます。

---

## これは何？
**ESLint を薄くラップして、出力メッセージだけ日本語に置き換える**ツールです。ルールの動きや件数・位置情報は変えません。未対応のものは **英語のまま**出ます（壊れません）。

---

## 対応環境
- Node.js: `>=18`
- ESLint: `^8.57.0 || ^9`
- エディタ: JetBrains, VS Code, Neovim/LSP, ほか

---

## インストール
```bash
npm i -D eslint eslint-ja-proxy
```

---

## 使い方（かんたん）
### JetBrains（WebStorm/IntelliJ）
1. IDE設定 → **Languages & Frameworks > JavaScript > Code Quality Tools > ESLint**
2. **Manual ESLint configuration** を選ぶ
3. **ESLint package** に `node_modules/eslint-ja-proxy` を指定
→ *Problems* に日本語メッセージが出ます

### VS Code
**おすすめ：npm エイリアス** で `eslint` を置き換えます。
```json
{
  "devDependencies": {
    "eslint": "npm:eslint-ja-proxy@^0.1.0"
  }
}
```
> 既存の `eslint` を残したい場合は、`eslint.nodePath` を別フォルダに向けて、そこへ本パッケージを `eslint` 名で入れてください。

### CLI / CI
付属のラッパー CLI を使います。
```bash
npx eslint-ja "src/**/*.{ts,js,html}"
```
または Node の `--require` で常時パッチ：
```bash
node -r eslint-ja-proxy/register node_modules/.bin/eslint .
```

---

## どこが日本語になる？
- **仕組み**：`ruleId + messageId (+ data)` を鍵に、対応する日本語テンプレへ置き換えます
- **辞書**：`core`（ESLint本体） / `angular`（@angular-eslint） / `typescript`（@typescript-eslint）を同梱
- **未訳**：英語のまま表示（あとから増やせます）

必要なら有効化する辞書を指定できます（省略時は自動）。
```json
{
  "eslintJaProxy": { "DICT": "core,angular,typescript" }
}
```

---

## 仕組み（ざっくり図）
```
[ESLint 実行]
   ↓
[結果 results[].messages[] を取得]
   ↓  messageId / data を見て訳文に置換（なければ英語のまま）
   ↓
[IDE/CLI へそのまま返す]  ← 位置・件数・ruleId は変更しない
```

---

## バージョン違いへの対応（大事）
プラグインの更新で `messageId` が増えたり変わることがあります。そこで：
- **共通辞書 + 追加辞書（バージョン範囲ごと）** を合成します
- 例）`@angular-eslint` が `>=18 <20` のときだけ `overrides/angular-18-19.json` を上書き読込
- 合わない場合は **英語にフォールバック**（壊れません）

---

## トラブル時のチェック
- JetBrains：**Manual** になっているか？ **ESLint package** が `eslint-ja-proxy` か？
- VS Code：`node_modules/eslint` が **このパッケージ**になっているか？（npm エイリアス）
- CI：`npx eslint-ja` を呼んでいるか？

---

## よくある質問（FAQ）
**Q. ルールの動きや自動修正は変わりますか？**  
A. 変わりません。**メッセージ文字列だけ**を置き換えます。

**Q. JetBrains専用ですか？**  
A. いいえ。VS Code や CLI でも使えます。

**Q. 英語のまま出ることがある？**  
A. 未訳のときは英語になります。使いながら徐々に辞書を増やせます。

---

## コントリビュート方法（歓迎！）
1. 使ってみて、**英語のまま出たメッセージ**を見つける
2. `dict/` の該当プラグイン（例：`angular.json`）に **`ruleId > messageId`** で追記
3. `data`（`{name}` など）はテンプレ `{name}` に置き換え
4. 簡単なテストを追加（1つのサンプルでヒットすればOK）
5. PR を送ってください！

> 自動で未訳を集める仕組み（JSONL 追記）もあります。詳しくは **AGENTS.md** を参照。

---

## ライセンス
MIT
