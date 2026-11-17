// Story Maker grammar: reads a row of grammar-symbol slots (the same slot names as her formula cards), decides
// whether it is a sentence the video can act out, writes the words in the right forms (tense, one or many, a/an,
// contractions), and turns it into the actors and actions the renderer plays.
import { FORMULA_LIST } from '../writer/formulaList';
import type { SymbolWordClass } from '../grammarSymbols';
import { baseOf, pastOf } from '../writer/tenses';
import { jobsOfWord } from '../grammarEngine';
import { pluralOf, verbForms, wordsOfType } from '../wordsByType';
import {
  PREPS,
  ABILITIES, ADJECTIVES, ADVERBS, CONJUNCTIONS, INTERJECTIONS, LIVING, MOVING_PREPS, NAMES, NOUN_PREPS, NOUNS, PLACES, PRONOUNS, VERBS,
  advById, nameById as bankName, placeById, pronounById, readNoun as bankNoun, verbById as bankVerb,
  type LookId, type NameDef, type NounDef, type PrepId, type Pron3, type Tense, type VerbDef, type VerbId,
} from './words';

export type Kind =
  | 'article' | 'noun' | 'propernoun' | 'pronoun' | 'adjective' | 'verb' | 'adverb' | 'phrase' | 'interjection' | 'conj'
  | 'will' | 'be' | 'do' | 'not' | 'prep';

/** Kinds that need a word picked. will, be, do and not write themselves. */
export const PICK_KINDS: Kind[] = ['article', 'noun', 'propernoun', 'pronoun', 'adjective', 'verb', 'adverb', 'phrase', 'interjection', 'conj', 'prep'];

/* ---------------- One dictionary (her request 2026-11-17) ----------------
   Every word's part of speech comes from the Symbolic Grammar Engine, the same dictionary and logic as Word Explorer,
   Formula Search and her independent work dashboard (WordNet, the closed word groups, and dictionaryapi.dev). Words
   the video has a picture for act it out; any other dictionary word is written "w:word" and shown as a sign. */
export const isDict = (v?: string) => !!v && v.startsWith('w:');
/** The word itself, without the "w:" mark or the ":pl" for many. */
export const plainWord = (v?: string) => (v ? (v.startsWith('w:') ? v.slice(2) : v).replace(/:pl$/, '') : '');

function readNoun(value: string | undefined): { def: NounDef; plural: boolean } | null {
  if (!isDict(value)) return bankNoun(value);
  const word = plainWord(value);
  return { def: { id: `w:${word}`, sing: word, plural: pluralOf(word), look: 'word', kind: 'thing', pron: 'it' }, plural: /:pl$/.test(value!) };
}
export function verbById(id: string): VerbDef | undefined {
  if (!isDict(id)) return bankVerb(id);
  return { id: id as VerbId, ...verbForms(plainWord(id)), trans: 'opt', motion: 'static' };
}
function nameById(id: string): NameDef | undefined {
  if (!isDict(id)) return bankName(id);
  return { id: plainWord(id), look: 'word', pron: 'it' };
}

