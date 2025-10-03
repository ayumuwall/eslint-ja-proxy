# IDEでESLintが動作しない問題の調査記録

## 現状の問題

### 症状
- **JetBrains IDE (PhpStorm/WebStorm/IntelliJ)** で `eslint-ja-proxy` をESLintパッケージとして指定しても、なにも表示されない
- 右下の「言語サービス」にESLintの警告アイコンが表示されるが、エラー内容は「ESLint設定」とだけ表示
- IDE上のエディタにはESLintの警告が一切表示されない

### 動作している部分
- **コマンドライン**: `npx eslint-ja-proxy` は正常に動作し、日本語化されたメッセージが表示される
- **Node.jsからの直接呼び出し**: `require('eslint-ja-proxy')` でインスタンスを作成し、`lintFiles()` を実行すると正常に動作
- **翻訳機能**: 辞書ベースの翻訳は正しく機能している

```bash
# ✅ 動作する
npx eslint-ja-proxy src/app/home/test.ts
# → "空のライフサイクルメソッド '{methodName}' を削除してください。"

# ✅ 動作する
node -e "
(async () => {
  const eslint = require('eslint-ja-proxy');
  const instance = new eslint.ESLint();
  const results = await instance.lintFiles(['src/app/home/test.ts']);
  console.log(results[0].messages[0].message);
})();
"
# → "空のライフサイクルメソッド '{methodName}' を削除してください。"
```

## 試したこと

### 1. IDEの設定確認
- **ESLintパッケージ**: `~/SynologyDrive/Dev/eslint-ja-proxy` を指定（npm linkで接続済み）
- **マニュアルESLint設定**: 自動ではなく、マニュアル設定を選択
- **構成ファイル**: 自動検索（`.eslintrc.json` を検出）
- **IDEの再起動**: 複数回実施

### 2. package.json の調整
- `main` フィールドに `./dist/index.cjs` を明示
- `bin` フィールドで `eslint` コマンドを提供
- `peerDependencies` に `eslint` を指定

```json
{
  "main": "./dist/index.cjs",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./register": "./dist/register.cjs"
  },
  "bin": {
    "eslint": "./dist/cli.mjs",
    "eslint-ja": "./dist/cli.mjs"
  }
}
```

### 3. CLIの実装方針の変更
- **最初の実装**: 独自の引数解析を行う簡易的なCLI
- **子プロセス実装（試行）**: 本物のESLint CLIを子プロセスとして実行 → README.mdの設計思想と異なるため却下
- **現在の実装**: ESLint APIを使って `lintFiles()` を実行し、結果を翻訳

### 4. プロジェクトのESLintを使うように修正
**問題**: `import { ESLint } from 'eslint'` が `eslint-ja-proxy` 自身の `node_modules/eslint` を参照してしまい、テストプロジェクトの `.eslintrc.json` を見つけられない

**解決策**: `process.cwd()` から動的にESLintを解決するように変更

```typescript
// src/index.mts
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

function loadProjectESLint() {
  try {
    const eslintPath = require.resolve('eslint', { paths: [process.cwd()] });
    return require(eslintPath);
  } catch {
    return require('eslint');
  }
}

const { ESLint } = loadProjectESLint();
```

### 5. CJSエクスポートを同期的に修正
**問題**: 非同期初期化（`async _init()`）がIDEの同期的な使用方法と相性が悪い可能性

**解決策**: ESLintを直接継承し、同期的に初期化するように変更

```typescript
// src/index.cts (Before)
class ESLintJaProxyCJS {
  private _initPromise: Promise<void>;
  async _init(options) {
    const ESLintClass = await loadESM();
    this._instance = new ESLintClass(options);
  }
}

// src/index.cts (After)
class ESLintJaProxyCJS extends OriginalESLint {
  constructor(options) {
    super(options);
  }
  async lintFiles(patterns) {
    const results = await super.lintFiles(patterns);
    return this.translateResults(results);
  }
}
```

