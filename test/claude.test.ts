import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEMO_CLINIC } from '../server/knowledge/demo.ts';
import {
  claudeCost,
  createClaudeAnswerer,
  draftOf,
  eligible,
  profileLines,
  systemPrompt,
  turnPrompt,
  withClaudeAnswer,
  type ClaudeAnswer,
} from '../server/claude.ts';
import { demoClinic, toArticles } from './helpers.ts';
import { demoArticles } from '../server/knowledge/demo.ts';

const answer = (over: Partial<ClaudeAnswer> = {}): ClaudeAnswer => ({
  text: 'A root canal cleans out the infected inside of the tooth and seals it, so you can keep the tooth.',
  answered: true,
  model: 'claude-opus-5-5',
  usage: { input: 900, output: 80, cacheRead: 6000, cacheWrite: 0 },
  ms: 1200,
  ...over,
});

async function turn(message: string) {
  const [t] = await demoClinic().chat([message]);
  return t;
}

describe('which turns Claude may write', () => {
  it('takes open questions and leaves safety, booking and prices to the built-in assistant', async () => {
    assert.equal(eligible(await turn('what is a root canal')), true);
    assert.equal(eligible(await turn('do you sell gift cards')), true);
    assert.equal(eligible(await turn('how much are veneers')), false);
    assert.equal(eligible(await turn('I knocked my tooth out playing football')), false);
    assert.equal(eligible(await turn('can you see me this week?')), false);
    assert.equal(eligible(await turn('what are your hours')), false);
    assert.equal(eligible(await turn('please stop emailing me')), false);
  });
});

