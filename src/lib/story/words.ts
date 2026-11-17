// Story Maker word bank: every word here has a picture and a motion in the video, so any sentence built from it
// can be acted out. Add a word by adding a row (and, for a new noun, a look in render.ts).

export type Tense = 'past' | 'present' | 'future';

export type LookId =
  | 'dog' | 'cat' | 'bird' | 'frog' | 'fish' | 'rabbit' | 'turtle' | 'robot' | 'girl' | 'boy' | 'me' | 'you'
  | 'ball' | 'apple' | 'cake' | 'box' | 'book' | 'flower'
  // A dictionary word the video has no picture for (shown as a sign with the word), and a place (drawn as the scene).
  | 'word' | 'place';

export type VerbId =
  | 'run' | 'walk' | 'jump' | 'swim' | 'fly' | 'roll' | 'bounce' | 'dance' | 'sleep' | 'sit' | 'hide'
  | 'sing' | 'bark' | 'meow' | 'croak' | 'beep' | 'laugh' | 'cry' | 'fall'
  | 'chase' | 'kick' | 'eat' | 'hug' | 'find' | 'push';

export type Pron3 = 'he' | 'she' | 'it';

export interface NounDef { id: string; sing: string; plural: string; look: LookId; kind: 'animal' | 'person' | 'thing'; pron: Pron3; food?: boolean; place?: boolean }

export const NOUNS: NounDef[] = [
  { id: 'dog', sing: 'dog', plural: 'dogs', look: 'dog', kind: 'animal', pron: 'it' },
  { id: 'cat', sing: 'cat', plural: 'cats', look: 'cat', kind: 'animal', pron: 'it' },
  { id: 'bird', sing: 'bird', plural: 'birds', look: 'bird', kind: 'animal', pron: 'it' },
  { id: 'frog', sing: 'frog', plural: 'frogs', look: 'frog', kind: 'animal', pron: 'it' },
  { id: 'fish', sing: 'fish', plural: 'fish', look: 'fish', kind: 'animal', pron: 'it' },
  { id: 'rabbit', sing: 'rabbit', plural: 'rabbits', look: 'rabbit', kind: 'animal', pron: 'it' },
  { id: 'turtle', sing: 'turtle', plural: 'turtles', look: 'turtle', kind: 'animal', pron: 'it' },
  { id: 'robot', sing: 'robot', plural: 'robots', look: 'robot', kind: 'thing', pron: 'it' },
  { id: 'girl', sing: 'girl', plural: 'girls', look: 'girl', kind: 'person', pron: 'she' },
  { id: 'boy', sing: 'boy', plural: 'boys', look: 'boy', kind: 'person', pron: 'he' },
  { id: 'ball', sing: 'ball', plural: 'balls', look: 'ball', kind: 'thing', pron: 'it' },
  { id: 'apple', sing: 'apple', plural: 'apples', look: 'apple', kind: 'thing', pron: 'it', food: true },
  { id: 'cake', sing: 'cake', plural: 'cakes', look: 'cake', kind: 'thing', pron: 'it', food: true },
  { id: 'box', sing: 'box', plural: 'boxes', look: 'box', kind: 'thing', pron: 'it' },
  { id: 'book', sing: 'book', plural: 'books', look: 'book', kind: 'thing', pron: 'it' },
  { id: 'flower', sing: 'flower', plural: 'flowers', look: 'flower', kind: 'thing', pron: 'it' },
  // Places are nouns too ("at the park"); the video draws them as the scene.
  { id: 'park', sing: 'park', plural: 'parks', look: 'place', kind: 'thing', pron: 'it', place: true },
  { id: 'pond', sing: 'pond', plural: 'ponds', look: 'place', kind: 'thing', pron: 'it', place: true },
  { id: 'beach', sing: 'beach', plural: 'beaches', look: 'place', kind: 'thing', pron: 'it', place: true },
  { id: 'forest', sing: 'forest', plural: 'forests', look: 'place', kind: 'thing', pron: 'it', place: true },
  { id: 'house', sing: 'house', plural: 'houses', look: 'place', kind: 'thing', pron: 'it', place: true },
  { id: 'hill', sing: 'hill', plural: 'hills', look: 'place', kind: 'thing', pron: 'it', place: true },
  { id: 'tree', sing: 'tree', plural: 'trees', look: 'place', kind: 'thing', pron: 'it', place: true },
  { id: 'bridge', sing: 'bridge', plural: 'bridges', look: 'place', kind: 'thing', pron: 'it', place: true },
];

