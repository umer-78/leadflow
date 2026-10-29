/**
 * "Import from your website": reads a clinic's own public website and turns
 * what it finds into suggestions the clinic reviews before anything changes:
 * prices for its treatments, wording for its policy articles, its FAQs, and
 * its phone number, address and opening hours. Nothing is published
 * automatically; policy text and FAQs become hidden drafts.
 *
 * The URL comes from a user, so fetching is locked down: http(s) on the
 * standard ports only, no credentials in the URL, every address the host
 * resolves to must be public (checked when connecting, so DNS tricks can't
 * reach internal services), redirects must stay on the same site, pages are
 * size- and time-limited, and robots.txt is respected.
 */
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';
import type { DayKey, WeeklyHours } from '../db/schema.ts';
import { DAY_KEYS } from '../scheduling.ts';

/** A problem worth telling the clinic about ("that address isn't a public website"). */
export class ImportError extends Error {}

export interface FetchedPage {
  url: string;
  status: number;
  contentType: string;
  body: string;
}

export type PageFetcher = (url: string, opts?: { accept?: 'html' | 'text' }) => Promise<FetchedPage>;

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
export const USER_AGENT = 'LeadFlowBot/1.0 (+https://github.com/umer-78/leadflow; reads a clinic website when its owner asks)';

// ---------------------------------------------------------------- safe fetching

/** Whether an IP address is on the public internet (not loopback, private, link-local, reserved…). */
export function isPublicAddress(address: string): boolean {
  let ip = address.toLowerCase().replace(/^\[|\]$/g, '');
  const embedded = /^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (embedded) ip = embedded[1];
  if (net.isIPv4(ip)) {
    const [a, b, c] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
    if (a === 169 && b === 254) return false; // link-local, including cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return a < 224; // multicast, reserved and broadcast above
  }
  if (net.isIPv6(ip)) {
    if (ip === '::' || ip === '::1') return false;
    if (/^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || /^ff/.test(ip)) return false; // unique local, link-local, multicast
    if (ip.startsWith('::ffff:') || ip.startsWith('64:ff9b:') || ip.startsWith('2001:db8') || ip.startsWith('100::')) return false;
    return true;
  }
  return false;
}

