// Morpheme puzzle pieces (her request 2026-10-15, with a picture of white "re- | sist | -ed" jigsaw pieces and
// two uploads: the DSF "Level 1 Unit 1 Morpheme Tile Cards" deck and the "111 Roots, Suffixes, and Prefixes"
// Greek/Latin list). Every morpheme from both is here, sorted the way she asked: prefixes, suffixes, free
// bases (words on their own, like "play") and Greek & Latin roots.
//
// Pieces connect by position, not by a dictionary: a piece with a tab on its right (prefix, base, root, and a
// suffix that can take another suffix) fits into a piece with a notch on its left (base, root, suffix). So a
// student can build real words AND made-up words out of real parts (the 111 list's own Greekymon activity);
// the board then says whether the result is a real word and what each part means. Nothing is ever "wrong."

export type MorphemeKind = 'prefix' | 'suffix' | 'base' | 'root';

export interface Morpheme {
  id: string;
  text: string; // the spelling on the piece, no hyphen
  kind: MorphemeKind;
  meaning: string;
  origin?: string; // only where the source says (the DSF deck labels each card); the 111 list doesn't per item
  example?: string;
  note?: string; // the deck's "alternate form of" / "chameleon with" note
  endsWord?: boolean; // inflectional suffixes (-s, -es, -ed, -ing, comparison -er, -est) close a word: no tab
}

// [text, meaning, example?, note?]
type Row = [string, string, string?, string?];

const make = (kind: MorphemeKind, origin: string | undefined, rows: Row[], extra?: Partial<Morpheme>): Morpheme[] =>
  rows.map(([text, meaning, example, note]) => ({ id: `${kind}-${text}-${meaning.slice(0, 12).replace(/\W+/g, '')}`, text, kind, meaning, origin, example, note, ...extra }));

// ---- DSF Level 1 Unit 1 Morpheme Tile Cards (47 cards) ----
const L1U1_BASES = make('base', 'Anglo-Saxon', [
  ['hope', 'to wish that something you want will happen', 'hopeful'],
  ['kind', 'gentle, caring, helpful', 'kindness'],
  ['do', 'to perform or carry out an action', 'redo'],
  ['neighbor', 'someone who lives nearby', 'neighborhood'],
]);

const L1U1_LATIN_ROOTS = make('root', 'Latin', [
  ['tract', 'to pull', 'tractor'],
  ['ject', 'to throw', 'reject'],
  ['act', 'to do', 'action'],
  ['port', 'to carry', 'transport'],
  ['rupt', 'to break', 'erupt'],
  ['struct', 'to build or pile up', 'structure', 'alternate form of stroy'],
  ['stroy', 'to build or pile up', 'destroy', 'alternate form of struct'],
  ['press', 'to press or hold tight', 'pressure'],
]);

const L1U1_PREFIXES: Morpheme[] = [
  ...make('prefix', 'Anglo-Saxon', [['un', 'not, opposite of', 'unkind']]),
  ...make('prefix', 'Latin', [
    ['dis', 'away, apart', 'distract', 'chameleon with di-'],
    ['re', 'back, again; undo', 'redo'],
    ['sub', 'under', 'subtract', 'chameleon with sup-'],
    ['in', 'in, into, on, upon; not', 'inject', 'chameleon with im-'],
    ['pro', 'forward', 'project'],
    ['ob', 'in front of, towards, against', 'object'],
    ['ex', 'out, away', 'export', 'chameleon with e-'],
    ['trans', 'beyond, across', 'transport'],
    ['e', 'out, away', 'erupt', 'chameleon with ex-'],
    ['at', 'to, towards, near', 'attract', 'chameleon with ad-, as-, a-'],
    ['ad', 'to, towards, near', 'adjust', 'chameleon with at-, as-, a-'],
    ['im', 'in, into, on, upon; not', 'import', 'chameleon with in-'],
    ['con', 'with, together', 'construct', 'chameleon with com-, cor-'],
    ['de', 'down, off, totally, out, away', 'destroy'],
    ['sup', 'under', 'support', 'chameleon with sub-'],
    ['com', 'with, together', 'compress', 'chameleon with con-, cor-'],
  ]),
];

