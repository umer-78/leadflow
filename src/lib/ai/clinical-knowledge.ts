export interface ClinicalProcedureInfo {
  name: string;
  category: 'COSMETIC' | 'RESTORATIVE' | 'ORTHODONTIC' | 'SURGICAL' | 'PREVENTATIVE' | 'EMERGENCY';
  priceRange: string;
  financingOption: string;
  duration: string;
  recoveryTimeline: string;
  insuranceCoverage: string;
  keyDetails: string;
}

export const CLINICAL_KNOWLEDGE_BASE: Record<string, ClinicalProcedureInfo> = {
  veneers: {
    name: 'Handcrafted Porcelain Veneers',
    category: 'COSMETIC',
    priceRange: '$1,400 – $2,200 per tooth',
    financingOption: 'Starting at $99/mo with 0% APR via Cherry / CareCredit',
    duration: '2 appointments (1-2 weeks apart with master lab ceramist fabrication)',
    recoveryTimeline: 'Minimal to none. Mild temperature sensitivity for 2-3 days.',
    insuranceCoverage: 'Elective cosmetic; cosmetic benefits apply or HSA/FSA eligible.',
    keyDetails: 'Ultra-thin custom porcelain shells bonded to the front teeth to correct discoloration, chips, gaps, or misalignments with 15-20 year durability.',
  },
  invisalign: {
    name: 'Clear Aligners (Invisalign & ClearCorrect)',
    category: 'ORTHODONTIC',
    priceRange: '$3,800 – $5,800 comprehensive',
    financingOption: 'From $129/mo with $0 down payment',
    duration: '6 to 14 months depending on crowding severity',
    recoveryTimeline: 'Zero downtime; wear trays 20-22 hours daily.',
    insuranceCoverage: 'Most PPO plans cover $1,500 – $2,500 under orthodontic lifetime benefit.',
    keyDetails: 'Custom 3D-scanned transparent aligners that straighten teeth discreetly without metal wires or brackets.',
  },
  implants: {
    name: 'Dental Implants & Custom Abutments',
    category: 'SURGICAL',
    priceRange: '$2,400 – $4,500 complete (Fixture + Custom Zirconia Crown)',
    financingOption: '$149/mo flexible patient payment terms',
    duration: '3 to 6 months for osseointegration bone integration',
    recoveryTimeline: '3-5 days soft diet; localized soreness managed with prescribed analgesics.',
    insuranceCoverage: 'Major restorative benefits often cover 50% of the crown portion.',
    keyDetails: 'Medical-grade titanium or zirconia root replacement that permanently restores missing teeth with natural chewing strength.',
  },
  whitening: {
    name: 'In-Office Zoom Laser Teeth Whitening',
    category: 'COSMETIC',
    priceRange: '$450 – $650 per session (includes custom take-home maintenance kit)',
    financingOption: 'Eligible for HSA/FSA',
    duration: 'Single 60-minute in-clinic laser application',
    recoveryTimeline: 'Immediate; avoid staining liquids (coffee, red wine) for 48 hours.',
    insuranceCoverage: 'Purely cosmetic; not covered by dental insurance.',
    keyDetails: 'Professional light-activated whitening gel lightening teeth up to 8 shades in a single relaxing visit.',
  },
  bonding: {
    name: 'Composite Dental Bonding',
    category: 'COSMETIC',
    priceRange: '$350 – $600 per tooth',
    financingOption: 'In-house monthly payment plans',
    duration: '30 to 45 minutes per tooth',
    recoveryTimeline: 'Immediate return to normal chewing.',
    insuranceCoverage: 'Partial coverage (up to 80%) if repairing chipped or decayed enamel.',
    keyDetails: 'Tooth-colored composite resin sculpted and hardened with UV light to repair minor chips, gaps, or fractures.',
  },
  crowns: {
    name: 'All-Ceramic Same-Day Zirconia Crowns',
    category: 'RESTORATIVE',
    priceRange: '$1,100 – $1,650 per crown',
    financingOption: 'Covered by standard insurance + copay financing',
    duration: 'Single visit CAD/CAM digital milling (90 minutes)',
    recoveryTimeline: 'Zero recovery; immediate functional bite.',
    insuranceCoverage: '50% – 80% covered by dental insurance.',
    keyDetails: 'Precision digital milled porcelain crown protecting severely worn, cracked, or root-canal-treated teeth.',
  },
  sedation: {
    name: 'Comfort & Sedation Dentistry',
    category: 'PREVENTATIVE',
    priceRange: '$120 (Nitrous Oxide) to $450 (Oral Conscious Sedation)',
    financingOption: 'Add-on to any clinical treatment',
    duration: 'Duration of procedure',
    recoveryTimeline: 'Nitrous: clears in 5 minutes. Oral sedation: companion required to drive home.',
    insuranceCoverage: 'Generally out-of-pocket unless medically necessary.',
    keyDetails: 'Safe, relaxing sedation options tailored for anxious patients to ensure a completely pain-free, comfortable visit.',
  },
  emergency: {
    name: 'Emergency Dental Care & Severe Pain Triage',
    category: 'EMERGENCY',
    priceRange: '$150 emergency diagnostic exam & digital X-rays',
    financingOption: 'Same-day urgent booking with deferred billing',
    duration: 'Same-day emergency priority slot (within 2 hours)',
    recoveryTimeline: 'Immediate pain relief protocol',
    insuranceCoverage: '80% – 100% emergency diagnostic coverage.',
    keyDetails: 'Immediate treatment for severe throbbing pain, fractured teeth, lost crowns, or dental trauma.',
  },
};

