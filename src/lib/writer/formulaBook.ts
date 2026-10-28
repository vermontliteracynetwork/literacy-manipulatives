// New formulas (her answer 2026-10-28). A sentence that passes all five checks but isn't one of her formulas
// yet is a pattern worth keeping:
// - My formula book: the student presses "Add formula to my book" and can look back at the formulas they made.
// - Formula ideas: every such pattern is collected (with example sentences and who wrote them), so the teacher
//   can turn the useful ones into future curriculum formulas. On a shared board students' patterns reach the
//   teacher's list too.

export interface BookEntry { code: string; sentence: string; at: string }
export interface FormulaIdea { code: string; examples: string[]; names: string[]; count: number }

const BOOK = 'lm-formula-book';
const IDEAS = 'lm-formula-ideas';
const read = <T>(k: string): T[] => { try { return JSON.parse(localStorage.getItem(k) ?? '[]'); } catch { return []; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* not saved */ } };

export const readBook = () => read<BookEntry>(BOOK);
export function addToBook(code: string, sentence: string): BookEntry[] {
  const book = readBook();
  if (!book.some((e) => e.code === code)) book.push({ code, sentence, at: new Date().toISOString().slice(0, 10) });
  write(BOOK, book);
  return book;
}
export function removeFromBook(code: string): BookEntry[] {
  const book = readBook().filter((e) => e.code !== code);
  write(BOOK, book);
  return book;
}

export const readIdeas = () => read<FormulaIdea>(IDEAS);
export function addIdea(code: string, sentence: string, name = ''): FormulaIdea[] {
  const ideas = readIdeas();
  let idea = ideas.find((i) => i.code === code);
  if (!idea) { idea = { code, examples: [], names: [], count: 0 }; ideas.push(idea); }
  if (idea.examples.includes(sentence)) return ideas;
  idea.count++;
  idea.examples = [...idea.examples, sentence].slice(-5);
  if (name && !idea.names.includes(name)) idea.names.push(name);
  write(IDEAS, ideas);
  return ideas;
}
export function clearIdeas() { write(IDEAS, []); }
