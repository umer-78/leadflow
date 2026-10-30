/**
 * The receptionist's quality bench: realistic patient messages and the answer
 * a good front desk would give. Run `npm run eval` for a report; the test
 * suite requires every case to pass, so add a case whenever you teach the
 * assistant something new (or catch it getting something wrong).
 *
 * Cases run against the demo clinic (prices and policies filled in) on
 * Friday 16 Oct 2026 at 10:00 in New York, while the clinic is open.
 */

export interface Expectation {
  /** The reply text must match. */
  expect?: RegExp;
  /** The reply text must not match. */
  not?: RegExp;
  /** The skill that handled the turn (meta.skill). */
  skill?: string | RegExp;
  /** A knowledge article slug that must be among the reply's sources. */
  source?: string;
}

export interface QaCase extends Expectation {
  q: string;
}

export interface Script {
  name: string;
  turns: (Expectation & { say: string })[];
}

/** Single questions, each asked at the start of a fresh conversation. */
export const QA: QaCase[] = [
  // ------------------------------------------------------------ implants
  { q: 'how much are implants', expect: /\$3,000–\$5,000/, skill: 'price' },
  { q: 'how long do dental implants take', expect: /3 to 6 months|several months/, source: 'dental-implants' },
  { q: 'do implants hurt?', expect: /discomfort|pain relievers/, source: 'dental-implants' },
  { q: 'how long do implants last', expect: /decades|long-term success/, source: 'dental-implants' },
  { q: 'am I a good candidate for implants?', expect: /candidates|healthy gums|enough jawbone/, source: 'dental-implants' },
  { q: 'what are the alternatives to an implant', expect: /bridge|denture/ },
  { q: 'what is a dental implant', expect: /titanium|zirconia/, source: 'dental-implants' },
  { q: "what if I don't have enough bone for an implant", expect: /bone graft|sinus lift/, source: 'dental-implants' },
  { q: 'can I get a temporary tooth while my implant heals', expect: /temporary tooth/, source: 'dental-implants' },
  { q: 'do you do implants?', expect: /^Yes\b/, source: 'dental-implants' },
  { q: 'I smoke, can I still get implants?', expect: /smok/, source: 'dental-implants' },
  { q: 'what is all on 4', expect: /full set of teeth|full-arch|four to six implants/, source: 'implant-supported-dentures' },

  // ------------------------------------------------------------ aligners and braces
  { q: 'how long does invisalign take', expect: /6 to 18 months/, source: 'clear-aligners' },
  { q: 'how many hours a day do I wear aligners', expect: /22 hours a day/, source: 'clear-aligners' },
  { q: 'does invisalign hurt', expect: /pressure|soreness/, source: 'clear-aligners' },
  { q: 'can I eat with my aligners in?', expect: /out to eat/, source: 'clear-aligners' },
  { q: 'do I need a retainer after invisalign', expect: /retainers? hold/, source: 'retainers' },
  { q: 'do you do invisalign?', expect: /^Yes\b/, source: 'clear-aligners' },
  { q: 'how much is invisalign', expect: /\$3,500–\$6,500/, skill: 'price' },
  { q: 'how long do braces take', expect: /1 to 3 years/, source: 'braces' },
  { q: "what can't I eat with braces", expect: /hard, sticky|popcorn|caramel/, source: 'braces' },
  { q: 'am I too old for braces?', expect: /any age/, source: 'braces' },
  { q: 'do you have ceramic braces', expect: /ceramic/, source: 'braces' },
  { q: 'my teeth are crooked', expect: /aligners|braces/ },

  // ------------------------------------------------------------ cosmetic
  { q: 'how long do veneers last', expect: /10 to 15 years/, source: 'porcelain-veneers' },
  { q: 'are veneers permanent?', expect: /permanent/, source: 'porcelain-veneers' },
  { q: 'how many visits do veneers take', expect: /two or three visits/, source: 'porcelain-veneers' },
  { q: 'do veneers damage your teeth?', expect: /enamel/, source: 'porcelain-veneers' },
  { q: 'what are composite veneers', expect: /[Cc]omposite/ },
  { q: 'how much do veneers cost', expect: /\$950–\$2,500 per tooth/, skill: 'price' },
  { q: 'how long does bonding last', expect: /3 to 10 years/, source: 'cosmetic-bonding' },
  { q: 'does bonding hurt', expect: /numbing is often not required|[Ll]ittle or no enamel/, source: 'cosmetic-bonding' },
  { q: 'how long does tooth bonding take', expect: /30 to 60 minutes/, source: 'cosmetic-bonding' },
  { q: 'is teeth whitening safe?', expect: /safely|sensitivity/, source: 'teeth-whitening' },
  { q: 'will whitening make my teeth sensitive', expect: /[Ss]ensitivity/, source: 'teeth-whitening' },
  { q: 'how long does whitening last', expect: /few months up to about three years/, source: 'teeth-whitening' },
  { q: 'can you whiten crowns?', expect: /does not change the colou?r of crowns/, source: 'teeth-whitening' },
  { q: 'can I whiten my teeth while pregnant', expect: /postponed|after pregnancy/ },
  { q: 'how long does in office whitening take', expect: /one to one and a half hours/, source: 'teeth-whitening' },
  { q: 'what should I avoid after whitening', expect: /coffee|48 hours/, source: 'after-whitening' },
  { q: 'I want whiter teeth', expect: /whiten/i, source: 'teeth-whitening' },

  // ------------------------------------------------------------ restorative
  { q: 'how long does a crown take', expect: /two visits|same day/, source: 'dental-crowns' },
  { q: 'do you do same day crowns?', expect: /same day/, source: 'dental-crowns' },
  { q: 'how long do crowns last', expect: /5 to 15 years/, not: /two visits/, source: 'dental-crowns' },
  { q: 'does getting a crown hurt', expect: /local anaesthetic|similar to having a filling/, source: 'dental-crowns' },
  { q: 'how long does a bridge last', expect: /5 to 15 years/, source: 'dental-bridges' },
  { q: 'how long does it take to get used to dentures', expect: /few weeks/, source: 'dentures' },
  { q: 'should I sleep with my dentures in', expect: /out at night/, source: 'dentures' },
  { q: 'my dentures feel loose', expect: /relin|[Ii]mplant-supported/ },
  { q: 'does a root canal hurt?', expect: /similar to having a filling|local anaesthetic/, source: 'root-canal-treatment' },
  { q: 'how many visits for a root canal', expect: /one or two visits/, source: 'root-canal-treatment' },
  { q: 'do I need a crown after a root canal', expect: /crown/, not: /can't diagnose/ },
  { q: 'what is a root canal', expect: /pulp/, source: 'root-canal-treatment' },
  { q: 'how much is a root canal', expect: /\$700–\$1,500/, skill: 'price' },
  { q: 'how long does it take to recover from a tooth extraction', expect: /few days|a week/, source: 'tooth-extraction' },
  { q: 'how long is recovery after wisdom teeth removal', expect: /about a week|two to three days/, source: 'wisdom-teeth' },
  { q: 'can I use a straw after an extraction', expect: /straws/ },
  { q: 'what can I eat after a tooth extraction', expect: /soft/, source: 'after-extraction' },
  { q: 'what is dry socket', expect: /[Dd]ry socket happens when/ },
  { q: 'do wisdom teeth always need to come out?', expect: /[Nn]ot every wisdom tooth/, source: 'wisdom-teeth' },
  { q: 'how long does a filling take', expect: /single visit/, source: 'fillings' },
  { q: 'how long does the numbness last after a filling', expect: /few hours|two to four hours/ },
  { q: 'how much is a filling', expect: /\$150–\$450/, skill: 'price' },

  // ------------------------------------------------------------ prevention and conditions
  { q: 'how often should I get a cleaning', expect: /six months/, source: 'checkup-and-cleaning' },
  { q: 'how much is a cleaning', expect: /\$150–\$300/, skill: 'price' },
  { q: 'what happens at a checkup', expect: /plaque|tartar|checks for decay/, source: 'checkup-and-cleaning' },
  { q: 'is gum disease reversible?', expect: /reversible/, source: 'gum-disease' },
  { q: 'what is a deep cleaning', expect: /scaling and root planing/, source: 'deep-cleaning' },
  { q: 'my gums bleed when I brush', expect: /gum/i, not: /^I can't diagnose/ },
  { q: 'my teeth are sensitive to cold', expect: /[Ss]ensitivity|desensitis/, source: 'tooth-sensitivity' },
  { q: 'what toothpaste is good for sensitive teeth', expect: /desensitis/, source: 'tooth-sensitivity' },
  { q: 'I grind my teeth at night', expect: /night guard/, source: 'teeth-grinding' },
  { q: 'do you make night guards?', expect: /^Yes\b/, source: 'teeth-grinding' },
  { q: 'how do I get rid of bad breath', expect: /[Bb]rush|tongue/, source: 'bad-breath' },
  { q: 'how often should I replace my toothbrush', expect: /three to four months/, source: 'brushing-and-flossing' },
  { q: 'should I rinse after brushing?', expect: /[Ss]pit/, source: 'brushing-and-flossing' },
  { q: 'is a water flosser as good as floss', expect: /water flosser/, source: 'brushing-and-flossing' },
  { q: 'are dental x-rays safe', expect: /low dose/ },

  // ------------------------------------------------------------ anxiety, children, pregnancy
  { q: "I'm really scared of the dentist", expect: /nervous|anxi|common/i, source: 'dental-anxiety-and-sedation' },
  { q: 'do you offer sedation?', expect: /^Yes\b/, source: 'dental-anxiety-and-sedation' },
  { q: 'what is laughing gas', expect: /[Nn]itrous oxide/, source: 'dental-anxiety-and-sedation' },
  { q: 'can I be put to sleep for my treatment', expect: /sedation/ },
  { q: 'do you see kids?', expect: /^Yes\b/, source: 'childrens-dentistry' },
  { q: 'when should my child first see a dentist', expect: /first birthday/, source: 'childrens-dentistry' },
  { q: 'how much toothpaste should a toddler use', expect: /grain of rice/, source: 'childrens-dentistry' },
  { q: 'what are sealants', expect: /sealants/, source: 'dental-sealants' },
  { q: 'is it safe to go to the dentist while pregnant', expect: /safe/, source: 'pregnancy-and-dental-care' },
  { q: 'can I have x-rays when pregnant', expect: /X-rays/, not: /^Dental X-rays use a very low dose of radiation and are only taken when/ },

  // ------------------------------------------------------------ first visit and policies
  { q: 'what should I bring to my first appointment', expect: /photo ID/ },
  { q: 'how early should I arrive for my first visit', expect: /10( to 15)? minutes/ },
  { q: 'do you take delta dental?', expect: /Delta Dental/, skill: 'insurance' },
  { q: 'do you accept medicaid', expect: /not in network with HMO or Medicaid/, skill: 'insurance' },
  { q: 'does insurance cover implants', expect: /insurance|benefits/i },
  { q: 'can I pay monthly?', expect: /CareCredit|monthly/, skill: 'financing' },
  { q: 'do you take HSA cards', expect: /HSA/ },
  { q: 'are you accepting new patients?', expect: /new patients/ },
  { q: 'what is your cancellation policy', expect: /24 hours/ },
  { q: 'is there a fee if I miss my appointment', expect: /\$50 fee/ },
  { q: 'where do I park', expect: /parking/ },
  { q: 'is your office wheelchair accessible', expect: /wheelchair accessible/ },
  { q: 'is the consultation free?', expect: /free/ },

  // ------------------------------------------------------------ hours and location
  { q: 'what are your hours', expect: /Mon.*8 AM–5 PM/s, skill: 'hours' },
  { q: 'are you open on saturday?', expect: /^Yes.*9 AM–1 PM/s, skill: 'hours' },
  { q: 'are you open sunday', expect: /closed/, skill: 'hours' },
  { q: 'what time do you close on wednesday', expect: /7 PM/, skill: 'hours' },
  { q: 'are you open right now?', expect: /open right now/, skill: 'hours' },
  { q: 'where are you located', expect: /248 Harbor View Ave/, skill: 'location' },

  // ------------------------------------------------------------ emergencies (safety first)
  { q: 'my tooth got knocked out', expect: /30 to 60 minutes/, skill: 'safety_urgent' },
  { q: 'I chipped my front tooth', expect: /chip/i, skill: /safety_(urgent|soon)/ },
  { q: "my face is swelling and I can't swallow", expect: /911|emergency room/, skill: 'safety_er' },
  { q: 'I have a really bad toothache', expect: /cold compress|urgent/i, skill: 'safety_urgent' },
  { q: 'my crown fell off', expect: /re-cemented|crown/, skill: 'safety_soon' },
  { q: "my gum is swollen and there's pus", expect: /abscess|infection/i, skill: 'safety_urgent' },
  { q: 'what painkiller should I take?', expect: /can't recommend medicines/ },
  { q: 'do I have an infection?', expect: /can't diagnose/ },

  // ------------------------------------------------------------ booking
  { q: 'can I book a cleaning for next week?', expect: /Mon, Oct 19/, skill: 'offer_slots' },
  { q: 'do you have anything tomorrow afternoon', expect: /no afternoon openings|Sat, Oct 17|Mon, Oct 19/, skill: 'offer_slots' },
  { q: 'I need an appointment asap', expect: /Fri, Oct 16/, skill: 'offer_slots' },
  { q: 'can I come in on tuesday at 2pm', expect: /Tue, Oct 20 at 2 PM/, skill: 'offer_slots' },
  { q: 'I need to cancel my appointment', expect: /cancel|reschedul/i, skill: 'reschedule' },

  // ------------------------------------------------------------ conversation
  { q: 'hi', expect: /help/, skill: 'greet' },
  { q: 'good morning!', expect: /[Gg]ood morning|help/, skill: 'greet' },
  { q: 'how are you?', expect: /well|good|great/i, skill: 'smalltalk' },
  { q: 'thanks', expect: /welcome/, skill: 'thanks' },
  { q: 'are you a bot?', expect: /virtual assistant/, skill: 'about' },
  { q: 'what services do you offer', expect: /Cosmetic/, skill: 'services' },
  { q: 'can I speak to a real person', expect: /name|phone/, skill: 'handoff' },
  { q: 'how much does it cost?', expect: /Which treatment/, skill: 'price' },
  { q: "what's the weather like", expect: /dental|treatment|appointment|team/i, skill: /fallback|offtopic/ },
  { q: 'tell me a joke', expect: /dental|teeth|treatment|appointment/i, not: /^I'm not sure about that one/ },

  // ------------------------------------------------------------ several questions in one message
  { q: 'how much are veneers and do you offer payment plans?', expect: /\$950–\$2,500[\s\S]*(CareCredit|monthly)/ },
  { q: 'what are your hours and where are you located?', expect: /8 AM[\s\S]*248 Harbor View/ },
  { q: 'do you do implants and how much are they?', expect: /\$3,000–\$5,000/ },
  { q: 'Do you take Aetna? Also, are you open Saturdays?', expect: /Aetna[\s\S]*9 AM–1 PM/ },

  // ------------------------------------------------------------ comparisons
  { q: "what's the difference between veneers and bonding", expect: /[Vv]eneers[\s\S]*[Bb]onding|[Bb]onding[\s\S]*[Vv]eneers/ },
  { q: 'is an implant better than a bridge?', expect: /[Ii]mplant[\s\S]*[Bb]ridge|[Bb]ridge[\s\S]*[Ii]mplant/ },
  { q: 'invisalign or braces?', expect: /[Aa]ligners[\s\S]*[Bb]races|[Bb]races[\s\S]*[Aa]ligners/ },

  // ------------------------------------------------------------ typos and texting style
  { q: 'how mch r implnts', expect: /\$3,000–\$5,000/, skill: 'price' },
  { q: 'wat time u close today', expect: /3 PM/, skill: 'hours' },
  { q: 'do u guys do braces for adults', expect: /any age/, source: 'braces' },
  { q: 'invisalgn price?', expect: /\$3,500–\$6,500/, skill: 'price' },
  { q: 'my tooth hurts sooo bad', expect: /urgent|call|cold compress/i, skill: /safety_urgent/ },

  // ------------------------------------------------------------ unseen-question probes, kept as regression cases
  // researched facts (2026 knowledge review): each answer checked against the cited sources
  { q: 'how long do implants take to heal', expect: /3 to 6 months/, source: 'dental-implants' },
  { q: 'what is the success rate of implants', expect: /95%/, source: 'dental-implants' },
  { q: 'how long do dentures last', expect: /7 to 10 years/, source: 'dentures' },
  { q: 'can I sleep with my dentures in', expect: /out at night/, source: 'dentures' },
  { q: 'what types of bridges are there', expect: /cantilever/, source: 'dental-bridges' },
  { q: 'does a root canal last forever', expect: /lifetime|9 in 10/, source: 'root-canal-treatment' },
  { q: 'can I go to work after a root canal', expect: /same day/, source: 'root-canal-treatment' },
  { q: 'how long does swelling last after wisdom teeth', expect: /7 to 10 days/, source: 'wisdom-teeth' },
  { q: 'how much radiation is a dental xray', expect: /0\.005 mSv|low dose/, source: 'xray-safety' },
  { q: 'are xrays safe when pregnant', expect: /safe at any stage/, source: 'pregnancy-and-dental-care' },
  { q: 'is fluoride safe for kids', expect: /right amount|grain of rice/, source: 'fluoride' },
  { q: 'does fluoride lower IQ', expect: /1\.5 mg/, source: 'fluoride' },
  { q: 'do adults get sealants', expect: /Adults can have sealants/, source: 'dental-sealants' },
  { q: 'how long do sealants last', expect: /several years/, source: 'dental-sealants' },
  { q: 'is a deep cleaning necessary', expect: /Without treatment/, source: 'deep-cleaning' },
  { q: 'does a deep cleaning hurt', expect: /numbing/ },
  { q: 'what is a gummy smile fix', expect: /Gum contouring/, source: 'gum-contouring' },
  { q: 'my upper teeth hurt when I have a cold', expect: /sinus/, source: 'sinus-toothache' },
  { q: 'should I stop my blood thinner before an extraction', expect: /Don't stop a blood thinner/, source: 'medicines-and-dental-treatment' },
  { q: 'I take fosamax, can I have a tooth pulled', expect: /tell the dentist/, source: 'medicines-and-dental-treatment' },
  { q: 'is gum disease linked to heart disease', expect: /hasn't been proven/, source: 'gum-disease-and-overall-health' },
  { q: 'my kid has black spots after treatment', expect: /black/, source: 'childrens-treatments' },
  { q: 'does medicare cover dental', expect: /Original Medicare/, source: 'dental-insurance-basics' },
  { q: 'is a tongue piercing bad for teeth', source: 'oral-piercings' },
  { q: 'can I drive after the dentist', expect: /drive yourself home/, source: 'dental-anxiety-and-sedation' },
  { q: 'what toothpaste for seniors', expect: /[Ff]luoride toothpaste/, source: 'older-adults-dental-care' },
  { q: 'how long does sensitivity last after whitening', expect: /few days/ },
  { q: 'how long does the numbness last', expect: /two to four hours/ },
  { q: 'I need a filling', expect: /repairs a tooth damaged by decay/, not: /inlay, onlay/, source: 'fillings' },
  { q: 'my dentist said I need a crown', expect: /tooth-shaped cap/, source: 'dental-crowns' },
  { q: 'How much are veneers and do you offer payment plans?', expect: /\$950–\$2,500/, not: /CareCredit[\s\S]*CareCredit/ },
  { q: 'is invisalign painful', expect: /pressure or soreness/, source: 'clear-aligners' },
  { q: 'whats the recovery time for an implant', expect: /swelling, bruising and tenderness/, source: 'after-implant-surgery' },
  { q: 'can i drink coffee after whitening', expect: /48 hours/, source: 'after-whitening' },
  { q: 'will veneers look fake', expect: /look natural/, source: 'porcelain-veneers' },
  { q: 'can kids get braces', expect: /any age|age 7/, source: 'braces' },
  { q: 'do implants set off metal detectors', expect: /metal detectors/, source: 'dental-implants' },
  { q: 'how much is it to fix a chipped tooth', expect: /bonding \$300–\$700/, skill: 'price' },
  { q: 'is bonding permanent', expect: /3 to 10 years|reversible/, source: 'cosmetic-bonding' },
  { q: 'my teeth are yellow what can i do', expect: /cleaning or whitening/, source: 'tooth-discoloration' },
  { q: 'how long should a cleaning take', expect: /30 to 60 minutes/, source: 'checkup-and-cleaning' },
  { q: 'can i eat after a root canal', expect: /numbness wears off/, source: 'after-root-canal' },
  { q: 'is a root canal better than pulling the tooth', expect: /saving the tooth/, skill: 'compare' },
  { q: 'do i need to be numb for a filling', expect: /local anaesthetic/, source: 'fillings' },
  { q: 'how many implants for a full mouth', expect: /four to six implants/ },
  { q: 'will my insurance cover braces', expect: /Many plans cover part of the cost of braces/, skill: 'insurance' },
  { q: 'how old do you have to be for invisalign', expect: /adults and teenagers/ },
  { q: 'whats the difference between a crown and a filling', expect: /Crowns:[\s\S]*Fillings:/, skill: 'compare' },
  { q: 'can my gums grow back', expect: /does not grow back/, source: 'receding-gums' },
  { q: 'is flossing really necessary', expect: /important because/, source: 'brushing-and-flossing' },
  { q: 'electric or manual toothbrush', expect: /electric/, source: 'brushing-and-flossing' },
  { q: 'do you do teeth cleaning on saturdays', expect: /^Yes[\s\S]*Saturdays we're open 9 AM–1 PM/ },
  { q: 'my kid knocked out a baby tooth', expect: /Don't try to put a knocked-out baby tooth back in/, skill: 'safety_soon' },
  { q: 'how do i stop grinding my teeth', expect: /night guard/, source: 'teeth-grinding' },
  { q: "i'm pregnant can i get a filling", expect: /considered safe/, source: 'pregnancy-and-dental-care' },
  { q: 'what age should my child get braces', expect: /age 7/, source: 'braces' },
  { q: 'what are your fees for a new patient exam', expect: /\$150–\$300/ },
  { q: 'can you replace a missing front tooth', expect: /implant/i, source: 'missing-teeth-options' },
  { q: 'i want a hollywood smile', expect: /custom-made shells/, source: 'porcelain-veneers' },
  { q: 'what should i do if my filling falls out', expect: /keep the crown|call the practice/, source: 'lost-filling-or-crown' },
  { q: 'how long is a veneer appointment', expect: /two or three visits/ },
  { q: 'how often do i need xrays', expect: /How often you need them/, source: 'xray-safety' },
  { q: 'is mouthwash good for you', expect: /does not replace brushing/, source: 'mouthwash' },
  { q: 'can a cracked tooth heal on its own', expect: /does not heal on its own/, source: 'cracked-tooth' },
  { q: 'will a crown look natural', expect: /natural|appearance/, source: 'dental-crowns' },
  { q: 'how long after extraction can i get an implant', expect: /3 to 4 months/ },
  { q: 'can you fix gaps without braces', expect: /bonding/, not: /Yes — braces/, source: 'gaps-between-teeth' },
  { q: 'do i need antibiotics before dental work', expect: /Most people do not need antibiotics/, skill: 'medication_question' },
  { q: 'how do i care for my veneers', expect: /Avoid biting very hard things/ },
  { q: 'what happens if i dont replace a missing tooth', expect: /drifting/ },
  { q: 'whats the cheapest way to replace teeth', expect: /most affordable/ },
  { q: 'do you see emergency patients', expect: /sees emergency patients/, skill: 'emergency_info' },
  { q: 'whats your phone number', expect: /\(555\) 014-2200/, skill: 'contact_info' },
  { q: 'who are the dentists', expect: /Dr\. Maya Patel/, skill: 'team' },
  { q: 'do you accept walk ins', expect: /[Ww]alk-ins are welcome/, skill: 'walk_in' },
  { q: 'hiii i need my teeth cleaned asap', skill: 'offer_slots' },
  { q: 'my dentures hurt when i chew', expect: /sore spots|few weeks/, source: 'dentures' },
  { q: 'does fluoride cause cancer', expect: /no link/, source: 'fluoride' },
  { q: 'can i smoke after getting a tooth pulled', expect: /smoking/, source: 'after-extraction' },
  { q: 'my gums are receding what do i do', expect: /gum graft|soft toothbrush/, source: 'receding-gums' },
  { q: 'how long does a filling last', expect: /7 to 10 years/, source: 'fillings' },
  { q: 'whats an onlay', expect: /too damaged for a filling/, source: 'inlays-and-onlays' },
  { q: 'is laughing gas safe for kids', expect: /considered safe/, source: 'dental-anxiety-and-sedation' },
  { q: 'can you whiten just one tooth', expect: /single dark tooth/ },
  { q: 'my teeth hurt when i drink cold stuff', source: 'tooth-sensitivity', not: /emergency/ },
  { q: 'when do babies get teeth', expect: /around 6 months/, source: 'teething-and-baby-teeth' },
  { q: 'my child grinds his teeth at night', expect: /common in children/, source: 'teeth-grinding' },
  { q: 'i lost my retainer', expect: /contact the practice soon/, source: 'retainers' },
  { q: 'can i get veneers on just one tooth', expect: /single tooth/ },
  { q: 'whats the healing time after wisdom teeth', expect: /about a week/, source: 'wisdom-teeth' },
  { q: 'whats a cavity', expect: /cavity/, source: 'tooth-decay' },
  { q: 'are silver fillings safe', expect: /safe for most people/, source: 'amalgam-fillings' },
  { q: 'i have a sore that wont heal', expect: /two to three weeks|won't heal/, source: 'mouth-sores-and-oral-cancer' },
  { q: 'i snore a lot can you help', expect: /oral appliance/, source: 'sleep-apnea-and-snoring' },
  { q: 'does insurance pay for whitening', expect: /considered cosmetic/, skill: 'insurance' },
  { q: 'whats a deductible', expect: /deductible is what you pay/, source: 'dental-insurance-basics' },
  { q: 'can i pay with care credit', expect: /CareCredit/, skill: 'financing' },
  { q: 'im 70 can i still get implants', expect: /Age alone isn't a barrier/ },
  { q: 'will i lisp with invisalign', expect: /lisp/ },
  { q: 'what if my aligner cracks', expect: /cracks or is lost/ },
  { q: 'my crown feels loose', skill: 'safety_soon', source: 'lost-filling-or-crown' },
  { q: 'there is a bump on my gum', expect: /sign of infection/, skill: 'safety_soon' },
  { q: 'i bit my tongue and its bleeding', expect: /15 to 20 minutes/, skill: 'safety_soon' },
  { q: 'my teeth feel loose', expect: /gum disease/, skill: 'safety_soon' },
  { q: 'can energy drinks damage teeth', source: 'tooth-erosion' },
  { q: 'should i brush before or after breakfast', expect: /wait about an hour/ },
  { q: 'how long should i brush for', expect: /two minutes/ },
  { q: 'do you offer free consultations', expect: /are free/, source: 'new-patients' },
  { q: 'can i get a quote over the phone', expect: /Which treatment/, skill: 'price' },
  { q: 'book me with dr okafor next week', expect: /Dr\. Okafor/, skill: 'offer_slots' },
  { q: 'im scared of needles', expect: /numbing gel/ },
  { q: 'i have a strong gag reflex', expect: /gag reflex/ },
  // ------------------------------------------------------------ reasoning from the clinic's own prices and the library
  { q: 'how much would 3 veneers cost', expect: /For 3 veneers.*\$2,850–\$7,500/, skill: 'price' },
  { q: 'my insurance covers 50%, how much would a crown cost me', expect: /your share for a crown would be roughly \$500–\$900/, skill: 'price' },
  { q: "what's the cheapest way to replace a missing tooth", expect: /dentures are usually the most affordable.*then bridges.*then dental implants/, skill: 'compare' },
  { q: 'which lasts longer, an implant or a bridge', expect: /Dental implants usually last longer.*5 to 15 years/, skill: 'compare' },
  { q: 'which is faster, invisalign or braces', expect: /Clear aligners are usually quicker.*18 to 24 months/, skill: 'compare' },
  { q: 'if i start invisalign now when will i be done', expect: /finished between April 2027 and April 2028/ },
  { q: "i'm getting married next june, can i get braces done by then", expect: /most cases wouldn't be finished by then/, source: 'braces' },
  { q: 'can i get my teeth straight with invisalign before my wedding in march 2028', expect: /could be tight/, source: 'clear-aligners' },
  // ------------------------------------------------------------ calibrated urgency and long messages
  { q: "I chipped my front tooth but it doesn't hurt", expect: /isn’t an emergency/, skill: 'safety_soon' },
  {
    q: "I've had a throbbing pain on my left side for about a week and it wakes me up at night. I'm really nervous about dentists and I don't have insurance. How much would it cost to get it checked and can you see me this week?",
    expect: /wakes you at night[\s\S]*\$150–\$300 per visit without insurance[\s\S]*go at your pace[\s\S]*next available times for a consultation:/,
    skill: /^knowledge\+price\+knowledge\+offer_slots$/,
  },
  { q: 'can you see me this week?', skill: 'offer_slots' },
  { q: "can you see me if i don't have insurance?", expect: /very welcome without insurance.*membership plan/, skill: 'insurance' },
  { q: "what's your name", expect: /virtual assistant for Brightside Dental/, skill: 'smalltalk' },
  { q: 'i hate my smile', source: 'smile-makeover' },
  { q: "i havent been to the dentist in years and im embarrassed", source: 'returning-after-years' },
];

/** Multi-turn conversations: context, follow-ups, booking and corrections. */
export const SCRIPTS: Script[] = [
  {
    name: 'follow-up questions keep the topic',
    turns: [
      { say: 'tell me about veneers', expect: /thin, custom-made shells/, source: 'porcelain-veneers' },
      { say: 'how long do they last?', expect: /10 to 15 years/ },
      { say: 'how much are they', expect: /\$950–\$2,500 per tooth/, skill: 'price' },
    ],
  },
  {
    name: '"what about X?" reuses the last question',
    turns: [
      { say: 'how long do implants last?', expect: /decades/ },
      { say: 'what about veneers?', expect: /10 to 15 years/ },
      { say: 'and crowns?', expect: /5 to 15 years/, not: /two visits/, source: 'dental-crowns' },
    ],
  },
  {
    name: 'price follow-up for another treatment',
    turns: [
      { say: 'how much is whitening', expect: /\$350–\$750/ },
      { say: 'and invisalign?', expect: /\$3,500–\$6,500/, skill: 'price' },
      { say: 'what about a cleaning', expect: /\$150–\$300/, skill: 'price' },
    ],
  },
  {
    name: 'a "yes" still means yes after a side question',
    turns: [
      { say: 'how much are dental implants?', expect: /Would you like to book/ },
      { say: 'how long does the whole process take?', expect: /3 to 6 months|several months/ },
      { say: 'yes', skill: 'offer_slots' },
    ],
  },
  {
    name: 'booking with a bare name and number',
    turns: [
      { say: 'I want to book a cleaning', skill: 'offer_slots' },
      { say: 'the second one', expect: /name/ },
      { say: 'Sarah Connor', expect: /Sarah/, not: /not sure|didn't catch/ },
      { say: '555-201-3344', skill: 'booked', expect: /You're all set, Sarah/ },
    ],
  },
  {
    name: 'name volunteered on its own is remembered',
    turns: [
      { say: 'hi', skill: 'greet' },
      { say: 'Sarah Connor', expect: /Sarah/, not: /not sure|didn't catch/ },
      { say: 'how much is whitening?', expect: /\$350–\$750/ },
    ],
  },
  {
    name: 'a stray number without a list is clarified, not misread',
    turns: [
      { say: 'hi', skill: 'greet' },
      { say: '2', not: /I'm not sure about that one, and I'd rather not guess/ },
    ],
  },
  {
    name: 'booking with date, time and details in one go',
    turns: [
      { say: 'can I book whitening for tuesday at 10am', expect: /Tue, Oct 20 at 10 AM/, skill: 'offer_slots' },
      { say: 'the first one', expect: /name/ },
      { say: "I'm Tom Baker, tom@example.com", skill: 'booked', expect: /tom@example\.com/ },
    ],
  },
  {
    name: 'corrections are applied',
    turns: [
      { say: 'book me in for a check-up', skill: 'offer_slots' },
      { say: '1', expect: /name/ },
      { say: 'Jane Doe', expect: /phone|email/ },
      { say: 'actually my name is Jane Smith, 555 404 1212', skill: 'booked', expect: /Jane/ },
    ],
  },
  {
    name: 'other times on request',
    turns: [
      { say: 'I need a cleaning', expect: /cleaning/i },
      { say: 'book it', skill: 'offer_slots' },
      { say: 'do you have anything later in the day?', skill: 'offer_slots', expect: /PM/ },
    ],
  },
  {
    name: 'question in the middle of booking, then back to it',
    turns: [
      { say: 'I want to book a consultation for implants', skill: 'offer_slots' },
      { say: 'wait, does it hurt?', expect: /discomfort|pain/ },
      { say: 'ok the first one then', expect: /name/ },
    ],
  },
  {
    name: 'urgent problem: callback captured',
    turns: [
      { say: 'I broke my tooth and it really hurts', skill: /safety_urgent/ },
      { say: 'Tom Hardy 555 777 1234', skill: 'urgent_callback', expect: /urgent/ },
      { say: 'yes', skill: 'offer_slots' },
    ],
  },
  {
    name: 'anxious patient',
    turns: [
      { say: "I'm terrified of the dentist but I really need a cleaning", expect: /nervous|anxi|sedation|your pace/i },
      { say: 'do you have laughing gas?', expect: /[Nn]itrous oxide|laughing gas/ },
    ],
  },
  {
    name: 'no repetition on repeated follow-ups',
    turns: [
      { say: 'tell me about invisalign', source: 'clear-aligners' },
      { say: 'how long does it take', expect: /6 to 18 months/ },
      { say: 'how long does it take?', not: /^Many cases take around 6 to 18 months, depending on how far the teeth need to move\.$/ },
    ],
  },
  {
    name: 'clinic hours follow-up by day',
    turns: [
      { say: 'are you open on saturday?', expect: /^Yes/ },
      { say: 'what about sunday?', expect: /closed/, skill: 'hours' },
    ],
  },
  {
    name: 'opting out stops everything politely',
    turns: [
      { say: 'how much are veneers', skill: 'price' },
      { say: 'please stop emailing me', skill: 'opt_out' },
    ],
  },
  {
    name: 'emergency in the middle of a chat',
    turns: [
      { say: 'how much is whitening', skill: 'price' },
      { say: 'my face is swollen and it is spreading to my eye', skill: 'safety_er' },
    ],
  },
  {
    name: 'declining booking is respected',
    turns: [
      { say: 'how much are crowns', expect: /Would you like to book/ },
      { say: 'no thanks', expect: /No problem/ },
      { say: 'what are your hours', skill: 'hours', not: /Would you like to book/ },
    ],
  },
  {
    name: 'remembers a pregnancy for later answers',
    turns: [
      { say: "i'm pregnant", source: 'pregnancy-and-dental-care' },
      { say: 'can i get my teeth whitened?', expect: /postponed during pregnancy/ },
    ],
  },
  {
    name: 'remembers smoking for surgical questions',
    turns: [
      { say: 'i smoke', source: 'smoking-and-oral-health' },
      { say: 'can i get dental implants?', expect: /As you smoke: smoking raises the risk of an implant failing/ },
    ],
  },
  {
    name: 'remembers no insurance for prices',
    turns: [
      { say: "i don't have insurance", expect: /No problem.*membership plan/, skill: 'insurance' },
      { say: 'how much is a check-up?', expect: /\$150–\$300[\s\S]*membership plan/, not: /insurance may cover/, skill: 'price' },
    ],
  },
  {
    name: '"tell me more" continues the same article',
    turns: [
      { say: 'how long do implants last', expect: /decades/, source: 'dental-implants' },
      { say: 'tell me more', source: 'dental-implants', not: /can last for decades/ },
    ],
  },
  {
    name: '"explain that more simply" uses plain words',
    turns: [
      { say: 'what is a root canal', expect: /pulp/, source: 'root-canal-treatment' },
      { say: 'can you explain that more simply', expect: /^In plain terms: When the soft inside of a tooth/ },
    ],
  },
  {
    name: '"that didn\'t answer my question" asks what they meant, then offers the team',
    turns: [
      { say: 'how long do veneers last', expect: /10 to 15 years/ },
      { say: "that didn't answer my question", expect: /what would you like to know about porcelain veneers/, not: /[Bb]onding/ },
      { say: "that didn't answer it either", expect: /someone from the team/ },
    ],
  },
];
