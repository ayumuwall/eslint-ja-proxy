/**
 * Node.js の --require で読み込むパッチスクリプト
 * 
 * Usage:
 *   node -r eslint-ja-proxy/register node_modules/.bin/eslint .
 * 
 * ESLint モジュールをモンキーパッチして、結果を日本語化する
 */

const Module = require('module');
const originalRequire = Module.prototype.require;

// eslint-ja-proxy の読み込み
let proxyLoaded = false;
let ESLintJaProxyClass: any = null;

async function loadProxy() {
  if (proxyLoaded) {
    return ESLintJaProxyClass;
  }

  try {
    // ESM版を動的にインポート
    const mod = await import('./index.mjs');
    const defaultExport = (mod?.default ?? {}) as { ESLint?: any };
    ESLintJaProxyClass = mod.ESLint || defaultExport.ESLint;
    proxyLoaded = true;
  } catch (err) {
    console.error('[eslint-ja-proxy] Failed to load proxy:', err);
  }

  return ESLintJaProxyClass;
}

// require('eslint') をフック
Module.prototype.require = function (id: string) {
  const module = originalRequire.apply(this, arguments as any);

  // 'eslint' モジュールの場合のみパッチ
  if (id === 'eslint' && module.ESLint) {
    // ESLint クラスを置き換える
    const originalESLint = module.ESLint;

    // プロキシクラスでラップ
    module.ESLint = class ESLintPatched extends originalESLint {
      private _proxyInstance: any = null;
      private _initPromise: Promise<void>;

      constructor(options?: any) {
        super(options);
        this._initPromise = this._initProxy(options);
      }

      private async _initProxy(options?: any) {
        const ProxyClass = await loadProxy();
        if (ProxyClass) {
          this._proxyInstance = new ProxyClass(options);
        }
      }

      async lintFiles(patterns: string | string[]): Promise<any> {
        await this._initPromise;
        if (this._proxyInstance) {
          return this._proxyInstance.lintFiles(patterns);
        }
        return super.lintFiles(patterns);
      }

      async lintText(code: string, options?: any): Promise<any> {
        await this._initPromise;
        if (this._proxyInstance) {
          return this._proxyInstance.lintText(code, options);
        }
        return super.lintText(code, options);
      }
    };

    // 静的メソッドもコピー
    Object.setPrototypeOf(module.ESLint, originalESLint);
    Object.keys(originalESLint).forEach((key) => {
      if (typeof originalESLint[key] !== 'undefined') {
        (module.ESLint as any)[key] = originalESLint[key];
      }
    });
  }

  return module;
};

// デバッグ出力
if (process.env.DEBUG) {
  console.log('[eslint-ja-proxy] Register hook loaded');
}