const L1U1_SUFFIXES: Morpheme[] = [
  ...make('suffix', 'Anglo-Saxon', [
    ['s', 'plural; third person', 'hopes', 'alternate form of -es'],
    ['es', 'plural; third person', 'does', 'alternate form of -s'],
    ['ed', 'past tense', 'hoped'],
    ['ing', 'continuous tense verb', 'hoping'],
    ['er', 'comparison (more)', 'kinder'],
    ['est', 'superlative (most)', 'kindest'],
  ], { endsWord: true }),
  ...make('suffix', 'Anglo-Saxon', [
    ['ful', 'full of', 'hopeful'],
    ['less', 'lacking, not having', 'hopeless'],
    ['ness', 'quality or state of', 'kindness'],
    ['hood', 'condition or state of being', 'neighborhood'],
    ['ly', 'having the quality of', 'kindly'],
    ['er', 'one who does or makes', 'reporter', 'alternate form of -or'],
  ]),
  ...make('suffix', 'Latin', [
    ['or', 'one who does or makes', 'actor', 'alternate form of -er'],
    ['ion', 'noun of action', 'action', 'alternate form of -(at)ion'],
    ['ive', 'having the quality or tendency of', 'active', 'alternate form of -(at)ive'],
    ['able', 'capable of', 'portable', 'alternate form of -ible'],
    ['ible', 'capable of', 'destructible', 'alternate form of -able'],
    ['ure', 'action or process', 'structure'],
  ]),
];

// The board's original free bases, kept ("free bases, such as play").
const BOARD_BASES = make('base', 'Anglo-Saxon', [
  ['play', 'to have fun or take part in a game', 'replay'],
  ['help', 'to make something easier for someone', 'helpful'],
  ['care', 'to look after; to feel that something matters', 'careful'],
  ['happy', 'feeling glad', 'unhappy'],
]);

// ---- "111 Roots, Suffixes, and Prefixes" (Greek/Latin, with English equivalents and examples) ----
// Items the list shares with the DSF deck (ex-, in-/im-, sub-, trans, port, struct, or, er) are not repeated;
// the deck's card already carries them.
const LIST_PREFIXES = make('prefix', undefined, [
  ['a', 'without', 'apathy'],
  ['anti', 'against', 'antibiotic'],
  ['di', 'two', 'diode'],
  ['hyper', 'over, above', 'hyperactive'],
  ['inter', 'between', 'interact'],
  ['intra', 'within', 'intranet'],
  ['peri', 'around', 'perimeter'],
  ['post', 'after', 'postlude'],
  ['pre', 'before', 'preview'],
  ['pseudo', 'not true', 'pseudoscience'],
  ['tri', 'three', 'triceratops'],
  ['uni', 'one', 'unicycle'],
]);

const LIST_SUFFIXES = make('suffix', undefined, [
  ['cracy', 'rule', 'democracy'],
  ['ist', 'one who', 'technologist'],
  ['eer', 'one who', 'engineer'],
  ['mania', 'madness', 'Pokémania'],
  ['ology', 'to study', 'geology'],
  ['phobia', 'fear', 'claustrophobia'],
]);

