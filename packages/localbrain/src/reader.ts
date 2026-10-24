/**
 * Question answering over a SearchIndex. Search finds the right documents;
 * the reader works out *what* is being asked — how long something takes vs
 * how long it lasts, whether it hurts, whether it's safe, who it suits — and
 * picks the sentences, across the best documents, that answer exactly that.
 *
 * "Aspects" are plain regex rules (a question pattern and an answer pattern),
 * so any domain can extend or replace the defaults.
 */
import type { SearchDocument, SearchIndex } from './search.ts';
import { hash, sentences, terms } from './text.ts';

export interface AspectRule {
  name: string;
  /** Matches questions that ask about this aspect. */
  ask: RegExp;
  /** Matches questions that only hint at it ("can I get...?"): counts only when a sentence answers it squarely. */
  weakAsk?: RegExp;
  /** Sentences that answer a hinted question squarely ("X can be used when...", "is considered safe"). */
  strongAnswer?: RegExp;
  /** Matches sentences that answer it. */
  answer: RegExp;
  /** Sentences matching this are not answers even if `answer` matches. */
  unless?: RegExp;
}

/**
 * General-purpose aspects for services and treatments. Order matters for
 * questions: earlier rules are the more specific reading ("how long do they
 * last" is about longevity, not duration).
 */
