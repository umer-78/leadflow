import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Assistant,
  Brain,
  EntityDictionary,
  IntentClassifier,
  SearchIndex,
  Vocabulary,
  Reader,
  analyzeSentiment,
  analyzeUrgency,
  answeredAspects,
  askedAspects,
  bareName,
  bareNumber,
  choose,
  collapseElongation,
  expandShorthand,
  followUpSubject,
  sentences,
  splitQuestions,
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
    { name: 'hours', examples: ['what are your opening hours', 'when are you open', 'are you open on saturday'], keywords: ['open', 'hours'] },
    { name: 'greet', examples: ['hello', 'hi there', 'good morning'] },
  ]);

  it('classifies paraphrases and typos', () => {
    assert.equal(clf.best('could I book an apointment for friday')?.intent, 'book');
    assert.equal(clf.best('how much do veneers cost')?.intent, 'price');
    assert.equal(clf.best('what time do you open tomorrow')?.intent, 'hours');
    assert.equal(clf.best('hiya')?.intent ?? 'none', 'none');
  });

  it('does not let a one-word example act as a keyword in long messages', () => {
    const c = new IntentClassifier([
      { name: 'bye', examples: ['see you', 'goodbye'] },
      { name: 'kids', examples: ['do you treat children', 'do you see kids'] },
    ]);
    assert.equal(c.best('do you see kids at your practice')?.intent, 'kids');
    assert.equal(c.best('do you see kids')?.intent, 'kids');
    assert.equal(c.best('see you')?.intent, 'bye');
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

describe('shorthand', () => {
  it('expands chat-speak and keeps names and emails as typed', () => {
    assert.equal(expandShorthand('wat r ur hrs'), 'what are your hours');
    assert.equal(expandShorthand('can i come in tmrw pls'), 'can i come in tomorrow please');
    assert.equal(expandShorthand("Hi, I'm Ty, ty@x.com"), "Hi, I'm Ty, ty@x.com");
    assert.equal(expandShorthand('Wat time u close'), 'What time you close');
  });

  it('collapses elongated words', () => {
    assert.equal(collapseElongation('sooo'), 'so');
    assert.equal(collapseElongation('goooood'), 'good');
    assert.equal(collapseElongation('pleeease'), 'please');
  });
});

describe('dialogue', () => {
  it('splits a message into separate questions only when each part is one', () => {
    assert.deepEqual(splitQuestions('How much are veneers and do you offer payment plans?'), [
      'How much are veneers',
      'do you offer payment plans?',
    ]);
    assert.deepEqual(splitQuestions('Do you take Aetna? Also, are you open Saturdays?'), ['Do you take Aetna?', 'are you open Saturdays?']);
    assert.deepEqual(splitQuestions("I'm Maria. How much are veneers?"), ["I'm Maria. How much are veneers?"]);
    assert.deepEqual(splitQuestions("what's the difference between veneers and bonding"), ["what's the difference between veneers and bonding"]);
  });

  it('finds the new subject of an elliptical follow-up', () => {
    assert.equal(followUpSubject('what about veneers?'), 'veneers');
    assert.equal(followUpSubject('and for kids?'), 'kids');
    assert.equal(followUpSubject('veneers too?'), 'veneers');
    assert.equal(followUpSubject('and how long does it take?'), undefined);
  });

  it('spots bare choice numbers', () => {
    assert.equal(bareNumber('2'), 2);
    assert.equal(bareNumber('the first one'), 1);
    assert.equal(bareNumber('option three'), 3);
    assert.equal(bareNumber('555-201-3344'), undefined);
  });

  it('recognises a message that is just a name', () => {
    const known = (w: string) => ['implants', 'thanks'].includes(w);
    assert.equal(bareName('Sarah Connor', known), 'Sarah Connor');
    assert.equal(bareName('Implants', known), undefined);
    assert.equal(bareName('sam', known), undefined);
    assert.equal(bareName('sam', known, true), 'Sam');
    assert.equal(bareName('Cool', known), undefined);
  });

  it('does not take "on its own" for a name', () => {
    assert.equal(extractName('can a cracked tooth heal on its own'), undefined);
    assert.equal(extractName("Hi, it's Dana here"), 'Dana');
  });
});

describe('Reader', () => {
  const index = new SearchIndex<string>({ synonyms: [['hurt', 'pain', 'sore']], equivalents: [['tooth', 'teeth']] });
  index.add({
    id: 'veneers',
    title: 'Porcelain veneers',
    body: 'Porcelain veneers are thin shells bonded to the front of the teeth.\nTreatment usually takes two or three visits over a few weeks.\nWith good care, veneers commonly last 10 to 15 years.\nThe teeth may feel a little sore for a few days.',
  });
  index.add({
    id: 'whitening',
    title: 'Teeth whitening',
    body: 'Whitening lightens natural enamel with a peroxide gel.\nIn-office whitening takes about an hour.\nResults last from several months to a few years.',
  });
  const reader = new Reader(index);

  it('tells "how long does it take" from "how long does it last"', () => {
    assert.deepEqual(askedAspects('how long do veneers take'), ['duration']);
    assert.deepEqual(askedAspects('how long do veneers last'), ['longevity']);
    assert.ok(answeredAspects('Results last from several months to a few years.').includes('longevity'));
    assert.match(reader.answer('how long do veneers take')!.sentences[0].text, /two or three visits/);
    assert.match(reader.answer('how long do veneers last')!.sentences[0].text, /10 to 15 years/);
    assert.match(reader.answer('how long does whitening last')!.sentences[0].text, /several months/);
  });

  it('answers the aspect asked and skips what was already said', () => {
    const first = reader.answer('do veneers hurt?')!;
    assert.match(first.sentences[0].text, /sore/);
    const again = reader.answer('do veneers hurt?', { exclude: new Set(first.sentences.map((s) => s.key)) })!;
    assert.equal(again.repeated, true);
  });

  it('keeps abbreviations inside one sentence', () => {
    assert.deepEqual(sentences('Our team is led by Dr. Patel. She is great.'), ['Our team is led by Dr. Patel.', 'She is great.']);
  });
});
