/**
 * Plain-language versions of the library's main articles, for "can you
 * explain that more simply?", and a glossary of the dental words patients
 * trip over. Each restates facts already in the article, in everyday words.
 */

export const PLAIN: Record<string, string> = {
  'dental-implants':
    'An implant is a small metal post placed in your jawbone where a tooth is missing. Over a few months it bonds with the bone, then a false tooth (a crown) is fixed on top, so it looks and works like a real tooth.',
  'implant-supported-dentures':
    "It's a full set of false teeth that clips or screws onto a few implants in your jaw, so the teeth stay put instead of slipping like a regular denture.",
  'clear-aligners':
    "You wear a series of clear plastic trays, each one slightly different, for most of the day. Every week or two you move to the next tray, and your teeth slowly shift into place.",
  braces: 'Small brackets are glued to your teeth and joined by a wire. The dentist adjusts it every few weeks, and over a year or two your teeth move into a better position.',
  'porcelain-veneers': 'Veneers are very thin, tooth-coloured covers glued onto the front of your teeth to change how they look: their colour, shape or small gaps.',
  'cosmetic-bonding': 'The dentist paints tooth-coloured filling material onto the tooth, shapes it, and hardens it with a light, to fix a chip or a small gap, usually in one visit.',
  'teeth-whitening': 'A bleaching gel lightens the colour of your natural teeth, either in one visit at the office or with trays you wear at home.',
  'dental-crowns': "A crown is a cap shaped like a tooth that fits over a damaged tooth to protect it and make it look normal again.",
  'dental-bridges': 'A bridge is a false tooth held in the gap by attaching it to the teeth, or implants, on either side.',
  dentures: 'Dentures are removable false teeth: a full set, or a partial one that fills the gaps between your own teeth.',
  'root-canal-treatment':
    "When the soft inside of a tooth, where the nerve is, gets infected or inflamed, the dentist numbs the tooth, cleans out the inside and seals it. That lets you keep the tooth instead of having it pulled.",
  'tooth-extraction': "It means taking a tooth out. The area is numbed first, so you feel pressure but shouldn't feel sharp pain.",
  'wisdom-teeth': "Wisdom teeth are the last teeth right at the back. If they're stuck, keep getting infected, damage other teeth or are hard to clean, they can be taken out.",
  fillings: 'When decay makes a hole in a tooth, the dentist cleans out the decay and fills the hole, usually with tooth-coloured material.',
  'checkup-and-cleaning': "The hygienist cleans off hardened plaque you can't brush away and polishes your teeth, and the dentist checks for any problems while they're small.",
  'inlays-and-onlays': "It's a custom-made piece that repairs a large damaged area of a back tooth: bigger than a filling, but smaller than a crown.",
  'bone-grafts': "If there isn't enough jawbone to hold an implant, bone material is added and your own bone slowly grows into it.",
  'gum-disease':
    "It's an infection of the gums caused by plaque. Early on, gums get red and bleed and it can be reversed; left alone, it can damage the bone and loosen teeth.",
  'deep-cleaning': 'It cleans bacteria and hardened plaque from under the gums when gum disease has started, so the gums can heal and tighten around the teeth again.',
  'tooth-sensitivity': "It's a quick, sharp twinge when your teeth meet something cold, hot or sweet, usually because the softer inner layer of the tooth is exposed.",
  'teeth-grinding': 'Some people clench or grind their teeth, often while asleep. It can wear teeth down and make the jaw sore, and a custom night guard protects the teeth.',
  'bad-breath': "It's usually caused by bacteria in the mouth, especially on the tongue and between the teeth, so cleaning those places every day usually fixes it.",
  'receding-gums': "The gums slowly pull back from the teeth, showing more of the tooth's root, which can make the tooth sensitive.",
  'cracked-tooth': "It's a crack in a tooth that can hurt when you bite. It doesn't heal by itself and can spread, so it needs to be checked.",
  'dry-mouth': "Your mouth isn't making enough saliva, often because of a medicine. Saliva protects the teeth, so a dry mouth makes cavities more likely.",
  'tooth-decay': 'Bacteria turn sugar into acid that eats into the tooth. Once it makes a hole (a cavity), the tooth needs a filling.',
  'tooth-erosion': "Acid from drinks, food or the stomach slowly wears away the hard outer layer of the teeth, and that layer doesn't grow back.",
  'dental-sealants': 'A thin protective coating is painted into the grooves of the back teeth, so food and bacteria can’t settle there and cause cavities.',
  'gum-contouring': 'The gum line is reshaped, usually with a laser, so more of each tooth shows and the smile looks more even.',
  'dental-abscess': "It's a pocket of infection at the root of a tooth or in the gum. It won't go away on its own and needs the dentist to treat it.",
  'dental-anxiety-and-sedation': 'Lots of people feel nervous at the dentist. The team can go slowly, explain each step, and if needed give you medicine that helps you relax.',
  fluoride: "Fluoride is a natural mineral that makes the outer layer of your teeth stronger and helps stop cavities.",
  'xray-safety': "Dental X-rays use a very small amount of radiation, less than you get from nature in a day, to show problems the dentist can't see just by looking.",
  'sinus-toothache': 'Your upper back teeth sit right under your sinuses, so a blocked, inflamed sinus can make those teeth ache even when the teeth are healthy.',
  'missing-teeth-options': 'A gap can be filled three main ways: an implant (a fixed false tooth on a post), a bridge (a false tooth attached to the teeth beside it), or a removable denture.',
};

