import type { PartOfSpeech, Sense, Tier, FrequencyBand } from './types';
import { indexWord } from './data';
import { tierFor } from './data';
import { pastOf, third } from '../writer/tenses';
import { irregularFormsOf, regularForms } from './data';

// Thesaurus engine (build spec 4.2 and Phase 3): clusters per meaning, opposite types, word lines, and swapping a
// word in a sentence while keeping its part of speech and form. UI-free.

export interface Near { word: string; tier: Tier; band: FrequencyBand; closeness: number }

// The words for one meaning: the most common first, then by how common they are.
export function nearWords(sense: Sense): Near[] {
  const list = sense.synonyms.map((s) => ({ word: s.wordId, tier: s.tier, band: s.frequencyBand, closeness: s.closeness }));
  return list.sort((a, b) => a.band - b.band || b.closeness - a.closeness || a.word.localeCompare(b.word));
}

// A sentence frame heading for a meaning, shown with her symbols: "Someone can be..." (noun + can be + adjective).
export function frameFor(pos: PartOfSpeech): { text: string; slots: string[] } {
  if (pos === 'adjective') return { text: 'Someone can be...', slots: ['noun', 'be', 'adjective'] };
  if (pos === 'verb') return { text: 'Someone can...', slots: ['noun', 'verb'] };
  if (pos === 'adverb') return { text: 'Someone does it...', slots: ['noun', 'verb', 'adverb'] };
  if (pos === 'noun') return { text: 'This is a...', slots: ['pronoun', 'be', 'article', 'noun'] };
  return { text: `A word that is ${pos === 'article' ? 'an' : 'a'} ${pos}...`, slots: [pos] };
}

// Word lines (scale opposites), least to most. Drafted by Word Explorer for her review.
export const SCALES: string[][] = [
  ['miserable', 'sad', 'okay', 'happy', 'delighted', 'overjoyed'],
  ['freezing', 'cold', 'cool', 'warm', 'hot', 'boiling'],
  ['tiny', 'small', 'medium', 'big', 'huge', 'enormous'],
  ['slow', 'steady', 'quick', 'fast', 'speedy'],
  ['awful', 'bad', 'okay', 'good', 'great', 'excellent'],
  ['silent', 'quiet', 'loud', 'noisy', 'deafening'],
  ['dry', 'damp', 'wet', 'soaked'],
  ['easy', 'simple', 'tricky', 'hard', 'difficult'],
  ['scared', 'nervous', 'calm', 'confident', 'brave', 'fearless'],
  ['exhausted', 'tired', 'rested', 'lively', 'energetic'],
  ['empty', 'half full', 'full', 'overflowing'],
  ['dim', 'dark', 'light', 'bright', 'dazzling'],
  ['whisper', 'talk', 'shout', 'scream'],
  ['walk', 'jog', 'run', 'sprint'],
  ['nibble', 'eat', 'gobble', 'devour'],
  ['ancient', 'old', 'new', 'brand-new'],
  ['short', 'tall', 'towering'],
  ['weak', 'strong', 'mighty'],
];
export const scaleFor = (word: string, opposite?: string) => SCALES.find((s) => s.includes(word) && (!opposite || s.includes(opposite))) ?? SCALES.find((s) => s.includes(word));

const DIRECTION = [['up', 'down'], ['in', 'out'], ['left', 'right'], ['push', 'pull'], ['come', 'go'], ['above', 'below'], ['before', 'after'], ['open', 'close'], ['give', 'take'], ['buy', 'sell'], ['enter', 'exit'], ['rise', 'fall'], ['top', 'bottom'], ['north', 'south'], ['east', 'west'], ['front', 'back'], ['arrive', 'leave'], ['inside', 'outside'], ['over', 'under'], ['forward', 'backward'], ['send', 'receive'], ['teach', 'learn']];
export type OppositeType = 'scale' | 'either-or' | 'direction' | 'prefix';
export function oppositeType(word: string, opposite: string, pos: PartOfSpeech): OppositeType {
  if (/^(un|in|im|il|ir|dis|non|mis)/.test(opposite) && opposite.endsWith(word.replace(/^(un|in|im|il|ir|dis|non|mis)/, '')) && opposite.length > word.length) return 'prefix';
  if (/^(un|in|im|il|ir|dis|non|mis)/.test(word) && word.endsWith(opposite)) return 'prefix';
  if (DIRECTION.some(([a, b]) => (a === word && b === opposite) || (b === word && a === opposite))) return 'direction';
  if (pos === 'adjective' || scaleFor(word, opposite)?.includes(opposite)) return 'scale';
  return 'either-or';
}
export const OPPOSITE_NAMES: Record<OppositeType, string> = {
  scale: 'Scale opposites (more or less of something)',
  'either-or': 'Either/or opposites (one or the other)',
  direction: 'Direction opposites',
  prefix: 'Prefix opposites (a prefix makes the opposite)',
};

export function nearInfo(word: string): { tier: Tier; band: FrequencyBand } {
  const band = indexWord(word)?.band ?? 5;
  return { tier: tierFor(band), band };
}

// ---------- swapping a word in a sentence ----------
type Form = 'base' | 'past' | 'ing' | 's' | 'plural' | 'er' | 'est';
// Which form of the headword a sentence word is ("ran" is the past of run).
export function formOf(sentenceWord: string, head: string, pos: PartOfSpeech): Form | null {
  const w = sentenceWord.toLowerCase();
  if (w === head) return 'base';
  const f = regularForms(head, pos);
  if (pos === 'verb') {
    if (w === f.past || w === f.pastParticiple || w === pastOf(head)) return 'past';
    if (w === f.ing) return 'ing';
    if (w === third(head)) return 's';
  }
  if (pos === 'noun' && w === f.plural) return 'plural';
  if (pos === 'adjective') { if (w === f.comparative) return 'er'; if (w === f.superlative) return 'est'; }
  return null;
}
// The same form of another word ("sprint" in the past is "sprinted").
export function inForm(word: string, form: Form, pos: PartOfSpeech): string {
  if (form === 'base' || word.includes(' ')) return word;
  const f = regularForms(word, pos, irregularFormsOf(word));
  if (form === 'past') return f.past ?? pastOf(word);
  if (form === 'ing') return f.ing ?? word;
  if (form === 's') return third(word);
  if (form === 'plural') return f.plural ?? word;
  if (form === 'er') return f.comparative ?? word;
  if (form === 'est') return f.superlative ?? word;
  return word;
}
