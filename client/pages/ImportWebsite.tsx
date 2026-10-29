import { ExternalLink, Globe } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, useApi } from '../api.ts';
import { phone as formatPhone, priceRange } from '../format.ts';
import type { DayKey, Settings, WeeklyHours } from '../types.ts';
import { Badge, Button, Field, Input, Modal, useAction, useToast } from '../ui.tsx';

interface Suggestions {
  site: string;
  pages: { url: string; title: string }[];
  disallowed: number;
  prices: {
    articleId: string;
    title: string;
    priceMin: number | null;
    priceMax: number | null;
    priceUnit: string | null;
    current: { priceMin: number | null; priceMax: number | null; priceUnit: string | null };
    evidence: string;
    url: string;
  }[];
  policies: { articleId: string; slug: string; title: string; summary: string; body: string; url: string; replaces: boolean }[];
  faqs: { title: string; summary: string; body: string; url: string }[];
  contact: { phone?: string; address?: string; hours?: WeeklyHours; url?: string };
}

const WEEK: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

/** "Mon–Thu 08:00–17:00 · Fri 08:00–14:00 · Sat–Sun closed" */
function hoursText(h: WeeklyHours): string {
  const day = (k: DayKey) => (h[k].length ? h[k].map(([a, b]) => `${a}–${b}`).join(', ') : 'closed');
  const groups: { from: string; to: string; text: string }[] = [];
  for (const d of WEEK) {
    const text = day(d.key);
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.to = d.label;
    else groups.push({ from: d.label, to: d.label, text });
  }
  return groups.map((g) => `${g.from === g.to ? g.from : `${g.from}–${g.to}`} ${g.text}`).join(' · ');
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function Source({ url }: { url: string }) {
  let label = url;
  try {
    label = new URL(url).pathname === '/' ? 'home page' : new URL(url).pathname;
  } catch {
    /* keep the raw URL */
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal-700 hover:underline">
      {label} <ExternalLink size={11} />
    </a>
  );
}

function Pick({ id, picked, toggle, children }: { id: string; picked: Set<string>; toggle: (id: string) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50">
      <input type="checkbox" className="mt-0.5 h-4 w-4 flex-none accent-teal-700" checked={picked.has(id)} onChange={() => toggle(id)} />
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </label>
  );
}

function Group({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mb-1 text-xs text-slate-500">{hint}</p>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}

/** Read the clinic's own website and let the team choose what to add: prices, policy drafts, FAQs, contact details. */
export function ImportWebsite({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const settings = useApi<Settings>('/settings');
  const [url, setUrl] = useState('');
  const [found, setFound] = useState<Suggestions>();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const { busy, run } = useAction();
  const toast = useToast();

  useEffect(() => {
    if (settings.data?.website) setUrl((u) => u || settings.data!.website!);
  }, [settings.data]);

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function scan(e?: FormEvent) {
    e?.preventDefault();
    const r = await run(() => api<Suggestions>('/knowledge/import', { body: { url } }));
    if (!r) return;
    // Pre-select what fills a gap; leave anything that would replace the clinic's own details unticked.
    const s = new Set<string>();
    for (const p of r.prices) if (p.current.priceMin == null && p.current.priceMax == null) s.add(`price:${p.articleId}`);
    for (const p of r.policies) if (!p.replaces) s.add(`policy:${p.articleId}`);
    r.faqs.forEach((_, i) => s.add(`faq:${i}`));
    if (r.contact.phone && !settings.data?.phone) s.add('contact:phone');
    if (r.contact.address && !settings.data?.address) s.add('contact:address');
    setPicked(s);
    setFound(r);
  }

  async function apply() {
    if (!found) return;
    setApplying(true);
    let done = 0;
    let failed = 0;
    const step = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        done++;
      } catch {
        failed++;
      }
    };
    for (const p of found.prices) {
      if (picked.has(`price:${p.articleId}`)) await step(() => api(`/knowledge/${p.articleId}`, { method: 'PATCH', body: { priceMin: p.priceMin, priceMax: p.priceMax, priceUnit: p.priceUnit } }));
    }
    for (const p of found.policies) {
      if (picked.has(`policy:${p.articleId}`)) await step(() => api(`/knowledge/${p.articleId}`, { method: 'PATCH', body: { summary: p.summary, body: p.body, published: false } }));
    }
    for (const [i, f] of found.faqs.entries()) {
      if (picked.has(`faq:${i}`)) await step(() => api('/knowledge', { body: { title: f.title, category: 'FAQ', summary: f.summary, body: f.body, tags: [], published: false } }));
    }
    const contact: Record<string, unknown> = {};
    if (picked.has('contact:phone')) contact.phone = found.contact.phone;
    if (picked.has('contact:address')) contact.address = found.contact.address;
    if (picked.has('contact:hours')) contact.hours = found.contact.hours;
    if (Object.keys(contact).length) await step(() => api('/settings', { method: 'PATCH', body: contact }));
    setApplying(false);
    if (failed) toast(`Added ${done}; ${failed} could not be saved. Please try those again.`, 'error');
    else toast(`Added ${done}. Policy text and new questions are hidden drafts: check and publish them below.`);
    onDone();
  }

  const nothing = found && !found.prices.length && !found.policies.length && !found.faqs.length && !found.contact.phone && !found.contact.address && !found.contact.hours;
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Import from your website"
      footer={
        found ? (
          <>
            <Button className="mr-auto" variant="ghost" onClick={() => setFound(undefined)}>
              Read another address
            </Button>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={applying} disabled={!picked.size} onClick={() => void apply()}>
              Add {picked.size} selected
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!url.trim()} onClick={() => void scan()}>
              <Globe size={15} /> Read website
            </Button>
          </>
        )
      }
    >
      {!found ? (
        <form onSubmit={scan} className="space-y-4">
          <p className="text-sm text-slate-600">
            We read up to 15 pages of your clinic's website, looking for prices, insurance and payment options, new-patient information,
            cancellation policy, FAQs and contact details, and show you what we find. Nothing changes until you choose what to add, and new
            text arrives as hidden drafts for you to check before the assistant uses it.
          </p>
          <Field label="Your website" hint="Only your own public website. We follow its robots.txt and stay on the same site.">
            {(id) => <Input id={id} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="www.yourclinic.com" inputMode="url" autoComplete="url" />}
          </Field>
          {busy && <p className="text-sm text-slate-500">Reading your website… this can take up to half a minute.</p>}
        </form>
      ) : nothing ? (
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            We read {found.pages.length} page{found.pages.length === 1 ? '' : 's'} of {new URL(found.site).hostname} but didn't find prices, policies or
            questions we could use.
          </p>
          <p>If the site loads its text with JavaScript, copy the details into articles instead.</p>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-sm text-slate-600">
            Read {found.pages.length} page{found.pages.length === 1 ? '' : 's'} of <span className="font-medium">{new URL(found.site).hostname}</span>.
            Tick what to add.
          </p>
          {found.prices.length > 0 && (
            <Group title="Prices" hint="The assistant quotes these when patients ask what a treatment costs.">
              {found.prices.map((p) => (
                <Pick key={p.articleId} id={`price:${p.articleId}`} picked={picked} toggle={toggle}>
                  <p>
                    <span className="font-medium text-slate-900">{p.title}</span>: {priceRange(p.priceMin, p.priceMax, p.priceUnit)}
                    <span className="text-slate-500">
                      {' '}
                      (now {priceRange(p.current.priceMin, p.current.priceMax, p.current.priceUnit) || 'no price set'})
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    “{clip(p.evidence, 160)}” · <Source url={p.url} />
                  </p>
                </Pick>
              ))}
            </Group>
          )}
          {found.policies.length > 0 && (
            <Group title="Clinic policies" hint="Added as hidden drafts: open each one to check the wording, then publish it.">
              {found.policies.map((p) => (
                <Pick key={p.articleId} id={`policy:${p.articleId}`} picked={picked} toggle={toggle}>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{p.title}</span>
                    {p.replaces && <Badge tone="amber">Replaces your current wording</Badge>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">{clip(`${p.summary} ${p.body.replace(/\n/g, ' ')}`, 240)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    <Source url={p.url} />
                  </p>
                </Pick>
              ))}
            </Group>
          )}
          {found.faqs.length > 0 && (
            <Group title="Questions and answers" hint="Added as hidden draft FAQs for you to check and publish.">
              {found.faqs.map((f, i) => (
                <Pick key={f.title} id={`faq:${i}`} picked={picked} toggle={toggle}>
                  <p className="font-medium text-slate-900">{f.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{clip(`${f.summary} ${f.body.replace(/\n/g, ' ')}`, 200)}</p>
                </Pick>
              ))}
            </Group>
          )}
          {(found.contact.phone || found.contact.address || found.contact.hours) && (
            <Group title="Contact details" hint="Updates your clinic settings. Opening hours decide which appointment times are offered.">
              {found.contact.phone && (
                <Pick id="contact:phone" picked={picked} toggle={toggle}>
                  Phone: <span className="font-medium text-slate-900">{formatPhone(found.contact.phone)}</span>
                  {settings.data?.phone && <span className="text-slate-500"> (now {formatPhone(settings.data.phone)})</span>}
                </Pick>
              )}
              {found.contact.address && (
                <Pick id="contact:address" picked={picked} toggle={toggle}>
                  Address: <span className="font-medium text-slate-900">{found.contact.address}</span>
                  {settings.data?.address && <span className="text-slate-500"> (now {settings.data.address})</span>}
                </Pick>
              )}
              {found.contact.hours && (
                <Pick id="contact:hours" picked={picked} toggle={toggle}>
                  Opening hours: <span className="font-medium text-slate-900">{hoursText(found.contact.hours)}</span>
                  {settings.data?.hours && <span className="block text-xs text-slate-500">Now: {hoursText(settings.data.hours)}</span>}
                </Pick>
              )}
            </Group>
          )}
          {found.disallowed > 0 && (
            <p className="mt-4 text-xs text-slate-500">
              {found.disallowed} page{found.disallowed === 1 ? ' was' : 's were'} skipped because the website's robots.txt asks not to read them.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
