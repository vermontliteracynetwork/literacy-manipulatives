// Writing Scaffolds — A23-ROADMAP Phase 3 ("writing scaffolds:
// paragraph frames, writing frames, sentence starters... as new Explore
// mats, fade-level exposed only as a teacher accommodation toggle, never
// an auto-advancing system"). Ordinary, widely-used classroom writing
// scaffolds (not a specialized/copyrighted curriculum).
//
// Judgment call, logged rather than silently skipped: the spec's
// "fade-level" accommodation toggle (a teacher setting that shows more
// or less of the starter text) was not built in this pass — it needs a
// teacher-side control this task's scope (the student-facing sandbox
// route and its own lib files) doesn't naturally extend to without
// adding a whole new per-student setting purely for this one feature.
// Every frame currently always shows its full starter text, which is
// never wrong, just not fade-able yet. Flagged here as a real, small,
// well-scoped follow-up rather than invented or skipped silently.
export interface WritingFrame {
  id: string;
  title: string;
  lines: string[]; // fixed starter text before each blank the student fills in
}

export const WRITING_FRAMES: WritingFrame[] = [
  { id: 'sequence', title: 'Sequence Frame', lines: ['First, ', 'Next, ', 'Then, ', 'Finally, '] },
  { id: 'opinion', title: 'Opinion Frame', lines: ['I think ', 'One reason is ', 'Another reason is ', 'In conclusion, '] },
  { id: 'because', title: 'Because Frame', lines: ['I ', 'because ', 'For example, '] },
  { id: 'compare', title: 'Compare and Contrast Frame', lines: ['Both are alike because ', 'They are different because ', 'Overall, '] },
  { id: 'describe', title: 'Describing Frame', lines: ['It looks like ', 'It sounds like ', 'It feels like '] },
  { id: 'paragraph', title: 'Paragraph Frame', lines: ['My topic is ', 'One detail is ', 'Another detail is ', 'In conclusion, '] },
];

export const SENTENCE_STARTERS: string[] = [
  'I think...', 'For example,...', 'In my opinion,...', 'One time,...', 'This reminds me of...',
  'I wonder...', 'My favorite part was...', 'At first,...', 'Suddenly,...', 'In the end,...',
  'One reason is...', 'Another reason is...', 'I noticed that...', 'This is important because...',
];