const LIST_ROOTS = make('root', undefined, [
  ['annu', 'year', 'annual'], ['anni', 'year', 'anniversary'],
  ['anthro', 'human', 'anthropology'],
  ['aqua', 'water', 'aquarium'],
  ['archea', 'ancient', 'archaeologist'],
  ['astro', 'star', 'astrologist'],
  ['aud', 'sound', 'audio'],
  ['auto', 'self', 'autocrat'],
  ['bene', 'good', 'beneficial'],
  ['bibl', 'book', 'bibliography'],
  ['bio', 'life', 'biology'],
  ['cardio', 'heart', 'cardiologist'],
  ['carn', 'meat', 'carnivore'],
  ['ced', 'move', 'precede'], ['ceed', 'move', 'proceed'],
  ['cent', 'hundred', 'centimeter'],
  ['ceph', 'head', 'cephalopod'],
  ['chrom', 'color', 'monochrome'],
  ['chron', 'time', 'chronology'],
  ['cosm', 'world, universe', 'cosmos'],
  ['cred', 'believe', 'incredible'],
  ['deca', 'ten', 'decagon'],
  ['demo', 'people', 'democracy'],
  ['derma', 'skin', 'dermatologist'],
  ['dict', 'say', 'dictate'],
  ['dino', 'terrible', 'dinosaur'],
  ['domest', 'home', 'domestic'],
  ['dorm', 'sleep', 'dormant'],
  ['dyna', 'power', 'dynamic'],
  ['equ', 'equal', 'equator'],
  ['flor', 'plants', 'floral'],
  ['geo', 'earth', 'geography'],
  ['graph', 'write', 'telegraph'],
  ['helio', 'sun', 'heliocentric'],
  ['hexa', 'six', 'hexagon'],
  ['hydro', 'water', 'hydrofoil'],
  ['igni', 'fire', 'ignite'],
  ['legis', 'law', 'legislature'], ['lega', 'law', 'legal'],
  ['lexi', 'word', 'lexicon'],
  ['lib', 'free', 'liberty'],
  ['lumin', 'light', 'luminosity'],
  ['macro', 'large', 'macroeconomics'],
  ['matr', 'mother', 'matriarch'],
  ['mega', 'large', 'megaphone'],
  ['mem', 'remember', 'memory'],
  ['mer', 'ocean', 'mermaid'], ['mar', 'ocean', 'marine'],
  ['meter', 'measure', 'speedometer'],
  ['micro', 'small', 'microscopic'],
  ['mobil', 'move', 'automobile'],
  ['mono', 'one', 'monopoly'],
  ['morpho', 'shape', 'morphology'],
  ['multi', 'many', 'multitalented'],
  ['nano', 'tiny', 'nanometer'],
  ['neo', 'new', 'neoclassic'],
  ['nov', 'nine', 'November'],
  ['olig', 'a group', 'oligarchy'],
  ['omni', 'all', 'omnivorous'],
  ['onym', 'name', 'synonym'],
  ['ortho', 'straight', 'orthogonal'],
  ['paleo', 'ancient', 'paleontologist'],
  ['pan', 'including all', 'panorama'],
  ['path', 'feeling', 'apathy'],
  ['patr', 'father', 'patriarch'],
  ['ped', 'foot', 'pedestrian'],
  ['penta', 'five', 'pentagon'],
  ['petr', 'rock', 'petrified'],
  ['phil', 'love', 'Philadelphia'],
  ['phon', 'sound', 'telephone'],
  ['phyto', 'plant', 'phytoplankton'],
  ['poli', 'city', 'metropolis'],
  ['poly', 'many', 'polyhedron'],
  ['popu', 'people', 'population'],
  ['proto', 'first', 'prototype'],
  ['psych', 'mind', 'psychology'],
  ['pub', 'people', 'public'],
  ['sci', 'knowledge', 'science'],
  ['scope', 'see', 'telescope'],
  ['sept', 'seven', 'September'],
  ['somn', 'sleep', 'insomnia'],
  ['tele', 'far', 'telephone'],
  ['terra', 'earth', 'terra cotta'],
  ['tetra', 'four', 'tetrahedron'],
  ['theo', 'god', 'theocracy'],
  ['therm', 'heat', 'thermostat'],
  ['toxi', 'poisonous', 'toxic'],
  ['vac', 'empty', 'vacuum'],
  ['velo', 'quick', 'velocity'],
  ['veri', 'truth', 'verify'],
  ['vor', 'eat', 'carnivore'],
  ['zo', 'animal', 'zoology'],
  // From the list's "Thirty-Five Sets" page, roots not in the 111 table itself.
  ['soph', 'wisdom', 'philosophy'],
  ['phile', 'love', 'bibliophile'],
  ['ling', 'language', 'bilingual'], ['lang', 'language', 'language'],
]);

const byText = (a: Morpheme, b: Morpheme) => a.text.localeCompare(b.text) || a.meaning.localeCompare(b.meaning);

