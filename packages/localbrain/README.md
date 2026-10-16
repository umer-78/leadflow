# localbrain

A small conversational-AI toolkit with **zero dependencies**: no model downloads, no API keys, no
network calls. Plain TypeScript that runs in Node (≥20) and the browser. Drop the `packages/localbrain`
folder into any project.

| Module | What it does |
| --- | --- |
| `text` | normalise, tokenise, stop words, Porter stemmer, sentence splitting |
| `fuzzy` | edit distance and a spelling corrector (`implnats` → `implants`) |
| `search` | BM25F knowledge search over title/tags/body, synonyms, phrase bonus, extractive answers (`passages`) |
| `classifier` | intent classifier (TF-IDF nearest neighbour + keyword boosts), trains in milliseconds |
| `entities` | emails, phone numbers, names, dates ("next tuesday", "oct 20"), times ("after 4", "3pm"), dictionaries |
| `sentiment` | lexicon sentiment with negation, urgency signals |
| `respond` | deterministic reply variation, templates, list joining |
| `assistant` | `Brain` (understanding) + `Assistant` (ordered skills pipeline) with an optional upgrade hook |

## Quick start

```ts
import { Assistant, Brain, SearchIndex } from './packages/localbrain/src/index.ts';

const knowledge = new SearchIndex({ synonyms: [['price', 'cost', 'how much']] });
knowledge.add({ id: 'hours', title: 'Opening hours', body: 'We are open 9am to 5pm, Monday to Friday.' });

const brain = new Brain({
  knowledge,
  intents: [
    { name: 'greet', examples: ['hi', 'hello there', 'good morning'] },
    { name: 'book', examples: ['I want to book', 'can I schedule a visit'], keywords: ['appointment'] },
  ],
});

const bot = new Assistant(brain, [
  { name: 'greet', run: ({ u }) => (u.intent?.intent === 'greet' ? { text: 'Hi! How can I help?' } : undefined) },
  { name: 'book', run: ({ u }) => (u.intent?.intent === 'book' ? { text: `Sure — ${u.date ? 'on ' + u.date.date : 'which day suits you'}?` } : undefined) },
  {
    name: 'knowledge',
    run: ({ u, text }) => {
      const hit = u.knowledge[0];
      return hit && hit.coverage > 0.5 ? { text: knowledge.passages(hit.doc.body, text, 2, hit.doc).join(' ') } : undefined;
    },
  },
]);

const turn = await bot.reply('can i book an apointment tomorrow?', {});
// turn.reply.text -> "Sure — on 2026-10-17?"  (typo corrected, date resolved)
```

`brain.understand(text)` returns everything at once: ranked intents, the confident intent, emails,
phones, name, date, time, dictionary values, sentiment, urgency and knowledge hits.

## Improving it

- **Add examples**: `classifier.learn('book', ['pencil me in for friday'])`. The model *is* the examples,
  so `classifier.toJSON()` / `IntentClassifier.fromJSON()` save and load it.
- **Add knowledge**: `index.add({...})`. Synonym groups teach it that "cost" and "how much" mean the same.
- **Plug in a stronger generator later**: `new Assistant(brain, skills, { refine })`. `refine(draft, ctx)`
  can rewrite or replace a reply with any model you choose. If it throws, the draft is used, so the
  assistant keeps working offline.

## Limits (by design)

It does not generate free-form text the way a large language model does. It understands intent,
extracts facts, retrieves and quotes the right passage, and follows the flows you write. That makes it
fast (sub-millisecond per message), predictable, private and free to run.

## Tests

```bash
node --import tsx --test packages/localbrain/test/*.test.ts
```
