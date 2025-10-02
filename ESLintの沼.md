# ESLint の沼

OpenAI Codex (GPT-5-codex), Ayumu Magoshi　著<br>
<br>
<br>
ESLint は JavaScript/TypeScript エコシステムの中でも、とりわけ構成と互換性が複雑なプロジェクトだ。歴史的事情と現行仕様、その上に乗っかるエディタ連携の意図が絡み合い、「なぜこうなっているのか」を辿るだけでちょっとした深海探索になる。本稿では、最新の調査で見えてきた “沼ポイント” を整理してみる。

## Legacy config と Flat config — 二重構造の始まり
ESLint は長らく `.eslintrc` ファイル（JSON / YAML / JS など）で設定するスタイルを採用してきた。これがいわゆる **Legacy config** だ。ESLint 8 になっても `.eslintrc*` が廃止されたわけではなく、後方互換のために存続している。

一方で新世代の構成として **Flat config** が導入された。設定ファイルは `eslint.config.js`（または `.mjs` / `.cjs`）に統一され、`export default [ ... ]` 形式の配列で設定を記述する。より柔軟でモジュラブルな設計だが、旧構成との差は大きく、公式ドキュメントでも「移行は慎重に」というスタンスだ。

結果として ESLint 本体は、「Legacy config を扱う API」と「Flat config を扱う API」を同時に抱えることになった。ライブラリの中身を覗くと、`require('eslint')` にある `ESLint` クラスが両対応を担い、加えて `require('eslint/lib/unsupported-api')` 配下に `LegacyESLint` と `FlatESLint` が提供されている。名前から伝わるように、`LegacyESLint` は旧 `.eslintrc` を扱うための互換クラスだ（CLIEngine の進化系と捉えるとわかりやすい）。

## CLIEngine — 同期時代の司令塔
CLIEngine は ESLint 0.x〜7 系で公式 CLI とエディタ連携を一手に引き受けてきた司令塔だ。`new CLIEngine(options)` を呼び出すと、内部で `Linter` インスタンスを束ね、`.eslintrc*` を辿ってルール・プラグイン・設定を同期的に解決し、`executeOnFiles` / `executeOnText` で lint 結果を吐き出す。今となっては懐かしい `CLIEngine.getFormatter()` もここにぶら下がっていて、フォーマッタのキャッシュや `--fix` の差分計算、`--cache` のファイルハッシュ管理まで面倒を見ていた。

仕組みをもう少し覗くと、CLIEngine は「設定解決のフロントエンド」と「Linter の実行エンジン」を二層に分けて扱う設計だった。前段には `CascadingConfigArrayFactory`（旧 ConfigFactory）があり、`extends` を展開して最終的なフェーズ済み設定を生成する。後段の `Linter` が実際の AST 走査とルール適用を担当し、CLIEngine はその橋渡し役として `lintResultCache` のキー生成や、`resolveFileGlobPatterns` を通じたパス解決を補助している。つまり CLIEngine を眺めると、ESLint が「設定の合成」「ルールの実行」「結果の整形」をどう分業していたかが透けて見える。

ではなぜ退場したのか。最大の理由は **非同期化** と **Flat config への対応** だ。プラグインが ESM を採用したり、設定がファイルシステムや HTTP 越しに解決されるケースが増え、同期 API である CLIEngine は拡張性のボトルネックになった。ESLint 7.0 で非推奨となり、8.0 でトップレベルから削除されたのは、`await new ESLint()` に集約してローダを完全に async 化するための地ならしだったわけだ。

それでも CLIEngine の影響は各所に残る。JetBrains や Vue CLI の古いバージョンは「とりあえず CLIEngine」と決め打ちしていたし、サードパーティのラッパーも `executeOnFiles` を直接呼ぶコードが散見される。ESLint 本体は互換性の出口として `require('eslint/lib/unsupported-api')` に CLIEngine を細々と掲載し続けているが、もはや “unsupported” の名が示す通り、未来の保証はない。だからこそプロキシ実装では、CLIEngine を求められた場合にどうフォールバックさせるか（あるいは `LegacyESLint` へ誘導するか）を押さえておく必要があるのだ。

