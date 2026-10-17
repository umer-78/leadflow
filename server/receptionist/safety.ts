/**
 * Safety rules that run before anything else. Deterministic patterns, so
 * emergencies are never left to a classifier's confidence score.
 *
 *  ER      – possible medical emergency: send to 911 / emergency room.
 *  URGENT  – dental emergency: first aid + call the practice now, alert staff.
 *  SOON    – pain or a problem that should be seen soon: guidance + offer a visit.
 */

export type SafetyLevel = 'ER' | 'URGENT' | 'SOON';

export interface SafetyMatch {
  level: SafetyLevel;
  /** Knowledge-library slug with the relevant first-aid guidance. */
  topic: string;
  /** Short description for staff alerts. */
  reason: string;
  /** Why this needs emergency care (ER level). */
  advice?: string;
}

const clean = (text: string) =>
  text
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/\s+/g, ' ');

interface Rule {
  level: SafetyLevel;
  topic: string;
  reason: string;
  advice?: string;
  test: (t: string) => boolean;
}

const has = (re: RegExp) => (t: string) => re.test(t);

const BLEEDING_UNCONTROLLED =
  /\b(wont|will not|cant|cannot|doesnt|does not|isnt|is not)\s+stop(ped)?\s+bleeding\b|\bbleeding\s+(wont|will not|doesnt|does not|hasnt|has not|isnt|is not)\s+stop|\b(heavy|heavily|lots of|a lot of|so much|uncontrolled|nonstop|non stop)\s+(bleeding|blood)\b|\bbleeding (a lot|heavily|nonstop)\b/;
const GUMS_WHEN_BRUSHING = /\bgums?\b[^.?!]{0,40}\b(brush|brushing|floss|flossing)\b|\b(brush|brushing|floss|flossing)\b[^.?!]{0,40}\bgums?\b/;

const PROCEDURE_QUESTION =
  /\b(will|would|does|do|is it|after|during|before|how much)\b[^.?!]{0,40}\b(whiten\w*|implants?|veneers?|braces|aligners?|invisalign|root canals?|cleaning|fillings?|crowns?|extractions?|bonding|surgery|procedure|treatment|injection|numbing)\b/;
const PAIN = /\b(toothache|tooth ache|pain|painful|hurts?|hurting|aching|aches|ache|sore|throbbing|killing me)\b/;
const FIRST_PERSON = /\b(my|i|im|ive|me|mine)\b/;
const MOUTH = /\b(tooth|teeth|molar|molars|jaw|gum|gums|mouth|wisdom)\b/;
const INTENSE =
  /\b(severe|severely|unbearable|excruciating|terrible|horrible|really bad|so bad|so much|extreme|extremely|intense|killing me|worst|cant sleep|cannot sleep|could not sleep|couldnt sleep|all night|cant eat|cannot eat|agony|crying)\b/;

