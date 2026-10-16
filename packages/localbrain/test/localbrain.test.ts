import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Assistant,
  Brain,
  EntityDictionary,
  IntentClassifier,
  SearchIndex,
  Vocabulary,
  analyzeSentiment,
  analyzeUrgency,
  choose,
  editDistance,
  extractDate,
  extractEmails,
  extractName,
  extractPhones,
  extractTime,
  joinList,
  render,
  stem,
  terms,
  todayIn,
} from '../src/index.ts';

describe('text', () => {
  it('stems inflections to a shared root', () => {
    assert.equal(stem('implants'), stem('implant'));
    assert.equal(stem('whitening'), 'whiten');
    assert.equal(stem('cleaning'), 'clean');
    assert.deepEqual(terms('How long do the implants take?'), ['long', 'implant', 'take']);
  });
});

describe('fuzzy', () => {
  it('measures edits including transpositions', () => {
    assert.equal(editDistance('implant', 'implnat'), 1);
    assert.equal(editDistance('veneers', 'vineers'), 1);
    assert.ok(editDistance('abc', 'xyz', 1) > 1);
  });

  it('corrects unknown words within the typo budget', () => {
    const v = new Vocabulary();
    v.addAll(['implants', 'veneers', 'whitening', 'cleaning']);
    assert.equal(v.correct('implnats'), 'implants');
    assert.equal(v.correct('vineers'), 'veneers');
    assert.equal(v.correct('cat'), 'cat'); // too short to correct
    assert.equal(v.correct('banana'), 'banana'); // nothing close
  });
});

describe('SearchIndex', () => {
  const idx = new SearchIndex({
    synonyms: [
      ['invisalign', 'clear aligners'],
      ['hurt', 'pain', 'sensitivity', 'discomfort'],
    ],
  });
  idx.addAll([
    {
      id: 'implants',
      title: 'Dental implants',
      tags: ['missing tooth'],
      body: 'An implant replaces a missing tooth root. Treatment usually takes 3 to 6 months while the bone heals. Most people need only over-the-counter pain relief afterwards.',
    },
    {
      id: 'aligners',
      title: 'Clear aligners',
      tags: ['orthodontics'],
      body: 'Clear aligners are removable trays that straighten teeth. Most cases take 6 to 18 months.',
    },
    {
      id: 'whitening',
      title: 'Teeth whitening',
      body: 'Whitening lightens stains with peroxide gel. Temporary sensitivity is common and fades within a couple of days.',
    },
  ]);

  it('ranks the relevant document first, despite typos', () => {
    assert.equal(idx.search('how long do implnats take')[0].id, 'implants');
    assert.equal(idx.search('tell me about invisalign')[0].id, 'aligners');
  });

  it('returns nothing for unrelated queries', () => {
    assert.equal(idx.search('weather in paris').length, 0);
  });

  it('extracts the sentence that answers the question', () => {
    const doc = idx.get('whitening')!;
    assert.match(idx.passages(doc.body, 'does whitening hurt', 1, doc)[0], /sensitivity/);
    const imp = idx.get('implants')!;
    assert.match(idx.passages(imp.body, 'how many months does it take', 1)[0], /3 to 6 months/);
  });

  it('reports coverage of the query terms', () => {
    const [hit] = idx.search('clear aligners');
    assert.ok(hit.coverage > 0.99);
  });

  it('supports removing documents', () => {
    const local = new SearchIndex();
    local.add({ id: 'a', body: 'fluoride varnish' });
    assert.equal(local.search('fluoride').length, 1);
    local.remove('a');
    assert.equal(local.search('fluoride').length, 0);
  });
});

describe('IntentClassifier', () => {
  const clf = new IntentClassifier([
    { name: 'book', examples: ['I want to book an appointment', 'can I schedule a visit', 'do you have any openings next week'], keywords: ['appointment'] },
    { name: 'price', examples: ['how much does it cost', 'what is the price', 'is it expensive'], keywords: ['how much', 'cost'] },
    { name: 'hours', examples: ['what are your opening hours', 'when are you open', 'are you open on saturday'] },
    { name: 'greet', examples: ['hello', 'hi there', 'good morning'] },
  ]);

  it('classifies paraphrases and typos', () => {
    assert.equal(clf.best('could I book an apointment for friday')?.intent, 'book');
    assert.equal(clf.best('how much do veneers cost')?.intent, 'price');
    assert.equal(clf.best('what time do you open tomorrow')?.intent, 'hours');
    assert.equal(clf.best('hiya')?.intent ?? 'none', 'none');
  });

  it('stays unsure about out-of-domain text', () => {
    assert.equal(clf.best('the quarterly tax filing deadline'), undefined);
  });

  it('learns new phrasings', () => {
    const c = IntentClassifier.fromJSON(clf.toJSON());
    c.learn('greet', ['hiya', 'yo']);
    assert.equal(c.best('hiya')?.intent, 'greet');
  });
});

