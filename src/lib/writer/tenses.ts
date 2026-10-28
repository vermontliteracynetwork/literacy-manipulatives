import { tagInContext } from './tagger';
import { isWord } from './spell';

// Past, present and future versions of a model sentence (her request 2026-10-28), for the Sentence Formulas
// reference: "The frog jumps." / "The frog jumped." / "The frog will jump." Built from the sentence's own verbs
// and subjects; a sentence whose verbs can't be changed safely (commands, "can", "should") shows no versions.

const IRREGULAR: Record<string, string> = {
  be: 'was', have: 'had', do: 'did', go: 'went', come: 'came', see: 'saw', get: 'got', make: 'made', take: 'took', give: 'gave',
  say: 'said', tell: 'told', know: 'knew', think: 'thought', feel: 'felt', run: 'ran', eat: 'ate', drink: 'drank', sleep: 'slept',
  sit: 'sat', stand: 'stood', swim: 'swam', fly: 'flew', write: 'wrote', draw: 'drew', sing: 'sang', ride: 'rode', throw: 'threw',
  catch: 'caught', find: 'found', keep: 'kept', build: 'built', bring: 'brought', buy: 'bought', sell: 'sold', wear: 'wore',
  hold: 'held', hide: 'hid', fall: 'fell', grow: 'grew', teach: 'taught', win: 'won', lose: 'lost', leave: 'left', meet: 'met',
  pay: 'paid', send: 'sent', spend: 'spent', wake: 'woke', dig: 'dug', fight: 'fought', begin: 'began', break: 'broke',
  choose: 'chose', drive: 'drove', forget: 'forgot', hear: 'heard', speak: 'spoke', steal: 'stole', lay: 'laid', lie: 'lay',
  lead: 'led', read: 'read', put: 'put', cut: 'cut', hit: 'hit', hurt: 'hurt', let: 'let', set: 'set', shut: 'shut', cost: 'cost',
  bite: 'bit', blow: 'blew', feed: 'fed', freeze: 'froze', hang: 'hung', shake: 'shook', shine: 'shone', shoot: 'shot',
  sink: 'sank', slide: 'slid', spin: 'spun', stick: 'stuck', sting: 'stung', strike: 'struck', swing: 'swung', tear: 'tore',
  understand: 'understood', weep: 'wept', wind: 'wound', bend: 'bent', light: 'lit', ring: 'rang', rise: 'rose', seek: 'sought',
  sweep: 'swept', lend: 'lent', mean: 'meant', bleed: 'bled', creep: 'crept', flee: 'fled', kneel: 'knelt', quit: 'quit',
};
const PAST_TO_BASE = Object.fromEntries(Object.entries(IRREGULAR).map(([b, p]) => [p, b]));
const HELPERS = new Set(['can', 'could', 'should', 'must', 'may', 'might', 'shall', 'would']);
const SINGULAR_PRONOUNS = new Set(['he', 'she', 'it', 'this', 'that', 'someone', 'somebody', 'everyone', 'everybody', 'nobody', 'anyone', 'each', 'who', 'what']);

type Number = 'one' | 'many' | 'i';
const POSSESSIVES = new Set(['my', 'your', 'his', 'her', 'its', 'our', 'their']);
const third = (b: string) => (b === 'have' ? 'has' : b === 'do' ? 'does' : b === 'go' ? 'goes' : b === 'be' ? 'is'
  : /[^aeiou]y$/.test(b) ? `${b.slice(0, -1)}ies` : /(s|sh|ch|x|z|o)$/.test(b) ? `${b}es` : `${b}s`);
