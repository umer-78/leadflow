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
Treatment starts with a consultation, an exam and 3D imaging (a cone-beam CT scan) to check the bone and plan where the implant goes.
The implant is placed under local anaesthetic, and sedation is often available for nervous patients.
The bone then fuses with the implant over roughly 3 to 6 months before the final crown is attached, so the whole process usually takes several months.
A temporary tooth can usually be worn while the implant heals.
If there is not enough bone, a bone graft or sinus lift may be needed first, which can add a few months.
Most people find the discomfort after placement is less than they expected and manage it with over-the-counter pain relievers for a few days; some swelling and bruising is normal.
Good candidates have healthy gums and enough jawbone; smoking, uncontrolled diabetes and gum disease raise the risk of an implant failing, so they are reviewed at the consultation.
Implants have high long-term success rates and are cleaned like natural teeth: brush twice a day, clean between the teeth daily and keep regular check-ups.
Alternatives include a bridge or a removable partial denture, and the dentist can compare the options for your situation.`,
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
Usually four to six implants support a full arch of teeth.
Depending on the case, a fixed temporary set of teeth may be attached the same day or soon after surgery, with the final teeth made after healing, often 3 to 6 months later.
Compared with a conventional denture they feel more secure, cover less of the palate and help preserve the jawbone.
Treatment starts with a consultation, 3D imaging and a review of your medical history, and the dentist will explain whether fixed or removable (snap-on) teeth suit you.`,
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
You wear each set of aligners for about 20 to 22 hours a day and switch to the next set every one to two weeks.
Many cases take around 6 to 18 months, depending on how far the teeth need to move.
Small tooth-coloured bumps called attachments are sometimes bonded to teeth to help the aligners grip.
Expect mild pressure or soreness for a day or two with each new set; it means the teeth are moving.
Take the aligners out to eat and to drink anything other than plain water, and brush before putting them back in.
After treatment you wear retainers, usually every night, to stop the teeth moving back.`,
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
Adjustments are usually needed every 4 to 8 weeks, and treatment often takes 1 to 3 years depending on the case.
Teeth may feel sore for a few days after brackets are placed or adjusted; soft foods and over-the-counter pain relief help.
Avoid hard, sticky and chewy foods such as hard candy, popcorn kernels and caramel, which can break brackets.
Cleaning carefully around the brackets prevents decay and white spots.
After braces come off, retainers keep the teeth in their new position.
Orthodontic treatment can be done at any age as long as the teeth and gums are healthy.`,
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
Preparing the teeth usually removes a thin layer of enamel, so traditional veneers are a permanent choice.
Porcelain resists staining and, with good care, veneers commonly last 10 to 15 years or more.
Avoid biting very hard things like ice, pens or packaging, and wear a night guard if you grind your teeth.
Composite (resin) veneers are a lower-cost alternative that needs little or no tooth reduction, but they are less durable and can stain.
Any decay or gum disease is treated first, because veneers need healthy teeth and gums underneath.`,
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
Bonding is less durable than porcelain: it can chip or stain, and typically lasts several years before it needs touching up or replacing.
Avoid biting nails or hard objects, and limit coffee, tea, red wine and smoking to keep the colour.`,
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
Temporary sensitivity and mild gum irritation are common and usually settle within a day or two; a sensitivity toothpaste helps.
Results last from several months to a few years, depending on habits such as coffee, tea, red wine and smoking.
An exam first is recommended to check for decay or gum problems and to find out what is causing the discolouration.
As a precaution, whitening is usually postponed during pregnancy and breastfeeding.`,
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
A crown traditionally takes two visits: the tooth is shaped and scanned and a temporary crown is fitted, then the permanent crown is cemented a couple of weeks later.
Some practices can design and mill a crown on the same day.
The procedure is done under local anaesthetic and usually feels similar to having a filling.
With good care, crowns commonly last 10 to 15 years or longer.
If your bite feels high or the tooth stays sensitive for more than a few days after the crown is placed, let the practice know so it can be adjusted.`,
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
Bridges typically last 10 to 15 years with good care, and floss threaders or small interdental brushes help clean under the false tooth.
Implants are an alternative that doesn't involve reshaping the neighbouring teeth, and the dentist can compare both for you.`,
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
It is normal to need a few weeks to get used to eating and speaking with new dentures, and small adjustments for sore spots are common.
Take dentures out at night, clean them daily with a denture brush and cleaner, and keep them moist when you're not wearing them.
Because gums and bone change shape over time, dentures may need relining or replacing every several years.
Implant-supported dentures are an option if a conventional denture feels loose.`,
  },
  {
    slug: 'root-canal-treatment',
    category: 'PROCEDURE',
    title: 'Root canal treatment',
    service: 'Root canal treatment',
    caseValue: 1200,
    priceUnit: 'per tooth (varies by tooth)',
    tags: ['root canal', 'endodontic', 'endodontics', 'nerve treatment', 'infected tooth', 'tooth infection', 'abscessed tooth', 'pulp'],
    summary:
      'Root canal treatment removes infected or inflamed pulp from inside a tooth, cleans and disinfects the canals and seals them, saving the tooth instead of extracting it.',
    body: `Signs a tooth may need it include a lingering ache or sensitivity to hot or cold, pain when biting, a darkening tooth, or a swelling or small bump on the gum; only an exam and X-rays can confirm it.
