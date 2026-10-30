/**
 * What the patient has told us about themselves during the chat ("I'm
 * pregnant", "I'm scared of needles", "I don't have insurance"), so later
 * answers take it into account the way a good receptionist would: whitening
 * gets the pregnancy caution, an implant question gets the smoking note, a
 * price gets the no-insurance options.
 */

export interface PatientProfile {
  pregnant?: boolean;
  breastfeeding?: boolean;
  /** Asking for their child ("my 6 year old"). */
  child?: boolean;
  childAge?: number;
  anxious?: boolean;
  diabetic?: boolean;
  smoker?: boolean;
  uninsured?: boolean;
  bloodThinner?: boolean;
  /** "My insurance covers 50%." */
  coveragePercent?: number;
}

export type ProfileFact = keyof PatientProfile;

const clean = (text: string) => text.toLowerCase().replace(/[‘’']/g, '').replace(/\s+/g, ' ');

const PREGNANT = /\b(?:im|i am|currently|now|while)\s+(?:\w+\s+){0,3}(?:pregnant|expecting)\b|\bmy pregnancy\b|\bpregnant (?:and|with|right now|at the moment)\b|^pregnant\b/;
const NOT_PREGNANT = /\b(?:not|no longer|was) pregnant\b|\bwhen i was pregnant\b/;
const BREASTFEEDING = /\b(?:im|i am|currently)\s+(?:\w+\s+){0,2}(?:breast ?feeding|nursing)\b|\bwhile (?:im |i am )?(?:breast ?feeding|nursing)\b/;
const CHILD = /\bmy (?:son|daughter|kid|kids|child|children|baby|toddler|little one|boy|girl|teen|teenager)\b|\bfor my (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)[- ]?(?:year|yr)[- ]?old\b/;
const CHILD_AGE = /\b(\d{1,2})[- ]?(?:years?|yrs?)[- ]?old\b|\b(\d{1,2})[- ]?(?:yo|y\/o)\b|\bage (\d{1,2})\b|\b(\d{1,2})[- ]?month[- ]?old\b/;
const ANXIOUS =
  /\b(?:scared|terrified|petrified|afraid|frightened|nervous|anxious|anxiety|phobia|fear of|panic\w*|dread\w*|freak(?:ed|ing)? out|hate (?:going to )?the dentist|hate needles)\b/;
const NOT_ANXIOUS = /\b(?:not|never|isnt|arent) (?:scared|nervous|afraid|anxious|worried)\b/;
const DIABETIC = /\b(?:im|i am|i have|ive got|i got)\s+(?:\w+\s+){0,2}(?:diabetic|diabetes)\b|\bmy diabetes\b|\btype (?:1|2|one|two) diabet\w*\b|\bas a diabetic\b|^diabetic\b/;
const SMOKER = /\bi (?:still )?(?:smoke|vape|chew tobacco)\b|\bim a (?:heavy |light |social )?smoker\b|\bas a smoker\b|^smoker\b/;
const NOT_SMOKER = /\bi (?:quit|stopped|gave up|dont|do not|never) (?:smoking|smoke|vaping|vape)\b/;
const UNINSURED =
  /\b(?:no|dont have(?: any)?|do not have(?: any)?|without(?: any)?|lost my|no longer have|havent got|have no)\s+(?:dental\s+)?insurance\b|\buninsured\b|\bself[- ]pay\b|\bpaying (?:cash|out of pocket|myself)\b|\binsurance (?:ran out|expired)\b/;
const INSURED = /\bi have (?:dental )?insurance\b|\bmy (?:dental )?(?:insurance|plan) (?:is|covers|pays)\b|\bi(?:m| am) (?:insured|covered)\b/;
const BLOOD_THINNER =
  /\bi (?:take|am on|m on|use)\b[^.?!]{0,30}\b(?:blood thinners?|anticoagulants?|warfarin|coumadin|eliquis|apixaban|xarelto|rivaroxaban|plavix|clopidogrel|pradaxa)\b|\bon (?:blood thinners?|warfarin|eliquis|xarelto|plavix)\b/;
const COVERAGE = /\b(?:covers?|pays?|coverage(?: is)?|covered at|reimburses?|picks? up)\s+(?:about |around |up to )?(\d{1,3})\s?(?:%|percent)|\b(\d{1,3})\s?(?:%|percent)\s+(?:coverage|covered|of (?:it|the cost|the bill))/;

/** Update the profile from one message; returns the facts that are new or changed. */
export function learnProfile(profile: PatientProfile, text: string): ProfileFact[] {
  const t = clean(text);
  const learned: ProfileFact[] = [];
  const set = <K extends ProfileFact>(key: K, value: PatientProfile[K]) => {
    if (profile[key] === value) return;
    profile[key] = value;
    learned.push(key);
  };
  if (NOT_PREGNANT.test(t)) set('pregnant', false);
  else if (PREGNANT.test(t)) set('pregnant', true);
  if (BREASTFEEDING.test(t)) set('breastfeeding', true);
  if (CHILD.test(t)) {
    set('child', true);
    const m = CHILD_AGE.exec(t);
    const months = m?.[4] !== undefined;
    const age = m ? Number(m[1] ?? m[2] ?? m[3] ?? m[4]) : undefined;
    if (age !== undefined && !months && age < 19) set('childAge', age);
    if (months) set('childAge', 0);
  }
  if (ANXIOUS.test(t) && !NOT_ANXIOUS.test(t)) set('anxious', true);
  if (DIABETIC.test(t)) set('diabetic', true);
  if (NOT_SMOKER.test(t)) set('smoker', false);
  else if (SMOKER.test(t)) set('smoker', true);
  if (UNINSURED.test(t)) set('uninsured', true);
  else if (INSURED.test(t)) set('uninsured', false);
  if (BLOOD_THINNER.test(t)) set('bloodThinner', true);
  const coverage = COVERAGE.exec(t);
  const pct = coverage ? Number(coverage[1] ?? coverage[2]) : undefined;
  if (pct !== undefined && pct > 0 && pct <= 100) set('coveragePercent', pct);
  return learned;
}

/**
 * How a fact about the patient changes an answer about a treatment: which
 * library article holds the relevant guidance, which treatments it matters
 * for, and how to introduce it.
 */
export interface ProfileNote {
  fact: ProfileFact;
  slug: string;
  /** Lead-in for the sentence from the article. */
  lead: string;
  /** Treatments (service names) the fact matters for; undefined means any treatment. */
  services?: string[];
  /** Only for these kinds of reply (e.g. prices); undefined means answers about treatments. */
  kinds?: string[];
  /** What to look for in the article for this treatment ("whitening cosmetic" etc.). */
  query: (service: string) => string;
  /** The answer already covers it when it mentions this. */
  covered: RegExp;
}

const COSMETIC = ['Teeth whitening', 'Porcelain veneers', 'Cosmetic bonding', 'Gum contouring'];
const SURGICAL = ['Dental implants', 'Full-arch implants', 'Tooth extraction', 'Wisdom teeth removal', 'Gum disease treatment', 'Gum contouring'];

export const PROFILE_NOTES: ProfileNote[] = [
  {
    fact: 'pregnant',
    slug: 'pregnancy-and-dental-care',
    lead: 'Since you mentioned you’re pregnant:',
    covered: /pregnan|breastfeed/i,
    query: (service) => (COSMETIC.includes(service) ? 'elective cosmetic whitening postponed' : 'safe treatment x-rays local anaesthetic'),
  },
  {
    fact: 'anxious',
    slug: 'dental-anxiety-and-sedation',
    lead: 'And since you mentioned feeling nervous:',
    covered: /nervous|anxi|sedation|at your pace/i,
    query: () => 'nervous go at your pace sedation',
  },
  {
    fact: 'diabetic',
    slug: 'diabetes-and-oral-health',
    lead: 'With diabetes:',
    services: [...SURGICAL, 'Root canal treatment', 'Check-up and cleaning'],
    covered: /diabet|blood sugar/i,
    query: () => 'blood sugar healing controlled',
  },
  {
    fact: 'smoker',
    slug: 'smoking-and-oral-health',
    lead: 'As you smoke:',
    services: SURGICAL,
    covered: /smok/i,
    query: (service) => (/implant/i.test(service) ? 'implant failing' : 'dry socket extraction healing'),
  },
  {
    fact: 'uninsured',
    slug: 'insurance',
    lead: 'Without insurance:',
    kinds: ['price', 'new_patient', 'insurance'],
    covered: /don['’]t have (?:dental )?insurance|membership plan/i,
    query: () => "don't have insurance membership plan uninsured",
  },
  {
    fact: 'uninsured',
    slug: 'payment-and-financing',
    lead: 'Without insurance:',
    kinds: ['price', 'new_patient'],
    covered: /payment plans|financ|carecredit/i,
    query: () => 'monthly payment plans financing',
  },
  {
    fact: 'bloodThinner',
    slug: 'medicines-and-dental-treatment',
    lead: 'On blood thinners:',
    services: SURGICAL,
    covered: /blood thinner|anticoagulant/i,
    query: () => 'keep taking blood thinners bleeding',
  },
];
