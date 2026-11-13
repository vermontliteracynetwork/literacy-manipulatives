import { loadJson } from './config';
// Her request 2026-11-11 (her words: "i need a connection for a dictionary to truly reference what word types are (ex. part of
// speech) and really have a better engine behind the symbolic grammar function"). The same engine runs in her
// independent work dashboard's symbol sentences (src/lib/wordTypes.ts there), so a word gets the same symbol in both.
//
// Where a word's types come from, in order:
//   1. The small closed word groups, listed in full here: articles, pronouns, prepositions, joining words,
//      interjections, helping verbs, number and pointing words.
//   2. A real dictionary: WordNet 3.0 (Princeton, license in public/writer/WORDNET-LICENSE.txt), about 42,000
//      everyday words with their noun, verb, adjective and adverb uses, most common first. Rare uses ("cat" as a
//      verb) are kept apart so they don't count when checking a student's word, only when reading a sentence.
//   3. A live dictionary for anything else (dictionaryapi.dev, from Wiktionary, then Datamuse), looked up once and
//      remembered on this device.
//   4. Word endings, only when no dictionary knows the word (-ly tells how, -ed and -ing are doing words).
// readSentence() then picks each word's type from its neighbors ("a jump" is a noun, "they jump" a verb).

export type WordType = 'article' | 'adjective' | 'noun' | 'propernoun' | 'verb' | 'adverb' | 'pronoun' | 'preposition' | 'conjunction' | 'interjection';

const words = (s: string) => s.split(/\s+/).filter(Boolean);
const SUBJECT = words('i you he she it we they');
const OBJECT = words('me him her us them');
const POSSESSIVE = words('my your his her its our their mine yours hers ours theirs');
const REFLEXIVE = words('myself yourself himself herself itself ourselves yourselves themselves');
const INDEFINITE = words('someone somebody something anyone anybody anything everyone everybody everything no-one nobody nothing none who whom whose what which whoever whatever');
const POINTING = words('this that these those');
const QUANTITY = words('some any many much few all both each every several another other such enough more most less least either neither no');
const NUMBER = /^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last)$/;
const PREPOSITION = words('about above across after against along among around at before behind below beneath beside besides between beyond by down during except for from in inside into like near of off on onto out outside over past since through throughout to toward towards under underneath until up upon with within without');
const CONJUNCTION = words('and but or nor so yet because although though if unless while whereas than whether since until after before as once when whenever where wherever');
const INTERJECTION = words('wow oh ouch hooray yikes hey oops yay aha ah hi hello bye goodbye yes no ugh eek phew whoa yum yuck ow shh hmm boo gosh ha alas bravo okay ok uh um aw yippee huh');
const HELPER = words('am is are was were be been being do does did have has had will would can could shall should may might must');
const ADVERB = words('not never always often sometimes usually very really too also just now then here there soon again still already almost quite ever today tonight tomorrow yesterday away back even only maybe perhaps later together instead however please finally everywhere somewhere anywhere nowhere');

const CLOSED = new Map<string, WordType[]>();
const put = (list: string[], t: WordType) => list.forEach((w) => { const a = CLOSED.get(w) ?? []; if (!a.includes(t)) a.push(t); CLOSED.set(w, a); });
put(words('a an the'), 'article');
put([...SUBJECT, ...OBJECT, ...POSSESSIVE, ...REFLEXIVE, ...INDEFINITE], 'pronoun');
put(POINTING, 'adjective'); put(POINTING, 'pronoun');
put(QUANTITY, 'adjective'); put(words('some any many much few all both each several enough more most none either neither'), 'pronoun');
put(PREPOSITION, 'preposition');
put(CONJUNCTION, 'conjunction');
put(INTERJECTION, 'interjection');
put(HELPER, 'verb');
put(ADVERB, 'adverb');