It is done under local anaesthetic, and for most people it feels similar to having a filling.
It is usually completed in one or two visits.
The tooth may feel tender for a few days afterwards, which over-the-counter pain relievers usually manage.
Back teeth usually need a crown afterwards to protect them from cracking.
Root canal treatment has a high success rate and lets you keep your natural tooth.`,
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
The dentist can discuss replacing the tooth with an implant, bridge or denture if needed.`,
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
    body: `Not every wisdom tooth needs removing; X-rays show whether there is room for them and whether they are causing problems.
Removal is done under local anaesthetic, often with sedation, and sometimes by an oral surgeon.
Swelling and stiffness usually peak two to three days after surgery and settle within about a week.
Eat soft foods, avoid straws and smoking, and follow the extraction aftercare instructions.
Pain that gets worse after a few days instead of better can be a sign of dry socket, so call the practice.`,
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
Fillings are usually done in a single visit under local anaesthetic.
The numbness wears off within a few hours; avoid chewing on that side and hot drinks until it does.
Mild sensitivity for a few days is normal, but if your bite feels high or the tooth hurts when you bite, call so it can be adjusted.
Very large cavities may need an inlay, onlay or crown instead of a filling.`,
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
      'A routine check-up and professional cleaning keeps teeth and gums healthy and catches problems early, when they are simpler to treat. Most people benefit from a visit about every six months.',
    body: `The hygienist removes plaque and hardened tartar that brushing can't remove, then polishes the teeth.
