/**
 * The starter knowledge library every clinic receives (and can edit).
 *
 * Clinical articles are general patient information written to be accurate and
 * conservative: they explain procedures, conditions, first aid and aftercare,
 * and always leave diagnosis and treatment decisions to an exam. Policy
 * articles are clinic-specific, so they start as unpublished drafts that the
 * clinic fills in — the assistant never answers from an unpublished article.
 */

export type ArticleCategory = 'PROCEDURE' | 'CONDITION' | 'EMERGENCY' | 'AFTERCARE' | 'FAQ' | 'POLICY';

/** A published source the article's facts were checked against. */
export interface Reference {
  name: string;
  url: string;
}

export interface LibraryArticle {
  slug: string;
  category: ArticleCategory;
  title: string;
  /** One or two sentences: the answer to "tell me about X". */
  summary: string;
  /** Details, one fact per sentence so the assistant can quote the relevant one. */
  body: string;
  /** Alternative names and phrasings patients use. */
  tags: string[];
  /** Bookable service this article describes, if any. */
  service?: string;
  /** Typical case value in USD, used only for internal lead scoring. */
  caseValue?: number;
  /** How prices for this service are quoted, e.g. "per tooth". */
  priceUnit?: string;
  /** Policies start unpublished until the clinic fills them in. */
  published?: boolean;
  /** Where the clinical facts were checked (patient-information pages of health services and dental bodies). */
  references?: Reference[];
}

