import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_RUNS = 5;
const MAX_LOG_CHARS = 80000;
const filePath = (root, id) => join(root, '.shiori', 'generation', `${id}.json`);

export async function readGeneration(root, id) {
  try {
    const data = JSON.parse(await readFile(filePath(root, id), 'utf8'));
    return Array.isArray(data.runs) ? data : { runs: [] };
  } catch (error) {
    if (error.code === 'ENOENT') return { runs: [] };
    throw error;
  }
}

export async function writeGeneration(root, id, history) {
  const path = filePath(root, id);
  await mkdir(join(root, '.shiori', 'generation'), { recursive: true });
  const temp = `${path}.tmp`;
  await writeFile(temp, JSON.stringify(history, null, 2));
  await rename(temp, path);
}

export async function removeGeneration(root, id) {
  await rm(filePath(root, id), { force: true });
}

export function startGeneration(history) {
  const run = { id: randomUUID(), status: 'running', phase: 'Codex を実行中', startedAt: new Date().toISOString(), finishedAt: '', logs: '', logsTruncated: false, error: '' };
  history.runs = [run, ...history.runs].slice(0, MAX_RUNS);
  return run;
}

export function appendGenerationLog(run, text) {
  const clean = String(text).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '\n');
  const combined = run.logs + clean;
  if (combined.length > MAX_LOG_CHARS) run.logsTruncated = true;
  run.logs = combined.slice(-MAX_LOG_CHARS);
}