const RULES: Rule[] = [
  // ---- possible medical emergencies
  {
    level: 'ER',
    topic: 'emergency-warning-signs',
    reason: 'Difficulty breathing or swallowing',
    advice: 'Trouble breathing or swallowing can mean a serious infection or reaction that needs immediate care.',
    test: has(/\b(cant|cannot|can not|hard to|trouble|difficulty|struggling to|struggle to|unable to|problems?|barely|hardly|can barely|can hardly|hurts to|painful to)\s+(breathe|breathing|swallow|swallowing)\b|\b(breathing|swallowing) is (hard|difficult|painful)\b|\bshort(ness)? of breath\b/),
  },
  {
    level: 'ER',
    topic: 'emergency-warning-signs',
    reason: 'Swelling spreading to the eye, neck or throat',
    advice: 'Swelling that spreads toward the eye, neck or throat can be a sign of a serious infection that needs urgent treatment.',
    test: has(/\b(swell\w*|swollen|puff\w*)\b[^.?!]{0,40}\b(eye|eyes|neck|throat|under my tongue)\b|\b(eye|eyes|neck|throat)\b[^.?!]{0,30}\b(swell\w*|swollen|puffy)\b/),
  },
  {
    level: 'ER',
    topic: 'emergency-warning-signs',
    reason: 'Fever with swelling or infection',
    advice: 'A fever together with swelling can mean an infection is spreading and needs urgent treatment.',
    test: (t) => /\b(fever|temperature|chills)\b/.test(t) && /\b(swell\w*|swollen|abscess\w*|infect\w*|pus)\b/.test(t),
  },
  {
    level: 'ER',
    topic: 'emergency-warning-signs',
    reason: 'Jaw, face or head injury',
    advice: 'Injuries to the jaw, face or head should be checked by emergency medical staff first; the dental team can help afterwards.',
    test: has(/\b(broke|broken|fractured?|dislocated)\s+(my\s+)?jaw\b|\bjaw\s+(is\s+)?(broken|fractured|dislocated)\b|\b(hit|struck|punched|kicked) (in|on) the (head|face|jaw|mouth)\b|\b(car|bike|bicycle|motorcycle|sports?) (accident|crash)\b|\bhead injury\b|\b(passed out|unconscious|fainted|lost consciousness)\b/),
  },
  {
    level: 'ER',
    topic: 'emergency-warning-signs',
    reason: 'Chest pain',
    advice: 'Chest pain needs immediate medical attention.',
    test: has(/\bchest pains?\b/),
  },
  // ---- dental emergencies
  {
    level: 'URGENT',
    topic: 'after-extraction',
    reason: 'Bleeding that will not stop',
    test: (t) => BLEEDING_UNCONTROLLED.test(t) && !GUMS_WHEN_BRUSHING.test(t),
  },
  {
    level: 'URGENT',
    topic: 'knocked-out-tooth',
    reason: 'Knocked-out tooth',
    test: (t) =>
      (/\bknock\w*\s+(out|loose)\b|\b(tooth|teeth)\b[^.?!]{0,25}\b(fell|fall|came|come|got knocked|popped)\s+out\b|\bavuls\w*/.test(t) ||
        /\b(knock\w*|smash\w*|hit)\b[^.?!]{0,20}\b(tooth|teeth)\b[^.?!]{0,12}\bout\b/.test(t)) &&
      !/\bbaby tooth|baby teeth|milk tooth|wiggly|was loose|loose baby\b/.test(t),
  },
  {
    level: 'URGENT',
    topic: 'dental-abscess',
    reason: 'Swelling or possible abscess',
    // Swelling for a few days after surgery is expected; that is an aftercare question.
    test: (t) =>
      /\b(abscess\w*|pus|gum boil|swollen (face|cheek|jaw|gum|gums|mouth|lip)|(face|cheek|jaw|gum|gums|lip) (is |are )?(swollen|swelling)|my face is puffy|swelling)\b/.test(t) &&
      !/\b(after|since|following)\b[^.?!]{0,20}\b(surgery|extraction|implant|wisdom|procedure|root canal|filling|tooth removal)\b/.test(t) &&
      !PROCEDURE_QUESTION.test(t),
  },
  {
    level: 'URGENT',
    topic: 'broken-or-chipped-tooth',
    reason: 'Broken or chipped tooth',
    test: (t) =>
      /\b(broke|broken|chipped|chip|cracked|crack|snapped|fractured)\b[^.?!]{0,20}\b(tooth|teeth|front|molar|veneer)\b|\b(tooth|teeth|molar|veneer)\b[^.?!]{0,15}\b(broke|broken|chipped|cracked|snapped|fractured)\b/.test(t) &&
      !PROCEDURE_QUESTION.test(t) &&
      FIRST_PERSON.test(t),
  },
  {
    level: 'URGENT',
    topic: 'severe-toothache',
    reason: 'Severe dental pain',
    test: (t) => PAIN.test(t) && INTENSE.test(t) && (MOUTH.test(t) || /toothache/.test(t)) && !PROCEDURE_QUESTION.test(t),
  },
  {
    level: 'SOON',
    topic: 'lost-filling-or-crown',
    reason: 'Lost filling or crown',
    test: has(/\b(lost|fell out|came out|came off|fell off|popped off|popped out|broke off)\b[^.?!]{0,20}\b(filling|crown|cap|bridge|temporary)\b|\b(filling|crown|cap|bridge|temporary)\b[^.?!]{0,20}\b(fell out|came out|came off|fell off|popped (off|out)|is loose|broke off)\b/),
  },
  {
    level: 'SOON',
    topic: 'severe-toothache',
    reason: 'Tooth pain',
    test: (t) =>
      PAIN.test(t) && FIRST_PERSON.test(t) && (MOUTH.test(t) || /toothache/.test(t)) && !PROCEDURE_QUESTION.test(t),
  },
];

/** The most serious safety issue in the message, if any. */
export function checkSafety(text: string): SafetyMatch | undefined {
  const t = clean(text);
  for (const r of RULES) if (r.test(t)) return { level: r.level, topic: r.topic, reason: r.reason, advice: r.advice };
  return undefined;
}

const DIAGNOSIS =
  /\b(do i (have|need)\s+(a |an )?(cavity|cavities|root canal|filling|crown|infection|abscess|gum disease|periodontitis|gingivitis|extraction|antibiotics|surgery|cancer|tmj|dry socket|wisdom teeth (removed|out)))\b|\bis (it|this|that|my \w+) (infected|an infection|normal|serious|broken|cracked|a cavity|cancer\w*|gum disease|an abscess|dry socket|bad)\b|\b(whats|what is) wrong with (my|me)\b|\bcould (it|this|that) be\b|\bdiagnos\w*\b|\bshould i be (worried|concerned)\b|\bwhat (is|could) (this|that) (bump|spot|lump|white patch|patch)\b/;

const MEDICATION =
  /\b(what|which|how much|how many|can i take|should i take|is it ok to take|is it safe to take|safe to take|recommend)\b[^.?!]{0,40}\b(antibiotic\w*|ibuprofen|advil|motrin|tylenol|acetaminophen|paracetamol|aspirin|painkillers?|pain killers?|pain relief|medicine|medication|meds|amoxicillin|penicillin|mg|dose|dosage|pills?)\b/;

const MEDICATION_FOR_SYMPTOM =
  /\b(what|which)\b[^.?!]{0,20}\b(take|use|give|have)\b[^.?!]{0,20}\b(for|with)\b[^.?!]{0,15}\b(pain|ache|aching|swelling|infection|toothache|sensitivity)\b/;

export function isMedicationQuestion(text: string): boolean {
  const t = clean(text);
  return MEDICATION.test(t) || MEDICATION_FOR_SYMPTOM.test(t);
}

export function isDiagnosisRequest(text: string): boolean {
  return DIAGNOSIS.test(clean(text));
}
