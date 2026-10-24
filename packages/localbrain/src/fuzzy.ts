/**
 * Typo tolerance: edit distance and a vocabulary-backed spelling corrector.
 */

/**
 * Optimal-string-alignment (Damerau-Levenshtein) distance. Returns `max + 1`
 * as soon as the distance is known to exceed `max`, so it is cheap to call on
 * many candidates.
 */
export function editDistance(a: string, b: string, max = Number.POSITIVE_INFINITY): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prevPrev: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, prevPrev[j - 2] + 1);
      }
      cur[j] = d;
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** Maximum edits tolerated for a word of this length. */
export function typoBudget(length: number): number {
  if (length <= 3) return 0;
  if (length <= 7) return 1;
  return 2;
}

/**
 * Known-word list with frequencies. `correct()` maps an unknown word to the
 * closest known word inside the typo budget ("implnats" -> "implants").
 */
export class Vocabulary {
  private readonly freq = new Map<string, number>();
  private readonly byLength = new Map<number, string[]>();
  private readonly cache = new Map<string, string>();

  add(word: string, count = 1): void {
    if (!word) return;
    const prev = this.freq.get(word);
    this.freq.set(word, (prev ?? 0) + count);
    if (prev === undefined) {
      const list = this.byLength.get(word.length) ?? [];
      list.push(word);
      this.byLength.set(word.length, list);
      this.cache.clear();
    }
  }

  addAll(words: Iterable<string>): void {
    for (const w of words) this.add(w);
  }

  has(word: string): boolean {
    return this.freq.has(word);
  }

  get size(): number {
    return this.freq.size;
  }

  /** Best correction for `word`, or `word` itself when it is known or nothing is close. */
  correct(word: string): string {
    if (this.freq.has(word) || /\d/.test(word)) return word;
    const budget = typoBudget(word.length);
    if (!budget) return word;
    const hit = this.cache.get(word);
    if (hit !== undefined) return hit;

    let best = word;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let len = word.length - budget; len <= word.length + budget; len++) {
      // Very short words ("fee", "gum") are too easy to reach by accident.
      if (len < 4) continue;
      for (const cand of this.byLength.get(len) ?? []) {
        // Short words keep their first letter ("xrays" is not "trays").
        if (word.length <= 5 && cand[0] !== word[0]) continue;
        const d = editDistance(word, cand, budget);
        if (d > budget) continue;
        // Prefer fewer edits, then a matching first letter, then common words.
        const score = d * 10 + (cand[0] === word[0] ? 0 : 5) - Math.min(4, Math.log1p(this.freq.get(cand) ?? 0));
        if (score < bestScore) {
          bestScore = score;
          best = cand;
        }
      }
    }
    if (this.cache.size > 10_000) this.cache.clear();
    this.cache.set(word, best);
    return best;
  }
}