/** The website address a clinic typed, made absolute and checked ("myclinic.com" -> https://myclinic.com/). */
export function normalizeSiteUrl(input: string, allowPrivate = false): URL {
  let s = input.trim();
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(s)) s = `https://${s}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new ImportError('Enter a website address like www.yourclinic.com.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ImportError('Enter a website address that starts with http:// or https://.');
  if (url.username || url.password) throw new ImportError("Website addresses with a user name or password can't be read.");
  if (allowPrivate) {
    url.hash = '';
    return url;
  }
  if (url.port && url.port !== '80' && url.port !== '443') throw new ImportError('Only websites on the standard ports can be read.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) ? !isPublicAddress(host) : !host.includes('.') || /\.(?:local|localhost|internal|lan|home|corp)$/i.test(host)) {
    throw new ImportError('That address is not a public website.');
  }
  url.hash = '';
  return url;
}

/** Same website, ignoring "www." ("clinic.com" and "www.clinic.com" are one site). */
export function sameSite(a: URL, b: URL): boolean {
  const host = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, '');
  return host(a) === host(b);
}

/** DNS lookup that refuses any host resolving to a non-public address (checked at connect time). */
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 0);
    const list = addresses as unknown as dns.LookupAddress[];
    if (!list.length || list.some((a) => !isPublicAddress(a.address))) {
      return callback(Object.assign(new Error(`${hostname} does not resolve to a public address`), { code: 'EBLOCKED' }), '', 0);
    }
    if (options.all) callback(null, list);
    else callback(null, list[0].address, list[0].family);
  });
};

function decodeBody(buffer: Buffer, contentType: string): string {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase() ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

/**
 * A page fetcher. Non-2xx and non-HTML responses come back with an empty body.
 * `unsafeAllowPrivateNetwork` turns off the address checks; it exists only so
 * tests can serve pages from localhost.
 */
export function createPageFetcher(opts: { unsafeAllowPrivateNetwork?: boolean } = {}): PageFetcher {
  const allowPrivate = !!opts.unsafeAllowPrivateNetwork;
  return async (url, o = {}) => fetchWithRedirects(url, o.accept ?? 'html', 0, allowPrivate);
}

/** Fetch one page of a public website, safely. */
export const fetchPublicPage: PageFetcher = createPageFetcher();

async function fetchWithRedirects(url: string, accept: 'html' | 'text', redirects: number, allowPrivate: boolean): Promise<FetchedPage> {
  const target = normalizeSiteUrl(url, allowPrivate);
  return new Promise<FetchedPage>((settle, fail) => {
    // A hard limit per page as well as the idle timeout, so a slow trickle of bytes can't hold the import.
    let deadline: NodeJS.Timeout | undefined;
    const resolve = (v: FetchedPage | PromiseLike<FetchedPage>) => {
      clearTimeout(deadline);
      settle(v);
    };
    const reject = (err: unknown) => {
      clearTimeout(deadline);
      fail(err);
    };
    const client = target.protocol === 'https:' ? https : http;
    const req = client.request(
      target,
      {
        method: 'GET',
        lookup: allowPrivate ? undefined : guardedLookup,
        agent: false,
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: accept === 'text' ? 'text/plain,*/*;q=0.5' : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers['content-type'] ?? '');
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, target);
          if (!sameSite(next, target)) return reject(new ImportError(`${target.hostname} redirects to another website (${next.hostname}).`));
          if (redirects >= MAX_REDIRECTS) return reject(new ImportError('That website redirects too many times.'));
          return fetchWithRedirects(next.href, accept, redirects + 1, allowPrivate).then(resolve, reject);
        }
        const wanted = accept === 'text' ? /text\/plain/i : /text\/html|application\/xhtml\+xml/i;
        if (status < 200 || status >= 300 || !wanted.test(contentType)) {
          res.resume();
          return resolve({ url: target.href, status, contentType, body: '' });
        }
        const encoding = String(res.headers['content-encoding'] ?? '').toLowerCase();
        const stream =
          encoding === 'gzip' ? res.pipe(zlib.createGunzip()) : encoding === 'deflate' ? res.pipe(zlib.createInflate()) : encoding === 'br' ? res.pipe(zlib.createBrotliDecompress()) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve({ url: target.href, status, contentType, body: decodeBody(Buffer.concat(chunks), contentType) });
        };
        stream.on('data', (chunk: Buffer) => {
          if (done) return;
          size += chunk.length;
          chunks.push(chunk);
          if (size > MAX_BYTES) {
            finish();
            req.destroy();
          }
        });
        stream.on('end', finish);
        stream.on('error', (err) => (done ? undefined : reject(err)));
      }
    );
    req.on('timeout', () => req.destroy(new ImportError(`${target.hostname} took too long to respond.`)));
    req.on('error', (err) => reject(err));
    deadline = setTimeout(() => req.destroy(new ImportError(`${target.hostname} took too long to respond.`)), 2 * TIMEOUT_MS);
    req.end();
  });
}

// ---------------------------------------------------------------- reading HTML

export interface PageSection {
  heading: string;
  lines: string[];
}

export interface PageText {
  url: string;
  title: string;
  sections: PageSection[];
  links: { href: string; text: string }[];
  phones: string[];
  addresses: string[];
  jsonLd: unknown[];
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', hellip: '…', copy: '©', reg: '®', trade: '™', dollar: '$', middot: '·', bull: '•',
  eacute: 'é', egrave: 'è', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', ouml: 'ö', uuml: 'ü',
  auml: 'ä', ccedil: 'ç', times: '×', frac12: '½', deg: '°', cent: '¢', euro: '€', pound: '£', shy: '',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const clean = (s: string) => squash(decodeEntities(s));

/** Marks a heading line in the flattened text (a character that never appears in real text). */
const HEADING = '\u0001';
/** Elements whose content is never page text. */
const SKIPPED = new Set(['script', 'style', 'noscript', 'svg', 'template', 'iframe', 'canvas', 'select', 'object', 'video', 'audio']);
/** Headings, plus accordion and definition-list questions ("<summary>Do you take insurance?</summary>"). */
const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'summary', 'dt']);
const BLOCKS = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'ul', 'ol', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'dd', 'dl', 'blockquote', 'figure', 'figcaption', 'button', 'label', 'fieldset', 'details', 'hr', 'form', 'br']);
/** Tags inside words or sentences ("<strong>$</strong>450"): they add no space. */
const INLINE = new Set(['b', 'strong', 'em', 'i', 'u', 'small', 'sup', 'sub', 'mark', 'abbr', 'font', 'a']);
const MAX_TAG = 4096;
const MAX_LINKS = 2000;

/**
 * Turn a page's HTML into its title, sections of text lines, links and contact details.
 * A single forward pass (no backtracking regexes), so hostile markup can't make it slow.
 */
export function extractPage(html: string, url: string): PageText {
  const src = html.slice(0, MAX_BYTES);
  const lower = src.toLowerCase();
  const out: string[] = [];
  const links: { href: string; text: string }[] = [];
  const phones: string[] = [];
  const addresses: string[] = [];
  const jsonLd: unknown[] = [];
  let title = '';
  let titleText: string[] | null = null;
  let heading: { tag: string; text: string[] } | null = null;
  let anchor: { href: string; text: string[] } | null = null;
  let address: string[] | null = null;
  let menu = 0; // inside <nav>: links count, text doesn't

  const emit = (text: string) => {
    if (titleText) return void titleText.push(text);
    anchor?.text.push(text);
    address?.push(text);
    if (menu) return;
    if (heading) heading.text.push(text);
    else out.push(text);
  };
  const endHeading = () => {
    if (heading) out.push(`\n${HEADING}${squash(heading.text.join(' '))}\n`);
    heading = null;
  };
  const endAnchor = () => {
    if (!anchor) return;
    const href = decodeEntities(anchor.href).trim();
    if (/^tel:/i.test(href)) phones.push(href.slice(4).replace(/[^\d+]/g, ''));
    else if (links.length < MAX_LINKS) {
      try {
        const abs = new URL(href, url);
        if (abs.protocol === 'http:' || abs.protocol === 'https:') links.push({ href: abs.href, text: clean(anchor.text.join(' ')).slice(0, 80) });
      } catch {
        /* not a URL */
      }
    }
    anchor = null;
  };

  let i = 0;
  let gt = -1; // the next '>' (reused while it's still ahead, so runs of stray '<' stay linear)
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      emit(src.slice(i));
      break;
    }
    if (lt > i) emit(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end === -1 ? src.length : end + 3;
      continue;
    }
    if (gt <= lt) gt = src.indexOf('>', lt + 1);
    if (gt === -1) {
      emit(src.slice(lt));
      break;
    }
    if (gt - lt > MAX_TAG) {
      emit('<');
      i = lt + 1;
      continue;
    }
    const tag = src.slice(lt + 1, gt);
    i = gt + 1;
    const m = /^(\/?)([a-zA-Z][\w-]*)/.exec(tag);
    if (!m) continue; // <!doctype …>, <?xml …?>
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();

    if (SKIPPED.has(name)) {
      if (closing) continue;
      const close = lower.indexOf(`</${name}`, i);
      const content = src.slice(i, close === -1 ? src.length : close);
      if (name === 'script' && /type\s*=\s*["']?application\/ld\+json/i.test(tag)) {
        try {
          const value: unknown = JSON.parse(content.trim());
          jsonLd.push(...(Array.isArray(value) ? value : [value]));
        } catch {
          /* malformed structured data: ignore it */
        }
      }
      const end = close === -1 ? -1 : src.indexOf('>', close);
      i = end === -1 ? src.length : end + 1;
      continue;
    }
    if (name === 'title') {
      if (!closing && !title && !titleText) titleText = [];
      else if (closing && titleText) {
        title = clean(titleText.join(' '));
        titleText = null;
      }
      continue;
    }
    if (name === 'nav') {
      menu = closing ? Math.max(0, menu - 1) : menu + 1;
      continue;
    }
    if (name === 'a') {
      endAnchor();
      if (!closing) {
        const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
        if (href) anchor = { href: href[1] ?? href[2] ?? href[3], text: [] };
      }
      continue;
    }
    if (HEADINGS.has(name) && !menu) {
      if (!closing) {
        endHeading();
        heading = { tag: name, text: [] };
      } else if (heading?.tag === name) endHeading();
      continue;
    }
    if (name === 'address') {
      if (!closing) address = [];
      else if (address) {
        const text = clean(address.join(' '));
        if (text) addresses.push(text);
        address = null;
      }
      out.push('\n');
      continue;
    }
    if (name === 'br') address?.push(', ');
    if (name === 'li' && !closing) out.push('\n• ');
    else if (name === 'td' || name === 'th') out.push(' | ');
    else if (BLOCKS.has(name) || name === 'li') out.push('\n');
    else if (!INLINE.has(name)) out.push(' ');
  }
  endHeading();
  endAnchor();
  const text = decodeEntities(out.join(''));

  const sections: PageSection[] = [{ heading: '', lines: [] }];
  for (const raw of text.split('\n')) {
    const isHeading = raw.includes(HEADING);
    const line = raw
      .replace(HEADING, '')
      .replace(/[ \t ]+/g, ' ')
      .replace(/(\s*\|\s*)+/g, ' | ')
      .replace(/^\s*[|•]?\s*\|\s*|\s*\|\s*$/g, '')
      .trim();
    if (line.replace(/[•|\s]/g, '').length < 2) continue;
    if (isHeading) sections.push({ heading: line.slice(0, 200), lines: [] });
    else sections[sections.length - 1].lines.push(line.replace(/^•\s*/, '• '));
  }
  return { url, title, sections: sections.filter((s) => s.heading || s.lines.length), links, phones, addresses, jsonLd };
}

// ---------------------------------------------------------------- crawling

export interface CrawlResult {
  start: string;
  pages: PageText[];
  /** Pages robots.txt asked us not to read. */
  disallowed: number;
}

/** Disallow/Allow rules for our user agent (or "*"), longest match wins. */
function robotsRules(txt: string): { allow: boolean; path: string }[] {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let current: (typeof groups)[number] | undefined;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (current && (key === 'allow' || key === 'disallow')) {
      if (value) current.rules.push({ allow: key === 'allow', path: value });
      lastWasAgent = false;
    }
  }
  const ours = groups.find((g) => g.agents.some((a) => a !== '*' && 'leadflowbot'.includes(a)));
  return (ours ?? groups.find((g) => g.agents.includes('*')))?.rules ?? [];
}

/** Robots.txt path match: "*" is any run of characters, a final "$" anchors the end. No regexes, so it stays linear. */
export function robotsMatch(pattern: string, path: string): boolean {
  const pat = pattern.endsWith('$') ? pattern.slice(0, -1) : `${pattern}*`;
  let i = 0;
  let j = 0;
  let star = -1;
  let mark = 0;
  while (i < path.length) {
    if (j < pat.length && pat[j] === '*') {
      star = j++;
      mark = i;
    } else if (j < pat.length && pat[j] === path[i]) {
      i++;
      j++;
    } else if (star !== -1) {
      j = star + 1;
      i = ++mark;
    } else return false;
  }
  while (pat[j] === '*') j++;
  return j === pat.length;
}

function robotsAllows(rules: { allow: boolean; path: string }[], path: string): boolean {
  let best: { allow: boolean; length: number } | undefined;
  for (const r of rules) {
    if (robotsMatch(r.path.slice(0, 500), path.slice(0, 2000)) && (!best || r.path.length > best.length)) best = { allow: r.allow, length: r.path.length };
  }
  return best?.allow ?? true;
}

const SKIP_PATH =
  /\.(?:pdf|jpe?g|png|gif|webp|svg|ico|zip|mp4|mov|mp3|docx?|xlsx?|pptx?|css|js|json|xml|txt)$|\/(?:wp-admin|wp-json|wp-login|cart|checkout|login|logout|account|my-account|feed|tag|tags|category|author|search|privacy|privacy-policy|terms|cookie|cookies|careers|jobs|blog|news|press|sitemap)(?:\/|$)/i;

const LINK_PRIORITY: [RegExp, number][] = [
  [/pric|fee|cost|rates/, 10],
  [/insur|financ|payment|membership|carecredit|cherry/, 9],
  [/new[-_ ]?patient|first[-_ ]?visit|patient[-_ ]?(?:info|forms|resources)|forms/, 8],
  [/faq|question/, 8],
  [/polic|cancel/, 7],
  [/about|team|doctor|dentist|staff|meet/, 6],
  [/contact|location|direction|hours|parking/, 6],
  [/service|treatment|procedure|cosmetic|implant|veneer|whiten|invisalign|align|ortho|brace|crown|bridge|denture|root|extraction|wisdom|emergency|clean|hygiene|pediatric|kids|children|sedation|special|offer/, 4],
];

const pageKey = (u: URL) => `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '') || '/'}`;

/** Read up to `maxPages` pages of a clinic's website, most useful pages (prices, insurance, FAQs…) first. */
export async function crawlSite(start: string, fetchPage: PageFetcher, opts: { maxPages?: number; timeBudgetMs?: number } = {}): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? 15;
  const deadline = Date.now() + (opts.timeBudgetMs ?? 25_000);
  const startUrl = normalizeSiteUrl(start);
  let rules: { allow: boolean; path: string }[] = [];
  try {
    const robots = await fetchPage(new URL('/robots.txt', startUrl).href, { accept: 'text' });
    rules = robotsRules(robots.body);
  } catch {
    /* no robots.txt: everything is allowed */
  }

  let first: FetchedPage;
  try {
    first = await fetchPage(startUrl.href);
  } catch (err) {
    if (err instanceof ImportError) throw err;
    throw new ImportError(`We couldn't open ${startUrl.hostname}. Check the address and that the website is online.`);
  }
  if (!first.body) throw new ImportError(`${startUrl.hostname} didn't return a web page (status ${first.status || 'unknown'}).`);
  const home = new URL(first.url);

  const pages: PageText[] = [];
  const seen = new Set<string>([pageKey(startUrl), pageKey(home)]);
  const queue: { url: string; score: number }[] = [];
  let disallowed = 0;
  const enqueue = (page: PageText) => {
    for (const link of page.links) {
      let u: URL;
      try {
        u = new URL(link.href);
      } catch {
        continue;
      }
      u.hash = '';
      u.search = '';
      const key = pageKey(u);
      if (!sameSite(u, home) || seen.has(key) || SKIP_PATH.test(u.pathname)) continue;
      seen.add(key);
      if (!robotsAllows(rules, u.pathname)) {
        disallowed++;
        continue;
      }
      const hay = `${u.pathname} ${link.text}`.toLowerCase();
      const score = LINK_PRIORITY.reduce((sum, [re, w]) => sum + (re.test(hay) ? w : 0), 1) - u.pathname.split('/').length * 0.1;
      queue.push({ url: u.href, score });
    }
  };
  const firstPage = extractPage(first.body, first.url);
  pages.push(firstPage);
  enqueue(firstPage);

  while (queue.length && pages.length < maxPages && Date.now() < deadline) {
    queue.sort((a, b) => b.score - a.score);
    const batch = queue.splice(0, Math.min(3, maxPages - pages.length));
    const results = await Promise.allSettled(batch.map((item) => fetchPage(item.url)));
    for (const r of results) {
      if (r.status !== 'fulfilled' || !r.value.body) continue;
      const finalUrl = new URL(r.value.url);
      if (!sameSite(finalUrl, home)) continue;
      const page = extractPage(r.value.body, r.value.url);
      pages.push(page);
      enqueue(page);
    }
  }
  return { start: home.href, pages, disallowed };
}

