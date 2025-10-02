# IDEでESLintが動作しない問題の調査記録

## 現状の問題

### 症状
- **JetBrains IDE (PhpStorm/WebStorm/IntelliJ)** で `eslint-ja-proxy` をESLintパッケージとして指定しても、警告が表示されない
- 右下の「言語サービス」にESLintの警告アイコンが表示されるが、エラー内容は「ESLint設定」とだけ表示
- IDE上のエディタにはESLintの警告が一切表示されない

### 動作している部分
- **コマンドライン**: `npx eslint-ja-proxy` は正常に動作し、日本語化されたメッセージが表示される
- **Node.jsからの直接呼び出し**: `require('eslint-ja-proxy')` でインスタンスを作成し、`lintFiles()` を実行すると正常に動作
- **翻訳機能**: 辞書ベースの翻訳は正しく機能している

```bash
# ✅ 動作する
npx eslint-ja-proxy src/app/home/home.page.ts
# → "空のライフサイクルメソッド '{methodName}' を削除してください。"

# ✅ 動作する
node -e "
(async () => {
  const eslint = require('eslint-ja-proxy');
  const instance = new eslint.ESLint();
  const results = await instance.lintFiles(['src/app/home/home.page.ts']);
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
   - IDE設定画面で「0.1.0」とバージョンが表示されている
   - IDEログに「eslint-ja-proxy」の読み込み記録がある

### ❓ 不明な点

1. **IDEがどのようにESLintを呼び出しているか**
   - CLIを使っているのか？
   - Node APIを使っているのか？
   - どのタイミングで初期化しているのか？

2. **IDEのESLint統合の具体的なエラー**
   - 言語サービスに警告が出ているが、詳細なエラーメッセージが見えない
   - IDEログにESLintのエラーが記録されていない

3. **環境変数の渡し方**
   - `ESLINT_JA_DEBUG=1` を設定しても、IDE経由では出力が見えない
   - IDEからの実行時に環境変数が渡されているのか不明

## 次のステップの候補

### A. IDEのログ・デバッグ情報を収集
1. **IDEのDebug Log Settingsを有効化**
   ```
   Help > Diagnostic Tools > Debug Log Settings
   #com.intellij.lang.javascript.linter.eslint
   ```

2. **IDEのESLintサービスのログを確認**
   ```bash
   tail -f ~/Library/Logs/JetBrains/PhpStorm*/idea.log | grep -i eslint
   ```

3. **言語サービスの警告アイコンをクリック**して、詳細なエラーメッセージを確認

### B. 最小限の再現環境を作成
1. **新規プロジェクトで最小構成をテスト**
   ```bash
   mkdir test-eslint-ja-proxy
   cd test-eslint-ja-proxy
   npm init -y
   npm i -D eslint
   npx eslint --init
   npm link eslint-ja-proxy
   ```

2. **IDEで開いて動作確認**

### C. JetBrains公式のESLint統合仕様を確認
- JetBrainsのドキュメントで、カスタムESLintパッケージの要件を確認
- 必須のエクスポート、メソッド、プロパティがあるか調査

### D. VS Codeでテスト
- VS CodeのESLint拡張でも同じ問題が発生するか確認
- VS Codeで動作すれば、JetBrains特有の問題として切り分けられる

### E. 既存のESLintラッパーを参考にする
- 他のESLintラッパープロジェクト（例: `@rushstack/eslint-patch`）の実装を参考にする
- IDEで動作しているラッパーがどのような実装になっているか調査

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

**最終更新**: 2025-10-02
**ステータス**: IDEでの動作確認が必要
