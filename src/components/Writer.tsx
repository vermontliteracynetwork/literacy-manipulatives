import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MONTESSORI_WORD_CLASS_INFO, type MontessoriWordClass } from '../lib/montessoriGrammar';
import { completionsFor, confidentFix, isWord, loadWords, suggestFor, wordsReady } from '../lib/writer/spell';
import { checkLabels, checkSentence, splitSentences, tagForCheck, type CheckResult, type SentenceSpan } from '../lib/writer/sentenceCheck';
import { readStudentTools, saveStudentTools, type StudentTools, type WriterSettings } from '../lib/writer/settings';

// The Writer (teacher, 2026-10-27): a word processor separate from the whiteboard, in an environment the
// teacher sets: spell check level, predictive text, auto-capitalization, her grammar symbols above or below the
// words, and her Sentence Check with the formulas from her Symbolic Grammar curriculum. Writing helpers like
// Grammarly are switched off here.

const DOC_KEY = 'lm-writer-doc';
const readDoc = () => { try { return sessionStorage.getItem(DOC_KEY) ?? ''; } catch { return ''; } };
// The support record kept with the draft (Claudia's research: every sample notes the supports used, so
// supported and unsupported writing are compared fairly, as her Program Overview requires).
type SupportRecord = Record<'predictions' | 'autoFixes' | 'autoCaps' | 'spellingFixes' | 'sentenceFixes' | 'readAlouds' | 'echoes', number>;
const EMPTY_RECORD: SupportRecord = { predictions: 0, autoFixes: 0, autoCaps: 0, spellingFixes: 0, sentenceFixes: 0, readAlouds: 0, echoes: 0 };
const REC_KEY = 'lm-writer-record';
const readRecord = (): SupportRecord => { try { return { ...EMPTY_RECORD, ...JSON.parse(sessionStorage.getItem(REC_KEY) ?? '{}') }; } catch { return EMPTY_RECORD; } };
const SPACING = { normal: { ls: '0.01em', ws: '0em', extra: 0 }, wide: { ls: '0.06em', ws: '0.18em', extra: 8 }, wider: { ls: '0.12em', ws: '0.36em', extra: 16 } } as const;
const speechOK = typeof window !== 'undefined' && 'speechSynthesis' in window;

const SYMBOL_PX = { small: 20, medium: 32, large: 56 } as const;
const FONT_PX = { small: 22, medium: 22, large: 26 } as const;
const CODE_CLASS: Record<string, MontessoriWordClass> = { A: 'article', N: 'noun', PN: 'propernoun', P: 'pronoun', V: 'verb', Adj: 'adjective', Adv: 'adverb', Pr: 'preposition', C: 'conjunction', I: 'interjection' };