The dentist checks for decay, gum disease, worn or cracked teeth and signs of oral cancer, and goes over any concerns.
X-rays are taken when needed to see between the teeth and below the gum line, and modern digital X-rays use a very low dose of radiation.
People with gum disease, diabetes, frequent cavities or who smoke may need visits more often.
New patients usually start with a comprehensive exam, which takes a little longer.`,
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
Gum disease is common and often painless, so regular check-ups are the best way to catch it early.`,
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
The dentist can apply fluoride varnish or bonding, or treat the underlying cause.`,
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
Jaw joint (TMJ) problems such as clicking, locking or pain when chewing should be assessed by the dentist.`,
  },
  {
    slug: 'bad-breath',
    category: 'CONDITION',
    title: 'Bad breath',
    tags: ['bad breath', 'halitosis', 'smelly breath', 'breath odor', 'breath odour', 'dry mouth'],
    summary:
      'Most bad breath (halitosis) comes from bacteria in the mouth, especially on the tongue and between the teeth, and good daily cleaning plus treating any gum disease usually fixes it.',
    body: `Brush twice a day, clean between the teeth daily and gently brush or scrape the tongue.
Dry mouth, smoking, some foods, gum disease, cavities and poorly fitting dentures can all contribute.
Drinking water and chewing sugar-free gum help by increasing saliva.
If bad breath continues despite good cleaning, a check-up can find or rule out dental causes, and occasionally it is linked to sinus, throat or medical issues that a doctor should check.`,
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
Oral sedation is a prescribed tablet taken before the visit; you'll feel drowsy and need someone to drive you home.
Some practices offer IV sedation for longer or more involved procedures.
Which sedation is suitable depends on your medical history and medications, which are reviewed beforehand.`,
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
Baby teeth matter: they hold space for adult teeth and help with chewing and speech.`,
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
Dental X-rays and local anaesthetic can be used when needed with appropriate precautions, and the dentist will discuss them with you.
Elective cosmetic treatments such as whitening are usually postponed until after pregnancy.
After morning sickness, rinse with water or a fluoride mouthwash and wait about 30 minutes before brushing.`,
  },
  {
    slug: 'xray-safety',
    category: 'FAQ',
    title: 'Are dental X-rays safe?',
    tags: ['x-ray', 'xray', 'x rays', 'radiation', 'scan', 'cbct', '3d scan'],
    summary:
      'Dental X-rays use a very low dose of radiation and are only taken when the dentist needs them, for example to see decay between teeth, bone levels or problems below the gum line.',
    body: `Digital X-rays reduce the dose further compared with older film X-rays.
How often you need them depends on your risk of decay and gum disease.
Let the team know if you are or might be pregnant.`,
  },
  {
    slug: 'brushing-and-flossing',
    category: 'FAQ',
    title: 'Looking after your teeth at home',
    tags: ['brushing', 'flossing', 'toothpaste', 'fluoride', 'how to brush', 'oral hygiene', 'prevention', 'electric toothbrush', 'mouthwash', 'water flosser'],
    summary:
      'Brush twice a day for two minutes with fluoride toothpaste, clean between your teeth once a day, limit sugary snacks and drinks, and see the dentist regularly.',
    body: `Use a soft-bristled brush and replace it every three to four months or when the bristles fray.
Spit out the toothpaste after brushing instead of rinsing, so the fluoride keeps working.
Floss, interdental brushes or a water flosser all clean between teeth, so use whichever you'll stick with every day.
Sugary and acidic snacks and drinks between meals increase the risk of decay and enamel erosion.
Not smoking lowers the risk of gum disease, tooth loss and oral cancer.`,
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
For a severe toothache, a knocked-out or broken tooth, or swelling without these warning signs, call the dental practice straight away for an urgent appointment.`,
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
    body: `If it's dirty, rinse it very briefly with milk or water; don't scrub it, dry it or wrap it in tissue.
If you can, gently push it back into the socket the right way round and hold it in place by biting on a clean cloth.
If it can't go back in, keep it moist in a small container of milk or a tooth-preservation kit, or an adult can hold it inside the cheek; don't store it in plain water.
Don't try to put a knocked-out baby tooth back in; just see the dentist.
If there are other injuries to the head or face, go to the emergency room first.`,
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
If swelling spreads to the eye or neck or you have trouble breathing or swallowing, go to the emergency room.`,
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
Treatment means draining the infection and treating the cause, such as root canal treatment or removing the tooth, and antibiotics may be added in some cases.
Rinsing with warm salt water can ease discomfort until you're seen.
Swelling that spreads to the eye, neck or floor of the mouth, trouble breathing or swallowing, or a high fever needs the emergency room immediately.`,
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
Pain that gets much worse two to four days after the extraction, sometimes with a bad taste, may be dry socket, which the dentist can treat.
Take prescribed or over-the-counter pain relief as directed.`,
  },
  {
    slug: 'after-filling-or-crown',
    category: 'AFTERCARE',
    title: 'Aftercare following a filling or crown',
    tags: ['after filling', 'after crown', 'numbness', 'still numb', 'bite feels high', 'temporary crown care'],
    summary:
      'After a filling or crown, wait for the numbness to wear off before eating or having hot drinks. Mild sensitivity for a few days is normal.',
    body: `Numbness usually lasts two to four hours.
If your bite feels uneven or the tooth hurts when you bite down, call the practice, because a quick adjustment usually fixes it.
With a temporary crown, avoid sticky and hard foods and slide floss out sideways instead of pulling it up.
Sensitivity that gets worse or lasts more than a couple of weeks should be checked.`,
  },
  {
    slug: 'after-implant-surgery',
    category: 'AFTERCARE',
    title: 'Aftercare following implant surgery',
    tags: ['after implant', 'implant aftercare', 'implant recovery', 'implant healing'],
    summary:
      'After implant surgery expect some swelling, bruising and tenderness for a few days. Use cold compresses, take pain relief as directed, eat soft foods and keep the area clean.',
    body: `Avoid smoking, which slows healing and raises the risk of the implant failing.
Don't chew directly on the implant area until the dentist says it's ready.
Rinse gently with warm salt water from the day after surgery, and brush your other teeth as normal.
Call the practice if pain or swelling increases after the third day, if you have a fever, or if the implant feels loose.`,
  },
  {
    slug: 'after-whitening',
    category: 'AFTERCARE',
    title: 'Aftercare following whitening',
    tags: ['after whitening', 'whitening aftercare', 'whitening sensitivity'],
    summary:
      'For 48 hours after whitening, avoid strongly coloured food and drink such as coffee, tea, red wine, curry and berries, and don’t smoke, to protect the result.',
    body: `Sensitivity is common for a day or two, and a sensitivity toothpaste and lukewarm drinks help.
Touch-up treatments with take-home trays keep the shade bright over time.
Drinking staining drinks through a straw and rinsing with water afterwards reduces new staining.`,
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
  ['cost', 'price', 'fee', 'fees', 'how much', 'expensive', 'pricing', 'charge', 'afford', 'quote'],
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
  ['financing', 'payment plan', 'monthly payments', 'installments', 'carecredit', 'pay monthly'],
  ['tooth', 'teeth'],
  ['colour', 'color', 'shade'],
  ['stain', 'stains', 'stained', 'discoloured', 'discolored', 'yellow'],
  ['safe', 'safety', 'risk', 'risks', 'side effects'],
  ['eat', 'food', 'foods', 'diet', 'drink'],
  ['missing tooth', 'missing teeth', 'lost tooth', 'gap'],
];