// ---------------------------------------------------------------- analysis

export interface ImportArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  service: string | null;
  summary: string;
  tags: string[];
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: string | null;
  published: boolean;
}

export interface PriceSuggestion {
  articleId: string;
  title: string;
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: string | null;
  current: { priceMin: number | null; priceMax: number | null; priceUnit: string | null };
  evidence: string;
  url: string;
}

export interface PolicySuggestion {
  articleId: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  url: string;
  /** The article is already filled in and published: applying replaces the clinic's wording. */
  replaces: boolean;
}

export interface FaqSuggestion {
  title: string;
  summary: string;
  body: string;
  url: string;
}

export interface ContactSuggestion {
  phone?: string;
  address?: string;
  hours?: WeeklyHours;
  url?: string;
}

export interface ImportSuggestions {
  site: string;
  pages: { url: string; title: string }[];
  disallowed: number;
  prices: PriceSuggestion[];
  policies: PolicySuggestion[];
  faqs: FaqSuggestion[];
  contact: ContactSuggestion;
}

/** Tags that name a problem rather than a treatment ("missing tooth"), so a price near them isn't that treatment's. */
const PROBLEM_TAGS = new Set([
  'missing tooth', 'missing teeth', 'gap where a tooth was', 'lost a tooth', 'crooked teeth', 'crowded teeth', 'gaps', 'straight teeth',
  'straighten my teeth', 'tooth decay', 'decay', 'cavity', 'cavities', 'hole in my tooth', 'stained teeth', 'yellow teeth', 'chipped teeth',
  'uneven teeth', 'cracked tooth', 'bleeding gums', 'swollen gums', 'loose teeth', 'receding gums', 'gum recession', 'jaw pain',
  'morning headaches', 'sensitive teeth', 'tooth replacement', 'replace a tooth', 'replace missing teeth', 'new teeth', 'trays',
]);