// In the order a word is built: prefixes, then bases and roots, then suffixes last (her request 2026-10-15).
export const MORPHEME_GROUPS: { key: string; label: string; items: Morpheme[] }[] = [
  { key: 'prefixes', label: 'Prefixes', items: [...L1U1_PREFIXES, ...LIST_PREFIXES].sort(byText) },
  { key: 'bases', label: 'Free bases', items: [...L1U1_BASES, ...BOARD_BASES].sort(byText) },
  { key: 'roots', label: 'Greek & Latin roots', items: [...L1U1_LATIN_ROOTS, ...LIST_ROOTS].sort(byText) },
  { key: 'suffixes', label: 'Suffixes', items: [...L1U1_SUFFIXES, ...LIST_SUFFIXES].sort(byText) },
];

// Pastel piece colors (her request 2026-10-15), one per kind of part, always with black text.
export const KIND_COLOR: Record<MorphemeKind, string> = {
  prefix: '#DCCFF5', // lavender purple
  base: '#D3E4CD', // light sage green
  root: '#FFD3A8', // light creamsicle orange
  suffix: '#C9E4F8', // baby blue
};

export const ALL_MORPHEMES: Morpheme[] = MORPHEME_GROUPS.flatMap((g) => g.items);
export const morphemeById = (id: string | undefined) => ALL_MORPHEMES.find((m) => m.id === id);

// Blank pieces (her request 2026-10-15): one of each shape with no text; double tap a placed one to type a
// word part that isn't on the lists.
export const BLANK_MORPHEMES: Morpheme[] = (['prefix', 'base', 'root', 'suffix'] as MorphemeKind[]).map((kind) => ({ id: `blank-${kind}`, kind, text: '', meaning: '' }));
export const isBlankMorpheme = (id: string | undefined) => !!id && id.startsWith('blank-');
export function morphemeFor(id: string | undefined, customText?: string): Morpheme | undefined {
  const blank = BLANK_MORPHEMES.find((m) => m.id === id);
  if (!blank) return morphemeById(id);
  const text = (customText ?? '').trim().toLowerCase().replace(/[^a-z]/g, '');
  return { ...blank, text, meaning: text ? 'your own word part' : 'a blank piece (double tap to type)' };
}

// Shape: which sides interlock. A tab (bump) on the right fits into a notch on the left of the next piece.
// Bases and roots are always two-sided. A suffix is an end cap (flat right side) until another suffix snaps
// on after it; a prefix is flat on its left until another prefix snaps on in front of it (her request
// 2026-10-15). `linkedLeft` / `linkedRight` say whether a piece is snapped there right now.
export const hasTab = (m: Morpheme, linkedRight = false) => m.kind !== 'suffix' || linkedRight;
export const hasNotch = (m: Morpheme, linkedLeft = false) => m.kind !== 'prefix' || linkedLeft;

// Which part may snap directly after which: prefix > prefix or base/root; base/root > base/root or suffix;
// suffix > suffix. A prefix never touches a suffix directly, and the whole word must have a base or root
// (checked on the board, where the whole row is known).
export function canFollow(left: Morpheme, right: Morpheme): boolean {
  if (left.kind === 'prefix') return right.kind !== 'suffix';
  if (left.kind === 'suffix') return right.kind === 'suffix';
  return right.kind !== 'prefix';
}
export const isCore = (m: Morpheme) => m.kind === 'base' || m.kind === 'root';
export const pieceLabel = (m: Morpheme) => (!m.text ? '' : m.kind === 'prefix' ? `${m.text}-` : m.kind === 'suffix' ? `-${m.text}` : m.text);

export const KIND_LABEL: Record<MorphemeKind, string> = {
  prefix: 'Prefix', suffix: 'Suffix', base: 'Free base', root: 'Root',
};

// The small explanation a root's pop-up shows (her request: "if root, show a small explanation pop up").
export function rootExplanation(m: Morpheme): string {
  const from = m.origin ? `a ${m.origin} root` : 'a Greek or Latin root';
  return `"${m.text}" is ${from}. A root is the part of a word that holds its main meaning, but it usually can't stand alone: add a prefix or suffix to build a word.${m.example ? ` You can find "${m.text}" in "${m.example}."` : ''}`;
}

