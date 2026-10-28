import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type * as Y from 'yjs';
import { Icon } from './Icon';
import { MONTESSORI_WORD_CLASS_INFO, type MontessoriWordClass } from '../lib/montessoriGrammar';
import { completionsFor, confidentFix, isWord, loadWords, missesCommonWord, suggestFor, wordsReady } from '../lib/writer/spell';
import { CHECK_LABELS, checkSentence, splitSentences, tagForCheck, type CheckItem, type CheckResult, type SentenceSpan } from '../lib/writer/sentenceCheck';
import { readStudentTools, saveStudentTools, type StudentTools, type WriterSettings } from '../lib/writer/settings';
import { LOCAL, accessFor, type PageAccess, type PageStore } from '../lib/writer/pages';
import { addIdea, addToBook, clearIdeas, readBook, readIdeas, removeFromBook, type BookEntry, type FormulaIdea } from '../lib/writer/formulaBook';

// The Writer (teacher, 2026-10-27): a word processor separate from the whiteboard, in an environment the
// teacher sets: spell check level, predictive text, auto-capitalization, her grammar symbols above the words,
// and her Sentence Check with the formulas from her Symbolic Grammar curriculum. Writing helpers like Grammarly
// are switched off here. Her answers of 2026-10-28 added pages shared live with students, a movable Sentence
// Check the student can tick, fixes the student approves, a formula book, dictation and printing.

// The support record kept with the draft (Claudia's research: every sample notes the supports used, so
// supported and unsupported writing are compared fairly, as her Program Overview requires).
type SupportRecord = Record<'predictions' | 'autoFixes' | 'fixesUndone' | 'autoCaps' | 'spellingFixes' | 'sentenceFixes' | 'readAlouds' | 'echoes' | 'dictations', number>;
const EMPTY_RECORD: SupportRecord = { predictions: 0, autoFixes: 0, fixesUndone: 0, autoCaps: 0, spellingFixes: 0, sentenceFixes: 0, readAlouds: 0, echoes: 0, dictations: 0 };
const REC_KEY = 'lm-writer-record';
const readRecord = (): SupportRecord => { try { return { ...EMPTY_RECORD, ...JSON.parse(sessionStorage.getItem(REC_KEY) ?? '{}') }; } catch { return EMPTY_RECORD; } };
const SPACING = { normal: { ls: '0.01em', ws: '0em', extra: 0 }, wide: { ls: '0.06em', ws: '0.18em', extra: 8 }, wider: { ls: '0.12em', ws: '0.36em', extra: 16 } } as const;
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
const CODE_CLASS: Record<string, MontessoriWordClass> = { A: 'article', N: 'noun', PN: 'propernoun', P: 'pronoun', V: 'verb', Adj: 'adjective', Adv: 'adverb', Pr: 'preposition', C: 'conjunction', I: 'interjection' };
const codeClasses = (code: string) => code.split(/[-,;:·“”"!?\s]+/).filter(Boolean).map((c) => CODE_CLASS[c]).filter(Boolean);
const ITEMS: CheckItem[] = ['complete', 'capital', 'endMark', 'match', 'time'];

// "Add a verb" drops in a blank with the part's symbol over it (a blank alone when symbols are off). The blank is
// three underscores and an invisible marker naming the part, so the symbol stays with it.
const PLACEHOLDER_MARK = { verb: '​', noun: '‌' } as const;
const MARK_CLASS: Record<string, MontessoriWordClass> = { '​': 'verb', '‌': 'noun' };

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

function Choice<T extends string>({ label, value, options, onChange, disabled }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; disabled: boolean }) {
  return (
    <div className="lm-writer-setting">
      <span className="lm-writer-setting-label">{label}</span>
      <span className="lm-writer-choices" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} disabled={disabled} onClick={() => onChange(v)}>{text}</button>
        ))}
      </span>
    </div>
  );
}

