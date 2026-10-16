/**
 * Full-text knowledge search: BM25F ranking over title/tags/body with spelling
 * correction, synonym expansion, phrase bonus, and extractive passages.
 */
import { Vocabulary } from './fuzzy.ts';
import { STOPWORDS, sentences, stem, terms, tokenize } from './text.ts';

export interface SearchDocument<T = unknown> {
  id: string;
  title?: string;
  body: string;
  tags?: string[];
  data?: T;
}

export interface SearchHit<T = unknown> {
  id: string;
  /** Raw BM25F score (unbounded, comparable within one query). */
  score: number;
  /** Share of the query's (idf-weighted) terms this document matched, 0..1. */
  coverage: number;
  /** Stemmed query terms found in the document. */
  matched: string[];
  doc: SearchDocument<T>;
}

export interface SearchIndexOptions {
  /** Relative weight of each field (default title 3, tags 2.5, body 1). */
  fieldWeights?: Partial<Record<Field, number>>;
  /** Groups of equivalent phrases, e.g. [["invisalign", "clear aligners"], ["cost", "price", "fee"]]. */
  synonyms?: string[][];
  /** Weight given to synonym-expanded terms (default 0.6). */
  synonymWeight?: number;
  k1?: number;
  b?: number;
}

export interface QueryAnalysis {
  /** Corrected tokens, stop words included, in order. */
  tokens: string[];
  /** Stemmed query term -> weight (1 for original terms, lower for synonyms). */
  weights: Map<string, number>;
  /** Stemmed original (non-synonym) terms in order. */
  original: string[];
}

type Field = 'title' | 'tags' | 'body';
const FIELDS: Field[] = ['title', 'tags', 'body'];

interface Indexed<T> {
  doc: SearchDocument<T>;
  tf: Record<Field, Map<string, number>>;
  len: Record<Field, number>;
  bigrams: Set<string>;
}

function countTerms(list: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of list) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function bigramsOf(list: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < list.length; i++) out.push(list[i] + ' ' + list[i + 1]);
  return out;
}

export class SearchIndex<T = unknown> {
  private readonly docs = new Map<string, Indexed<T>>();
  private readonly df = new Map<string, number>();
  private readonly totalLen: Record<Field, number> = { title: 0, tags: 0, body: 0 };
  private readonly vocab = new Vocabulary();
  private readonly weights: Record<Field, number>;
  private readonly synonymGroups: string[][][];
  private readonly synonymWeight: number;
  private readonly k1: number;
  private readonly b: number;

  constructor(options: SearchIndexOptions = {}) {
    this.weights = { title: 3, tags: 2.5, body: 1, ...options.fieldWeights };
    this.synonymGroups = (options.synonyms ?? []).map((g) => g.map((p) => tokenize(p)).filter((p) => p.length));
    this.synonymWeight = options.synonymWeight ?? 0.6;
    this.k1 = options.k1 ?? 1.2;
    this.b = options.b ?? 0.75;
    for (const group of this.synonymGroups) for (const phrase of group) this.vocab.addAll(phrase);
  }

  get size(): number {
    return this.docs.size;
  }

  get(id: string): SearchDocument<T> | undefined {
    return this.docs.get(id)?.doc;
  }

  all(): SearchDocument<T>[] {
    return [...this.docs.values()].map((d) => d.doc);
  }

  add(doc: SearchDocument<T>): void {
    if (this.docs.has(doc.id)) this.remove(doc.id);
    const fieldTerms: Record<Field, string[]> = {
      title: terms(doc.title ?? ''),
      tags: terms((doc.tags ?? []).join(' . ')),
      body: terms(doc.body),
    };
    const entry: Indexed<T> = {
      doc,
      tf: { title: countTerms(fieldTerms.title), tags: countTerms(fieldTerms.tags), body: countTerms(fieldTerms.body) },
      len: { title: fieldTerms.title.length, tags: fieldTerms.tags.length, body: fieldTerms.body.length },
      bigrams: new Set([...bigramsOf(fieldTerms.title), ...bigramsOf(fieldTerms.body), ...bigramsOf(fieldTerms.tags)]),
    };
    const unique = new Set<string>();
    for (const f of FIELDS) {
      this.totalLen[f] += entry.len[f];
      for (const t of entry.tf[f].keys()) unique.add(t);
    }
    for (const t of unique) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    for (const w of tokenize(`${doc.title ?? ''} ${(doc.tags ?? []).join(' ')} ${doc.body}`)) {
      if (!STOPWORDS.has(w)) this.vocab.add(w);
    }
    this.docs.set(doc.id, entry);
  }

  addAll(docs: Iterable<SearchDocument<T>>): void {
    for (const d of docs) this.add(d);
  }

  remove(id: string): boolean {
    const entry = this.docs.get(id);
    if (!entry) return false;
    const unique = new Set<string>();
    for (const f of FIELDS) {
      this.totalLen[f] -= entry.len[f];
      for (const t of entry.tf[f].keys()) unique.add(t);
    }
    for (const t of unique) {
      const n = (this.df.get(t) ?? 1) - 1;
      if (n <= 0) this.df.delete(t);
      else this.df.set(t, n);
    }
    this.docs.delete(id);
    return true;
  }