const WORD_RE = /[A-Za-z']+/g;
const lastWordBefore = (text: string, pos: number) => text.slice(0, pos).match(/([A-Za-z']+)[^A-Za-z']*$/)?.[1];
const wordsAfter = (text: string, pos: number) => (text.slice(pos).match(WORD_RE) ?? []).slice(0, 2);
const startsSentenceAt = (text: string, pos: number) => /(^|[.!?]["'”’)]*\s+|\n\s*)$/.test(text.slice(0, pos)) || text.slice(0, pos).trim() === '';
const capFirst = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

function Check({ ok }: { ok: boolean }) {
  return (
    <span className={`lm-check-box${ok ? ' ok' : ''}`} aria-hidden="true">
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

export function Writer({ settings, canChangeSettings, onSettings, onBack, studentName, headerExtras }: {
  settings: WriterSettings; canChangeSettings: boolean; onSettings: (s: WriterSettings) => void; onBack?: () => void; studentName?: string; headerExtras?: ReactNode;
}) {
  const [text, setText] = useState(readDoc);
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [, setReady] = useState(wordsReady());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [undo, setUndo] = useState<{ start: number; from: string; to: string } | null>(null);
  const [popup, setPopup] = useState<{ start: number; word: string; options: string[]; left: number; top: number } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<{ start: number; end: number } | null>(null);
  const [mine, setMineState] = useState<StudentTools>(readStudentTools);
  const setMine = (patch: StudentTools) => setMineState((m) => { const next = { ...m, ...patch }; saveStudentTools(next); return next; });
  const [record, setRecord] = useState<SupportRecord>(readRecord);
  const bump = (k: keyof SupportRecord) => setRecord((r) => ({ ...r, [k]: r[k] + 1 }));
  useEffect(() => { try { sessionStorage.setItem(REC_KEY, JSON.stringify(record)); } catch { /* not saved */ } }, [record]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [speaking, setSpeaking] = useState<{ start: number; end: number } | null>(null);
  const caretMark = useRef<HTMLSpanElement>(null);
  const [focusLine, setFocusLine] = useState<number | null>(null);

  // What's actually on: teacher-set tools follow the teacher ('choice' lets the student decide); look-and-feel
  // tools follow the student's pick, starting from the teacher's default.
  const readAloudOn = speechOK && (settings.readAloud === 'on' || (settings.readAloud === 'choice' && !!mine.readAloud));
  const echo = !speechOK ? 'off' : settings.typingEcho === 'choice' ? (mine.typingEcho ?? 'off') : settings.typingEcho;
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
  useEffect(() => { try { sessionStorage.setItem(DOC_KEY, text); } catch { /* not saved */ } }, [text]);
  useEffect(() => { if (!undo) return; const t = window.setTimeout(() => setUndo(null), 6000); return () => window.clearTimeout(t); }, [undo]);

  // Keep the text area as tall as its text, and put the cursor back after a word was changed for the student.
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(ta.scrollHeight, 320)}px`;
    if (pendingCaret.current) { ta.setSelectionRange(pendingCaret.current.start, pendingCaret.current.end); pendingCaret.current = null; }
  });

  const sym = settings.symbols === 'off' ? 0 : SYMBOL_PX[settings.symbolSize];
  const fontPx = settings.symbols === 'off' ? 22 : FONT_PX[settings.symbolSize];
  const lineHeight = (sym ? Math.round(fontPx * 1.2 + 2 * (sym + 8)) : Math.round(fontPx * 1.7)) + SPACING[spacing].extra;
  const pageStyle = { '--wr-font': `${fontPx}px`, '--wr-line': `${lineHeight}px`, '--wr-sym': `${sym}px`, '--wr-ls': SPACING[spacing].ls, '--wr-ws': SPACING[spacing].ws } as CSSProperties;

  // Line focus: find the line the cursor is on, from a marker in the mirror.
  useLayoutEffect(() => {
    if (!lineFocusOn) { if (focusLine !== null) setFocusLine(null); return; }
    const mk = caretMark.current, page = pageRef.current;
    if (!mk || !page) return;
    const pad = 20;
    const y = mk.getBoundingClientRect().top + mk.getBoundingClientRect().height / 2 - page.getBoundingClientRect().top;
    const line = Math.max(0, Math.floor((y - pad) / lineHeight));
    if (line !== focusLine) setFocusLine(line);
  });

  // Sentences, their checks, and each word's symbol.
  const sentences = useMemo(() => splitSentences(text), [text]);
  const checks = useMemo(() => new Map<SentenceSpan, CheckResult>(sentences.map((s) => [s, checkSentence(s)])), [sentences]);
  const wordClasses = useMemo(() => sentences.flatMap((s) => tagForCheck(s.text).map((w) => w.wordClass)), [sentences]);
  const labels = checkLabels(settings.level);

  // When a sentence is checked: at its end mark, or as the student types (except the end mark of the sentence
  // being typed, which isn't finished yet).
  const caretSentence = sentences.find((s) => caret >= s.start && caret <= s.end + 1);
  const shown = (s: SentenceSpan) => settings.grammar === 'live' || (settings.grammar === 'end' && s.ended);
  const problems = (s: SentenceSpan, r: CheckResult) => {
    const endMarkMissing = !r.endMark && !(settings.grammar === 'live' && s === caretSentence && focused);
    return { complete: !r.complete, capital: !r.capital, endMark: endMarkMissing, match: !r.match.ok, time: !r.time };
  };
  const flagged = settings.grammar === 'off' ? [] : sentences.filter((s) => shown(s) && Object.values(problems(s, checks.get(s)!)).some(Boolean));

  // The word being typed right now (cursor at its end), which isn't marked until it's finished.
  const typingWordStart = (() => {
    if (!focused) return -1;
    const m = text.slice(0, caret).match(/[A-Za-z']+$/);
    return m && !/[A-Za-z']/.test(text[caret] ?? '') ? caret - m[0].length : -1;
  })();
  const misspelled = (word: string, start: number) => {
    if (settings.spell === 'off' || !wordsReady() || start === typingWordStart) return false;
    if (/^[A-Z]/.test(word) && !startsSentenceAt(text, start)) return false; // a name
    return !isWord(word);
  };

  // The mirror under the text: the same words, with symbols and markings.
  const mirror: ReactNode[] = [];
  {
    let wi = 0;
    const re = /[A-Za-z']+|[^A-Za-z']+/g;
    let m: RegExpExecArray | null;
    let markPlaced = false;
    const mark = () => { markPlaced = true; return <span key="caret-mark" ref={caretMark} className="lm-writer-caret-mark" />; };
    while ((m = re.exec(text))) {
      const tok = m[0];
      const start = m.index;
      if (!/^[A-Za-z']/.test(tok)) {
        if (!markPlaced && caret >= start && caret <= start + tok.length) { mirror.push(tok.slice(0, caret - start), mark(), tok.slice(caret - start)); continue; }
        mirror.push(tok);
        continue;
      }
      if (!markPlaced && caret === start) mirror.push(mark());
      const cls = wordClasses[wi++];
      const info = cls ? MONTESSORI_WORD_CLASS_INFO[cls] : undefined;
      const bad = misspelled(tok, start);
      const gram = !bad && flagged.some((s) => start >= s.start && start < s.end);
      mirror.push(
        <span key={start} className={`w${bad ? ' bad' : ''}${gram ? ' gram' : ''}${speaking && start === speaking.start ? ' speaking' : ''}`} data-start={start}>
          {tok}
          {sym > 0 && info && <img className={`lm-writer-sym ${settings.symbols}`} src={info.imageUrl} alt="" draggable={false} />}
        </span>,
      );
    }
    if (!markPlaced) mirror.push(mark());
    mirror.push('\u200b');
  }

  // Replace text and put the cursor (or a selection) where it belongs.
  const replaceRange = (start: number, end: number, insert: string, select?: [number, number]) => {
    setText((t) => t.slice(0, start) + insert + t.slice(end));
    pendingCaret.current = select ? { start: select[0], end: select[1] } : { start: start + insert.length, end: start + insert.length };
    taRef.current?.focus();
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let v = e.target.value;
    let pos = e.target.selectionStart;
    const typed = v.length === text.length + 1 ? v[pos - 1] : '';
    // A word was just finished (space or punctuation after it): fix it if the teacher allows, then capitals.
    if (typed && /[\s.,!?;:]/.test(typed)) {
      const before = v.slice(0, pos - 1);
      const m = before.match(/([A-Za-z']+)$/);
      if (m) {
        const ws = pos - 1 - m[1].length;
        const word = m[1];
        let next = word;
        if (settings.predict === 'auto') {
          const fix = confidentFix(word, lastWordBefore(v, ws), wordsAfter(v, pos));
          if (fix && fix !== word) { next = fix; setUndo({ start: ws, from: word, to: fix }); bump('autoFixes'); }
        }
        if (settings.autoCap) {
          const before = next;
          if (/^i(['’].*)?$/.test(next)) next = 'I' + next.slice(1);
          if (startsSentenceAt(v, ws)) next = capFirst(next);
          if (next !== before) bump('autoCaps');
        }
        if (echo === 'words') speakNow(next);
        if (next !== word) { v = v.slice(0, ws) + next + v.slice(ws + word.length); pos += next.length - word.length; pendingCaret.current = { start: pos, end: pos }; }
      }
    }
    // Typing echo for a whole sentence once its end mark goes in.
    if (typed && /[.!?]/.test(typed) && (echo === 'sentences' || echo === 'words')) {
      const sentence = v.slice(0, pos).match(/[^.!?\n]*[.!?]$/)?.[0];
      if (sentence && echo === 'sentences') speakNow(sentence);
    }
    setPopup(null);
    setText(v);
    setCaret(pos);
  };

  // Suggestions above the page (Predictive text: Suggest): finish the word being typed, or fix the one before.
  const suggestions = (() => {
    if (settings.predict !== 'suggest' || !wordsReady()) return null;
    const m = text.slice(0, caret).match(/([A-Za-z']+)$/);
    if (m && !/[A-Za-z']/.test(text[caret] ?? '')) {
      const start = caret - m[1].length;
      const prev = lastWordBefore(text, start);
      const fixes = isWord(m[1]) ? [] : suggestFor(m[1], prev, 2);
      const words = [...new Set([...fixes, ...completionsFor(m[1], prev, 3)])].slice(0, 4);
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

  // Spell check "Mark and suggest": tapping a marked word lists what it might be.
  const openSpellPopup = () => {
    if (settings.spell !== 'suggest') return;
    const ta = taRef.current;
    if (!ta) return;
    const at = ta.selectionStart;
    const re = /[A-Za-z']+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (at >= m.index && at <= m.index + m[0].length) {
        if (!misspelled(m[0], m.index) || m.index === typingWordStart) { setPopup(null); return; }
        const el = mirrorRef.current?.querySelector(`[data-start="${m.index}"]`);
        const page = pageRef.current?.getBoundingClientRect();
        const r = el?.getBoundingClientRect();
        if (!r || !page) return;
        const options = suggestFor(m[0], lastWordBefore(text, m.index), 4, wordsAfter(text, m.index + m[0].length));
        setPopup({ start: m.index, word: m[0], options, left: r.left - page.left, top: r.bottom - page.top + 4 });
        return;
      }
    }
    setPopup(null);
  };

  const syncCaret = () => { const ta = taRef.current; if (ta) setCaret(ta.selectionStart); };
  const wordCount = (text.match(WORD_RE) ?? []).length;
  const blockAttrs = settings.blockAddons
    ? { 'data-gramm': 'false', 'data-gramm_editor': 'false', 'data-enable-grammarly': 'false', 'data-lt-active': 'false', 'data-ms-editor': 'false' }
    : {};

  const update = (patch: Partial<WriterSettings>) => onSettings({ ...settings, ...patch });
  // A draft is "supported" when tools that shape what the student writes were on or were used.
  const supportsOn = [
    settings.spell !== 'off' && 'spell check', settings.predict !== 'off' && 'predictive text', settings.autoCap && 'auto-capitals',
    settings.grammar !== 'off' && 'Sentence Check', settings.symbols !== 'off' && 'grammar symbols', readAloudOn && 'read aloud', echo !== 'off' && 'typing echo',
  ].filter(Boolean) as string[];
  const used = Object.values(record).some((n) => n > 0);
  const supported = supportsOn.length > 0 || used;
  const caretSentenceSpan = sentences.find((sp) => caret >= sp.start && caret <= sp.end + 1);
  const newDraft = () => {
    if (text.trim() && !window.confirm('Start a new draft? This writing will be cleared from this screen.')) return;
    setText(''); setRecord(EMPTY_RECORD); setUndo(null); setPopup(null);
  };

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
        <button type="button" className={`btn btn-sm${toolsOpen ? ' btn-primary' : ''}`} onClick={() => setToolsOpen((o) => !o)}>My tools</button>
        <button type="button" className="btn btn-sm" onClick={newDraft}>New draft</button>
        {headerExtras}
        <button type="button" className={`btn btn-sm${settingsOpen ? ' btn-primary' : ''}`} onClick={() => setSettingsOpen((o) => !o)}>
          {canChangeSettings ? 'Writing settings' : 'Settings (set by your teacher)'}
        </button>
      </header>

      <div className="lm-writer-body">
        <main className="lm-writer-main">
          <div className={`lm-writer-suggest${focusModeOn && !suggestions && !undo ? ' quiet' : ''}`} aria-live="polite">
            {suggestions ? (
              <>
                <span className="lm-writer-suggest-label">Did you mean</span>
                {suggestions.words.map((w, i) => (
                  <button key={w} type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => acceptSuggestion(w)}>
                    {w}{i === 0 && <kbd>Tab</kbd>}
                  </button>
                ))}
              </>
            ) : undo ? (
              <>
                <span className="lm-writer-suggest-label">Changed <strong>{undo.from}</strong> to <strong>{undo.to}</strong></span>
                <button type="button" className="lm-tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => {
                  if (text.slice(undo.start, undo.start + undo.to.length) === undo.to) replaceRange(undo.start, undo.start + undo.to.length, undo.from, [undo.start + undo.from.length, undo.start + undo.from.length]);
                  setUndo(null);
                }}>Undo</button>
              </>
            ) : (
              <span className="lm-writer-suggest-label muted">{wordsReady() ? 'Start writing. Your words show here with their symbols.' : 'Getting the word list ready...'}</span>
            )}
          </div>
          <div className={`lm-writer-page${sym ? ` sym-${settings.symbols}` : ''}`} ref={pageRef} style={pageStyle}>
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
              placeholder="Write here..."
              aria-label="Your writing"
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
        </main>

        {settings.grammar !== 'off' && !(focusModeOn && flagged.length === 0) && (
          <aside className="lm-writer-check" aria-label="Sentence Check">
            <h2>Sentence Check</h2>
            {flagged.length === 0 && (
              <p className="muted">{sentences.length ? 'Every checked sentence has all five parts.' : 'Each sentence gets checked for five things: complete, capital, end mark, match and time.'}</p>
            )}
            {flagged.map((s) => {
              const r = checks.get(s)!;
              const p = problems(s, r);
              const wordsInS = [...s.text.matchAll(WORD_RE)];
              const insertMissing = () => {
                const target = wordsInS[r.insertAt];
                const at = target ? s.start + (target.index ?? 0) : s.start + s.text.replace(/[.!?"'”’)]+$/, '').length;
                const blank = '___';
                const insert = target ? `${blank} ` : ` ${blank}`;
                const startSel = target ? at : at + 1;
                replaceRange(at, at, insert, [startSel, startSel + blank.length]);
                bump('sentenceFixes');
              };
              const formulaClasses = r.formula ? r.formula.code.split(/[-,;:·“”"!?\s]+/).filter(Boolean).map((c) => CODE_CLASS[c]).filter(Boolean) : [];
              return (
                <div key={s.start} className="lm-writer-check-card">
                  <p className="lm-writer-check-text">"{s.text}"</p>
                  <ul className="lm-checklist">
                    <li className={p.complete ? '' : 'done'}><Check ok={!p.complete} />{labels.complete}</li>
                    <li className={p.capital ? '' : 'done'}><Check ok={!p.capital} />{labels.capital}</li>
                    <li className={p.endMark ? '' : 'done'}><Check ok={!p.endMark} />{labels.endMark}</li>
                    <li className={p.match ? '' : 'done'}><Check ok={!p.match} />{labels.match}</li>
                    <li className={p.time ? '' : 'done'}><Check ok={!p.time} />{labels.time}</li>
                  </ul>
                  <div className="lm-writer-fixes">
                    {r.missing && <button type="button" className="lm-tool-btn" onClick={insertMissing}>Add {r.missing === 'who' ? labels.who : labels.action}</button>}
                    {p.capital && <button type="button" className="lm-tool-btn" onClick={() => {
                      const i = s.text.search(/[a-z]/);
                      let fixed = s.text.replace(/\bi\b/g, 'I');
                      if (i >= 0 && !/[A-Z]/.test(s.text.slice(0, i))) fixed = fixed.slice(0, i) + fixed[i].toUpperCase() + fixed.slice(i + 1);
                      replaceRange(s.start, s.end, fixed, [s.end, s.end]);
                      bump('sentenceFixes');
                    }}>Fix capitals</button>}
                    {p.endMark && <button type="button" className="lm-tool-btn" onClick={() => { replaceRange(s.end, s.end, '.'); bump('sentenceFixes'); }}>Add an end mark</button>}
                    {p.match && r.match.from && r.match.to && (
                      <button type="button" className="lm-tool-btn" onClick={() => {
                        const w = wordsInS[r.match.index!];
                        const at = s.start + (w.index ?? 0);
                        replaceRange(at, at + r.match.from!.length, r.match.to!, [s.end, s.end]);
                        bump('sentenceFixes');
                      }}>Change {r.match.from} to {r.match.to}</button>
                    )}
                    {p.time && <span className="muted">Keep the Actions in the same time: past, present or future.</span>}
                  </div>
                  {r.formula && (
                    <div className="lm-writer-formula">
                      <span className="lm-writer-formula-name">{r.exact ? 'Formula' : 'Try this formula'}: {r.formula.name}{settings.level !== 'A' ? ` (${r.formula.code})` : ''}</span>
                      <span className="lm-writer-formula-symbols">
                        {formulaClasses.map((c, i) => <img key={i} src={MONTESSORI_WORD_CLASS_INFO[c].imageUrl} alt={MONTESSORI_WORD_CLASS_INFO[c].name} title={MONTESSORI_WORD_CLASS_INFO[c].name} />)}
                      </span>
                      <span className="muted">Model: {r.formula.sentence}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </aside>
        )}
      </div>

      {toolsOpen && (
        <div className="lm-writer-settings" role="dialog" aria-label="My tools">
          <div className="space-between" style={{ marginBottom: 8 }}>
            <strong>My tools</strong>
            <button type="button" className="lm-float-x" onClick={() => setToolsOpen(false)} aria-label="Close my tools">×</button>
          </div>
          {settings.readAloud === 'choice' && speechOK && <Choice label="Read aloud" value={mine.readAloud ? 'on' : 'off'} disabled={false} onChange={(v) => setMine({ readAloud: v === 'on' })} options={[['off', 'Off'], ['on', 'On']]} />}
          {(readAloudOn || echo !== 'off') && <Choice label="Reading speed" value={String(rate)} disabled={false} onChange={(v) => setMine({ rate: Number(v) })} options={[['0.7', 'Slow'], ['0.9', 'Medium'], ['1.1', 'Fast']]} />}
          {settings.typingEcho === 'choice' && speechOK && <Choice label="Say my words back" value={mine.typingEcho ?? 'off'} disabled={false} onChange={(v) => setMine({ typingEcho: v })} options={[['off', 'Off'], ['words', 'Each word'], ['sentences', 'Each sentence']]} />}
          <Choice label="Spacing" value={spacing} disabled={false} onChange={(v) => setMine({ spacing: v })} options={[['normal', 'Normal'], ['wide', 'Wide'], ['wider', 'Wider']]} />
          <Choice label="Line focus" value={lineFocusOn ? 'on' : 'off'} disabled={false} onChange={(v) => setMine({ lineFocus: v === 'on' })} options={[['off', 'Off'], ['on', 'On']]} />
          <Choice label="Colors" value={theme} disabled={false} onChange={(v) => setMine({ theme: v })} options={[['default', 'Standard'], ['high', 'High contrast'], ['dark', 'Dark'], ['cream', 'Cream']]} />
          <Choice label="Focus mode" value={focusModeOn ? 'on' : 'off'} disabled={false} onChange={(v) => setMine({ focusMode: v === 'on' })} options={[['off', 'Off'], ['on', 'On']]} />
          <p className="muted" style={{ margin: '8px 0 0' }}>These change how the page looks or sounds, not your writing.</p>
        </div>
      )}
      {settingsOpen && (
        <div className="lm-writer-settings" role="dialog" aria-label="Writing settings">
          <div className="space-between" style={{ marginBottom: 8 }}>
            <strong>Writing settings</strong>
            <button type="button" className="lm-float-x" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
          </div>
          {!canChangeSettings && <p className="muted" style={{ margin: '0 0 8px' }}>Your teacher chose these.</p>}
          <Choice label="Spell check" value={settings.spell} disabled={!canChangeSettings} onChange={(v) => update({ spell: v })} options={[['off', 'Off'], ['mark', 'Mark mistakes'], ['suggest', 'Mark and suggest']]} />
          <Choice label="Predictive text" value={settings.predict} disabled={!canChangeSettings} onChange={(v) => update({ predict: v })} options={[['off', 'Off'], ['suggest', 'Suggest'], ['auto', 'Fix automatically']]} />
          <Choice label="Auto-capitalization" value={settings.autoCap ? 'on' : 'off'} disabled={!canChangeSettings} onChange={(v) => update({ autoCap: v === 'on' })} options={[['on', 'On'], ['off', 'Off']]} />
          <Choice label="Sentence Check" value={settings.grammar} disabled={!canChangeSettings} onChange={(v) => update({ grammar: v })} options={[['off', 'Off'], ['end', 'At end marks'], ['live', 'As they type']]} />
          <Choice label="Grammar symbols" value={settings.symbols} disabled={!canChangeSettings} onChange={(v) => update({ symbols: v })} options={[['off', 'Off'], ['above', 'Above words'], ['below', 'Below words']]} />
          <Choice label="Symbol size" value={settings.symbolSize} disabled={!canChangeSettings} onChange={(v) => update({ symbolSize: v })} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} />
          <Choice label="Level" value={settings.level} disabled={!canChangeSettings} onChange={(v) => update({ level: v })} options={[['A', 'A (student words)'], ['B', 'B (both)'], ['C', 'C (grammar terms)']]} />
          <Choice label="Block writing add-ons (Grammarly and others)" value={settings.blockAddons ? 'on' : 'off'} disabled={!canChangeSettings} onChange={(v) => update({ blockAddons: v === 'on' })} options={[['on', 'Blocked'], ['off', 'Allowed']]} />
          <h3 className="lm-writer-settings-h">Accessibility</h3>
          <p className="muted" style={{ margin: '0 0 4px' }}>"Student choice" puts the tool in the student's My tools. Spacing, line focus, colors and focus mode are always the student's choice; you set where they start.</p>
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
            <li>Words fixed automatically: {record.autoFixes}</li>
            <li>Capitals added automatically: {record.autoCaps}</li>
            <li>Spelling suggestions used: {record.spellingFixes}</li>
            <li>Sentence Check fixes used: {record.sentenceFixes}</li>
            <li>Read alouds: {record.readAlouds} · Words or sentences said back: {record.echoes}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
