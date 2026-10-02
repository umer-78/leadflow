/* LeadFlow AI — live in-browser receptionist for the demo.
 *
 * This is the app's own deterministic, offline-safe provider (src/lib/ai/mock-provider.ts),
 * its clinical knowledge base (src/lib/ai/clinical-knowledge.ts) and its real lead scorer
 * (src/lib/crm/scoring.ts), ported to vanilla JS so the demo runs the actual logic in your
 * browser — no server, no API key, no cost. The production app can additionally route to
 * Google Gemini; the bounds, the knowledge base and the scoring are identical to this.
 */
(() => {
  'use strict';

  // --- Clinical knowledge base (bounded answers; the receptionist never invents a price) ---
  const KB = {
    veneers:   { name: 'Handcrafted Porcelain Veneers', service: 'porcelain veneers', price: '$1,400 – $2,200 per tooth', finance: 'from $99/mo at 0% APR (Cherry / CareCredit)', detail: 'ultra-thin custom porcelain shells with 15–20 year durability' },
    invisalign:{ name: 'Clear Aligners (Invisalign & ClearCorrect)', service: 'invisalign clear aligners', price: '$3,800 – $5,800 comprehensive', finance: 'from $129/mo, $0 down', detail: 'custom 3D-scanned transparent aligners, no metal brackets' },
    implants:  { name: 'Dental Implants & Custom Abutments', service: 'dental implants', price: '$2,400 – $4,500 complete (fixture + zirconia crown)', finance: '$149/mo flexible terms', detail: 'titanium or zirconia root replacement with natural chewing strength' },
    whitening: { name: 'In-Office Zoom Laser Whitening', service: 'teeth whitening', price: '$450 – $650 per session', finance: 'HSA/FSA eligible', detail: 'up to 8 shades lighter in one 60-minute visit' },
    bonding:   { name: 'Composite Dental Bonding', service: 'dental bonding', price: '$350 – $600 per tooth', finance: 'in-house monthly plans', detail: 'same-visit repair of chips, gaps and discolouration' },
    crowns:    { name: 'Same-Day Zirconia Crowns', service: 'dental crowns', price: '$1,100 – $1,650 per crown', finance: 'in-house monthly plans', detail: 'all-ceramic crowns milled and placed in a single visit' },
    sedation:  { name: 'Comfort & Sedation Dentistry', service: 'sedation dentistry', price: '$120 (nitrous) to $450 (oral conscious sedation)', finance: 'bundled with treatment plans', detail: 'nitrous oxide and oral conscious sedation for anxiety-free visits' },
    emergency: { name: 'Emergency Dental Care & Pain Triage', service: 'emergency dental care', price: '$150 emergency exam & digital X-rays', finance: 'often covered by insurance', detail: 'same-day urgent slots, usually within 2 hours' },
  };
  const POLICIES = {
    hours: 'Monday–Friday 8:00am–6:00pm, Saturday 9:00am–2:00pm',
    location: '248 Harborview Avenue, Suite 5 — patient parking on site',
  };
  const CLINIC = 'Harborview Dental';

  // High-value elective procedures (src/lib/crm/scoring.ts)
  const HIGH_VALUE = ['clear aligners', 'invisalign', 'porcelain veneers', 'veneers', 'dental implants', 'implants', 'smile makeover'];

  // alias → KB key
  const ALIASES = [
    [/\b(veneer|veneers)\b/, 'veneers'],
    [/\b(invisalign|clear ?aligner|aligners|braces|straighten)\b/, 'invisalign'],
    [/\b(implant|implants)\b/, 'implants'],
    [/\b(whiten|whitening|bleach|brighter)\b/, 'whitening'],
    [/\b(bonding|bonded|chipped|chip)\b/, 'bonding'],
    [/\b(crown|crowns|cap)\b/, 'crowns'],
    [/\b(sedation|sedate|anxiety|anxious|nervous|afraid|scared)\b/, 'sedation'],
    [/\b(emergency|severe pain|swelling|swollen|throbbing|knocked out)\b/, 'emergency'],
  ];

  const detectProcedure = (t) => { const s = t.toLowerCase(); for (const [re, k] of ALIASES) if (re.test(s)) return k; return null; };
  const PHONE_RE = /(\+?\d[\d\s().-]{6,}\d)/;
  const hasPhone = (t) => PHONE_RE.test(t);
  const detectUrgency = (t) => {
    const s = t.toLowerCase();
    if (/\b(urgent|asap|as soon as possible|today|tonight|this week|right away|emergency|before (my|the|a) [a-z ]*(wedding|event|trip|holiday|reunion))\b/.test(s)) return 'HIGH';
    if (/\b(soon|next week|this month|in a few weeks|flexible)\b/.test(s)) return 'MEDIUM';
    return 'LOW';
  };
  const DAY_RE = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|this weekend|weekend)\b/i;
  const TIME_RE = /\b(morning|afternoon|evening|noon|\d{1,2}(:\d{2})?\s*(am|pm))\b/i;

  // --- Real lead scorer, ported verbatim from src/lib/crm/scoring.ts ---
  function calculateLeadScore(lead) {
    let score = 0; const reasons = [];
    if (lead.phone && lead.phone.trim().length >= 7) { score += 35; reasons.push(['+', 'Provided a direct phone number', 35]); }
    else reasons.push(['–', 'No direct phone number yet', 0]);
    const svc = (lead.serviceRequested || '').toLowerCase();
    const isHigh = HIGH_VALUE.some((h) => svc.includes(h));
    if (isHigh) { score += 30; reasons.push(['+', 'Asked about a high-value elective procedure', 30]); }
    else if (svc.length) { score += 15; reasons.push(['+', 'Asked about general / preventive care', 15]); }
    if (lead.urgency === 'HIGH') { score += 20; reasons.push(['+', 'Needs it within about a week', 20]); }
    else if (lead.urgency === 'MEDIUM') { score += 10; reasons.push(['+', 'Has a near-term timeframe', 10]); }
    if (lead.preferredDate || lead.preferredTime) { score += 15; reasons.push(['+', 'Named a preferred day or time', 15]); }
    let tier = 'LOW'; if (score >= 70) tier = 'HIGH'; else if (score >= 40) tier = 'MEDIUM';
    return { score, tier, reasons };
  }

  // --- Receptionist reply, ported from src/lib/ai/mock-provider.ts (bounds first) ---
  function reply(text, lead) {
    const s = text.toLowerCase();
    if (/\b(diagnos|is it cancer|infected|infection|what disease|swollen lymph|do i have)\b/.test(s))
      return `For your safety I can't diagnose or give a clinical opinion — a licensed dentist at ${CLINIC} needs to see you in person. I can book that for you now: what's your name, phone number, and a day that suits you?`;
    if (/\b(sue|lawsuit|legal|liability|compensation)\b/.test(s))
      return `I'm not able to give legal advice. For anything clinical or to book with ${CLINIC}, I'm glad to connect you with our team.`;
    const proc = detectProcedure(text);
    if (/\b(price|cost|how much|fee|expensive|afford|payment|finance|financing|instal|plan)\b/.test(s)) {
      if (proc) { const k = KB[proc]; return `${k.name}: ${k.price}, ${k.finance}. The exact figure depends on an exam, so I won't quote beyond that range. Would you like to share your phone number so our coordinator can confirm insurance and financing?`; }
      return `Fees depend on your exam, so I won't quote a number I can't stand behind — but we offer transparent ranges and 0% plans. Share your name and number and I'll have our coordinator send the current fee guide. Which treatment are you considering?`;
    }
    if (/\b(book|appointment|schedule|consultation|slot|see someone|come in|visit)\b/.test(s))
      return `Happy to arrange a consultation at ${CLINIC}. I just need your name, a phone number, the treatment you're interested in, and a preferred day (morning or afternoon). What works for you?`;
    if (/\b(hour|open|close|saturday|sunday|weekend)\b/.test(s)) return `Our hours are ${POLICIES.hours}. Would you like me to hold a consultation slot?`;
    if (/\b(where|location|address|parking|directions|find you)\b/.test(s)) return `We're at ${POLICIES.location}. Shall I book you a visit?`;
    if (/\b(human|real person|manager|complaint|speak to (a|someone))\b/.test(s))
      return `Of course — I've flagged this for priority staff review. Leave your name and number and our clinic manager will call you back during business hours. For a medical emergency please call your local emergency number.`;
    if (hasPhone(text) || /[\w.-]+@[\w.-]+\.\w+/.test(text))
      return `Thank you — I've got your contact details and our team at ${CLINIC} has been notified. They'll reach out shortly to confirm. Anything you'd like us to note about your smile beforehand?`;
    if (proc) { const k = KB[proc]; return `Great choice — ${k.name.toLowerCase()} are ${k.detail}. Typical investment is ${k.price} (${k.finance}). Would you like to book a consultation, or shall I answer anything else first?`; }
    return `Welcome to ${CLINIC}! I can help with treatments like clear aligners, veneers, implants and whitening, or check consultation times. What can I help you with today?`;
  }

  const CADENCE = [
    ['Day 0', 'Instant reply and an offer to book'],
    ['Day 1', 'A gentle reminder with the next open slot'],
    ['Day 3', 'A short answer to the common hesitation'],
    ['Day 7', 'A final, no-pressure check-in'],
  ];

  // --- Conversation state: lead fields accumulate as the patient reveals them ---
  const lead = { phone: '', serviceRequested: '', urgency: 'LOW', preferredDate: '', preferredTime: '' };
  function updateLead(text) {
    const m = text.match(PHONE_RE); if (m) lead.phone = m[1];
    const proc = detectProcedure(text); if (proc) lead.serviceRequested = KB[proc].service;
    const u = detectUrgency(text); if (u === 'HIGH' || (u === 'MEDIUM' && lead.urgency === 'LOW')) lead.urgency = u;
    const d = text.match(DAY_RE); if (d) lead.preferredDate = d[0];
    const t = text.match(TIME_RE); if (t) lead.preferredTime = t[0];
  }

  // --- DOM wiring ---
  function esc(x) { return String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(() => {
    const body = document.getElementById('lf-chat');
    const form = document.getElementById('lf-form');
    const input = document.getElementById('lf-input');
    const scoreEl = document.getElementById('lf-score');
    const cadEl = document.getElementById('lf-cadence');
    if (!body || !form || !input) return; // demo widget not on this page

    const add = (who, txt) => {
      const d = document.createElement('div');
      d.className = 'msg ' + (who === 'you' ? 'them' : 'bot');
      d.textContent = txt;
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
    };
    const renderScore = () => {
      const r = calculateLeadScore(lead);
      const tierClass = { HIGH: 'hi', MEDIUM: 'md', LOW: 'lo' }[r.tier];
      scoreEl.innerHTML =
        `<div class="lf-tier ${tierClass}"><span class="tag">${r.tier} intent</span><b>${r.score}<span>/100</span></b></div>` +
        '<ul class="lf-reasons">' + r.reasons.map((x) => `<li class="${x[0] === '+' ? 'pos' : 'neg'}"><span>${x[0]}</span>${esc(x[1])}${x[2] ? ` <em>+${x[2]}</em>` : ''}</li>`).join('') + '</ul>';
      if (cadEl) {
        const active = r.tier === 'HIGH' ? 1 : r.tier === 'MEDIUM' ? 2 : 4; // how many touches a tier gets before halt
        cadEl.innerHTML = CADENCE.map((b, i) =>
          `<div class="lf-beat ${i < active ? 'on' : 'off'}"><b>${b[0]}</b><span>${esc(b[1])}</span></div>`).join('') +
          `<p class="lf-cad-note">${r.tier === 'HIGH' ? 'High intent: called first, fewest nudges needed.' : r.tier === 'LOW' ? 'Low intent: nurtured gently across the full week.' : 'Medium intent: a well-timed reminder or two.'} The sequence halts the instant the patient replies, books or opts out.</p>`;
      }
    };

    const send = (text) => {
      text = text.trim(); if (!text) return;
      add('you', text);
      updateLead(text);
      const answer = reply(text, lead);
      setTimeout(() => { add('bot', answer); renderScore(); }, 160); // tiny "thinking" beat
    };

    form.addEventListener('submit', (e) => { e.preventDefault(); const v = input.value; input.value = ''; send(v); });
    document.querySelectorAll('[data-lf-example]').forEach((b) =>
      b.addEventListener('click', () => { input.value = b.getAttribute('data-lf-example'); input.focus(); form.requestSubmit(); }));

    // seed with the receptionist's opening line + an initial (empty-lead) score so nothing is blank
    add('bot', `Hi, welcome to ${CLINIC} — I'm the front desk, on duty 24/7. Ask me about a treatment, pricing or booking a consultation.`);
    renderScore();
  });
})();