export interface NameDef { id: string; look: LookId; pron: Pron3 }
export const NAMES: NameDef[] = [
  { id: 'Sam', look: 'boy', pron: 'he' },
  { id: 'Mia', look: 'girl', pron: 'she' },
  { id: 'Max', look: 'dog', pron: 'he' },
  { id: 'Luna', look: 'cat', pron: 'she' },
  { id: 'Pip', look: 'bird', pron: 'she' },
  { id: 'Bolt', look: 'robot', pron: 'it' },
  // Titles keep their period (her request 2026-11-17): the period after Dr., Mr., Ms. or Mrs. is part of the name,
  // not the end of the sentence.
  { id: 'Dr. Lee', look: 'you', pron: 'she' },
  { id: 'Mr. Kim', look: 'boy', pron: 'he' },
  { id: 'Ms. Rosa', look: 'girl', pron: 'she' },
  { id: 'Mrs. Diaz', look: 'me', pron: 'she' },
];

/** Titles that go before a name, with their period. */
export const TITLES = ['Dr.', 'Mr.', 'Ms.', 'Mrs.'];

export type PronKey = 'i' | 'you' | 'he' | 'she' | 'it' | 'we' | 'they';
export interface PronounDef { id: PronKey; subj: string; obj: string; num: 'i' | 'sg' | 'pl' }
export const PRONOUNS: PronounDef[] = [
  { id: 'i', subj: 'I', obj: 'me', num: 'i' },
  { id: 'you', subj: 'you', obj: 'you', num: 'pl' },
  { id: 'he', subj: 'he', obj: 'him', num: 'sg' },
  { id: 'she', subj: 'she', obj: 'her', num: 'sg' },
  { id: 'it', subj: 'it', obj: 'it', num: 'sg' },
  { id: 'we', subj: 'we', obj: 'us', num: 'pl' },
  { id: 'they', subj: 'they', obj: 'them', num: 'pl' },
];

export type Motion = 'loco' | 'static' | 'sound' | 'object' | 'fall';
export type ObjectRule = 'living' | 'food' | 'kickable' | 'chaseable' | 'any';
export interface VerbDef {
  id: VerbId; base: string; third: string; past: string; ing: string;
  trans: 'no' | 'yes' | 'opt'; motion: Motion; sound?: string; objects?: ObjectRule;
}

export const VERBS: VerbDef[] = [
  { id: 'run', base: 'run', third: 'runs', past: 'ran', ing: 'running', trans: 'no', motion: 'loco' },
  { id: 'walk', base: 'walk', third: 'walks', past: 'walked', ing: 'walking', trans: 'no', motion: 'loco' },
  { id: 'jump', base: 'jump', third: 'jumps', past: 'jumped', ing: 'jumping', trans: 'no', motion: 'loco' },
  { id: 'swim', base: 'swim', third: 'swims', past: 'swam', ing: 'swimming', trans: 'no', motion: 'loco' },
  { id: 'fly', base: 'fly', third: 'flies', past: 'flew', ing: 'flying', trans: 'no', motion: 'loco' },
  { id: 'roll', base: 'roll', third: 'rolls', past: 'rolled', ing: 'rolling', trans: 'no', motion: 'loco' },
  { id: 'bounce', base: 'bounce', third: 'bounces', past: 'bounced', ing: 'bouncing', trans: 'no', motion: 'loco' },
  { id: 'dance', base: 'dance', third: 'dances', past: 'danced', ing: 'dancing', trans: 'no', motion: 'static' },
  { id: 'sleep', base: 'sleep', third: 'sleeps', past: 'slept', ing: 'sleeping', trans: 'no', motion: 'static' },
  { id: 'sit', base: 'sit', third: 'sits', past: 'sat', ing: 'sitting', trans: 'no', motion: 'static' },
  { id: 'hide', base: 'hide', third: 'hides', past: 'hid', ing: 'hiding', trans: 'no', motion: 'static' },
  { id: 'sing', base: 'sing', third: 'sings', past: 'sang', ing: 'singing', trans: 'no', motion: 'sound', sound: 'La la la!' },
  { id: 'bark', base: 'bark', third: 'barks', past: 'barked', ing: 'barking', trans: 'no', motion: 'sound', sound: 'Woof!' },
  { id: 'meow', base: 'meow', third: 'meows', past: 'meowed', ing: 'meowing', trans: 'no', motion: 'sound', sound: 'Meow!' },
  { id: 'croak', base: 'croak', third: 'croaks', past: 'croaked', ing: 'croaking', trans: 'no', motion: 'sound', sound: 'Ribbit!' },
  { id: 'beep', base: 'beep', third: 'beeps', past: 'beeped', ing: 'beeping', trans: 'no', motion: 'sound', sound: 'Beep boop!' },
  { id: 'laugh', base: 'laugh', third: 'laughs', past: 'laughed', ing: 'laughing', trans: 'no', motion: 'sound', sound: 'Ha ha!' },
  { id: 'cry', base: 'cry', third: 'cries', past: 'cried', ing: 'crying', trans: 'no', motion: 'static' },
  { id: 'fall', base: 'fall', third: 'falls', past: 'fell', ing: 'falling', trans: 'no', motion: 'fall' },
  { id: 'chase', base: 'chase', third: 'chases', past: 'chased', ing: 'chasing', trans: 'yes', motion: 'object', objects: 'chaseable' },
  { id: 'kick', base: 'kick', third: 'kicks', past: 'kicked', ing: 'kicking', trans: 'yes', motion: 'object', objects: 'kickable' },
  { id: 'eat', base: 'eat', third: 'eats', past: 'ate', ing: 'eating', trans: 'opt', motion: 'object', objects: 'food' },
  { id: 'hug', base: 'hug', third: 'hugs', past: 'hugged', ing: 'hugging', trans: 'yes', motion: 'object', objects: 'living' },
  { id: 'find', base: 'find', third: 'finds', past: 'found', ing: 'finding', trans: 'yes', motion: 'object', objects: 'any' },
  { id: 'push', base: 'push', third: 'pushes', past: 'pushed', ing: 'pushing', trans: 'yes', motion: 'object', objects: 'kickable' },
];