const DICT_CLASS: Partial<Record<Kind, SymbolWordClass>> = { noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', prep: 'preposition', interjection: 'interjection' };
/** The engine dictionary's words for one part of speech (empty until loadEngine() is done). */
export const dictWords = (kind: Kind): string[] => (DICT_CLASS[kind] ? wordsOfType(DICT_CLASS[kind]!) : []);
/** The part of speech the engine dictionary gives a word, as a Story Maker slot. */
export function dictKinds(word: string): Kind[] {
  const map: Partial<Record<SymbolWordClass, Kind>> = { noun: 'noun', propernoun: 'propernoun', pronoun: 'pronoun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', article: 'article', preposition: 'prep', conjunction: 'conj', interjection: 'interjection' };
  return [...new Set(jobsOfWord(word).map((c) => map[c]).filter((k): k is Kind => !!k))];
}
export const needsPick = (k: Kind) => PICK_KINDS.includes(k);

export interface Token { id: string; kind: Kind; value?: string; place?: string }
export interface SentenceState { tokens: Token[]; tense: Tense; contract: boolean; exclaim?: boolean }

export const KIND_CLASS: Record<Kind, SymbolWordClass> = {
  article: 'article', noun: 'noun', propernoun: 'propernoun', pronoun: 'pronoun', adjective: 'adjective', verb: 'verb',
  adverb: 'adverb', phrase: 'preposition', interjection: 'interjection', conj: 'conjunction', will: 'verb', be: 'verb', do: 'verb', not: 'adverb',
  prep: 'preposition',
};

export const KIND_LABEL: Record<Kind, string> = {
  article: 'article', noun: 'noun', propernoun: 'proper noun', pronoun: 'pronoun', adjective: 'adjective', verb: 'verb', adverb: 'adverb',
  phrase: 'prepositional phrase', interjection: 'interjection', conj: 'conjunction', will: 'will', be: 'be (am, is, are, was, were)',
  do: 'do (do, does, did)', not: 'not', prep: 'preposition',
};

let uidN = 0;
export const uid = () => `t${Date.now().toString(36)}${(uidN++).toString(36)}`;

/* ---------------- Parsing ---------------- */

interface Mod { adv?: number; adj: number }
export interface NP { art?: number; mods: Mod[]; head: number }
export interface Group { members: NP[]; and?: number }
export type VPType = 'action' | 'state' | 'identity' | 'location';
export interface VP {
  type: VPType; will?: number; be?: number; doo?: number; not?: number; verbs: number[]; vand?: number;
  object?: NP; advs: number[]; phrase?: number; phraseNP?: NP; adjs: Mod[]; adjAnds: number[]; ident?: NP;
}
export interface Clause { subject: Group; vp: VP }
export interface Parsed { intj?: number; front?: number; frontNP?: NP; clauses: Clause[]; cand?: number }

function np(k: Kind[], i: number): [NP, number] | null {
  let j = i;
  let art: number | undefined;
  if (k[j] === 'article') art = j++;
  const mods: Mod[] = [];
  for (;;) {
    if (k[j] === 'adverb' && k[j + 1] === 'adjective') { mods.push({ adv: j, adj: j + 1 }); j += 2; }
    else if (k[j] === 'adjective') mods.push({ adj: j++ });
    else break;
  }
  if (k[j] === 'noun') return [{ art, mods, head: j }, j + 1];
  if (art === undefined && !mods.length && (k[j] === 'propernoun' || k[j] === 'pronoun')) return [{ mods, head: j }, j + 1];
  return null;
}

function* groups(k: Kind[], i: number): Generator<[Group, number]> {
  const a = np(k, i);
  if (!a) return;
  if (k[a[1]] === 'conj') {
    const b = np(k, a[1] + 1);
    if (b) yield [{ members: [a[0], b[0]], and: a[1] }, b[1]];
  }
  yield [{ members: [a[0]] }, a[1]];
}

function* rest(k: Kind[], j: number, base: VP): Generator<[VP, number]> {
  const objs: [NP | undefined, number][] = [];
  const o = np(k, j);
  if (o) objs.push([o[0], o[1]]);
  objs.push([undefined, j]);
  for (const [object, j2] of objs) {
    let m = j2;
    const advs: number[] = [];
    let phrase: number | undefined;
    let phraseNP: NP | undefined;
    while (k[m] === 'adverb' && k[m + 1] !== 'adjective') advs.push(m++);
    if (k[m] === 'phrase') phrase = m++;
    else if (k[m] === 'prep') { const o = np(k, m + 1); if (o) { phrase = m; phraseNP = o[0]; m = o[1]; } }
    while (k[m] === 'adverb' && k[m + 1] !== 'adjective') advs.push(m++);
    yield [{ ...base, object, advs, phrase, phraseNP }, m];
  }
}

function* vps(k: Kind[], i: number): Generator<[VP, number]> {
  const b: VP = { type: 'action', verbs: [], advs: [], adjs: [], adjAnds: [] };
  if (k[i] === 'will' && k[i + 1] === 'verb') yield* rest(k, i + 2, { ...b, will: i, verbs: [i + 1] });
  if (k[i] === 'do' && k[i + 1] === 'not' && k[i + 2] === 'verb') yield* rest(k, i + 3, { ...b, doo: i, not: i + 1, verbs: [i + 2] });
  if (k[i] === 'be') {
    if (k[i + 1] === 'verb') yield* rest(k, i + 2, { ...b, be: i, verbs: [i + 1] });
    let j = i + 1;
    let not: number | undefined;
    if (k[j] === 'not') not = j++;
    const adjs: Mod[] = [];
    const ands: number[] = [];
    let m = j;
    for (;;) {
      if (k[m] === 'adverb' && k[m + 1] === 'adjective') { adjs.push({ adv: m, adj: m + 1 }); m += 2; }
      else if (k[m] === 'adjective') adjs.push({ adj: m++ });
      else break;
      if (k[m] === 'conj' && (k[m + 1] === 'adjective' || (k[m + 1] === 'adverb' && k[m + 2] === 'adjective'))) ands.push(m++);
      else break;
    }
    if (adjs.length) yield [{ ...b, type: 'state', be: i, not, adjs, adjAnds: ands }, m];
    const id = np(k, j);
    if (id && k[id[0].head] === 'noun') yield [{ ...b, type: 'identity', be: i, not, ident: id[0] }, id[1]];
    if (not === undefined && k[j] === 'phrase') yield [{ ...b, type: 'location', be: i, phrase: j }, j + 1];
    if (not === undefined && k[j] === 'prep') { const o = np(k, j + 1); if (o) yield [{ ...b, type: 'location', be: i, phrase: j, phraseNP: o[0] }, o[1]]; }
  }
  if (k[i] === 'verb') {
    if (k[i + 1] === 'conj' && k[i + 2] === 'verb') yield* rest(k, i + 3, { ...b, verbs: [i, i + 2], vand: i + 1 });
    yield* rest(k, i + 1, { ...b, verbs: [i] });
  }
}

function* clauses(k: Kind[], i: number): Generator<[Clause, number]> {
  for (const [g, j] of groups(k, i)) for (const [vp, m] of vps(k, j)) yield [{ subject: g, vp }, m];
}

export function parse(k: Kind[]): Parsed | null {
  if (!k.length) return null;
  let i = 0;
  const p: Parsed = { clauses: [] };
  if (k[i] === 'interjection') p.intj = i++;
  if (i === k.length && p.intj !== undefined) return p;
  if ((k[i] === 'adverb' && k[i + 1] !== 'adjective') || k[i] === 'phrase') p.front = i++;
  else if (k[i] === 'prep') { const o = np(k, i + 1); if (o) { p.front = i; p.frontNP = o[0]; i = o[1]; } }
  for (const [c1, j] of clauses(k, i)) {
    if (j === k.length) return { ...p, clauses: [c1] };
    if (k[j] === 'conj') for (const [c2, m] of clauses(k, j + 1)) if (m === k.length) return { ...p, clauses: [c1, c2], cand: j };
  }
  return null;
}

/* ---------------- People and things in the video ---------------- */

export interface ActorSpec { look: LookId; name?: string; tag?: 'ME' | 'YOU'; word?: string; adjs: string[]; intensity: number }
export type RefPron = Pron3 | 'they' | 'i' | 'we' | 'you';
export interface Referent { actors: ActorSpec[]; pron: RefPron }
export interface StoryContext { refs: Referent[]; place: string | null }
export const EMPTY_CONTEXT: StoryContext = { refs: [], place: null };

const plain = (look: LookId, extra: Partial<ActorSpec> = {}): ActorSpec => ({ look, adjs: [], intensity: 1, ...extra });

function resolvePronoun(key: string | undefined, ctx: StoryContext): ActorSpec[] {
  const last = (p: RefPron) => [...ctx.refs].reverse().find((r) => r.pron === p);
  switch (key) {
    case 'i': return [plain('me', { tag: 'ME' })];
    case 'we': return [plain('me', { tag: 'ME' }), plain('boy')];
    case 'you': return [plain('you', { tag: 'YOU' })];
    case 'he': return last('he')?.actors ?? [plain('boy')];
    case 'she': return last('she')?.actors ?? [plain('girl')];
    case 'it': return last('it')?.actors ?? [plain('dog')];
    case 'they': return [...ctx.refs].reverse().find((r) => r.actors.length > 1)?.actors ?? [plain('girl'), plain('boy')];
    default: return [];
  }
}

function npActors(n: NP, t: Token[], ctx: StoryContext): ActorSpec[] {
  const head = t[n.head];
  const adjs = n.mods.map((m) => t[m.adj].value).filter((v): v is string => !!v);
  const intensity = n.mods.some((m) => m.adv !== undefined && t[m.adv].value) ? 1.6 : 1;
  if (head.kind === 'noun') {
    const r = readNoun(head.value);
    if (!r) return [];
    const a = plain(r.def.look, { adjs, intensity, word: r.def.look === 'word' ? [...adjs.filter(isDict).map(plainWord), r.plural ? r.def.plural : r.def.sing].join(' ') : undefined });
    return r.plural ? [a, { ...a }, { ...a }] : [a];
  }
  if (head.kind === 'propernoun') {
    const d = nameById(head.value ?? '');
    return d ? [plain(d.look, { name: d.id, adjs, intensity })] : [];
  }
  return resolvePronoun(head.value, ctx).map((a) => ({ ...a, adjs: [...a.adjs, ...adjs] }));
}

function refPron(g: Group, t: Token[], actors: ActorSpec[]): RefPron {
  if (g.members.length > 1 || actors.length > 1) return 'they';
  const head = t[g.members[0].head];
  if (head.kind === 'noun') return readNoun(head.value)?.def.pron ?? 'it';
  if (head.kind === 'propernoun') return nameById(head.value ?? '')?.pron ?? 'it';
  const k = head.value as RefPron;
  return k === 'i' || k === 'we' || k === 'you' ? k : (actors[0] ? lookPron(actors[0]) : 'it');
}

function lookPron(a: ActorSpec): RefPron {
  if (a.name) return nameById(a.name)?.pron ?? 'it';
  if (a.look === 'girl') return 'she';
  if (a.look === 'boy') return 'he';
  return 'it';
}

/* ---------------- Writing the words ---------------- */

export interface Word { text: string; idx: number; cls: SymbolWordClass; tense?: Tense; blank?: boolean }

type Num = 'i' | 'sg' | 'pl';

function groupNum(g: Group, t: Token[]): Num {
  if (g.members.length > 1) return 'pl';
  const head = t[g.members[0].head];
  if (head.kind === 'noun') return readNoun(head.value)?.plural ? 'pl' : 'sg';
  if (head.kind === 'pronoun') return pronounById(head.value ?? '')?.num ?? 'sg';
  return 'sg';
}

function beText(tense: Tense, num: Num): string {
  if (tense === 'future') return 'will be';
  if (tense === 'past') return num === 'pl' ? 'were' : 'was';
  return num === 'i' ? 'am' : num === 'pl' ? 'are' : 'is';
}
function doText(tense: Tense, num: Num): string {
  if (tense === 'future') return 'will';
  if (tense === 'past') return 'did';
  return num === 'sg' ? 'does' : 'do';
}
function verbText(v: VerbDef, tense: Tense, num: Num, mode: 'simple' | 'base' | 'ing', first: boolean): string {
  if (mode === 'base') return v.base;
  if (mode === 'ing') return v.ing;
  if (tense === 'past') return v.past;
  if (tense === 'future') return first ? `will ${v.base}` : v.base;
  return num === 'sg' ? v.third : v.base;
}
const NOT_FORMS: Record<string, string> = { is: "isn't", are: "aren't", was: "wasn't", were: "weren't", 'will be': "won't be", did: "didn't", does: "doesn't", do: "don't", will: "won't" };
const PRON_BE: Record<string, string> = { 'I am': "I'm", 'you are': "you're", 'we are': "we're", 'they are': "they're", 'he is': "he's", 'she is': "she's", 'it is': "it's" };

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ---------------- Analysis ---------------- */

export interface GroupModel {
  kind: VPType; actors: ActorSpec[]; verbs: VerbId[]; object: ActorSpec[]; advs: string[]; prep?: PrepId; place?: string;
  /** The person, animal or thing in a phrase like "from the cat" (empty for a place). */
  prepObj: ActorSpec[];
  negated: boolean; progressive: boolean; adjs: { id: string; intensity: number }[]; ident: ActorSpec[];
}

export interface Analysis {
  status: 'empty' | 'incomplete' | 'ok' | 'error';
  hint?: string;
  parsed: Parsed | null;
  tense: Tense;
  lockedTense: Tense | null;
  words: Word[];
  text: string;
  canContract: boolean;
  code: string | null;
  groups: GroupModel[];
  refs: Referent[];
  intj?: string;
  place: string | null;
}

const VOWEL = /^[aeiou]/i;
const STATIC_VERB_PREPS: PrepId[] = ['in', 'on', 'under', 'near', 'behind'];
const LOUD_OK: VerbId[] = ['sing', 'bark', 'meow', 'croak', 'beep', 'laugh', 'cry', 'fall', 'run', 'walk', 'jump', 'dance', 'bounce'];

function lookName(l: LookId): string {
  if (l === 'me') return 'I';
  if (l === 'you') return 'you';
  return `a ${l}`.replace(/^a ([aeiou])/, 'an $1');
}

export function analyze(st: SentenceState, ctx: StoryContext = EMPTY_CONTEXT): Analysis {
  const t = st.tokens;
  const kinds = t.map((x) => x.kind);
  const parsed = parse(kinds);
  const base: Analysis = {
    status: 'ok', parsed, tense: st.tense, lockedTense: null, words: [], text: '', canContract: false, code: null, groups: [], refs: [], place: null,
  };
  if (!t.length) return { ...base, status: 'empty' };

  // Tense: will makes it future; a time adverb sets it too.
  let errors: string | undefined;
  const fail = (h: string) => { if (!errors) errors = h; };
  let locked: Tense | null = null;
  if (kinds.includes('will')) locked = 'future';
  for (const x of t) {
    if (x.kind !== 'adverb' || !x.value) continue;
    const d = advById(x.value);
    if (d?.kind !== 'time' || !d.tense) continue;
    if (locked && locked !== d.tense) fail(locked === 'future' ? `${x.value} is past, but will is future. Try tomorrow.` : `Use only one time word.`);
    else locked = d.tense;
  }
  const tense = locked ?? st.tense;

  // Roles and forms from the parse.
  const role: Record<number, 'subj' | 'obj'> = {};
  const verbMode: Record<number, { num: Num; mode: 'simple' | 'base' | 'ing'; first: boolean }> = {};
  const beNum: Record<number, { num: Num; not?: number; pron?: number }> = {};
  const doNum: Record<number, { num: Num; not?: number }> = {};
  if (parsed) {
    if (parsed.frontNP) role[parsed.frontNP.head] = 'obj';
    for (const c of parsed.clauses) {
      const num = groupNum(c.subject, t);
      for (const m of c.subject.members) role[m.head] = 'subj';
      if (c.vp.phraseNP) role[c.vp.phraseNP.head] = 'obj';
      if (c.vp.object) role[c.vp.object.head] = 'obj';
      const vp = c.vp;
      vp.verbs.forEach((v, i) => {
        verbMode[v] = { num, mode: vp.will !== undefined || vp.doo !== undefined ? 'base' : vp.be !== undefined ? 'ing' : 'simple', first: i === 0 };
      });
      if (vp.be !== undefined) {
        const only = c.subject.members.length === 1 ? c.subject.members[0] : undefined;
        const pron = only && t[only.head].kind === 'pronoun' && only.head === vp.be - 1 ? only.head : undefined;
        beNum[vp.be] = { num, not: vp.not, pron };
      }
      if (vp.doo !== undefined) doNum[vp.doo] = { num, not: vp.not };
    }
  }

  // Contractions this sentence could use.
  const contractNot = Object.values(beNum).some((b) => b.not !== undefined) || Object.values(doNum).some((d) => d.not !== undefined);
  const contractPron = tense === 'present' && Object.values(beNum).some((b) => b.pron !== undefined && b.not === undefined);
  const canContract = contractNot || contractPron;
  const contract = st.contract && canContract;

  // Words.
  const words: Word[] = [];
  const blank = (idx: number, cls: SymbolWordClass) => words.push({ text: '___', idx, cls, blank: true });
  t.forEach((x, idx) => {
    const cls = KIND_CLASS[x.kind];
    switch (x.kind) {
      case 'article': case 'adjective': case 'adverb': case 'conj': case 'prep':
        if (x.value) words.push({ text: plainWord(x.value), idx, cls }); else blank(idx, cls);
        break;
      case 'interjection':
        if (x.value) words.push({ text: `${plainWord(x.value)}!`, idx, cls }); else blank(idx, cls);
        break;
      case 'noun': {
        const r = readNoun(x.value);
        if (r) words.push({ text: r.plural ? r.def.plural : r.def.sing, idx, cls }); else blank(idx, cls);
        break;
      }
      case 'propernoun':
        if (x.value) words.push({ text: plainWord(x.value), idx, cls }); else blank(idx, cls);
        break;
      case 'pronoun': {
        const d = pronounById(x.value ?? '');
        if (!d) { blank(idx, cls); break; }
        const be = beNum[idx + 1];
        let text = role[idx] === 'obj' ? d.obj : d.subj;
        if (contract && be?.pron === idx && be.not === undefined && tense === 'present') text = PRON_BE[`${d.subj} ${beText(tense, be.num)}`] ?? text;
        words.push({ text, idx, cls });
        break;
      }
      case 'phrase': {
        words.push({ text: x.value ?? '___', idx, cls: 'preposition', blank: !x.value });
        words.push({ text: 'the', idx, cls: 'article' });
        words.push({ text: x.place ?? '___', idx, cls: 'noun', blank: !x.place });
        break;
      }
      case 'will':
        words.push({ text: 'will', idx, cls, tense: 'future' });
        break;
      case 'be': {
        const b = beNum[idx] ?? { num: 'sg' as Num };
        let text = beText(tense, b.num);
        if (contract && b.not !== undefined && NOT_FORMS[text]) text = NOT_FORMS[text];
        else if (contract && b.pron !== undefined && b.not === undefined && tense === 'present') text = '';
        words.push({ text, idx, cls, tense });
        break;
      }
      case 'do': {
        const d = doNum[idx] ?? { num: 'sg' as Num };
        let text = doText(tense, d.num);
        if (contract && d.not !== undefined) text = NOT_FORMS[text] ?? text;
        words.push({ text, idx, cls, tense });
        break;
      }
      case 'not': {
        const contracted = contract && (Object.values(beNum).some((b) => b.not === idx && NOT_FORMS[beText(tense, b.num)]) || Object.values(doNum).some((d) => d.not === idx));
        words.push({ text: contracted ? '' : 'not', idx, cls });
        break;
      }
      case 'verb': {
        const v = verbById(x.value ?? '');
        if (!v) { blank(idx, cls); break; }
        const m = verbMode[idx] ?? { num: 'sg' as Num, mode: 'simple' as const, first: true };
        words.push({ text: verbText(v, tense, m.num, m.mode, m.first), idx, cls, tense: m.mode === 'simple' ? tense : undefined });
        break;
      }
    }
  });

  // Capitals and punctuation.
  const shown = words.filter((w) => w.text);
  const firstAfter = (from: number) => shown.find((w) => w.idx >= from);
  if (shown[0]) shown[0].text = cap(shown[0].text);
  if (parsed?.intj !== undefined) { const f = firstAfter(parsed.intj + 1); if (f) f.text = cap(f.text); }
  for (const w of shown) if (w.text === 'i') w.text = 'I';
  if (parsed?.front !== undefined) {
    const frontEnd = parsed.frontNP ? parsed.frontNP.head : parsed.front;
    const front = shown.filter((w) => w.idx === frontEnd);
    const lastFront = front[front.length - 1];
    if (lastFront) lastFront.text += ',';
  }
  const last = shown[shown.length - 1];
  if (last && !last.text.endsWith('!')) last.text += st.exclaim ? '!' : '.';
  const text = shown.map((w) => w.text).join(' ');

  const missing = t.some((x) => needsPick(x.kind) && (!x.value || (x.kind === 'phrase' && !x.place)));
  const out: Analysis = { ...base, tense, lockedTense: locked, words, text, canContract, code: formulaCodeFor(t, contract) };
  if (!parsed) return { ...out, status: 'error', hint: 'Check the order of the symbols.' };

  /* ---- Meaning checks (only on words that are picked) ---- */
  const nounWord = (i: number) => {
    const x = t[i];
    if (x.kind === 'noun') { const r = readNoun(x.value); return r ? (r.plural ? r.def.plural : r.def.sing) : undefined; }
    return undefined;
  };
  const checkNP = (n: NP) => {
    const head = t[n.head];
    const adjVals = n.mods.map((m) => t[m.adj].value).filter(Boolean);
    if (new Set(adjVals).size < adjVals.length) fail('Use two different describing words.');
    for (const m of n.mods) {
      if (m.adv === undefined) continue;
      const a = advById(t[m.adv].value ?? '');
      if (a && a.kind !== 'intensifier') fail(`${a.id} can't go before ${t[m.adj].value ?? 'a describing word'}. Try very or so.`);
    }
    if (head.kind !== 'noun') return;
    const r = readNoun(head.value);
    if (!r) return;
    const art = n.art !== undefined ? t[n.art].value : undefined;
    // A word with its own picture needs a, an or the when it is one; dictionary words can stand alone ("at practice").
    if (n.art === undefined && !r.plural && !isDict(head.value)) fail(`Add a, an or the before ${r.def.sing}.`);
    if (!art) return;
    if ((art === 'a' || art === 'an') && r.plural) fail(`Use the with more than one: the ${r.def.plural}.`);
    const m0 = n.mods[0];
    const next = m0 ? (m0.adv !== undefined ? t[m0.adv].value : t[m0.adj].value) : nounWord(n.head);
    if (next) {
      if (art === 'a' && VOWEL.test(next)) fail(`Use an before a vowel sound: an ${next}.`);
      if (art === 'an' && !VOWEL.test(next)) fail(`Use a before ${next}: a ${next}.`);
    }
  };

  const groupsOut: GroupModel[] = [];
  const refs: Referent[] = [];
  let place: string | null = null;
  const frontTok = parsed.front !== undefined ? t[parsed.front] : undefined;
  if (frontTok?.kind === 'adverb' && frontTok.value) {
    const a = advById(frontTok.value);
    if (a && a.kind !== 'manner' && a.kind !== 'time') fail(`${a.id} can't start this sentence. Try quickly or yesterday.`);
  }

  parsed.clauses.forEach((c, ci) => {
    const vp = c.vp;
    c.subject.members.forEach(checkNP);
    if (vp.object) checkNP(vp.object);
    if (vp.ident) checkNP(vp.ident);
    if (vp.phraseNP) checkNP(vp.phraseNP);
    if (ci === 0 && parsed.frontNP) checkNP(parsed.frontNP);
    // A place is where things happen, not who does them.
    for (const n of [...c.subject.members, ...(vp.object ? [vp.object] : []), ...(vp.ident ? [vp.ident] : [])]) {
      const hd = t[n.head];
      const r = hd.kind === 'noun' ? readNoun(hd.value) : null;
      if (r?.def.place) fail(`Use ${r.def.sing} after a preposition, like at the ${r.def.sing}.`);
    }
    if (c.subject.and !== undefined && t[c.subject.and].value && t[c.subject.and].value !== 'and') fail('Use and to join two Whos.');
    if (vp.vand !== undefined && t[vp.vand].value && t[vp.vand].value !== 'and') fail('Use and to join two Actions.');
    for (const a of vp.adjAnds) if (t[a].value && t[a].value !== 'and') fail('Use and to join two describing words.');
    if (c.subject.members.length === 2) {
      const [a, b] = c.subject.members.map((m) => t[m.head]);
      if (a.kind === 'pronoun' && a.value === 'i') fail(`Name the other person first: ${b.kind === 'propernoun' && b.value ? b.value : 'Sam'} and I.`);
      if (a.kind === b.kind && a.value && a.value === b.value) fail('Use two different Whos.');
    }

    const actors = c.subject.members.flatMap((m) => npActors(m, t, ctx));
    const object = vp.object ? npActors(vp.object, t, ctx) : [];
    const ident = vp.ident ? npActors(vp.ident, t, ctx) : [];
    const verbs = vp.verbs.map((i) => t[i].value).filter((v): v is VerbId => !!v);
    const negated = vp.not !== undefined;
    const advs = vp.advs.map((i) => t[i].value).filter((v): v is string => !!v);
    if (ci === 0 && frontTok?.kind === 'adverb' && frontTok.value) advs.unshift(frontTok.value);
    const frontIsPhrase = ci === 0 && (frontTok?.kind === 'phrase' || frontTok?.kind === 'prep');
    const phraseIdx = vp.phrase ?? (frontIsPhrase ? parsed.front : undefined);
    const ph = phraseIdx !== undefined ? t[phraseIdx] : undefined;
    const pnp = vp.phrase !== undefined ? vp.phraseNP : frontIsPhrase ? parsed.frontNP : undefined;
    let prep = ph?.value as PrepId | undefined;
    let pl = ph?.place;
    // A preposition word and the words after it ("on the hill", "at the park", "with Max"): the place it names, or
    // the person, animal or thing.
    let npObj: ActorSpec[] = [];
    if (ph?.kind === 'prep' && pnp) {
      const hd = t[pnp.head];
      const r = hd.kind === 'noun' ? readNoun(hd.value) : null;
      if (r?.def.place) {
        pl = r.def.id;
        const pd0 = placeById(pl);
        // Any preposition can go before a place; the video shows the closest one it can draw.
        if (prep && pd0 && !pd0.preps.includes(prep)) prep = (MOVING_PREPS.includes(prep) ? (pd0.preps.find((x) => MOVING_PREPS.includes(x)) ?? pd0.preps[0]) : (pd0.preps.find((x) => STATIC_VERB_PREPS.includes(x)) ?? pd0.preps[0]));
      } else if (hd.value) {
        npObj = npActors(pnp, t, ctx);
        pl = undefined;
        if (prep && !NOUN_PREPS.includes(prep)) prep = MOVING_PREPS.includes(prep) ? 'to' : 'near';
      }
    }

    // Verbs: can these Whos do it, and does it need a What?
    if (!negated) {
      for (const v of verbs) for (const a of actors) {
        if (!isDict(v) && !ABILITIES[a.look].includes(v)) fail(`${cap(lookName(a.look))} can't ${verbById(v)?.base} in this video. Try another verb.`);
      }
    }
    const lastVerb = verbs.length === vp.verbs.length ? verbById(verbs[verbs.length - 1] ?? '') : undefined;
    if (lastVerb && vp.verbs.length === verbs.length) {
      if (lastVerb.trans === 'yes' && !vp.object) fail(`${cap(lastVerb.past)} who or what? Add a noun after the verb.`);
      if (lastVerb.trans === 'no' && vp.object) fail(`${cap(lastVerb.past)} can't have a noun after it. Try chased or kicked.`);
      if (verbs.length === 2 && verbs[0] === verbs[1]) fail('Use two different Actions.');
    if (vp.verbs.length === 2) { const f = verbById(verbs[0]); if (f?.trans === 'yes') fail(`${cap(f.past)} needs a noun right after it.`); }
      if (lastVerb.objects && object.length) {
        const rule = lastVerb.objects;
        const ok = (o: ActorSpec) => {
          if (o.look === 'word') return true;
          const food = NOUNS.find((n) => n.look === o.look)?.food;
          if (rule === 'food') return !!food;
          if (rule === 'living') return LIVING.includes(o.look);
          if (rule === 'kickable') return o.look === 'ball' || o.look === 'box' || o.look === 'apple';
          if (rule === 'chaseable') return LIVING.includes(o.look) || o.look === 'ball';
          return true;
        };
        if (!object.every(ok)) {
          const tip = rule === 'food' ? 'Try apple or cake.' : rule === 'living' ? 'Try a person or an animal.' : rule === 'kickable' ? 'Try ball or box.' : 'Try an animal or a ball.';
          fail(`You can't ${lastVerb.base} ${lookName(object[0].look)} here. ${tip}`);
        }
      }
    }

    // Adverbs.
    for (const id of advs) {
      const a = advById(id);
      if (!a) continue;
      if (a.kind === 'intensifier') fail(`${id} needs a describing word after it, like ${id} big.`);
      if (vp.type !== 'action') { if (a.kind !== 'time') fail(`${id} describes an Action. Try a verb sentence.`); continue; }
      if (a.kind === 'direction') {
        if (ph) fail(`Use ${id} or a place, not both.`);
        if (verbs.some((v) => verbById(v)?.motion !== 'loco')) fail(`${id} needs a moving verb, like ran ${id}.`);
      }
      if ((id === 'quickly' || id === 'slowly') && verbs.includes('sleep')) fail(`You can't sleep ${id}. Try another adverb.`);
      if (id === 'loudly' && verbs.some((v) => !isDict(v) && !LOUD_OK.includes(v))) fail(`${cap(verbById(verbs[0])?.past ?? 'That')} can't be loud. Try quietly or happily.`);
      if (id === 'carefully' && verbs.some((v) => v === 'sleep' || v === 'cry' || v === 'laugh' || v === 'fall')) fail(`Try another adverb with ${verbById(verbs[0])?.past}.`);
    }
    if (advs.filter((id) => advById(id)?.kind === 'time').length > 1) fail('Use only one time word.');

    // Places.
    const fishy = [...actors].some((a) => a.look === 'fish');
    const pd = pl ? placeById(pl) : undefined;
    const pn = pl && !pd ? readNoun(pl) : null;
    const prepObj: ActorSpec[] = npObj.length ? npObj : pn ? [plain(pn.def.look)] : [];
    if (npObj.length && prep && MOVING_PREPS.includes(prep) && (vp.type !== 'action' || verbs.some((v) => !isDict(v) && ['static', 'sound'].includes(verbById(v)?.motion ?? '')))) fail(`${t[phraseIdx!].value} needs a moving verb, like ran ${t[phraseIdx!].value}.`);
    if (pl && prep && pn) {
      if (!NOUN_PREPS.includes(prep)) fail(`Try ${NOUN_PREPS.join(', ')} before the ${pl}.`);
      if (MOVING_PREPS.includes(prep) && (vp.type !== 'action' || verbs.some((v) => verbById(v)?.motion !== 'loco'))) fail(`${prep} the ${pl} needs a moving verb, like ran ${prep} the ${pl}.`);
      if (prep === 'with' && !negated) {
        for (const v of verbs) if (!ABILITIES[pn.def.look].includes(v)) fail(`${cap(lookName(pn.def.look))} can't ${verbById(v)?.base} in this video. Try another word.`);
      }
      if (actors.some((a) => a.look === pn.def.look && !a.name) && actors.length === 1) fail(`Use a different noun after ${prep}.`);
    }
    if (pl && prep && pd) {
      if (!pd.preps.includes(prep)) fail(`Try another preposition with ${pl}.`);
      const isMoving = MOVING_PREPS.includes(prep);
      if (isMoving && (vp.type !== 'action' || verbs.some((v) => { const m = verbById(v)?.motion; return m !== 'loco'; }))) {
        fail(`${prep} the ${pl} needs a moving verb. Try ${STATIC_VERB_PREPS.filter((p) => pd?.preps.includes(p)).join(' or ') || 'another place'}.`);
      }
      if (verbs.includes('swim') && !pd?.water && !negated) fail('Swimming needs water: try the pond or the beach.');
      if (fishy && !pd?.water) fail('A fish needs water: try the pond.');
    }
    if (pd && ci === 0 && pl) place = pl;
    if (pd && ci > 0 && !place && pl) place = pl;

    if (vp.type === 'identity' && [...actors, ...ident].some((x) => !LIVING.includes(x.look))) fail('Use a person or an animal on both sides, like Max is a dog.');
    if (vp.type === 'identity' && actors.length && ident.length) {
      const subjMany = actors.length > 1;
      const identMany = ident.length > 1;
      if (subjMany !== identMany) fail('Match one or many on both sides.');
    }

    groupsOut.push({
      kind: vp.type, actors: prep === 'with' ? [...actors, ...prepObj] : actors, verbs, object, advs, prep, place: pd ? pl : undefined,
      prepObj: prep === 'with' ? [] : prepObj, negated, progressive: vp.be !== undefined && vp.type === 'action',
      adjs: vp.adjs.map((m) => ({ id: t[m.adj].value ?? '', intensity: m.adv !== undefined && t[m.adv].value ? 1.6 : 1 })).filter((a) => a.id),
      ident,
    });
    if (actors.length) refs.push({ actors, pron: refPron(c.subject, t, actors) });
  });

  const intj = parsed.intj !== undefined ? t[parsed.intj].value : undefined;
  const status = errors ? 'error' : missing ? 'incomplete' : 'ok';
  return { ...out, status, hint: errors, groups: groupsOut, refs, intj, place };
}

/** The story's memory after a sentence: who "he", "she", "it" and "they" mean, and where we are. */
export function nextContext(ctx: StoryContext, a: Analysis): StoryContext {
  if (a.status !== 'ok') return ctx;
  return { refs: [...ctx.refs, ...a.refs].slice(-8), place: a.place ?? ctx.place };
}

/* ---------------- Choices, dropdowns and the dice ---------------- */

export interface Choice { value: string; label: string }

export function baseChoices(kind: Kind): Choice[] {
  switch (kind) {
    case 'article': return ['a', 'an', 'the'].map((v) => ({ value: v, label: v }));
    case 'noun': return NOUNS.flatMap((n) => [{ value: n.id, label: n.sing }, ...(n.plural !== n.sing ? [{ value: `${n.id}:pl`, label: n.plural }] : [{ value: `${n.id}:pl`, label: `${n.plural} (many)` }])]);
    case 'propernoun': return NAMES.map((n) => ({ value: n.id, label: n.id }));
    case 'prep': return PREPS.map((v) => ({ value: v, label: v }));
    case 'pronoun': return PRONOUNS.map((p) => ({ value: p.id, label: p.subj }));
    case 'adjective': return ADJECTIVES.map((a) => ({ value: a.id, label: a.id }));
    case 'adverb': return ADVERBS.map((a) => ({ value: a.id, label: a.id }));
    case 'verb': return VERBS.map((v) => ({ value: v.id, label: v.base }));
    case 'interjection': return INTERJECTIONS.map((v) => ({ value: v, label: `${v}!` }));
    case 'conj': return CONJUNCTIONS.map((v) => ({ value: v, label: v }));
    default: return [];
  }
}

function withValue(st: SentenceState, idx: number, patch: Partial<Token>): SentenceState {
  return { ...st, tokens: st.tokens.map((x, i) => (i === idx ? { ...x, ...patch } : x)) };
}

/** Words that fit this blank, labeled the way they will read in the sentence (ran, runs, will run...). */
export function choicesFor(st: SentenceState, idx: number, ctx: StoryContext, strict = false): Choice[] {
  const tok = st.tokens[idx];
  const all = baseChoices(tok.kind);
  const keep = all.filter((c) => {
    if (!strict && tok.kind === 'article') return true;
    return analyze(withValue(st, idx, { value: c.value }), ctx).status !== 'error';
  });
  const list = keep.length ? keep : all;
  if (tok.kind === 'verb' || tok.kind === 'pronoun') {
    return list.map((c) => {
      const a = analyze(withValue(st, idx, { value: c.value }), ctx);
      const w = a.words.filter((x) => x.idx === idx).map((x) => x.text.replace(/[.,!]$/, '')).join(' ');
      return { value: c.value, label: w ? w.replace(/^./, (s) => (tok.kind === 'pronoun' && w !== 'I' && !w.startsWith("I'") ? s.toLowerCase() : s)) : c.label };
    });
  }
  return list;
}

export function placeChoices(st: SentenceState, idx: number, ctx: StoryContext, strict = false): string[] {
  const ok = PLACES.filter((p) => p.preps.some((prep) => analyze(withValue(st, idx, { value: prep, place: p.id }), ctx).status !== 'error'));
  return (ok.length || strict ? ok : PLACES).map((p) => p.id);
}

export function prepChoices(st: SentenceState, idx: number, ctx: StoryContext): string[] {
  const tok = st.tokens[idx];
  const pd = placeById(tok.place ?? '');
  const preps = pd ? pd.preps : [];
  const ok = preps.filter((p) => analyze(withValue(st, idx, { value: p }), ctx).status !== 'error');
  return ok.length ? ok : preps;
}

const pick = <T,>(xs: T[]): T | undefined => xs[Math.floor(Math.random() * xs.length)];

function rollOne(st: SentenceState, idx: number, ctx: StoryContext): SentenceState {
  const tok = st.tokens[idx];
  if (!needsPick(tok.kind)) return st;
  if (tok.kind === 'conj' && tok.value) return st;
  if (tok.kind === 'phrase') {
    const pr = pick(phraseChoices(st, idx, ctx));
    return pr ? withValue(st, idx, pr) : st;
  }
  let list = choicesFor(st, idx, ctx, true);
  // The dice lean toward people and animals: they have more to act out.
  if (tok.kind === 'noun' && Math.random() < 0.8) {
    const living = list.filter((c) => { const r = readNoun(c.value); return !!r && LIVING.includes(r.def.look); });
    if (living.length) list = living;
  }
  const c = pick(list);
  return c ? withValue(st, idx, { value: c.value }) : st;
}

/** One die: a new word for one blank that still works with the rest of the sentence. */
export function rollToken(st: SentenceState, idx: number, ctx: StoryContext): SentenceState {
  const cleared = withValue(st, idx, st.tokens[idx].kind === 'conj' ? {} : { value: undefined, place: undefined });
  return rollOne(cleared, idx, ctx);
}

/** All the dice: a whole new sentence the video can play. */
export function rollAll(st: SentenceState, ctx: StoryContext): SentenceState {
  let best = st;
  for (let tries = 0; tries < 60; tries++) {
    let s: SentenceState = { ...st, tokens: st.tokens.map((x) => (x.kind === 'conj' ? x : { ...x, value: undefined, place: undefined })) };
    const order = s.tokens.map((_, i) => i);
    // Pick the Whos first, then the rest, so every verb fits the Who.
    order.sort((a, b) => rank(s.tokens[a].kind) - rank(s.tokens[b].kind));
    for (const i of order) s = rollOne(s, i, ctx);
    const a = analyze(s, ctx);
    if (a.status === 'ok') return s;
    best = s;
  }
  return best;
}
function rank(k: Kind): number {
  return ({ noun: 0, propernoun: 0, pronoun: 0, verb: 1, phrase: 2, article: 3, adjective: 3, adverb: 4 } as Partial<Record<Kind, number>>)[k] ?? 5;
}

/* ---------------- Her formulas ---------------- */

export interface StoryFormula {
  code: string; kinds: Kind[]; fixed: (string | undefined)[]; formula: string; contract: boolean; exclaim: boolean; example: string;
  name: string; purpose: string;
}

/** Reads one row of her master list (formula symbols plus its model sentence) into Story Maker slots. A helping
 *  verb in the sentence (will, is, did...) becomes will, be or do; "not" becomes not; a preposition and the words
 *  after it become one prepositional phrase. Returns null for a formula the video can't act out yet. */
function storySlots(breakdown: string, sentence: string): { kinds: Kind[]; fixed: (string | undefined)[]; contract: boolean } | null {
  const slots = breakdown.replace(/proper noun/g, 'propernoun').split(/\s+/).filter((w) => /^[a-z]+$/.test(w));
  const words = sentence.replace(/[“”"]/g, ' ').split(/\s+/).map((w) => w.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '').toLowerCase().replace(/’/g, "'")).filter(Boolean);
  if (slots.length < 1) return null;
  const kinds: Kind[] = [];
  const fixed: (string | undefined)[] = [];
  let contract = false;
  let w = 0;
  const push = (k: Kind, v?: string) => { kinds.push(k); fixed.push(v); };
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const word = words[w] ?? '';
    w++;
    if (slot === 'preposition') { push('prep'); continue; }
    if (slot === 'verb') {
      if (word === 'will') push('will');
      else if (/^(am|is|are|was|were)$/.test(word)) push('be');
      else if (/^(isn't|aren't|wasn't|weren't)$/.test(word)) { push('be'); push('not'); contract = true; }
      else if (/^(do|does|did)$/.test(word)) push('do');
      else if (/^(don't|doesn't|didn't)$/.test(word)) { push('do'); push('not'); contract = true; }
      else if (/'/.test(word) || /^(can|could|should|must|may|has|have|had|feel|feels|felt)$/.test(word)) return null;
      else push('verb');
    } else if (slot === 'adverb') push(word === 'not' ? 'not' : 'adverb');
    else if (slot === 'conjunction') { if (!CONJUNCTIONS.includes(word)) return null; push('conj', word); }
    else if (slot === 'pronoun') { if (/'/.test(word)) return null; push('pronoun'); }
    else if (slot === 'propernoun') {
      // A title and a name ("Dr. Lee") are one proper noun; the title's period stays.
      if (/^(dr|mr|mrs|ms)$/.test(word) && slots[i + 1] === 'propernoun') { i++; w++; }
      push('propernoun');
    }
    else if (slot === 'article' || slot === 'noun' || slot === 'adjective' || slot === 'interjection') push(slot);
    else return null;
  }
  return parse(kinds) ? { kinds, fixed, contract } : null;
}

let cache: StoryFormula[] | null = null;
/** Every formula in her master list that the video can act out, in her order. */
export function storyFormulas(): StoryFormula[] {
  if (cache) return cache;
  const seen = new Set<string>();
  const out: StoryFormula[] = [];
  for (const f of FORMULA_LIST) {
    // Questions and commands have their own word order; the video acts out statements and exclamations.
    if (/^(Q|C|Cn)\d/.test(f.code) || /(^|[,(])C\d/.test(f.code) || /^B\(C/.test(f.code)) continue;
    const sl = storySlots(f.breakdown, f.example);
    if (!sl) continue;
    const key = `${f.code}|${sl.kinds.join(' ')}|${sl.fixed.join(' ')}`;
    if (seen.has(key)) continue;
    const contract = sl.contract || f.code.includes("'");
    const st: SentenceState = { tokens: sl.kinds.map((k, i) => ({ id: `f${i}`, kind: k, value: sl.fixed[i] })), tense: 'past', contract };
    if (analyze(rollAll(st, EMPTY_CONTEXT)).status !== 'ok') continue;
    seen.add(key);
    out.push({
      code: f.code, kinds: sl.kinds, fixed: sl.fixed, formula: f.breakdown, contract, exclaim: /^E\d/.test(f.code) || /!$/.test(f.example) && !sl.kinds.includes('interjection'),
      example: f.example, name: f.name, purpose: f.purpose,
    });
  }
  cache = out;
  return out;
}

export function formulaTokens(f: StoryFormula): Token[] {
  return f.kinds.map((k, i) => ({ id: uid(), kind: k, value: f.fixed[i] }));
}

function formulaCodeFor(t: Token[], contract: boolean): string | null {
  if (!cache) return null;
  const sig = t.map((x) => (x.kind === 'conj' ? `conj:${x.value ?? ''}` : x.kind)).join(' ');
  const match = cache.filter((f) => f.kinds.map((k, i) => (k === 'conj' ? `conj:${f.fixed[i] ?? ''}` : k)).join(' ') === sig);
  if (!match.length) return null;
  return (match.find((f) => f.contract === contract) ?? match[0]).code;
}

/** Short name of each slot for a formula written out: article + noun + verb. */
export function formulaWords(f: StoryFormula): string {
  return f.kinds.map((k, i) => (k === 'conj' ? f.fixed[i] ?? 'conjunction' : k === 'phrase' ? 'prepositional phrase' : KIND_LABEL[k].split(' (')[0])).join(' + ');
}

/** A formula filled in with its example sentence from her formula card. A word the video doesn't know (a name
 *  like Boston) is swapped for one it does, so the example always plays. */
export function exampleFill(f: StoryFormula, ctx: StoryContext): SentenceState {
  const base: SentenceState = { tokens: formulaTokens(f), tense: 'past', contract: f.contract, exclaim: f.exclaim };
  const words = f.example.replace(/[“”"]/g, '').split(/\s+/).map((w) => w.replace(/[.,!?;:]+$/, '')).filter(Boolean);
  const low = (i: number) => (words[i] ?? '').toLowerCase().replace(/’/g, "'");
  const tokens = base.tokens.map((x) => ({ ...x }));
  let w = 0;
  let tense: Tense | null = null;
  let skipNot = false;
  let skipBe = false;
  for (const tok of tokens) {
    const word = low(w);
    switch (tok.kind) {
      case 'article': if (['a', 'an', 'the'].includes(word)) tok.value = word; w++; break;
      case 'noun': {
        const n = NOUNS.find((x) => x.sing === word || x.plural === word);
        if (n) tok.value = n.plural === word && n.sing !== word ? `${n.id}:pl` : n.id;
        else if (dictKinds(word).includes('noun')) {
          const stem = word.replace(/ies$/, 'y').replace(/(ch|sh|x|s|z)es$/, '$1').replace(/s$/, '');
          tok.value = stem !== word && dictKinds(stem).includes('noun') ? `w:${stem}:pl` : `w:${word}`;
        }
        w++; break;
      }
      case 'propernoun': {
        const titled = /^(dr|mr|mrs|ms)$/.test(word);
        const full = titled ? `${word} ${low(w + 1)}` : word;
        const n = NAMES.find((x) => x.id.toLowerCase().replace(/\./g, '') === full);
        if (n) tok.value = n.id;
        else if (titled) { const t = NAMES.find((x) => x.id.toLowerCase().startsWith(`${word}.`)); if (t) tok.value = t.id; }
        else if (/^[A-Z]/.test(words[w] ?? '')) tok.value = `w:${words[w]}`;
        w += titled ? 2 : 1; break;
      }
      case 'pronoun': {
        const raw = word.split("'")[0];
        const p = PRONOUNS.find((x) => x.subj.toLowerCase() === raw || x.obj === raw);
        if (p) tok.value = p.id;
        if (word.includes("'")) skipBe = true;
        w++; break;
      }
      case 'adjective': if (ADJECTIVES.some((a) => a.id === word)) tok.value = word; else if (dictKinds(word).includes('adjective')) tok.value = `w:${word}`; w++; break;
      case 'adverb': if (ADVERBS.some((a) => a.id === word)) tok.value = word; else if (dictKinds(word).includes('adverb')) tok.value = `w:${word}`; w++; break;
      case 'interjection': { const i = INTERJECTIONS.find((x) => x.toLowerCase() === word); if (i) tok.value = i; else if (word) tok.value = `w:${word[0].toUpperCase()}${word.slice(1)}`; w++; break; }
      case 'prep': if (PREPS.includes(word as PrepId) || dictKinds(word).includes('prep')) tok.value = word; w++; break;
      case 'conj': w++; break;
      case 'verb': {
        const v = VERBS.find((x) => [x.base, x.third, x.past, x.ing].includes(word));
        if (v) { tok.value = v.id; if (!tense) tense = word === v.past ? 'past' : word === v.third || word === v.base ? 'present' : null; }
        else {
          let b = baseOf(word);
          if (/ing$/.test(word)) b = [word.slice(0, -3), `${word.slice(0, -3)}e`, word.slice(0, -4)].find((x) => x.length > 1 && dictKinds(x).includes('verb')) ?? b;
          if (dictKinds(b).includes('verb')) { tok.value = `w:${b}`; if (!tense) tense = word === pastOf(b) || /ed$/.test(word) ? 'past' : /ing$/.test(word) ? null : 'present'; }
        }
        w++; break;
      }
      case 'will': tense = 'future'; w++; break;
      case 'be':
        if (skipBe) { skipBe = false; tense ??= 'present'; break; }
        if (word === 'will') { tense = 'future'; w += 2; break; }
        if (/^(was|were)/.test(word)) tense = 'past'; else if (/^(is|are|am)/.test(word)) tense = 'present';
        if (word.endsWith("n't")) skipNot = true;
        w++; break;
      case 'do':
        if (/^did/.test(word)) tense = 'past'; else if (/^(will|won't)/.test(word)) tense = 'future'; else if (/^do/.test(word)) tense = 'present';
        if (word.endsWith("n't")) skipNot = true;
        w++; break;
      case 'not': if (skipNot) { skipNot = false; break; } w++; break;
      case 'phrase': {
        const next = low(w + 1);
        const hasArt = ['the', 'a', 'an'].includes(next);
        let k = hasArt ? w + 2 : w + 1;
        while (ADJECTIVES.some((a) => a.id === low(k)) || (low(k) && !PLACES.some((p) => p.id === low(k)) && !NOUNS.some((n) => n.sing === low(k) || n.plural === low(k)) && low(k + 1) && k < w + 4)) k++;
        const pl = PLACES.find((p) => p.id === low(k));
        const nn = NOUNS.find((n) => n.sing === low(k) || n.plural === low(k));
        if (pl && pl.preps.includes(word as PrepId)) { tok.value = word; tok.place = pl.id; }
        else if (nn && NOUN_PREPS.includes(word as PrepId)) { tok.value = word; tok.place = nn.id; }
        w = k + 1; break;
      }
    }
  }
  let st: SentenceState = { ...base, tokens, tense: tense ?? 'past' };
  const order = st.tokens.map((_, i) => i).sort((a, b) => rank(st.tokens[a].kind) - rank(st.tokens[b].kind));
  for (const i of order) {
    const x = st.tokens[i];
    if (needsPick(x.kind) && x.kind !== 'conj' && (!x.value || (x.kind === 'phrase' && !x.place))) st = rollToken(st, i, ctx);
  }
  if (analyze(st, ctx).status === 'ok') return st;
  return rollAll({ ...base, tense: st.tense }, ctx);
}

/** Every prepositional phrase that fits this blank, like "to the park". */
export function phraseChoices(st: SentenceState, idx: number, ctx: StoryContext): { value: string; place: string }[] {
  const out: { value: string; place: string }[] = [];
  const tryIt = (value: string, place: string) => { if (analyze(withValue(st, idx, { value, place }), ctx).status !== 'error') out.push({ value, place }); };
  for (const p of PLACES) for (const prep of p.preps) tryIt(prep, p.id);
  for (const n of NOUNS) for (const prep of NOUN_PREPS) tryIt(prep, n.id);
  return out;
}

export interface WordHit { kind: Kind; value: string; label: string; tense?: Tense }

/** Words in the video's word bank that start with what was typed, in every word type. */
export function findWords(q: string): WordHit[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const hits: WordHit[] = [];
  const add = (h: WordHit) => { if (h.label.toLowerCase().startsWith(s) && !hits.some((x) => x.kind === h.kind && x.value === h.value && x.label === h.label)) hits.push(h); };
  for (const n of NOUNS) { add({ kind: 'noun', value: n.id, label: n.sing }); if (n.plural !== n.sing) add({ kind: 'noun', value: `${n.id}:pl`, label: n.plural }); }
  for (const n of NAMES) add({ kind: 'propernoun', value: n.id, label: n.id });
  for (const p of PRONOUNS) { add({ kind: 'pronoun', value: p.id, label: p.subj }); add({ kind: 'pronoun', value: p.id, label: p.obj }); }
  for (const a of ADJECTIVES) add({ kind: 'adjective', value: a.id, label: a.id });
  for (const a of ADVERBS) add({ kind: 'adverb', value: a.id, label: a.id });
  for (const v of VERBS) {
    add({ kind: 'verb', value: v.id, label: v.past, tense: 'past' });
    add({ kind: 'verb', value: v.id, label: v.third, tense: 'present' });
    add({ kind: 'verb', value: v.id, label: v.base, tense: 'present' });
    add({ kind: 'verb', value: v.id, label: v.ing });
  }
  for (const w of INTERJECTIONS) add({ kind: 'interjection', value: w, label: w });
  for (const w of CONJUNCTIONS) add({ kind: 'conj', value: w, label: w });
  for (const p of PREPS) add({ kind: 'prep', value: p, label: p });
  // Any other dictionary word, typed whole: its part of speech comes from the engine.
  if (/^[a-z]+$/.test(s) && !hits.some((h) => h.label.toLowerCase() === s)) {
    for (const k of dictKinds(s)) {
      if (k === 'verb') { const b = baseOf(s); hits.push({ kind: k, value: `w:${b}`, label: s, tense: s === pastOf(b) || /ed$/.test(s) ? 'past' : s === b ? 'present' : undefined }); }
      else if (k === 'noun' || k === 'adjective' || k === 'adverb' || k === 'interjection') hits.push({ kind: k, value: `w:${s}`, label: s });
      else if (k === 'prep') hits.push({ kind: k, value: s, label: s });
    }
  }
  return hits.sort((a, b) => Number(b.label.toLowerCase() === s) - Number(a.label.toLowerCase() === s) || a.label.localeCompare(b.label)).slice(0, 14);
}

export interface BookWord { kind: Kind; value: string; place?: string; label: string }

/** Every word in the video's word bank for one part of speech, for the word book's tabs. */
export function bookWords(kind: Kind): BookWord[] {
  switch (kind) {
    case 'phrase':
      return [
        ...PLACES.flatMap((p) => p.preps.map((prep) => ({ kind, value: prep, place: p.id, label: `${prep} the ${p.id}` }))),
        ...NOUNS.flatMap((n) => NOUN_PREPS.map((prep) => ({ kind, value: prep, place: n.id, label: `${prep} the ${n.sing}` }))),
      ];
    case 'pronoun':
      return PRONOUNS.map((p) => ({ kind, value: p.id, label: p.subj }));
    default: {
      // The video's own words, then every other word the dictionary lists for this part of speech.
      const own: BookWord[] = kind === 'verb' ? VERBS.map((v) => ({ kind, value: v.id, label: v.base })) : baseChoices(kind).map((c) => ({ kind, value: c.value, label: c.label }));
      const seen = new Set(own.map((w) => w.label.toLowerCase().replace(/ \(many\)$/, '')));
      const more = dictWords(kind).filter((w) => !seen.has(w)).map((w) => ({ kind, value: kind === 'prep' ? w : `w:${w}`, label: w }));
      return [...own, ...more];
    }
  }
}

/** Is this a word the video has its own picture or motion for? */
export const drawn = (w: BookWord) => !isDict(w.value) && !(w.kind === 'prep' && !PREPS.includes(w.value as PrepId));

/** The word book's tabs, in the order students meet them. */
export const BOOK_KINDS: Kind[] = ['noun', 'propernoun', 'pronoun', 'verb', 'adjective', 'adverb', 'article', 'prep', 'conj', 'interjection'];