export function kindExplanation(m: Morpheme): string {
  if (m.kind === 'root') return rootExplanation(m);
  if (m.kind === 'prefix') return `A prefix goes at the start of a word and changes its meaning. Another prefix can snap on in front of it.${m.example ? ` Like "${m.example}."` : ''}`;
  if (m.kind === 'suffix') return `A suffix goes at the end of a word. Another suffix can snap on after it.${m.example ? ` Like "${m.example}."` : ''}`;
  return `A free base is a word all on its own. You can add prefixes and suffixes to it.${m.example ? ` Like "${m.example}."` : ''}`;
}

// ---- Building a word from connected pieces ----
// Spelling joins a teacher would expect: the silent e drops before a vowel suffix (hope + ing = hoping), y
// changes to i (happy + ness = happiness), a doubled vowel at a Greek seam merges (bio + ology = biology).
// A connecting "o" or "i" between two roots is only used when it makes a word on the list below
// (therm + o + meter = thermometer), so made-up words stay a plain join of their real parts.
const VOWELS = 'aeiou';

function joinPair(a: string, b: string, bIsSuffix: boolean): string {
  if (bIsSuffix && a.endsWith('e') && VOWELS.includes(b[0]) && !a.endsWith('ee')) return a.slice(0, -1) + b;
  if (bIsSuffix && a.endsWith('y') && !VOWELS.includes(a[a.length - 2] ?? '') && b[0] !== 'i') return a.slice(0, -1) + 'i' + b;
  if (a.endsWith(b[0]) && VOWELS.includes(b[0])) return a + b.slice(1);
  return a + b;
}

export function buildWord(parts: Morpheme[]): { word: string; real: boolean } {
  if (parts.length === 0) return { word: '', real: false };
  let candidates = [parts[0].text];
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    const next: string[] = [];
    for (const c of candidates) {
      next.push(joinPair(c, p.text, p.kind === 'suffix'));
      if (p.kind !== 'suffix' && !VOWELS.includes(c[c.length - 1]) && !VOWELS.includes(p.text[0])) {
        next.push(`${c}o${p.text}`, `${c}i${p.text}`);
      }
    }
    candidates = next;
  }
  const real = candidates.find((c) => REAL_WORDS.has(c.toLowerCase()));
  return { word: real ?? candidates[0], real: !!real };
}

