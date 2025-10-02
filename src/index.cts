/**
 * ESLint の CJS エントリポイント
 * CommonJS 環境で使用するためのラッパー
 */

// ESM モジュールを動的にインポート
let ESLintJaProxy: any = null;

async function loadESM() {
  if (!ESLintJaProxy) {
    const mod = await import('./index.mjs');
    ESLintJaProxy = mod.default || mod.ESLintJaProxy;
  }
  return ESLintJaProxy;
}

// 同期的なエクスポート用のプロキシ
class ESLintJaProxyCJS {
  private _instance: any = null;

  constructor(options?: any) {
    // 初期化は非同期で行う必要があるため、後で実行
    this._initPromise = this._init(options);
  }

  private _initPromise: Promise<void>;

  private async _init(options?: any) {
    const ESLintClass = await loadESM();
    this._instance = new ESLintClass(options);
  }

  async lintFiles(patterns: string | string[]): Promise<any> {
    await this._initPromise;
    return this._instance.lintFiles(patterns);
  }

  async lintText(code: string, options?: any): Promise<any> {
    await this._initPromise;
    return this._instance.lintText(code, options);
  }

  async loadFormatter(nameOrPath?: string): Promise<any> {
    await this._initPromise;
    return this._instance.loadFormatter(nameOrPath);
  }

  async calculateConfigForFile(filePath: string): Promise<any> {
    await this._initPromise;
    return this._instance.calculateConfigForFile(filePath);
  }

  async isPathIgnored(filePath: string): Promise<any> {
    await this._initPromise;
    return this._instance.isPathIgnored(filePath);
  }

  static get version(): string {
    const { ESLint } = require('eslint');
    return ESLint.version;
  }

  static async outputFixes(results: any[]): Promise<void> {
    const { ESLint } = require('eslint');
    return ESLint.outputFixes(results);
  }

  static async getErrorResults(results: any[]): Promise<any[]> {
    const { ESLint } = require('eslint');
    return ESLint.getErrorResults(results);
  }
}

// CommonJS エクスポート
module.exports = ESLintJaProxyCJS;
module.exports.ESLint = ESLintJaProxyCJS;
module.exports.default = ESLintJaProxyCJS;

// Linter も再エクスポート
const { Linter } = require('eslint');
module.exports.Linter = Linter;