const PERSON: VerbId[] = ['run', 'walk', 'jump', 'swim', 'dance', 'sit', 'sleep', 'hide', 'sing', 'laugh', 'cry', 'chase', 'kick', 'eat', 'hug', 'find', 'push', 'fall', 'roll'];

/** What each look can do in the video. A sentence asking for anything else is not recognized. */
export const ABILITIES: Record<LookId, VerbId[]> = {
  dog: ['run', 'walk', 'jump', 'swim', 'sit', 'sleep', 'dance', 'hide', 'bark', 'chase', 'kick', 'eat', 'hug', 'find', 'push', 'roll', 'fall'],
  cat: ['run', 'walk', 'jump', 'sit', 'sleep', 'hide', 'meow', 'chase', 'eat', 'find', 'push', 'roll', 'fall', 'dance'],
  bird: ['fly', 'walk', 'jump', 'sing', 'sleep', 'eat', 'find', 'hide', 'sit', 'fall'],
  frog: ['jump', 'swim', 'croak', 'sit', 'sleep', 'eat', 'hide', 'fall'],
  fish: ['swim', 'sleep', 'eat', 'hide'],
  rabbit: ['run', 'walk', 'jump', 'sit', 'sleep', 'hide', 'eat', 'dance', 'find', 'hug', 'fall'],
  turtle: ['walk', 'swim', 'sleep', 'hide', 'eat', 'sit'],
  robot: ['walk', 'run', 'roll', 'dance', 'beep', 'sit', 'find', 'push', 'kick', 'fall', 'hug', 'sleep', 'jump'],
  girl: PERSON, boy: PERSON, me: PERSON, you: PERSON,
  ball: ['roll', 'bounce', 'fall'],
  apple: ['roll', 'fall'],
  cake: ['fall'], box: ['fall'], book: ['fall'], flower: ['fall'],
  word: ['run', 'walk', 'jump', 'swim', 'fly', 'roll', 'bounce', 'dance', 'sleep', 'sit', 'hide', 'sing', 'laugh', 'cry', 'fall', 'chase', 'kick', 'eat', 'hug', 'find', 'push'],
  place: [],
};

export const LIVING: LookId[] = ['dog', 'cat', 'bird', 'frog', 'fish', 'rabbit', 'turtle', 'robot', 'girl', 'boy', 'me', 'you'];