/** Dental words and what they mean in everyday terms. */
export const GLOSSARY: [RegExp, string, string][] = [
  [/\bpulp\b/i, 'pulp', 'the soft inside of a tooth, where the nerve and blood vessels are'],
  [/\bcanals?\b/i, 'canals', "the narrow channels inside a tooth's roots"],
  [/\benamel\b/i, 'enamel', 'the hard outer layer of a tooth'],
  [/\bdentine?\b/i, 'dentin', 'the softer layer under the enamel'],
  [/\bplaque\b/i, 'plaque', 'the sticky film of bacteria that forms on teeth every day'],
  [/\btartar\b|\bcalculus\b/i, 'tartar', 'plaque that has hardened on the teeth, which only a cleaning removes'],
  [/\bcaries\b/i, 'caries', 'tooth decay'],
  [/\bgingivitis\b/i, 'gingivitis', 'early, mild gum disease that can be reversed'],
  [/\bperiodontitis\b|\bperiodontal\b/i, 'periodontitis', 'advanced gum disease that affects the bone around the teeth'],
  [/\bana?esthe(?:tic|sia)\b/i, 'local anaesthetic', 'a numbing injection, so you don’t feel pain'],
  [/\bsedation\b/i, 'sedation', 'medicine that helps you feel relaxed'],
  [/\bnitrous oxide\b/i, 'nitrous oxide', 'laughing gas'],
  [/\babutment\b/i, 'abutment', 'the small connector that joins an implant to its crown'],
  [/\bimpacted\b/i, 'impacted', 'stuck under the gum or bone instead of coming through'],
  [/\bmolars?\b/i, 'molars', 'the big back teeth you chew with'],
  [/\bbruxism\b/i, 'bruxism', 'teeth grinding or clenching'],
  [/\btmj\b|\btmd\b/i, 'TMJ', 'the jaw joint, just in front of the ear'],
  [/\bxerostomia\b/i, 'xerostomia', 'dry mouth'],
  [/\bcone-beam\b|\bcbct\b/i, 'cone-beam CT', 'a 3D X-ray scan'],
  [/\bscaling and root planing\b/i, 'scaling and root planing', 'a deep cleaning below the gum line'],
  [/\bfluorosis\b/i, 'fluorosis', 'faint white marks on teeth from too much fluoride while they were forming'],
  [/\bcomposite\b/i, 'composite', 'tooth-coloured filling material'],
  [/\bamalgam\b/i, 'amalgam', 'silver filling material'],
  [/\bdry socket\b/i, 'dry socket', 'when the blood clot in the hole left by a pulled tooth comes away too early, leaving the bone exposed and sore'],
  [/\babscess\w*\b/i, 'abscess', 'a pocket of infection'],
  [/\bosseointegrat\w*|\bfuses? with the (?:jaw)?bone\b/i, 'fusing with the bone', 'the jawbone growing tightly around an implant so it holds firm'],
  [/\bsinus lift\b/i, 'sinus lift', 'adding bone above the upper back teeth so there is room for an implant'],
  [/\binterdental\b/i, 'interdental brush', 'a tiny brush for cleaning between the teeth'],
  [/\bcrown\b/i, 'crown', 'a cap shaped like a tooth that covers and protects it'],
  [/\bextract\w*\b/i, 'extraction', 'taking a tooth out'],
  [/\bendodontist\b/i, 'endodontist', 'a dentist who specialises in root canals'],
  [/\bperiodontist\b/i, 'periodontist', 'a dentist who specialises in gums'],
  [/\borthodontist\b/i, 'orthodontist', 'a dentist who specialises in straightening teeth'],
];

/** Everyday meanings for the dental words in a piece of text ("pulp — the soft inside of a tooth…"). */
export function explainTerms(text: string, max = 4): string[] {
  const out: string[] = [];
  for (const [re, word, meaning] of GLOSSARY) {
    if (out.length >= max) break;
    if (re.test(text)) out.push(`${word} means ${meaning}`);
  }
  return out;
}
