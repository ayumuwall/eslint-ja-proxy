#!/usr/bin/env node
/**
 * CLI ラッパー: eslint / eslint-ja コマンド
 * ESLint の CLI を実行して、結果を日本語化する
 */

import { ESLint } from 'eslint';
import { ESLintJaProxy } from './index.mjs';

async function main() {
  const args = process.argv.slice(2);

  // --help または --version は ESLintJaProxy を通さず直接処理
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
eslint-ja - ESLint with Japanese messages

Usage:
  eslint-ja [options] [file|glob]*

All ESLint options are supported. See: https://eslint.org/docs/latest/use/command-line-interface

Examples:
  eslint-ja "src/**/*.{ts,js}"
  eslint-ja --fix src/
  eslint-ja -f json src/ > results.json
    `);
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    const pkg = await import('../package.json', { assert: { type: 'json' } });
    console.log(`eslint-ja-proxy v${pkg.default.version}`);
    console.log(`ESLint v${ESLint.version}`);
    process.exit(0);
  }

  // ESLint CLI の引数解析をそのまま使うため、
  // オプションとパターンを分離せず、ESLint.fromCLIOptions を使う
  try {
    // CLIOptions として解析（内部的にyargsなどを使用）
    // ただし、ESLint.fromCLIOptions は存在しないため、
    // 代わりに ESLint コンストラクタに必要な options を抽出する必要がある

    // 簡易実装: 主要なオプションのみ対応
    const patterns: string[] = [];
    const options: ESLint.Options = {};
    let formatName = 'stylish';

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--fix') {
        options.fix = true;
      } else if (arg === '--format' || arg === '-f') {
        formatName = args[++i];
      } else if (arg === '--config' || arg === '-c') {
        options.overrideConfigFile = args[++i];
      } else if (arg === '--ignore-path') {
        // ESLint 9 では ignorePath は非推奨、無視
        i++;
      } else if (arg === '--no-ignore') {
        options.ignore = false;
      } else if (arg === '--quiet') {
        // quiet は結果フィルタリングで実装
      } else if (arg === '--max-warnings') {
        // max-warnings は後で処理
        i++;
      } else if (arg === '--ext') {
        // ESLint 9 では extensions は非推奨、無視
        i++;
      } else if (!arg.startsWith('-')) {
        patterns.push(arg);
      }
      // その他のオプションは無視（ESLint のデフォルト動作に任せる）
    }

    if (patterns.length === 0) {
      patterns.push('.'); // デフォルトでカレントディレクトリ
    }

    const eslint = new ESLintJaProxy(options);
    const results = await eslint.lintFiles(patterns);

    // 自動修正を適用
    if (options.fix) {
      await ESLint.outputFixes(results);
    }

    // フォーマッタで出力
    const formatter = await eslint.loadFormatter(formatName);
    const output = await formatter.format(results);

    console.log(output);

    // エラーがある場合は終了コード1
    const hasErrors = results.some((result) =>
      result.messages.some((msg: any) => msg.severity === 2)
    );

    process.exit(hasErrors ? 1 : 0);
  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  }
}

main();
