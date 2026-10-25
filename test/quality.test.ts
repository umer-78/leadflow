import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runBench } from './eval/bench.ts';

describe('quality bench', () => {
  it('answers every realistic patient question and conversation correctly', async () => {
    const result = await runBench();
    const report = result.failures
      .map((f) => `[${f.name}] ${f.say}\n  → (${f.skill}) ${f.reply.slice(0, 200)}\n  ! ${f.problems.join('; ')}`)
      .join('\n');
    assert.equal(result.failures.length, 0, `${result.failures.length} of ${result.total} bench checks failed:\n${report}`);
  });
});