function FormulaSymbols({ code }: { code: string }) {
  return (
    <span className="lm-writer-formula-symbols">
      {codeClasses(code).map((c, i) => <img key={i} src={MONTESSORI_WORD_CLASS_INFO[c].imageUrl} alt={MONTESSORI_WORD_CLASS_INFO[c].name} title={MONTESSORI_WORD_CLASS_INFO[c].name} />)}
    </span>
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

export function Writer({ settings, canChangeSettings, onSettings, onBack, studentName, headerExtras, pages: store, students = [], sharing = false }: {
  settings: WriterSettings; canChangeSettings: boolean; onSettings: (s: WriterSettings) => void; onBack?: () => void; studentName?: string; headerExtras?: ReactNode;
  pages: PageStore; students?: { id: string; name: string }[]; sharing?: boolean;
}) {
  useSyncExternalStore(store.subscribe, () => store.version);
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
  const [fixes, setFixes] = useState<Fix[]>([]);
  const fixId = useRef(0);
  const [popup, setPopup] = useState<{ start: number; word: string; options: string[]; left: number; top: number } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<{ start: number; end: number } | null>(null);
  const [mine, setMineState] = useState<StudentTools>(readStudentTools);
  const setMine = (patch: StudentTools) => setMineState((m) => { const next = { ...m, ...patch }; saveStudentTools(next); return next; });
  const [record, setRecord] = useState<SupportRecord>(readRecord);
  const bump = (k: keyof SupportRecord, by = 1) => setRecord((r) => ({ ...r, [k]: r[k] + by }));
  useEffect(() => { try { sessionStorage.setItem(REC_KEY, JSON.stringify(record)); } catch { /* not saved */ } }, [record]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(true);
  const [book, setBook] = useState<BookEntry[]>(readBook);
  const [ideas, setIdeas] = useState<FormulaIdea[]>(readIdeas);
  const [ticks, setTicks] = useState<Set<CheckItem>>(new Set());
  const [pageMenu, setPageMenu] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<{ start: number; end: number } | null>(null);
  const caretMark = useRef<HTMLSpanElement>(null);
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const checkWin = useDragSpot('lm-writer-checkpos', { x: Math.max(16, (typeof window === 'undefined' ? 1200 : window.innerWidth) - 380), y: 140 });

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
  useEffect(() => { setTicks(new Set()); setFixes([]); setPopup(null); }, [pid]);

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
  // tools follow the student's pick, starting from the teacher's default.
  const readAloudOn = speechOK && (settings.readAloud === 'on' || (settings.readAloud === 'choice' && !!mine.readAloud));
  const echo = !speechOK ? 'off' : settings.typingEcho === 'choice' ? (mine.typingEcho ?? 'off') : settings.typingEcho;
  const dictationOn = !!Recognition && (settings.dictation === 'on' || (settings.dictation === 'choice' && !!mine.dictation));
  const symbolsOn = settings.symbols === 'on' || (settings.symbols === 'choice' && (mine.symbols ?? true));
  const checkStyle = settings.checkStyle === 'choice' ? (mine.checkStyle ?? 'auto') : settings.checkStyle;
  const spacing = mine.spacing ?? settings.spacing;
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
  // Writing add-ons blocked: the page also hides anything they inject while the Writer is open.
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
  const lineHeight = (sym ? Math.round(fontPx * 1.2 + 2 * (sym + 8)) : Math.round(fontPx * 1.7)) + SPACING[spacing].extra;
  const pageStyle = { '--wr-padx': `${Math.max(28, sym / 2 + 6)}px`, '--wr-font': `${fontPx}px`, '--wr-line': `${lineHeight}px`, '--wr-sym': `${sym}px`, '--wr-ls': SPACING[spacing].ls, '--wr-ws': `calc(${SPACING[spacing].ws} + ${sym ? SYMBOL_GAP[settings.symbolSize] : '0em'})` } as CSSProperties;

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

  // Sentences, their checks, and each word's symbol.
  const sentences = useMemo(() => splitSentences(text), [text]);
  const checks = useMemo(() => new Map<SentenceSpan, CheckResult>(sentences.map((s) => [s, checkSentence(s)])), [sentences]);
  const wordClasses = useMemo(() => sentences.flatMap((s) => tagForCheck(s.text).map((w) => w.wordClass)), [sentences]);
  const labels = CHECK_LABELS;

  // When a sentence is checked: at its end mark, or as the student types (except the end mark of the sentence
  // being typed, which isn't finished yet).
  const caretSentence = sentences.find((s) => caret >= s.start && caret <= s.end + 1);
  const shown = (s: SentenceSpan) => settings.grammar === 'live' || (settings.grammar === 'end' && s.ended);
  const problems = (s: SentenceSpan, r: CheckResult): Record<CheckItem, boolean> => {
    const endMarkMissing = !r.endMark && !(settings.grammar === 'live' && s === caretSentence && focused);
    return { complete: !r.complete, capital: !r.capital, endMark: endMarkMissing, match: !r.match.ok, time: !r.time };
  };
  const checked = settings.grammar === 'off' ? [] : sentences.filter(shown);
  const flagged = checked.filter((s) => Object.values(problems(s, checks.get(s)!)).some(Boolean));
  // Each item is done when no checked sentence still needs it.
  const done = Object.fromEntries(ITEMS.map((it) => [it, checked.every((s) => !problems(s, checks.get(s)!)[it])])) as Record<CheckItem, boolean>;
  // Open spots show where an item still needs work: every problem when the Writer checks, and only the items the
  // student ticked that aren't done when the student checks.
  const spotItems = new Set<CheckItem>(settings.grammar === 'off' ? [] : checkStyle === 'auto' ? ITEMS : ITEMS.filter((it) => ticks.has(it) && !done[it]));
  const gaps = new Map<number, MontessoriWordClass | null>(); // empty spots at a position (a missing part or end mark)
  const wordSpots = new Set<number>(); // words to outline
  for (const s of flagged) {
    const r = checks.get(s)!;
    const p = problems(s, r);
    const ws = [...s.text.matchAll(WORD_RE)];
    const at = (i: number) => s.start + (ws[i]?.index ?? 0);
    if (spotItems.has('complete') && p.complete && r.missing) {
      const target = ws[r.insertAt];
      gaps.set(target ? s.start + (target.index ?? 0) : s.start + s.text.replace(/[.!?"'”’)]+$/, '').length, r.missing === 'who' ? 'noun' : 'verb');
    }
    if (spotItems.has('endMark') && p.endMark) gaps.set(s.end, null);
    if (spotItems.has('capital') && p.capital) {
      if (!/^[^A-Za-z]*[A-Z]/.test(s.text)) wordSpots.add(at(0));
      ws.forEach((w, i) => { if (w[0] === 'i') wordSpots.add(at(i)); });
    }
    if (spotItems.has('match') && p.match && r.match.index !== undefined) wordSpots.add(at(r.match.index));
    if (spotItems.has('time') && p.time) r.words.forEach((w, i) => { if (w.wordClass === 'verb') wordSpots.add(at(i)); });
  }

  // The word being typed right now (cursor at its end), which isn't marked until it's finished.
  const typingWordStart = (() => {
    if (!focused) return -1;
    const m = text.slice(0, caret).match(/[A-Za-z']+$/);
    return m && !/[A-Za-z']/.test(text[caret] ?? '') ? caret - m[0].length : -1;
  })();
  const misspelled = (word: string, start: number) => {
    if (settings.spell === 'off' || !wordsReady() || start === typingWordStart) return false;
    if (/^[A-Z]/.test(word) && !startsSentenceAt(text, start)) return false; // a name
    if (settings.spell === 'common') return missesCommonWord(word, lastWordBefore(text, start), wordsAfter(text, start + word.length));
    return !isWord(word);
  };

  // The mirror under the text: the same words, with symbols, markings, open spots and other people's cursors.
  // Everything added is zero-width, so the mirror's words stay exactly under the text area's.
  const mirror: ReactNode[] = [];
  {
    let wi = 0;
    const re = /_{3}[​‌]|[A-Za-z']+|[^A-Za-z'_]+|_+/g;
    let m: RegExpExecArray | null;
    let markPlaced = false;
    const marks = [...remoteCarets].sort((a, b) => a.index - b.index);
    const gapAt = (i: number) => (gaps.has(i) ? (
      <span key={`gap${i}`} className={`lm-writer-gap ${gaps.get(i) ? 'part' : 'end'}`}><i />{sym > 0 && gaps.get(i) && <img className="lm-writer-sym" src={MONTESSORI_WORD_CLASS_INFO[gaps.get(i)!].imageUrl} alt="" draggable={false} />}</span>
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
      if (g) mirror.push(g);
      if (/^_{3}[​‌]$/.test(tok)) {
        const cls = MARK_CLASS[tok[3]];
        mirror.push(
          <span key={start} className="w blank" data-start={start}>
            {piece(tok, start)}
            {sym > 0 && <img className="lm-writer-sym" src={MONTESSORI_WORD_CLASS_INFO[cls].imageUrl} alt="" draggable={false} />}
          </span>,
        );
        continue;
      }
      if (!/^[A-Za-z']/.test(tok)) { mirror.push(...piece(tok, start)); continue; }
      const cls = wordClasses[wi++];
      const info = cls ? MONTESSORI_WORD_CLASS_INFO[cls] : undefined;
      const bad = misspelled(tok, start);
      const gram = !bad && checkStyle === 'auto' && flagged.some((s) => start >= s.start && start < s.end);
      mirror.push(
        <span key={start} className={`w${bad ? ' bad' : ''}${gram ? ' gram' : ''}${wordSpots.has(start) ? ' spot' : ''}${speaking && start === speaking.start ? ' speaking' : ''}`} data-start={start}>
          {piece(tok, start)}
          {sym > 0 && info && <img className="lm-writer-sym" src={info.imageUrl} alt="" draggable={false} />}
        </span>,
      );
    }
    const end = gapAt(text.length);
    if (end) mirror.push(end);
    if (!markPlaced) mirror.push(<span key="caret-mark" ref={caretMark} className="lm-writer-caret-mark" />);
    for (const c of marks) if (c.index >= text.length) mirror.push(<span key={`rc${c.from}`} className="lm-writer-rcaret" style={{ '--c': c.color } as CSSProperties}><i /><b>{c.name}</b></span>);
    mirror.push('​');
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
    setText(v);
    setCaret(pos);
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

  // Spelling help "Mark and suggest": tapping a marked word lists what it might be.
  const openSpellPopup = () => {
    if (settings.spellHelp !== 'suggest' || readOnly) return;
    const ta = taRef.current;
    if (!ta) return;
    const at = ta.selectionStart;
    for (const m of text.matchAll(WORD_RE)) {
      const i = m.index ?? 0;
      if (at >= i && at <= i + m[0].length) {
        if (!misspelled(m[0], i) || i === typingWordStart) { setPopup(null); return; }
        const el = mirrorRef.current?.querySelector(`[data-start="${i}"]`);
        const pg = pageRef.current?.getBoundingClientRect();
        const r = el?.getBoundingClientRect();
        if (!r || !pg) return;
        const options = suggestFor(m[0], lastWordBefore(text, i), 4, wordsAfter(text, i + m[0].length));
        setPopup({ start: i, word: m[0], options, left: r.left - pg.left, top: r.bottom - pg.top + 4 });
        return;
      }
    }
    setPopup(null);
  };

  // New formulas: a sentence that passes all five checks but isn't one of her formulas yet is collected as a
  // formula idea (and sent to the teacher on a shared board); the student can add it to their formula book.
  const isNewPattern = (s: SentenceSpan) => { const r = checks.get(s)!; return s.ended && r.formula && !r.exact && !Object.values(problems(s, r)).some(Boolean); };
  const logged = useRef(new Set<string>());
  useEffect(() => {
    for (const s of sentences) {
      if (!isNewPattern(s) || logged.current.has(s.text)) continue;
      logged.current.add(s.text);
      const code = checks.get(s)!.code;
      setIdeas(addIdea(code, s.text, studentName ?? ''));
      if (sharing && !canChangeSettings) store.send?.({ t: 'formula', from: store.me.id, name: studentName ?? '', code, sentence: s.text });
    }
  });
  useEffect(() => { if (bookOpen) setIdeas(readIdeas()); }, [bookOpen]);
  const lastEnded = [...sentences].reverse().find((s) => s.ended && s.end <= caret + 1) ?? sentences.filter((s) => s.ended).pop();
  const newPattern = lastEnded && isNewPattern(lastEnded) ? { code: checks.get(lastEnded)!.code, sentence: lastEnded.text } : null;

  const syncCaret = () => { const ta = taRef.current; if (ta) setCaret(ta.selectionStart); };
  const wordCount = (text.match(WORD_RE) ?? []).length;
  const blockAttrs = settings.blockAddons
    ? { 'data-gramm': 'false', 'data-gramm_editor': 'false', 'data-enable-grammarly': 'false', 'data-lt-active': 'false', 'data-ms-editor': 'false' }
    : {};

  const update = (patch: Partial<WriterSettings>) => onSettings({ ...settings, ...patch });
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
  const fixButtons = (s: SentenceSpan, r: CheckResult, p: Record<CheckItem, boolean>, only?: Set<CheckItem>) => {
    const want = (it: CheckItem) => p[it] && (!only || only.has(it));
    const ws = [...s.text.matchAll(WORD_RE)];
    return (
      <div className="lm-writer-fixes">
        {want('complete') && r.missing && <button type="button" className="lm-tool-btn" onClick={() => insertMissing(s, r)}>Add {r.missing === 'who' ? labels.who : labels.action}</button>}
        {want('capital') && <button type="button" className="lm-tool-btn" onClick={() => {
          const i = s.text.search(/[a-z]/);
          let fixed = s.text.replace(/\bi\b/g, 'I');
          if (i >= 0 && !/[A-Z]/.test(s.text.slice(0, i))) fixed = fixed.slice(0, i) + fixed[i].toUpperCase() + fixed.slice(i + 1);
          replaceRange(s.start, s.end, fixed, [s.end, s.end]);
          bump('sentenceFixes');
        }}>Fix capitals</button>}
        {want('endMark') && <button type="button" className="lm-tool-btn" onClick={() => { replaceRange(s.end, s.end, '.'); bump('sentenceFixes'); }}>Add end punctuation</button>}
        {want('match') && r.match.from && r.match.to && (
          <button type="button" className="lm-tool-btn" onClick={() => {
            const w = ws[r.match.index!];
            const at = s.start + (w.index ?? 0);
            replaceRange(at, at + r.match.from!.length, r.match.to!, [s.end, s.end]);
            bump('sentenceFixes');
          }}>Change {r.match.from} to {r.match.to}</button>
        )}
        {want('time') && <span className="muted">Keep the verbs in the same tense: past, present or future.</span>}
      </div>
    );
  };

  const pageAccessLabel = (a: PageAccess) => (a === 'edit' ? 'can write' : a === 'view' ? 'can view' : 'hidden');
  const accessToggle = (pageIdArg: string, who: string, a: PageAccess, name: string) => (
    <span className="lm-share-toggle" role="radiogroup" aria-label={`${name}: ${pageAccessLabel(a)}`}>
      <button type="button" role="radio" aria-checked={a === 'edit'} className={a === 'edit' ? 'on' : ''} onClick={() => store.setAccess(pageIdArg, who, 'edit')} title="Can write on this page" aria-label="Can write"><Icon name="pencil" /></button>
      <button type="button" role="radio" aria-checked={a === 'view'} className={a === 'view' ? 'on' : ''} onClick={() => store.setAccess(pageIdArg, who, 'view')} title="Can only read this page" aria-label="View only"><Icon name="eye" /></button>
      <button type="button" role="radio" aria-checked={a === 'none'} className={a === 'none' ? 'on' : ''} onClick={() => store.setAccess(pageIdArg, who, 'none')} title="Can't see this page" aria-label="Hidden"><span aria-hidden="true" style={{ fontWeight: 900 }}>✕</span></button>
    </span>
  );
  const today = new Date().toLocaleDateString();

  return (
    <div className={`lm-writer theme-${theme}${focusModeOn ? ' focus-mode' : ''}`}>
      <header className="lm-writer-bar">
        {onBack && <button type="button" className="btn btn-sm" onClick={onBack}>← Whiteboard</button>}
        <span className="lm-sidebar-title">Writer{studentName ? `: ${studentName}` : ''}</span>
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
        {settings.grammar !== 'off' && <button type="button" className={`btn btn-sm${checkOpen ? ' btn-primary' : ''}`} onClick={() => setCheckOpen((o) => !o)}>Sentence Check</button>}
        <button type="button" className={`btn btn-sm${bookOpen ? ' btn-primary' : ''}`} onClick={() => setBookOpen((o) => !o)}>Formula book</button>
        <button type="button" className={`btn btn-sm${toolsOpen ? ' btn-primary' : ''}`} onClick={() => setToolsOpen((o) => !o)}>My tools</button>
        <button type="button" className="btn btn-sm" onClick={() => window.print()}>Print</button>
        {headerExtras}
        <button type="button" className={`btn btn-sm${settingsOpen ? ' btn-primary' : ''}`} onClick={() => setSettingsOpen((o) => !o)}>
          {canChangeSettings ? 'Writing settings' : 'Settings (set by your teacher)'}
        </button>
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
              <span className="lm-writer-suggest-label muted">{readOnly ? 'You can read this page. Your teacher chose who writes here.' : wordsReady() ? 'Start writing. Your words show here with their symbols.' : 'Getting the word list ready...'}</span>
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
                  {popup.options.length ? popup.options.map((o) => (
                    <button key={o} type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => { replaceRange(popup.start, popup.start + popup.word.length, o); setPopup(null); bump('spellingFixes'); }}>{o}</button>
                  )) : <span className="muted">No ideas for this one. Try sounding it out.</span>}
                  <button type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setPopup(null)}>Keep</button>
                </div>
              )}
            </div>
          ) : (
            <div className="lm-writer-page lm-writer-empty"><p className="muted">Your teacher hasn't shared a page with you yet.</p></div>
          )}
        </main>
      </div>

      {/* Sentence Check: a window the student can move. The Writer ticks the list, or the student does, and an
          item ticked before it's really done shows open spots in the writing where it still needs work. */}
      {settings.grammar !== 'off' && checkOpen && page && !(focusModeOn && flagged.length === 0 && !newPattern) && (
        <div className="lm-writer-checkwin" style={{ left: checkWin.pos.x, top: checkWin.pos.y }} role="dialog" aria-label="Sentence Check">
          <div className="lm-writer-checkwin-head" onPointerDown={checkWin.onPointerDown}>
            <strong>Sentence Check</strong>
            <button type="button" className="lm-float-x" onClick={() => setCheckOpen(false)} aria-label="Close Sentence Check">×</button>
          </div>
          {checkStyle === 'self' && <p className="muted" style={{ margin: 0 }}>Tick each one when you've done it.</p>}
          <ul className="lm-checklist">
            {ITEMS.map((it) => {
              if (checkStyle === 'auto') return <li key={it} className={done[it] ? 'done' : ''}><Check ok={done[it]} />{labels[it]}</li>;
              const ticked = ticks.has(it);
              return (
                <li key={it}>
                  <button type="button" role="checkbox" aria-checked={ticked} className="lm-writer-tick" onClick={() => setTicks((t) => { const n = new Set(t); if (n.has(it)) n.delete(it); else n.add(it); return n; })}>
                    <Check ok={ticked && done[it]} warn={ticked && !done[it]} />
                    <span>{labels[it]}</span>
                  </button>
                  {ticked && !done[it] && <span className="lm-writer-notyet">Not yet: look for the open spots.</span>}
                </li>
              );
            })}
          </ul>
          {flagged.map((s) => {
            const r = checks.get(s)!;
            const p = problems(s, r);
            const only = checkStyle === 'self' ? new Set(ITEMS.filter((it) => ticks.has(it) && p[it])) : undefined;
            if (only && only.size === 0) return null;
            const items = ITEMS.filter((it) => p[it] && (!only || only.has(it)));
            return (
              <div key={s.start} className="lm-writer-check-card">
                <button type="button" className="lm-writer-check-text" onClick={() => selectSentence(s)} title="Show this sentence">"{s.text.replace(/[​‌]/g, '')}"</button>
                <span className="muted">Needs: {items.map((it) => labels[it].toLowerCase()).join(', ')}</span>
                {fixButtons(s, r, p, only)}
                {r.formula && (
                  <div className="lm-writer-formula">
                    <span className="lm-writer-formula-name">Try this formula: {r.formula.name}{settings.level !== 'A' ? ` (${r.formula.code})` : ''}</span>
                    <FormulaSymbols code={r.formula.code} />
                    <span className="muted">Model: {r.formula.sentence}</span>
                  </div>
                )}
              </div>
            );
          })}
          {newPattern && (
            <div className="lm-writer-check-card new">
              <span className="lm-writer-formula-name">A new formula{settings.level !== 'A' ? `: ${newPattern.code}` : ''}</span>
              <FormulaSymbols code={newPattern.code} />
              <span className="muted">"{newPattern.sentence}" is correct and isn't in the formula list yet.</span>
              {book.some((e) => e.code === newPattern.code)
                ? <span className="muted">It's in your formula book.</span>
                : <button type="button" className="lm-tool-btn" onClick={() => setBook(addToBook(newPattern.code, newPattern.sentence))}>Add formula to my book</button>}
            </div>
          )}
        </div>
      )}

      {bookOpen && (
        <div className="lm-writer-settings" role="dialog" aria-label="Formula book">
          <div className="space-between" style={{ marginBottom: 8 }}>
            <strong>My formula book</strong>
            <button type="button" className="lm-float-x" onClick={() => setBookOpen(false)} aria-label="Close formula book">×</button>
          </div>
          {book.length === 0 && <p className="muted" style={{ margin: 0 }}>When you write a correct sentence that isn't a formula yet, add it here to use again.</p>}
          {book.map((e) => (
            <div key={e.code} className="lm-writer-book-row">
              <FormulaSymbols code={e.code} />
              <span>{settings.level !== 'A' && <strong>{e.code} · </strong>}{e.sentence}</span>
              <button type="button" className="lm-tool-btn" onClick={() => setBook(removeFromBook(e.code))}>Remove</button>
            </div>
          ))}
          {canChangeSettings && (
            <>
              <h3 className="lm-writer-settings-h">Formula ideas</h3>
              <p className="muted" style={{ margin: '0 0 4px' }}>Correct sentences that match no formula yet{sharing ? ', from your writing and your students’' : ''}. Useful ones can become new formulas.</p>
              {ideas.length === 0 && <p className="muted" style={{ margin: 0 }}>None yet.</p>}
              {[...ideas].sort((a, b) => b.count - a.count).map((i) => (
                <div key={i.code} className="lm-writer-book-row">
                  <FormulaSymbols code={i.code} />
                  <span><strong>{i.code}</strong> · {i.count} {i.count === 1 ? 'sentence' : 'sentences'}{i.names.length ? ` · ${i.names.join(', ')}` : ''}<br /><span className="muted">{i.examples.join(' / ')}</span></span>
                </div>
              ))}
              {ideas.length > 0 && <button type="button" className="lm-tool-btn" onClick={() => { if (window.confirm('Clear the formula ideas list?')) { clearIdeas(); setIdeas([]); } }}>Clear list</button>}
            </>
          )}
        </div>
      )}
      {toolsOpen && (
        <div className="lm-writer-settings" role="dialog" aria-label="My tools">
          <div className="space-between" style={{ marginBottom: 8 }}>
            <strong>My tools</strong>
            <button type="button" className="lm-float-x" onClick={() => setToolsOpen(false)} aria-label="Close my tools">×</button>
          </div>
          {settings.symbols === 'choice' && <Choice label="Grammar symbols" value={symbolsOn ? 'on' : 'off'} disabled={false} onChange={(v) => setMine({ symbols: v === 'on' })} options={[['off', 'Off'], ['on', 'On']]} />}
          {settings.checkStyle === 'choice' && <Choice label="Sentence Check list" value={checkStyle} disabled={false} onChange={(v) => setMine({ checkStyle: v })} options={[['auto', 'Check it for me'], ['self', 'I tick it myself']]} />}
          {settings.dictation === 'choice' && Recognition && <Choice label="Dictation" value={mine.dictation ? 'on' : 'off'} disabled={false} onChange={(v) => setMine({ dictation: v === 'on' })} options={[['off', 'Off'], ['on', 'On']]} />}
          {settings.readAloud === 'choice' && speechOK && <Choice label="Read aloud" value={mine.readAloud ? 'on' : 'off'} disabled={false} onChange={(v) => setMine({ readAloud: v === 'on' })} options={[['off', 'Off'], ['on', 'On']]} />}
          {(readAloudOn || echo !== 'off') && <Choice label="Reading speed" value={String(rate)} disabled={false} onChange={(v) => setMine({ rate: Number(v) })} options={[['0.7', 'Slow'], ['0.9', 'Medium'], ['1.1', 'Fast']]} />}
          {settings.typingEcho === 'choice' && speechOK && <Choice label="Say my words back" value={mine.typingEcho ?? 'off'} disabled={false} onChange={(v) => setMine({ typingEcho: v })} options={[['off', 'Off'], ['words', 'Each word'], ['sentences', 'Each sentence']]} />}
          <Choice label="Spacing" value={spacing} disabled={false} onChange={(v) => setMine({ spacing: v })} options={[['normal', 'Normal'], ['wide', 'Wide'], ['wider', 'Wider']]} />
          <Choice label="Line focus" value={lineFocusOn ? 'on' : 'off'} disabled={false} onChange={(v) => setMine({ lineFocus: v === 'on' })} options={[['off', 'Off'], ['on', 'On']]} />
          <Choice label="Colors" value={theme} disabled={false} onChange={(v) => setMine({ theme: v })} options={[['default', 'Standard'], ['high', 'High contrast'], ['dark', 'Dark'], ['cream', 'Cream']]} />
          <Choice label="Focus mode" value={focusModeOn ? 'on' : 'off'} disabled={false} onChange={(v) => setMine({ focusMode: v === 'on' })} options={[['off', 'Off'], ['on', 'On']]} />
          <p className="muted" style={{ margin: '8px 0 0' }}>These change how the page looks, sounds or is checked for you.</p>
        </div>
      )}
      {settingsOpen && (
        <div className="lm-writer-settings" role="dialog" aria-label="Writing settings">
          <div className="space-between" style={{ marginBottom: 8 }}>
            <strong>Writing settings</strong>
            <button type="button" className="lm-float-x" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
          </div>
          {!canChangeSettings && <p className="muted" style={{ margin: '0 0 8px' }}>Your teacher chose these.</p>}
          <Choice label="Spell check" value={settings.spell} disabled={!canChangeSettings} onChange={(v) => update({ spell: v })} options={[['off', 'Off'], ['common', 'Common words only'], ['all', 'All words']]} />
          <Choice label="Spelling help" value={settings.spellHelp} disabled={!canChangeSettings} onChange={(v) => update({ spellHelp: v })} options={[['mark', 'Mark mistakes'], ['suggest', 'Mark and suggest']]} />
          <Choice label="Predictive text" value={settings.predict} disabled={!canChangeSettings} onChange={(v) => update({ predict: v })} options={[['off', 'Off'], ['suggest', 'Suggest'], ['auto', 'Fix automatically (student keeps or undoes)']]} />
          <Choice label="Auto-capitalization" value={settings.autoCap ? 'on' : 'off'} disabled={!canChangeSettings} onChange={(v) => update({ autoCap: v === 'on' })} options={[['on', 'On'], ['off', 'Off']]} />
          <Choice label="Sentence Check" value={settings.grammar} disabled={!canChangeSettings} onChange={(v) => update({ grammar: v })} options={[['off', 'Off'], ['end', 'At end punctuation'], ['live', 'As they type']]} />
          <Choice label="Who ticks the Sentence Check list" value={settings.checkStyle} disabled={!canChangeSettings} onChange={(v) => update({ checkStyle: v })} options={[['auto', 'The Writer'], ['self', 'The student'], ['choice', 'Student choice']]} />
          <Choice label="Grammar symbols (above the words)" value={settings.symbols} disabled={!canChangeSettings} onChange={(v) => update({ symbols: v })} options={[['off', 'Off'], ['on', 'On'], ['choice', 'Student choice']]} />
          <Choice label="Symbol size" value={settings.symbolSize} disabled={!canChangeSettings} onChange={(v) => update({ symbolSize: v })} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large (sentence card size)']]} />
          <Choice label="Formula codes (A-N-V)" value={settings.level} disabled={!canChangeSettings} onChange={(v) => update({ level: v })} options={[['A', 'Level A: symbols only'], ['B', 'Level B: symbols and codes'], ['C', 'Level C: codes']]} />
          <Choice label="Block writing add-ons (Grammarly and others)" value={settings.blockAddons ? 'on' : 'off'} disabled={!canChangeSettings} onChange={(v) => update({ blockAddons: v === 'on' })} options={[['on', 'Blocked'], ['off', 'Allowed']]} />
          <h3 className="lm-writer-settings-h">Accessibility</h3>
          <p className="muted" style={{ margin: '0 0 4px' }}>"Student choice" puts the tool in the student's My tools. Spacing, line focus, colors and focus mode are always the student's choice; you set where they start. On their own device (not joined to a board), students set all of these themselves.</p>
          <Choice label="Dictation (speak to type)" value={settings.dictation} disabled={!canChangeSettings} onChange={(v) => update({ dictation: v })} options={[['off', 'Off'], ['on', 'On'], ['choice', 'Student choice']]} />
          <Choice label="Read aloud with highlighting" value={settings.readAloud} disabled={!canChangeSettings} onChange={(v) => update({ readAloud: v })} options={[['off', 'Off'], ['on', 'On'], ['choice', 'Student choice']]} />
          <Choice label="Typing echo (say words back)" value={settings.typingEcho} disabled={!canChangeSettings} onChange={(v) => update({ typingEcho: v })} options={[['off', 'Off'], ['words', 'Each word'], ['sentences', 'Each sentence'], ['choice', 'Student choice']]} />
          <Choice label="Spacing (starts at)" value={settings.spacing} disabled={!canChangeSettings} onChange={(v) => update({ spacing: v })} options={[['normal', 'Normal'], ['wide', 'Wide'], ['wider', 'Wider']]} />
          <Choice label="Line focus (starts)" value={settings.lineFocus ? 'on' : 'off'} disabled={!canChangeSettings} onChange={(v) => update({ lineFocus: v === 'on' })} options={[['off', 'Off'], ['on', 'On']]} />
          <Choice label="Colors (starts at)" value={settings.theme} disabled={!canChangeSettings} onChange={(v) => update({ theme: v })} options={[['default', 'Standard'], ['high', 'High contrast'], ['dark', 'Dark'], ['cream', 'Cream']]} />
          <Choice label="Focus mode (starts)" value={settings.focusMode ? 'on' : 'off'} disabled={!canChangeSettings} onChange={(v) => update({ focusMode: v === 'on' })} options={[['off', 'Off'], ['on', 'On']]} />
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
