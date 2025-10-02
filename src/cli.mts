#!/usr/bin/env node
/**
 * CLI ラッパー: eslint-ja コマンド
 * ESLint の CLI を実行して、結果を日本語化する
 */

import { ESLintJaProxy } from './index.mjs';

async function main() {
  const args = process.argv.slice(2);

  // 簡易的な引数解析
  const patterns: string[] = [];
  const options: any = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--fix') {
      options.fix = true;
    } else if (arg === '--format' || arg === '-f') {
      options.format = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
eslint-ja - ESLint with Japanese messages

Usage:
  eslint-ja [options] [file|glob]*

Options:
  --fix              自動修正を実行
  -f, --format       フォーマッタを指定（例: stylish, json）
  -h, --help         このヘルプを表示
  --version          バージョンを表示

Examples:
  eslint-ja "src/**/*.{ts,js}"
  eslint-ja --fix src/
  eslint-ja -f json src/ > results.json
      `);
      process.exit(0);
    } else if (arg === '--version' || arg === '-v') {
      const pkg = await import('../package.json', { assert: { type: 'json' } });
      console.log(pkg.default.version);
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      patterns.push(arg);
    }
  }

  if (patterns.length === 0) {
    console.error('エラー: ファイルパターンを指定してください');
    console.error('使い方: eslint-ja [options] [file|glob]*');
    process.exit(1);
  }

  try {
    const eslint = new ESLintJaProxy(options);
    const results = await eslint.lintFiles(patterns);

    // 自動修正を適用
    if (options.fix) {
      await ESLintJaProxy.outputFixes(results);
    }

    // フォーマッタで出力
    const formatter = await eslint.loadFormatter(options.format || 'stylish');
    const output = await formatter.format(results);

    console.log(output);

    // エラーがある場合は終了コード1
    const hasErrors = results.some((result) =>
      result.messages.some((msg) => msg.severity === 2)
    );

    process.exit(hasErrors ? 1 : 0);
  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  }
}

main();
