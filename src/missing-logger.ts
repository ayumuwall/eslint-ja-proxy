/**
 * 未訳メッセージの収集（JSONL形式）
 */

import { appendFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

interface MissingEntry {
  ruleId: string;
  messageId?: string;
  message: string;
  data?: Record<string, any>;
  pluginVersion?: string;
  timestamp: string;
}

const LOG_MISSING = process.env.LOG_MISSING === 'true';
const MISSING_LOG_PATH = process.env.MISSING_LOG_PATH || 
  join(homedir(), '.eslint-ja-proxy', 'missing.jsonl');

/**
 * 未訳メッセージをログに追記（非同期・非ブロッキング）
 */
export async function logMissing(
  ruleId: string,
  messageId: string | undefined,
  message: string,
  data?: Record<string, any>
): Promise<void> {
  if (!LOG_MISSING) {
    return;
  }

  const entry: MissingEntry = {
    ruleId,
    messageId,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  try {
    // JSONL形式で追記（1行1JSON）
    await appendFile(MISSING_LOG_PATH, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (err) {
    // I/O エラーは無視（メイン処理に影響させない）
    // デバッグ時のみ出力
    if (process.env.DEBUG) {
      console.error('[eslint-ja-proxy] Failed to log missing translation:', err);
    }
  }
}

/**
 * 未訳メッセージをバッファリングして非同期で記録
 * （翻訳処理中はブロックしない）
 */
const missingBuffer: MissingEntry[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

export function bufferMissing(
  ruleId: string,
  messageId: string | undefined,
  message: string,
  data?: Record<string, any>
): void {
  if (!LOG_MISSING) {
    return;
  }

  missingBuffer.push({
    ruleId,
    messageId,
    message,
    data,
    timestamp: new Date().toISOString(),
  });

  // 一定時間後にまとめて書き込み
  if (flushTimeout) {
    clearTimeout(flushTimeout);
  }

  flushTimeout = setTimeout(() => {
    flushMissingBuffer();
  }, 1000);
}

async function flushMissingBuffer(): Promise<void> {
  if (missingBuffer.length === 0) {
    return;
  }

  const entries = missingBuffer.splice(0);
  const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';

  try {
    await appendFile(MISSING_LOG_PATH, lines, 'utf-8');
  } catch (err) {
    if (process.env.DEBUG) {
      console.error('[eslint-ja-proxy] Failed to flush missing log:', err);
    }
  }
}

// プロセス終了時にバッファをフラッシュ
process.on('beforeExit', () => {
  if (missingBuffer.length > 0) {
    flushMissingBuffer();
  }
});