export function pastOf(b: string): string {
  if (IRREGULAR[b]) return IRREGULAR[b];
  if (/e$/.test(b)) return `${b}d`;
  if (/[^aeiou]y$/.test(b)) return `${b.slice(0, -1)}ied`;
  if (/^[^aeiou]*[aeiou][bdgmnprt]$/.test(b) && b.length <= 4) return `${b}${b.slice(-1)}ed`;
  return `${b}ed`;
}
const known = (w: string) => isWord(w);
export function baseOf(v: string): string {
  const w = v.toLowerCase();
  if (['is', 'are', 'am', 'was', 'were', 'be', 'been'].includes(w)) return 'be';
  if (w === 'has' || w === 'had') return 'have';
  if (w === 'does' || w === 'did') return 'do';
  if (PAST_TO_BASE[w]) return PAST_TO_BASE[w];
  if (IRREGULAR[w]) return w;
  if (/ied$/.test(w)) return `${w.slice(0, -3)}y`;
  if (/ed$/.test(w)) {
    const stem = w.slice(0, -2);
    if (/([bdgmnprt])\1$/.test(stem) && known(stem.slice(0, -1))) return stem.slice(0, -1);
    if (known(`${stem}e`) && !known(stem)) return `${stem}e`;
    if (/[^aeiou]e?$/.test(stem) && known(stem)) return stem;
    return known(`${w.slice(0, -1)}`) ? w.slice(0, -1) : stem;
  }
  if (/ies$/.test(w)) return `${w.slice(0, -3)}y`;
  if (/(ss|sh|ch|x|z|o)es$/.test(w)) return w.slice(0, -2);
  if (/[^s]s$/.test(w)) return w.slice(0, -1);
  return w;
}
const be = (n: Number, tense: 'present' | 'past') => (tense === 'past' ? (n === 'many' ? 'were' : 'was') : n === 'i' ? 'am' : n === 'one' ? 'is' : 'are');
const doForm = (n: Number, tense: 'present' | 'past') => (tense === 'past' ? 'did' : n === 'one' ? 'does' : 'do');

function numberOf(word: string, cls: string): Number | null {
  const w = word.toLowerCase();
  if (cls === 'pronoun' && POSSESSIVES.has(w)) return null;
  if (cls === 'pronoun') return w === 'i' ? 'i' : SINGULAR_PRONOUNS.has(w) ? 'one' : 'many';
  if (cls === 'propernoun') return 'one';
  if (cls === 'noun') return /[^s]s$/.test(w) && !/(ss|us|is)$/.test(w) ? 'many' : 'one';
  return null;
}
const keepCase = (from: string, to: string) => (/^[A-Z]/.test(from) ? to.charAt(0).toUpperCase() + to.slice(1) : to);

export interface Versions { past: string; present: string; future: string }

const RELATIVE = new Set(['which', 'who', 'that', 'whom']);
const PLURAL_NOUNS = new Set(['people', 'children', 'men', 'women', 'mice', 'feet', 'teeth', 'geese', 'police', 'cattle']);
// Clauses that start with these words keep the present for the future: "We will eat after we swim."
const TIME_CLAUSE = new Set(['after', 'before', 'when', 'if', 'until', 'once', 'as', 'unless', 'while']);
const BE_ADVERBS = new Set(['not', 'never', 'always', 'still', 'also', 'often', 'usually']);

