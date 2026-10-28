import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type * as Y from 'yjs';
import { Icon } from './Icon';
import { SentenceFormulas, FormulaSymbols } from './SentenceFormulas';
import { MONTESSORI_WORD_CLASS_INFO, type MontessoriWordClass } from '../lib/montessoriGrammar';
import { completionsFor, confidentFix, isWord, loadWords, missesCommonWord, suggestFor, wordsReady } from '../lib/writer/spell';
import { CHECK_LABELS, checkSentence, sentenceIssue, splitSentences, tagForCheck, type CheckItem, type CheckResult, type SentenceIssue, type SentenceSpan } from '../lib/writer/sentenceCheck';
import { readStudentTools, saveStudentTools, type Spacing, type StudentTools, type WriterSettings } from '../lib/writer/settings';
import { LOCAL, accessFor, type PageAccess, type PageStore } from '../lib/writer/pages';
import { addIdea, addToBook, readBook, readIdeas, type BookEntry, type FormulaIdea } from '../lib/writer/formulaBook';
import { addMyWord, myWords, myWordsVersion, removeMyWord, subscribeMyWords } from '../lib/writer/myWords';
import type { TaggedWord } from '../lib/writer/tagger';
import { sentenceSlots, slotClass as slotClassOf, slotDistance, slotLabel, slotMatches } from '../lib/writer/formulaMatch';
import type { FontChoice } from '../lib/fontChoice';

// Write mode (teacher, 2026-10-27; named "Write" 2026-10-28): a word processor separate from the whiteboard, in
// an environment the teacher sets: spell check level, predictive text, auto-capitalization, her grammar symbols
// above the words, and her Sentence Check with the formulas from her Symbolic Grammar curriculum. Writing helpers
// like Grammarly are switched off here. Pages are shared live with students; the Sentence Check runs only when
// someone asks for it on a sentence; Sentence formulas is a searchable reference; one Settings menu holds what
// the teacher sets and what's the student's own choice.

// The support record kept with the draft (Claudia's research: every sample notes the supports used, so
// supported and unsupported writing are compared fairly, as her Program Overview requires).
type SupportRecord = Record<'predictions' | 'autoFixes' | 'fixesUndone' | 'autoCaps' | 'spellingFixes' | 'sentenceFixes' | 'readAlouds' | 'echoes' | 'dictations', number>;
const EMPTY_RECORD: SupportRecord = { predictions: 0, autoFixes: 0, fixesUndone: 0, autoCaps: 0, spellingFixes: 0, sentenceFixes: 0, readAlouds: 0, echoes: 0, dictations: 0 };
const REC_KEY = 'lm-writer-record';
const readRecord = (): SupportRecord => { try { return { ...EMPTY_RECORD, ...JSON.parse(sessionStorage.getItem(REC_KEY) ?? '{}') }; } catch { return EMPTY_RECORD; } };
// Text spacing, each set on its own (her request 2026-10-28): between letters, between words, between lines.
const LETTER: Record<Spacing, string> = { normal: '0.01em', wide: '0.06em', wider: '0.12em' };
const WORD: Record<Spacing, string> = { normal: '0em', wide: '0.25em', wider: '0.5em' };
const LINE: Record<Spacing, number> = { normal: 0, wide: 12, wider: 26 };
const speechOK = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Dictation uses the browser's speech recognition (Chrome, Edge and Safari have it).
interface Recognizer { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
const Recognition = typeof window === 'undefined' ? undefined : ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Recognizer) | undefined;
const SPOKEN_MARKS: [RegExp, string][] = [[/\s*\b(period|full stop)\b/gi, '.'], [/\s*\bquestion mark\b/gi, '?'], [/\s*\bexclamation (point|mark)\b/gi, '!'], [/\s*\bcomma\b/gi, ','], [/\s*\bnew (line|paragraph)\b\s*/gi, '\n']];

// Large symbols are the size of the symbol sentence cards on the board (72px).
const SYMBOL_PX = { small: 20, medium: 36, large: 72 } as const;
const FONT_PX = { small: 22, medium: 24, large: 28 } as const;
// Wider gaps between words as symbols grow, so each word gets a column like a card in a symbol sentence.
const SYMBOL_GAP = { small: '0em', medium: '0.5em', large: '1.7em' } as const;
const ITEMS: CheckItem[] = ['complete', 'capital', 'endMark', 'match', 'time'];
const TAB_NAMES: Record<CheckItem, string> = { complete: 'Complete', capital: 'Capitals', endMark: 'End mark', match: 'Agreement', time: 'Tense' };
const ITEM_HELP: Record<CheckItem, string> = {
  complete: 'A sentence needs a subject (who or what it is about) and a verb (what the subject does or is).',
  capital: 'The first word, names and the word I start with capital letters.',
  endMark: 'A sentence ends with a period, a question mark or an exclamation point.',
  match: 'The verb matches its subject: one (The dog runs.) or more than one (The dogs run.).',
  time: 'The verbs stay in the same tense: past, present or future.',
};

// "Add a verb" drops in a blank with the part's symbol over it (a blank alone when symbols are off). The blank is
// three underscores and an invisible marker naming the part, so the symbol stays with it.
const PLACEHOLDER_MARK = { verb: '\u200b', noun: '\u200c' } as const;
const MARK_CLASS: Record<string, MontessoriWordClass> = { '\u200b': 'verb', '\u200c': 'noun' };
const DICTIONARY_TYPES: [MontessoriWordClass, string][] = [['propernoun', 'Name (proper noun)'], ['noun', 'Noun'], ['verb', 'Verb'], ['adjective', 'Adjective'], ['adverb', 'Adverb'], ['interjection', 'Interjection']];

const WORD_RE = /[A-Za-z']+/g;
const lastWordBefore = (text: string, pos: number) => text.slice(0, pos).match(/([A-Za-z']+)[^A-Za-z']*$/)?.[1];
const wordsAfter = (text: string, pos: number) => (text.slice(pos).match(WORD_RE) ?? []).slice(0, 2);
const startsSentenceAt = (text: string, pos: number) => /(^|[.!?]["'”’)]*\s+|\n\s*)$/.test(text.slice(0, pos)) || text.slice(0, pos).trim() === '';
const capFirst = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

function Check({ ok, warn }: { ok: boolean; warn?: boolean }) {
  return (
    <span className={`lm-check-box${ok ? ' ok' : ''}${warn ? ' warn' : ''}`} aria-hidden="true">
      {ok && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
    </span>
  );
}

type Who = 'teacher' | 'yours' | 'locked';
const WHO_LABEL: Record<Who, string> = { teacher: 'Teacher sets', yours: 'Your choice', locked: 'Set by your teacher' };
function Choice<T extends string>({ label, value, options, onChange, disabled, who }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; disabled: boolean; who?: Who }) {
  return (
    <div className="lm-writer-setting">
      <span className="lm-writer-setting-label">{label}{who && <span className={`lm-who ${who}`}>{WHO_LABEL[who]}</span>}</span>
      <span className="lm-writer-choices" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} disabled={disabled} onClick={() => onChange(v)}>{text}</button>
        ))}
      </span>
    </div>
  );
}

// A window the student can drag anywhere (the Sentence Check), remembering where it was left.
function useDragSpot(key: string, start: { x: number; y: number }) {
  const [pos, setPos] = useState(() => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? start; } catch { return start; } });
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const ox = e.clientX - pos.x, oy = e.clientY - pos.y;
    const move = (ev: PointerEvent) => setPos({ x: Math.max(0, Math.min(window.innerWidth - 120, ev.clientX - ox)), y: Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - oy)) });
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(pos)); } catch { /* not remembered */ } }, [key, pos]);
  return { pos, onPointerDown };
}

interface Fix { id: number; at: number; from: string; to: string; state: 'pending' | 'undone' }