describe('what Claude is told', () => {
  const catalog = toArticles(demoArticles()).filter((a) => a.published && !/\[[^\]]{3,}\]/.test(a.summary));
  const org = { ...DEMO_CLINIC, phone: DEMO_CLINIC.phone ?? null, address: DEMO_CLINIC.address ?? null, emergencyInstructions: null };

  it('builds a stable system prompt from the clinic and its knowledge', () => {
    const system = systemPrompt(org, catalog);
    assert.equal(system, systemPrompt(org, catalog), 'identical every time, so it stays cached');
    assert.match(system, /front-desk assistant for Brightside Dental/);
    assert.match(system, /- Porcelain veneers: \$950–\$2,500 per tooth/);
    assert.match(system, /- Root canal treatment: /);
    assert.match(system, /Never guess prices/);
    assert.doesNotMatch(system, /\d{4}-\d{2}-\d{2}T/, 'no timestamps in the cached part');
  });

  it("removes the patient's contact details and adds what they told us", () => {
    const user = turnPrompt({
      articles: catalog.filter((a) => a.slug === 'root-canal-treatment'),
      history: [
        { role: 'visitor', body: "I'm Maria Lopez, maria@example.com, 555-201-3344" },
        { role: 'assistant', body: 'Thanks Maria! How can I help?' },
      ],
      profile: { pregnant: true, uninsured: true },
      draft: "I don't have information about that.",
      draftAnswered: false,
      question: 'Maria here again, is a root canal safe for me?',
      now: new Date('2026-10-30T15:00:00Z'),
      timezone: 'America/New_York',
      name: 'Maria Lopez',
    });
    assert.doesNotMatch(user, /maria@example\.com|555-201-3344|Maria|Lopez/);
    assert.match(user, /<article title="Root canal treatment">/);
    assert.match(user, /The patient said they are pregnant\.\nThe patient doesn't have dental insurance\./);
    assert.match(user, /didn't find an answer/);
    assert.match(user, /Today at the clinic: Friday, October 30, 2026\./);
    assert.match(user, /Patient's latest message:\n.*is a root canal safe for me\?/);
    assert.deepEqual(profileLines({ child: true, childAge: 7 }), ['The patient is asking for their child, aged 7.']);
  });
});

describe("using Claude's answer", () => {
  it('keeps the booking question and its buttons after an answer', async () => {
    const t = await turn('what is a root canal');
    assert.ok(t.reply.cta, 'the built-in answer ends with a booking question');
    assert.equal(draftOf(t.reply), t.reply.text.slice(0, -t.reply.cta!.length).trim());
    const { reply, state } = withClaudeAnswer(t, answer());
    assert.equal(reply.text, `${answer().text} ${t.reply.cta}`);
    assert.deepEqual(reply.suggestions, t.reply.suggestions);
    assert.equal(state.pendingOffer, 'booking');
    assert.equal(reply.cta, undefined);
  });

  it("answers a question the built-in assistant couldn't, and drops its callback offer", async () => {
    const t = await turn('do you sell gift cards');
    assert.equal(t.state.pendingOffer, 'callback');
    const { reply, state } = withClaudeAnswer(t, answer({ text: 'Yes — gift cards are available at the front desk.' }));
    assert.equal(reply.text, 'Yes — gift cards are available at the front desk.');
    assert.equal(state.pendingOffer, undefined);
    assert.equal(reply.suggestions, undefined);
  });

  it("says so honestly when Claude can't answer from the clinic's information", async () => {
    const t = await turn('what is a root canal');
    const { reply, state } = withClaudeAnswer(t, answer({ answered: false, text: "I don't have that information, but the team can get back to you." }));
    assert.equal(reply.text, "I don't have that information, but the team can get back to you.");
    assert.equal(state.pendingOffer, 'callback');
    assert.deepEqual(reply.suggestions, ['Yes, ask the team', 'No thanks']);
  });

  it('estimates cost from the token counts', () => {
    // 900 × $4 + 80 × $20 + 6000 × $0.20 per million tokens.
    assert.equal(claudeCost('claude-opus-5-5', answer().usage)?.toFixed(4), '0.0064');
    assert.equal(claudeCost('some-unknown-model', answer().usage), undefined);
  });
});

describe('the Claude request', () => {
  it('asks for a structured answer with fallbacks, a cached system prompt and low effort', async () => {
    let sent: { url: string; headers: Headers; body: Record<string, any> } | undefined;
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      sent = { url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) };
      const message = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [
          { type: 'thinking', thinking: '', signature: 'sig' },
          { type: 'text', text: JSON.stringify({ reply: 'Yes, we can help with that.', answered: true }) },
        ],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 812, output_tokens: 41, cache_read_input_tokens: 5200, cache_creation_input_tokens: 0 },
      };
      return new Response(JSON.stringify(message), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const claude = createClaudeAnswerer({ apiKey: 'sk-ant-test', model: 'claude-opus-5-5', effort: 'low', timeoutMs: 5000, dailyLimit: 10 }, { fetch: fakeFetch });
    const result = await claude.answer({ system: 'SYSTEM', user: 'USER' });

    assert.deepEqual(result && { text: result.text, answered: result.answered, cacheRead: result.usage.cacheRead }, {
      text: 'Yes, we can help with that.',
      answered: true,
      cacheRead: 5200,
    });
    assert.ok(sent);
    assert.match(sent.url, /\/v1\/messages/);
    assert.match(sent.headers.get('anthropic-beta') ?? '', /server-side-fallback-2026-07-01/);
    assert.equal(sent.body.model, 'claude-opus-5-5');
    assert.equal(sent.body.fallbacks, 'default');
    assert.equal(sent.body.output_config.effort, 'low');
    assert.equal(sent.body.output_config.format.type, 'json_schema');
    assert.deepEqual(sent.body.system, [{ type: 'text', text: 'SYSTEM', cache_control: { type: 'ephemeral' } }]);
    assert.deepEqual(sent.body.messages, [{ role: 'user', content: 'USER' }]);
    assert.equal(sent.body.thinking, undefined, 'thinking left to the model (adaptive)');
  });

  it('falls back to the built-in answer on a refusal or an error', async () => {
    const refusal = (async () =>
      new Response(
        JSON.stringify({
          id: 'msg_r',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5-5',
          content: [],
          stop_reason: 'refusal',
          stop_sequence: null,
          stop_details: { type: 'refusal', category: null, explanation: null },
          usage: { input_tokens: 10, output_tokens: 0 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )) as typeof fetch;
    const broken = (async () => new Response('{"type":"error","error":{"type":"api_error","message":"boom"}}', { status: 500, headers: { 'content-type': 'application/json' } })) as typeof fetch;
    const config = { apiKey: 'sk-ant-test', model: 'claude-opus-5-5', effort: 'low' as const, timeoutMs: 5000, dailyLimit: 10 };
    assert.equal(await createClaudeAnswerer(config, { fetch: refusal }).answer({ system: 'S', user: 'U' }), undefined);
    const warn = console.warn;
    console.warn = () => undefined;
    try {
      assert.equal(await createClaudeAnswerer(config, { fetch: broken }).answer({ system: 'S', user: 'U' }), undefined);
    } finally {
      console.warn = warn;
    }
  });
});