// ---------- the WordNet dictionary ----------
const DICT = new Map<string, { all: WordType[]; common: WordType[] }>();
const CODE: Record<string, WordType> = { n: 'noun', v: 'verb', a: 'adjective', r: 'adverb' };
let loading: Promise<void> | null = null;
export function loadWordTypes(): Promise<void> {
  loading ??= loadJson<Record<string, string>>('pos.json')
    .then((pos) => {
      for (const [code, list] of Object.entries(pos)) {
        const all = [...code].map((c) => CODE[c.toLowerCase()]).filter(Boolean);
        const common = [...code].filter((c) => c === c.toLowerCase()).map((c) => CODE[c]).filter(Boolean);
        for (const w of list.split(' ')) DICT.set(w, { all, common });
      }
      notify();
    })
    .catch(() => { loading = null; });
  return loading;
}
export const wordTypesReady = () => DICT.size > 0;

// ---------- the live dictionary (words WordNet doesn't list) ----------
const ONLINE = new Map<string, WordType[] | null>();
const STORE = 'wordtypes.online.v1';
try { Object.entries(JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, WordType[] | null>).forEach(([k, v]) => ONLINE.set(k, v)); } catch { /* no saved lookups */ }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(Object.fromEntries([...ONLINE].slice(-800)))); } catch { /* storage full or blocked */ } };
const ONLINE_PART: Record<string, WordType> = {
  noun: 'noun', 'proper noun': 'propernoun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', pronoun: 'pronoun',
  preposition: 'preposition', conjunction: 'conjunction', interjection: 'interjection', article: 'article', determiner: 'adjective',
  numeral: 'adjective', n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', u: 'interjection',
};
// Words never sent to an outside dictionary (their entries are adult content).
const BLOCKED = /^(sex|sexy|sexual|porn|penis|vagina|nude|naked|fuck|shit|bitch|ass|asshole|bastard|damn|crap|cunt|dick|cock|pussy|whore|slut|rape|suicide|kill|murder|gun|drug|cocaine|heroin|meth|weed|marijuana|alcohol|beer|vodka)/;
const pending = new Map<string, Promise<void>>();
async function fetchTypes(w: string): Promise<WordType[] | null> {
  const found: WordType[] = [];
  const addPart = (p: string) => { const t = ONLINE_PART[p.toLowerCase()]; if (t && !found.includes(t)) found.push(t); };
  try {
    const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
    if (r.ok) for (const e of (await r.json()) as { meanings?: { partOfSpeech?: string }[] }[]) for (const m of e.meanings ?? []) if (m.partOfSpeech) addPart(m.partOfSpeech);
  } catch { /* try the next one */ }
  if (!found.length) {
    try {
      const r = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(w)}&md=p&max=1`);
      const hit = r.ok ? ((await r.json()) as { word?: string; tags?: string[] }[])[0] : undefined;
      if (hit?.word === w) (hit.tags ?? []).forEach(addPart);
    } catch { return null; }
  }
  return found;
}
// Look up any of these words no dictionary here knows. Resolves when they're in, or after `ms` either way.
// Outside dictionaries are behind a teacher setting, off unless a teacher turns on "Allow live lookups" (Word Explorer
// build spec section 10; the setting is in Word Explorer's Settings, Teacher view).
export const liveLookupsAllowed = () => { try { return localStorage.getItem('lm-live-lookups') === 'on'; } catch { return false; } };
export function lookUpWords(list: string[], ms = 2500): Promise<void> {
  if (!liveLookupsAllowed()) return Promise.resolve();
  const jobs = list.map(key).filter((w) => w.length > 1 && /^[a-z'-]+$/.test(w) && !localTypes(w) && !ONLINE.has(w) && !BLOCKED.test(w))
    .map((w) => {
      if (!pending.has(w)) pending.set(w, fetchTypes(w).then((t) => { if (t) { ONLINE.set(w, t.length ? t : null); save(); notify(); } }).finally(() => pending.delete(w)));
      return pending.get(w)!;
    });
  if (!jobs.length) return Promise.resolve();
  return Promise.race([Promise.all(jobs).then(() => {}), new Promise<void>((r) => setTimeout(r, ms))]);
}

// Screens that show word types redraw when a dictionary arrives.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
export const onWordTypes = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

// ---------- one word ----------
const key = (raw: string) => raw.trim().toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
const CONTRACTION: [RegExp, WordType[]][] = [
  [/n't$/, ['verb', 'adverb']], [/^(i|you|he|she|it|we|they|who|that|there|what)'(m|re|s|ve|ll|d)$/, ['pronoun', 'verb']], [/^let's$/, ['verb', 'pronoun']],
];
// Words that only ever do their small-word job (WordNet also lists "a" and "I" as letters, which a student never means).
const FIXED = new Set([...words('a an the and or nor because'), ...SUBJECT, ...OBJECT, ...POSSESSIVE, ...REFLEXIVE]);
function localTypes(w: string): { all: WordType[]; common: WordType[] } | null {
  const closed = CLOSED.get(w);
  const d = FIXED.has(w) ? undefined : DICT.get(w);
  if (closed || d) {
    const all = [...(closed ?? [])], common = [...(closed ?? [])];
    for (const t of d?.all ?? []) if (!all.includes(t)) all.push(t);
    for (const t of d?.common ?? []) if (!common.includes(t)) common.push(t);
    return { all, common };
  }
  if (NUMBER.test(w)) return { all: ['adjective', 'noun'], common: ['adjective', 'noun'] };
  for (const [re, t] of CONTRACTION) if (re.test(w)) return { all: t, common: t };
  // A possessive ("the dog's bone") names whose it is, so it's a noun.
  if (/'s?$/.test(w) && w.length > 2) { const base = localTypes(w.replace(/'s?$/, '')); if (base) return { all: ['noun'], common: ['noun'] }; }
  return null;
}
export interface WordTypes { all: WordType[]; common: WordType[]; from: 'dictionary' | 'online' | 'ending' }
// Every type a word can be (most common first), or null when nothing knows it yet.
export function typesOf(raw: string): WordTypes | null {
  const w = key(raw);
  if (!w) return null;
  const local = localTypes(w);
  if (local) return { ...local, from: 'dictionary' };
  const online = ONLINE.get(w);
  if (online) return { all: online, common: online, from: 'online' };
  if (/ly$/.test(w)) return { all: ['adverb'], common: ['adverb'], from: 'ending' };
  if (/(ing|ed)$/.test(w)) return { all: ['verb', 'adjective'], common: ['verb'], from: 'ending' };
  return null;
}
// Is it a real word any dictionary here knows (null while unsure)?
export function isDictionaryWord(raw: string): boolean | null {
  const w = key(raw);
  if (localTypes(w) || ONLINE.get(w)) return true;
  if (ONLINE.has(w) && wordTypesReady()) return false;
  return null;
}

// Plain names for the types a word is: "a describing word (adjective)".
export const TYPE_NAME: Record<WordType, string> = {
  article: 'an article', adjective: 'an adjective', noun: 'a noun', propernoun: 'a proper noun', verb: 'a verb', adverb: 'an adverb',
  pronoun: 'a pronoun', preposition: 'a preposition', conjunction: 'a conjunction', interjection: 'an interjection',
};
export const typeList = (types: WordType[]) => {
  const n = types.slice(0, 3).map((t) => TYPE_NAME[t]);
  return n.length < 2 ? n[0] ?? '' : `${n.slice(0, -1).join(', ')} or ${n[n.length - 1]}`;
};

// Sentence reading and "does this word fit this symbol" live in the one grammar engine every tool uses:
// src/lib/grammarEngine.ts (her request 2026-11-13). This file loads WordNet's parts of speech and, when a teacher
// allows live lookups, looks up words WordNet does not have.