export const CLINIC_PRACTICE_POLICIES = {
  acceptedInsurances: [
    'Delta Dental PPO / Premier',
    'MetLife Dental',
    'Cigna Dental Network',
    'Aetna PPO',
    'Guardian Life',
    'UnitedHealthcare Dental',
    'Humana Dental',
    'Careington Care POS',
  ],
  parkingInfo: 'Validated patient parking in the adjacent Sutter-Stockton Garage (Level 2 Direct Walkway).',
  hours: 'Monday – Friday: 7:30 AM – 6:30 PM | Saturday: 8:00 AM – 3:00 PM | Sunday: Emergency On-Call Only',
  location: '450 Sutter St, Suite 1420, San Francisco, CA 94108 (2 blocks from Union Square)',
  doctorBio: 'Dr. Sarah Lin, DDS, AACD Fellow with 14+ years specializing in aesthetic smile design and restorative implantology.',
  cancellationPolicy: '24-hour courtesy cancellation notice requested. No fee for medical emergencies.',
};

export function lookupClinicalKnowledge(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('veneer') || q.includes('smile makeover')) {
    const v = CLINICAL_KNOWLEDGE_BASE.veneers;
    return `${v.name} cost ${v.priceRange}. Financing: ${v.financingOption}. Timeline: ${v.duration}. ${v.keyDetails}`;
  }

  if (q.includes('invisalign') || q.includes('aligner') || q.includes('brace') || q.includes('straighten')) {
    const a = CLINICAL_KNOWLEDGE_BASE.invisalign;
    return `${a.name} are ${a.priceRange}, or ${a.financingOption}. Timeline: ${a.duration}. Insurance: ${a.insuranceCoverage}.`;
  }

  if (q.includes('implant') || q.includes('missing tooth') || q.includes('screw')) {
    const imp = CLINICAL_KNOWLEDGE_BASE.implants;
    return `${imp.name} are ${imp.priceRange}. Financing: ${imp.financingOption}. Recovery: ${imp.recoveryTimeline}.`;
  }

  if (q.includes('whiten') || q.includes('bleach') || q.includes('yellow')) {
    const w = CLINICAL_KNOWLEDGE_BASE.whitening;
    return `${w.name} is ${w.priceRange} for a ${w.duration}. Lightens teeth up to 8 shades with zero downtime.`;
  }

  if (q.includes('bond') || q.includes('chip') || q.includes('gap')) {
    const b = CLINICAL_KNOWLEDGE_BASE.bonding;
    return `${b.name} costs ${b.priceRange} taking ${b.duration}. Great for minor chips and gaps.`;
  }

  if (q.includes('crown') || q.includes('cap') || q.includes('broken tooth')) {
    const c = CLINICAL_KNOWLEDGE_BASE.crowns;
    return `${c.name} are ${c.priceRange} with same-day digital CAD/CAM milling in 90 minutes. Insurance covers 50-80%.`;
  }

  if (q.includes('insurance') || q.includes('delta') || q.includes('metlife') || q.includes('cigna') || q.includes('aetna')) {
    return `We accept all major PPO dental insurances including ${CLINIC_PRACTICE_POLICIES.acceptedInsurances.slice(0, 5).join(', ')}. We handle all claims and pre-authorizations for you.`;
  }

  if (q.includes('sedation') || q.includes('fear') || q.includes('anxiety') || q.includes('hurt') || q.includes('pain')) {
    const s = CLINICAL_KNOWLEDGE_BASE.sedation;
    return `We specialize in anxiety-free visits! We offer ${s.name} (${s.priceRange}) including Nitrous Oxide and Oral Conscious Sedation so you feel completely relaxed and comfortable.`;
  }

  if (q.includes('hour') || q.includes('open') || q.includes('saturday') || q.includes('sunday')) {
    return `Our office hours are: ${CLINIC_PRACTICE_POLICIES.hours}.`;
  }

  if (q.includes('where') || q.includes('location') || q.includes('parking') || q.includes('address') || q.includes('directions')) {
    return `We are located at ${CLINIC_PRACTICE_POLICIES.location}. ${CLINIC_PRACTICE_POLICIES.parkingInfo}`;
  }

  if (q.includes('emergency') || q.includes('throbbing') || q.includes('severe') || q.includes('swelling')) {
    return `If you are experiencing a severe dental emergency or swelling, we have same-day urgent care appointments available within 2 hours. Diagnostic exams are $150 and covered by insurance.`;
  }

  return `We offer comprehensive cosmetic, orthodontic, and implant care. Porcelain veneers are $1,400/tooth, Invisalign is $3,800 (from $129/mo), and dental implants are $2,400. Would you like me to reserve a consultation for you?`;
}
