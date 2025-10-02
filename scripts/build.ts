/**
 * ビルドスクリプト
 * TypeScript ファイルを ESM (.mjs) と CJS (.cjs) にコンパイル
 */

import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, 'src');
const DIST_DIR = join(ROOT, 'dist');
const DICT_DIR = join(ROOT, 'dict');
const SCHEMAS_DIR = join(ROOT, 'schemas');

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