export function tenseVersions(sentence: string): Versions | null {
  const tagged = tagInContext(sentence);
  const spans = [...sentence.matchAll(/[A-Za-z']+/g)].map((m) => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
  if (!tagged.length || tagged.some((w) => w.parts) || tagged.some((w) => HELPERS.has(w.word.toLowerCase()))) return null;
  const lower = tagged.map((w) => w.word.toLowerCase());
  const gapBefore = spans.map((sp, i) => sentence.slice(i ? spans[i - 1].end : 0, sp.start));
  const num = (i: number): Number | null => (PLURAL_NOUNS.has(lower[i]) ? 'many' : numberOf(tagged[i].word, tagged[i].wordClass));
  const firstVerb = tagged.findIndex((w) => w.wordClass === 'verb');
  if (firstVerb < 0) return null;
  const question = /\?\s*["”]?$/.test(sentence);
  const subjectBefore = tagged.slice(0, firstVerb).some((_, i) => num(i) && !RELATIVE.has(lower[i]));
  if (!subjectBefore && !question) return null;
  // "Sam, close the door." talks to Sam: a command, so no tense versions.
  if (!question && /,/.test(gapBefore[firstVerb]) && baseOf(lower[firstVerb]) === lower[firstVerb] && tagged.slice(0, firstVerb).every((w) => w.wordClass === 'propernoun')) return null;

  const make = (tense: 'past' | 'present' | 'future'): string | null => {
    const edits: { i: number; to: string }[] = [];
    let subject: Number = 'one';
    let seenSubject = false, verbSince = false, clauseHasWill = false, keepBase = false, timeClause = false;
    for (let i = 0; i < tagged.length; i++) {
      const w = tagged[i];
      const lw = lower[i];
      // A new sentence, a semicolon, or the end of a time clause starts a new subject.
      const newClause = () => { seenSubject = false; verbSince = false; clauseHasWill = false; };
      if (/[.!?;]/.test(gapBefore[i]) || (/,/.test(gapBefore[i]) && (timeClause || verbSince))) { newClause(); timeClause = false; }
      if (w.wordClass === 'conjunction') {
        if (TIME_CLAUSE.has(lw)) { timeClause = true; newClause(); }
        else if (lw !== 'and' && lw !== 'or') newClause();
        continue;
      }
      const n = num(i);
      if (n && w.wordClass !== 'verb') {
        if (RELATIVE.has(lw)) continue;
        // The first naming word before the verb is the subject; "Sam and Mia" before it makes it many.
        if (!seenSubject) { subject = n; seenSubject = true; verbSince = false; }
        else if (!verbSince && lower[i - 1] === 'and' || (!verbSince && lower.slice(0, i).includes('and'))) subject = 'many';
        continue;
      }
      if (w.wordClass !== 'verb') continue;
      const tz = tense === 'future' && timeClause ? 'present' : tense;
      const next = lower[i + 1] ?? '';
      // Question: "Is the cat big?" / "Did the dog bark?" / "Where did the cat go?": the helper comes before
      // its subject.
      if (question && !seenSubject) {
        const si = tagged.findIndex((_, k) => k > i && num(k) && !RELATIVE.has(lower[k]));
        if (si < 0) return null;
        const sn = num(si)!;
        const base = baseOf(lw);
        if (base === 'be') {
          if (tz === 'future') edits.push({ i, to: 'will' }, { i: si, to: `${tagged[si].word} be` });
          else edits.push({ i, to: be(sn, tz) });
        } else if (base === 'do') { edits.push({ i, to: tz === 'future' ? 'will' : doForm(sn, tz) }); keepBase = true; }
        else if (lw === 'will') { if (tz !== 'future') edits.push({ i, to: doForm(sn, tz) }); keepBase = true; }
        else return null;
        subject = sn; seenSubject = true; verbSince = true;
        continue;
      }
      verbSince = true;
      // The verb after "do"/"did"/"will" stays in its base form; the helper carries the tense.
      if (keepBase) { keepBase = false; continue; }
      if (lw === 'will') {
        const v = i + 1 + (next === 'not' ? 1 : 0);
        if (tz === 'future') { clauseHasWill = true; keepBase = true; continue; }
        if (next === 'not') { edits.push({ i, to: doForm(subject, tz) }); keepBase = true; continue; }
        if (lower[v] === 'be') { edits.push({ i, to: '' }, { i: v, to: be(subject, tz) }); i = v; continue; }
        edits.push({ i, to: '' }, { i: v, to: tz === 'past' ? pastOf(baseOf(lower[v])) : subject === 'one' ? third(baseOf(lower[v])) : baseOf(lower[v]) });
        i = v;
        continue;
      }
      if (['do', 'does', 'did'].includes(lw) && (next === 'not' || tagged[i + 1]?.wordClass === 'verb')) {
        edits.push({ i, to: tz === 'future' ? 'will' : doForm(subject, tz) });
        keepBase = true;
        if (next === 'not') i++;
        continue;
      }
      if (lower[i - 1] === 'to') continue;
      const base = baseOf(lw);
      // "is floating", "was canceled": the helper changes, the -ing or -ed word stays.
      const partAfter = /(ing|ed|en)$/.test(lower[i + 1] ?? '') && tagged[i + 1]?.wordClass === 'verb' && (base === 'be' || base === 'have');
      if (base === 'be' && tz === 'future' && BE_ADVERBS.has(next)) {
        // "is not small" becomes "will not be small".
        edits.push({ i, to: 'will' }, { i: i + 1, to: `${tagged[i + 1].word} be` });
        i++;
        clauseHasWill = true;
        continue;
      }
      const afterAnd = lower[i - 1] === 'and' || lower[i - 1] === 'or';
      let to: string;
      if (tz === 'future') to = clauseHasWill && afterAnd ? base : `will ${base}`;
      else if (base === 'be') to = be(subject, tz);
      else if (base === 'have' && partAfter) to = tz === 'past' ? 'had' : subject === 'one' ? 'has' : 'have';
      else to = tz === 'past' ? pastOf(base) : subject === 'one' ? third(base) : base;
      edits.push({ i, to });
      if (partAfter) i++;
      if (tz === 'future') clauseHasWill = true;
    }
    let out = sentence;
    for (const e of [...edits].sort((a, b) => b.i - a.i)) {
      const sp = spans[e.i];
      const from = sentence.slice(sp.start, sp.end);
      const to = e.to ? keepCase(from, e.to) : '';
      out = out.slice(0, sp.start) + to + out.slice(sp.end);
      if (!to) out = out.slice(0, sp.start) + out.slice(sp.start).replace(/^\s+/, '');
    }
    return out.replace(/\s{2,}/g, ' ');
  };
  const past = make('past'), present = make('present'), future = make('future');
  if (!past || !present || !future) return null;
  return { past, present, future };
}