const MONEY = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?(?:\s?(?:-|–|—|to)\s?\$?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)?/g;
/** Lines about memberships, financing or discounts carry prices that aren't treatment fees. */
const NOT_A_FEE = /\bmembership\b|\bper month\b|\/\s?mo(?:nth)?\b|\ba month\b|\bmonthly\b|\binsurance\b|\bfinanc|\bpayment plan|\bcoupon\b|\bgift card\b|\bsave\b|\bdiscount\b|\boff (?:your|any|all|our)\b|\b\d+% off\b/i;
const UNIT = /^\s*(?:\/|per\s+|a\s+)(tooth|arch|tray|treatment|visit|session|filling|crown|implant|veneer|unit|quadrant|guard|appliance|case|aligner|bracket|canal|extraction)\b|^\s*(each)\b/i;

const toDollars = (s: string) => Number(s.replace(/,/g, ''));
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Split a line of prose into sentences (a price list line stays whole). */
function sentencesOf(line: string): string[] {
  return line
    .split(/(?<=[.!?])\s+(?=[A-Z"“(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

interface Alias {
  articleId: string;
  re: RegExp;
  length: number;
}

function serviceAliases(articles: ImportArticle[]): Alias[] {
  const out: Alias[] = [];
  for (const a of articles) {
    if (!a.service || a.category === 'EMERGENCY') continue;
    const names = new Set([a.service, a.title.replace(/\(.*?\)/g, ''), ...a.tags].map((n) => n.toLowerCase().trim()));
    for (const name of names) {
      if (name.length < 4 || PROBLEM_TAGS.has(name)) continue;
      // "veneers" also matches "veneer"; "crowns" matches "crown".
      const stem = escapeRe(name).replace(/s$/, '');
      out.push({ articleId: a.id, re: new RegExp(`\\b${stem}(?:s|es)?\\b`, 'gi'), length: name.length });
    }
  }
  return out.sort((x, y) => y.length - x.length);
}

/** Where each treatment is named in a sentence (longest names win where they overlap). */
function findServices(text: string, aliases: Alias[]): { articleId: string; index: number }[] {
  const taken: [number, number][] = [];
  const out: { articleId: string; index: number }[] = [];
  for (const alias of aliases) {
    for (const m of text.matchAll(alias.re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      out.push({ articleId: alias.articleId, index: start });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

function analyzePrices(pages: PageText[], articles: ImportArticle[]): PriceSuggestion[] {
  const aliases = serviceAliases(articles);
  const found = new Map<string, { values: number[]; from: boolean; upTo: boolean; unit?: string; evidence: string[]; url: string }>();
  for (const page of pages) {
    for (const section of page.sections) {
      const headingServices = findServices(section.heading, aliases);
      const headingService = new Set(headingServices.map((s) => s.articleId)).size === 1 ? headingServices[0].articleId : undefined;
      for (const line of section.lines) {
        for (const sentence of sentencesOf(line)) {
          if (!sentence.includes('$') || NOT_A_FEE.test(sentence)) continue;
          const named = findServices(sentence, aliases);
          for (const m of sentence.matchAll(MONEY)) {
            const at = m.index ?? 0;
            const low = toDollars(m[1]);
            const high = m[2] ? toDollars(m[2]) : undefined;
            if (low < 10 || low > 100_000 || (high !== undefined && (high < low || high > 100_000))) continue;
            const before = sentence.slice(Math.max(0, at - 30), at);
            const after = sentence.slice(at + m[0].length, at + m[0].length + 30);
            // The treatment named closest before the price, else just after it, else the section's heading.
            const prior = named.filter((n) => n.index < at && at - n.index <= 120).pop();
            const next = named.find((n) => n.index > at && n.index - at <= 60);
            const articleId = prior?.articleId ?? next?.articleId ?? (named.length ? undefined : headingService);
            if (!articleId) continue;
            const entry = found.get(articleId) ?? { values: [], from: false, upTo: false, evidence: [], url: page.url };
            if (/\b(?:from|starting (?:at|from)|starts at|as low as|beginning at)\s*$/i.test(before) && high === undefined) entry.from = true;
            if (/\bup to\s*$/i.test(before) && high === undefined) entry.upTo = true;
            entry.values.push(low, ...(high !== undefined ? [high] : []));
            const unit = UNIT.exec(after);
            if (unit && !entry.unit) entry.unit = unit[1] ? `per ${unit[1].toLowerCase()}` : 'each';
            const quote = clip(section.heading && !sentence.toLowerCase().includes(section.heading.toLowerCase()) && articleId === headingService && !named.length ? `${section.heading}: ${sentence}` : sentence, 220);
            if (!entry.evidence.includes(quote) && entry.evidence.length < 2) entry.evidence.push(quote);
            found.set(articleId, entry);
          }
        }
      }
    }
  }
  const out: PriceSuggestion[] = [];
  for (const [articleId, f] of found) {
    const a = articles.find((x) => x.id === articleId)!;
    const min = Math.min(...f.values);
    const max = Math.max(...f.values);
    const single = min === max;
    const priceMin = f.upTo && single ? null : min;
    const priceMax = f.from && single ? null : max;
    const priceUnit = f.unit ?? a.priceUnit;
    if (priceMin === a.priceMin && priceMax === a.priceMax && priceUnit === a.priceUnit) continue;
    out.push({
      articleId,
      title: a.title,
      priceMin,
      priceMax,
      priceUnit,
      current: { priceMin: a.priceMin, priceMax: a.priceMax, priceUnit: a.priceUnit },
      evidence: f.evidence.join(' … '),
      url: f.url,
    });
  }
  return out.sort((x, y) => x.title.localeCompare(y.title));
}

/** What each clinic-policy article is about, so the right part of the website can fill it in. */
const POLICY_SIGNALS: Record<string, RegExp> = {
  insurance:
    /\binsurances?\b|\bppos?\b|\bin[- ]network\b|\bout[- ]of[- ]network\b|\bdelta dental\b|\bcigna\b|\baetna\b|\bmetlife\b|\bguardian\b|\bunited ?healthcare\b|\bhumana\b|\bmedicaid\b|\bmedicare\b|\bbenefits\b|\bclaims?\b|\bco-?pays?\b|\bdeductibles?\b/gi,
  'payment-and-financing':
    /\bfinanc\w*|\bpayment plans?\b|\bpayment options?\b|\bcare ?credit\b|\bcherry\b|\bsunbit\b|\bproceed finance\b|\blending ?club\b|\bmonthly payments?\b|\bcredit cards?\b|\bdebit cards?\b|\bcash\b|\bhsa\b|\bfsa\b|\bmembership\b|\bsavings plan\b|\binterest[- ]free\b|\b0% (?:apr|interest)\b|\buninsured\b/gi,
  'new-patients':
    /\bnew patients?\b|\bfirst (?:visit|appointment)\b|\bpatient forms?\b|\bintake forms?\b|\bmedical history\b|\bwhat to bring\b|\bphoto id\b|\barrive (?:\d+|a few) minutes early\b|\baccepting new\b/gi,
  'cancellation-policy':
    /\bcancel\w*|\breschedul\w*|\bmissed appointments?\b|\bno[- ]shows?\b|\b(?:24|48|twenty[- ]four|forty[- ]eight)[- ]hours?'? (?:notice|in advance)\b|\blate (?:arrivals?|fees?)\b|\bbroken appointments?\b/gi,
  'meet-the-team':
    /\bdr\.?\s+[a-z]+|\bd\.?d\.?s\.?(?=\W)|\bd\.?m\.?d\.?(?=\W)|\bhygienists?\b|\bour team\b|\bmeet (?:the|our)\b|\bboard[- ]certified\b|\bgraduated\b|\bdental school\b|\byears of experience\b|\bspeaks? (?:spanish|french|mandarin|cantonese|arabic|urdu|hindi|vietnamese|korean)\b/gi,
  'appointments-and-walk-ins':
    /\bwalk[- ]ins?\b|\bsame[- ]day\b|\bemergency (?:appointments?|visits?|care)\b|\bbook (?:online|an appointment)\b|\bschedule (?:online|an appointment|your)\b|\bevening (?:hours|appointments)\b|\bweekend (?:hours|appointments)\b|\bafter[- ]hours\b|\bon[- ]call\b/gi,
  'location-and-parking':
    /\bparking\b|\bgarage\b|\bwheelchair\b|\baccessib\w*|\bsuite\b|\bfloor\b|\belevator\b|\bbus\b|\bsubway\b|\btrain station\b|\bdirections\b|\blocated (?:at|in|on|near)\b|\bacross from\b|\bnext to\b/gi,
};

const matchCount = (re: RegExp, s: string) => new Set((s.match(re) ?? []).map((m) => m.toLowerCase())).size;
const isTemplate = (a: ImportArticle) => /\[[^\]]{3,}\]/.test(a.summary);

function analyzePolicies(pages: PageText[], articles: ImportArticle[]): PolicySuggestion[] {
  const out: PolicySuggestion[] = [];
  for (const article of articles) {
    const signal = POLICY_SIGNALS[article.slug];
    if (!signal || article.category !== 'POLICY') continue;
    const mentions = new RegExp(signal.source, 'i');
    const candidates: { score: number; section: PageSection; url: string }[] = [];
    for (const page of pages) {
      for (const section of page.sections) {
        const body = section.lines.join(' ');
        const inBody = matchCount(signal, body);
        if (!inBody) continue;
        candidates.push({ score: 3 * matchCount(signal, section.heading) + inBody, section, url: page.url });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates.filter((c) => c.score >= 3).slice(0, 2);
    if (!chosen.length) continue;
    const picked: string[] = [];
    for (const c of chosen) {
      c.section.lines.forEach((line, i) => {
        for (const s of sentencesOf(line.replace(/^•\s*/, ''))) {
          // Sentences about the topic, plus the opening sentence of a section that is about it.
          if ((mentions.test(s) || (i === 0 && mentions.test(c.section.heading))) && !picked.includes(s) && s.length <= 400) picked.push(s);
        }
      });
    }
    const sentences: string[] = [];
    let total = 0;
    for (const s of picked) {
      if (sentences.length >= 6 || total + s.length > 900) break;
      sentences.push(/[.!?]$/.test(s) ? s : `${s}.`);
      total += s.length;
    }
    if (sentences.length < 2 && total < 120) continue;
    const summaryCount = sentences[0].length < 140 && sentences.length > 2 ? 2 : 1;
    out.push({
      articleId: article.id,
      slug: article.slug,
      title: article.title,
      summary: sentences.slice(0, summaryCount).join(' '),
      body: sentences.slice(summaryCount).join('\n'),
      url: chosen[0].url,
      replaces: article.published && !isTemplate(article),
    });
  }
  return out;
}

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2));
function similar(a: string, b: string): boolean {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return false;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / new Set([...x, ...y]).size >= 0.7;
}

function analyzeFaqs(pages: PageText[], articles: ImportArticle[]): FaqSuggestion[] {
  const out: FaqSuggestion[] = [];
  const add = (question: string, answerLines: string[], url: string) => {
    const q = question.replace(/^Q[:.]\s*/i, '').trim();
    if (q.length < 10 || q.length > 160 || !q.endsWith('?')) return;
    const answer = answerLines
      .map((l) => l.replace(/^A[:.]\s*/i, '').replace(/^•\s*/, ''))
      .join(' ')
      .trim();
    if (answer.length < 40 || answer.endsWith('?')) return;
    if (out.some((f) => similar(f.title, q)) || articles.some((a) => similar(a.title, q))) return;
    const sentences = sentencesOf(clip(answer, 900));
    const count = sentences[0].length < 120 && sentences.length > 1 ? 2 : 1;
    out.push({ title: q, summary: sentences.slice(0, count).join(' '), body: sentences.slice(count).join('\n'), url });
  };
  for (const page of pages) {
    for (const section of page.sections) {
      if (section.heading.endsWith('?')) add(section.heading, section.lines.slice(0, 6), page.url);
      // Questions written as lines inside a section ("Q: Do you see children?" then the answer).
      for (let i = 0; i < section.lines.length - 1; i++) {
        const line = section.lines[i];
        if (!line.endsWith('?') || line.length > 160) continue;
        const answer: string[] = [];
        for (let j = i + 1; j < section.lines.length && !section.lines[j].endsWith('?') && answer.length < 4; j++) answer.push(section.lines[j]);
        add(line, answer, page.url);
      }
      if (out.length >= 25) return out;
    }
  }
  return out;
}

const DAY_ALIASES: Record<string, DayKey> = { su: 'sun', mo: 'mon', tu: 'tue', we: 'wed', th: 'thu', fr: 'fri', sa: 'sat' };
const WEEK_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function dayOf(value: string): DayKey | undefined {
  const s = value.toLowerCase().replace(/^https?:\/\/schema\.org\//, '').trim();
  return DAY_ALIASES[s.slice(0, 2)];
}

function time24(value: unknown): string | undefined {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return undefined;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** Opening hours from schema.org data: openingHoursSpecification or "Mo-Fr 08:00-17:00" strings. */
export function hoursFromStructuredData(node: Record<string, unknown>): WeeklyHours | undefined {
  const hours = Object.fromEntries(DAY_KEYS.map((d) => [d, [] as [string, string][]])) as WeeklyHours;
  let any = false;
  const add = (day: DayKey | undefined, open?: string, close?: string) => {
    if (!day || !open || !close || open >= close || hours[day].length >= 3) return;
    hours[day].push([open, close]);
    any = true;
  };
  const specs = node.openingHoursSpecification;
  for (const spec of Array.isArray(specs) ? specs : specs ? [specs] : []) {
    if (!spec || typeof spec !== 'object') continue;
    const s = spec as Record<string, unknown>;
    const days = Array.isArray(s.dayOfWeek) ? s.dayOfWeek : [s.dayOfWeek];
    for (const d of days) add(dayOf(String(d ?? '')), time24(s.opens), time24(s.closes));
  }
  // "Mo-Fr 08:00-17:00", "Mo,We,Fr 09:00-13:00; Sa 09:00-12:00"
  const strings = node.openingHours;
  for (const entry of Array.isArray(strings) ? strings : typeof strings === 'string' ? [strings] : []) {
    for (const part of String(entry).split(/;|,(?=\s*[A-Za-z]{2}(?:\s*-\s*[A-Za-z]{2})?\s+\d)/)) {
      const m = /^\s*([A-Za-z]{2}(?:\s*[-,]\s*[A-Za-z]{2})*)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(part);
      if (!m) continue;
      for (const item of m[1].split(',')) {
        const [a, b] = item.split('-').map((d) => DAY_ALIASES[d.trim().toLowerCase()]);
        if (!a) continue;
        const i = WEEK_ORDER.indexOf(a);
        const j = b ? WEEK_ORDER.indexOf(b) : i;
        for (let k = i; k <= (j >= i ? j : j + 7); k++) add(WEEK_ORDER[k % 7], time24(m[2]), time24(m[3]));
      }
    }
  }
  return any ? hours : undefined;
}

const BUSINESS_TYPES = /dentist|medical|clinic|physician|localbusiness|healthandbeauty|organization/i;

function structuredNodes(value: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(value)) value.forEach((v) => structuredNodes(v, out));
  else if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>;
    out.push(node);
    if (node['@graph']) structuredNodes(node['@graph'], out);
  }
  return out;
}

function analyzeContact(pages: PageText[]): ContactSuggestion {
  const contact: ContactSuggestion = {};
  const nodes = pages.flatMap((p) => structuredNodes(p.jsonLd).map((node) => ({ node, url: p.url })));
  const types = (n: Record<string, unknown>) => [n['@type']].flat().map(String).join(' ');
  const business = [...nodes].sort((a, b) => Number(/dentist/i.test(types(b.node))) - Number(/dentist/i.test(types(a.node)))).find((n) => BUSINESS_TYPES.test(types(n.node)));
  if (business) {
    const n = business.node;
    if (typeof n.telephone === 'string') contact.phone = n.telephone.replace(/[^\d+]/g, '');
    const addr = n.address;
    if (typeof addr === 'string') contact.address = addr.trim();
    else if (addr && typeof addr === 'object') {
      const a = addr as Record<string, unknown>;
      const region = [a.addressRegion, a.postalCode].filter(Boolean).join(' ');
      contact.address = [a.streetAddress, a.addressLocality, region].filter(Boolean).join(', ') || undefined;
    }
    contact.hours = hoursFromStructuredData(n);
    contact.url = business.url;
  }
  if (!contact.phone) {
    const counts = new Map<string, number>();
    for (const p of pages) for (const phone of new Set(p.phones)) if (phone.replace(/\D/g, '').length >= 10) counts.set(phone, (counts.get(phone) ?? 0) + 1);
    const best = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (best) contact.phone = best[0];
  }
  if (!contact.address) contact.address = pages.flatMap((p) => p.addresses).find((a) => /\d/.test(a) && a.length <= 200);
  return contact;
}

/** Lines that repeat on most pages (menus, footers) aren't content. */
function withoutBoilerplate(pages: PageText[]): PageText[] {
  if (pages.length < 3) return pages;
  const counts = new Map<string, number>();
  for (const p of pages) for (const line of new Set(p.sections.flatMap((s) => s.lines))) counts.set(line, (counts.get(line) ?? 0) + 1);
  const common = new Set([...counts].filter(([, n]) => n >= Math.max(3, pages.length * 0.6)).map(([line]) => line));
  return pages.map((p) => ({ ...p, sections: p.sections.map((s) => ({ ...s, lines: s.lines.filter((l) => !common.has(l)) })) }));
}

/** Everything worth suggesting from a crawled website. */
export function analyzeSite(crawl: CrawlResult, articles: ImportArticle[]): ImportSuggestions {
  const pages = withoutBoilerplate(crawl.pages);
  return {
    site: crawl.start,
    pages: crawl.pages.map((p) => ({ url: p.url, title: p.title })),
    disallowed: crawl.disallowed,
    prices: analyzePrices(pages, articles),
    policies: analyzePolicies(pages, articles),
    faqs: analyzeFaqs(pages, articles),
    contact: analyzeContact(crawl.pages),
  };
}