export const LIBRARY: LibraryArticle[] = [
  // ---------------------------------------------------------------- procedures
  {
    slug: 'dental-implants',
    category: 'PROCEDURE',
    title: 'Dental implants',
    service: 'Dental implants',
    caseValue: 4500,
    priceUnit: 'per tooth (implant, abutment and crown)',
    tags: ['implant', 'implants', 'missing tooth', 'missing teeth', 'tooth replacement', 'replace a tooth', 'titanium post', 'implant crown', 'gap where a tooth was', 'lost a tooth'],
    summary:
      'A dental implant replaces a missing tooth with a titanium or zirconia post placed in the jawbone, topped with a custom crown. It looks, feels and chews like a natural tooth and, with good care, can last for decades.',
    body: `Implants can replace one tooth, several teeth, or anchor a bridge or denture.
Age alone isn't a barrier: implants are placed successfully in people in their 70s and 80s when their general health and jawbone allow.
Treatment starts with a consultation, an exam and 3D imaging (a cone-beam CT scan) to check the bone and plan where the implant goes.
The implant is placed under local anaesthetic, and sedation is often available for nervous patients.
The bone then heals around and fuses with the implant, usually over 3 to 6 months and sometimes up to 9, before the final crown is attached, so the whole process often takes several months to a year.
A temporary tooth can usually be worn while the implant heals.
If there is not enough bone, a bone graft or sinus lift may be needed first, which can add a few months.
Most people find the discomfort after placement is less than they expected and manage it with over-the-counter pain relievers for a few days; some swelling and bruising is normal.
Good candidates have healthy gums and enough jawbone; smoking, uncontrolled diabetes and gum disease raise the risk of an implant failing, so they are reviewed at the consultation.
If a tooth has to be removed first, the implant is often placed once the socket has healed, usually after about 3 to 4 months, and sometimes on the same day as the extraction when the bone is healthy.
Titanium implants are not magnetic, so they rarely set off airport metal detectors and are generally safe for MRI scans; just tell the imaging team you have implants.
Implants have high success rates: studies report that more than 95% of single implants are still doing well after three to five years.
Implants are cleaned like natural teeth: brush twice a day, clean between the teeth daily and keep regular check-ups.
Alternatives include a bridge or a removable partial denture, and the dentist can compare the options for your situation.
Most people feel back to normal within about a week of implant surgery.
The implant itself can last a lifetime with good care, while the crown on top may need replacing after 10 to 15 years or more of wear.`,
    references: [
      { name: 'Cleveland Clinic: Dental implants', url: 'https://my.clevelandclinic.org/health/treatments/10903-dental-implants' },
      { name: 'Cambridge University Hospitals (NHS): Dental implants', url: 'https://www.cuh.nhs.uk/patient-information/dental-implants-in-restorative-dentistry/' },
    ],
  },
  {
    slug: 'implant-supported-dentures',
    category: 'PROCEDURE',
    title: 'Full-arch implants and implant-supported dentures',
    service: 'Full-arch implants',
    caseValue: 18000,
    priceUnit: 'per arch',
    tags: ['all on 4', 'all-on-4', 'full arch', 'full mouth', 'implant dentures', 'snap on dentures', 'overdenture', 'teeth in a day', 'new teeth', 'replace all my teeth'],
    summary:
      'Implant-supported dentures (including "All-on-4" style full-arch treatment) attach a full set of teeth to a few implants, so the teeth stay put instead of slipping like a conventional denture.',
    body: `They suit people missing most or all of their teeth in one jaw, or whose remaining teeth can't be saved.
Usually four to six implants support a full arch of teeth; "All-on-4" treatment uses four implants per jaw.
Depending on the case, a fixed temporary set of teeth may be attached the same day or soon after surgery, with the final teeth made after healing, often 3 to 6 months later.
Compared with a conventional denture they feel more secure, cover less of the palate and help preserve the jawbone.
Treatment starts with a consultation, 3D imaging and a review of your medical history, and the dentist will explain whether fixed or removable (snap-on) teeth suit you.
Most people feel normal within about a week of surgery, and the implants then take about 3 to 6 months to fuse with the bone; a temporary denture or set of teeth is worn meanwhile.
From the first consultation to the final teeth, treatment commonly takes about 6 to 12 months.
The implants can last a lifetime with good care, while the teeth or denture attached to them wear and eventually need replacing.
Clean around the implants every day as the dentist shows you, and keep regular check-ups so the gums around them stay healthy.`,
    references: [
      { name: 'Cleveland Clinic: Implant-supported dentures', url: 'https://my.clevelandclinic.org/health/treatments/24303-implant-supported-dentures' },
      { name: 'Cleveland Clinic: Dental implants', url: 'https://my.clevelandclinic.org/health/treatments/10903-dental-implants' },
    ],
  },
  {
    slug: 'clear-aligners',
    category: 'PROCEDURE',
    title: 'Clear aligners (Invisalign)',
    service: 'Clear aligners',
    caseValue: 5000,
    priceUnit: 'for full treatment',
    tags: ['invisalign', 'clearcorrect', 'aligners', 'clear braces', 'invisible braces', 'straighten my teeth', 'straight teeth', 'crooked teeth', 'crowded teeth', 'gaps', 'orthodontics', 'trays'],
    summary:
      'Clear aligners such as Invisalign are a series of custom, nearly invisible removable trays that gradually straighten teeth without brackets or wires.',
    body: `They can correct crowding, gaps and many mild to moderate bite problems; more complex cases may be better treated with braces, which the dentist will assess.
Treatment starts with an exam and a digital 3D scan of your teeth that is used to plan each step of the movement.
You wear the aligners about 22 hours a day, taking them out only to eat, to drink anything other than water and to clean your teeth, and switch to the next set every one to two weeks as prescribed.
Mild cases can be finished in under a year, and many cases take around 6 to 18 months, depending on how far the teeth need to move.
Clear aligners suit adults and teenagers, and versions made for younger children exist; the dentist checks whether the teeth and jaw are ready.
Because the aligners are removable, brushing and flossing are easier than with fixed braces.
Small tooth-coloured bumps called attachments are sometimes bonded to teeth to help the aligners grip.
Expect mild pressure or soreness for a day or two with each new set; it means the teeth are moving.
Some people notice a slight lisp for the first few days, which usually fades as the tongue gets used to the aligners.
If an aligner cracks or is lost, call the practice; you'll usually be told to wear the previous or next set until a replacement arrives.
Take the aligners out to eat and to drink anything other than plain water, and brush before putting them back in.
After treatment you wear retainers, usually every night, to stop the teeth moving back.
Wearing the aligners for less time than prescribed is the most common reason treatment takes longer than planned.`,
    references: [
      { name: 'American Association of Orthodontists: Clear aligners', url: 'https://aaoinfo.org/treatments/aligners/' },
      { name: 'Cleveland Clinic: Clear aligners', url: 'https://my.clevelandclinic.org/health/treatments/clear-aligners' },
    ],
  },
  {
    slug: 'braces',
    category: 'PROCEDURE',
    title: 'Braces',
    service: 'Braces',
    caseValue: 5000,
    priceUnit: 'for full treatment',
    tags: ['braces', 'metal braces', 'ceramic braces', 'orthodontics', 'orthodontist', 'brackets', 'overbite', 'underbite', 'crossbite', 'bite correction'],
    summary:
      'Braces use brackets bonded to the teeth and a connecting wire to move teeth into a better position, and can treat everything from mild crowding to complex bite problems.',
    body: `Brackets can be metal or tooth-coloured ceramic.
Adjustment visits are usually every 4 to 8 weeks, and treatment often takes 1 to 3 years depending on the case, commonly around 18 months to 2 years.
Teeth usually ache for a few days after the braces are fitted and after each adjustment; soft or cold foods, over-the-counter pain relief and orthodontic wax over any bracket that rubs help.
Avoid hard, sticky and chewy foods such as hard candy, nuts, ice, popcorn, caramel, taffy and chewing gum, which can break brackets.
Cut foods like apples and corn on the cob into small pieces instead of biting into them.
Cleaning carefully around the brackets prevents decay and white spots.
After braces come off, retainers keep the teeth in their new position.
Orthodontic treatment can be done at any age as long as the teeth and gums are healthy.
Orthodontists recommend a first orthodontic check by about age 7, when bite problems can be spotted early, although most treatment starts later, often between ages 9 and 14.
If a bracket or wire comes loose or starts poking, call the practice; orthodontic wax covers a sharp end until it can be fixed.`,
    references: [
      { name: 'American Association of Orthodontists: Braces', url: 'https://aaoinfo.org/treatments/braces/' },
      { name: 'American Association of Orthodontists: Eating with braces', url: 'https://aaoinfo.org/blog/what-can-i-eat-with-braces/' },
      { name: 'Cleveland Clinic: Braces', url: 'https://my.clevelandclinic.org/health/treatments/24601-teeth-braces' },
    ],
  },
  {
    slug: 'porcelain-veneers',
    category: 'PROCEDURE',
    title: 'Porcelain veneers',
    service: 'Porcelain veneers',
    caseValue: 8000,
    priceUnit: 'per tooth',
    tags: ['veneer', 'veneers', 'porcelain veneers', 'smile makeover', 'hollywood smile', 'chipped teeth', 'stained teeth', 'uneven teeth', 'cosmetic dentistry', 'lumineers'],
    summary:
      'Porcelain veneers are thin, custom-made shells bonded to the front of the teeth to improve their colour, shape, size or alignment.',
    body: `They cover chips, worn edges, stains that whitening can't fix, small gaps and slightly uneven teeth.
Treatment usually takes two or three visits over a few weeks: a consultation and smile design, preparing and scanning the teeth, then bonding the final veneers.
Temporary veneers can be worn while the final ones are made.
Preparing the teeth is usually done with local anaesthetic, and most people feel only mild sensitivity for a few days afterwards.
Veneers can be made for a single tooth or for several, and a single veneer is shade-matched to the teeth beside it.
Preparing the teeth usually removes a thin layer of enamel, so traditional veneers are a permanent choice.
Porcelain resists staining and, with good care, veneers commonly last 10 to 15 years or more.
Porcelain veneers are custom-shaded and slightly translucent like natural enamel, so well-designed veneers look natural rather than fake.
Avoid biting very hard things like ice, pens or packaging, and wear a night guard if you grind your teeth.
Composite (resin) veneers are a lower-cost alternative that needs little or no tooth reduction, but they are less durable and can stain.
Any decay or gum disease is treated first, because veneers need healthy teeth and gums underneath.
Most people go straight back to their normal activities after each visit.
Some minimal-preparation or "no-prep" veneers need little or no enamel removed and may be reversible.`,
    references: [
      { name: 'Cleveland Clinic: Dental veneers', url: 'https://my.clevelandclinic.org/health/treatments/23522-dental-veneers' },
    ],
  },
  {
    slug: 'cosmetic-bonding',
    category: 'PROCEDURE',
    title: 'Cosmetic bonding',
    service: 'Cosmetic bonding',
    caseValue: 500,
    priceUnit: 'per tooth',
    tags: ['bonding', 'composite bonding', 'tooth bonding', 'edge bonding', 'chipped tooth repair', 'close a gap', 'composite veneers', 'resin'],
    summary:
      'Cosmetic bonding uses tooth-coloured composite resin, shaped and hardened directly on the tooth, to repair chips, close small gaps and improve a tooth’s shape or colour, usually in one visit.',
    body: `Little or no enamel needs to be removed, and numbing is often not required.
Each tooth usually takes about 30 to 60 minutes.
Bonding is less durable than porcelain: it can chip or stain, and typically lasts about 3 to 10 years before it needs touching up or replacing.
Avoid biting nails or hard objects, and limit coffee, tea, red wine and smoking to keep the colour.
There is no recovery time, so you can go back to normal activities straight away, although the tooth may feel slightly sensitive for a short time.
Because little or no enamel is removed, bonding is usually reversible, unlike traditional veneers.`,
    references: [
      { name: 'Cleveland Clinic: Dental bonding', url: 'https://my.clevelandclinic.org/health/treatments/10922-dental-bonding' },
    ],
  },
  {
    slug: 'teeth-whitening',
    category: 'PROCEDURE',
    title: 'Teeth whitening',
    service: 'Teeth whitening',
    caseValue: 500,
    priceUnit: 'per treatment',
    tags: ['whitening', 'teeth whitening', 'bleaching', 'zoom whitening', 'white teeth', 'whiter teeth', 'yellow teeth', 'stained teeth', 'brighter smile', 'whiten'],
    summary:
      'Professional whitening safely lightens natural tooth enamel with a peroxide gel, either in a single in-office session or with custom trays you use at home.',
    body: `In-office whitening uses a stronger gel applied by the dental team and takes about one to one and a half hours.
Take-home whitening uses custom-fitted trays and a lower-strength gel worn daily, usually for one to two weeks.
Whitening works on natural teeth only; it does not change the colour of crowns, veneers, fillings or bonding.
Whitening lightens all your natural teeth together; a single dark tooth, often after an injury or root canal, may need whitening from inside the tooth, bonding, a veneer or a crown.
Temporary sensitivity and mild gum irritation are common and usually settle within a few days, occasionally up to two weeks; a sensitivity toothpaste helps.
Results last from a few months up to about three years, depending on habits such as coffee, tea, red wine and smoking.
An exam first is recommended to check for decay or gum problems and to find out what is causing the discolouration.
As a precaution, whitening is usually postponed during pregnancy and breastfeeding.
Whitening gels used as directed don't damage enamel, but overusing them can increase sensitivity.
Whitening toothpastes only remove surface stains; they do not change the natural colour of the teeth.
Having whitening done or supervised by a dental professional is the safest way to whiten, because strong gels used without supervision can burn the gums.`,
    references: [
      { name: 'NHS: Teeth whitening', url: 'https://www.nhs.uk/tests-and-treatments/teeth-whitening/' },
    ],
  },
  {
    slug: 'dental-crowns',
    category: 'PROCEDURE',
    title: 'Dental crowns',
    service: 'Crowns',
    caseValue: 1300,
    priceUnit: 'per crown',
    tags: ['crown', 'crowns', 'cap', 'tooth cap', 'cracked tooth', 'zirconia crown', 'porcelain crown', 'same day crown'],
    summary:
      'A crown is a tooth-shaped cap that covers and protects a tooth that is cracked, badly decayed, heavily filled or weakened after a root canal.',
    body: `Crowns are made from porcelain, zirconia, other ceramics or metal alloys, chosen for strength and appearance.
A crown traditionally takes two visits: the tooth is shaped and scanned and a temporary crown is fitted, then the permanent crown is cemented about two to three weeks later.
Some practices can design and mill a crown on the same day.
The procedure is done under local anaesthetic and usually feels similar to having a filling.
Crowns commonly last 5 to 15 years, and often longer with good care, regular check-ups and a low-sugar diet.
If your bite feels high or the tooth stays sensitive for more than a few days after the crown is placed, let the practice know so it can be adjusted.
Metal crowns are the strongest and are often chosen for back teeth, all-ceramic and porcelain crowns look the most natural, and porcelain-fused-to-metal crowns combine strength with a natural look.
While you have a temporary crown, avoid sticky and hard foods and chew on the other side.`,
    references: [
      { name: 'Cleveland Clinic: Dental crowns', url: 'https://my.clevelandclinic.org/health/treatments/10923-dental-crowns' },
      { name: 'Leeds Teaching Hospitals (NHS): Crowns', url: 'https://www.leedsth.nhs.uk/patients/resources/crowns/' },
    ],
  },
  {
    slug: 'dental-bridges',
    category: 'PROCEDURE',
    title: 'Dental bridges',
    service: 'Bridges',
    caseValue: 3000,
    priceUnit: 'per bridge',
    tags: ['bridge', 'bridges', 'fixed bridge', 'missing tooth', 'replace missing teeth'],
    summary:
      'A bridge replaces one or more missing teeth with false teeth anchored to crowns on the neighbouring teeth or on implants.',
    body: `A traditional bridge needs the teeth on either side of the gap to be shaped for crowns.
It usually takes two visits a couple of weeks apart.
Bridges commonly last 5 to 15 years, and many last longer with good care.
Clean under the false tooth every day with floss threaders or small interdental brushes, because plaque there can cause decay in the supporting teeth and gum problems.
Implants are an alternative that doesn't involve reshaping the neighbouring teeth, and the dentist can compare both for you.
Types include traditional bridges held by crowns on both sides, cantilever bridges held on one side, resin-bonded (Maryland) bridges attached with small wings to the back of neighbouring teeth, mostly for front teeth, and implant-supported bridges.`,
    references: [
      { name: 'Cleveland Clinic: Dental bridges', url: 'https://my.clevelandclinic.org/health/treatments/10921-dental-bridges' },
      { name: 'Leeds Teaching Hospitals (NHS): Bridges', url: 'https://www.leedsth.nhs.uk/patients/resources/bridges/' },
    ],
  },
  {
    slug: 'dentures',
    category: 'PROCEDURE',
    title: 'Dentures',
    service: 'Dentures',
    caseValue: 2500,
    priceUnit: 'per denture',
    tags: ['denture', 'dentures', 'false teeth', 'partial denture', 'full denture', 'plate', 'flipper', 'reline'],
    summary:
      'Dentures are removable replacements for missing teeth: full dentures replace all the teeth in a jaw, and partial dentures fill gaps between remaining teeth.',
    body: `Making dentures takes several appointments for impressions, bite records and a try-in so the fit and look can be adjusted.
It is normal to need a few weeks, sometimes a couple of months, to get used to eating and speaking with new dentures; speech usually settles within days, and starting with soft foods cut into small pieces helps.
Sore spots are common in the first days, and the dentist can adjust the denture, so don't try to adjust it yourself.
Take dentures out at night, clean them daily with a denture brush and cleaner, and keep them moist when you're not wearing them.
Because gums and bone change shape over time, dentures may need relining every year or two, or whenever the fit changes, and replacing after about 7 to 10 years.
Implant-supported dentures are an option if a conventional denture feels loose.
Immediate dentures, fitted on the day teeth are removed, usually need adjusting or relining within months as the gums heal and shrink.`,
    references: [
      { name: 'NHS: Dentures', url: 'https://www.nhs.uk/conditions/dentures/' },
      { name: 'Cleveland Clinic: Dentures', url: 'https://my.clevelandclinic.org/health/treatments/10900-dentures' },
      { name: 'American Dental Association (MouthHealthy): Dentures', url: 'https://www.mouthhealthy.org/all-topics-a-z/dentures' },
    ],
  },
  {
    slug: 'root-canal-treatment',
    category: 'PROCEDURE',
    title: 'Root canal treatment',
    service: 'Root canal treatment',
    caseValue: 1200,
    priceUnit: 'per tooth (varies by tooth)',
    tags: ['root canal', 'endodontic', 'endodontics', 'nerve treatment', 'infected tooth', 'tooth infection', 'abscessed tooth', 'pulp', 'save my tooth', 'save a tooth', 'keep my tooth', 'instead of pulling it', 'avoid an extraction'],
    summary:
      'Root canal treatment removes infected or inflamed pulp from inside a tooth, cleans and disinfects the canals and seals them, saving the tooth instead of extracting it.',
    body: `Signs a tooth may need it include a lingering ache or sensitivity to hot or cold, pain when biting, a darkening tooth, or a swelling or small bump on the gum; only an exam and X-rays can confirm it.
It is done under local anaesthetic, so it shouldn't hurt, and for most people it feels similar to having a filling.
It is usually completed in one or two visits.
The tooth may feel tender for a few days afterwards, which over-the-counter pain relievers usually manage.
Back teeth usually need a crown afterwards to protect them from cracking, while front teeth often don't; putting off the permanent filling or crown raises the risk of the tooth breaking or the treatment failing.
Root canal treatment has a high success rate, and a treated tooth can last a lifetime: about 9 in 10 root-treated teeth are still in place 8 to 10 years later.
Most people go back to work or school the same day.
Avoid chewing hard food on the tooth until it has its permanent filling or crown.`,
    references: [
      { name: 'NHS: Root canal treatment', url: 'https://www.nhs.uk/tests-and-treatments/root-canal-treatment/' },
      { name: 'American Association of Endodontists: Root canal explained', url: 'https://www.aae.org/patients/root-canal-treatment/what-is-a-root-canal/root-canal-explained/' },
      { name: 'American Association of Endodontists: Root canal myths', url: 'https://www.aae.org/patients/root-canal-treatment/myths-root-canals/' },
    ],
  },
  {
    slug: 'tooth-extraction',
    category: 'PROCEDURE',
    title: 'Tooth extraction',
    service: 'Tooth extraction',
    caseValue: 400,
    priceUnit: 'per tooth',
    tags: ['extraction', 'tooth removal', 'pull a tooth', 'pulled tooth', 'take out a tooth', 'remove a tooth'],
    summary:
      'An extraction removes a tooth that is too damaged, infected or crowded to keep. It is done under local anaesthetic, with sedation available for more involved cases.',
    body: `A simple extraction removes a visible tooth, while a surgical extraction is used for teeth broken at the gum line or not fully erupted.
You should feel pressure but not sharp pain during the procedure.
Most people recover from a simple extraction in a few days; a surgical extraction can take a week or so.
Following the aftercare instructions protects the blood clot and helps prevent dry socket.
The dentist can discuss replacing the tooth with an implant, bridge or denture if needed.
If you would rather keep the tooth, ask whether root canal treatment, a crown or gum treatment could save it; a second opinion, for example from an endodontist (a root canal specialist), can help you decide.
For the first 24 hours, don't rinse, spit forcefully or drink through a straw, and avoid smoking and strenuous exercise, so the blood clot stays in place.
The gum usually closes over within a few weeks, while the bone underneath takes a few months to fill in.`,
    references: [
      { name: 'Cleveland Clinic: Tooth extraction', url: 'https://my.clevelandclinic.org/health/treatments/22120-tooth-extraction' },
      { name: 'Mayo Clinic: Dry socket', url: 'https://www.mayoclinic.org/diseases-conditions/dry-socket/symptoms-causes/syc-20354376' },
    ],
  },
  {
    slug: 'wisdom-teeth',
    category: 'PROCEDURE',
    title: 'Wisdom teeth removal',
    service: 'Wisdom teeth removal',
    caseValue: 1500,
    priceUnit: 'per tooth',
    tags: ['wisdom teeth', 'wisdom tooth', 'third molar', 'impacted tooth', 'impacted wisdom tooth'],
    summary:
      'Wisdom teeth are the third molars that usually come through between the ages of 17 and 25. They are removed when they are impacted, cause pain or infection, damage neighbouring teeth, or can’t be kept clean.',
    body: `Not every wisdom tooth needs to come out; X-rays show whether there is room for them and whether they are causing problems.
Removal is done under local anaesthetic, often with sedation, and sometimes by an oral surgeon.
Swelling and jaw stiffness usually peak two to three days after surgery and settle within about 7 to 10 days, and most people are back to normal in about a week.
Eat soft foods, avoid straws and smoking, and follow the extraction aftercare instructions.
Pain that gets worse after a few days instead of better can be a sign of dry socket, so call the practice.
Ice packs on the cheek in the first day, about 20 minutes on and 20 minutes off, and sleeping with your head raised help limit swelling.
Swelling that gets worse after the third day, fever or pus can mean an infection, so call the practice.
Wisdom teeth that are healthy, fully grown in and easy to clean can often be left in place and simply monitored.`,
    references: [
      { name: 'Cleveland Clinic: Wisdom teeth removal', url: 'https://my.clevelandclinic.org/health/treatments/22119-wisdom-teeth-removal' },
      { name: 'Mayo Clinic: Wisdom tooth removal', url: 'https://www.mayoclinic.org/tests-procedures/wisdom-tooth-extraction/about/pac-20395268' },
    ],
  },
  {
    slug: 'fillings',
    category: 'PROCEDURE',
    title: 'Fillings',
    service: 'Fillings',
    caseValue: 250,
    priceUnit: 'per filling',
    tags: ['filling', 'fillings', 'cavity', 'cavities', 'tooth decay', 'decay', 'hole in my tooth', 'composite filling', 'white filling'],
    summary:
      'A filling repairs a tooth damaged by decay: the decay is removed and the tooth is restored, most often with tooth-coloured composite resin.',
    body: `Small cavities often cause no symptoms, which is why regular check-ups and X-rays matter.
Larger cavities can cause sensitivity to sweets, heat or cold, or pain when biting.
Fillings are usually done in a single visit under local anaesthetic, which numbs the tooth so you feel pressure but not pain.
Fillings don't last forever: tooth-coloured composite fillings often last around 7 to 10 years and silver (amalgam) fillings around 15 years, depending on their size and how well the teeth are cared for.
The numbness wears off within a few hours; avoid chewing on that side and hot drinks until it does.
Mild sensitivity to cold or pressure for a week or two is normal; if it hasn't settled after a few weeks, or your bite feels high or the tooth hurts when you bite, the dentist should check it and adjust the filling if needed.
Very large cavities may need an inlay, onlay or crown instead of a filling.
Fillings can be tooth-coloured composite, silver amalgam, glass ionomer, porcelain or gold, and the dentist recommends a material based on the size and position of the cavity.
The FDA does not recommend removing amalgam fillings that are in good condition with no decay underneath.`,
    references: [
      { name: 'Cleveland Clinic: Dental fillings', url: 'https://my.clevelandclinic.org/health/treatments/17002-dental-fillings' },
      { name: 'U.S. FDA: Dental amalgam fillings', url: 'https://www.fda.gov/medical-devices/dental-amalgam-fillings/information-patients-about-dental-amalgam-fillings' },
    ],
  },
  {
    slug: 'checkup-and-cleaning',
    category: 'PROCEDURE',
    title: 'Check-ups and cleanings',
    service: 'Check-up and cleaning',
    caseValue: 250,
    priceUnit: 'per visit without insurance',
    tags: ['cleaning', 'teeth cleaning', 'check up', 'checkup', 'exam', 'dental exam', 'hygiene', 'hygienist', 'scale and polish', 'routine visit', 'tartar', 'plaque'],
    summary:
      'A routine check-up and professional cleaning keeps teeth and gums healthy and catches problems early, when they are simpler to treat. Most people benefit from a check-up and cleaning about every six months.',
    body: `The hygienist removes plaque and hardened tartar that brushing can't remove, then polishes the teeth.
A routine cleaning usually takes about 30 to 60 minutes, and a full check-up with X-rays may take a little longer.
Cleanings are not usually painful, although you may hear scraping sounds; tell the hygienist if anything feels sensitive and they can adjust or numb the area.
The dentist checks for decay, gum disease, worn or cracked teeth and signs of oral cancer, and goes over any concerns.
X-rays are taken when needed to see between the teeth and below the gum line, and modern digital X-rays use a very low dose of radiation.
People with gum disease, diabetes, frequent cavities or who smoke may need visits more often.
New patients usually start with a comprehensive exam, which takes a little longer.
Teeth or gums can feel a little tender or sensitive for a day or two after a cleaning.
Depending on how healthy your teeth and gums are, the dentist may suggest check-ups as often as every 3 months or as far apart as every 1 to 2 years.
A deep cleaning (scaling and root planing) is different from a routine cleaning: it treats gum disease below the gum line, often over one or two visits with numbing.`,
    references: [
      { name: 'Cleveland Clinic: Dental check-ups and cleanings', url: 'https://my.clevelandclinic.org/health/treatments/11187-dental-check-up' },
      { name: 'NHS: Dental check-ups', url: 'https://www.nhs.uk/live-well/healthy-teeth-and-gums/dental-check-ups/' },
      { name: 'NICE: How often should I come back for a check-up?', url: 'https://www.nice.org.uk/guidance/cg19/ifp/chapter/how-often-should-i-come-back-for-a-check-up' },
    ],
  },

  {
    slug: 'inlays-and-onlays',
    category: 'PROCEDURE',
    title: 'Inlays and onlays',
    service: 'Inlays and onlays',
    caseValue: 1000,
    priceUnit: 'per tooth',
    tags: ['inlay', 'inlays', 'onlay', 'onlays', 'partial crown', 'too big for a filling'],
    summary:
      'Inlays and onlays are custom-made restorations, usually porcelain or composite, that repair a back tooth too damaged for a filling but healthy enough not to need a full crown.',
    body: `An inlay fits within the cusps (points) of the tooth, while an onlay also covers one or more cusps.
Because they replace only the damaged part, they keep more of the natural tooth than a crown.
They usually take two visits: one to prepare and scan the tooth, and one to bond the final restoration.
With good care, inlays and onlays commonly last 10 years or more, and gold inlays are considered the most durable, often lasting 20 years or longer.`,
    references: [
      { name: 'Cleveland Clinic: Dental fillings', url: 'https://my.clevelandclinic.org/health/treatments/17002-dental-fillings' },
      { name: 'American Dental Association (MouthHealthy): Gold inlays', url: 'https://www.mouthhealthy.org/all-topics-a-z/fillings-gold-inlays' },
    ],
  },
  {
    slug: 'bone-grafts',
    category: 'PROCEDURE',
    title: 'Dental bone grafts',
    tags: ['bone graft', 'bone grafting', 'sinus lift', 'socket preservation', 'not enough bone', 'bone loss'],
    summary:
      'A dental bone graft rebuilds jawbone that has been lost, often so an implant can be placed securely. The graft material acts as a scaffold that your own bone gradually grows into.',
    body: `Bone can be lost after a tooth is removed, through gum disease or because of an injury.
Graft material may come from your own body, a donor, an animal source or a synthetic material.
A socket graft placed at the time of an extraction helps preserve bone for a future implant.
The first stage of healing takes about a week, but the graft usually needs several months, often 4 to 9 and up to a year, to mature before an implant can be placed.
Mild swelling and soreness for a few days afterwards are normal.
A sinus lift adds bone under the sinus above the upper back teeth when there isn't enough height there for an implant.
Once the graft has healed, the implant is usually placed within the following months, before the new bone starts to shrink.`,
    references: [
      { name: 'Cleveland Clinic: Dental bone graft', url: 'https://my.clevelandclinic.org/health/treatments/21727-dental-bone-graft' },
      { name: 'American Association of Oral and Maxillofacial Surgeons: Sinus augmentation', url: 'https://myoms.org/what-we-do/dental-implant-surgery/sinus-augmentation-preparing-sinuses-for-dental-implants/' },
      { name: 'Cambridge University Hospitals (NHS): Sinus lift procedures', url: 'https://www.cuh.nhs.uk/patient-information/sinus-lift-procedures/' },
    ],
  },
  {
    slug: 'dental-sealants',
    category: 'PROCEDURE',
    title: 'Dental sealants',
    service: 'Sealants',
    caseValue: 60,
    priceUnit: 'per tooth',
    tags: ['sealant', 'sealants', 'dental sealants', 'tooth sealant', 'fissure sealant', 'protective coating', 'coating on back teeth'],
    summary:
      'Sealants are thin protective coatings painted onto the chewing surfaces of the back teeth, where most cavities in children and teens start. Placing them is quick and painless, with no drilling or numbing.',
    body: `The tooth is cleaned and dried, then the sealant is painted into the grooves and hardened with a special light, which takes only a few minutes per tooth.
Sealants prevent about 80% of cavities in the back teeth for two years and keep protecting against about half of cavities for up to four years.
They usually last several years, and the dentist checks them at check-ups and repairs or reapplies them when needed.
They work best when placed soon after the permanent molars come in, at around ages 6 and 12.
Adults can have sealants too, on back teeth that have no decay or fillings.
Sealants don't replace brushing, cleaning between the teeth and fluoride.`,
    references: [
      { name: 'CDC: About dental sealants', url: 'https://www.cdc.gov/oral-health/prevention/about-dental-sealants.html' },
      { name: 'Cleveland Clinic: Dental sealants', url: 'https://my.clevelandclinic.org/health/treatments/10912-sealants' },
      { name: 'American Dental Association (MouthHealthy): Sealants', url: 'https://www.mouthhealthy.org/all-topics-a-z/sealants' },
    ],
  },
  {
    slug: 'deep-cleaning',
    category: 'PROCEDURE',
    title: 'Deep cleaning for gum disease',
    tags: ['deep cleaning', 'deep clean', 'scaling and root planing', 'srp', 'periodontal cleaning', 'gum cleaning', 'cleaning below the gums', 'gum pockets'],
    summary:
      'A deep cleaning, or scaling and root planing, treats gum disease by removing plaque and tartar from the tooth roots below the gum line and smoothing the roots so the gums can heal and reattach.',
    body: `It is needed when gum disease has formed pockets around the teeth deeper than a routine cleaning can reach, which the hygienist measures with a small probe.
Without treatment, gum disease can get worse, damaging the bone that holds the teeth and loosening them.
Unlike a routine cleaning, which cleans above the gum line, a deep cleaning treats the roots below it.
It usually takes one to two hours and may be split into two visits, often one side of the mouth at a time, with local anaesthetic to keep you comfortable.
Afterwards the gums may be sore for a day or two and the teeth can be sensitive for up to a week.
Follow-up maintenance cleanings, often every three to four months, help keep gum disease under control.`,
    references: [
      { name: 'Cleveland Clinic: Scaling and root planing', url: 'https://my.clevelandclinic.org/health/treatments/23983-tooth-scaling-and-root-planing' },
      { name: 'American Dental Association (MouthHealthy): Scaling and root planing', url: 'https://www.mouthhealthy.org/all-topics-a-z/scaling-and-root-planing' },
    ],
  },
  {
    slug: 'gum-contouring',
    category: 'PROCEDURE',
    title: 'Gum contouring (gummy smile treatment)',
    service: 'Gum contouring',
    caseValue: 1000,
    priceUnit: 'per treatment',
    tags: ['gum contouring', 'gummy smile', 'gum reshaping', 'gum lift', 'crown lengthening', 'uneven gums', 'gum laser', 'gingivectomy', 'too much gum'],
    summary:
      'Gum contouring reshapes an uneven or "gummy" gum line by removing or repositioning gum tissue, so the teeth look longer and more even.',
    body: `It is usually done with a laser or a scalpel under local anaesthetic.
Crown lengthening reshapes the gum and sometimes the bone to expose more of a tooth, for a more even smile or to leave enough tooth for a crown.
Most people are back at work or school within one to two days, and the gums usually heal in about a week.
Eat soft foods and avoid hard or spicy foods for about a week while the gums heal.
The results are usually permanent.`,
    references: [
      { name: 'Cleveland Clinic: Gum contouring', url: 'https://my.clevelandclinic.org/health/treatments/25208-gum-contouring' },
      { name: 'American Academy of Periodontology: Cosmetic procedures', url: 'https://www.perio.org/for-patients/periodontal-treatments-and-procedures/cosmetic-procedures/' },
    ],
  },

  // ---------------------------------------------------------------- conditions
  {
    slug: 'missing-teeth-options',
    category: 'CONDITION',
    title: 'Options for replacing missing teeth',
    tags: ['missing tooth', 'missing teeth', 'replace missing teeth', 'lost teeth', 'gap where a tooth was', 'tooth replacement options'],
    summary:
      'A missing tooth can be replaced with a dental implant, a bridge or a removable denture. The best choice depends on how many teeth are missing, the health of the neighbouring teeth and bone, and your budget.',
    body: `An implant replaces the root and the tooth, doesn't involve the neighbouring teeth and can last for decades, but takes several months and costs more up front.
A bridge is fixed in place and is usually quicker, but the teeth on either side of the gap are shaped to hold it.
A partial or full denture is the most affordable option and is removable, but it can feel less secure than fixed options.
Replacing a missing tooth helps keep the neighbouring teeth from drifting and protects your bite.
A consultation with an exam and X-rays shows which options suit you.`,
    references: [
      { name: 'Cleveland Clinic: Dental implants', url: 'https://my.clevelandclinic.org/health/treatments/10903-dental-implants' },
      { name: 'Cleveland Clinic: Dental bridges', url: 'https://my.clevelandclinic.org/health/treatments/10921-dental-bridges' },
      { name: 'Cleveland Clinic: Dentures', url: 'https://my.clevelandclinic.org/health/treatments/10900-dentures' },
    ],
  },
  {
    slug: 'gaps-between-teeth',
    category: 'CONDITION',
    title: 'Gaps between teeth',
    tags: ['gap between teeth', 'gap between my front teeth', 'gaps in my teeth', 'space between teeth', 'diastema', 'close a gap'],
    summary:
      'A gap between teeth (a diastema) can be closed with cosmetic bonding, porcelain veneers or orthodontic treatment such as clear aligners, depending on its size and cause.',
    body: `Small gaps can often be closed in a single visit with tooth-coloured bonding.
Veneers can close gaps while also changing the shape or colour of the teeth.
Clear aligners or braces move the teeth themselves and suit gaps that are part of wider spacing or bite issues.
Gaps can sometimes be caused by gum disease or a missing tooth, so an exam comes first.`,
    references: [
      { name: 'Cleveland Clinic: Dental bonding', url: 'https://my.clevelandclinic.org/health/treatments/10922-dental-bonding' },
      { name: 'Cleveland Clinic: Dental veneers', url: 'https://my.clevelandclinic.org/health/treatments/23522-dental-veneers' },
      { name: 'American Association of Orthodontists: Clear aligners', url: 'https://aaoinfo.org/treatments/aligners/' },
    ],
  },
  {
    slug: 'gum-disease',
    category: 'CONDITION',
    title: 'Gum disease (gingivitis and periodontitis)',
    service: 'Gum disease treatment',
    caseValue: 1200,
    priceUnit: 'for a full-mouth deep cleaning',
    tags: ['gum disease', 'gingivitis', 'periodontitis', 'periodontal', 'bleeding gums', 'swollen gums', 'receding gums', 'gum recession', 'deep cleaning', 'scaling and root planing', 'loose teeth'],
    summary:
      'Gum disease is an infection of the tissues that hold teeth in place. Its early stage, gingivitis, causes red, swollen gums that bleed when brushing and is reversible; left untreated it can become periodontitis, which damages bone and can loosen teeth.',
    body: `Warning signs include bleeding when brushing or flossing, red or puffy gums, persistent bad breath, gums pulling away from the teeth, and loose or shifting teeth.
Gingivitis usually improves with a professional cleaning and better daily brushing and flossing.
Periodontitis is treated with a deep cleaning called scaling and root planing, which cleans below the gum line, followed by maintenance cleanings, often every three to four months.
Smoking, diabetes, some medications, pregnancy and genetics increase the risk.
Gum disease is common and often painless, so regular check-ups are the best way to catch it early.
Gum disease is very common: about 4 in 10 adults in the U.S. aged 30 and over have periodontitis.
A deep cleaning is usually done with numbing, often over one or two visits; the gums can be sore for a day or two and teeth sensitive for up to a week afterwards.
Advanced periodontitis may need gum surgery or a referral to a periodontist (gum specialist).`,
    references: [
      { name: 'NIH National Institute of Dental and Craniofacial Research: Gum disease', url: 'https://www.nidcr.nih.gov/health-info/gum-disease' },
      { name: 'NIDCR: Periodontal disease in adults (statistics)', url: 'https://www.nidcr.nih.gov/research/data-statistics/periodontal-disease/adults' },
      { name: 'Cleveland Clinic: Scaling and root planing', url: 'https://my.clevelandclinic.org/health/treatments/23983-tooth-scaling-and-root-planing' },
    ],
  },
  {
    slug: 'tooth-sensitivity',
    category: 'CONDITION',
    title: 'Sensitive teeth',
    tags: ['sensitive teeth', 'tooth sensitivity', 'sensitivity', 'cold sensitivity', 'sensitive to cold', 'sensitive to hot', 'sharp pain', 'zingers'],
    summary:
      'Tooth sensitivity is a short, sharp pain when teeth meet cold, heat, sweet or acidic foods, or cold air. It usually happens when enamel wears or gums recede and expose the softer layer underneath.',
    body: `Common causes include brushing too hard, gum recession, grinding, acidic foods and drinks, a cracked tooth, a cavity or a worn filling, and temporarily after whitening or dental work.
A desensitising toothpaste used twice a day, a soft toothbrush and gentle brushing often help within a few weeks.
Sensitivity that lingers, gets worse, or affects just one tooth should be checked, because it can be a sign of decay or a crack.
The dentist can apply fluoride varnish or bonding, or treat the underlying cause.
Desensitising toothpaste works gradually, so use it every time you brush for a few weeks before judging whether it helps.
Persistent sensitivity from exposed roots can sometimes be treated with a gum graft, and sensitivity from an inflamed nerve may need root canal treatment.`,
    references: [
      { name: 'Cleveland Clinic: Sensitive teeth', url: 'https://my.clevelandclinic.org/health/symptoms/10954-teeth-sensitivity' },
    ],
  },
  {
    slug: 'teeth-grinding',
    category: 'CONDITION',
    title: 'Teeth grinding, night guards and jaw pain',
    service: 'Night guard',
    caseValue: 500,
    priceUnit: 'per guard',
    tags: ['grinding', 'teeth grinding', 'clenching', 'bruxism', 'night guard', 'mouth guard', 'mouthguard', 'tmj', 'tmd', 'jaw pain', 'jaw clicking', 'morning headaches'],
    summary:
      'Teeth grinding or clenching (bruxism) often happens during sleep. It can wear and crack teeth and cause jaw pain or morning headaches, and a custom night guard protects the teeth.',
    body: `Signs include flattened or chipped teeth, sensitive teeth, a sore jaw or face in the morning, headaches, and a partner hearing grinding at night.
A custom night guard is made from a scan or impressions and is more comfortable and durable than a shop-bought one.
Stress, caffeine, alcohol and some sleep problems can make grinding worse.
Grinding is common in children and often stops on its own as the adult teeth come in, but the dentist checks for wear at their visits.
Jaw joint (TMJ) problems such as clicking, locking or pain when chewing should be assessed by the dentist.
Grinding during sleep is linked with other sleep problems such as snoring and sleep apnea, so mention it if you also snore.
Many people grind or clench only mildly and need no treatment; a guard is recommended when it causes wear, pain or headaches.
Jaw (TMJ) pain often improves on its own or with self-care: soft foods, warm or cold packs, gentle jaw massage, avoiding gum and wide yawns, and over-the-counter pain relief.
Surgery for jaw joint problems is a last resort after these simpler treatments.`,
    references: [
      { name: 'Mayo Clinic: Teeth grinding (bruxism)', url: 'https://www.mayoclinic.org/diseases-conditions/bruxism/symptoms-causes/syc-20356095' },
      { name: 'NHS: Teeth grinding', url: 'https://www.nhs.uk/symptoms/teeth-grinding/' },
      { name: 'NIDCR: TMD (temporomandibular disorders)', url: 'https://www.nidcr.nih.gov/health-info/tmd' },
      { name: 'NHS: Temporomandibular disorder', url: 'https://www.nhs.uk/conditions/temporomandibular-disorder-tmd/' },
    ],
  },
  {
    slug: 'bad-breath',
    category: 'CONDITION',
    title: 'Bad breath',
    tags: ['bad breath', 'halitosis', 'smelly breath', 'breath odor', 'breath odour', 'dry mouth'],
    summary:
      'Most bad breath (halitosis) comes from bacteria in the mouth, especially on the tongue and between the teeth, and good daily cleaning plus treating any gum disease usually fixes it.',
    body: `Brush twice a day, clean between the teeth daily and clean your tongue once a day with a scraper or your toothbrush.
Dry mouth, smoking, some foods, gum disease, cavities and poorly fitting dentures can all contribute.
Drinking water and chewing sugar-free gum help by increasing saliva.
If bad breath continues despite good cleaning, a check-up can find or rule out dental causes, and occasionally it is linked to sinus, throat or medical issues that a doctor should check.
Most mouthwashes only mask the smell for a while; cleaning away the bacteria is what fixes it.
Sugar-free gum or mints can help after strong-smelling foods such as garlic, onions or coffee.`,
    references: [
      { name: 'NHS: Bad breath', url: 'https://www.nhs.uk/symptoms/bad-breath/' },
      { name: 'Cleveland Clinic: Bad breath (halitosis)', url: 'https://my.clevelandclinic.org/health/diseases/17771-bad-breath-halitosis' },
    ],
  },

  {
    slug: 'receding-gums',
    category: 'CONDITION',
    title: 'Receding gums',
    tags: ['receding gums', 'gum recession', 'gums pulling back', 'gums grow back', 'exposed roots', 'teeth look longer', 'gum graft', 'gums shrinking'],
    summary:
      'Receding gums pull back from the teeth and expose the roots. Gum tissue that has receded does not grow back on its own, but treatment can stop it getting worse and, if needed, a gum graft can cover exposed roots.',
    body: `Common causes include gum disease, brushing too hard, grinding, smoking, a misaligned bite and genetics.
Exposed roots can feel sensitive to cold and are more prone to decay.
Mild recession is managed by treating gum disease, switching to a soft toothbrush and gentle brushing, and using a desensitising toothpaste.
A gum graft moves tissue from the roof of the mouth, or uses donor material, to cover exposed roots, and recovery usually takes one to two weeks.
Regular check-ups let the dentist measure the gums and catch recession early.
Some people inherit thin gum tissue, and orthodontic treatment can also make recession more likely.`,
    references: [
      { name: 'Cleveland Clinic: Gum recession', url: 'https://my.clevelandclinic.org/health/diseases/22753-gum-recession' },
      { name: 'Cleveland Clinic: Gum graft surgery', url: 'https://my.clevelandclinic.org/health/treatments/23504-gum-graft-surgery' },
    ],
  },
  {
    slug: 'cracked-tooth',
    category: 'CONDITION',
    title: 'Cracked tooth',
    tags: ['cracked tooth', 'crack in my tooth', 'cracked molar', 'split tooth', 'cracked tooth syndrome', 'pain when biting', 'hairline crack'],
    summary:
      'A crack in a tooth does not heal on its own the way a broken bone does, and it can spread over time, so it should be checked by the dentist promptly.',
    body: `Signs include sharp pain when biting or releasing a bite, pain that comes and goes, and sensitivity to hot, cold or sweet foods.
Small cracks can often be repaired with bonding, and many cracked back teeth are protected with a crown to stop the crack spreading.
If the crack reaches the nerve, root canal treatment may be needed before the crown.
A tooth that has split down into the root usually can't be saved and may need to be removed.
The sooner a cracked tooth is treated, the better the chance of keeping it.
Until your visit, avoid chewing on that side and avoid very hot, cold or hard foods.
Craze lines, tiny cracks only in the outer enamel, are common and painless and are only a cosmetic concern.
Many cracked teeth need a crown to hold the tooth together, but not all need root canal treatment.
Don't put aspirin or numbing gel on the tooth or gum; if biting or cold air hurts, biting gently on clean, damp gauze can help until you're seen.`,
    references: [
      { name: 'American Association of Endodontists: Cracked teeth', url: 'https://www.aae.org/patients/dental-symptoms/cracked-teeth/' },
      { name: 'Cleveland Clinic: Cracked tooth', url: 'https://my.clevelandclinic.org/health/diseases/21628-fractured-tooth-cracked-tooth' },
    ],
  },
  {
    slug: 'dry-mouth',
    category: 'CONDITION',
    title: 'Dry mouth',
    tags: ['dry mouth', 'xerostomia', 'not enough saliva', 'mouth feels dry', 'sticky mouth', 'thirsty mouth'],
    summary:
      'Dry mouth means the mouth is not making enough saliva. Saliva protects the teeth, so a dry mouth raises the risk of decay, gum problems and bad breath.',
    body: `The most common cause is medication, including some antihistamines, decongestants, blood pressure medicines and antidepressants.
Other causes include dehydration, breathing through the mouth, diabetes, Sjogren's syndrome and radiation treatment to the head and neck.
Sipping water often, chewing sugar-free gum and limiting caffeine and alcohol can help.
The dentist may recommend fluoride toothpaste or gels, saliva substitutes and more frequent check-ups to protect the teeth.
Tell your doctor about a dry mouth, especially if it started after a new medicine.
Many prescription and over-the-counter medicines can cause dry mouth, so a doctor may be able to adjust the dose or suggest an alternative.
A humidifier at night helps if you breathe through your mouth while you sleep.
For severe dry mouth, a doctor or dentist can recommend saliva substitutes or prescribe medicine that stimulates saliva.`,
    references: [
      { name: 'Cleveland Clinic: Dry mouth', url: 'https://my.clevelandclinic.org/health/diseases/10902-dry-mouth-xerostomia' },
      { name: 'NIDCR: Dry mouth', url: 'https://www.nidcr.nih.gov/health-info/dry-mouth' },
    ],
  },
  {
    slug: 'mouth-sores-and-oral-cancer',
    category: 'CONDITION',
    title: 'Mouth sores, patches and oral cancer checks',
    tags: ['mouth ulcer', 'canker sore', 'sore in my mouth', 'white patch', 'red patch', 'oral cancer', 'mouth cancer', 'lump in my mouth', 'oral cancer screening', 'sore that will not heal'],
    summary:
      'Most mouth ulcers and canker sores are harmless and heal within one to two weeks. A sore, lump, or red or white patch that lasts longer than two to three weeks should be checked by a dentist or doctor.',
    body: `Canker sores are small, painful ulcers, usually white or yellow with a red border, and they are not contagious.
Warning signs that need an exam include a sore that won't heal, a lump or thickening, red or white patches, numbness, or difficulty swallowing.
Tobacco, heavy alcohol use and HPV infection increase the risk of oral cancer.
The dentist checks the lips, tongue, cheeks and throat for anything unusual at every routine check-up.
These signs often have other causes, but early checks matter because problems found early are easier to treat.
Larger canker sores can take up to six weeks to heal.
See a dentist or doctor sooner if a sore is unusually large, keeps coming back, makes it hard to eat or drink, or comes with a fever.
Cold sores are different: they are caused by a virus, appear on or around the lips and are contagious.`,
    references: [
      { name: 'Mayo Clinic: Canker sore', url: 'https://www.mayoclinic.org/diseases-conditions/canker-sore/symptoms-causes/syc-20370615' },
      { name: 'Cleveland Clinic: Canker sores', url: 'https://my.clevelandclinic.org/health/diseases/10945-canker-sores' },
      { name: 'NHS: Symptoms of mouth cancer', url: 'https://www.nhs.uk/conditions/mouth-cancer/symptoms/' },
    ],
  },
  {
    slug: 'tooth-decay',
    category: 'CONDITION',
    title: 'Tooth decay and cavities',
    tags: ['tooth decay', 'how cavities form', 'what causes cavities', 'caries', 'black spot on tooth', 'brown spot on tooth', 'prevent cavities'],
    summary:
      'Tooth decay happens when bacteria in plaque turn sugars into acid that dissolves tooth enamel. Very early decay can be reversed with fluoride, but once a hole (a cavity) forms, it needs a filling.',
    body: `Plaque is a sticky film of bacteria that forms on teeth every day.
Frequent sugary snacks and drinks give the bacteria more chances to make acid.
Saliva and fluoride help enamel repair itself between meals, which is why early white spots can sometimes harden again.
Early decay often has no symptoms, so check-ups and X-rays find it before it hurts.
Brushing twice a day with fluoride toothpaste, cleaning between the teeth and cutting down on sugary snacks are the best protection.
Sealants on the chewing surfaces of back teeth prevent about 80% of cavities there for two years and keep protecting for years after, especially in children.
Fluoride varnish painted on children's teeth reduces cavities in baby teeth by about a third.
Drinking fluoridated tap water also helps prevent cavities.`,
    references: [
      { name: 'CDC: About cavities (tooth decay)', url: 'https://www.cdc.gov/oral-health/about/cavities-tooth-decay.html' },
      { name: 'CDC: Oral health tips for children', url: 'https://www.cdc.gov/oral-health/prevention/oral-health-tips-for-children.html' },
    ],
  },
  {
    slug: 'tooth-discoloration',
    category: 'CONDITION',
    title: 'Stained and discoloured teeth',
    tags: ['stained teeth', 'discolored teeth', 'discoloured teeth', 'brown stains', 'grey tooth', 'gray tooth', 'dark tooth', 'white spots on teeth', 'why are my teeth yellow'],
    summary:
      'Teeth can stain on the surface from coffee, tea, red wine and tobacco, or darken from within because of ageing, injury or certain medicines. Surface stains can often be removed with a professional cleaning or whitening, while deeper discolouration can be covered with bonding or veneers.',
    body: `Teeth naturally become a little more yellow with age as the enamel thins.
A single tooth that turns grey or dark after a knock can mean the nerve has been damaged, so it should be checked.
Some antibiotics taken in childhood, such as tetracycline, can cause stains inside the teeth that whitening may not fully remove.
White spots can be early decay or marks left from braces, and the dentist can tell which.
Cutting down on staining drinks and not smoking help keep teeth brighter.`,
    references: [
      { name: 'Cleveland Clinic: Tooth discoloration', url: 'https://my.clevelandclinic.org/health/symptoms/10958-tooth-discoloration' },
    ],
  },
  {
    slug: 'tooth-erosion',
    category: 'CONDITION',
    title: 'Enamel erosion',
    tags: ['enamel erosion', 'acid erosion', 'worn enamel', 'thin enamel', 'soda', 'energy drinks', 'acid reflux teeth', 'teeth look see-through'],
    summary:
      'Enamel erosion is the loss of the tooth surface caused by acid, most often from acidic drinks and foods or stomach acid. Lost enamel does not grow back, so preventing further wear is important.',
    body: `Fizzy drinks, energy drinks, sports drinks, fruit juices and citrus are common causes, especially when sipped throughout the day.
Acid reflux and frequent vomiting can also wear enamel, so tell your doctor if you have them.
Signs include sensitivity, yellowing as the darker layer shows through, and edges that look thin or see-through.
Drinking acidic drinks with meals, using a straw and rinsing with water afterwards reduce the damage.
Wait about an hour after acidic food or drink before brushing, because softened enamel wears more easily.
The dentist can protect worn teeth with fluoride, bonding or, in more severe cases, crowns or veneers.
Rinsing with water, or having milk or cheese, after acidic food or drink helps neutralise the acid.
After vomiting, swish plain water around your mouth and wait a while before cleaning your teeth.`,
    references: [
      { name: 'American Dental Association (MouthHealthy): Dietary acids and your teeth', url: 'https://www.mouthhealthy.org/all-topics-a-z/dietary-acids-and-your-teeth' },
      { name: 'American Dental Association: Dental erosion', url: 'https://www.ada.org/resources/ada-library/oral-health-topics/dental-erosion' },
      { name: 'Cleveland Clinic: Tooth erosion', url: 'https://my.clevelandclinic.org/health/diseases/tooth-erosion' },
    ],
  },
  {
    slug: 'sinus-toothache',
    category: 'CONDITION',
    title: 'Toothache from a sinus infection',
    tags: ['sinus', 'sinus infection', 'sinus pressure', 'sinusitis', 'sinus toothache', 'upper teeth hurt', 'teeth hurt when i have a cold', 'cold and toothache'],
    summary:
      'A sinus infection can make the upper back teeth ache, because their roots sit right next to the sinuses. Pain across several upper teeth together with a blocked nose, facial pressure or a recent cold often points to the sinuses.',
    body: `Pain in a single tooth, sensitivity to hot, cold or sweet things, swelling, or pain when biting points more to a dental problem such as decay or an abscess.
See the dentist first; if no dental cause is found, see your doctor about the sinuses.
An infection in an upper back tooth can occasionally spread into the sinus, which is another reason to have the pain checked.`,
    references: [
      { name: 'Mayo Clinic: Sinus infection and toothache', url: 'https://www.mayoclinic.org/diseases-conditions/acute-sinusitis/expert-answers/toothache/faq-20058299' },
      { name: 'Cleveland Clinic: Sinus pressure', url: 'https://my.clevelandclinic.org/health/symptoms/24690-sinus-pressure' },
    ],
  },

  // ---------------------------------------------------------------- general FAQ
  {
    slug: 'dental-anxiety-and-sedation',
    category: 'FAQ',
    title: 'Dental anxiety and sedation',
    service: 'Sedation dentistry',
    tags: ['anxiety', 'dental anxiety', 'nervous', 'scared', 'afraid', 'fear of the dentist', 'phobia', 'sedation', 'laughing gas', 'nitrous oxide', 'sleep dentistry', 'painless'],
    summary:
      'Feeling nervous about the dentist is very common. Tell the team, and they can go at your pace, explain each step, agree a stop signal and, where appropriate, offer sedation.',
    body: `Numbing with local anaesthetic is used for any treatment that could be painful.
Nitrous oxide (laughing gas) is breathed through a small nose mask, helps you relax and wears off within minutes after the appointment.
Nitrous oxide is also widely used for children and is considered safe when given by a trained dental team, although it may not suit very young children or people with certain breathing problems.
If needles worry you, a numbing gel is usually applied first so the injection feels like little more than a pinch.
If you have a strong gag reflex, tell the team: breathing through your nose, short breaks, a smaller X-ray sensor and sedation can all help.
Oral sedation is a prescribed tablet taken before the visit that leaves you feeling drowsy.
Some practices offer IV sedation for longer or more involved procedures.
Which sedation is suitable depends on your medical history and medications, which are reviewed beforehand.
After local anaesthetic alone you can usually drive yourself home, but after oral or IV sedation you need someone to drive you.`,
    references: [
      { name: 'Cleveland Clinic: Sedation dentistry', url: 'https://my.clevelandclinic.org/health/treatments/22275-sedation-dentistry' },
    ],
  },
  {
    slug: 'childrens-dentistry',
    category: 'FAQ',
    title: "Children's dentistry",
    service: "Children's check-up",
    caseValue: 200,
    tags: ['children', 'kids', 'child', 'baby teeth', 'toddler', 'pediatric', 'paediatric', 'my son', 'my daughter', 'first dental visit', 'sealants', 'fluoride varnish'],
    summary:
      'Children should first see a dentist by their first birthday or within six months of their first tooth appearing, then about every six months.',
    body: `Early visits are short and gentle: they check how the teeth are developing, look for early decay and help children feel comfortable at the dentist.
Fluoride varnish and sealants (protective coatings on the chewing surfaces of back teeth) help prevent cavities.
Brush children's teeth twice a day with fluoride toothpaste: a smear the size of a grain of rice under age 3, and a pea-sized amount from age 3 to 6.
Avoid putting a baby to bed with a bottle of milk or juice, which can cause decay.
Baby teeth matter: they hold space for adult teeth and help with chewing and speech.
Most children stop sucking their thumb or a pacifier between ages 2 and 4; if the habit continues once adult teeth come in, it can affect how the teeth line up.
Help or supervise children while they brush until they can reliably spit out the toothpaste.
Sealants work best when placed soon after the permanent back teeth come in, at around ages 6 and 12.`,
    references: [
      { name: 'American Academy of Pediatrics (HealthyChildren.org): Oral health', url: 'https://www.healthychildren.org/English/healthy-living/oral-health/Pages/Brushing-Up-on-Oral-Health-Never-Too-Early-to-Start.aspx' },
      { name: 'American Dental Association (MouthHealthy): Healthy habits for babies and kids', url: 'https://www.mouthhealthy.org/life-stages/babies-and-kids/healthy-habits-babies-and-kids' },
      { name: 'CDC: Oral health tips for children', url: 'https://www.cdc.gov/oral-health/prevention/oral-health-tips-for-children.html' },
    ],
  },
  {
    slug: 'pregnancy-and-dental-care',
    category: 'FAQ',
    title: 'Dental care during pregnancy',
    tags: ['pregnant', 'pregnancy', 'expecting', 'breastfeeding', 'pregnancy gingivitis'],
    summary:
      'Routine dental care, including check-ups, cleanings and needed treatment such as fillings, is considered safe and is recommended during pregnancy. Let the team know you are pregnant.',
    body: `Pregnancy hormones make gums more likely to swell and bleed, so regular cleanings are especially helpful.
The second trimester is often the most comfortable time for non-urgent treatment.
Dental X-rays and local anaesthetic are considered safe at any stage of pregnancy when they are needed.
Elective cosmetic treatments such as whitening are usually postponed until after pregnancy.
After morning sickness, rinse with water or a fluoride mouthwash and wait about 30 minutes before brushing.
Needed treatment such as fillings, root canals or extractions should not be put off, because delaying it can lead to bigger problems.`,
    references: [
      { name: 'American Dental Association: Pregnancy', url: 'https://www.ada.org/resources/ada-library/oral-health-topics/pregnancy' },
      { name: 'American Dental Association (MouthHealthy): Pregnancy dental concerns', url: 'https://www.mouthhealthy.org/life-stages/pregnancy/pregnancy-dental-concerns' },
    ],
  },
  {
    slug: 'xray-safety',
    category: 'FAQ',
    title: 'Are dental X-rays safe?',
    tags: ['x-ray', 'xray', 'x rays', 'radiation', 'scan', 'cbct', '3d scan'],
    summary:
      'Dental X-rays use a very low dose of radiation and are only taken when the dentist needs them, for example to see decay between teeth, bone levels or problems below the gum line.',
    body: `Digital X-rays reduce the dose further compared with older film X-rays.
How often you need them depends on your risk of decay and gum disease; with healthy teeth and gums, many people need them only every 6 to 18 months or less often.
Let the team know if you are or might be pregnant.
A set of dental X-rays of the back teeth (bitewings) exposes you to about 0.005 mSv of radiation, less than one day of the natural background radiation everyone receives.
Cone-beam CT scans, which give a 3D image, involve a higher dose than standard X-rays, so they are taken only when needed, for example to plan implants.`,
    references: [
      { name: 'Cleveland Clinic: Dental X-rays', url: 'https://my.clevelandclinic.org/health/diagnostics/11199-dental-x-rays' },
      { name: 'RadiologyInfo (ACR/RSNA): Radiation dose', url: 'https://www.radiologyinfo.org/en/info/safety-xray' },
    ],
  },
  {
    slug: 'brushing-and-flossing',
    category: 'FAQ',
    title: 'Looking after your teeth at home',
    tags: ['brushing', 'flossing', 'toothpaste', 'fluoride', 'how to brush', 'oral hygiene', 'prevention', 'electric toothbrush', 'mouthwash', 'water flosser'],
    summary:
      'Brush twice a day for two minutes with fluoride toothpaste, clean between your teeth once a day, limit sugary snacks and drinks, and see the dentist regularly.',
    body: `Use a soft-bristled toothbrush and replace it every three to four months or when the bristles fray.
Spit out the toothpaste after brushing instead of rinsing, so the fluoride keeps working.
Brushing before breakfast is fine; if you brush after eating, wait about an hour, especially after acidic food or juice, because softened enamel wears more easily.
Floss, interdental brushes or a water flosser all clean between teeth, so use whichever you'll stick with every day.
Cleaning between your teeth is important because a toothbrush can't reach those gaps, where plaque builds up and cavities and gum disease often start.
Manual and electric toothbrushes both work well if you brush every surface for two minutes; an electric brush can make it easier for people with braces or limited dexterity.
Sugary and acidic snacks and drinks between meals increase the risk of decay and enamel erosion.
Not smoking lowers the risk of gum disease, tooth loss and oral cancer.
Gums may bleed a little when you first start cleaning between your teeth; this usually settles within a week or two as they get healthier, so keep going gently and see the dentist if it doesn't stop.`,
    references: [
      { name: 'American Dental Association: Toothbrushes', url: 'https://www.ada.org/resources/ada-library/oral-health-topics/toothbrushes' },
      { name: 'Cleveland Clinic: Oral hygiene', url: 'https://my.clevelandclinic.org/health/treatments/16914-oral-hygiene' },
      { name: 'American Dental Association (MouthHealthy): Bleeding gums', url: 'https://www.mouthhealthy.org/all-topics-a-z/bleeding-gums' },
    ],
  },
  {
    slug: 'first-visit',
    category: 'FAQ',
    title: 'What to expect at your first visit',
    tags: ['first visit', 'first appointment', 'new patient visit', 'what to bring', 'what to expect', 'paperwork', 'forms'],
    summary:
      'A first visit usually includes a review of your medical and dental history, a full exam, X-rays if needed, a cleaning if time allows, and time to talk about your goals and options.',
    body: `Bring photo ID, your insurance card if you have one, and a list of your medications.
Arriving 10 to 15 minutes early gives you time to complete any forms.
Let the team know about any dental anxiety, medical conditions or allergies before treatment starts.
You'll leave with a clear explanation of anything the dentist found and the options and costs for any treatment.`,
    references: [
      { name: 'American Dental Association (MouthHealthy): Common questions about going to the dentist', url: 'https://www.mouthhealthy.org/dental-care/questions-about-going-to-the-dentist/' },
    ],
  },
  {
    slug: 'smile-makeover',
    category: 'FAQ',
    title: 'Improving your smile',
    tags: ['hate my smile', 'improve my smile', 'smile makeover', 'fix my smile', 'unhappy with my smile', 'unhappy with my teeth', 'better smile', 'nicer smile', 'self-conscious about my teeth', 'embarrassed to smile', 'ugly teeth', 'nicer teeth', 'perfect smile', 'change my smile', 'dont like my teeth'],
    summary:
      'If you\'re unhappy with how your teeth look, there are options for almost every concern: whitening for colour, bonding or veneers for chips, gaps and shape, clear aligners or braces for crooked teeth, and implants, bridges or dentures for missing teeth.',
    body: `The best start is a consultation: the dentist looks at your teeth, gums and bite, asks what bothers you most, and suggests options with their costs.
Healthy teeth and gums come first, so any decay or gum disease is treated before cosmetic work.
Whitening only changes natural teeth, so it is usually done before bonding, veneers or crowns, which are then matched to the brighter shade.
Many people combine treatments in stages, starting with whatever matters most to them.`,
    references: [
      { name: 'Cleveland Clinic: Cosmetic dentistry', url: 'https://my.clevelandclinic.org/health/treatments/23914-cosmetic-dentistry' },
      { name: 'Cleveland Clinic: Dental veneers', url: 'https://my.clevelandclinic.org/health/treatments/23522-dental-veneers' },
      { name: 'NHS: Teeth whitening', url: 'https://www.nhs.uk/tests-and-treatments/teeth-whitening/' },
    ],
  },
  {
    slug: 'returning-after-years',
    category: 'FAQ',
    title: 'Coming back to the dentist after years away',
    tags: ['haven\'t been to the dentist in years', 'havent been to a dentist in years', 'not been to the dentist in years', 'embarrassed about my teeth', 'ashamed of my teeth', 'been a long time since the dentist', 'years since my last visit', 'neglected my teeth', 'avoided the dentist', 'not been in ages', 'bad teeth', 'my teeth are a mess', 'scared of what the dentist will say'],
    summary:
      'Many people put off the dentist for years, often because of cost, worry or a bad past experience, and dental teams are used to helping people get back on track. The first visit is about understanding where things stand.',
    body: `The first visit is usually a full exam with X-rays, time to talk about any worries, and a plan that starts with whatever is most urgent.
If a lot of tartar has built up, the cleaning may be spread over more than one visit, sometimes as a deep cleaning below the gums.
Treatment can often be done in stages, so the visits and the cost can be spread out.
If you feel nervous, tell the team so they can explain each step and go at your pace.`,
    references: [
      { name: 'American Dental Association (MouthHealthy): Common questions about going to the dentist', url: 'https://www.mouthhealthy.org/dental-care/questions-about-going-to-the-dentist/' },
      { name: 'Cleveland Clinic: Scaling and root planing', url: 'https://my.clevelandclinic.org/health/treatments/23983-tooth-scaling-and-root-planing' },
      { name: 'Cleveland Clinic: Sedation dentistry', url: 'https://my.clevelandclinic.org/health/treatments/22275-sedation-dentistry' },
    ],
  },

  {
    slug: 'fluoride',
    category: 'FAQ',
    title: 'Fluoride',
    tags: ['fluoride', 'fluoride toothpaste', 'fluoride treatment', 'fluoride varnish', 'is fluoride safe', 'fluorosis', 'fluoride in water'],
    summary:
      'Fluoride is a mineral that strengthens enamel and helps early decay repair itself, which is why it is in toothpaste and many water supplies. Used as directed, it is safe and one of the most effective ways to prevent cavities.',
    body: `A professional fluoride varnish takes only a few minutes and is often recommended for children and for adults at higher risk of decay.
Fluoride toothpaste is safe for children when they use the right amount: a smear the size of a grain of rice under age 3 and a pea-sized amount from age 3 to 6.
Swallowing too much fluoride while adult teeth are forming can cause faint white marks called fluorosis, which is why young children should be supervised when brushing.
Spit out toothpaste after brushing rather than rinsing, so the fluoride keeps working.
Community water fluoridation at the U.S. recommended level of 0.7 mg per liter reduces cavities by about 25% in children and adults.
A 2024 U.S. National Toxicology Program review linked fluoride levels in drinking water of 1.5 mg per liter or more, over twice the recommended level, with lower IQ in children, but found too little evidence to judge the recommended level.
Fluoride toothpaste used as directed remains recommended by dental and medical organisations as safe and effective.
Fluoride at the levels used in water and toothpaste has not been shown to cause cancer: many studies have found no link.`,
    references: [
      { name: 'CDC: About community water fluoridation', url: 'https://www.cdc.gov/fluoridation/about/index.html' },
      { name: 'National Cancer Institute: Fluoridated water', url: 'https://www.cancer.gov/about-cancer/causes-prevention/risk/myths/fluoridated-water-fact-sheet' },
      { name: 'National Toxicology Program: Fluoride exposure and neurodevelopment', url: 'https://ntp.niehs.nih.gov/research/assessments/noncancer/completed/fluoride' },
      { name: 'American Academy of Pediatrics (HealthyChildren.org): Fluoride FAQs', url: 'https://www.healthychildren.org/English/healthy-living/oral-health/Pages/FAQ-Fluoride-and-Children.aspx' },
    ],
  },
  {
    slug: 'mouthwash',
    category: 'FAQ',
    title: 'Mouthwash',
    tags: ['mouthwash', 'mouth rinse', 'mouthrinse', 'listerine', 'alcohol free mouthwash', 'fluoride rinse', 'should i use mouthwash'],
    summary:
      'Mouthwash can help, but it does not replace brushing and cleaning between your teeth. A fluoride rinse helps prevent decay, and antiseptic rinses can reduce plaque, gum inflammation and bad breath.',
    body: `Choose a rinse for your goal, such as fluoride for cavities or an antiseptic rinse for gum health, and ask the dentist if you're unsure.
Alcohol-free rinses are gentler if you have a dry mouth or sensitive gums.
Mouthwash is not recommended for children under 6 unless a dentist advises it, because young children may swallow it.
A rinse that only masks bad breath doesn't treat the cause, so persistent bad breath is worth a check-up.`,
    references: [
      { name: 'American Dental Association: Mouthrinse (mouthwash)', url: 'https://www.ada.org/resources/ada-library/oral-health-topics/mouthrinse-mouthwash' },
    ],
  },
  {
    slug: 'whitening-at-home',
    category: 'FAQ',
    title: 'Whitening toothpastes, strips and charcoal',
    tags: ['whitening toothpaste', 'whitening strips', 'charcoal toothpaste', 'activated charcoal', 'at home whitening', 'natural whitening', 'baking soda', 'over the counter whitening'],
    summary:
      'Whitening toothpastes mainly remove surface stains and change the shade only a little. Over-the-counter strips can lighten teeth, while professional whitening is stronger, faster and supervised.',
    body: `There is no good evidence that charcoal toothpastes are safe or effective, and some are abrasive enough to wear enamel.
DIY remedies such as lemon juice or vinegar are acidic and can damage enamel.
Store-bought strips work best on natural teeth with mild yellowing and can cause temporary sensitivity.
Like professional whitening, home products don't change the colour of crowns, veneers or fillings.
An exam first helps find the cause of discolouration and the safest way to treat it.
Products with the ADA Seal of Acceptance have been checked for safety and effectiveness when used as directed.`,
    references: [
      { name: 'American Dental Association: Whitening', url: 'https://www.ada.org/resources/ada-library/oral-health-topics/whitening' },
    ],
  },
  {
    slug: 'teething-and-baby-teeth',
    category: 'FAQ',
    title: 'Teething and baby teeth',
    tags: ['teething', 'baby teething', 'first tooth', 'baby teeth coming in', 'losing baby teeth', 'when do kids lose teeth', 'loose baby tooth', 'wiggly tooth'],
    summary:
      "Most babies get their first tooth at around 6 months, usually the bottom front teeth, and have all 20 baby teeth by about age 3. Children usually start losing baby teeth at around age 6, and the last ones come out between ages 10 and 12.",
    body: `Teething can cause drooling, sore gums, chewing on things and fussiness.
A clean, chilled teething ring or gently rubbing the gums with a clean finger can soothe teething pain.
Don't use teething gels or liquids containing benzocaine or lidocaine for children under 2: the FDA warns they can cause rare but serious reactions and give little benefit.
A fever over 100.4°F, diarrhoea or a rash is not caused by teething, so call your doctor.
A loose baby tooth usually falls out on its own as the adult tooth pushes up underneath it.
Avoid teething necklaces and bracelets, which carry a risk of choking and strangulation.`,
    references: [
      { name: 'U.S. FDA: Safely soothing teething pain', url: 'https://www.fda.gov/consumers/consumer-updates/safely-soothing-teething-pain-infants-and-children' },
      { name: 'American Dental Association (MouthHealthy): Teething', url: 'https://www.mouthhealthy.org/all-topics-a-z/teething' },
    ],
  },
  {
    slug: 'sports-mouthguards',
    category: 'FAQ',
    title: 'Sports mouthguards',
    service: 'Sports mouthguard',
    caseValue: 300,
    priceUnit: 'per guard',
    tags: ['sports mouthguard', 'mouthguard for sports', 'sports guard', 'football mouthguard', 'hockey mouthguard', 'boxing mouthguard', 'custom mouthguard', 'boil and bite'],
    summary:
      'A mouthguard protects the teeth, lips and jaw during contact sports and activities where falls are likely. A custom mouthguard made by the dentist fits best and is the most comfortable to wear.',
    body: `Boil-and-bite guards from a store are a cheaper option that still protects far better than no guard.
A good mouthguard fits snugly, lets you breathe and speak, and doesn't come loose.
Children's mouthguards need replacing as their teeth and jaws grow.
Boil-and-bite guards aren't suitable with braces; people with braces need a guard designed to fit over brackets or a custom one.
Rinse the guard after use and keep it in a ventilated case.
Replace a mouthguard straight away if it's worn, damaged or no longer fits snugly.`,
    references: [
      { name: 'American Dental Association (MouthHealthy): Mouthguards', url: 'https://www.mouthhealthy.org/all-topics-a-z/mouthguards' },
      { name: 'American Dental Association: Athletic mouthguards', url: 'https://www.ada.org/resources/ada-library/oral-health-topics/athletic-mouth-protectors-mouthguards' },
    ],
  },
  {
    slug: 'retainers',
    category: 'FAQ',
    title: 'Retainers after braces or aligners',
    tags: ['retainer', 'retainers', 'lost my retainer', 'broken retainer', 'how long to wear a retainer', 'permanent retainer', 'fixed retainer', 'retainer does not fit'],
    summary:
      'Teeth naturally try to drift back after braces or aligners, so retainers hold them in place. Most people wear them full time at first, then every night for as long as they want to keep their straight teeth.',
    body: `Fixed retainers are thin wires bonded behind the front teeth, while removable retainers are clear trays or wire appliances you take out.
Clean removable retainers daily with a soft brush and cool water, and keep them in their case when they're not in your mouth.
Floss carefully around a fixed retainer and have it checked at your visits, because the bond can come loose.
If a retainer is lost, broken or no longer fits, contact the practice soon, before the teeth have a chance to move.
Full-time wear usually continues for the first few months, often around 4 to 6, before switching to nights, as your orthodontist directs.
If a removable retainer feels tight after a missed night or two but still fits, keep wearing it as directed; if it won't go in, call the practice.`,
    references: [
      { name: 'Cleveland Clinic: Retainers', url: 'https://my.clevelandclinic.org/health/treatments/10899-teeth-retainer' },
      { name: 'American Association of Orthodontists: Retainers', url: 'https://aaoinfo.org/whats-trending/what-are-dental-retainers/' },
    ],
  },
  {
    slug: 'amalgam-fillings',
    category: 'FAQ',
    title: 'Silver (amalgam) fillings',
    tags: ['silver fillings', 'amalgam', 'mercury fillings', 'metal fillings', 'replace old fillings', 'white fillings or silver fillings', 'are amalgam fillings safe'],
    summary:
      'Silver (amalgam) fillings contain mercury bound with other metals. Health authorities consider them safe for most people, and fillings that are in good condition generally should not be removed or replaced just because they are amalgam.',
    body: `Removing a sound filling takes away healthy tooth and briefly releases more mercury vapour than leaving it in place.
For new fillings, tooth-coloured composite or glass ionomer materials are suggested for higher-risk groups such as pregnant or nursing women, young children and people with kidney or neurological conditions.
A filling that is cracked, leaking or has decay underneath should be replaced, whatever it is made of.
The dentist can talk through the options if you'd prefer tooth-coloured fillings.`,
    references: [
      { name: 'U.S. FDA: Information for patients about dental amalgam fillings', url: 'https://www.fda.gov/medical-devices/dental-amalgam-fillings/information-patients-about-dental-amalgam-fillings' },
    ],
  },
  {
    slug: 'diabetes-and-oral-health',
    category: 'FAQ',
    title: 'Diabetes and your teeth',
    tags: ['diabetes', 'diabetic', 'blood sugar', 'type 2 diabetes', 'type 1 diabetes'],
    summary:
      'People with diabetes are more likely to get gum disease, and gum disease can make blood sugar harder to control. Good daily cleaning and regular check-ups help protect both your mouth and your overall health.',
    body: `Poorly controlled blood sugar can also cause dry mouth, slower healing and infections such as thrush.
Tell the team you have diabetes and which medicines you take, and eat as usual before appointments unless told otherwise.
Many people with diabetes benefit from cleanings more often than every six months.
Keeping blood sugar well controlled is one of the best ways to prevent gum disease and other mouth problems.`,
    references: [
      { name: 'NIDCR: Diabetes and oral health', url: 'https://www.nidcr.nih.gov/health-info/diabetes' },
      { name: 'NIDDK: Diabetes, gum disease and other dental problems', url: 'https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-problems/gum-disease-dental-problems' },
    ],
  },
  {
    slug: 'smoking-and-oral-health',
    category: 'FAQ',
    title: 'Smoking, vaping and your teeth',
    tags: ['smoking', 'smoker', 'cigarettes', 'tobacco', 'vaping', 'vape', 'e-cigarette', 'nicotine', 'quit smoking'],
    summary:
      'Smoking roughly doubles the risk of gum disease, slows healing after treatment, stains teeth and raises the risk of oral cancer. Vaping has not been studied as long, but nicotine can still affect the gums.',
    body: `Smoking can hide the early warning signs of gum disease, such as bleeding, because it reduces blood flow to the gums.
Smoking raises the risk of an implant failing and of dry socket after an extraction.
Quitting at any age lowers the risk of gum disease and tooth loss, and the team can point you to support.
Among older adults, about 3 in 10 who smoke have lost all their teeth, compared with about 1 in 10 who never smoked.
Vaping liquids can contain sugary flavourings and other chemicals, and their long-term effects on the mouth are still being studied.`,
    references: [
      { name: 'CDC: Tobacco use and oral health', url: 'https://www.cdc.gov/oral-health/data-research/facts-stats/fast-facts-tobacco-use-and-oral-health.html' },
      { name: 'American Dental Association (MouthHealthy): Vaping', url: 'https://www.mouthhealthy.org/all-topics-a-z/vaping' },
    ],
  },
  {
    slug: 'sleep-apnea-and-snoring',
    category: 'FAQ',
    title: 'Snoring and sleep apnea appliances',
    tags: ['snoring', 'sleep apnea', 'sleep apnoea', 'snore guard', 'anti snoring device', 'mandibular advancement device', 'oral appliance', 'cpap alternative'],
    summary:
      'A custom oral appliance worn at night holds the lower jaw slightly forward to keep the airway open, which can reduce snoring and treat mild to moderate sleep apnea.',
    body: `Sleep apnea has to be diagnosed by a doctor, usually with a sleep study, before an appliance is made.
The appliance is made from scans or impressions of your teeth and adjusted over a few visits.
A CPAP machine usually opens the airway more effectively, but some people find an oral appliance easier to use every night, and some use both.
Side effects can include jaw soreness or small changes in the bite, so regular follow-ups are important.
Mandibular advancement devices are the most common type of oral appliance.
Check-ups are usually needed about every six months in the first year, then at least once a year.`,
    references: [
      { name: 'Cleveland Clinic: Oral appliance therapy for sleep apnea', url: 'https://my.clevelandclinic.org/health/treatments/21129-oral-appliance-therapy-for-sleep-apnea' },
      { name: 'Mayo Clinic: Sleep apnea treatment', url: 'https://www.mayoclinic.org/diseases-conditions/sleep-apnea/diagnosis-treatment/drc-20377636' },
    ],
  },
  {
    slug: 'dental-insurance-basics',
    category: 'FAQ',
    title: 'How dental insurance works',
    tags: ['deductible', 'annual maximum', 'waiting period', 'how does dental insurance work', 'coinsurance', 'preventive coverage', 'insurance benefits reset', 'out of pocket'],
    summary:
      'Most dental plans cover check-ups and cleanings at or close to 100%, a smaller share of fillings and other basic work, and about half of major treatment such as crowns, up to a yearly limit.',
    body: `The deductible is what you pay each year before the plan starts paying, often around $50.
The annual maximum is the most the plan pays in a year, commonly $1,000 to $2,000, and benefits usually reset each calendar year.
Some plans have waiting periods of several months before they cover larger treatment.
In-network dentists have agreed fees with the plan, which usually means lower costs for you.
The team can check your benefits and give you an estimate before treatment.
Original Medicare doesn't cover most routine dental care such as cleanings, fillings, extractions or dentures, but many Medicare Advantage plans include some dental benefits, usually with yearly limits.`,
    references: [
      { name: 'CMS: Medicare dental coverage', url: 'https://www.cms.gov/medicare/coverage/dental' },
      { name: 'KFF: Medicare and dental coverage', url: 'https://www.kff.org/medicare/medicare-and-dental-coverage-a-closer-look/' },
    ],
  },
  {
    slug: 'antibiotics-before-dental-work',
    category: 'FAQ',
    title: 'Antibiotics before dental treatment',
    tags: ['antibiotics before dental work', 'premedication', 'premedicate', 'heart condition', 'heart valve', 'joint replacement', 'artificial joint', 'hip replacement', 'knee replacement'],
    summary:
      'Most people do not need antibiotics before dental treatment. A small group of people with certain heart conditions may be advised to take them before some procedures, and the decision is made with your dentist and doctor.',
    body: `For people with joint replacements, routine antibiotics before dental work are generally no longer recommended, though your surgeon may advise otherwise in special cases.
Tell the team about heart conditions, joint replacements and all your medicines before treatment.
Never start or stop an antibiotic without advice from your dentist or doctor.`,
    references: [
      { name: 'American Dental Association: Antibiotic prophylaxis', url: 'https://www.ada.org/resources/ada-library/oral-health-topics/antibiotic-prophylaxis' },
      { name: 'American Dental Association: Antibiotics and prosthetic joints', url: 'https://www.ada.org/resources/research/science/evidence-based-dental-research/antibiotics-to-prevent-prosthetic-joint-infection' },
    ],
  },
  {
    slug: 'medicines-and-dental-treatment',
    category: 'FAQ',
    title: 'Blood thinners, osteoporosis medicines and dental treatment',
    tags: ['blood thinner', 'blood thinners', 'anticoagulant', 'warfarin', 'eliquis', 'apixaban', 'xarelto', 'plavix', 'clopidogrel', 'bisphosphonate', 'fosamax', 'prolia', 'osteoporosis medication', 'stop my medication', 'my medications'],
    summary:
      'Tell the dental team about every medicine you take. Don\'t stop a blood thinner or an osteoporosis medicine before dental treatment unless the doctor who prescribed it tells you to.',
    body: `Most people keep taking blood thinners, including anticoagulants such as warfarin (Coumadin), apixaban (Eliquis) or rivaroxaban (Xarelto) and antiplatelets such as aspirin or clopidogrel (Plavix), for cleanings, fillings and simple extractions, and the dentist controls any bleeding locally.
Stopping a blood thinner can raise the risk of a stroke or blood clot, which is usually a bigger danger than the extra bleeding the dentist can control.
If you take warfarin, you may be asked for a recent INR blood test before an extraction.
Osteoporosis medicines such as bisphosphonates, for example alendronate (Fosamax), or denosumab (Prolia) carry a small risk of a rare jaw-bone problem after a tooth is pulled, so tell the dentist you take them.
For people taking these medicines for osteoporosis the risk is very low; it is higher with the high-dose treatments used for cancer.
If you can, have a dental check-up and any needed treatment before starting these medicines.
Tell your dentist or doctor about jaw pain, swelling, numbness, loose teeth or a sore that doesn't heal.`,
    references: [
      { name: 'American Dental Association: Anticoagulant and antiplatelet medications and dental procedures', url: 'https://www.ada.org/resources/ada-library/oral-health-topics/oral-anticoagulant-and-antiplatelet-medications-and-dental-procedures' },
      { name: 'American Dental Association (MouthHealthy): Osteoporosis and oral health', url: 'https://www.mouthhealthy.org/all-topics-a-z/osteoporosis-and-oral-health' },
    ],
  },
  {
    slug: 'gum-disease-and-overall-health',
    category: 'FAQ',
    title: 'Gum disease and your overall health',
    tags: ['heart disease', 'gum disease and heart', 'oral health and overall health', 'mouth body connection', 'inflammation', 'heart attack', 'stroke', 'whole body health'],
    summary:
      'Gum disease has been linked with heart disease, diabetes and other conditions, and inflammation may connect them, but it hasn\'t been proven that gum disease causes heart disease.',
    body: `People with diabetes are more likely to get gum disease, and gum disease can make blood sugar harder to control.
Gum disease and heart disease share risk factors such as smoking, which explains part of the link.
Treating gum disease improves the health of the mouth, but studies haven't yet shown that it lowers the risk of heart attacks or strokes.
Keeping your gums healthy with daily cleaning and regular check-ups is worthwhile whatever the link turns out to be.`,
    references: [
      { name: 'American Academy of Periodontology: Gum disease information', url: 'https://www.perio.org/for-patients/gum-disease-information/' },
      { name: 'NIDCR: Diabetes and oral health', url: 'https://www.nidcr.nih.gov/health-info/diabetes' },
      { name: 'Systematic review: periodontal disease and cardiovascular health (2023)', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10625740/' },
    ],
  },
  {
    slug: 'childrens-treatments',
    category: 'FAQ',
    title: 'Treatments for children\'s teeth',
    tags: ['silver diamine fluoride', 'sdf', 'black spots on my childs teeth', 'stainless steel crown', 'silver crown', 'baby root canal', 'pulpotomy', 'space maintainer', 'cavity in a baby tooth', 'baby tooth cavity', 'filling in a baby tooth', 'do baby teeth need fillings', 'fill a baby tooth', 'kids cavities', 'child has a cavity'],
    summary:
      'Decay in baby teeth is treated because baby teeth hold space for adult teeth and help children eat and speak. Depending on the tooth, the dentist may use fluoride, silver diamine fluoride, a filling, a stainless steel crown or a baby-tooth nerve treatment (pulpotomy).',
    body: `Silver diamine fluoride is a liquid brushed onto a cavity to stop it growing without drilling, which helps young or anxious children; after treatment the decayed area turns permanently black, which is expected.
Stainless steel crowns cover baby molars with large cavities or after nerve treatment, and they come out naturally with the baby tooth.
A pulpotomy removes the inflamed nerve tissue from the top of a baby tooth so the tooth can be kept until it falls out naturally.
If a baby tooth is lost or removed early, a space maintainer may be fitted to hold the gap open for the adult tooth.
Keeping a baby tooth until it is ready to fall out is usually better than losing it early, because early loss can let the neighbouring teeth drift into the space.`,
    references: [
      { name: 'American Academy of Pediatric Dentistry: Minimally invasive dentistry', url: 'https://www.aapd.org/globalassets/media/policies_guidelines/p_minimallyinvasivedentistry.pdf' },
      { name: 'American Academy of Pediatric Dentistry: Restorative dentistry', url: 'https://www.aapd.org/globalassets/media/policies_guidelines/bp_restorativedent.pdf' },
    ],
  },
  {
    slug: 'older-adults-dental-care',
    category: 'FAQ',
    title: 'Dental care for older adults',
    tags: ['older adults', 'seniors', 'senior', 'elderly', 'over 60', 'over 65', 'aging teeth', 'root decay', 'medicare', 'retired', 'grandparent'],
    summary:
      'Teeth can last a lifetime with good care. Older adults are more likely to have receding gums, decay on exposed roots and a dry mouth from medicines, so regular check-ups matter at every age.',
    body: `Root decay is common later in life because receding gums expose the softer root surfaces.
Dry mouth isn't a normal part of ageing, but more than 500 medicines can cause it, including some for high blood pressure, depression and bladder control.
Fluoride toothpaste, or a stronger fluoride toothpaste prescribed by the dentist, helps protect exposed roots.
If arthritis makes brushing hard, an electric toothbrush or a brush with a wider handle can help.
Dentures should be cleaned daily, taken out at night and checked regularly, because the gums and bone change shape over time.
Original Medicare doesn't cover most routine dental care such as cleanings, fillings or dentures, but many Medicare Advantage plans include some dental benefits.`,
    references: [
      { name: 'American Dental Association (MouthHealthy): Dental health concerns for adults over 60', url: 'https://www.mouthhealthy.org/life-stages/adults/dental-health-concerns-adults-over-60' },
      { name: 'NIDCR: Older adults and oral health', url: 'https://www.nidcr.nih.gov/sites/default/files/2023-12/older-adults-and-oral-health.pdf' },
      { name: 'CMS: Medicare dental coverage', url: 'https://www.cms.gov/medicare/coverage/dental' },
    ],
  },
  {
    slug: 'oral-piercings',
    category: 'FAQ',
    title: 'Tongue and lip piercings',
    tags: ['tongue piercing', 'lip piercing', 'oral piercing', 'mouth piercing', 'tongue ring', 'lip ring', 'piercing', 'smiley piercing', 'cheek piercing'],
    summary:
      'Tongue, lip and cheek piercings can chip or crack teeth, wear away the gums and cause infection and swelling, which is why the American Dental Association advises against them.',
    body: `Playing with or biting the jewellery can chip teeth, fillings and crowns.
Jewellery rubbing against the gums can make them recede, exposing the roots to sensitivity and decay.
A new piercing can swell, and severe swelling can make breathing difficult; loose jewellery can also be a choking hazard.
If you have a piercing, keep it clean, avoid clicking it against your teeth, take it out for sports, and get checked for signs of infection such as fever or increasing pain or swelling.`,
    references: [
      { name: 'American Dental Association (MouthHealthy): Oral piercings', url: 'https://www.mouthhealthy.org/all-topics-a-z/oral-piercings' },
      { name: 'American Dental Association: Oral piercing and jewelry', url: 'https://www.ada.org/resources/ada-library/oral-health-topics/oral-piercing-jewelry' },
    ],
  },

  // ---------------------------------------------------------------- emergencies
  {
    slug: 'emergency-warning-signs',
    category: 'EMERGENCY',
    title: 'When to call 911 or go to the emergency room',
    tags: ['emergency room', 'er', '911', 'difficulty breathing', 'trouble swallowing', 'swelling spreading', 'high fever', 'jaw injury', 'facial swelling', 'uncontrolled bleeding'],
    summary:
      'Go to the nearest emergency room or call 911 for swelling that spreads to the eye, neck or throat, difficulty breathing or swallowing, a high fever with facial swelling, bleeding that won’t stop, or a jaw or head injury.',
    body: `These can be signs of a spreading infection or a serious injury that needs urgent medical care, not just a dental visit.
After you've been seen, follow up with a dentist to treat the dental cause.
For a severe toothache, a knocked-out or broken tooth, or swelling without these warning signs, call the dental practice straight away for an urgent appointment.
Trouble opening your mouth or a swollen, painful eye with dental swelling also need emergency care, and don't drive yourself.`,
    references: [
      { name: 'NHS: Dental abscess', url: 'https://www.nhs.uk/conditions/dental-abscess/' },
      { name: 'Cleveland Clinic: Dental emergencies', url: 'https://my.clevelandclinic.org/health/articles/11368--dental-emergencies-what-to-do' },
    ],
  },
  {
    slug: 'knocked-out-tooth',
    category: 'EMERGENCY',
    title: 'Knocked-out tooth',
    service: 'Emergency visit',
    caseValue: 1500,
    tags: ['knocked out tooth', 'tooth knocked out', 'tooth fell out', 'tooth came out', 'avulsed tooth', 'lost a tooth in an accident'],
    summary:
      'A knocked-out adult tooth can often be saved if it goes back in within about 30 to 60 minutes. Pick it up by the crown (the white part), not the root, and see a dentist immediately.',
    body: `If it's dirty, rinse it briefly, for no more than about 10 seconds, with milk or cold water; don't scrub it, dry it or wrap it in tissue.
If you can, gently push it back into the socket the right way round and hold it in place by biting on a clean cloth.
If it can't go back in, keep it moist in a small container of milk or a tooth-preservation kit, or an adult can hold it inside the cheek; don't store it in plain water.
Don't try to put a knocked-out baby tooth back in; just see the dentist.
If there are other injuries to the head or face, go to the emergency room first.`,
    references: [
      { name: 'Cleveland Clinic: Knocked-out (avulsed) tooth', url: 'https://my.clevelandclinic.org/health/diseases/21579-avulsed-tooth' },
      { name: 'American Dental Association (MouthHealthy): Dental emergencies', url: 'https://www.mouthhealthy.org/dental-care/dental-emergencies/' },
    ],
  },
  {
    slug: 'severe-toothache',
    category: 'EMERGENCY',
    title: 'Severe toothache',
    service: 'Emergency visit',
    caseValue: 900,
    tags: ['toothache', 'tooth ache', 'tooth pain', 'my tooth hurts', 'severe pain', 'throbbing tooth', 'dental pain', 'pain in my tooth', 'painkillers'],
    summary:
      'For a bad toothache, rinse with warm water, gently floss to remove anything stuck, and hold a cold compress against your cheek. Call the practice for an urgent appointment, especially if there is swelling or fever.',
    body: `Over-the-counter pain relievers can help if they are safe for you; follow the directions on the label or ask a pharmacist.
Don't put aspirin or other painkillers directly on the gum or tooth, because it can burn the tissue.
Pain that wakes you at night, lasts more than a day or two, or comes with swelling, a bad taste or fever often means an infection that needs treatment.
Antibiotics alone don't fix a dental infection; the source has to be treated by a dentist.
If swelling spreads to the eye or neck or you have trouble breathing or swallowing, go to the emergency room.
A toothache that comes and goes should still be checked, because it can be an early sign of decay or a crack.`,
    references: [
      { name: 'Cleveland Clinic: Toothache', url: 'https://my.clevelandclinic.org/health/diseases/10957-toothache' },
      { name: 'Cleveland Clinic: Dental emergencies', url: 'https://my.clevelandclinic.org/health/articles/11368--dental-emergencies-what-to-do' },
    ],
  },
  {
    slug: 'broken-or-chipped-tooth',
    category: 'EMERGENCY',
    title: 'Broken or chipped tooth',
    service: 'Emergency visit',
    caseValue: 900,
    tags: ['broken tooth', 'chipped tooth', 'cracked tooth', 'broke my tooth', 'chipped my tooth', 'tooth broke', 'fractured tooth', 'snapped tooth'],
    summary:
      'If you break or chip a tooth, rinse with warm water, save any pieces and use a cold compress for swelling. Call the practice to be seen soon, and straight away if it’s painful or bleeding.',
    body: `Cover a sharp edge with sugar-free gum or dental wax to protect your tongue and cheek.
Avoid chewing on that side.
Small chips can often be repaired with bonding, while larger breaks may need a crown or, if the nerve is exposed, root canal treatment.
If the tooth is very loose or pushed out of position, or you hit your head or face, get care urgently.`,
    references: [
      { name: 'American Dental Association (MouthHealthy): Dental emergencies', url: 'https://www.mouthhealthy.org/dental-care/dental-emergencies/' },
      { name: 'Cleveland Clinic: Dental emergencies', url: 'https://my.clevelandclinic.org/health/articles/11368--dental-emergencies-what-to-do' },
    ],
  },
  {
    slug: 'lost-filling-or-crown',
    category: 'EMERGENCY',
    title: 'Lost filling or crown',
    service: 'Emergency visit',
    caseValue: 600,
    tags: ['lost filling', 'filling fell out', 'crown fell off', 'crown came off', 'cap fell off', 'lost crown', 'temporary crown came off'],
    summary:
      'If a filling or crown comes out, keep the crown, avoid chewing on that side and call the practice. A crown can often be re-cemented if it isn’t damaged.',
    body: `Temporary dental cement from a pharmacy can hold a crown in place or cover the hole until your appointment, but never use household glue.
Clean the crown and the tooth gently before trying a temporary fix.
The exposed tooth may be sensitive to hot and cold, and a sensitivity toothpaste can help.
Try to be seen within a few days so the tooth doesn't crack or decay further.`,
    references: [
      { name: 'American Dental Association (MouthHealthy): Dental emergencies', url: 'https://www.mouthhealthy.org/dental-care/dental-emergencies/' },
      { name: 'Cleveland Clinic: Dental emergencies', url: 'https://my.clevelandclinic.org/health/articles/11368--dental-emergencies-what-to-do' },
    ],
  },
  {
    slug: 'mouth-injuries',
    category: 'EMERGENCY',
    title: 'Bitten tongue, lip or cheek and other mouth cuts',
    tags: ['bit my tongue', 'bitten tongue', 'bit my lip', 'cut lip', 'cut in my mouth', 'cheek bite', 'tongue bleeding', 'lip bleeding'],
    summary:
      'For a bitten or cut tongue, lip or cheek, rinse gently with salt water, then press a clean damp gauze or cloth on the spot for 15 to 20 minutes and use a cold compress outside the mouth. Most minor cuts stop bleeding within that time and heal in a few days.',
    body: `Get urgent care if the bleeding won't stop after 20 minutes of firm pressure, the cut is deep or gaping, or it was caused by a fall or blow to the face.
A damp black tea bag pressed on the spot can also help slow bleeding.
Soft, cool foods and avoiding spicy or acidic food make the first days more comfortable.
If a tooth was also knocked, chipped or loosened, call the practice so it can be checked.`,
    references: [
      { name: 'Cleveland Clinic: Dental emergencies', url: 'https://my.clevelandclinic.org/health/articles/11368--dental-emergencies-what-to-do' },
      { name: 'American Dental Association (MouthHealthy): Dental emergencies', url: 'https://www.mouthhealthy.org/dental-care/dental-emergencies/' },
    ],
  },
  {
    slug: 'dental-abscess',
    category: 'EMERGENCY',
    title: 'Dental abscess and swelling',
    service: 'Emergency visit',
    caseValue: 1200,
    tags: ['abscess', 'dental abscess', 'tooth infection', 'gum boil', 'pus', 'swollen gum', 'swollen face', 'face swelling', 'swelling', 'swollen cheek'],
    summary:
      'A dental abscess is a pocket of infection at the root of a tooth or in the gum. It needs prompt dental treatment and does not go away on its own.',
    body: `Signs include severe throbbing pain, swelling of the gum or face, a pimple-like bump on the gum, a bad taste or smell, tenderness when biting, and sometimes fever.
Treatment means draining the infection and treating the cause, such as root canal treatment or removing the tooth; antibiotics are added only in some cases, such as a spreading infection, because on their own they don't clear an abscess.
Rinsing with warm salt water can ease discomfort until you're seen.
Swelling that spreads to the eye, neck or floor of the mouth, trouble breathing or swallowing, or a high fever needs the emergency room immediately.
Some abscesses cause little pain, so swelling, a bad taste or a bump on the gum still need to be checked.`,
    references: [
      { name: 'NHS: Dental abscess', url: 'https://www.nhs.uk/conditions/dental-abscess/' },
      { name: 'Cleveland Clinic: Abscessed tooth', url: 'https://my.clevelandclinic.org/health/diseases/10943-abscessed-tooth' },
    ],
  },

  // ---------------------------------------------------------------- aftercare
  {
    slug: 'after-extraction',
    category: 'AFTERCARE',
    title: 'Aftercare following a tooth extraction',
    tags: ['after extraction', 'extraction aftercare', 'bleeding after extraction', 'dry socket', 'after tooth removal', 'after wisdom teeth', 'socket', 'blood clot'],
    summary:
      'After an extraction, bite firmly on gauze for 30 to 45 minutes, rest for the day, and for the first 24 hours avoid rinsing, spitting, straws, smoking and hot drinks so the blood clot can form.',
    body: `Some oozing is normal for the first day.
If it keeps bleeding, place a fresh folded piece of gauze or a damp black tea bag over the socket and bite firmly for another 30 minutes.
If heavy bleeding continues despite firm pressure, call the practice or get urgent care.
Use a cold compress on the cheek, 15 minutes on and 15 minutes off, to reduce swelling on the first day.
Eat soft, cool foods and chew on the other side.
From the next day, gently rinse with warm salt water after meals.
Dry socket happens when the blood clot that protects the socket is lost or breaks down too early, leaving the bone exposed.
Pain that gets much worse two to four days after the extraction, sometimes with a bad taste, may be dry socket, which the dentist can treat.
Take prescribed or over-the-counter pain relief as directed.`,
    references: [
      { name: 'Mayo Clinic: Dry socket', url: 'https://www.mayoclinic.org/diseases-conditions/dry-socket/symptoms-causes/syc-20354376' },
      { name: 'Cleveland Clinic: Tooth extraction', url: 'https://my.clevelandclinic.org/health/treatments/22120-tooth-extraction' },
    ],
  },
  {
    slug: 'after-filling-or-crown',
    category: 'AFTERCARE',
    title: 'Aftercare following a filling or crown',
    tags: ['after filling', 'after crown', 'numbness', 'still numb', 'bite feels high', 'temporary crown care'],
    summary:
      'After a filling or crown, wait for the numbness to wear off before eating or having hot drinks. Mild sensitivity for a week or two is normal.',
    body: `Numbness usually lasts two to four hours.
If your bite feels uneven or the tooth hurts when you bite down, call the practice, because a quick adjustment usually fixes it.
With a temporary crown, avoid sticky and hard foods and slide floss out sideways instead of pulling it up.
Sensitivity that gets worse, or hasn't settled after a few weeks, should be checked.`,
    references: [
      { name: 'Cleveland Clinic: Dental fillings', url: 'https://my.clevelandclinic.org/health/treatments/17002-dental-fillings' },
      { name: 'Cleveland Clinic: Dental crowns', url: 'https://my.clevelandclinic.org/health/treatments/10923-dental-crowns' },
    ],
  },
  {
    slug: 'after-root-canal',
    category: 'AFTERCARE',
    title: 'Aftercare following root canal treatment',
    tags: ['after root canal', 'root canal aftercare', 'eating after root canal', 'pain after root canal', 'tender after root canal'],
    summary:
      'After root canal treatment, wait until the numbness wears off before eating, usually 2 to 4 hours, and avoid chewing on the treated tooth until it has its permanent filling or crown.',
    body: `The tooth may feel tender for a few days, which over-the-counter pain relief usually manages if it's safe for you.
Stick to soft foods on that side until the tooth is fully restored, because an unrestored tooth can crack.
Book the permanent crown or filling promptly, as the temporary filling is not designed to last.
Call the practice if you have severe pain or swelling, if the temporary filling comes out, or if your bite feels uneven.`,
    references: [
      { name: 'American Association of Endodontists: Root canal explained', url: 'https://www.aae.org/patients/root-canal-treatment/what-is-a-root-canal/root-canal-explained/' },
    ],
  },

  {
    slug: 'after-implant-surgery',
    category: 'AFTERCARE',
    title: 'Aftercare following implant surgery',
    tags: ['after implant', 'implant aftercare', 'implant recovery', 'implant healing'],
    summary:
      'After implant surgery expect some swelling, bruising and tenderness for a few days. Use cold compresses, take pain relief as directed, eat soft foods and keep the area clean.',
    body: `Most people feel back to normal within about a week.
Avoid smoking, which slows healing and raises the risk of the implant failing.
Don't chew directly on the implant area until the dentist says it's ready.
Rinse gently with warm salt water from the day after surgery, and brush your other teeth as normal.
Call the practice if pain or swelling increases after the third day, if you have a fever, or if the implant feels loose.`,
    references: [
      { name: 'Cleveland Clinic: Dental implants', url: 'https://my.clevelandclinic.org/health/treatments/10903-dental-implants' },
    ],
  },
  {
    slug: 'after-whitening',
    category: 'AFTERCARE',
    title: 'Aftercare following whitening',
    tags: ['after whitening', 'whitening aftercare', 'whitening sensitivity'],
    summary:
      'For 48 hours after whitening, avoid strongly coloured food and drink such as coffee, tea, red wine, curry and berries, and don’t smoke, to protect the result.',
    body: `Sensitivity is common for a few days, and a sensitivity toothpaste and lukewarm drinks help.
Touch-up treatments with take-home trays keep the shade bright over time.
Drinking staining drinks through a straw and rinsing with water afterwards reduces new staining.`,
    references: [
      { name: 'NHS: Teeth whitening', url: 'https://www.nhs.uk/tests-and-treatments/teeth-whitening/' },
    ],
  },

  // ---------------------------------------------------------------- policies (clinic fills in)
  {
    slug: 'insurance',
    category: 'POLICY',
    title: 'Insurance',
    published: false,
    tags: ['insurance', 'dental insurance', 'ppo', 'hmo', 'medicaid', 'delta dental', 'cigna', 'aetna', 'metlife', 'guardian', 'in network', 'coverage', 'benefits'],
    summary: '[Which dental insurance plans do you accept, and are you in or out of network?]',
    body: `[Do you file claims for patients?]
[Do you check benefits before the first visit?]
[What happens for patients without insurance, e.g. an in-house membership plan?]`,
  },
  {
    slug: 'payment-and-financing',
    category: 'POLICY',
    title: 'Payment options and financing',
    published: false,
    tags: ['payment', 'financing', 'payment plan', 'monthly payments', 'installments', 'carecredit', 'credit card', 'hsa', 'fsa', 'cash'],
    summary: '[Which payment methods do you accept?]',
    body: `[Do you offer financing or monthly payment plans, and through which provider?]
[Can larger treatment plans be split into stages?]`,
  },
  {
    slug: 'new-patients',
    category: 'POLICY',
    title: 'New patients',
    published: false,
    tags: ['new patient', 'new patients', 'accepting patients', 'register', 'sign up'],
    summary: '[Are you accepting new patients? Which ages do you see?]',
    body: `[How does a new patient book their first visit?]
[Is the first consultation free or charged?]`,
  },
  {
    slug: 'cancellation-policy',
    category: 'POLICY',
    title: 'Cancellations and rescheduling',
    published: false,
    tags: ['cancel', 'cancellation', 'reschedule', 'missed appointment', 'late', 'no show'],
    summary: '[How much notice do you need to cancel or reschedule?]',
    body: `[Is there a fee for missed appointments or late cancellations?]`,
  },
  {
    slug: 'meet-the-team',
    category: 'POLICY',
    title: 'Our dentists and team',
    published: false,
    tags: ['dentist', 'dentists', 'doctor', 'doctors', 'team', 'staff', 'hygienist', 'qualifications', 'experience', 'female dentist'],
    summary: '[Who are your dentists, and what are their qualifications and experience?]',
    body: `[Who else is on the team (hygienists, specialists)?]
[Can patients choose which dentist they see?]`,
  },
  {
    slug: 'appointments-and-walk-ins',
    category: 'POLICY',
    title: 'Appointments, walk-ins and same-day visits',
    published: false,
    tags: ['walk in', 'walk ins', 'walk-in', 'same day', 'same-day appointment', 'without an appointment', 'emergency appointment'],
    summary: '[Do you accept walk-ins, and do you offer same-day appointments?]',
    body: `[How do patients with urgent problems get seen quickly?]`,
  },
  {
    slug: 'location-and-parking',
    category: 'POLICY',
    title: 'Location, parking and accessibility',
    published: false,
    tags: ['parking', 'directions', 'location', 'address', 'wheelchair', 'accessible', 'public transport', 'bus'],
    summary: '[Where exactly are you, and where can patients park?]',
    body: `[Public transport options?]
[Is the office wheelchair accessible?]`,
  },
];

/** Synonym groups that teach search which patient words mean the same thing. */
export const SYNONYMS: string[][] = [
  ['cost', 'price', 'fee', 'fees', 'how much', 'expensive', 'pricing', 'charge', 'afford', 'quote', 'cheap', 'inexpensive', 'budget', 'low cost'],
  ['cheapest', 'most affordable', 'least expensive', 'lowest cost', 'affordable'],
  ['necessary', 'needed', 'essential', 'important', 'required', 'worth it', 'have to'],
  ['one tooth', 'single tooth', 'just one tooth', 'a single', 'single'],
  ['falls out', 'fell out', 'fall out', 'came out', 'comes out', 'came off', 'fell off', 'falls off', 'popped out', 'popped off', 'lost'],
  ['hurt', 'hurts', 'pain', 'painful', 'discomfort', 'sore', 'ache', 'sensitivity', 'sensitive'],
  ['how long', 'time', 'timeline', 'duration', 'months', 'weeks', 'takes', 'visits'],
  ['last', 'lifespan', 'durable', 'years', 'permanent'],
  ['invisalign', 'clear aligners', 'aligners', 'invisible braces', 'straighten'],
  ['recovery', 'healing', 'aftercare', 'swelling', 'bruising'],
  ['numb', 'numbing', 'anaesthetic', 'anesthetic', 'anaesthesia', 'anesthesia'],
  ['kids', 'children', 'child', 'pediatric', 'paediatric', 'toddler'],
  ['scared', 'nervous', 'anxious', 'anxiety', 'afraid', 'fear', 'phobia'],
  ['whitening', 'bleaching', 'whiter', 'whiten'],
  ['cleaning', 'hygiene', 'hygienist', 'scale and polish', 'checkup', 'check up'],
  ['insurance', 'coverage', 'covered', 'ppo', 'in network', 'benefits'],
  ['financing', 'payment plan', 'monthly payments', 'installments', 'carecredit', 'care credit', 'cherry', 'pay monthly'],
  ['colour', 'color', 'shade'],
  ['stain', 'stains', 'stained', 'discoloured', 'discolored', 'yellow'],
  ['safe', 'safety', 'risk', 'risks', 'side effects'],
  ['eat', 'food', 'foods', 'diet', 'drink'],
  ['missing tooth', 'missing teeth', 'lost tooth', 'gap'],
  ['put to sleep', 'asleep', 'sleep dentistry', 'sedation', 'sedated', 'general anaesthetic', 'general anesthesia', 'knocked out for'],
  ['laughing gas', 'nitrous oxide', 'gas'],
  ['pregnant', 'pregnancy', 'expecting a baby', 'breastfeeding'],
  ['scared', 'terrified', 'petrified', 'frightened', 'nervous', 'anxious', 'phobia', 'panic'],
  ['toothbrush', 'brush', 'brushing'],
  ['cavity', 'cavities', 'decay', 'hole'],
  ['wisdom teeth', 'wisdom tooth', 'third molars'],
  ['pull', 'pulled', 'removed', 'removal', 'extraction', 'extracted', 'take out', 'taken out', 'come out'],
  ['crooked', 'straighten', 'crowded', 'misaligned', 'uneven'],
  ['braces', 'orthodontic', 'orthodontics', 'orthodontist', 'orthodontic treatment'],
  ['bleed', 'bleeding', 'blood'],
  ['breath', 'halitosis', 'smell', 'odor', 'odour'],
];

/** Word forms that mean the same thing but don't share a stem ("pregnant" / "pregnancy"). */
export const EQUIVALENTS: string[][] = [
  ['tooth', 'teeth'],
  ['pregnant', 'pregnancy'],
  ['anxious', 'anxiety'],
  ['sensitive', 'sensitivity'],
  ['recover', 'recovery'],
  ['remove', 'removal', 'removing'],
  ['infected', 'infection', 'infections'],
  ['swollen', 'swelling', 'swell'],
  ['white', 'whiten', 'whitening', 'whiter'],
  ['straight', 'straighten', 'straightening'],
  ['loose', 'loosen', 'loosening'],
  ['decay', 'decayed'],
  ['child', 'children', 'childrens'],
];