### 6. cwdの保存
**問題**: `import` 時に `process.cwd()` が変わってしまう可能性

**解決策**: コンストラクタ呼び出し時の `cwd` を保存し、明示的に渡す

```typescript
constructor(options) {
  const cwd = options?.cwd || process.cwd();
  super({ ...options, cwd });
}
```

### 7. ビルドスクリプトの改善
- **実行権限の自動付与**: `chmod +x dist/cli.mjs` をビルドスクリプトに追加
- **npm link**: 開発版とテストプロジェクトをシンボリックリンクで接続

## どこまで原因を特定できたか

### ✅ 確認できたこと

1. **パッケージ構造は正しい**
   ```bash
   node -e "const pkg = require('eslint-ja-proxy'); console.log(Object.keys(pkg));"
   # → [ 'ESLint', 'default', 'Linter' ]
   ```

2. **翻訳機能は動作している**
   - コマンドライン、Node.jsからの呼び出しで日本語化されたメッセージが表示される

3. **プロジェクトのESLintを正しく読み込んでいる**
   ```bash
   ESLINT_JA_DEBUG=1 node -e "..."
   # → [eslint-ja-proxy] Loading ESLint from: ~/path/to/test-project/node_modules/eslint/lib/api.js
   ```

4. **npm linkは正常に機能している**
   ```bash
   ls -la node_modules/eslint-ja-proxy
   # → lrwxr-xr-x ... -> ../path/to/eslint-ja-proxy
   ```

5. **IDEはパッケージを認識している**
   - IDE設定画面で `9.0.0-proxy.1` と表示され、JetBrains 側で ESLint 8/9 相当として扱われる
   - IDEログや `os.tmpdir()/eslint-ja-debug.log` に `loadProjectESLint` の呼び出しが記録される

### 🆕 2025-10-02 追加調査メモ

- JetBrains の ESLint 連携は `state.linterPackageVersion` の先頭メジャー値で使用するプラグインを切り替える（`javascript-plugin/languageService/eslint/src/eslint-plugin-provider.ts`）。メジャーが 8 以上の場合は `ESLint8Plugin`（ESLint Node API ベース）、それ未満は `ESLintPlugin`（旧 `CLIEngine` ベース）にフォールバックすることをコードから確認。
- パッケージが `0.1.0` のままだと旧 `CLIEngine` 側に振り分けられ、`lib/api.CLIEngine` を直接 `require` するため ESLint 9 では `CLIEngine` が存在せず、IDE のエラー表示が「ESLint設定」のままになっていた。
- `package.json` の `version` を `9.0.0-proxy.1` に引き上げると JetBrains が `ESLint8Plugin` を選択し、`ESLint` コンストラクタと `loadESLint` 経由で今回整備したプロキシの export が利用される。Semantic Versioning 的にも「ESLint 9 互換」という扱いができ、内部の独自バージョンは `proxyVersion` フィールドで追跡。
- 仕様依存のため、将来 JetBrains 側の判定方法が変われば再追従が必要だが、現時点では仕様に基づく正攻法と判断。
- `node_modules/eslint-ja-proxy/dist/index.cjs` にデバッグログを追加し、IDE 経由でも `loadProjectESLint` と翻訳処理が実行されていることを `eslint-ja-debug.log` で確認。
- デバッグログ仕様: CommonJS エントリで `loadProjectESLint` 呼び出しと翻訳処理毎に `os.tmpdir()/eslint-ja-debug.log` へ追記（形式は `[eslint-ja-proxy] loadProjectESLint cwd=...` / `[translate] rule=... translated=...`）。CLI・IDE 双方で挙動確認や引き継ぎに利用可能（ファイルは `/var/folders/.../T/` 配下に生成）。
- `TypeError: this.LegacyESLint is not a constructor` は、JetBrains 側が `../lib/unsupported-api` を相対参照していることに起因。`dist/lib/unsupported-api.{js,mjs}` とリポジトリ直下の `lib/unsupported-api.{js,mjs}` をビルド時に生成し、プロキシ済みクラスをエクスポートすることで解消した。
- CLI で英語メッセージに戻るケースを確認。`node_modules/.bin/eslint` が本家を指す場合は `npx eslint-ja` を利用するか `"eslint": "npm:eslint-ja-proxy@…"` でエイリアス指定が必要。

