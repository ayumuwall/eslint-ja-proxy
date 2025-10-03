/**
 * ビルドスクリプト
 * TypeScript ファイルを ESM (.mjs) と CJS (.cjs) にコンパイル
 */

import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, readdirSync, statSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, 'src');
const DIST_DIR = join(ROOT, 'dist');
const DICT_DIR = join(ROOT, 'dict');
const SCHEMAS_DIR = join(ROOT, 'schemas');
const COMPAT_LIB_DIR = join(DIST_DIR, 'lib');
const ROOT_COMPAT_LIB_DIR = join(ROOT, 'lib');

console.log('🔨 ビルド開始...\n');

// dist ディレクトリをクリーンアップ
console.log('📁 dist/ ディレクトリをクリーンアップ中...');
execSync('rm -rf dist', { stdio: 'inherit' });
mkdirSync(DIST_DIR, { recursive: true });

// TypeScript をコンパイル（ESM）
console.log('\n📦 TypeScript をコンパイル中 (ESM)...');
try {
  execSync('tsc --project tsconfig.json', { stdio: 'inherit' });
} catch (err) {
  console.error('❌ TypeScript のコンパイルに失敗しました');
  process.exit(1);
}

// .mts と .cts を適切な拡張子にリネーム
console.log('\n🔄 ファイル拡張子を調整中...');
renameExtensions(DIST_DIR);

// dict ディレクトリをコピー
console.log('\n📋 辞書ファイルをコピー中...');
copyDirectory(DICT_DIR, join(DIST_DIR, 'dict'));

// schemas ディレクトリをコピー
console.log('\n📋 スキーマファイルをコピー中...');
copyDirectory(SCHEMAS_DIR, join(DIST_DIR, 'schemas'));

// CLI に実行権限を付与
console.log('\n🔐 CLI に実行権限を付与中...');
execSync('chmod +x dist/cli.mjs', { stdio: 'inherit' });

// JetBrains 等が期待する互換パスを生成
console.log('\n🧩 互換用 shim を生成中...');
createUnsupportedApiShim();

console.log('\n✅ ビルド完了！');
console.log(`\n出力ディレクトリ: ${DIST_DIR}`);

/**
 * ディレクトリを再帰的にコピー
 */
function copyDirectory(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });

  const entries = readdirSync(src);

  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);

    if (statSync(srcPath).isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * .mts → .mjs, .cts → .cjs にリネーム
 */
function renameExtensions(dir: string) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    if (statSync(fullPath).isDirectory()) {
      renameExtensions(fullPath);
    } else if (entry.endsWith('.mts')) {
      const newPath = fullPath.replace(/\.mts$/, '.mjs');
      execSync(`mv "${fullPath}" "${newPath}"`);
    } else if (entry.endsWith('.cts')) {
      const newPath = fullPath.replace(/\.cts$/, '.cjs');
      execSync(`mv "${fullPath}" "${newPath}"`);
    }
  }
}

/**
 * JetBrains ESLint8Plugin が参照する ../lib/unsupported-api を提供
 */
function createUnsupportedApiShim() {
  mkdirSync(COMPAT_LIB_DIR, { recursive: true });
  mkdirSync(ROOT_COMPAT_LIB_DIR, { recursive: true });

  const cjsShim = "module.exports = require('../use-at-your-own-risk.cjs');\n";
  const esmShim = `import * as mod from '../use-at-your-own-risk.mjs';\nexport * from '../use-at-your-own-risk.mjs';\nexport default mod.default ?? mod;\n`;
  const packageJson = JSON.stringify({ type: 'commonjs' }, null, 2);

  writeFileSync(join(COMPAT_LIB_DIR, 'unsupported-api.js'), cjsShim);
  writeFileSync(join(COMPAT_LIB_DIR, 'unsupported-api.mjs'), esmShim);
  writeFileSync(join(COMPAT_LIB_DIR, 'package.json'), `${packageJson}\n`);

  const rootCjsShim = "module.exports = require('../dist/use-at-your-own-risk.cjs');\n";
  const rootEsmShim = `import * as mod from '../dist/use-at-your-own-risk.mjs';\nexport * from '../dist/use-at-your-own-risk.mjs';\nexport default mod.default ?? mod;\n`;

  writeFileSync(join(ROOT_COMPAT_LIB_DIR, 'unsupported-api.js'), rootCjsShim);
  writeFileSync(join(ROOT_COMPAT_LIB_DIR, 'unsupported-api.mjs'), rootEsmShim);
  writeFileSync(join(ROOT_COMPAT_LIB_DIR, 'package.json'), `${packageJson}\n`);
}
