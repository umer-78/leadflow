import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import zlib from 'node:zlib';
import {
  ImportError,
  createPageFetcher,
  analyzeSite,
  crawlSite,
  extractPage,
  fetchPublicPage,
  hoursFromStructuredData,
  isPublicAddress,
  normalizeSiteUrl,
  robotsMatch,
  type ImportArticle,
} from '../server/knowledge/importer.ts';
import { LIBRARY } from '../server/knowledge/library.ts';
import { CLINIC_SITE, fakeSite } from './fixtures/clinic-site.ts';

const ARTICLES: ImportArticle[] = LIBRARY.map((a) => ({
  id: a.slug,
  slug: a.slug,
  title: a.title,
  category: a.category,
  service: a.service ?? null,
  summary: a.summary,
  tags: a.tags,
  priceMin: null,
  priceMax: null,
  priceUnit: a.priceUnit ?? null,
  published: a.published ?? true,
}));

describe('website import: safety', () => {
  it('only treats public internet addresses as public', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '[::1]']) {
      assert.equal(isPublicAddress(ip), false, ip);
    }
    for (const ip of ['8.8.8.8', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111']) assert.equal(isPublicAddress(ip), true, ip);
  });

  it('accepts ordinary website addresses and rejects everything else', () => {
    assert.equal(normalizeSiteUrl('smilestudio.example').href, 'https://smilestudio.example/');
    assert.equal(normalizeSiteUrl('  http://www.clinic.com/about#team ').href, 'http://www.clinic.com/about');
    for (const bad of ['localhost', 'http://127.0.0.1/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data', 'http://0x7f.0.0.1/', 'http://intranet.local/', 'ftp://clinic.com', 'https://user:pass@clinic.com', 'https://clinic.com:8443', 'javascript:alert(1)', 'not a url at all']) {
      assert.throws(() => normalizeSiteUrl(bad), ImportError, bad);
    }
  });

  it('refuses to fetch private addresses', async () => {
    await assert.rejects(fetchPublicPage('http://127.0.0.1/'), ImportError);
    await assert.rejects(fetchPublicPage('http://[::ffff:10.0.0.1]/'), ImportError);
  });
});

describe('website import: fetching', () => {
  // A local web server stands in for a clinic's site (the address checks are switched off for localhost here).
  let server: http.Server;
  let base = '';
  const fetchLocal = createPageFetcher({ unsafeAllowPrivateNetwork: true });
  before(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/moved') return res.writeHead(301, { Location: '/pricing' }).end();
      if (req.url === '/elsewhere') return res.writeHead(302, { Location: 'https://other.example/' }).end();
      if (req.url === '/pricing') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Encoding': 'gzip' });
        return res.end(zlib.gzipSync('<h1>Fees</h1><p>Whitening — $450</p>'));
      }
      if (req.url === '/latin') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=iso-8859-1' });
        return res.end(Buffer.from('<p>Caf\xe9 hours</p>', 'latin1'));
      }
      if (req.url === '/big') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(`<p>${'x'.repeat(2_000_000)}</p>`);
      }
      if (req.url === '/photo.jpg') return res.writeHead(200, { 'Content-Type': 'image/jpeg' }).end('binary');
      res.writeHead(404, { 'Content-Type': 'text/html' }).end('not found');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server.close());

  it('follows same-site redirects and decompresses pages', async () => {
    const page = await fetchLocal(`${base}/moved`);
    assert.equal(page.url, `${base}/pricing`);
    assert.match(page.body, /Whitening — \$450/);
  });

  it('refuses redirects to another website', async () => {
    await assert.rejects(fetchLocal(`${base}/elsewhere`), /redirects to another website/);
  });

  it('decodes the page charset, caps the size, and skips non-pages', async () => {
    assert.match((await fetchLocal(`${base}/latin`)).body, /Café hours/);
    assert.ok((await fetchLocal(`${base}/big`)).body.length <= 1_600_000);
    assert.equal((await fetchLocal(`${base}/photo.jpg`)).body, '');
    assert.equal((await fetchLocal(`${base}/missing`)).status, 404);
  });
});