export type AdjKind = 'size' | 'color' | 'feeling' | 'state' | 'speed';
export interface AdjDef { id: string; kind: AdjKind }
export const ADJECTIVES: AdjDef[] = [
  { id: 'big', kind: 'size' }, { id: 'small', kind: 'size' }, { id: 'tiny', kind: 'size' },
  { id: 'red', kind: 'color' }, { id: 'blue', kind: 'color' }, { id: 'green', kind: 'color' }, { id: 'pink', kind: 'color' },
  { id: 'purple', kind: 'color' }, { id: 'yellow', kind: 'color' },
  { id: 'happy', kind: 'feeling' }, { id: 'sad', kind: 'feeling' }, { id: 'sleepy', kind: 'feeling' }, { id: 'angry', kind: 'feeling' },
  { id: 'scared', kind: 'feeling' }, { id: 'silly', kind: 'feeling' }, { id: 'hungry', kind: 'feeling' },
  { id: 'wet', kind: 'state' }, { id: 'cold', kind: 'state' }, { id: 'hot', kind: 'state' }, { id: 'shiny', kind: 'state' },
  { id: 'fast', kind: 'speed' }, { id: 'slow', kind: 'speed' },
];

export type AdvKind = 'manner' | 'intensifier' | 'time' | 'direction';
export interface AdvDef { id: string; kind: AdvKind; tense?: Tense }
export const ADVERBS: AdvDef[] = [
  { id: 'quickly', kind: 'manner' }, { id: 'slowly', kind: 'manner' }, { id: 'happily', kind: 'manner' }, { id: 'sadly', kind: 'manner' },
  { id: 'loudly', kind: 'manner' }, { id: 'quietly', kind: 'manner' }, { id: 'carefully', kind: 'manner' }, { id: 'suddenly', kind: 'manner' },
  { id: 'away', kind: 'direction' }, { id: 'around', kind: 'direction' },
  { id: 'yesterday', kind: 'time', tense: 'past' }, { id: 'today', kind: 'time' }, { id: 'tomorrow', kind: 'time', tense: 'future' },
  { id: 'very', kind: 'intensifier' }, { id: 'so', kind: 'intensifier' }, { id: 'too', kind: 'intensifier' }, { id: 'really', kind: 'intensifier' },
];

export type PrepId = 'in' | 'into' | 'to' | 'on' | 'under' | 'near' | 'behind' | 'over' | 'across' | 'through' | 'up' | 'from' | 'with';
export const PREPS: PrepId[] = ['to', 'in', 'into', 'on', 'under', 'near', 'behind', 'over', 'across', 'through', 'up', 'from', 'with'];
/** Prepositions that move someone from one place to another. */
export const MOVING_PREPS: PrepId[] = ['to', 'into', 'over', 'across', 'through', 'up', 'from'];
/** Prepositions that can go before a person, animal or thing ("from the cat", "with the dog"). */
export const NOUN_PREPS: PrepId[] = ['from', 'to', 'with', 'near', 'behind', 'over'];

export interface PlaceDef { id: string; preps: PrepId[]; water?: boolean }
export const PLACES: PlaceDef[] = [
  { id: 'park', preps: ['in', 'to', 'across'] },
  { id: 'pond', preps: ['in', 'into', 'to', 'near'], water: true },
  { id: 'beach', preps: ['on', 'to', 'near'], water: true },
  { id: 'forest', preps: ['in', 'into', 'to', 'through'] },
  { id: 'house', preps: ['in', 'into', 'to', 'near', 'behind', 'on'] },
  { id: 'hill', preps: ['on', 'to', 'over', 'behind', 'near', 'up'] },
  { id: 'tree', preps: ['under', 'near', 'behind', 'to', 'up'] },
  { id: 'bridge', preps: ['under', 'over', 'on', 'across', 'to'] },
];

export const INTERJECTIONS = ['Wow', 'Yay', 'Oops', 'Boom', 'Crash', 'Splash', 'Uh-oh', 'Hooray'];
export const CONJUNCTIONS = ['and', 'but', 'so', 'because'];

export const nounById = (id: string) => NOUNS.find((n) => n.id === id);
export const verbById = (id: string) => VERBS.find((v) => v.id === id);
export const adjById = (id: string) => ADJECTIVES.find((a) => a.id === id);
export const advById = (id: string) => ADVERBS.find((a) => a.id === id);
export const placeById = (id: string) => PLACES.find((p) => p.id === id);
export const nameById = (id: string) => NAMES.find((n) => n.id === id);
export const pronounById = (id: string) => PRONOUNS.find((p) => p.id === id);

/** Noun values are "dog" (one) or "dog:pl" (more than one). */
export function readNoun(value: string | undefined): { def: NounDef; plural: boolean } | null {
  if (!value) return null;
  const [id, pl] = value.split(':');
  const def = nounById(id);
  return def ? { def, plural: pl === 'pl' } : null;
}
