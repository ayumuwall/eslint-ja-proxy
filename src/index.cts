/**
 * ESLint の CJS エントリポイント
 * CommonJS 環境で使用するためのラッパー
 */

// プロジェクトの eslint を直接使用
function loadProjectESLint() {
  try {
    // プロジェクトの cwd から eslint を解決
    const eslintPath = require.resolve('eslint', { paths: [process.cwd()] });
    return require(eslintPath);
  } catch {
    // フォールバック: このパッケージの eslint を使用
    return require('eslint');
  }
}

const { ESLint: OriginalESLint, Linter } = loadProjectESLint();

// 辞書読み込み（同期的に行う必要がある）
let dict: any = null;
function getDictionary() {
  if (!dict) {
    // 簡易実装：辞書は最初のlint時にロードする
    try {
      const { getDictionary: loadDict } = require('./load-dict.js');
      dict = loadDict();
    } catch {
      dict = {};
    }
  }
  return dict;
}

// 翻訳関数
function translateMessages(messages: any[], dictionary: any) {
  try {
    const { translateMessages: translate } = require('./translate.js');
    return translate(messages, dictionary);
  } catch {
    return messages;
  }
}

// ESLint をラップしたクラス
class ESLintJaProxyCJS extends OriginalESLint {
  private _originalCwd: string;

  constructor(options?: any) {
    // 呼び出し時の cwd を保存
    const cwd = options?.cwd || process.cwd();
    super({
      ...options,
      cwd: cwd,
    });
    this._originalCwd = cwd;
  }

  async lintFiles(patterns: string | string[]): Promise<any> {
    const results = await super.lintFiles(patterns);
    return this.translateResults(results);
  }

  async lintText(code: string, options?: any): Promise<any> {
    const results = await super.lintText(code, options);
    return this.translateResults(results);
  }

  private translateResults(results: any[]): any[] {
    const dictionary = getDictionary();

    return results.map((result: any) => {
      const translatedMessages = translateMessages(result.messages, dictionary);
      return {
        ...result,
        messages: translatedMessages,
      };
    });
  }

  static get version(): string {
    return OriginalESLint.version;
  }

  static async outputFixes(results: any[]): Promise<void> {
    return OriginalESLint.outputFixes(results);
  }

  static async getErrorResults(results: any[]): Promise<any[]> {
    return OriginalESLint.getErrorResults(results);
  }
}

// CommonJS エクスポート
module.exports = ESLintJaProxyCJS;
module.exports.ESLint = ESLintJaProxyCJS;
module.exports.default = ESLintJaProxyCJS;
module.exports.Linter = Linter;