// Real words these pieces can build (both sources' own examples plus everyday words from the same parts).
// A word missing from here is called "made-up from real parts," never wrong.
export const REAL_WORDS = new Set(`
hopes hoped hoping hopeful hopefully hopefulness hopeless hopelessly hopelessness unhopeful
kind kinder kindest kindly kindness unkind unkindly unkindness kindhearted
do does doing doer undo undoes undoing redo redoes redoing undone
neighbor neighbors neighborly neighborhood neighborhoods neighboring
play plays played playing player players playful playfully playfulness replay replays replayed replaying display displays displayed displaying playable
help helps helped helping helper helpers helpful helpfully helpfulness helpless helplessly helplessness unhelpful
care cares cared caring careful carefully carefulness careless carelessly carelessness uncaring
happy happier happiest happily happiness unhappy unhappily unhappiness
tract tractor tractors traction attract attracts attracted attracting attraction attractive attractively distract distracts distracted distracting distraction subtract subtracts subtracted subtracting subtraction extract extracts extracted extracting extraction retract retracts retracted retraction contract contracts contracted contracting contraction contractor protract protracted protractor detract detracts detracted traceable tractable intractable
ject reject rejects rejected rejecting rejection inject injects injected injecting injection project projects projected projecting projection projector object objects objected objecting objection objective subject subjects subjected subjective eject ejects ejected ejecting ejection deject dejected interject interjection
act acts acted acting action actions active actively activeness actor actors react reacts reacted reacting reaction reactive reactor transact transaction interact interacts interacted interacting interaction interactive enact exact inactive inaction
port ports ported porter portable report reports reported reporting reporter import imports imported importing importer export exports exported exporting exporter transport transports transported transporting transporter support supports supported supporting supporter supportive deport deports deported deporting comport purport portion
rupt erupt erupts erupted erupting eruption disrupt disrupts disrupted disrupting disruption disruptive interrupt interrupts interrupted interrupting interruption rupture abrupt corrupt corruption
struct construct constructs constructed constructing construction constructive constructor destruct destruction destructive destructible instruct instructs instructed instructing instruction instructive instructor obstruct obstructs obstructed obstructing obstruction structure structures structured restructure
stroy destroy destroys destroyed destroying destroyer
press presses pressed pressing pressure presser express expresses expressed expressing expression expressive impress impresses impressed impressing impression impressive depress depresses depressed depressing depression compress compresses compressed compressing compression compressor suppress suppresses suppressed suppressing suppression oppress oppressed oppression oppressive repress repressed pressable
apathy annual anniversary anthropology antibiotic aquarium archaeologist astrology astrologist audio auditor audience autocrat autocracy beneficial bibliography biology biologist cardiology cardiologist carnivore carnivorous proceed precede recede concede succeed exceed century centimeter centipede cephalopod monochrome chronology chronic chronicle cosmos cosmic incredible credible credit decagon democracy demographic dermatologist diode dictate dictation diction predict contradict dinosaur domestic dormant dormitory dynamic dynamite equator equal floral geography geology geologist telegraph autograph photograph paragraph biography graphic heliocentric hexagon hydrofoil hydrogen hydrology hyperactive ignite intranet incredible interact legislature legal lexicon liberty luminous luminosity macroeconomics mania matriarch megaphone memory meter marine maritime mermaid speedometer thermometer microscope microscopic automobile mobile monopoly monologue morphology multitalented nanometer neoclassic november oligarchy zoology psychology theology omnivore omnivorous synonym antonym homonym acronym orthodontist paleontologist panorama apathy empathy sympathy telepathy patriarch pedestrian pentagon perimeter periscope petrified philosophy claustrophobia telephone microphone phonics symphony phytoplankton metropolis politics polyhedron polygraph population popular postlude prototype pseudoscience psychology public publish science scientist telescope microscope horoscope september insomnia structure subterranean telescope television terrarium terrain tetrahedron theocracy thermostat toxic translate transport triceratops tricycle unicycle uniform vacuum velocity verify herbivore insectivore zoo zoology technologist engineer bilingual linguistics language bibliophile philosopher sophomore megahertz biology geology cosmology
`.trim().split(/\s+/).map((w) => w.toLowerCase()));


