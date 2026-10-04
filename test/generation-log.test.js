import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readGeneration, writeGeneration, removeGeneration, startGeneration, appendGenerationLog } from '../generation-log.js';

test('生成ログと失敗内容を保存し、直近5回の履歴を残す', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shiori-generation-test-'));
  const id = '00000000-0000-4000-8000-000000000001';
  try {
    const history = await readGeneration(root, id);
    assert.deepEqual(history, { runs: [] });
    const first = startGeneration(history);
    appendGenerationLog(first, '\x1b[31mエラー\x1b[0m\r詳細');
    first.status = 'failed'; first.error = '生成結果が不正です';
    await writeGeneration(root, id, history);
    const saved = await readGeneration(root, id);
    assert.equal(saved.runs[0].error, '生成結果が不正です');
    assert.match(saved.runs[0].logs, /エラー\n詳細/);
    for (let i = 0; i < 5; i++) startGeneration(saved);
    assert.equal(saved.runs.length, 5);
    appendGenerationLog(saved.runs[0], 'x'.repeat(90000));
    assert.equal(saved.runs[0].logs.length, 80000);
    assert.equal(saved.runs[0].logsTruncated, true);
    await removeGeneration(root, id);
    assert.deepEqual(await readGeneration(root, id), { runs: [] });
  } finally { await rm(root, { recursive: true, force: true }); }
});
