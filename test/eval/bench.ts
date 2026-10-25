/** Runs the quality bench (cases.ts) against the demo clinic's receptionist. */
import type { TurnResult } from '../../server/receptionist/engine.ts';
import { demoClinic } from '../helpers.ts';
import { QA, SCRIPTS, type Expectation } from './cases.ts';

export interface Failure {
  name: string;
  say: string;
  reply: string;
  skill: string;
  sources: string[];
  problems: string[];
}

export interface BenchResult {
  total: number;
  passed: number;
  failures: Failure[];
}

function check(e: Expectation, t: TurnResult): string[] {
  const problems: string[] = [];
  const text = t.reply.text;
  if (e.expect && !e.expect.test(text)) problems.push(`expected ${e.expect}`);
  if (e.not && e.not.test(text)) problems.push(`should not match ${e.not}`);
  if (e.skill && !(typeof e.skill === 'string' ? t.meta.skill === e.skill : e.skill.test(t.meta.skill))) {
    problems.push(`skill ${t.meta.skill}, expected ${e.skill}`);
  }
  if (e.source && !t.meta.sources.some((s) => s.slug === e.source)) problems.push(`missing source ${e.source}`);
  return problems;
}

export async function runBench(): Promise<BenchResult> {
  const failures: Failure[] = [];
  let total = 0;
  const record = (name: string, say: string, t: TurnResult, problems: string[]) => {
    total++;
    if (problems.length) {
      failures.push({ name, say, reply: t.reply.text, skill: t.meta.skill, sources: t.meta.sources.map((s) => s.slug), problems });
    }
  };

  for (const c of QA) {
    const [t] = await demoClinic().chat([c.q]);
    record('Q&A', c.q, t, check(c, t));
  }
  for (const s of SCRIPTS) {
    const turns = await demoClinic().chat(s.turns.map((x) => x.say));
    s.turns.forEach((x, i) => record(s.name, x.say, turns[i], check(x, turns[i])));
  }
  return { total, passed: total - failures.length, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await runBench();
  for (const f of r.failures) {
    console.log(`\n✗ [${f.name}] ${f.say}\n  → (${f.skill}${f.sources.length ? ` | ${f.sources.join(', ')}` : ''}) ${f.reply.replace(/\n/g, '\n    ')}\n  ! ${f.problems.join('; ')}`);
  }
  console.log(`\nQuality bench: ${r.passed}/${r.total} passed (${Math.round((100 * r.passed) / r.total)}%)`);
  process.exitCode = r.failures.length ? 1 : 0;
}
