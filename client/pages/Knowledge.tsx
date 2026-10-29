import { BookOpen, Globe, Pencil, Plus, RotateCcw, Search, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { PageProps } from '../App.tsx';
import { api, useApi } from '../api.ts';
import { priceRange, timeAgo } from '../format.ts';
import { navigate } from '../router.ts';
import type { Article, Category, MessageMeta } from '../types.ts';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select, Textarea, Toggle, cx, useAction, type Tone } from '../ui.tsx';
import { ImportWebsite } from './ImportWebsite.tsx';

const CATEGORIES: { key: Category; label: string; tone: Tone }[] = [
  { key: 'PROCEDURE', label: 'Treatments', tone: 'teal' },
  { key: 'CONDITION', label: 'Conditions', tone: 'blue' },
  { key: 'EMERGENCY', label: 'Emergencies', tone: 'red' },
  { key: 'AFTERCARE', label: 'Aftercare', tone: 'violet' },
  { key: 'FAQ', label: 'FAQs', tone: 'gray' },
  { key: 'POLICY', label: 'Clinic policies', tone: 'amber' },
];
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<Category, (typeof CATEGORIES)[number]>;
const isDraft = (a: Article) => /\[[^\]]{3,}\]/.test(a.summary);

export function KnowledgePage({ can, draftQuestion }: PageProps & { draftQuestion?: string }) {
  const list = useApi<{ items: Article[] }>('/knowledge');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | ''>('');
  const [editing, setEditing] = useState<Partial<Article> | null>(null);
  const [importing, setImporting] = useState(false);
  const { run } = useAction();
  const admin = can('ADMIN');

  useEffect(() => {
    if (draftQuestion && admin) {
      setEditing({ title: draftQuestion, category: 'FAQ', summary: '', body: '', tags: [], published: true });
      navigate('/knowledge');
    }
  }, [draftQuestion, admin]);

  const items = list.data?.items ?? [];
  const drafts = items.filter((a) => a.category === 'POLICY' && (isDraft(a) || !a.published));
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(
      (a) =>
        (!cat || a.category === cat) &&
        (!needle || [a.title, a.summary, a.service ?? '', ...a.tags].some((s) => s.toLowerCase().includes(needle)))
    );
  }, [items, q, cat]);

  async function togglePublished(a: Article, published: boolean) {
    if (published && isDraft(a)) {
      setEditing(a);
      return;
    }
    const updated = await run(() => api<Article>(`/knowledge/${a.id}`, { method: 'PATCH', body: { published } }), published ? 'Published' : 'Hidden from the assistant');
    if (updated) list.setData((d) => (d ? { items: d.items.map((x) => (x.id === a.id ? updated : x)) } : d));
  }

  return (
    <>
      <PageHeader
        title="Knowledge & AI"
        subtitle="Everything the assistant knows. It answers only from published articles and quotes only the prices you set here."
        actions={
          admin && (
            <>
              <Button onClick={() => setImporting(true)}>
                <Globe size={16} /> Import from website
              </Button>
              <Button variant="primary" onClick={() => setEditing({ category: 'FAQ', title: '', summary: '', body: '', tags: [], published: true })}>
                <Plus size={16} /> New article
              </Button>
            </>
          )
        }
      />
      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}

      {drafts.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Fill in your clinic policies so the assistant can answer these questions:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {drafts.map((a) => (
              <button key={a.id} type="button" disabled={!admin} onClick={() => setEditing(a)} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium hover:bg-amber-100 disabled:opacity-60">
                {a.title}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs">Until then, the assistant says it doesn't have those details and offers a callback instead of guessing.</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input aria-label="Search articles" placeholder="Search articles" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value as Category | '')} className="w-44">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          {list.loading && !list.data ? (
            <Loading />
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState icon={<BookOpen size={28} />} title="No articles found" />
            </Card>
          ) : (
            <Card padded={false}>
              <ul className="divide-y divide-slate-100">
                {filtered.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{a.title}</p>
                        <Badge tone={CAT[a.category].tone}>{CAT[a.category].label}</Badge>
                        {!a.published && <Badge tone="gray">Hidden</Badge>}
                        {a.source === 'edited' && <Badge tone="gray">Your wording</Badge>}
                        {a.source === 'custom' && <Badge tone="gray">Your article</Badge>}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.summary}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {a.service ? `Bookable as “${a.service}”` : 'Information only'}
                        {a.service && (priceRange(a.priceMin, a.priceMax, a.priceUnit) ? ` · ${priceRange(a.priceMin, a.priceMax, a.priceUnit)}` : ' · no price set')}
                        {` · updated ${timeAgo(a.updatedAt)}`}
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      <Toggle checked={a.published} disabled={!admin} onChange={(v) => void togglePublished(a, v)} label={`Publish ${a.title}`} />
                      {admin && (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(a)} aria-label={`Edit ${a.title}`}>
                          <Pencil size={14} />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <TestAssistant />
      </div>

      {importing && (
        <ImportWebsite
          onClose={() => setImporting(false)}
          onDone={() => {
            setImporting(false);
            list.reload();
          }}
        />
      )}

      {editing && (
        <ArticleEditor
          article={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, deleted) => {
            setEditing(null);
            list.setData((d) => {
              if (!d) return d;
              if (deleted) return { items: d.items.filter((x) => x.id !== saved.id) };
              const exists = d.items.some((x) => x.id === saved.id);
              return { items: exists ? d.items.map((x) => (x.id === saved.id ? saved : x)) : [...d.items, saved] };
            });
          }}
        />
      )}
    </>
  );
}

function ArticleEditor({ article, onClose, onSaved }: { article: Partial<Article>; onClose: () => void; onSaved: (a: Article, deleted?: boolean) => void }) {
  const [form, setForm] = useState({
    title: article.title ?? '',
    category: (article.category ?? 'FAQ') as Category,
    summary: article.summary ?? '',
    body: article.body ?? '',
    tags: (article.tags ?? []).join(', '),
    service: article.service ?? '',
    priceMin: article.priceMin?.toString() ?? '',
    priceMax: article.priceMax?.toString() ?? '',
    priceUnit: article.priceUnit ?? '',
    caseValue: article.caseValue?.toString() ?? '',
    published: article.published ?? true,
  });
  const { busy, run } = useAction();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(/[$,\s]/g, '')));
  const placeholders = /\[[^\]]{3,}\]/.test(form.summary) || /\[[^\]]{3,}\]/.test(form.body);

  async function save() {
    const body = {
      title: form.title,
      category: form.category,
      summary: form.summary,
      body: form.body,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      service: form.service || null,
      priceMin: num(form.priceMin),
      priceMax: num(form.priceMax),
      priceUnit: form.priceUnit || null,
      caseValue: num(form.caseValue),
      published: form.published && !placeholders,
    };
    const saved = await run(
      () => (article.id ? api<Article>(`/knowledge/${article.id}`, { method: 'PATCH', body }) : api<Article>('/knowledge', { body })),
      article.id ? 'Article saved' : 'Article added'
    );
    if (saved) onSaved(saved);
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={article.id ? `Edit “${article.title}”` : 'New article'}
      footer={
        <>
          {article.id && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={async () => {
                if (!confirm('Delete this article? The assistant will stop using it immediately.')) return;
                if (await run(() => api(`/knowledge/${article.id}`, { method: 'DELETE' }), 'Article deleted')) onSaved(article as Article, true);
              }}
            >
              <Trash2 size={14} /> Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!form.title.trim() || !form.summary.trim()} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">{(id) => <Input id={id} value={form.title} onChange={set('title')} placeholder="e.g. Do you offer Saturday appointments?" />}</Field>
        <Field label="Category">
          {(id) => (
            <Select id={id} value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Bookable service name" hint="Leave empty for information-only articles.">
          {(id) => <Input id={id} value={form.service} onChange={set('service')} placeholder="e.g. Teeth whitening" />}
        </Field>
        <Field label="Short answer" hint="One or two sentences. Used for “tell me about…” questions." className="sm:col-span-2">
          {(id) => <Textarea id={id} value={form.summary} onChange={set('summary')} rows={3} />}
        </Field>
        <Field label="Details" hint="One fact per sentence works best: the assistant quotes the sentences that answer the question." className="sm:col-span-2">
          {(id) => <Textarea id={id} value={form.body} onChange={set('body')} rows={7} />}
        </Field>
        <Field label="Other words patients use" hint="Comma separated, e.g. invisalign, straight teeth" className="sm:col-span-2">
          {(id) => <Input id={id} value={form.tags} onChange={set('tags')} />}
        </Field>
        {form.service && (
          <>
            <Field label="Price from ($)" hint="The assistant only quotes prices entered here.">{(id) => <Input id={id} inputMode="numeric" value={form.priceMin} onChange={set('priceMin')} />}</Field>
            <Field label="Price to ($)">{(id) => <Input id={id} inputMode="numeric" value={form.priceMax} onChange={set('priceMax')} />}</Field>
            <Field label="Price is quoted" hint="e.g. per tooth, per treatment">{(id) => <Input id={id} value={form.priceUnit} onChange={set('priceUnit')} />}</Field>
            <Field label="Typical case value ($)" hint="Internal only: used to score leads.">{(id) => <Input id={id} inputMode="numeric" value={form.caseValue} onChange={set('caseValue')} />}</Field>
          </>
        )}
        {article.id && article.source !== 'custom' && (
          <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600 sm:col-span-2">
            <p>
              {article.source === 'edited'
                ? 'You reworded this library article, so library updates no longer replace it.'
                : 'From the LeadFlow library: corrections and new facts arrive automatically. Rewording it keeps your version instead.'}
              {article.source === 'edited' && (
                <button
                  type="button"
                  className="ml-1 font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800"
                  onClick={async () => {
                    if (!confirm('Replace your wording with the current library version?')) return;
                    const restored = await run(() => api<Article>(`/knowledge/${article.id}/restore`, { method: 'POST' }), 'Library version restored');
                    if (restored) onSaved(restored);
                  }}
                >
                  Restore the library version
                </button>
              )}
            </p>
            {!!article.references?.length && (
              <p className="mt-1.5">
                Checked against:{' '}
                {article.references.map((r, i) => (
                  <span key={r.url}>
                    {i > 0 && ' · '}
                    <a className="text-teal-700 underline underline-offset-2 hover:text-teal-800" href={r.url} target="_blank" rel="noreferrer">
                      {r.name}
                    </a>
                  </span>
                ))}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 sm:col-span-2">
          <Toggle checked={form.published && !placeholders} disabled={placeholders} onChange={(v) => setForm((f) => ({ ...f, published: v }))} label="Published" />
          <span className="text-sm text-slate-700">
            {placeholders ? 'Replace the [bracketed] placeholder text to publish this article.' : form.published ? 'Published: the assistant uses this article' : 'Hidden from the assistant'}
          </span>
        </div>
      </div>
    </Modal>
  );
}

interface TestTurn {
  role: 'you' | 'assistant';
  text: string;
  meta?: MessageMeta;
}

function TestAssistant() {
  const [turns, setTurns] = useState<TestTurn[]>([]);
  const [state, setState] = useState<unknown>();
  const [text, setText] = useState('');
  const { busy, run } = useAction();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [turns]);

  async function ask(e: FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message) return;
    setText('');
    setTurns((t) => [...t, { role: 'you', text: message }]);
    const res = await run(() => api<{ reply: { text: string }; meta: MessageMeta; state: unknown }>('/knowledge/test', { body: { message, state } }));
    if (res) {
      setState(res.state);
      setTurns((t) => [...t, { role: 'assistant', text: res.reply.text, meta: res.meta }]);
    }
  }

  return (
    <Card
      title="Test the assistant"
      className="h-fit lg:sticky lg:top-6"
      actions={
        turns.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => { setTurns([]); setState(undefined); }}>
            <RotateCcw size={14} /> Reset
          </Button>
        )
      }
    >
      <p className="mb-3 text-xs text-slate-500">Ask anything a patient might. Nothing is saved and no bookings are made.</p>
      <div className="scroll-thin mb-3 max-h-[420px] space-y-2 overflow-y-auto">
        {turns.length === 0 && <p className="text-sm text-slate-400">Try “how much are implants?” or “I chipped my tooth”.</p>}
        {turns.map((t, i) => (
          <div key={i} className={cx('flex flex-col', t.role === 'you' ? 'items-end' : 'items-start')}>
            <div className={cx('max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm', t.role === 'you' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-800')}>{t.text}</div>
            {t.meta && (
              <p className="mt-1 text-[11px] text-slate-500">
                {t.meta.intent ? `${t.meta.intent.replace(/_/g, ' ')} (${Math.round((t.meta.confidence ?? 0) * 100)}%) · ` : ''}
                {t.meta.skill?.replace(/_/g, ' ')}
                {t.meta.sources?.length ? ` · from: ${t.meta.sources.map((s) => s.title).join(', ')}` : ''}
              </p>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={ask} className="flex gap-2">
        <Input aria-label="Test message" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a patient question…" />
        <Button type="submit" variant="primary" loading={busy} aria-label="Send">
          <Send size={14} />
        </Button>
      </form>
    </Card>
  );
}
