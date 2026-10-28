import { wordJobs, type PatternWord } from '../sentenceSearch';
import type { MontessoriWordClass } from '../montessoriGrammar';
import { myWordClass } from './myWords';
import { dictionaryJobs, isWord, suggestFor, wordRank, wordsReady } from './spell';

// Write mode's symbols (her notes 2026-10-28: "make sure you are referencing the word itself, and its placement
// in the sentence"; "this is a teaching tool, it is important we are accurate"). Every word goes through the
// same explicit steps:
//   1. Dictionary: the jobs the dictionary lists for the word, most common first (WordNet counts in
//      public/writer/pos.json, plus the board's own word lists and the small closed word groups below).
//   2. Context: when the word can do more than one job, its neighbors decide ("like" after "ran" is a
//      preposition, after "I" a verb; "jump" after "a" is a noun; "brown" between "a" and "hat" describes).
//   3. Spelling: a misspelled word is flagged unsure (Write mode shows no symbol for it), and its neighbors are
//      judged by the word the student most likely meant, so a misspelling never decides another word's symbol.
//   4. Recheck: each job is checked against the dictionary again, and every article or describing word must
//      lead to a noun; anything that fails is corrected.
// Her formulas count my, your, their and its as pronouns, so they're pronouns here too.

type C = MontessoriWordClass;
const SUBJECT = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they']);
const OBJECT = new Set(['me', 'him', 'us', 'them', 'whom', 'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'themselves', 'mine', 'yours', 'hers', 'ours', 'theirs', 'everyone', 'everybody', 'someone', 'somebody', 'anyone', 'anybody', 'nobody', 'nothing', 'something', 'anything', 'everything', 'her']);
const POSSESSIVE = new Set(['my', 'your', 'his', 'its', 'our', 'their']);
const DETERMINER = new Set(['this', 'that', 'these', 'those', 'some', 'any', 'every', 'each', 'no', 'many', 'much', 'few', 'all', 'both', 'several', 'another', 'other', 'such', 'enough', 'more', 'most', 'less', 'least', 'either', 'neither']);
const NUMBER = /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|next)$/;
const ORDER = new Set(['first', 'next', 'then', 'last', 'finally', 'second', 'third']);
const HELPERS = new Set(['will', 'would', 'can', 'could', 'should', 'must', 'may', 'might', 'shall']);
const DO = new Set(['do', 'does', 'did']);
const BE = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
const LINKING = new Set(['feel', 'feels', 'felt', 'seem', 'seems', 'seemed', 'look', 'looks', 'looked', 'become', 'becomes', 'became', 'stay', 'stays', 'stayed', 'get', 'gets', 'got', 'sound', 'sounds', 'smell', 'smells', 'taste', 'tastes', 'turn', 'turned', 'grow', 'grew']);
const HAVE = new Set(['have', 'has', 'had']);
const WH_ADVERB = new Set(['how', 'why', 'when', 'where']);
const WH_PRONOUN = new Set(['what', 'who', 'which', 'whose']);
const ADVERB = new Set(['not', 'very', 'too', 'also', 'just', 'now', 'then', 'here', 'there', 'never', 'always', 'often', 'sometimes', 'soon', 'again', 'still', 'already', 'almost', 'really', 'quite', 'ever', 'once', 'today', 'tonight', 'tomorrow', 'yesterday', 'away', 'back', 'even', 'only', 'maybe', 'perhaps', 'later', 'together', 'instead', 'however', 'therefore', 'outside', 'inside', 'upstairs', 'downstairs', 'home', 'please', 'finally', 'sometimes', 'usually', 'everywhere', 'somewhere', 'anywhere', 'nowhere']);
// Words that describe a noun before it ("a hard rock") but tell how after a verb ("ran fast").
const FLEX = new Set(['fast', 'hard', 'late', 'early', 'well', 'high', 'low', 'long', 'straight', 'right', 'wrong', 'loud', 'close']);
const PREPOSITION = new Set(['in', 'on', 'at', 'to', 'from', 'with', 'without', 'by', 'for', 'of', 'about', 'under', 'over', 'into', 'onto', 'through', 'across', 'after', 'before', 'behind', 'between', 'near', 'around', 'above', 'below', 'beside', 'during', 'until', 'since', 'toward', 'towards', 'upon', 'off', 'past', 'against', 'along', 'among', 'beyond', 'within', 'up', 'down', 'out', 'like', 'except', 'beneath', 'inside', 'outside']);
const CONJUNCTION = new Set(['and', 'but', 'or', 'nor', 'because', 'although', 'though', 'if', 'unless', 'while', 'whereas', 'than', 'whether']);
const SUBORDINATE_OR_PREP = new Set(['since', 'until', 'after', 'before', 'as']);
const ARTICLE = new Set(['a', 'an', 'the']);
const TITLES = new Set(['dr', 'mr', 'mrs', 'ms', 'miss', 'prof', 'mt', 'st', 'sir', 'aunt', 'uncle', 'grandma', 'grandpa', 'coach']);
const ADJ_SUFFIX = /(ful|ous|ive|able|ible|al|ic|less|ish|ary|ent|ant|y)$/;
const NOUN_SUFFIX = /(ness|tion|sion|ment|ity|ship|hood|ism|ist|ance|ence|dom|er|or)$/;

// Contractions do two jobs in one word (her note 2026-10-28): "We've" is a pronoun and a verb, "can't" a verb
// and an adverb (not), "let's" a verb and a pronoun. Each gets both symbols.
const PRONOUN_VERB = /^(i|you|he|she|it|we|they|that|what|who|there|here|where|how)('m|'re|'s|'ve|'ll|'d)$/;
const VERB_NOT = /^(do|does|did|is|are|was|were|has|have|had|could|would|should|must|might|need)n't$|^(can't|won't|shan't|ain't)$/;
export function contractionParts(lower: string): C[] | null {
  const w = lower.replace(/’/g, "'");
  const m = w.match(PRONOUN_VERB);
  if (m) return [['there', 'here', 'where', 'how'].includes(m[1]) ? 'adverb' : 'pronoun', 'verb'];
  if (VERB_NOT.test(w)) return ['verb', 'adverb'];
  if (w === "let's") return ['verb', 'pronoun'];
  return null;
}
const endsInHelper = (lower: string) => /('ll|'d|n't)$/.test(lower.replace(/’/g, "'"));

const clean = (w: string) => w.replace(/^'+|'+$/g, '');
const isNounish = (c: C | undefined) => c === 'noun' || c === 'propernoun' || c === 'pronoun';

interface Tok { word: string; lower: string; jobs: Set<C>; dict: C[]; known: boolean; unknown: boolean; unsure: boolean; clauseStart: boolean; afterComma: boolean; next?: Tok }
const CLOSED = (w: string) => PREPOSITION.has(w) || SUBORDINATE_OR_PREP.has(w) || ADVERB.has(w) || WH_ADVERB.has(w) || CONJUNCTION.has(w) || SUBJECT.has(w)
  || OBJECT.has(w) || POSSESSIVE.has(w) || WH_PRONOUN.has(w) || ARTICLE.has(w) || BE.has(w) || DO.has(w) || HAVE.has(w) || HELPERS.has(w) || DETERMINER.has(w) || NUMBER.test(w);

// The jobs a word could do: the board's word lists, closed word groups, and word endings for new words.
function jobsOf(lower: string): Set<C> {
  // Step 1: the dictionary's jobs first (most common first), then the board's word lists.
  const j = new Set<C>(dictionaryJobs(lower) ?? []);
  for (const c of wordJobs(lower)) j.add(c);
  if (PREPOSITION.has(lower) || SUBORDINATE_OR_PREP.has(lower)) j.add('preposition');
  if (ADVERB.has(lower) || WH_ADVERB.has(lower) || ORDER.has(lower)) j.add('adverb');
  if (CONJUNCTION.has(lower)) j.add('conjunction');
  if (SUBJECT.has(lower) || OBJECT.has(lower) || POSSESSIVE.has(lower) || WH_PRONOUN.has(lower)) j.add('pronoun');
  if (ARTICLE.has(lower)) j.add('article');
  if (BE.has(lower) || DO.has(lower) || HAVE.has(lower) || HELPERS.has(lower)) j.add('verb');
  if (FLEX.has(lower)) j.add('adjective');
  if (j.size) return j;
  // taller, tallest, happier: a describing word with -er or -est
  const comp = lower.match(/^(.+?)(er|est)$/);
  if (comp) {
    const stems = [comp[1], `${comp[1]}e`, comp[1].replace(/i$/, 'y'), comp[1].replace(/(.)\1$/, '$1')];
    if (stems.some((s) => wordJobs(s).has('adjective') || FLEX.has(s))) { j.add('adjective'); return j; }
  }
  if (/ly$/.test(lower)) j.add('adverb');
  else if (/(ed|ing)$/.test(lower)) { j.add('verb'); j.add('adjective'); }
  else if (NOUN_SUFFIX.test(lower)) j.add('noun');
  else if (ADJ_SUFFIX.test(lower) && lower.length > 4) j.add('adjective');
  if (/[^s]s$/.test(lower)) { j.add('noun'); j.add('verb'); }
  if (!j.size) j.add('noun');
  return j;
}

// Could the next word be the noun a describing word or article points to?
const nounAhead = (t?: Tok): boolean => {
  if (!t || t.afterComma && !t.jobs.has('adjective')) return false;
  if (ARTICLE.has(t.lower) || BE.has(t.lower) || DO.has(t.lower) || HELPERS.has(t.lower) || CONJUNCTION.has(t.lower) || (PREPOSITION.has(t.lower) && !t.jobs.has('noun')) || ADVERB.has(t.lower)) return false;
  if (SUBJECT.has(t.lower) || OBJECT.has(t.lower) || POSSESSIVE.has(t.lower) || DETERMINER.has(t.lower)) return false;
  if (t.jobs.has('noun') || t.jobs.has('propernoun') || NUMBER.test(t.lower)) return true;
  if (t.jobs.has('adjective')) return nounAhead(t.next);
  return false;
};
const startsNounPhrase = (t?: Tok) => !!t && (ARTICLE.has(t.lower) || POSSESSIVE.has(t.lower) || OBJECT.has(t.lower) || SUBJECT.has(t.lower) || DETERMINER.has(t.lower) || NUMBER.test(t.lower) || /^[A-Z]/.test(t.word) || nounAhead(t));

export interface TaggedWord extends PatternWord { parts?: C[]; unsure?: boolean }

export function tagInContext(text: string): TaggedWord[] {
  const toks: Tok[] = [];
  let last = 0;
  for (const m of text.matchAll(/[A-Za-z']+/g)) {
    const gap = text.slice(last, m.index);
    const word = clean(m[0]) || m[0];
    const lower = word.toLowerCase();
    const afterTitle = /^\.\s*$/.test(gap) && TITLES.has(toks[toks.length - 1]?.lower ?? '');
    const clauseStart = toks.length === 0 || (!afterTitle && /[“"(:;—–.!?]|\s-\s|^-|‘/.test(gap)) || /^'/.test(m[0]);
    // Step 3: a misspelled word (not a name, not in my dictionary) is unsure; it is read as the word the
    // student most likely meant, so it doesn't throw off its neighbors.
    const nameSpot = /^[A-Z]/.test(word) && !clauseStart;
    const unsure = wordsReady() && !isWord(lower) && !CLOSED(lower) && !nameSpot && !myWordClass(lower) && !contractionParts(lower);
    // (A capitalized unknown word is more likely a name than a misspelling, so it isn't swapped.)
    const meant = unsure && !/^[A-Z]/.test(word) ? suggestFor(lower)[0]?.toLowerCase() : undefined;
    const look = meant ?? lower;
    const dict = dictionaryJobs(look) ?? [];
    const jobs = jobsOf(look);
    if (nameSpot) jobs.add('propernoun');
    toks.push({ word: m[0], lower: look, jobs, dict, known: wordJobs(look).size > 0, unknown: !dict.length && !wordJobs(look).size, unsure, clauseStart, afterComma: /,/.test(gap) });
    last = (m.index ?? 0) + m[0].length;
  }
  toks.forEach((t, i) => { t.next = toks[i + 1]; });
  const commaLater = (i: number) => toks.slice(i + 1).some((t) => t.afterComma);

  const out: C[] = [];
  const parts: (C[] | undefined)[] = [];
  let verbInClause = false;
  const questionHelper = /\?\s*["”]?\s*$/.test(text) && !!toks[0] && (DO.has(toks[0].lower) || HELPERS.has(toks[0].lower) || ((WH_ADVERB.has(toks[0].lower) || WH_PRONOUN.has(toks[0].lower)) && !!toks[1] && (DO.has(toks[1].lower) || HELPERS.has(toks[1].lower))));
  let questionVerbDone = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const w = t.lower;
    const raw = clean(t.word);
    const prev = out[i - 1];
    const prevWord = toks[i - 1]?.lower ?? '';
    const next = t.next;
    if (t.clauseStart) verbInClause = false;
    const pick = (c: C) => { out.push(c); if (c === 'verb') verbInClause = true; };

    // A word in the student's own dictionary does the job they gave it.
    const own = myWordClass(w);
    if (own) { pick(own); continue; }
    const two = contractionParts(w);
    if (two) { parts[i] = two; pick(two[0]); if (two.includes('verb')) verbInClause = true; continue; }
    if (w === 'i') { pick('pronoun'); verbInClause = false; continue; }
    if (ARTICLE.has(w)) { pick('article'); continue; }
    if (TITLES.has(w) && /^[A-Z]/.test(raw) && next && /^[A-Z]/.test(next.word)) { pick('propernoun'); continue; }
    if (HELPERS.has(w) || DO.has(w) || BE.has(w) || HAVE.has(w)) { pick('verb'); continue; }
    // A new subject starts a new idea: "When the bell rang, we left."
    if (SUBJECT.has(w)) { pick('pronoun'); verbInClause = false; continue; }
    if (OBJECT.has(w)) { pick('pronoun'); continue; }
    if (POSSESSIVE.has(w)) { pick('pronoun'); continue; }
    if (ORDER.has(w) && (t.clauseStart || t.afterComma) && next?.afterComma) { pick('adverb'); continue; }
    if (NUMBER.test(w)) { pick(nounAhead(next) ? 'adjective' : 'noun'); continue; }
    if (w === 'that' && (prev === 'verb' || prev === 'noun') && next && (SUBJECT.has(next.lower) || ARTICLE.has(next.lower))) { pick('conjunction'); verbInClause = false; continue; }
    if (DETERMINER.has(w)) { pick(nounAhead(next) ? 'adjective' : 'pronoun'); continue; }
    if (WH_PRONOUN.has(w)) { pick('pronoun'); continue; }
    if (WH_ADVERB.has(w)) {
      // "when" before a subject joins two ideas: mid-sentence, or at the start with a comma later.
      const joins = next && (SUBJECT.has(next.lower) || ARTICLE.has(next.lower) || POSSESSIVE.has(next.lower) || /^[A-Z]/.test(next.word));
      if (w !== 'how' && w !== 'why' && joins && (!t.clauseStart || commaLater(i))) { pick('conjunction'); verbInClause = false; }
      else pick('adverb');
      continue;
    }
    if (w === 'so') { pick(next && (next.jobs.has('adjective') || next.jobs.has('adverb') || ADVERB.has(next.lower)) && !SUBJECT.has(next.lower) ? 'adverb' : 'conjunction'); continue; }
    if (CONJUNCTION.has(w)) { pick('conjunction'); if (w !== 'and' && w !== 'or') verbInClause = false; continue; }
    if (SUBORDINATE_OR_PREP.has(w)) {
      if (next && (SUBJECT.has(next.lower) || (/^[A-Z]/.test(next.word) && next.next?.jobs.has('verb')))) { pick('conjunction'); verbInClause = false; }
      else pick('preposition');
      continue;
    }
    if (w === 'like') {
      // "I like dogs" (verb) or "ran like the wind" (preposition).
      pick((isNounish(prev) && !verbInClause) || HELPERS.has(prevWord) || DO.has(prevWord) || endsInHelper(prevWord) || prevWord === 'to' ? 'verb' : 'preposition');
      continue;
    }
    if (w === 'to') { pick('preposition'); continue; }
    // "up", "out", "outside" with no noun after them tell where: an adverb.
    if (PREPOSITION.has(w)) { pick(startsNounPhrase(next) ? 'preposition' : 'adverb'); continue; }
    if (FLEX.has(w) && (t.clauseStart || t.afterComma || prevWord === 'please') && next && (ARTICLE.has(next.lower) || POSSESSIVE.has(next.lower))) { pick('verb'); continue; }
    if (FLEX.has(w)) { pick(prev === 'article' || prev === 'adjective' || nounAhead(next) ? 'adjective' : prev === 'verb' && !BE.has(prevWord) && !LINKING.has(prevWord) ? 'adverb' : 'adjective'); continue; }
    if (ADVERB.has(w)) { pick('adverb'); continue; }
    if (wordJobs(w).has('interjection') && t.clauseStart) { pick('interjection'); continue; }

    // A capital letter where a sentence or quote doesn't start means a name. At the start, a capitalized word
    // the word list doesn't know (or barely knows) is a name too: "Jen won", "Coco swims".
    const capital = /^[A-Z]/.test(raw);
    if (t.jobs.has('propernoun') && capital) { pick('propernoun'); continue; }
    if (capital && !t.clauseStart) { pick('propernoun'); continue; }
    if (capital && wordsReady() && !t.known) {
      const rank = wordRank(w) ?? (/[^s]s$/.test(w) ? wordRank(w.slice(0, -1)) : undefined);
      if (rank === undefined || (rank >= 2 && !/s$/.test(w) && next && (next.jobs.has('verb') || next.lower === 'and' || next.afterComma))) { pick('propernoun'); continue; }
    }

    // Open words (nouns, verbs, describing words, how words): decided by the words around them.
    const can = (c: C) => t.jobs.has(c);
    const afterHelper = HELPERS.has(prevWord) || DO.has(prevWord) || endsInHelper(prevWord) || prevWord === 'to' || prevWord === "let's" || (prevWord === 'not' && verbInClause);
    if (afterHelper && (can('verb') || t.unknown)) { pick('verb'); continue; }
    // "Did the dog bark?": after a question's helper and its subject, the next word that can be a verb is.
    if (questionHelper && !questionVerbDone && isNounish(prev) && (can('verb') || t.unknown)) { questionVerbDone = true; pick('verb'); continue; }
    // "runs and jumps", "big and red": the word after "and" or "or" does the same job as the word before it.
    if ((prevWord === 'and' || prevWord === 'or') && i >= 2 && ['verb', 'adjective', 'adverb'].includes(out[i - 2]) && t.jobs.has(out[i - 2]) && !BE.has(toks[i - 2].lower)) { pick(out[i - 2]); continue; }
    // "a tour guide,": a noun right after a noun phrase's noun, at the end of the phrase, is part of it.
    if (verbInClause && prev === 'noun' && (out[i - 2] === 'article' || out[i - 2] === 'adjective') && can('noun') && t.dict[0] !== 'adjective' && (!next || next.afterComma || next.clauseStart || PREPOSITION.has(next.lower) || CONJUNCTION.has(next.lower))) { pick('noun'); continue; }
    // "The dog, which was wet, shook.": a verb-able last word after a comma is the sentence's verb.
    if (t.afterComma && !next && (can('verb') || t.unknown)) { pick('verb'); continue; }
    // "A kind, funny dog": describing words in a row with commas.
    if (prev === 'article' && next?.afterComma && next.jobs.has('adjective') && nounAhead(next.next)) { pick('adjective'); continue; }
    // A list keeps going: "apples, bread, and milk".
    if ((t.afterComma || prevWord === 'and' || prevWord === 'or') && (prev === 'noun' || prev === 'conjunction' && out[i - 2] === 'noun') && (can('noun') || t.unknown) && !(can('verb') && SUBJECT.has(next?.lower ?? ''))) { pick('noun'); continue; }
    if (prev === 'article' || prev === 'adjective' || prev === 'preposition' || (prev === 'pronoun' && POSSESSIVE.has(prevWord))) {
      // "a cold and windy day": describing words joined by "and" still lead to the noun.
      const joinedAhead = next && (next.lower === 'and' || next.lower === 'or') && next.next?.jobs.has('adjective') && nounAhead(next.next.next);
      if (can('adjective') && (nounAhead(next) || joinedAhead || (next?.afterComma && next.jobs.has('adjective')))) pick('adjective');
      else if (can('adverb') && /ly$/.test(w) && !can('noun')) pick('adverb');
      else pick(can('noun') || !can('adjective') ? 'noun' : 'adjective');
      continue;
    }
    // After "is" or "feel" (even with "never" between): a describing word, unless it's an -ing action.
    let back = i - 1;
    while (back >= 0 && out[back] === 'adverb') back--;
    const linkWord = toks[back]?.lower ?? '';
    if (back >= 0 && (BE.has(linkWord) || LINKING.has(linkWord)) && out[back] === 'verb') {
      if (/ing$/.test(w) && can('verb') && !nounAhead(next)) pick(BE.has(linkWord) ? 'verb' : 'adjective');
      else if (/ing$/.test(w) && nounAhead(next)) pick('adjective');
      // "is never bored": a describing word after "very", "never", "so".
      else if (/ed$/.test(w) && can('verb') && !(t.dict[0] === 'adjective') && back === i - 1) pick('verb');
      else if (can('adjective') || (t.unknown && !/ed$/.test(w))) pick('adjective');
      else pick(can('adverb') ? 'adverb' : 'noun');
      continue;
    }
    // After a subject with no verb yet, a word that can be a verb is the verb: "Sam and I fish".
    // "The school bus was late": a noun right before "was" or "can" is still part of the subject.
    if (isNounish(prev) && !verbInClause && can('noun') && next && (BE.has(next.lower) || HELPERS.has(next.lower) || DO.has(next.lower) || HAVE.has(next.lower)) && !SUBJECT.has(prevWord)) { pick('noun'); continue; }
    if (isNounish(prev) && !verbInClause && (can('verb') || t.unknown || SUBJECT.has(prevWord))) { pick('verb'); continue; }
    // Start of a clause: a describing word before a noun, a command verb ("Thank you", "Close the door"), or a noun.
    if (t.clauseStart || t.afterComma || prev === 'conjunction' || prevWord === 'please') {
      const commandAhead = next && (ARTICLE.has(next.lower) || OBJECT.has(next.lower) || POSSESSIVE.has(next.lower) || next.lower === 'you' || next.lower === 'it');
      if (can('adjective') && nounAhead(next)) pick('adjective');
      else if ((can('verb') || t.unknown) && commandAhead && !(can('noun') && !can('verb'))) pick('verb');
      else if (can('noun')) pick('noun');
      else if (can('verb')) pick('verb');
      else pick([...t.jobs][0]);
      continue;
    }
    if (prev === 'verb' || prev === 'adverb') {
      // "fly south", "went home": a word the dictionary lists as an adverb, with no noun after it, tells where or how.
      const endsPhrase = !next || next.afterComma || next.clauseStart || PREPOSITION.has(next.lower) || CONJUNCTION.has(next.lower);
      if (can('adverb') && (/ly$/.test(w) || !can('noun') || (endsPhrase && t.dict.includes('adverb') && !BE.has(prevWord)))) pick('adverb');
      else if (can('adjective') && nounAhead(next)) pick('adjective');
      else if (can('noun')) pick('noun');
      else pick(can('verb') && !verbInClause ? 'verb' : [...t.jobs][0]);
      continue;
    }
    // Otherwise the dictionary's most common job.
    pick([...t.jobs][0] ?? 'noun');
  }

  // Step 4: recheck. (a) A word the dictionary knows only does jobs the dictionary lists for it.
  const OPEN = new Set<C>(['noun', 'verb', 'adjective', 'adverb']);
  toks.forEach((t, i) => {
    if (parts[i] || myWordClass(t.lower) || CLOSED(t.lower) || !t.dict.length || !OPEN.has(out[i]) || t.dict.includes(out[i])) return;
    if (out[i] === 'verb' && /(ing|ed)$/.test(t.lower)) return;
    const next = out[i + 1];
    const prev = out[i - 1];
    if (t.dict.includes('adjective') && (next === 'noun' || next === 'adjective')) out[i] = 'adjective';
    else if (t.dict.includes('noun') && (prev === 'article' || prev === 'adjective' || prev === 'preposition')) out[i] = 'noun';
    else if (t.dict.includes('adverb') && prev === 'verb') out[i] = 'adverb';
    else out[i] = t.dict[0];
  });
  // (b) An article, number or "my/your/their" leads to a noun: describing words in a row must end in one.
  toks.forEach((t, i) => {
    if (!(out[i] === 'article' || POSSESSIVE.has(t.lower) || (out[i] === 'adjective' && NUMBER.test(t.lower)))) return;
    let j = i + 1;
    while (j < toks.length && (out[j] === 'adjective' || (out[j] === 'adverb' && ['very', 'so', 'too', 'really'].includes(toks[j].lower))
      || ((toks[j].lower === 'and' || toks[j].lower === 'or') && out[j + 1] === 'adjective')) && !(j > i + 1 && toks[j].clauseStart)) j++;
    const ends = j < toks.length && (out[j] === 'noun' || out[j] === 'propernoun') && !toks[j].clauseStart;
    if (!ends && j > i + 1 && out[j - 1] === 'adjective' && (toks[j - 1].jobs.has('noun') || toks[j - 1].unknown)) out[j - 1] = 'noun';
  });
  return toks.map((t, i) => {
    const tw: TaggedWord = { word: t.word, wordClass: out[i] };
    if (parts[i]) tw.parts = parts[i];
    if (t.unsure) tw.unsure = true;
    return tw;
  });
}
