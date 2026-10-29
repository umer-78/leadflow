/**
 * A small fake dental-clinic website for the "Import from your website" tests:
 * a price table, insurance and financing, FAQs in accordions, new-patient
 * information, schema.org contact details, a robots.txt rule, and links that
 * must not be followed (another site, a blog post, a disallowed page).
 */
import type { FetchedPage, PageFetcher } from '../../server/knowledge/importer.ts';

const page = (title: string, body: string, head = '') =>
  `<!doctype html><html><head><title>${title}</title>${head}</head><body>
  <nav><a href="/">Home</a> <a href="/pricing">Pricing</a> <a href="/insurance-financing">Insurance &amp; Financing</a>
  <a href="/faq">FAQ</a> <a href="/new-patients/">New Patients</a> <a href="https://facebook.com/smilestudio">Facebook</a>
  <a href="/private/staff">Staff</a> <a href="/blog/post-1">Blog</a> <a href="tel:+15552223333">Call us</a></nav>
  ${body}
  <footer><address>12 Main Street, Suite 4<br>Springfield, IL 62701</address><p>&copy; 2026 Smile Studio Dental</p></footer>
  </body></html>`;

const STRUCTURED = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Dentist","name":"Smile Studio Dental",
  "telephone":"+1 (555) 222-3333","address":{"@type":"PostalAddress","streetAddress":"12 Main Street, Suite 4","addressLocality":"Springfield",
  "addressRegion":"IL","postalCode":"62701"},"openingHours":["Mo-Th 08:00-17:00","Fr 08:00-14:00"]}</script>
  <style>.hero{color:red}</style><script>var tpl = '<h2>Not content</h2>';</script>`;

export const CLINIC_SITE: Record<string, { status?: number; type?: string; body: string }> = {
  '/robots.txt': { type: 'text/plain', body: 'User-agent: *\nDisallow: /private/\n' },
  '/': {
    body: page(
      'Smile Studio Dental | Family &amp; Cosmetic Dentist',
      `<h1>Welcome to Smile Studio Dental</h1>
       <p>We&rsquo;re a family dental practice in Springfield offering check-ups, whitening, implants and Invisalign.</p>`,
      STRUCTURED
    ),
  },
  '/pricing': {
    body: page(
      'Our fees',
      `<h1>Our fees</h1>
       <table><tr><th>Treatment</th><th>Price</th></tr>
       <tr><td>Teeth whitening (in-office)</td><td>$450</td></tr>
       <tr><td>Porcelain veneers</td><td>$1,100 - $1,800 per tooth</td></tr>
       <tr><td>Dental implants</td><td>from $3,200</td></tr>
       <tr><td>Membership plan</td><td>$29/month</td></tr></table>
       <h2>Invisalign</h2>
       <p>Clear aligner treatment costs $3,500 to $6,000 depending on your case. Monthly payments from $99/month.</p>
       <p>New patient special: save $100 on your first cleaning.</p>`
    ),
  },
  '/insurance-financing': {
    body: page(
      'Insurance &amp; Financing',
      `<h1>Insurance &amp; Financing</h1>
       <h2>Insurance</h2>
       <p>We are in network with Delta Dental, Cigna and MetLife PPO plans. We file claims for you and check your benefits before treatment. We do not accept Medicaid.</p>
       <h2>Payment options</h2>
       <p>We accept cash, all major credit cards, HSA and FSA cards. Financing is available through CareCredit and Cherry, with interest-free plans for qualified patients.</p>`
    ),
  },
  '/faq': {
    body: page(
      'FAQ',
      `<h1>Frequently asked questions</h1>
       <details><summary>Do you see children?</summary><p>Yes! We see patients of all ages, from a child&#39;s first tooth onward, and we keep visits short and fun.</p></details>
       <details><summary>What if I need to cancel my appointment?</summary><p>Please give us at least 24 hours notice so we can offer the time to another patient. Missed appointments may incur a $50 fee.</p></details>
       <h3>Do you offer sedation?</h3><p>We offer nitrous oxide for nervous patients and oral sedation for longer visits.</p>`
    ),
  },
  '/new-patients': {
    body: page(
      'New patients',
      `<h1>New patients</h1>
       <p>We are accepting new patients. Please arrive 15 minutes early for your first visit and bring a photo ID and your insurance card. You can fill in our patient forms online before you come.</p>`
    ),
  },
  '/private/staff': { body: page('Staff', '<p>Internal staff rota.</p>') },
  '/blog/post-1': { body: page('Blog', '<p>Five tips for brighter teeth.</p>') },
};

/** A PageFetcher serving CLINIC_SITE from https://www.smilestudio.example, recording every request. */
export function fakeSite(site = CLINIC_SITE, origin = 'https://www.smilestudio.example'): PageFetcher & { requested: string[] } {
  const requested: string[] = [];
  const fetcher = async (url: string): Promise<FetchedPage> => {
    requested.push(url);
    const u = new URL(url);
    if (u.origin !== origin) throw new Error(`unexpected request to ${u.origin}`);
    const entry = site[u.pathname.replace(/(.)\/$/, '$1')];
    if (!entry) return { url, status: 404, contentType: 'text/html', body: '' };
    return { url, status: entry.status ?? 200, contentType: entry.type ?? 'text/html; charset=utf-8', body: entry.body };
  };
  return Object.assign(fetcher, { requested });
}