// ---- What a made-up word could mean ----
// Her request 2026-10-15: "for nonsense words, give a small definition of what the word could be if it was
// real." Built from the parts' own meanings: the bases and roots in the middle, then each prefix wraps it
// (closest first), then each suffix wraps that (in order).
const first = (meaning: string) => meaning.split(/[;,(]/)[0].trim();

const PREFIX_PHRASE: Record<string, (x: string) => string> = {
  un: (x) => `not ${x}`, in: (x) => `not ${x}`, im: (x) => `not ${x}`, a: (x) => `without ${x}`, dis: (x) => `apart from ${x}`,
  re: (x) => `${x} again`, pre: (x) => `${x} before`, post: (x) => `${x} after`, anti: (x) => `against ${x}`,
  sub: (x) => `under ${x}`, sup: (x) => `under ${x}`, trans: (x) => `across ${x}`, inter: (x) => `between ${x}`,
  intra: (x) => `within ${x}`, hyper: (x) => `too much ${x}`, peri: (x) => `around ${x}`, pseudo: (x) => `fake ${x}`,
  ex: (x) => `out of ${x}`, e: (x) => `out of ${x}`, pro: (x) => `${x} forward`, ob: (x) => `against ${x}`,
  con: (x) => `${x} together`, com: (x) => `${x} together`, de: (x) => `${x} away`, at: (x) => `toward ${x}`,
  ad: (x) => `toward ${x}`, tri: (x) => `three ${x}`, uni: (x) => `one ${x}`, di: (x) => `two ${x}`,
};

const SUFFIX_PHRASE: Record<string, (x: string, m: Morpheme) => string> = {
  ful: (x) => `full of ${x}`, less: (x) => `without ${x}`, ness: (x) => `the state of being ${x}`,
  hood: (x) => `the state of being ${x}`, ly: (x) => `in a ${x} way`, or: (x) => `someone who does ${x}`,
  ist: (x) => `someone who works with ${x}`, eer: (x) => `someone who works with ${x}`,
  er: (x, m) => (m.meaning.startsWith('comparison') ? `more ${x}` : `someone who does ${x}`),
  est: (x) => `the most ${x}`, s: (x) => `more than one ${x}`, es: (x) => `more than one ${x}`,
  ed: (x) => `${x}, in the past`, ing: (x) => `${x}, happening now`, ion: (x) => `the act of ${x}`,
  ure: (x) => `the act of ${x}`, ive: (x) => `tending to ${x}`, able: (x) => `able to ${x}`, ible: (x) => `able to ${x}`,
  ology: (x) => `the study of ${x}`, phobia: (x) => `a fear of ${x}`, cracy: (x) => `rule by ${x}`, mania: (x) => `a wild love of ${x}`,
};

export function madeUpMeaning(parts: Morpheme[]): string {
  const core = parts.filter(isCore);
  const prefixes = parts.filter((m) => m.kind === 'prefix');
  const suffixes = parts.filter((m) => m.kind === 'suffix');
  let x = core.length ? core.map((m) => first(m.meaning)).join(' and ') : 'something';
  for (const p of [...prefixes].reverse()) x = (PREFIX_PHRASE[p.text] ?? ((y: string) => `${first(p.meaning)} ${y}`))(x);
  for (const sfx of suffixes) x = (SUFFIX_PHRASE[sfx.text] ?? ((y: string) => `${y} (${first(sfx.meaning)})`))(x, sfx);
  return x.charAt(0).toUpperCase() + x.slice(1) + '.';
}

// "Make it real" (her request 2026-10-15): for a made-up word, find a small change that makes a real word,
// swapping one part for another of the same kind (or two parts if one isn't enough), or taking a part out. A
// suggestion always keeps at least one of the parts already on the board.
// Affixes are tried before the base or root, so the word keeps its main meaning where it can.
export interface RealFix { word: string; swaps: { index: number; from: Morpheme; to: Morpheme }[]; removed?: { index: number; part: Morpheme } }
const fixCache = new Map<string, RealFix | null>();
const sameSlot = (a: Morpheme, b: Morpheme) => (isCore(a) ? isCore(b) : a.kind === b.kind);
const chainOk = (parts: Morpheme[]) => parts.some(isCore) && parts.every((m, i) => i === 0 || canFollow(parts[i - 1], m));
export function makeItReal(parts: Morpheme[]): RealFix | null {
  const key = parts.map((m) => m.id).join('|');
  if (fixCache.has(key)) return fixCache.get(key)!;
  const order = parts.map((_, i) => i).sort((a, b) => Number(isCore(parts[a])) - Number(isCore(parts[b])));
  const options = (i: number, base: Morpheme[]) => ALL_MORPHEMES.filter((m) => m.id !== parts[i].id && m.text !== parts[i].text && sameSlot(parts[i], m)
    && (i === 0 || canFollow(base[i - 1], m)) && (i === base.length - 1 || canFollow(m, base[i + 1])));
  let found: RealFix | null = null;
  // One swap.
  for (const i of order) {
    for (const m of options(i, parts)) {
      const next = parts.map((p, k) => (k === i ? m : p));
      const b = buildWord(next);
      if (b.real) { found = { word: b.word, swaps: [{ index: i, from: parts[i], to: m }] }; break; }
    }
    if (found) break;
  }
  // Take one part out.
  if (!found && parts.length > 2) {
    for (const i of order) {
      const next = parts.filter((_, k) => k !== i);
      if (!chainOk(next)) continue;
      const b = buildWord(next);
      if (b.real) { found = { word: b.word, swaps: [], removed: { index: i, part: parts[i] } }; break; }
    }
  }
  // Take one part out and swap another.
  if (!found && parts.length > 2) {
    outer2: for (const r of order) {
      const kept = parts.filter((_, k) => k !== r);
      const keptIdx = parts.map((_, k) => k).filter((k) => k !== r);
      for (let i = 0; i < kept.length; i++) {
        for (const m of ALL_MORPHEMES) {
          if (m.text === kept[i].text || !sameSlot(kept[i], m)) continue;
          const next = kept.map((p, k) => (k === i ? m : p));
          if (!chainOk(next)) continue;
          const b = buildWord(next);
          if (b.real) { found = { word: b.word, swaps: [{ index: keptIdx[i], from: kept[i], to: m }], removed: { index: r, part: parts[r] } }; break outer2; }
        }
      }
    }
  }
  // Two swaps, for short words, always leaving at least one of the student's own parts in place.
  if (!found && parts.length >= 3 && parts.length <= 4) {
    outer: for (const i of order) {
      for (const j of order) {
        if (j <= i) continue;
        for (const a of options(i, parts)) {
          const mid = parts.map((p, k) => (k === i ? a : p));
          for (const c of options(j, mid)) {
            const next = mid.map((p, k) => (k === j ? c : p));
            const b = buildWord(next);
            if (b.real) { found = { word: b.word, swaps: [{ index: i, from: parts[i], to: a }, { index: j, from: parts[j], to: c }] }; break outer; }
          }
        }
      }
    }
  }
  fixCache.set(key, found);
  return found;
}

// Filter tags for the Morphemes tray (her request 2026-10-15): each section can be narrowed by a few simple
// tags read from the meanings, plus where the part comes from when the source says.
const NUM = /\b(one|two|three|four|five|six|seven|eight|nine|ten|hundred|many|all|including all|equal|a group)\b/;
const TAG_RULES: Record<MorphemeKind, [string, RegExp][]> = {
  prefix: [
    ['Not or against', /\b(not|without|against|opposite|undo)\b/],
    ['Numbers', NUM],
    ['Where', /\b(to|towards|near|down|off|out|away|apart|in|into|on|upon|over|above|between|within|front|around|forward|under|beyond|across)\b/],
    ['When', /\b(before|after|again|back)\b/],
    ['Together', /\b(with|together)\b/],
  ],
  base: [
    ['Feelings', /\b(feel|feeling|glad|gentle|caring|wish|matters)\b/],
    ['Actions', /^to\b|\baction\b/],
    ['People', /\b(someone|person)\b/],
  ],
  root: [
    ['Numbers', NUM],
    ['Size', /\b(large|small|tiny)\b/],
    ['Nature and science', /\b(water|star|life|earth|sun|plants?|rock|fire|light|heat|ocean|animal|world|universe|color|shape|poisonous|meat|power)\b/],
    ['People and body', /\b(human|self|people|mother|father|heart|head|foot|skin|mind|god)\b/],
    ['Words and thinking', /\b(say|write|word|language|name|book|believe|remember|knowledge|wisdom|truth|law)\b/],
    ['Senses', /\b(sound|see|light|feeling)\b/],
    ['Actions', /^to\b|\b(move|eat|sleep|love|build|break)\b/],
    ['Time', /\b(year|time|ancient|new|first|quick)\b/],
    ['Places', /\b(home|city|far|earth|world|ocean)\b/],
  ],
  suffix: [
    ['Makes a noun', /\b(one who|condition|state|noun|action or process|madness|fear|rule|study)\b/],
    ['Describing words', /\b(capable|full of|lacking|having the quality|comparison|superlative)\b/],
    ['Verb and plural endings', /\b(past tense|continuous|plural|third person)\b/],
    ['People', /\bone who\b/],
    ['Comparing', /\b(comparison|superlative)\b/],
  ],
};
export function morphemeTags(m: Morpheme): string[] {
  const tags = TAG_RULES[m.kind].filter(([, re]) => re.test(m.meaning.toLowerCase())).map(([t]) => t);
  if (m.origin) tags.push(m.origin);
  return tags;
}
// The tags worth offering in one section: those that pick out at least two parts, in the order above.
export function tagsForGroup(items: Morpheme[]): string[] {
  const count = new Map<string, number>();
  for (const m of items) for (const t of morphemeTags(m)) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].filter(([, n]) => n >= 2 && n < items.length).map(([t]) => t);
}