### ❓ 今後の確認ポイント

1. **辞書プレースホルダのカバレッジ**
   - `message.data` が提供されないルール（例: `@angular-eslint/no-empty-lifecycle-method`）は、英語メッセージに合わせた定型文へ調整済み。追加ルールでも `pnpm exec eslint <file> --format json` で `data` を確認すること。

2. **ログ出力の活用**
   - CLI で `ESLINT_JA_DEBUG=1 node …` を実行すると `[eslint-ja-proxy] translateMessage …` が `stderr` に出力される。PhpStorm では `stderr` が `idea.log` に流れないため、必要に応じて CLI での再現やファイル出力を検討する。

## 追加メモ（2025-10-03 時点）

- ビルド後の成果物に `lib/unsupported-api.{js,mjs}` を含めることで JetBrains からの `require('../lib/unsupported-api')` が成功する。
- `pnpm build` 後は IDE を再起動し、`ESLINT_JA_DEBUG=1 open -a PhpStorm` でログを取得可能。ログ監視は `tail -f ~/Library/Logs/JetBrains/PhpStorm*/idea.log` を推奨（`grep` フィルタは不要）。
- CLI からデバッグする場合の例:
  ```bash
  ESLINT_JA_DEBUG=1 node - <<'NODE'
  const { ESLint } = require('eslint-ja-proxy');
  (async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const [result] = await eslint.lintText('const foo = 1;\n');
    console.log(result.messages);
  })();
  NODE
  ```

**ステータス**: JetBrains `LegacyESLint` 互換は対応済み。IDE で警告が表示され、翻訳も適用されることを確認。

## テスト環境情報

### 開発環境
- **パッケージ**: `~/SynologyDrive/Dev/eslint-ja-proxy`
- **Node.js**: v18以上
- **ESLint**: 9.36.0

### テストプロジェクト
- **パス**: `~/path/to/test-project`
- **ESLint**: 8.57.1
- **設定**: `.eslintrc.json` (ESLint 8 Legacy config)
- **プラグイン**: `@angular-eslint/*`

### IDE
- **PhpStorm**: 2025.2
- **設定**: マニュアルESLint設定
- **ESLintパッケージ**: `~/SynologyDrive/Dev/eslint-ja-proxy` (npm link経由)

## 現在のファイル構成

```
eslint-ja-proxy/
├── src/
│   ├── index.mts        # ESM エントリ (ESLintJaProxy extends ESLint)
│   ├── index.cts        # CJS エントリ (同期的にESLintを継承)
│   ├── cli.mts          # CLI実装 (ESLintJaProxyを使用)
│   ├── translate.ts     # 翻訳ロジック (messageId + data → 日本語)
│   ├── load-dict.ts     # 辞書の読み込み
│   └── missing-logger.ts # 未訳の収集
├── dict/
│   ├── core.json        # ESLint本体の翻訳
│   ├── angular.json     # @angular-eslint の翻訳
│   └── typescript.json  # @typescript-eslint の翻訳
├── dist/                # ビルド出力
│   ├── index.cjs        # CJSビルド (main)
│   ├── index.mjs        # ESMビルド (exports.import)
│   └── cli.mjs          # CLI (bin.eslint)
└── package.json
```

## 関連するGitHub Issue・参考資料

- ESLint API: https://eslint.org/docs/latest/integrate/nodejs-api
- JetBrains ESLint Integration: https://www.jetbrains.com/help/idea/eslint.html
- npm link: https://docs.npmjs.com/cli/commands/npm-link

---

**最終更新**: 2025-10-03
**ステータス**: JetBrains `LegacyESLint` 互換実装を検討中