export function Writer({ settings, canChangeSettings, onSettings, onBack, studentName, headerExtras, pages: store, students = [], sharing = false, font, onFont, fontLocked = false }: {
  settings: WriterSettings; canChangeSettings: boolean; onSettings: (s: WriterSettings) => void; onBack?: () => void; studentName?: string; headerExtras?: ReactNode;
  pages: PageStore; students?: { id: string; name: string }[]; sharing?: boolean; font: FontChoice; onFont: (f: FontChoice) => void; fontLocked?: boolean;
}) {
  useSyncExternalStore(store.subscribe, () => store.version);
  useSyncExternalStore(subscribeMyWords, myWordsVersion);
  const canManagePages = canChangeSettings;
  const [pageId, setPageId] = useState(() => store.pages[0]?.id ?? '');
  const page = store.pages.find((p) => p.id === pageId) ?? store.pages[0];
  const pid = page?.id ?? '';
  useEffect(() => { if (page && page.id !== pageId) setPageId(page.id); }, [page, pageId]);
  const readOnly = !page || (!canManagePages && accessFor(page, store.me.id) === 'view');

  const [textState, setTextState] = useState(() => ({ pid, text: pid ? store.text(pid).toString() : '' }));
  const text = textState.pid === pid ? textState.text : pid ? store.text(pid).toString() : '';
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [, setReady] = useState(wordsReady());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formulasOpen, setFormulasOpen] = useState(false);
  const [fixes, setFixes] = useState<Fix[]>([]);
  const fixId = useRef(0);
  const [popup, setPopup] = useState<{ start: number; word: string; options: string[]; left: number; top: number; adding: boolean } | null>(null);
  const [issuePop, setIssuePop] = useState<{ s: SentenceSpan; issue: NonNullable<SentenceIssue>; left: number; top: number } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<{ start: number; end: number } | null>(null);
  const [mine, setMineState] = useState<StudentTools>(readStudentTools);
  const setMine = (patch: StudentTools) => setMineState((m) => { const next = { ...m, ...patch }; saveStudentTools(next); return next; });
  const [record, setRecord] = useState<SupportRecord>(readRecord);
  const bump = (k: keyof SupportRecord, by = 1) => setRecord((r) => ({ ...r, [k]: r[k] + by }));
  useEffect(() => { try { sessionStorage.setItem(REC_KEY, JSON.stringify(record)); } catch { /* not saved */ } }, [record]);
  const [book, setBook] = useState<BookEntry[]>(readBook);
  const [ideas, setIdeas] = useState<FormulaIdea[]>(readIdeas);
  const [pageMenu, setPageMenu] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<{ start: number; end: number } | null>(null);
  const caretMark = useRef<HTMLSpanElement>(null);
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const [newWord, setNewWord] = useState({ word: '', cls: 'propernoun' as MontessoriWordClass });
  // "Write with this formula": her formula card above the page, each slot lighting up as the sentence fills it.
  const [frame, setFrame] = useState<{ slots: string[]; sentence: string; code: string; card?: string } | null>(null);
  const checkWin = useDragSpot('lm-writer-checkpos', { x: Math.max(16, (typeof window === 'undefined' ? 1200 : window.innerWidth) - 400), y: 140 });

  // The page's text lives in the shared document; other people's typing moves this person's cursor along.
  useEffect(() => {
    if (!pid) return;
    const yt = store.text(pid);
    setTextState({ pid, text: yt.toString() });
    const observe = (ev: Y.YTextEvent) => {
      const ta = taRef.current;
      if (ev.transaction.origin !== LOCAL && ta && document.activeElement === ta) {
        let s = ta.selectionStart, e = ta.selectionEnd, i = 0;
        for (const d of ev.delta) {
          if (d.retain) i += d.retain;
          else if (d.insert) { const n = typeof d.insert === 'string' ? d.insert.length : 1; if (i < s) s += n; if (i < e) e += n; i += n; }
          else if (d.delete) { const n = d.delete; if (i < s) s -= Math.min(n, s - i); if (i < e) e -= Math.min(n, e - i); }
        }
        pendingCaret.current = { start: s, end: e };
      }
      setTextState({ pid, text: yt.toString() });
    };
    yt.observe(observe);
    return () => yt.unobserve(observe);
  }, [store, pid]);
  const setText = (v: string) => { if (pid && !readOnly) store.setText(pid, v); };

  // Where everyone else is typing on this page, and where I am, for their screens.
  const [, tick] = useState(0);
  useEffect(() => { if (!sharing) return; const t = window.setInterval(() => tick((n) => n + 1), 4000); return () => window.clearInterval(t); }, [sharing]);
  useEffect(() => {
    if (!sharing || !pid || !focused) return;
    const t = window.setTimeout(() => store.sendCaret(pid, caret), 150);
    const keep = window.setInterval(() => store.sendCaret(pid, taRef.current?.selectionStart ?? caret), 4000);
    return () => { window.clearTimeout(t); window.clearInterval(keep); };
  }, [sharing, pid, caret, focused, text, store]);
  const remoteCarets = sharing && pid ? store.caretsOn(pid) : [];

  // What's actually on: teacher-set tools follow the teacher ('choice' lets the student decide); look-and-feel
  // settings are the student's own, starting from the teacher's.
  const readAloudOn = speechOK && (settings.readAloud === 'on' || (settings.readAloud === 'choice' && !!mine.readAloud));
  const echo = !speechOK ? 'off' : settings.typingEcho === 'choice' ? (mine.typingEcho ?? 'off') : settings.typingEcho;
  const dictationOn = !!Recognition && (settings.dictation === 'on' || (settings.dictation === 'choice' && !!mine.dictation));
  const symbolsOn = settings.symbols === 'on' || (settings.symbols === 'choice' && (mine.symbols ?? true));
  const checkStyle = settings.checkStyle === 'choice' ? (mine.checkStyle ?? 'auto') : settings.checkStyle;
  const letterSp = mine.letterSpacing ?? mine.spacing ?? settings.letterSpacing;
  const wordSp = mine.wordSpacing ?? mine.spacing ?? settings.wordSpacing;
  const lineSp = mine.lineSpacing ?? mine.spacing ?? settings.lineSpacing;
  const lineFocusOn = mine.lineFocus ?? settings.lineFocus;
  const theme = mine.theme ?? settings.theme;
  const focusModeOn = mine.focusMode ?? settings.focusMode;
  const rate = mine.rate ?? 0.9;

  // Read aloud, with the word being read highlighted.
  const speak = (from: number, to: number, kind: 'read' | 'echo') => {
    if (!speechOK) return;
    const chunk = text.slice(from, to);
    if (!chunk.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(chunk);
    u.rate = rate;
    if (kind === 'read') {
      u.onboundary = (e) => {
        if (e.name && e.name !== 'word') return;
        const m = chunk.slice(e.charIndex).match(/^[A-Za-z']+/);
        if (m) setSpeaking({ start: from + e.charIndex, end: from + e.charIndex + m[0].length });
      };
      u.onend = () => setSpeaking(null);
      u.onerror = () => setSpeaking(null);
      bump('readAlouds');
    } else bump('echoes');
    window.speechSynthesis.speak(u);
  };
  const speakNow = (t: string) => {
    if (!speechOK || !t.trim()) return;
    const u = new SpeechSynthesisUtterance(t);
    u.rate = rate;
    window.speechSynthesis.speak(u);
    bump('echoes');
  };
  useEffect(() => () => { if (speechOK) window.speechSynthesis.cancel(); }, []);

  useEffect(() => { void loadWords().then(() => setReady(true)); }, []);
  // Writing add-ons blocked: the page also hides anything they inject while Write mode is open.
  useEffect(() => {
    document.body.classList.toggle('lm-block-addons', settings.blockAddons);
    return () => document.body.classList.remove('lm-block-addons');
  }, [settings.blockAddons]);

  // Keep the text area as tall as its text, and put the cursor back after a word was changed for the student.
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(ta.scrollHeight, 320)}px`;
    if (pendingCaret.current) { ta.setSelectionRange(pendingCaret.current.start, pendingCaret.current.end); pendingCaret.current = null; }
  });

  const sym = symbolsOn ? SYMBOL_PX[settings.symbolSize] : 0;
  const fontPx = symbolsOn ? FONT_PX[settings.symbolSize] : 22;
  const lineHeight = (sym ? Math.round(fontPx * 1.2 + 2 * (sym + 8)) : Math.round(fontPx * 1.7)) + LINE[lineSp];
  const pageStyle = {
    '--wr-padx': `${Math.max(28, sym / 2 + 6)}px`, '--wr-font': `${fontPx}px`, '--wr-line': `${lineHeight}px`, '--wr-sym': `${sym}px`, '--wr-ls': LETTER[letterSp],
    '--wr-ws': `calc(${WORD[wordSp]} + ${sym ? SYMBOL_GAP[settings.symbolSize] : '0em'})`,
  } as CSSProperties;

  // Line focus: find the line the cursor is on, from a marker in the mirror.
  useLayoutEffect(() => {
    if (!lineFocusOn) { if (focusLine !== null) setFocusLine(null); return; }
    const mk = caretMark.current, pg = pageRef.current;
    if (!mk || !pg) return;
    const pad = 20;
    const y = mk.getBoundingClientRect().top + mk.getBoundingClientRect().height / 2 - pg.getBoundingClientRect().top;
    const line = Math.max(0, Math.floor((y - pad) / lineHeight));
    if (line !== focusLine) setFocusLine(line);
  });

  // Sentences and each word's job (from the word and its place in the sentence).
  const sentences = useMemo(() => splitSentences(text), [text]);
  const tagged = useMemo(() => sentences.flatMap((s) => tagForCheck(s.text)), [sentences]);
  // Incomplete sentences (fragments) get a red wavy line and run-ons a blue one, once the sentence has its end
  // mark and the student has moved on from it (her request 2026-10-28).
  const issues = useMemo(() => (settings.grammar === 'off' ? [] : sentences.filter((s) => s.ended).flatMap((s) => {
    const issue = sentenceIssue(s);
    return issue ? [{ s, issue }] : [];
  })), [sentences, settings.grammar]);
  // Not while the student is still writing that sentence.
  const [lastEdit, setLastEdit] = useState(-1);
  const shownIssues = issues.filter(({ s }) => !(focused && caret >= s.start && caret <= s.end && lastEdit >= s.start && lastEdit <= s.end + 1));
  const labels = CHECK_LABELS;

  // ---------- Sentence Check: only when someone asks, on the sentence(s) they choose ----------
  const [checkRange, setCheckRange] = useState<{ a: number; b: number } | null>(null);
  const [checkIdx, setCheckIdx] = useState(0);
  const [checkTab, setCheckTab] = useState<CheckItem | 'formula'>('complete');
  const [ticks, setTicks] = useState<Set<string>>(new Set());
  // Keep the checked range on its sentences while text is added or removed before or inside it.
  const prevText = useRef(text);
  useEffect(() => {
    const old = prevText.current;
    prevText.current = text;
    if (old === text) return;
    let p = 0;
    while (p < old.length && p < text.length && old[p] === text[p]) p++;
    const d = text.length - old.length;
    setCheckRange((r) => (r ? { a: p < r.a ? Math.max(p, r.a + d) : r.a, b: p <= r.b ? Math.max(r.a, r.b + d) : r.b } : r));
  }, [text]);
  useEffect(() => { setCheckRange(null); setFixes([]); setPopup(null); }, [pid]);
  const checkedSentences = checkRange ? sentences.filter((s) => s.end > checkRange.a && s.start < Math.max(checkRange.b, checkRange.a + 1)) : [];
  const ci = Math.min(checkIdx, Math.max(0, checkedSentences.length - 1));
  const cs = checkedSentences[ci];
  const cr = cs ? checkSentence(cs) : null;
  const cp: Record<CheckItem, boolean> | null = cr ? { complete: !cr.complete, capital: !cr.capital, endMark: !cr.endMark, match: !cr.match.ok, time: !cr.time } : null;
  const tickKey = (it: CheckItem) => `${cs?.start ?? 0}:${it}`;
  const startCheck = () => {
    const ta = taRef.current;
    let a = ta?.selectionStart ?? caret, b = ta?.selectionEnd ?? caret;
    if (a === b) { const s = sentences.find((x) => a >= x.start && a <= x.end + 1) ?? sentences.filter((x) => x.end <= a).pop(); if (!s) return; a = s.start; b = s.end; }
    setCheckRange({ a, b });
    setCheckIdx(0);
    setCheckTab('complete');
    setTicks(new Set());
  };
  const status = (it: CheckItem): 'ok' | 'todo' | 'open' => {
    if (!cp) return 'open';
    if (checkStyle === 'self' && !ticks.has(tickKey(it))) return 'open';
    return cp[it] ? 'todo' : 'ok';
  };
  // Open spots show only for the sentence being checked and the tab being looked at.
  const gaps = new Map<number, MontessoriWordClass | null>();
  const wordSpots = new Set<number>();
  if (cs && cr && cp && checkTab !== 'formula' && status(checkTab) === 'todo') {
    const ws = [...cs.text.matchAll(WORD_RE)];
    const at = (i: number) => cs.start + (ws[i]?.index ?? 0);
    if (checkTab === 'complete' && cr.missing) {
      const target = ws[cr.insertAt];
      gaps.set(target ? cs.start + (target.index ?? 0) : cs.start + cs.text.replace(/[.!?"'”’)]+$/, '').length, cr.missing === 'who' ? 'noun' : 'verb');
    }
    if (checkTab === 'endMark') gaps.set(cs.end, null);
    if (checkTab === 'capital') {
      if (!/^[^A-Za-z]*[A-Z]/.test(cs.text)) wordSpots.add(at(0));
      ws.forEach((w, i) => { if (w[0] === 'i') wordSpots.add(at(i)); });
    }
    if (checkTab === 'match' && cr.match.index !== undefined) wordSpots.add(at(cr.match.index));
    if (checkTab === 'time') cr.words.forEach((w, i) => { if (w.wordClass === 'verb') wordSpots.add(at(i)); });
  }

  // The word being typed right now (cursor at its end), which isn't marked until it's finished.
  const typingWordStart = (() => {
    if (!focused) return -1;
    const m = text.slice(0, caret).match(/[A-Za-z']+$/);
    return m && !/[A-Za-z']/.test(text[caret] ?? '') ? caret - m[0].length : -1;
  })();
  const misspelled = (word: string, start: number) => {
    if (settings.spell === 'off' || !wordsReady() || start === typingWordStart) return false;
    if (isWord(word)) return false;
    if (/^[A-Z]/.test(word) && !startsSentenceAt(text, start)) return false; // a name
    if (settings.spell === 'common') return missesCommonWord(word, lastWordBefore(text, start), wordsAfter(text, start + word.length));
    return true;
  };

  // The mirror under the text: the same words, with symbols, markings, open spots and other people's cursors.
  // Everything added is zero-width, so the mirror's words stay exactly under the text area's.
  const mirror: ReactNode[] = [];
  {
    let wi = 0;
    const re = /_{3}[\u200b\u200c]|[A-Za-z']+|[^A-Za-z'_]+|_+/g;
    let m: RegExpExecArray | null;
    let markPlaced = false;
    const marks = [...remoteCarets].sort((a, b) => a.index - b.index);
    // Everything inside a sentence with a problem goes into one span carrying its wavy line.
    const ranges = shownIssues.map(({ s, issue }) => ({ start: s.start, end: s.end, kind: issue.kind }));
    let group: { end: number; nodes: ReactNode[] } | null = null;
    const emit = (at: number, ...nodes: ReactNode[]) => {
      if (group && at >= group.end) group = null;
      if (!group) {
        const r = ranges.find((x) => at >= x.start && at < x.end);
        if (r) { group = { end: r.end, nodes: [] }; mirror.push(<span key={`issue${r.start}`} className={`lm-writer-issue ${r.kind}`}>{group.nodes}</span>); }
      }
      (group ? group.nodes : mirror).push(...nodes);
    };
    const cuts = ranges.flatMap((r) => [r.start, r.end]);
    const symRow = (classes: MontessoriWordClass[]) => (
      <span className={`lm-writer-sym${classes.length > 1 ? ' two' : ''}`}>
        {classes.map((c, k) => <img key={k} src={MONTESSORI_WORD_CLASS_INFO[c].imageUrl} alt="" draggable={false} />)}
      </span>
    );
    const gapAt = (i: number) => (gaps.has(i) ? (
      <span key={`gap${i}`} className={`lm-writer-gap ${gaps.get(i) ? 'part' : 'end'}`}><i />{sym > 0 && gaps.get(i) && symRow([gaps.get(i)!])}</span>
    ) : null);
    // A piece of text, split wherever my cursor, someone else's cursor or an open spot falls inside it.
    const piece = (str: string, start: number): ReactNode[] => {
      const out: ReactNode[] = [];
      let from = 0;
      for (let k = 0; k < str.length; k++) {
        const i = start + k;
        const here: ReactNode[] = [];
        if (k > 0 && gaps.has(i)) here.push(gapAt(i));
        if (!markPlaced && caret === i) { markPlaced = true; here.push(<span key="caret-mark" ref={caretMark} className="lm-writer-caret-mark" />); }
        for (const c of marks) if (c.index === i) here.push(<span key={`rc${c.from}`} className="lm-writer-rcaret" style={{ '--c': c.color } as CSSProperties}><i /><b>{c.name}</b></span>);
        if (here.length) { if (k > from) out.push(str.slice(from, k)); out.push(...here); from = k; }
      }
      if (from < str.length) out.push(str.slice(from));
      return out;
    };
    while ((m = re.exec(text))) {
      const tok = m[0];
      const start = m.index;
      const g = gapAt(start);
      if (g) emit(start, g);
      if (/^_{3}[\u200b\u200c]$/.test(tok)) {
        emit(start, <span key={start} className="w blank" data-start={start}>{piece(tok, start)}{sym > 0 && symRow([MARK_CLASS[tok[3]]])}</span>);
        continue;
      }
      if (!/^[A-Za-z']/.test(tok)) {
        // Split at a problem sentence's start or end, so the wavy line covers exactly the sentence.
        let from = 0;
        for (const c of [...cuts.filter((x) => x > start && x < start + tok.length), start + tok.length].sort((a, b) => a - b)) {
          emit(start + from, ...piece(tok.slice(from, c - start), start + from));
          from = c - start;
        }
        continue;
      }
      const tw: TaggedWord | undefined = tagged[wi++];
      // A word's symbol shows once the word is finished: a space or mark typed after it.
      const end = start + tok.length;
      const finished = end < text.length && !(focused && caret === end);
      const classes = tw ? (tw.parts ?? [tw.wordClass]) : [];
      const bad = misspelled(tok, start);
      // No symbol on a word that's misspelled, or a real word that doesn't fit its spot ("I will cat the
      // ball"): the symbol would teach the wrong job. The second gets a dotted line when spell check is on.
      const wrongWord = !bad && finished && wordsReady() && isWord(tok) && suggestFor(tok, lastWordBefore(text, start), 1, wordsAfter(text, end)).length > 0;
      const noSymbol = bad || tw?.unsure || wrongWord || (wordsReady() && !isWord(tok) && !/^[A-Z]/.test(tok));
      emit(start,
        <span key={start} className={`w${bad ? ' bad' : ''}${wrongWord && settings.spell !== 'off' ? ' unsure' : ''}${wordSpots.has(start) ? ' spot' : ''}${speaking && start === speaking.start ? ' speaking' : ''}`} data-start={start}>
          {piece(tok, start)}
          {sym > 0 && finished && !noSymbol && classes.length > 0 && symRow(classes)}
        </span>,
      );
    }
    const endGap = gapAt(text.length);
    if (endGap) mirror.push(endGap);
    if (!markPlaced) mirror.push(<span key="caret-mark" ref={caretMark} className="lm-writer-caret-mark" />);
    for (const c of marks) if (c.index >= text.length) mirror.push(<span key={`rc${c.from}`} className="lm-writer-rcaret" style={{ '--c': c.color } as CSSProperties}><i /><b>{c.name}</b></span>);
    mirror.push('\u200b');
  }

  // Replace text and put the cursor (or a selection) where it belongs.
  const replaceRange = (start: number, end: number, insert: string, select?: [number, number]) => {
    setText(text.slice(0, start) + insert + text.slice(end));
    pendingCaret.current = select ? { start: select[0], end: select[1] } : { start: start + insert.length, end: start + insert.length };
    taRef.current?.focus();
  };

  // A fixed word, found again near where it was fixed (other typing may have moved it).
  const findWord = (word: string, near: number) => {
    let best = -1;
    for (const m of text.matchAll(new RegExp(`(?<![A-Za-z'])${word.replace(/[^A-Za-z']/g, '')}(?![A-Za-z'])`, 'g'))) {
      if (best < 0 || Math.abs((m.index ?? 0) - near) < Math.abs(best - near)) best = m.index ?? 0;
    }
    return best;
  };
  const undoFix = (f: Fix) => {
    const at = findWord(f.to, f.at);
    if (at >= 0) replaceRange(at, at + f.to.length, f.from, [at + f.from.length, at + f.from.length]);
    setFixes((list) => list.map((x) => (x.id === f.id ? { ...x, state: 'undone', at: at >= 0 ? at : x.at } : x)));
    bump('fixesUndone');
  };
  const redoFix = (f: Fix) => {
    const at = findWord(f.from, f.at);
    if (at >= 0) replaceRange(at, at + f.from.length, f.to, [at + f.to.length, at + f.to.length]);
    setFixes((list) => list.map((x) => (x.id === f.id ? { ...x, state: 'pending', at: at >= 0 ? at : x.at } : x)));
    bump('fixesUndone', -1);
  };
  const closeFix = (f: Fix) => setFixes((list) => list.filter((x) => x.id !== f.id));

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let v = e.target.value;
    let pos = e.target.selectionStart;
    const typed = v.length === text.length + 1 ? v[pos - 1] : '';
    // A word was just finished (space or punctuation after it): fix it if the teacher allows (the student then
    // keeps or undoes the fix), then capitals.
    if (typed && /[\s.,!?;:]/.test(typed)) {
      const before = v.slice(0, pos - 1);
      const m = before.match(/([A-Za-z']+)$/);
      if (m) {
        const ws = pos - 1 - m[1].length;
        const word = m[1];
        let next = word;
        if (settings.predict === 'auto') {
          const fix = confidentFix(word, lastWordBefore(v, ws), wordsAfter(v, pos));
          if (fix && fix !== word) { next = fix; setFixes((list) => [...list.slice(-2), { id: ++fixId.current, at: ws, from: word, to: fix, state: 'pending' }]); bump('autoFixes'); }
        }
        if (settings.autoCap) {
          const was = next;
          if (/^i(['’].*)?$/.test(next)) next = 'I' + next.slice(1);
          if (startsSentenceAt(v, ws)) next = capFirst(next);
          if (next !== was) bump('autoCaps');
        }
        if (echo === 'words') speakNow(next);
        if (next !== word) { v = v.slice(0, ws) + next + v.slice(ws + word.length); pos += next.length - word.length; pendingCaret.current = { start: pos, end: pos }; }
      }
    }
    // Typing echo for a whole sentence once its end mark goes in.
    if (typed && /[.!?]/.test(typed) && echo === 'sentences') {
      const sentence = v.slice(0, pos).match(/[^.!?\n]*[.!?]$/)?.[0];
      if (sentence) speakNow(sentence);
    }
    setPopup(null);
    setIssuePop(null);
    setText(v);
    setCaret(pos);
    setLastEdit(pos);
  };

  // Dictation: spoken words go in at the cursor ("period", "comma", "question mark" and "new line" become marks).
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const recRef = useRef<Recognizer | null>(null);
  const insertSpoken = useRef<(said: string) => void>(() => {});
  insertSpoken.current = (said: string) => {
    let t = said.trim();
    if (!t) return;
    for (const [re, mark] of SPOKEN_MARKS) t = t.replace(re, mark);
    const at = taRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, at);
    if (settings.autoCap && startsSentenceAt(text, at)) t = capFirst(t);
    t = t.replace(/([.!?]\s+)([a-z])/g, (_, a: string, b: string) => a + (settings.autoCap ? b.toUpperCase() : b)).replace(/\bi\b/g, settings.autoCap ? 'I' : 'i');
    const lead = before && !/\s$/.test(before) && !/^[.,!?\n]/.test(t) ? ' ' : '';
    replaceRange(at, at, lead + t);
    bump('dictations');
  };
  const toggleDictation = () => {
    if (listening) { recRef.current?.stop(); return; }
    if (!Recognition) return;
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) insertSpoken.current(r[0].transcript);
        else interim += r[0].transcript;
      }
      setHeard(interim);
    };
    rec.onend = () => { setListening(false); setHeard(''); recRef.current = null; };
    rec.onerror = () => { setListening(false); setHeard(''); };
    recRef.current = rec;
    rec.start();
    setListening(true);
    taRef.current?.focus();
  };
  useEffect(() => () => recRef.current?.stop(), []);
  useEffect(() => { if (!dictationOn) recRef.current?.stop(); }, [dictationOn]);

  // Suggestions above the page (Predictive text: Suggest): finish the word being typed, or fix the one before.
  const suggestions = (() => {
    if (settings.predict !== 'suggest' || !wordsReady() || readOnly) return null;
    const m = text.slice(0, caret).match(/([A-Za-z']+)$/);
    if (m && !/[A-Za-z']/.test(text[caret] ?? '')) {
      const start = caret - m[1].length;
      const prev = lastWordBefore(text, start);
      const fixesFor = isWord(m[1]) ? [] : suggestFor(m[1], prev, 2);
      const words = [...new Set([...fixesFor, ...completionsFor(m[1], prev, 3)])].slice(0, 4);
      return words.length ? { start, end: caret, words } : null;
    }
    const prevM = text.slice(0, caret).match(/([A-Za-z']+)[\s,;:]+$/);
    if (prevM) {
      const end = caret - (prevM[0].length - prevM[1].length);
      const start = end - prevM[1].length;
      const words = suggestFor(prevM[1], lastWordBefore(text, start), 3, wordsAfter(text, end));
      return words.length ? { start, end, words } : null;
    }
    return null;
  })();
  const acceptSuggestion = (w: string) => {
    if (!suggestions) return;
    const add = suggestions.end === caret ? ' ' : '';
    replaceRange(suggestions.start, suggestions.end, w + add);
    bump('predictions');
  };

  // Tapping a marked word: what it might be (Mark and suggest), and "Add to my dictionary" for a word that's
  // right but unknown, like a name.
  const openSpellPopup = () => {
    setIssuePop(null);
    if (readOnly) return;
    const ta = taRef.current;
    if (!ta) return;
    const at = ta.selectionStart;
    for (const m of text.matchAll(WORD_RE)) {
      const i = m.index ?? 0;
      if (at >= i && at <= i + m[0].length) {
        if (!misspelled(m[0], i) || i === typingWordStart) { setPopup(null); openIssuePop(at); return; }
        const el = mirrorRef.current?.querySelector(`[data-start="${i}"]`);
        const pg = pageRef.current?.getBoundingClientRect();
        const r = el?.getBoundingClientRect();
        if (!r || !pg) return;
        const options = settings.spellHelp === 'suggest' ? suggestFor(m[0], lastWordBefore(text, i), 4, wordsAfter(text, i + m[0].length)) : [];
        setPopup({ start: i, word: m[0], options, left: r.left - pg.left, top: r.bottom - pg.top + 4, adding: false });
        return;
      }
    }
    setPopup(null);
  };

  // Tapping a sentence with a wavy line says what's wrong, with a way to fix it.
  const openIssuePop = (at: number) => {
    const hit = shownIssues.find(({ s }) => at >= s.start && at <= s.end);
    if (!hit) return;
    const el = mirrorRef.current?.querySelector(`[data-start="${hit.s.start}"]`);
    const pg = pageRef.current?.getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    if (!r || !pg) return;
    setIssuePop({ ...hit, left: r.left - pg.left, top: r.bottom - pg.top + 4 });
  };
  // A run-on split in two: end punctuation where the second sentence starts, and a capital letter on it.
  const splitRunOn = (s: SentenceSpan, at: number) => {
    const abs = s.start + at;
    let cut = abs;
    while (cut > s.start && /[\s,]/.test(text[cut - 1])) cut--;
    const rest = text.slice(abs);
    setText(`${text.slice(0, cut)}. ${rest.charAt(0).toUpperCase()}${rest.slice(1)}`);
    pendingCaret.current = { start: cut + 2, end: cut + 2 };
    taRef.current?.focus();
    setIssuePop(null);
    bump('sentenceFixes');
  };

  // New formulas: a sentence that passes all five checks but isn't one of her formulas yet is collected as a
  // formula idea (and sent to the teacher on a shared board); the student can add it to their formula book.
  const logged = useRef(new Set<string>());
  useEffect(() => {
    for (const s of sentences) {
      if (!s.ended || logged.current.has(s.text)) continue;
      const r = checkSentence(s);
      if (!r.formula || r.exact || !r.complete || !r.capital || !r.match.ok || !r.time) continue;
      logged.current.add(s.text);
      setIdeas(addIdea(r.code, s.text, studentName ?? '', r.slots));
      if (sharing && !canChangeSettings) store.send?.({ t: 'formula', from: store.me.id, name: studentName ?? '', code: r.code, sentence: s.text, slots: r.slots });
    }
  }, [sentences, sharing, canChangeSettings, studentName, store]);

  const syncCaret = () => { const ta = taRef.current; if (ta) setCaret(ta.selectionStart); };
  const wordCount = (text.match(WORD_RE) ?? []).length;
  const blockAttrs = settings.blockAddons
    ? { 'data-gramm': 'false', 'data-gramm_editor': 'false', 'data-enable-grammarly': 'false', 'data-lt-active': 'false', 'data-ms-editor': 'false' }
    : {};

  const update = (patch: Partial<WriterSettings>) => onSettings({ ...settings, ...patch });
  // Look-and-feel settings are each person's own; the teacher's choice is also where students start.
  const setLook = (patch: Partial<Pick<StudentTools, 'letterSpacing' | 'wordSpacing' | 'lineSpacing' | 'lineFocus' | 'theme' | 'focusMode'>>) => {
    setMine({ ...patch, spacing: undefined });
    if (canChangeSettings) update(patch as Partial<WriterSettings>);
  };
  // A draft is "supported" when tools that shape what the student writes were on or were used.
  const supportsOn = [
    settings.spell !== 'off' && 'spell check', settings.predict !== 'off' && 'predictive text', settings.autoCap && 'auto-capitals',
    settings.grammar !== 'off' && 'Sentence Check', symbolsOn && 'grammar symbols', readAloudOn && 'read aloud', echo !== 'off' && 'typing echo',
    (dictationOn || record.dictations > 0) && 'dictation',
  ].filter(Boolean) as string[];
  const used = Object.values(record).some((n) => n > 0);
  const supported = supportsOn.length > 0 || used;
  const caretSentenceSpan = sentences.find((sp) => caret >= sp.start && caret <= sp.end + 1);
  const selectSentence = (s: SentenceSpan) => { pendingCaret.current = { start: s.start, end: s.end }; taRef.current?.focus(); setCaret(s.start); tick((n) => n + 1); };

  const insertMissing = (s: SentenceSpan, r: CheckResult) => {
    const ws = [...s.text.matchAll(WORD_RE)];
    const target = ws[r.insertAt];
    const at = target ? s.start + (target.index ?? 0) : s.start + s.text.replace(/[.!?"'”’)]+$/, '').length;
    const blank = '___' + (r.missing === 'who' ? PLACEHOLDER_MARK.noun : PLACEHOLDER_MARK.verb);
    const insert = target ? `${blank} ` : ` ${blank}`;
    const startSel = target ? at : at + 1;
    replaceRange(at, at, insert, [startSel, startSel + blank.length]);
    bump('sentenceFixes');
  };
  const fixButton = (it: CheckItem, s: SentenceSpan, r: CheckResult) => {
    const ws = [...s.text.matchAll(WORD_RE)];
    if (it === 'complete' && r.missing) return <button type="button" className="lm-tool-btn" onClick={() => insertMissing(s, r)}>Add {r.missing === 'who' ? labels.who : labels.action}</button>;
    if (it === 'capital') return <button type="button" className="lm-tool-btn" onClick={() => {
      const i = s.text.search(/[a-z]/);
      let fixed = s.text.replace(/\bi\b/g, 'I');
      if (i >= 0 && !/[A-Z]/.test(s.text.slice(0, i))) fixed = fixed.slice(0, i) + fixed[i].toUpperCase() + fixed.slice(i + 1);
      replaceRange(s.start, s.end, fixed, [s.end, s.end]);
      bump('sentenceFixes');
    }}>Fix capitals</button>;
    if (it === 'endMark') return <button type="button" className="lm-tool-btn" onClick={() => { replaceRange(s.end, s.end, '.'); bump('sentenceFixes'); }}>Add end punctuation</button>;
    if (it === 'match' && r.match.from && r.match.to) return <button type="button" className="lm-tool-btn" onClick={() => {
      const w = ws[r.match.index!];
      const at = s.start + (w.index ?? 0);
      replaceRange(at, at + r.match.from!.length, r.match.to!, [s.end, s.end]);
      bump('sentenceFixes');
    }}>Change {r.match.from} to {r.match.to}</button>;
    return null;
  };

  const pageAccessLabel = (a: PageAccess) => (a === 'edit' ? 'can write' : a === 'view' ? 'can view' : 'hidden');
  const accessToggle = (pageIdArg: string, who: string, a: PageAccess, name: string) => (
    <span className="lm-share-toggle" role="radiogroup" aria-label={`${name}: ${pageAccessLabel(a)}`}>
      <button type="button" role="radio" aria-checked={a === 'edit'} className={a === 'edit' ? 'on' : ''} onClick={() => store.setAccess(pageIdArg, who, 'edit')} title="Can write on this page" aria-label="Can write"><Icon name="pencil" /></button>
      <button type="button" role="radio" aria-checked={a === 'view'} className={a === 'view' ? 'on' : ''} onClick={() => store.setAccess(pageIdArg, who, 'view')} title="Can only read this page" aria-label="View only"><Icon name="eye" /></button>
      <button type="button" role="radio" aria-checked={a === 'none'} className={a === 'none' ? 'on' : ''} onClick={() => store.setAccess(pageIdArg, who, 'none')} title="Can't see this page" aria-label="Hidden"><span aria-hidden="true" style={{ fontWeight: 900 }}>✕</span></button>
    </span>
  );
  // A tool the teacher can leave to the student: the teacher picks Off, On or Student choice; a student sees
  // the teacher's pick (locked) or, when it's their choice, picks Off or On.
  const toolRow = <T extends string, S extends string>(label: string, teacherValue: T, teacherOptions: [T, string][], onTeacher: (v: T) => void, studentValue: S, studentOptions: [S, string][], onStudent: (v: S) => void) => (
    canChangeSettings ? (
      <>
        <Choice label={label} value={teacherValue} options={teacherOptions} onChange={onTeacher} disabled={false} who="teacher" />
        {teacherValue === 'choice' && <Choice label={`${label}: on this screen`} value={studentValue} options={studentOptions} onChange={onStudent} disabled={false} who="yours" />}
      </>
    ) : teacherValue === 'choice'
      ? <Choice label={label} value={studentValue} options={studentOptions} onChange={onStudent} disabled={false} who="yours" />
      : <Choice label={label} value={teacherValue} options={teacherOptions.filter(([v]) => v !== 'choice')} onChange={onTeacher} disabled who="locked" />
  );
  const today = new Date().toLocaleDateString();
  const t: Who = canChangeSettings ? 'teacher' : 'locked';

  return (
    <div className={`lm-writer theme-${theme}${focusModeOn ? ' focus-mode' : ''}`}>
      <header className="lm-writer-bar">
        {onBack && <button type="button" className="btn btn-sm" onClick={onBack}>← Whiteboard</button>}
        <span className="lm-sidebar-title">Write{studentName ? `: ${studentName}` : ''}</span>
        <span className="lm-writer-count">{wordCount} {wordCount === 1 ? 'word' : 'words'} · {sentences.length} {sentences.length === 1 ? 'sentence' : 'sentences'}</span>
        <span className={`lm-writer-support ${supported ? 'on' : ''}`} title={supported ? `Supported writing: ${supportsOn.join(', ') || 'supports used'}` : 'No writing supports on'}>
          {supported ? 'Supported writing' : 'Unsupported writing'}
        </span>
        <span style={{ flex: 1 }} />
        {readAloudOn && (
          <span className="lm-writer-read" role="group" aria-label="Read aloud">
            {speaking ? (
              <button type="button" className="btn btn-sm" onClick={() => { window.speechSynthesis.cancel(); setSpeaking(null); }}>Stop</button>
            ) : (
              <>
                <button type="button" className="btn btn-sm" disabled={!caretSentenceSpan} onClick={() => caretSentenceSpan && speak(caretSentenceSpan.start, caretSentenceSpan.end, 'read')}>Read sentence</button>
                <button type="button" className="btn btn-sm" disabled={!text.trim()} onClick={() => speak(0, text.length, 'read')}>Read all</button>
              </>
            )}
          </span>
        )}
        {dictationOn && !readOnly && (
          <button type="button" className={`btn btn-sm${listening ? ' btn-primary' : ''}`} onClick={toggleDictation} aria-pressed={listening}>{listening ? 'Stop dictating' : 'Dictate'}</button>
        )}
        {settings.grammar !== 'off' && (
          <button type="button" className={`btn btn-sm${checkRange ? ' btn-primary' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={startCheck} disabled={!sentences.length}
            title="Select a sentence (or put the cursor in one), then check it">Check sentence</button>
        )}
        <button type="button" className={`btn btn-sm${formulasOpen ? ' btn-primary' : ''}`} onClick={() => setFormulasOpen((o) => !o)}>Sentence formulas</button>
        <button type="button" className="btn btn-sm" onClick={() => window.print()}>Print</button>
        {headerExtras}
        <button type="button" className={`btn btn-sm${settingsOpen ? ' btn-primary' : ''}`} onClick={() => setSettingsOpen((o) => !o)}>Settings</button>
      </header>

      <div className="lm-writer-body">
        <main className="lm-writer-main">
          <div className="lm-writer-tabs" role="tablist" aria-label="Pages">
            {store.pages.map((p) => {
              const people = sharing ? store.peopleOn(p.id) : [];
              const mineAccess = canManagePages ? 'edit' : accessFor(p, store.me.id);
              return (
                <span key={p.id} className={`lm-writer-tab${p.id === pid ? ' on' : ''}`}>
                  <button type="button" role="tab" aria-selected={p.id === pid} onClick={() => { setPageId(p.id); setPageMenu(null); }}>
                    {p.title}
                    {mineAccess === 'view' && <Icon name="eye" size={14} />}
                    {people.map((c) => <span key={c.from} className="lm-writer-tab-dot" style={{ background: c.color }} title={c.name} />)}
                  </button>
                  {canManagePages && (
                    <button type="button" className="lm-writer-tab-menu" onClick={() => setPageMenu((m) => (m === p.id ? null : p.id))} aria-label={`${p.title} options`} title="Page options and who can see it"><Icon name="gear" size={14} /></button>
                  )}
                  {pageMenu === p.id && (
                    <div className="lm-writer-pagemenu" role="dialog" aria-label={`${p.title} options`}>
                      <label className="lm-writer-setting-label">Page name
                        <input className="lm-writer-input" value={p.title} onChange={(e) => store.updatePage(p.id, { title: e.target.value })} />
                      </label>
                      {(sharing || students.length > 0) && (
                        <>
                          <span className="lm-writer-setting-label">Who can see this page</span>
                          <div className="lm-writer-access-row"><span>Everyone</span>{accessToggle(p.id, 'everyone', p.everyone, 'Everyone')}</div>
                          {students.map((st) => <div key={st.id} className="lm-writer-access-row"><span>{st.name}</span>{accessToggle(p.id, st.id, accessFor(p, st.id), st.name)}</div>)}
                          {students.length === 0 && <p className="muted" style={{ margin: 0 }}>Students show here once they join.</p>}
                        </>
                      )}
                      <div className="lm-writer-fixes">
                        <button type="button" className="lm-tool-btn" onClick={() => { if (window.confirm(`Clear everything on "${p.title}"?`)) { store.setText(p.id, ''); setRecord(EMPTY_RECORD); } }}>Clear page</button>
                        {store.pages.length > 1 && <button type="button" className="lm-tool-btn" onClick={() => { if (window.confirm(`Delete "${p.title}"?`)) { store.removePage(p.id); setPageMenu(null); } }}>Delete page</button>}
                        <button type="button" className="lm-tool-btn" onClick={() => setPageMenu(null)}>Done</button>
                      </div>
                    </div>
                  )}
                </span>
              );
            })}
            {canManagePages && <button type="button" className="lm-writer-tab-add" onClick={() => setPageId(store.addPage(`Page ${store.pages.length + 1}`))}>+ Page</button>}
            {canManagePages && students.length > 0 && <button type="button" className="lm-writer-tab-add" onClick={() => store.pagePerStudent(students)} title="A page for each student that only they can see and write on">A page for each student</button>}
          </div>
          <div className={`lm-writer-suggest${focusModeOn && !suggestions && !fixes.length && !heard ? ' quiet' : ''}`} aria-live="polite">
            {heard ? (
              <span className="lm-writer-suggest-label">Hearing: <em>{heard}</em></span>
            ) : suggestions ? (
              <>
                <span className="lm-writer-suggest-label">Did you mean</span>
                {suggestions.words.map((w, i) => (
                  <button key={w} type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => acceptSuggestion(w)}>
                    {w}{i === 0 && <kbd>Tab</kbd>}
                  </button>
                ))}
              </>
            ) : !fixes.length ? (
              <span className="lm-writer-suggest-label muted">{readOnly ? 'You can read this page. Your teacher chose who writes here.' : wordsReady() ? 'Start writing. Each word shows its symbol once you press space.' : 'Getting the word list ready...'}</span>
            ) : null}
            {/* Automatic fixes wait for the student: keep it, or undo it (and redo it if they change their mind). */}
            {fixes.map((f) => (
              <span key={f.id} className="lm-writer-fix">
                {f.state === 'pending'
                  ? <span className="lm-writer-suggest-label">Changed <strong>{f.from}</strong> to <strong>{f.to}</strong></span>
                  : <span className="lm-writer-suggest-label">Kept <strong>{f.from}</strong></span>}
                {f.state === 'pending' ? (
                  <>
                    <button type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => closeFix(f)}>Keep</button>
                    <button type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => undoFix(f)}>Undo</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => redoFix(f)}>Redo</button>
                    <button type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => closeFix(f)}>OK</button>
                  </>
                )}
              </span>
            ))}
          </div>
          {frame && (() => {
            const s = sentences.find((sp) => caret >= sp.start && caret <= sp.end + 1) ?? (text.trim() ? undefined : { start: 0, end: 0, text: '', ended: false });
            const mineSlots = s && s.text ? sentenceSlots(tagForCheck(s.text), s.text) : [];
            let filled = 0;
            while (filled < frame.slots.length && filled < mineSlots.length && slotMatches(frame.slots[filled], mineSlots[filled])) filled++;
            const done = mineSlots.length > 0 && slotDistance(frame.slots, mineSlots) === 0 && !!s?.ended;
            return (
              <div className={`lm-writer-frame${done ? ' done' : ''}`} role="group" aria-label="Formula to write with">
                <div className="lm-writer-frame-slots">
                  {frame.slots.map((slot, i) => {
                    const info = MONTESSORI_WORD_CLASS_INFO[slotClassOf(slot)];
                    return (
                      <span key={i} className={`lm-writer-frame-slot${i < filled ? ' filled' : i === filled ? ' next' : ''}`}>
                        <span style={{ color: info.color }}>{slotLabel(slot)}</span>
                        <img src={info.imageUrl} alt="" />
                        <span className="lm-writer-frame-word">{i < filled ? mineSlots[i].word : ''}</span>
                      </span>
                    );
                  })}
                </div>
                <span className="muted">{done ? 'This sentence matches the formula.' : `Model: ${frame.sentence}`}{settings.level !== 'A' ? ` · ${frame.code}` : ''}</span>
                <button type="button" className="lm-float-x" onClick={() => setFrame(null)} aria-label="Stop writing with this formula">×</button>
              </div>
            );
          })()}
          <div className="lm-writer-print-head">
            <strong>{page?.title ?? 'Writing'}</strong>{studentName ? ` · ${studentName}` : ''} · {today} · {supported ? `Supported writing (${supportsOn.join(', ') || 'supports used'})` : 'Unsupported writing'}
          </div>
          {page ? (
            <div className={`lm-writer-page${sym ? ' sym-on' : ''}`} ref={pageRef} style={pageStyle}>
              <div className="lm-writer-mirror" ref={mirrorRef} aria-hidden="true">{mirror}</div>
              {lineFocusOn && focusLine !== null && (
                <>
                  <div className="lm-writer-shade" style={{ top: 0, height: 20 + focusLine * lineHeight }} aria-hidden="true" />
                  <div className="lm-writer-shade" style={{ top: 20 + (focusLine + 1) * lineHeight, bottom: 0 }} aria-hidden="true" />
                </>
              )}
              <textarea
                ref={taRef}
                className="lm-writer-text"
                value={text}
                readOnly={readOnly}
                placeholder={readOnly ? '' : 'Write here...'}
                aria-label={`${page.title}: your writing`}
                spellCheck={!settings.blockAddons}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
                {...blockAttrs}
                onChange={onChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSelect={syncCaret}
                onKeyUp={syncCaret}
                onClick={() => { syncCaret(); openSpellPopup(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && suggestions) { e.preventDefault(); acceptSuggestion(suggestions.words[0]); }
                  if (e.key === 'Escape') setPopup(null);
                }}
              />
              {popup && (
                <div className="lm-writer-popup" style={{ left: popup.left, top: popup.top }} role="dialog" aria-label={`Spelling of ${popup.word}`}>
                  {popup.adding ? (
                    <>
                      <span className="lm-writer-suggest-label">Add <strong>{popup.word}</strong> to my dictionary as:</span>
                      {DICTIONARY_TYPES.map(([cls, name]) => (
                        <button key={cls} type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => { addMyWord(popup.word, cls); setPopup(null); }}>{name}</button>
                      ))}
                      <button type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setPopup({ ...popup, adding: false })}>Back</button>
                    </>
                  ) : (
                    <>
                      {settings.spellHelp === 'suggest' && (popup.options.length ? popup.options.map((o) => (
                        <button key={o} type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => { replaceRange(popup.start, popup.start + popup.word.length, o); setPopup(null); bump('spellingFixes'); }}>{o}</button>
                      )) : <span className="muted">No ideas for this one. Try sounding it out.</span>)}
                      <button type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setPopup({ ...popup, adding: true })}>Add to my dictionary</button>
                      <button type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setPopup(null)}>Keep</button>
                    </>
                  )}
                </div>
              )}
              {issuePop && (
                <div className="lm-writer-popup lm-writer-issue-pop" style={{ left: issuePop.left, top: issuePop.top }} role="dialog" aria-label={issuePop.issue.kind === 'fragment' ? 'Incomplete sentence' : 'Run-on sentence'}>
                  {issuePop.issue.kind === 'fragment' ? (
                    <span className="lm-writer-suggest-label"><strong>Incomplete sentence.</strong> {issuePop.issue.why === 'verb' ? 'It needs a verb.' : issuePop.issue.why === 'subject' ? 'It needs a subject.' : 'It starts with a joining word, so it needs a main idea too.'}</span>
                  ) : (
                    <>
                      <span className="lm-writer-suggest-label"><strong>Run-on sentence.</strong> {issuePop.issue.comma ? 'Two sentences are joined with only a comma.' : 'Two sentences run together.'} End the first one, or join them with a word like and, but or so.</span>
                      <button type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => issuePop.issue.kind === 'runon' && splitRunOn(issuePop.s, issuePop.issue.at)}>Split into two sentences</button>
                    </>
                  )}
                  <button type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => { setCheckRange({ a: issuePop.s.start, b: issuePop.s.end }); setCheckIdx(0); setCheckTab('complete'); setTicks(new Set()); setIssuePop(null); }}>Check sentence</button>
                  <button type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setIssuePop(null)}>OK</button>
                </div>
              )}
            </div>
          ) : (
            <div className="lm-writer-page lm-writer-empty"><p className="muted">Your teacher hasn't shared a page with you yet.</p></div>
          )}
        </main>
      </div>

      {/* Sentence Check: opens only when someone checks a sentence. One tab per check, so a student works on one
          thing at a time; open spots in the writing show where the open tab's check still needs work. */}
      {settings.grammar !== 'off' && checkRange && page && (
        <div className="lm-writer-checkwin" style={{ left: checkWin.pos.x, top: checkWin.pos.y }} role="dialog" aria-label="Sentence Check">
          <div className="lm-writer-checkwin-head" onPointerDown={checkWin.onPointerDown}>
            <strong>Sentence Check</strong>
            <button type="button" className="lm-float-x" onClick={() => setCheckRange(null)} aria-label="Close Sentence Check">×</button>
          </div>
          {!cs || !cr || !cp ? (
            <p className="muted" style={{ margin: 0 }}>Select a sentence (or click in one), then press Check sentence.</p>
          ) : (
            <>
              {checkedSentences.length > 1 && (
                <div className="lm-writer-check-nav">
                  <button type="button" className="lm-tool-btn" disabled={ci === 0} onClick={() => setCheckIdx(ci - 1)} aria-label="Previous sentence">‹</button>
                  <span>Sentence {ci + 1} of {checkedSentences.length}</span>
                  <button type="button" className="lm-tool-btn" disabled={ci >= checkedSentences.length - 1} onClick={() => setCheckIdx(ci + 1)} aria-label="Next sentence">›</button>
                </div>
              )}
              <button type="button" className="lm-writer-check-text" onClick={() => selectSentence(cs)} title="Show this sentence">"{cs.text.replace(/[\u200b\u200c]/g, '')}"</button>
              <div className="lm-writer-check-tabs" role="tablist" aria-label="Checks">
                {ITEMS.map((it) => {
                  const st = status(it);
                  return (
                    <button key={it} type="button" role="tab" aria-selected={checkTab === it} className={`${checkTab === it ? 'on' : ''} ${st}`} onClick={() => setCheckTab(it)}>
                      <Check ok={st === 'ok'} warn={st === 'todo'} />{TAB_NAMES[it]}
                    </button>
                  );
                })}
                <button type="button" role="tab" aria-selected={checkTab === 'formula'} className={checkTab === 'formula' ? 'on' : ''} onClick={() => setCheckTab('formula')}>Formula</button>
              </div>
              {checkTab !== 'formula' ? (
                <div className="lm-writer-check-card">
                  <strong>{labels[checkTab]}</strong>
                  <span>{ITEM_HELP[checkTab]}</span>
                  {checkStyle === 'self' && (
                    <button type="button" role="checkbox" aria-checked={ticks.has(tickKey(checkTab))} className="lm-writer-tick" onClick={() => setTicks((tk) => { const n = new Set(tk); const k = tickKey(checkTab); if (n.has(k)) n.delete(k); else n.add(k); return n; })}>
                      <Check ok={ticks.has(tickKey(checkTab)) && !cp[checkTab]} warn={ticks.has(tickKey(checkTab)) && cp[checkTab]} />
                      <span>I checked this</span>
                    </button>
                  )}
                  {status(checkTab) === 'ok' && <span className="lm-writer-done">Done.</span>}
                  {status(checkTab) === 'todo' && (
                    <>
                      <span className="lm-writer-notyet">{checkStyle === 'self' ? 'Not yet: look for the open spot.' : 'Needs work: look for the open spot.'}</span>
                      <div className="lm-writer-fixes">{fixButton(checkTab, cs, cr)}</div>
                    </>
                  )}
                </div>
              ) : (
                <div className="lm-writer-check-card">
                  {/* Her formula cards: the card this sentence matches, or the closest one to try. */}
                  {cr.formula && cr.exact && (
                    <>
                      <span className="lm-writer-formula-name">Formula {cr.formula.lesson}: {cr.formula.formula}{settings.level !== 'A' ? ` (${cr.formula.code})` : ''}</span>
                      <img className="lm-writer-card" src={cr.formula.card} alt={cr.formula.formula} />
                    </>
                  )}
                  {cr.formula && !cr.exact && Object.values(cp).some(Boolean) && (
                    <>
                      <span className="lm-writer-formula-name">Try formula {cr.formula.lesson}: {cr.formula.formula}{settings.level !== 'A' ? ` (${cr.formula.code})` : ''}</span>
                      <img className="lm-writer-card" src={cr.formula.sentenceCard} alt={cr.formula.sentence} />
                    </>
                  )}
                  {cr.formula && !cr.exact && !Object.values(cp).some(Boolean) && (
                    <>
                      <span className="lm-writer-formula-name">A new formula{settings.level !== 'A' ? `: ${cr.code}` : ''}</span>
                      <FormulaSymbols slots={cr.slots} labels />
                      <span className="muted">This sentence is correct and isn't one of the formula cards yet.</span>
                      {book.some((e) => e.code === cr.code)
                        ? <span className="muted">It's in your formula book.</span>
                        : <button type="button" className="lm-tool-btn" onClick={() => setBook(addToBook(cr.code, cs.text, cr.slots))}>Add formula to my book</button>}
                    </>
                  )}
                  <button type="button" className="lm-tool-btn" onClick={() => setFormulasOpen(true)}>Open Sentence formulas</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {formulasOpen && (
        <SentenceFormulas level={settings.level} book={book} onBook={setBook} ideas={ideas} onIdeas={setIdeas} showIdeas={canChangeSettings} onClose={() => setFormulasOpen(false)}
          onUse={(f) => { setFrame(f); setFormulasOpen(false); taRef.current?.focus(); }} />
      )}

      {/* One Settings menu: what the teacher sets and what's the student's own choice, each marked. */}
      {settingsOpen && (
        <div className="lm-writer-settings" role="dialog" aria-label="Settings">
          <div className="space-between" style={{ marginBottom: 8 }}>
            <strong>Settings</strong>
            <button type="button" className="lm-float-x" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
          </div>
          <p className="muted" style={{ margin: '0 0 4px' }}>
            {canChangeSettings
              ? <>Each setting is marked <span className="lm-who teacher">Teacher sets</span> or <span className="lm-who yours">Your choice</span>. "Student choice" lets each student decide. Your text and spacing picks are where students start. On their own device (not joined to a board), students set everything themselves.</>
              : <>Settings marked <span className="lm-who locked">Set by your teacher</span> are your teacher's. <span className="lm-who yours">Your choice</span> settings are yours.</>}
          </p>

          <h3 className="lm-writer-settings-h">Text</h3>
          <Choice label="Text style" value={font} disabled={fontLocked} onChange={onFont} who={fontLocked ? 'locked' : 'yours'} options={[['inclusive', 'Regular'], ['cursive', 'Cursive'], ['dyslexic', 'Dyslexia']]} />
          <Choice label="Letter spacing" value={letterSp} disabled={false} onChange={(v) => setLook({ letterSpacing: v })} who="yours" options={[['normal', 'Normal'], ['wide', 'Wide'], ['wider', 'Wider']]} />
          <Choice label="Word spacing" value={wordSp} disabled={false} onChange={(v) => setLook({ wordSpacing: v })} who="yours" options={[['normal', 'Normal'], ['wide', 'Wide'], ['wider', 'Wider']]} />
          <Choice label="Line spacing" value={lineSp} disabled={false} onChange={(v) => setLook({ lineSpacing: v })} who="yours" options={[['normal', 'Normal'], ['wide', 'Wide'], ['wider', 'Wider']]} />
          <Choice label="Colors" value={theme} disabled={false} onChange={(v) => setLook({ theme: v })} who="yours" options={[['default', 'Standard'], ['high', 'High contrast'], ['dark', 'Dark'], ['cream', 'Cream']]} />
          <Choice label="Line focus" value={lineFocusOn ? 'on' : 'off'} disabled={false} onChange={(v) => setLook({ lineFocus: v === 'on' })} who="yours" options={[['off', 'Off'], ['on', 'On']]} />
          <Choice label="Focus mode" value={focusModeOn ? 'on' : 'off'} disabled={false} onChange={(v) => setLook({ focusMode: v === 'on' })} who="yours" options={[['off', 'Off'], ['on', 'On']]} />

          <h3 className="lm-writer-settings-h">Symbols</h3>
          {toolRow('Grammar symbols (above the words)', settings.symbols, [['off', 'Off'], ['on', 'On'], ['choice', 'Student choice']], (v) => update({ symbols: v }), symbolsOn ? 'on' : 'off', [['off', 'Off'], ['on', 'On']], (v) => setMine({ symbols: v === 'on' }))}
          <Choice label="Symbol size" value={settings.symbolSize} disabled={!canChangeSettings} who={t} onChange={(v) => update({ symbolSize: v })} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large (sentence card size)']]} />
          <Choice label="Formula codes (A-N-V)" value={settings.level} disabled={!canChangeSettings} who={t} onChange={(v) => update({ level: v })} options={[['A', 'Level A: symbols only'], ['B', 'Level B: symbols and codes'], ['C', 'Level C: codes']]} />

          <h3 className="lm-writer-settings-h">Listening and speaking</h3>
          {Recognition && toolRow('Dictation (speak to type)', settings.dictation, [['off', 'Off'], ['on', 'On'], ['choice', 'Student choice']], (v) => update({ dictation: v }), mine.dictation ? 'on' : 'off', [['off', 'Off'], ['on', 'On']], (v) => setMine({ dictation: v === 'on' }))}
          {speechOK && toolRow('Read aloud with highlighting', settings.readAloud, [['off', 'Off'], ['on', 'On'], ['choice', 'Student choice']], (v) => update({ readAloud: v }), mine.readAloud ? 'on' : 'off', [['off', 'Off'], ['on', 'On']], (v) => setMine({ readAloud: v === 'on' }))}
          {speechOK && toolRow('Typing echo (say words back)', settings.typingEcho, [['off', 'Off'], ['words', 'Each word'], ['sentences', 'Each sentence'], ['choice', 'Student choice']], (v) => update({ typingEcho: v }), mine.typingEcho ?? 'off', [['off', 'Off'], ['words', 'Each word'], ['sentences', 'Each sentence']], (v) => setMine({ typingEcho: v }))}
          {(readAloudOn || echo !== 'off') && <Choice label="Reading speed" value={String(rate)} disabled={false} who="yours" onChange={(v) => setMine({ rate: Number(v) })} options={[['0.7', 'Slow'], ['0.9', 'Medium'], ['1.1', 'Fast']]} />}

          <h3 className="lm-writer-settings-h">Writing supports</h3>
          <Choice label="Spell check" value={settings.spell} disabled={!canChangeSettings} who={t} onChange={(v) => update({ spell: v })} options={[['off', 'Off'], ['common', 'Common words only'], ['all', 'All words']]} />
          <Choice label="Spelling help" value={settings.spellHelp} disabled={!canChangeSettings} who={t} onChange={(v) => update({ spellHelp: v })} options={[['mark', 'Mark mistakes'], ['suggest', 'Mark and suggest']]} />
          <Choice label="Predictive text" value={settings.predict} disabled={!canChangeSettings} who={t} onChange={(v) => update({ predict: v })} options={[['off', 'Off'], ['suggest', 'Suggest'], ['auto', 'Fix automatically (student keeps or undoes)']]} />
          <Choice label="Auto-capitalization" value={settings.autoCap ? 'on' : 'off'} disabled={!canChangeSettings} who={t} onChange={(v) => update({ autoCap: v === 'on' })} options={[['on', 'On'], ['off', 'Off']]} />
          <Choice label="Sentence Check" value={settings.grammar} disabled={!canChangeSettings} who={t} onChange={(v) => update({ grammar: v })} options={[['off', 'Off'], ['on', 'On (when a sentence is checked)']]} />
          {toolRow('Who ticks the Sentence Check', settings.checkStyle, [['auto', 'Write mode'], ['self', 'The student'], ['choice', 'Student choice']], (v) => update({ checkStyle: v }), checkStyle, [['auto', 'Check it for me'], ['self', 'I tick it myself']], (v) => setMine({ checkStyle: v }))}
          <Choice label="Block writing add-ons (Grammarly and others)" value={settings.blockAddons ? 'on' : 'off'} disabled={!canChangeSettings} who={t} onChange={(v) => update({ blockAddons: v === 'on' })} options={[['on', 'Blocked'], ['off', 'Allowed']]} />

          <h3 className="lm-writer-settings-h">My dictionary <span className="lm-who yours">Your choice</span></h3>
          <p className="muted" style={{ margin: '0 0 4px' }}>Words that are right but not in the word list, like names. Tap a marked word and choose "Add to my dictionary", or add one here.</p>
          <div className="lm-writer-fixes">
            <input className="lm-writer-input" style={{ flex: 1, marginTop: 0 }} value={newWord.word} onChange={(e) => setNewWord({ ...newWord, word: e.target.value })} placeholder="A word, like Xander" aria-label="New word" />
            <select className="lm-writer-input" style={{ width: 'auto', marginTop: 0 }} value={newWord.cls} onChange={(e) => setNewWord({ ...newWord, cls: e.target.value as MontessoriWordClass })} aria-label="What kind of word">
              {DICTIONARY_TYPES.map(([cls, name]) => <option key={cls} value={cls}>{name}</option>)}
            </select>
            <button type="button" className="lm-tool-btn" disabled={!newWord.word.trim()} onClick={() => { addMyWord(newWord.word, newWord.cls); setNewWord({ ...newWord, word: '' }); }}>Add</button>
          </div>
          {myWords().map((w) => (
            <div key={w.word} className="lm-writer-book-row">
              <span className="lm-writer-formula-symbols"><img src={MONTESSORI_WORD_CLASS_INFO[w.cls].imageUrl} alt="" /></span>
              <span><strong>{w.word}</strong> · {MONTESSORI_WORD_CLASS_INFO[w.cls].name}</span>
              <button type="button" className="lm-tool-btn" onClick={() => removeMyWord(w.word)}>Remove</button>
            </div>
          ))}

          <h3 className="lm-writer-settings-h">This draft's support record</h3>
          <p style={{ margin: '0 0 4px' }}><strong>{supported ? 'Supported writing' : 'Unsupported writing'}</strong>{supportsOn.length ? `: ${supportsOn.join(', ')} on` : ''}.</p>
          <ul className="lm-writer-record">
            <li>Predictions picked: {record.predictions}</li>
            <li>Words fixed automatically: {record.autoFixes} (undone by the student: {record.fixesUndone})</li>
            <li>Capitals added automatically: {record.autoCaps}</li>
            <li>Spelling suggestions used: {record.spellingFixes}</li>
            <li>Sentence Check fixes used: {record.sentenceFixes}</li>
            <li>Dictated: {record.dictations}</li>
            <li>Read alouds: {record.readAlouds} · Words or sentences said back: {record.echoes}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