  clear(): void {
    for (const id of [...this.docs.keys()]) this.remove(id);
  }

  /** Inverse document frequency (BM25 variant, always positive). */
  idf(term: string): number {
    const n = this.docs.size;
    const df = this.df.get(term) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  /** Spell-correct, expand synonyms and stem a query. */
  analyze(query: string): QueryAnalysis {
    const tokens = tokenize(query).map((t) => (STOPWORDS.has(t) ? t : this.vocab.correct(t)));
    const original = tokens.filter((t) => !STOPWORDS.has(t)).map(stem);
    const weights = new Map<string, number>();
    for (const t of original) weights.set(t, 1);

    for (const group of this.synonymGroups) {
      const present = group.some((phrase) => containsPhrase(tokens, phrase));
      if (!present) continue;
      for (const phrase of group) {
        for (const t of phrase) {
          if (STOPWORDS.has(t)) continue;
          const s = stem(t);
          if ((weights.get(s) ?? 0) < this.synonymWeight) weights.set(s, this.synonymWeight);
        }
      }
    }
    return { tokens, weights, original };
  }

  search(
    query: string,
    options: { limit?: number; minScore?: number; filter?: (doc: SearchDocument<T>) => boolean } = {}
  ): SearchHit<T>[] {
    const { limit = 5, minScore = 0, filter } = options;
    if (!this.docs.size) return [];
    const q = this.analyze(query);
    if (!q.weights.size) return [];

    const n = this.docs.size;
    const avg: Record<Field, number> = {
      title: this.totalLen.title / n || 1,
      tags: this.totalLen.tags / n || 1,
      body: this.totalLen.body / n || 1,
    };
    const idf = new Map<string, number>();
    for (const t of q.weights.keys()) idf.set(t, this.idf(t));
    const queryBigrams = bigramsOf(q.original);
    const coverageBase = new Set(q.original.length ? q.original : q.weights.keys());
    let coverageTotal = 0;
    for (const t of coverageBase) coverageTotal += idf.get(t) ?? 0;

    const hits: SearchHit<T>[] = [];
    for (const [id, entry] of this.docs) {
      if (filter && !filter(entry.doc)) continue;
      let score = 0;
      let covered = 0;
      const matched: string[] = [];
      for (const [t, w] of q.weights) {
        let tf = 0;
        for (const f of FIELDS) {
          const raw = entry.tf[f].get(t);
          if (!raw) continue;
          tf += (this.weights[f] * raw) / (1 - this.b + (this.b * entry.len[f]) / avg[f]);
        }
        if (!tf) continue;
        matched.push(t);
        score += w * (idf.get(t) ?? 0) * ((tf * (this.k1 + 1)) / (tf + this.k1));
        if (coverageBase.has(t)) covered += idf.get(t) ?? 0;
      }
      if (!score) continue;
      for (const bg of queryBigrams) {
        if (entry.bigrams.has(bg)) {
          const [a, b] = bg.split(' ');
          score += 0.5 * (((idf.get(a) ?? 0) + (idf.get(b) ?? 0)) / 2);
        }
      }
      if (score < minScore) continue;
      hits.push({ id, score, coverage: coverageTotal ? covered / coverageTotal : 0, matched, doc: entry.doc });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }

  /**
   * The sentences of `text` that best answer `query`, in their original order.
   * Pass the document's title/tags as `topic`: words that only name the topic
   * ("whitening" in a whitening article) then count less than the words that
   * say what is being asked ("hurt", "how long"). Falls back to the opening
   * sentences when nothing matches.
   */
  passages(text: string, query: string, max = 2, topic: { title?: string; tags?: string[] } = {}): string[] {
    const sents = sentences(text);
    if (sents.length <= max) return sents;
    const q = this.analyze(query);
    const topicTerms = new Set(terms(`${topic.title ?? ''} ${(topic.tags ?? []).join(' ')}`));
    const scored = sents.map((s, i) => {
      const present = new Set(terms(s));
      let match = 0;
      for (const [t, w] of q.weights) {
        if (present.has(t)) match += w * this.idf(t) * (topicTerms.has(t) ? 0.25 : 1);
      }
      // Earlier sentences win ties: they usually carry the key fact.
      return { s, i, match, rank: match + (sents.length - i) * 0.001 };
    });
    const best = scored
      .filter((x) => x.match > 0)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, max);
    if (!best.length) return sents.slice(0, max);
    return best.sort((a, b) => a.i - b.i).map((x) => x.s);
  }
}

function containsPhrase(tokens: string[], phrase: string[]): boolean {
  outer: for (let i = 0; i + phrase.length <= tokens.length; i++) {
    for (let j = 0; j < phrase.length; j++) {
      if (tokens[i + j] !== phrase[j] && stem(tokens[i + j]) !== stem(phrase[j])) continue outer;
    }
    return true;
  }
  return false;
}