describe('website import: reading pages', () => {
  it('keeps the visible text and drops scripts, styles and menus', () => {
    const page = extractPage(CLINIC_SITE['/'].body, 'https://www.smilestudio.example/');
    const text = page.sections.flatMap((s) => [s.heading, ...s.lines]).join('\n');
    assert.match(text, /We’re a family dental practice/);
    assert.doesNotMatch(text, /Not content|color:red|Insurance & Financing/);
    assert.equal(page.title, 'Smile Studio Dental | Family & Cosmetic Dentist');
    assert.deepEqual(page.phones, ['+15552223333']);
    assert.ok(page.links.some((l) => l.href === 'https://www.smilestudio.example/pricing'));
    assert.equal(page.jsonLd.length, 1);
  });

  it('stays fast on hostile markup', () => {
    const hostile = ['<a href="x">'.repeat(20_000), '<h1>'.repeat(20_000), '<'.repeat(200_000), '>', '<!--'.repeat(5_000), '<script>'.repeat(5_000)].join('');
    const started = Date.now();
    const page = extractPage(hostile, 'https://clinic.example/');
    assert.ok(Date.now() - started < 1500, `took ${Date.now() - started} ms`);
    assert.ok(page.links.length <= 2000);
  });

  it('matches robots.txt rules with wildcards, without regexes', () => {
    assert.equal(robotsMatch('/private/', '/private/staff'), true);
    assert.equal(robotsMatch('/*.pdf$', '/files/menu.pdf'), true);
    assert.equal(robotsMatch('/*.pdf$', '/files/menu.pdf.html'), false);
    assert.equal(robotsMatch('/a*b*c*d*e', `/${'a'.repeat(5000)}`), false);
  });

  it('keeps table rows together', () => {
    const page = extractPage(CLINIC_SITE['/pricing'].body, 'https://www.smilestudio.example/pricing');
    assert.ok(page.sections.some((s) => s.lines.includes('Teeth whitening (in-office) | $450')));
  });

  it('reads opening hours from structured data', () => {
    const hours = hoursFromStructuredData({
      openingHoursSpecification: [
        { dayOfWeek: ['https://schema.org/Monday', 'Tuesday'], opens: '08:00:00', closes: '17:00:00' },
        { dayOfWeek: 'Saturday', opens: '9:00', closes: '13:00' },
      ],
    });
    assert.deepEqual(hours?.mon, [['08:00', '17:00']]);
    assert.deepEqual(hours?.sat, [['09:00', '13:00']]);
    assert.deepEqual(hours?.wed, []);
    assert.deepEqual(hoursFromStructuredData({ openingHours: 'Mo,We,Fr 09:00-13:00; Sa 10:00-12:00' })?.fri, [['09:00', '13:00']]);
  });
});

describe('website import: crawling and suggestions', () => {
  it('reads the useful pages of the same site and respects robots.txt', async () => {
    const fetcher = fakeSite();
    const crawl = await crawlSite('smilestudio.example', async (url, opts) => fetcher(url.replace('://smilestudio', '://www.smilestudio'), opts));
    const paths = crawl.pages.map((p) => new URL(p.url).pathname).sort();
    assert.deepEqual(paths, ['/', '/faq', '/insurance-financing', '/new-patients/', '/pricing']);
    assert.equal(crawl.disallowed, 1);
    assert.ok(!fetcher.requested.some((u) => /facebook|private|blog/.test(u)));
  });

  it("turns the clinic's pages into prices, policy drafts, FAQs and contact details", async () => {
    const crawl = await crawlSite('https://www.smilestudio.example', fakeSite());
    const s = analyzeSite(crawl, ARTICLES);
    const price = (slug: string) => s.prices.find((p) => p.articleId === slug);

    assert.deepEqual([price('teeth-whitening')?.priceMin, price('teeth-whitening')?.priceMax], [450, 450]);
    assert.deepEqual([price('porcelain-veneers')?.priceMin, price('porcelain-veneers')?.priceMax, price('porcelain-veneers')?.priceUnit], [1100, 1800, 'per tooth']);
    assert.deepEqual([price('dental-implants')?.priceMin, price('dental-implants')?.priceMax], [3200, null]);
    assert.deepEqual([price('clear-aligners')?.priceMin, price('clear-aligners')?.priceMax], [3500, 6000]);
    assert.match(price('clear-aligners')!.evidence, /\$3,500 to \$6,000/);
    // Membership fees, monthly payments and discounts aren't treatment prices.
    assert.equal(price('checkup-and-cleaning'), undefined);
    assert.ok(!s.prices.some((p) => p.priceMin === 29 || p.priceMin === 99 || p.priceMin === 100 || p.priceMin === 50));

    const policy = (slug: string) => s.policies.find((p) => p.slug === slug);
    assert.match(`${policy('insurance')?.summary} ${policy('insurance')?.body}`, /Delta Dental, Cigna and MetLife/);
    assert.match(`${policy('payment-and-financing')?.summary} ${policy('payment-and-financing')?.body}`, /CareCredit and Cherry/);
    assert.match(`${policy('new-patients')?.summary} ${policy('new-patients')?.body}`, /15 minutes early/);
    assert.match(`${policy('cancellation-policy')?.summary} ${policy('cancellation-policy')?.body}`, /24 hours notice/);
    assert.equal(policy('insurance')?.replaces, false, 'the unfilled template is filled in, nothing is replaced');
    assert.equal(policy('meet-the-team'), undefined);

    assert.deepEqual(s.faqs.map((f) => f.title), ['Do you see children?', 'What if I need to cancel my appointment?', 'Do you offer sedation?']);
    assert.match(s.faqs[0].summary, /patients of all ages/);

    assert.equal(s.contact.phone, '+15552223333');
    assert.equal(s.contact.address, '12 Main Street, Suite 4, Springfield, IL 62701');
    assert.deepEqual(s.contact.hours?.thu, [['08:00', '17:00']]);
    assert.deepEqual(s.contact.hours?.fri, [['08:00', '14:00']]);
    assert.deepEqual(s.contact.hours?.sun, []);
  });

  it('says clearly when the site cannot be read', async () => {
    await assert.rejects(crawlSite('https://www.smilestudio.example', fakeSite({})), /didn't return a web page/);
    await assert.rejects(
      crawlSite('https://www.smilestudio.example', async () => {
        throw new Error('ECONNREFUSED');
      }),
      /couldn't open www\.smilestudio\.example/
    );
  });
});