## JetBrains が追随するやり方
JetBrains (PhpStorm / WebStorm) は ESLint の Node API を利用して IDE 内で lint を実行する。このとき、ターゲットプロジェクトが Legacy config なのか Flat config なのかを自動判定し、適切なコンストラクタを選択するようになっている。仕組みは次の通り。

- JetBrains 同梱の ESLint 語学サービスは `javascript-plugin/languageService/eslint/src/eslint-plugin-provider.ts` にあり、ここで `state.linterPackageVersion` の先頭メジャー値を見て、**ESLint 8 以上なら `ESLint8Plugin`、それ未満なら `ESLintPlugin`** を選ぶ。
- `ESLint8Plugin` 側では `require('../lib/unsupported-api')` から `LegacyESLint` / `FlatESLint` をロードし、`requestArguments.flatConfig` フラグでどちらのコンストラクタを呼ぶか切り替えている。Flat config を検知していれば `FlatESLint`、従来の `.eslintrc` であれば `LegacyESLint` を使う。

今回、プロキシパッケージのバージョンを `0.1.0` のまま IDE に渡したところ、JetBrains は旧 `ESLintPlugin`（CLIEngine ベース）を選択してしまい、ESLint 9 では存在しない `CLIEngine` を探しに行って「設定エラー」で止まっていた。そこでバージョンを `9.0.0-proxy.1` に変え、JetBrains に ESLint 8/9 相当であると認識させたところ、`ESLint8Plugin` が選択され、`ESLint` コンストラクタ経由でプロキシが呼ばれるようになった —— という顛末だ。

なお Semantic Versioning 的には “ESLint 9 互換” を名乗っていることになり、内実の差分は `proxyVersion` として別途追跡する形にした。JetBrains 側で将来判定方法が変われば再度追随が必要だが、現時点では仕様通りに動く最も素直なアプローチと言える。

## プロキシ側で足りなかったもの
ここまでくると次に問題になるのが `LegacyESLint` 互換の実装だ。`ESLint8Plugin` は `new this.LegacyESLint(options)` を呼ぶため、プロキシが返すコンストラクタが `LegacyESLint` と同じインターフェースを持っていないと `TypeError: this.LegacyESLint is not a constructor` で落ちる。実際に IDE ではこのエラーが発生して、翻訳済みメッセージが表示されない状態になっていた。

つまり、「`ESLint` を丸ごと差し替える」だけでは足りず、`lib/unsupported-api.LegacyESLint` / `FlatESLint` もプロキシ経由でラップする必要がある、という学びが得られたわけである。

## デバッグ用の手控え
調査の過程では、CommonJS エントリの `loadProjectESLint` にログを仕込み、`os.tmpdir()/eslint-ja-debug.log` へ呼び出し状況や翻訳結果を出力した。ログの形は以下の通り。

```
[eslint-ja-proxy] loadProjectESLint cwd=/path/to/project time=...
[translate] rule=@angular-eslint/no-empty-lifecycle-method messageId=noEmptyLifecycleMethod original="..." translated="..."
```

CLI でも IDE でもこのファイルが増えるので、挙動確認や引き継ぎの際に便利だ。macOS だと `/var/folders/.../T/` 以下に生成されるので注意。

## まとめ — 沼は深いが、地図は描ける
ESLint は新版 API と従来 API を両立させているため、その上で動くツール（たとえば JetBrains）の実装も二重構造にならざるを得ない。プロキシを差し込む場合は「どのコンストラクタが呼ばれるのか」「どのバージョンでどの分岐に入るのか」を慎重にトレースする必要がある。

沼の深さは変わらないが、仕組みがわかれば地図は描ける。Legacy と Flat、双方の API をどうラップするか —— そこを押さえれば IDE 連携もきっとクリアできるだろう。
  
<br>
<br>
<br>
ESLint の沼<br>
OpenAI Codex (GPT-5-codex), Ayumu Magoshi　著<br>
<br>
発行日　2025.10.3