describe('entities', () => {
  const today = { year: 2026, month: 10, day: 16 }; // a Friday

  it('extracts emails and phone numbers', () => {
    assert.deepEqual(extractEmails('reach me at Jane.Doe@Example.com'), ['jane.doe@example.com']);
    assert.deepEqual(extractPhones('call (555) 201-3344 or +44 20 7946 0958'), ['5552013344', '+442079460958']);
    assert.deepEqual(extractPhones('on 10/20/2026 at 3:30'), []);
  });

  it('finds names from cues and bare replies', () => {
    assert.equal(extractName("Hi, I'm Sarah and I need veneers"), 'Sarah');
    assert.equal(extractName('my name is john smith'), 'John Smith');
    assert.equal(extractName("I'm looking for implants"), undefined);
    assert.equal(extractName('this is urgent'), undefined);
    assert.equal(extractName('Maria Lopez', { expectingName: true }), 'Maria Lopez');
    assert.equal(extractName("I'd rather not say", { expectingName: true }), undefined);
  });

  it('resolves relative and absolute dates', () => {
    assert.equal(extractDate('tomorrow please', today)?.date, '2026-10-17');
    assert.equal(extractDate('next tuesday', today)?.date, '2026-10-20');
    assert.equal(extractDate('on Monday', today)?.date, '2026-10-19');
    assert.equal(extractDate('October 30th', today)?.date, '2026-10-30');
    assert.equal(extractDate('jan 5', today)?.date, '2027-01-05');
    assert.equal(extractDate('in 2 weeks', today)?.date, '2026-10-30');
    assert.equal(extractDate('no date here', today), undefined);
  });

  it('reads clock times and parts of day', () => {
    assert.equal(extractTime('3pm works')?.time, '15:00');
    assert.equal(extractTime('at 10:30 am')?.time, '10:30');
    assert.equal(extractTime('after 4')?.relation, 'after');
    assert.equal(extractTime('mornings are best')?.partOfDay, 'morning');
  });

  it('matches dictionary values with typos and multi-word synonyms', () => {
    const dict = new EntityDictionary([
      { value: 'Dental implants', synonyms: ['implant', 'tooth replacement'] },
      { value: 'Teeth whitening', synonyms: ['whitening', 'bleaching'] },
    ]);
    assert.deepEqual(dict.find('interested in implnats and whitening').map((m) => m.value), ['Dental implants', 'Teeth whitening']);
  });

  it('computes today in a time zone', () => {
    const d = todayIn('Asia/Tokyo', new Date('2026-10-16T20:00:00Z'));
    assert.deepEqual(d, { year: 2026, month: 10, day: 17 });
  });
});

describe('sentiment and urgency', () => {
  it('handles negation', () => {
    assert.equal(analyzeSentiment('I am not happy at all').label, 'negative');
    assert.equal(analyzeSentiment('thanks, that was really helpful').label, 'positive');
  });

  it('flags urgency', () => {
    assert.ok(analyzeUrgency('severe pain, I need help today').score >= 0.8);
    assert.equal(analyzeUrgency('just browsing').score, 0);
  });
});

describe('respond helpers', () => {
  it('chooses deterministically and renders templates', () => {
    assert.equal(choose(['a', 'b', 'c'], 'seed'), choose(['a', 'b', 'c'], 'seed'));
    assert.equal(render('Hi {{name}}!', { name: 'Ana' }), 'Hi Ana!');
    assert.equal(joinList(['a', 'b', 'c']), 'a, b and c');
  });
});

describe('Assistant', () => {
  const brain = new Brain({
    intents: [
      { name: 'greet', examples: ['hello', 'hi there'] },
      { name: 'hours', examples: ['when are you open', 'opening hours'] },
    ],
  });

  it('routes turns through skills in order', async () => {
    const bot = new Assistant<{ turns: number }>(brain, [
      { name: 'count', run: ({ state }) => void state.turns++ },
      { name: 'greet', run: ({ u }) => (u.intent?.intent === 'greet' ? { text: 'Hello!' } : undefined) },
      { name: 'hours', run: ({ u }) => (u.intent?.intent === 'hours' ? { text: '9 to 5.' } : undefined) },
    ]);
    const state = { turns: 0 };
    assert.equal((await bot.reply('hi there', state)).reply.text, 'Hello!');
    assert.equal((await bot.reply('when are you open?', state)).skill, 'hours');
    assert.equal((await bot.reply('qwerty', state)).skill, 'fallback');
    assert.equal(state.turns, 3);
  });

  it('applies the refine hook and survives its failures', async () => {
    const skills = [{ name: 'echo', run: () => ({ text: 'draft' }) }];
    const upper = new Assistant(brain, skills, { refine: (d) => ({ ...d, text: d.text.toUpperCase() }) });
    assert.equal((await upper.reply('x', {})).reply.text, 'DRAFT');
    const broken = new Assistant(brain, skills, {
      refine: () => {
        throw new Error('model offline');
      },
    });
    assert.equal((await broken.reply('x', {})).reply.text, 'draft');
  });
});