export const DEFAULT_ASPECTS: AspectRule[] = [
  {
    name: 'longevity',
    ask: /\bhow long (?:do|does|will|would|can|could|should|did|are|is)\b[^?.!]*?\b(?:last|lasting|stay|hold up|keep|good for)\b|\b(?:last|lasts|lasting) (?:long|forever|for life|a lifetime|for ever)\b|\blong[- ]lasting\b|\bpermanent(?:ly)?\b|\blifespan\b|\bhow many years\b|\bforever\b|\bdurab(?:le|ility)\b|\bwear out\b|\bneed (?:to be )?replac/,
    answer: /\blast(?:s|ed|ing)?\b(?!\s+(?:visit|resort|step|appointment))|\bdecades\b|\blong-term\b|\blifetime\b|\bpermanent(?:ly)?\b|\byears or (?:more|longer)\b|\bseveral years\b|\b(?:relin|replac)(?:e|ed|ing)\b[^.]*\bevery\b|\bdurab/,
  },
  {
    name: 'duration',
    ask: /\bhow long\b(?![^?.!]*\b(?:last|lasting|stay|hold up)\b)|\b(?:healing|recovery|treatment) time\b|\btime (?:to|it takes to) (?:heal|recover)\b|\bhow many (?:visits|appointments|sessions|hours|days|weeks|months|trips)\b|\bhow (?:quick(?:ly)?|fast)\b|\btakes? (?:long|time|a while|ages)\b|\bsame[- ]day\b|\bin (?:one|a single) (?:visit|appointment|day)\b|\btimeline\b|\bhow much time\b|\bwhen will (?:it|they|i) be (?:done|finished|ready)\b/,
    answer: /\b(?:takes?|taking|took)\b[^.]{0,40}\b(?:minutes?|hours?|days?|weeks?|months?|years?|visits?|appointments?|sessions?)\b|\b(?:completed|done|finished|placed|made|fitted) (?:in|within|on the same)\b|\b\d+(?:\.\d+)? ?(?:to|-|–) ?\d+ (?:minutes|hours|days|weeks|months|years)\b|\b(?<!\bevery\s(?:\w+\s){0,3})(?:\d+|one|two|three|four|five|six|several|a few|a couple of|a single) (?:visits?|appointments?|sessions?|minutes|hours|days|weeks|months)\b|\bsingle visit\b|\bsame day\b|\bone visit\b|\bwhole process\b/,
    unless: /^(?=[^.]*\blast(?:s|ed|ing)?\b)(?![^.]*\b(?:takes?|visits?|appointments?|sessions?|hours a day)\b)/,
  },
  {
    name: 'pain',
    ask: /\bhurts?\b|\bhurting\b|\bpain(?:ful|less)?\b|\bsore(?:ness)?\b|\bdiscomfort\b|\bache\b|\bnumb(?:ing|ness)?\b|\bana?esthe|\bfeel (?:anything|it|pain)\b|\bsting\b|\b(?:un)?comfortable\b|\bsensitiv/,
    answer: /\bpain(?:ful|less)?\b|\bhurts?\b|\bdiscomfort\b|\bsore(?:ness)?\b|\btender(?:ness)?\b|\bnumb(?:ing|ness|ed)?\b|\bana?esthe|\bpressure\b|\bcomfortable\b|\bfeels? (?:similar|like)\b|\bsedation\b|\bsensitiv/,
  },
  {
    name: 'eating',
    ask: /\b(?:eat|eating|ate|food|foods|drink|drinking|chew|chewing|coffee|tea|wine|alcohol|meal|meals|diet|snacks?)\b/,
    answer: /\beat(?:ing)?\b|\bfoods?\b|\bdrinks?\b|\bchew(?:ing)?\b|\bcoffee\b|\btea\b|\bwine\b|\bsticky\b|\bhard\b|\bsoft\b|\bsugar|\bpopcorn\b|\bcandy\b|\bwater\b/,
  },
  {
    name: 'aftercare',
    ask: /\b(?:care for|look after|take care of|clean(?:ing)? (?:them|it|my \w+)|maintain|maintenance)\b|\bafter ?care\b|\bwhat (?:should|shouldn't|should not|can't|cannot|can) i (?:avoid|not do|do after)\b|\bavoid\b|\bstraws?\b|\bsmok(?:e|ing) after\b|\bsleep (?:with|in)\b/,
    answer: /\bavoid\b|\bdon'?t\b|\bdo not\b|\bbrush\b|\bfloss\b|\bclean\b|\brinse\b|\bcare for\b|\btake care\b|\bkeep\b|\bwear\b|\btake (?:\w+ )?out\b|\bout at night\b|\bretainers?\b|\bstraws?\b|\bsmok/,
  },
  {
    name: 'recovery',
    ask: /\brecover(?:y|ing)?\b|\bheal(?:ing|ed|s)?\b|\bdowntime\b|\btime off\b|\bback to (?:work|school|normal)\b|\bafter (?:the |my |a |an |getting |having )?(?:surgery|procedure|treatment|extraction|removal|operation|it)\b|\bswelling\b|\bbruis/,
    answer: /\brecover(?:y|ed|ing)?\b|\bheal(?:s|ing|ed)?\b|\bswelling\b|\bbruising\b|\bstiffness\b|\bsettle\b|\bfirst (?:day|24 hours|few days|week)\b|\brest for\b|\bafter(?:wards)? (?:the|placement|surgery|treatment)\b/,
  },
  {
    name: 'safety',
    ask: /\bsafe(?:ly|ty)?\b|\brisks?\b|\brisky\b|\bside[- ]?effects?\b|\bdanger(?:ous)?\b|\bdamag(?:e|es|ing)\b|\bharm(?:ful)?\b|\bruin\b|\bweaken\b|\bbad for\b|\bcomplications?\b/,
    answer: /\bsafe(?:ly|ty)?\b|\brisks?\b|\bside effects?\b|\bprecaution|\bradiation\b|\bdose\b|\bsensitiv|\birritation\b|\benamel\b|\bdamag|\bharm|\bfail(?:s|ing|ure)?\b|\bcomplication/,
  },
  {
    name: 'candidacy',
    weakAsk: /(?<!what )\bcan (?:i|we|my \w+|he|she|they|adults|kids|children|seniors|anyone|everyone) (?:still )?(?:get|have|use|wear|go)\b/,
    strongAnswer: /\bcan (?:still )?be (?:used|done|performed|treated)\b|\b(?:is|are) (?:considered )?safe\b|\bany age\b|\bage alone\b|\bin (?:their|your) \d0s\b/,
    ask: /\bcandidates?\b|\bsuitable\b|\beligib|\bqualify\b|\btoo (?:old|young|late)\b|\bam i (?:able|old|young)\b|\bwhat age\b|\bhow old\b|\bstill (?:get|have)\b|\b(?:for|as an?) (?:adults?|seniors?|teens?|teenagers?|older people|grown ups)\b|\bat my age\b|\bwho (?:can|should|is it for|are they for)\b/,
    answer: /\bcan (?:still )?be (?:used|done|performed|treated)\b|\bage alone\b|\bin (?:their|your) \d0s\b|\bolder adults\b|\b(?:is|are) (?:considered )?safe\b|\bcandidates?\b|\bsuit(?:s|able)?\b|\bgood (?:for|choice)\b|\bany age\b|\bages? \d|\badults?\b|\bhealthy (?:teeth|gums)\b|\benough (?:jaw)?bone\b|\bpeople (?:who|missing|with)\b|\bcan (?:correct|treat|replace|fix)\b|\bnot every(?:one)?\b|\bdepends on\b|\braise the risk\b/,
  },
  {
    name: 'process',
    ask: /\bhow (?:does|do|is|are) (?:it|they|that|this|the \w+|\w+) (?:work|done|performed|placed|fitted|made|attached|put on)\b|\bwhat happens\b(?! if)|\bwhat(?:'s| is) (?:involved|the process|the procedure)\b|\bsteps?\b|\bprocess\b|\bwhat (?:to|should i) expect\b|\bhow does it go\b/,
    answer: /\b(?:starts? with|begins? with|then|after that|finally)\b|\bplaced\b|\bfitted\b|\bbonded\b|\bscan(?:ned|s)?\b|\bimpressions?\b|\bvisits?\b|\bunder local\b|\bremov(?:e|es|ed)\b|\binvolves?\b|\bstep\b|\bchecks?\b/,
  },
  {
    name: 'alternatives',
    ask: /\balternatives?\b|\binstead of\b|\bother (?:options|ways|choices|treatments)\b|\bany other\b|\boptions?\b(?! for (?:payment|paying|financing))/,
    answer: /\balternatives?\b|\binstead\b|\boptions?\b|\bcan be (?:closed|replaced|treated|fixed) with\b|\bcompared with\b/,
  },
  {
    name: 'frequency',
    ask: /\bhow often\b|\bhow frequently\b|\bevery (?:how|few)\b|\bhow many times\b|\bonce a\b|\btwice a\b/,
    answer: /\bevery (?:\w+ )?(?:to \w+ )?(?:day|night|week|weeks|month|months|year|years|morning|evening|visit)\b|\btwice a\b|\bonce a\b|\bper (?:day|week|year)\b|\ba (?:day|year)\b|\bregular(?:ly)?\b|\b(?:how|more) often\b/,
  },
  {
    name: 'appearance',
    ask: /\blooks? (?:natural|fake|real|good|like)\b|\bnoticeable\b|\binvisible\b|\bcan (?:people|anyone|others) (?:see|tell)\b|\bresults?\b|\bshades?\b|\bhow white\b|\bcolou?r\b/,
    answer: /\blooks?\b|\bnatural\b|\binvisible\b|\btooth-colou?red\b|\bshades?\b|\bcolou?r\b|\bwhiter?\b|\bstain|\bresults?\b|\bappearance\b/,
  },
  {
    name: 'remedy',
    ask: /\bwhat can (?:i|we|you) do\b|\bwhat (?:should|do) i do\b|\bhow (?:can|do|should|could) (?:i|we|you) (?:fix|get rid of|stop|improve|treat|whiten|straighten|cure|prevent|close|replace|repair|help)\b|\bhow to (?:fix|get rid of|stop|treat|prevent|whiten|straighten|close)\b|\bcan you (?:fix|repair|replace|close|straighten|treat|help with)\b|\bwhat (?:helps|works)\b|\bany (?:tips|advice|remedies)\b|\bbest way to\b/,
    answer: /\bcan (?:often |usually )?be (?:fixed|treated|repaired|closed|improved|corrected|replaced|whitened|re-cemented|saved|straightened|removed|covered|lightened|managed)\b|\b(?:is |are )?(?:managed|treated) (?:by|with)\b|\b(?:treatment|it|they|this) can (?:stop|cover|help|reduce|protect)\b|\b(?:helps?|improves?|fix(?:es)?|treats?|repairs?|lightens?|prevents?|reduces?|protects?|closes?|replaces?|straightens?)\b|\b(?:rinse|keep|avoid|call|use|apply|hold|see) /,
  },
  {
    name: 'benefits',
    ask: /\bworth it\b|\bgood idea\b|\bbenefits?\b|\bpros\b|\badvantages?\b|\bwhy (?:get|choose|would i)\b|\bshould i (?:get|do)\b/,
    answer: /\bresists?\b|\blast(?:s|ing)?\b|\bnatural\b|\bimproves?\b|\bprotects?\b|\bsav(?:e|es|ing)\b|\bsuccess\b|\bstrong|\bdurab|\bconfiden|\blooks?\b|\bsecure\b|\bhelps?\b/,
  },
  {
    name: 'consequence',
    ask: /\bwhat (?:happens|will happen|would happen) if\b|\bwhat if i (?:don'?t|do not|never|leave)\b|\bis it bad (?:if|to)\b|(?<!\bhow (?:often|long|many|much|soon) )\bdo i (?:really |still |actually )?(?:need|have to)\b(?! to be\b)|\bwhy (?:should|do) i (?:need|have)\b|\bleave it\b|\b(?:necessary|needed|required|essential|important)\b/,
    answer: /\bhelps? (?:keep|prevent|protect)\b|\bprevents?\b|\bprotects?\b|\bleft untreated\b|\bcan (?:lead|cause|damage|loosen|spread|crack|decay)\b|\bwithout treatment\b|\bdoes not go away\b|\bdrift|\bmatter\b|\bhold (?:them|it|the teeth) in place\b|\bimportant because\b|\bto (?:stop|keep|prevent|protect) /,
  },
  {
    name: 'quantity',
    ask: /\bhow many\b(?! (?:visits|appointments|sessions|hours|days|weeks|months|years|times))/,
    answer: /\b(?:\d+|one|two|three|four|five|six|several|a few) (?:to (?:\d+|one|two|three|four|five|six|ten) )?(?:implants?|teeth|tooth|visits|appointments|veneers|crowns)\b/,
  },
  {
    name: 'cause',
    ask: /\bwhy (?:do|does|is|are|am|did|would|my|do i)\b|\bwhat (?:causes|caused|makes)\b|\bcauses?\b|\breasons?\b|\bhow come\b/,
    answer: /\bcaus(?:e|es|ed|ing)\b|\bbecause\b|\bcomes? from\b|\bhappens? when\b|\bdue to\b|\blinked to\b|\bcontribute\b|\bincrease the risk\b|\bmake \w+ worse\b/,
  },
  {
    name: 'signs',
    ask: /\bsigns?\b|\bsymptoms?\b|\bhow (?:do|would|can) i (?:know|tell)\b|\bwarning\b/,
    answer: /\bsigns?\b|\bsymptoms?\b|\bwarning\b|\binclude\b|\bmay need it\b/,
  },
  {
    name: 'children',
    ask: /\b(?:kids?|child|children|toddlers?|baby|babies|infants?|son|daughter|teens?|teenagers?|little one)\b/,
    answer: /\bchild(?:ren)?\b|\bkids?\b|\bbaby\b|\btoddlers?\b|\bunder age\b|\bages? (?:[1-9]|1[0-7])\b|\bfirst birthday\b|\bteens?\b/,
  },
  {
    name: 'pregnancy',
    ask: /\bpregnan|\bbreast ?feeding\b|\bexpecting a baby\b/,
    answer: /\bpregnan|\bbreastfeed|\btrimester\b|\bmorning sickness\b/,
  },
  {
    name: 'cost',
    ask: /\bhow much (?:is|are|was|were|does|do|did|would|will|for|to|it|they|money|roughly|approximately|about|per)\b|\bhow much \$|\bhow much\b(?:\s+\S+)?\s*\??$|\bcosts?\b|\bprices?\b|\bfees?\b|\bexpensive\b|\bafford|\bcheap|\binsurance\b|\bcovered\b|\bcover (?:it|them|this|that)\b|\bfree\b|\bquotes?\b|\bestimates?\b|\bballpark\b/,
    answer: /\$\d|\bcosts?\b|\bprice\b|\bfees?\b|\bafford|\binsurance\b|\bcovered\b|\bpayment\b|\bfinanc|\blower-cost\b|\bbudget\b|\bup front\b|\bexpensive\b|(?<!-)\bfree\b(?!-)/,
  },
  {
    name: 'definition',
    ask: /^(?:so |and |ok |okay |um |hmm )?(?:what(?:'s| is| are)|whats)\s+(?!(?:a |an |the )?(?:your|my|it like|they like|involved|happens|(?:\w+ )?(?:time|cost|price|best|difference|cheapest|fastest|earliest|latest|longest|recovery|process|age|risk|chance|success rate|way)\b))(?:a |an |the )?\w|\btell me (?:about|more)\b|\bexplain\b|\binfo(?:rmation)? (?:on|about)\b|\bmeaning of\b|\bwhat does \w+(?: \w+)? mean\b/,
    // The opening (summary) sentences of a document define it; see Reader.
    answer: /$^/,
    // ...and so does a sentence that says what the thing is.
    strongAnswer: /\b(?:is|are) (?:a|an|the|when)\b|\bmeans\b|\bhappens when\b|\brefers to\b|\b(?:is|are) called\b/,
  },
];

const ASPECT_WEIGHTS = [1, 0.75, 0.55, 0.4];

/** "cheapest", "most affordable", "best", "least invasive"... */
const SUPERLATIVE = /\b(?:most|least|best|worst|cheapest|fastest|quickest|longest|strongest|safest|easiest)\b|\b\w+est option\b/i;

/** Aspects a question asks about, most specific first. */
export function askedAspects(question: string, rules: AspectRule[] = DEFAULT_ASPECTS): string[] {
  const q = question.toLowerCase().replace(/[’`]/g, "'");
  return rules.filter((r) => r.ask.test(q) || r.weakAsk?.test(q)).map((r) => r.name);
}

/** Aspects the question only hints at (their weak pattern matched, not the main one). */
export function weakAspects(question: string, rules: AspectRule[] = DEFAULT_ASPECTS): Set<string> {
  const q = question.toLowerCase().replace(/[’`]/g, "'");
  return new Set(rules.filter((r) => !r.ask.test(q) && r.weakAsk?.test(q)).map((r) => r.name));
}

/** Aspects a sentence answers. */
export function answeredAspects(sentence: string, rules: AspectRule[] = DEFAULT_ASPECTS): string[] {
  const s = sentence.toLowerCase().replace(/[’`]/g, "'");
  return rules.filter((r) => r.answer.test(s) && !r.unless?.test(s)).map((r) => r.name);
}

/** Stable key for "has this sentence been said already?". */
export function sentenceKey(sentence: string): string {
  return hash(sentence.trim().toLowerCase()).toString(36);
}

export interface ReadSentence {
  text: string;
  key: string;
  docId: string;
  /** Position in the document (0 = first sentence). */
  index: number;
  aspects: string[];
  score: number;
}

export interface ReadAnswer<T> {
  /** Sentences to say, in document order. */
  sentences: ReadSentence[];
  /** Document the answer comes from. */
  doc: SearchDocument<T>;
  /** The aspects that were asked. */
  aspects: string[];
  /** Whether the answer addresses an asked aspect (always true when none were asked). */
  onAspect: boolean;
  /** Every candidate sentence was said before; the answer repeats one. */
  repeated: boolean;
  /** How much of the question's wording the main sentence covers, roughly 0..1. */
  match: number;
  /** Rough 0..1 confidence that this answers the question. */
  confidence: number;
}

export interface ReadRequest<T> {
  /** Aspects to answer; default: detected from the question. */
  aspects?: string[];
  /** Only consider these documents (ids), e.g. the topic being discussed. */
  within?: string[];
  /** Extra prior (0..1+) for documents, e.g. ones about a service the user named. */
  prefer?: ReadonlyMap<string, number>;
  /** Adjust a document's prior for the asked aspects (e.g. favour aftercare docs for recovery questions). */
  boost?: (doc: SearchDocument<T>, aspects: string[]) => number;
  /** Sentence keys already said in this conversation. */
  exclude?: ReadonlySet<string>;
  /**
   * Phrases the visitor used to name the topic ("hollywood smile"). If an
   * article never uses one, it is an alias and only names the article.
   */
  phrases?: string[];
  /** Documents to read from search (default 4). */
  candidates?: number;
  /** Maximum sentences in the answer (default 2). */
  max?: number;
  /** Maximum characters in the answer (default 360). */
  maxChars?: number;
}

interface Prepared {
  text: string;
  key: string;
  index: number;
  aspects: string[];
  /** Aspects this sentence answers squarely (see AspectRule.strongAnswer). */
  squarely: string[];
  terms: Set<string>;
  /** Content-word stems in order, for phrase matching. */
  seq: string[];
}

/** Does `seq` contain the phrase's words in order, each within a few words of the last ("single dark tooth" ~ "single tooth")? */
function containsNear(seq: string[], phrase: string[], window = 3): boolean {
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] !== phrase[0]) continue;
    let pos = i;
    let ok = true;
    for (let j = 1; j < phrase.length && ok; j++) {
      const next = seq.slice(pos + 1, pos + 1 + window).indexOf(phrase[j]);
      if (next < 0) ok = false;
      else pos += next + 1;
    }
    if (ok) return true;
  }
  return false;
}

export class Reader<T = unknown> {
  private readonly cache = new Map<string, { body: string; sentences: Prepared[] }>();
  readonly rules: AspectRule[];

  constructor(
    readonly index: SearchIndex<T>,
    options: { aspects?: AspectRule[] } = {}
  ) {
    this.rules = options.aspects ?? DEFAULT_ASPECTS;
  }

  /** The document's sentences with the aspects each one answers. */
  sentencesOf(doc: SearchDocument<T>): Prepared[] {
    const hit = this.cache.get(doc.id);
    if (hit && hit.body === doc.body) return hit.sentences;
    const prepared = sentences(doc.body).map((text, index) => ({
      text,
      key: sentenceKey(text),
      index,
      aspects: answeredAspects(text, this.rules),
      squarely: this.rules.filter((r) => r.strongAnswer?.test(text.toLowerCase())).map((r) => r.name),
      terms: new Set(terms(text)),
      seq: terms(text).map((t) => this.index.canonical(t)),
    }));
    this.cache.set(doc.id, { body: doc.body, sentences: prepared });
    return prepared;
  }

  /** Aspects a whole document is about, from its title and tags ("Dental care during pregnancy"). */
  docAspects(doc: SearchDocument<T>): string[] {
    const label = `${doc.title ?? ''} . ${(doc.tags ?? []).join(' . ')}`.toLowerCase();
    return this.rules.filter((r) => r.name !== 'definition' && r.ask.test(label)).map((r) => r.name);
  }

  answer(question: string, request: ReadRequest<T> = {}): ReadAnswer<T> | undefined {
    const aspects = request.aspects ?? askedAspects(question, this.rules);
    const exclude = request.exclude ?? new Set<string>();
    const max = request.max ?? 2;
    const maxChars = request.maxChars ?? 360;

    // Candidate documents with a prior from search relevance and preferences.
    const priors = new Map<string, { doc: SearchDocument<T>; prior: number }>();
    if (request.within?.length) {
      for (const id of request.within) {
        const doc = this.index.get(id);
        if (doc) priors.set(id, { doc, prior: 1 + (request.prefer?.get(id) ?? 0) });
      }
    } else {
      const hits = this.index.search(question, { limit: request.candidates ?? 4 });
      const top = hits[0]?.score ?? 1;
      for (const h of hits) priors.set(h.id, { doc: h.doc, prior: 0.6 * (h.score / top) + 0.4 * h.coverage });
      for (const [id, extra] of request.prefer ?? []) {
        const doc = this.index.get(id);
        if (!doc) continue;
        const p = priors.get(id);
        priors.set(id, { doc, prior: (p?.prior ?? 0.3) + extra });
      }
    }
    if (!priors.size) return undefined;

    const q = this.index.analyze(question);
    const weak = weakAspects(question, this.rules);
    const phrases = q.phrases.map((ph) => ph.map((t) => this.index.canonical(t)));
    const superlative = SUPERLATIVE.test(question);
    const idf = (t: string) => this.index.idf(t);
    const totalIdf = q.concepts.reduce((sum, c) => sum + Math.max(0, ...[...c.terms.keys()].map(idf)), 0) || 1;
    const weight = (w: number) => (w < 1 ? w * 0.6 : w); // the visitor's own words count more than synonyms

    interface Scored {
      s: Prepared;
      doc: SearchDocument<T>;
      prior: number;
      aspect: number;
      /** Word overlap, counting topic words in full: compares sentences across documents. */
      full: number;
      /** Word overlap with the document's own topic words discounted: ranks sentences within it. */
      local: number;
      penalty: number;
    }
    const scored: Scored[] = [];
    const asked = new Set(q.weights.keys());
    for (const { doc, prior: base } of priors.values()) {
      const topic = new Set(terms(doc.title ?? ''));
      // An article titled with what was asked ("sensitive teeth") is the best source for it.
      const titled = topic.size ? [...topic].filter((t) => asked.has(t)).length / topic.size : 0;
      const prior = base + (request.boost?.(doc, aspects) ?? 0) + (titled >= 0.5 ? 0.35 * titled : 0);
      const summaryLength = summaryLengthOf(doc);
      const docAspects = this.docAspects(doc);
      // The query's own words that the article actually talks about (beyond its title). Words found
      // only in its tags are aliases ("hollywood smile" for veneers) and just name the topic.
      const docSentences = this.sentencesOf(doc);
      const bodyTerms = new Set(docSentences.flatMap((x) => [...x.terms]));
      const aliases = new Set(
        (request.phrases ?? [])
          .map((p) => terms(p))
          .filter((words) => words.length && !docSentences.some((x) => words.every((w) => x.terms.has(w))))
          .flat()
      );
      const own = q.original.filter((t) => !topic.has(t) && !aliases.has(t) && bodyTerms.has(t));
      for (const s of this.sentencesOf(doc)) {
        let full = 0;
        let local = 0;
        for (const concept of q.concepts) {
          let bestFull = 0;
          let bestLocal = 0;
          for (const [t, w] of concept.terms) {
            if (!s.terms.has(t)) continue;
            bestFull = Math.max(bestFull, weight(w) * idf(t));
            bestLocal = Math.max(bestLocal, weight(w) * idf(t) * (topic.has(t) ? 0.3 : 1));
          }
          full += bestFull;
          local += bestLocal;
        }
        full /= totalIdf;
        local /= totalIdf;
        // Words that belong together ("root canal", "single tooth") count extra when they appear together.
        const together = Math.min(0.36, 0.12 * phrases.filter((ph) => containsNear(s.seq, ph)).length);
        // "What's the cheapest...?" is answered by "...the most affordable option".
        const ranked = superlative && SUPERLATIVE.test(s.text) ? 0.2 : 0;
        full += together + ranked;
        local += together + ranked;
        const mentionsAll = own.length > 0 && own.every((t) => s.terms.has(t));
        const credit = (name: string): number => {
          if (name === 'definition') {
            if (s.index < summaryLength) return own.length === 0 || mentionsAll ? 1 : 0.25;
            return mentionsAll ? (s.squarely.includes('definition') ? 1 : 0.8) : 0;
          }
          if (s.aspects.includes(name)) return 1;
          return docAspects.includes(name) ? 0.8 : 0;
        };
        // The best-answered aspect counts in full; answering the other asked aspects too adds half as much.
        const credits = aspects.map((a, i) => {
          // A hinted aspect only counts when the sentence answers it squarely.
          const strength = weak.has(a) ? (s.squarely.includes(a) ? 0.6 : 0.15) : 1;
          return credit(a) * strength * ASPECT_WEIGHTS[Math.min(i, ASPECT_WEIGHTS.length - 1)];
        });
        const top = Math.max(0, ...credits);
        const aspect = top + 0.5 * (credits.reduce((sum, x) => sum + x, 0) - top);
        // A list of symptoms doesn't answer "does it hurt?" unless signs were asked about.
        const offTopic = s.aspects.includes('signs') && !aspects.includes('signs') ? 1 : 0;
        // Opening sentences win ties: they usually carry the key fact.
        const position = s.index === 0 ? 0.03 : s.index < summaryLength ? 0.015 : 0;
        // Something already said loses to new information on the same aspect, but still beats an off-topic sentence.
        const penalty = (exclude.has(s.key) ? 1.2 : 0) + 0.35 * offTopic - position;
        scored.push({ s, doc, prior, aspect, full, local, penalty });
      }
    }
    if (!scored.length) return undefined;

    // 1. Which document answers best (topic words count in full, so the article *about* the topic isn't penalised).
    const across = (x: Scored) => 1.1 * x.prior + 1.3 * x.full + 1.6 * x.aspect - x.penalty;
    const winner = scored.reduce((a, b) => (across(b) > across(a) ? b : a));
    // 2. Which of its sentences (topic words discounted: every sentence there is about the topic).
    const within = (x: Scored) => 1.3 * (0.5 * x.local + 0.5 * x.full) + 1.6 * x.aspect - x.penalty;
    const own = scored.filter((x) => x.doc.id === winner.doc.id).sort((a, b) => within(b) - within(a));
    const best = own[0];

    const chosen = [best];
    const room = () => maxChars - chosen.reduce((n, c) => n + c.s.text.length + 1, 0);
    const summary = summaryLengthOf(best.doc);
    for (const x of own.slice(1)) {
      if (chosen.length >= max) break;
      if (exclude.has(x.s.key)) continue;
      const companion = aspects.length && !(aspects.length === 1 && aspects[0] === 'definition')
        ? x.aspect > 0 && x.aspect >= best.aspect * 0.7
        : x.s.index < summary && best.s.index < summary;
      if (companion && within(x) >= within(best) * 0.72 && x.s.text.length < room()) chosen.push(x);
    }

    const onAspect = !aspects.length || best.aspect > 0;
    const confidence = Math.max(
      0,
      Math.min(1, 0.35 * Math.min(1, best.full * 1.5) + (onAspect ? 0.45 : 0) + 0.2 * Math.min(1, best.prior))
    );
    return {
      sentences: chosen
        .sort((a, b) => a.s.index - b.s.index)
        .map((x) => ({ text: x.s.text, key: x.s.key, docId: x.doc.id, index: x.s.index, aspects: x.s.aspects, score: within(x) })),
      doc: best.doc,
      aspects,
      onAspect,
      repeated: exclude.has(best.s.key),
      match: best.full,
      confidence,
    };
  }
}

function summaryLengthOf(doc: SearchDocument): number {
  return Math.max(1, sentences(doc.body.split('\n')[0]).length);
}
