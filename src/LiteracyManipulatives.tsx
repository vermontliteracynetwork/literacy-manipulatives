import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSyncedTTS, SyncedSpeakButton, HighlightedText, type SyncedTTS } from './components/SyncedSpeakButton';
import { ReferencePopover } from './components/ReferencePopover';
import { SANDBOX_PIECES } from './lib/grammarContent';
import { MORPHEME_ROOTS, MORPHEME_PREFIXES, MORPHEME_SUFFIXES, MORPHEME_AFFIXES, MORPHEME_COMBOS, detectJoinRule, JOIN_RULE_NOTES } from './lib/morphemeContent';
import { MONTESSORI_WORD_CLASS_INFO, type MontessoriWordClass, PROPER_NOUNS } from './lib/montessoriGrammar';
import { SYMBOL_SENTENCE_PAGES, ALL_SYMBOL_SENTENCES, type SymbolSentence } from './lib/symbolSentences';
import { PUNCTUATION_MARKS } from './lib/punctuationContent';
import { WORD_CHAINS } from './lib/wordChainContent';
import { HEART_WORDS } from './lib/heartWordContent';
import { SPELLING_RULES } from './lib/spellingRuleContent';
import { WRITING_FRAMES, SENTENCE_STARTERS } from './lib/writingScaffoldContent';
import {
  LM_PUNCTUATION_COLOR, LM_PUNCTUATION_TEXT_COLOR, LM_PHONO_COLOR, LM_HEART_COLOR,
  LM_WORD_CHAIN_COLOR, LM_SPELLING_RULE_COLOR, LM_DICTATION_COLOR, LM_WRITING_SCAFFOLD_COLOR,
} from './lib/literacyDesignTokens';
import { playListeningStartChime, playListeningStopChime } from './lib/audioCues';
import {
  SENTENCE_FORMULAS, FORMULA_CATEGORIES, WHO_WORDS, SLOT_MONTESSORI_CLASS, SLOT_LABELS,
  wordBankFor, actionWordsForTense, auxWordFor, retenseActionWord, TENSE_LABELS,
  type FormulaCategory, type FormulaTense,
} from './lib/sentenceFormulas';
import { GRAMMAR_WORD_CLASS_COLORS, GRAMMAR_WORD_CLASS_TEXT_COLORS } from './types';
import type { GrammarPiece, TTSSettings } from './types';

// Literacy Manipulatives — rebuilt per direct teacher redesign (2026-09-22),
// replacing the previous mode-switching build entirely: "the design...
// is too scripted, too prompted. it should really just be a drag and
// drop... an interactive whiteboard to explore all the tools... entirely
// unscripted and not aligned with a curriculum... this is open play,
// dont build the activity component until all design, features,
// navigation, and tools in literacy manipulatives is developed
// completely." Every earlier scripted mode (Mad Libs, Sentence
// Formulas, the Montessori decision-tree Sentence Builder, Sound Boxes/
// Blending Board tied to one target word, Word Sorts' fixed buckets,
// Morpheme Web's tap-to-attach validator) is gone from THIS screen —
// their content modules (sentenceFormulas.ts, soundContent.ts,
// montessoriGrammar.ts's GRAMMAR_STATES, morphemeContent.ts's
// MORPHEME_COMBOS) stay in the repo untouched for the future
// teacher-authored Activity mode, which is explicitly not being built
// yet.
//
// This is now ONE shared canvas plus a left-side material palette
// (nav moved off the old top bar, direct instruction: "the bar across
// the top should move to the left hand side"), Polypad/GeoGebra-style:
// every material (word tiles, blank Montessori grammar shapes, morpheme
// pieces, letters, sound-box frames) drags from the sidebar onto the
// canvas and can be freely repositioned, mixed, and combined, with no
// fixed target/correct-answer/completion state anywhere. The one
// surviving "smart" behavior is the noun+verb number-agreement snap —
// a structural grammar rule applied to any two words regardless of
// content (like real magnetic tiles), not a curriculum target, and it
// predates and survived every design review this sandbox has had.
const TILE_W = 120;
const TILE_H = 58;
const SNAP_GAP = 14;
const SNAP_THRESHOLD = 160;
const HISTORY_LIMIT = 20;

// Speech-to-text for the Text Box tool — direct teacher instruction
// ("SST option" on the new typeable fields). The browser's own Web
// Speech API, feature-detected once at module scope, same pattern this
// project used before speech-to-text was removed app-wide (2026-09-22,
// "remove STT, but allow TTS for the items or things highlighted by
// the student" — that removal was about ArticleReader specifically;
// this is a new, separate, explicit request for this one tool).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionCtor: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition : null;
const voiceToTextSupported = !!SpeechRecognitionCtor;

function useTextBoxVoiceToText(onFinalText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const onFinalTextRef = useRef(onFinalText);
  onFinalTextRef.current = onFinalText;

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  // A23-ROADMAP Phase 2: "STT listening cue (chime/TTS + visual state)."
  // The visual state (listening ? ... : ...) already existed at every
  // call site of this hook; this adds the paired audio chime so a
  // student who isn't looking at the button still gets a cue that
  // listening actually started/stopped, a real accessibility gap for a
  // population that benefits from more than one sensory channel per cue.
  const toggle = () => {
    if (listening) { stop(); playListeningStopChime(); return; }
    if (!SpeechRecognitionCtor) return;
    const rec = new SpeechRecognitionCtor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let added = '';
      for (let i = e.resultIndex; i < e.results.length; i++) added += e.results[i][0].transcript;
      if (added.trim()) onFinalTextRef.current(added.trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
    playListeningStartChime();
  };

  return { listening, toggle, supported: voiceToTextSupported };
}

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const FRAME_SIZES = [2, 3, 4, 5];

// Grapheme tiles — direct teacher instruction, replacing the earlier
// Sound-Wall-derived categories with her own hand-specified scope and
// sequence: "sort graphemes in these categories: Consonant Structures,
// VCe, Ending patterns, r-controlled vowels, Long Vowels and
// Diphthongs, advanced and alternative." Content is ordinary, real
// English spelling patterns (not a specialized/copyrighted curriculum
// standard). A few spellings (ar, ea, ew, ue, ou, ey...) legitimately
// appear in more than one category, since the same letters can spell
// more than one sound depending on the word — kept exactly as she
// listed them rather than deduplicated across categories.
const GRAPHEME_GROUPS: { key: string; label: string; graphemes: string[] }[] = [
  { key: 'consonant-structures', label: 'Consonant Structures', graphemes: ['sh', 'th', 'ch', 'wh', 'ph', 'ng', 'nk'] },
  { key: 'vce', label: 'VCe', graphemes: ['a_e', 'i_e', 'o_e', 'e_e', 'u_e', '-ce', '-ge'] },
  { key: 'ending-patterns', label: 'Ending Patterns', graphemes: ['y', 'tch', '-le', 'dge', 'ild', 'ind', 'old', 'olt', 'ost'] },
  { key: 'r-controlled', label: 'R-Controlled Vowels', graphemes: ['ar', 'or', 'ore', 'er', 'ir', 'ur'] },
  { key: 'long-vowels-diphthongs', label: 'Long Vowels & Diphthongs', graphemes: ['ai', 'ay', 'ee', 'ea', 'ey', 'ie', 'igh', 'oa', 'ow', 'oe', 'oo', 'ew', 'ui', 'ue', 'oi', 'oy', 'ou', 'au', 'aw', 'augh'] },
  { key: 'advanced', label: 'Advanced & Alternative', graphemes: ['kn', 'wr', 'mb', '-ar', '-or', 'air', 'are', 'ear', 'eer', 'ei', 'eight', 'aigh', 'eu', 'ough', 'ch'] },
];

// Ordinary, well-documented affix meanings — used to compose a plain
// definition when a morpheme piece connects to a real word (see
// AFFIX_MEANINGS usage below). Not a specialized curriculum standard.
// Reverse Morphology prompt words — A23-ROADMAP Phase 3 ("reverse
// morphology mode under Morphemes"): derived directly from
// MORPHEME_COMBOS's own real resulting words (not a separate hand-typed
// list), so a prompt card can never name a word the jigsaw pieces
// themselves couldn't actually build.
const REVERSE_MORPH_WORDS = Array.from(new Set(Object.values(MORPHEME_COMBOS))).sort((a, b) => a.localeCompare(b));

const AFFIX_MEANINGS: Record<string, string> = {
  'un-': 'not, or the opposite of', 're-': 'again', 'dis-': 'not, or the opposite of',
  '-ed': 'happened in the past', '-ing': 'happening right now', '-ful': 'full of', '-less': 'without',
};

// Always-available baseline colors — direct teacher instruction: "grabbing
// purchased/earned/inventory markers of students in addition to regular."
// A student with nothing purchased yet still has real colors to draw
// with; owned Marketplace colors are appended after these.
const BASE_PEN_COLORS = ['#1f1147', '#dc2626', '#2563eb', '#16a34a', '#f97316', '#7c3aed'];
const BASE_HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4'];

type PlacedKind = 'grammar' | 'shape' | 'letter' | 'frame' | 'morpheme' | 'sentenceFrame' | 'textbox' | 'symbolSentence' | 'punctuation' | 'soundChip' | 'divider' | 'syllableTapper' | 'heartWord' | 'spellingRule' | 'dictation' | 'wordMatrix' | 'reverseMorphPrompt' | 'writingFrame';

interface PlacedItem {
  instanceId: string;
  kind: PlacedKind;
  x: number;
  y: number;
  pieceId?: string; // grammar
  wordClass?: MontessoriWordClass; // shape
  letter?: string; // letter
  boxCount?: number; // frame; also reused for symbolSentence's word count (sizing only)
  morphText?: string; // morpheme
  morphType?: 'root' | 'prefix' | 'suffix'; // morpheme
  morphId?: string; // morpheme — original MORPHEME_ROOTS/PREFIXES/SUFFIXES id, for MORPHEME_COMBOS lookup
  formulaId?: string; // sentenceFrame
  frameFills?: Record<number, string>; // sentenceFrame
  tense?: FormulaTense; // sentenceFrame
  joinedToId?: string; // sentenceFrame — instanceId of the card this one is stacked directly beneath, forming a paragraph chain
  textValue?: string; // textbox
  fontSize?: number; // textbox
  symbolSentenceId?: string; // symbolSentence — id into ALL_SYMBOL_SENTENCES
  wordFills?: Record<number, string>; // symbolSentence — optional typed word per symbol, from its settings popup
  punctId?: string; // punctuation — id into PUNCTUATION_MARKS
  tapCount?: number; // syllableTapper — how many claps the student has tapped so far
  heartWordId?: string; // heartWord — id into HEART_WORDS
  heartIndices?: number[]; // heartWord — which letter positions the student marked as "heart" (tricky) letters
  ruleId?: string; // spellingRule — id into SPELLING_RULES
  dictationPrompt?: string; // dictation — the word the student is writing from dictation, chosen manually (never randomized, see DictationWidget)
  matrixRootId?: string; // wordMatrix — which MORPHEME_ROOTS entry this matrix is currently showing
  reverseMorphWord?: string; // reverseMorphPrompt — the real word the student is asked to build from pieces
  writingFrameId?: string; // writingFrame — id into WRITING_FRAMES (fills reuse the existing frameFills field, same shape as sentenceFrame)
}

const pieceById = (id: string): GrammarPiece | undefined => SANDBOX_PIECES.find((p) => p.id === id);

function sizeFor(kind: PlacedKind, boxCount?: number): { w: number; h: number } {
  if (kind === 'grammar') return { w: TILE_W, h: TILE_H };
  if (kind === 'morpheme') return { w: 96, h: 64 };
  if (kind === 'frame') { const n = boxCount ?? 3; return { w: n * 44 + (n - 1) * 4, h: 44 }; }
  if (kind === 'textbox') return { w: 160, h: 56 };
  if (kind === 'shape') return { w: 96, h: 96 };
  if (kind === 'symbolSentence') { const n = boxCount ?? 3; return { w: n * 48 + (n - 1) * 4, h: 56 }; }
  if (kind === 'soundChip') return { w: 36, h: 36 };
  if (kind === 'divider') return { w: 10, h: 70 };
  if (kind === 'syllableTapper') return { w: 220, h: 110 };
  if (kind === 'heartWord') { const n = boxCount ?? 4; return { w: n * 30, h: 40 }; }
  if (kind === 'spellingRule') return { w: 140, h: 44 };
  if (kind === 'dictation') return { w: 220, h: 150 };
  if (kind === 'wordMatrix') return { w: 260, h: 200 };
  if (kind === 'reverseMorphPrompt') return { w: 220, h: 70 };
  if (kind === 'writingFrame') return { w: 280, h: 220 };
  return { w: 44, h: 44 }; // letter, sentenceFrame
}

// Jigsaw-piece morpheme silhouette — direct teacher follow-up
// instruction: "make puzzle pieces only have left and right notches
// (not top or bottom)" (removing the earlier top-knob restyle). Purely
// decorative on its own (no attach validation, per the "entirely
// unscripted" redesign): root pieces show both a tab and a notch, a
// prefix only its right-side tab, a suffix only its left-side notch,
// so the interlocking affordance still reads visually even though
// nothing checks whether a combination is a real word anymore.
function PuzzlePiece({ text, color, textColor = '#fff', hasNotch, hasTab }: {
  text: string; color: string; textColor?: string; hasNotch: boolean; hasTab: boolean;
}) {
  const w = 96;
  const h = 64;
  const r = 9;
  const cy = h / 2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <rect x="3" y="3" width={w - 6} height={h - 6} rx="8" fill={color} stroke="var(--ink)" strokeWidth="3" />
      {hasTab && <circle cx={w - 3} cy={cy} r={r} fill={color} stroke="var(--ink)" strokeWidth="3" />}
      {hasNotch && <circle cx="3" cy={cy} r={r - 1} fill="var(--paper, #fdfdfb)" stroke="var(--ink)" strokeWidth="3" />}
      <text x={w / 2} y={cy + 6} textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={800} fontSize="14" fill={textColor}>
        {text}
      </text>
    </svg>
  );
}

// Pure appearance for any placed/tray item — one render path shared by
// the sidebar tray and the canvas, so every material looks identical in
// both places (a real navigation-clarity fix: one visual language, not
// a different tile style per old "mode").
// Vowel/consonant coloring toggle (A23-ROADMAP Phase 2) — a common
// Orton-Gillingham-style convention: color a letter/grapheme tile by
// whether it spells a vowel or consonant sound, a second visual channel
// alongside the letters themselves. Classified by the tile's first
// alphabetic character (works correctly for every single letter and for
// every grapheme in GRAPHEME_GROUPS below, including split-vowel "a_e"
// style spellings and consonant digraphs like "sh"/"wr") — a real,
// simple, honest heuristic, not a claim of phonetic authority.
function vcColorFor(text: string | undefined, on: boolean): CSSProperties | undefined {
  if (!on || !text) return undefined;
  const first = text.replace(/[^a-zA-Z]/g, '')[0]?.toLowerCase();
  if (!first) return undefined;
  const isVowel = 'aeiou'.includes(first);
  return { color: isVowel ? '#b91c1c' : '#1d4ed8' };
}

function ItemVisual({ kind, pieceId, wordClass, letter, boxCount, morphText, morphType, compact, punctId, vowelConsonantColors, ruleId }: {
  kind: PlacedKind; pieceId?: string; wordClass?: MontessoriWordClass; letter?: string; boxCount?: number;
  morphText?: string; morphType?: 'root' | 'prefix' | 'suffix'; compact?: boolean; punctId?: string; vowelConsonantColors?: boolean; ruleId?: string;
}) {
  if (kind === 'spellingRule') {
    const rule = SPELLING_RULES.find((r) => r.id === ruleId);
    if (!rule) return null;
    return (
      <ReferencePopover mode="hover" title={rule.title} body={`${rule.rule} Example: ${rule.example}.`}>
        <div style={{
          minWidth: 120, padding: '8px 10px', border: '2px solid var(--ink)', borderRadius: 10, background: LM_SPELLING_RULE_COLOR,
          fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: '0.8rem', textAlign: 'center',
        }}>
          📏 {rule.title}
        </div>
      </ReferencePopover>
    );
  }
  if (kind === 'punctuation') {
    // A23-ROADMAP Phase 2: opt-in punctuation tiles. Same bordered-tile
    // shape as a letter tile, its own slate color (literacyDesignTokens)
    // so a mark never reads as a word-class tile, and a hover/focus
    // reference tooltip (shared ReferencePopover, same pattern Grammar
    // Symbols use) naming the mark and what it does.
    const info = PUNCTUATION_MARKS.find((m) => m.id === punctId);
    if (!info) return null;
    return (
      <ReferencePopover mode="hover" title={info.name} body={info.label}>
        <div style={{
          minWidth: 40, height: 40, padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '3px solid var(--ink)', borderRadius: 8, background: LM_PUNCTUATION_COLOR, color: LM_PUNCTUATION_TEXT_COLOR,
          fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: '1.3rem', boxShadow: '2px 2px 0 rgba(31,17,71,0.2)',
        }}>
          {info.mark}
        </div>
      </ReferencePopover>
    );
  }
  if (kind === 'grammar') {
    const piece = pieceById(pieceId ?? '');
    if (!piece) return null;
    const bg = GRAMMAR_WORD_CLASS_COLORS[piece.wordClass];
    const fg = GRAMMAR_WORD_CLASS_TEXT_COLORS[piece.wordClass];
    return (
      <div style={{
        width: TILE_W, minHeight: TILE_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '6px 14px', borderRadius: piece.wordClass === 'noun' ? 12 : 999, background: bg, color: fg,
        fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: '1rem', boxShadow: '2px 2px 0 rgba(31,17,71,0.2)', textAlign: 'center',
      }}>
        {piece.text}
      </div>
    );
  }
  if (kind === 'shape') {
    // Direct teacher instruction: "the current grammar symbols need to
    // be 2x the size on default" — doubled from 48/40 to 96/80,
    // everywhere this renders (tray and canvas share this component).
    // Follow-up instruction: "shrink the size of the grammar symbols
    // when they are in the drop down menu, right now they take up too
    // much space" — the `compact` prop (sidebar tray only) shrinks the
    // listing display back down without touching the full 2x size a
    // dragged/placed symbol actually gets on the board.
    // Also direct teacher instruction: hovering a symbol shows its name
    // and a simple definition (matching her reference "Parts of Speech"
    // sheet), pure-CSS hover/focus so it works everywhere this renders.
    const info = MONTESSORI_WORD_CLASS_INFO[wordClass ?? 'noun'];
    const box = compact ? 48 : 96;
    const img = compact ? 40 : 80;
    // A23-ROADMAP Phase 1: generalized into the shared ReferencePopover
    // (hover mode) instead of its own bespoke tooltip markup.
    return (
      <ReferencePopover mode="hover" title={info.name} body={info.label}>
        <div style={{ width: box, height: box, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={info.imageUrl} alt={info.label} draggable={false} style={{ width: img, height: img, objectFit: 'contain', pointerEvents: 'none' }} />
        </div>
      </ReferencePopover>
    );
  }
  if (kind === 'soundChip') {
    // A23-ROADMAP Phase 3: a blank phoneme-segmenting counter — the real
    // physical-manipulative convention (drag out one chip per sound you
    // hear), no target word, no auto-count, matching this sandbox's
    // standing free-play philosophy.
    return <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--ink)', background: LM_PHONO_COLOR, boxShadow: '2px 2px 0 rgba(31,17,71,0.2)' }} />;
  }
  if (kind === 'divider') {
    // A23-ROADMAP Phase 3: Onset-Rime Divider — a plain physical-style
    // dividing bar a student places between letter/grapheme tiles
    // already on the board to mark their own onset|rime split, rather
    // than a scripted "slider" that would need to know the right
    // answer. Purely a manipulative, like a real divider card.
    return <div style={{ width: 8, height: 70, borderRadius: 4, background: 'var(--ink)' }} />;
  }
  if (kind === 'letter') {
    // Also used for grapheme tiles (multi-character, e.g. "sh", "a_e"),
    // hence the min-width instead of a fixed square.
    const colorStyle = vcColorFor(letter, !!vowelConsonantColors);
    // A23-ROADMAP Phase 2: "grapheme split-vowel connector" — a VCe
    // grapheme like "a_e"/"i_e" is stored as one tile (its underscore IS
    // the "there's a consonant between these two letters" spelling
    // pattern), but was rendered as plain literal text before. Now the
    // two vowel letters get their own connector arc between them (the
    // real magic-e visual convention: the two letters "work together"
    // across the consonant), with the second (often-silent) letter shown
    // a little faded.
    const isSplitVowel = (letter ?? '').includes('_');
    if (isSplitVowel) {
      const [head, tail] = (letter ?? '').split('_');
      return (
        <div style={{
          minWidth: 40, height: 40, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
          border: '3px solid var(--ink)', borderRadius: 8, background: 'white',
          fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: '1.1rem', boxShadow: '2px 2px 0 rgba(31,17,71,0.2)', ...colorStyle,
        }}>
          <span>{head}</span>
          <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M1 2 Q8 12 15 2" stroke={colorStyle?.color ?? 'var(--ink)'} strokeWidth="2" fill="none" strokeDasharray="2 2" />
          </svg>
          <span style={{ opacity: 0.55 }}>{tail}</span>
        </div>
      );
    }
    return (
      <div style={{
        minWidth: 40, height: 40, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '3px solid var(--ink)', borderRadius: 8, background: 'white',
        fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: (letter?.length ?? 1) > 2 ? '0.85rem' : '1.2rem', boxShadow: '2px 2px 0 rgba(31,17,71,0.2)', ...colorStyle,
      }}>
        {letter}
      </div>
    );
  }
  if (kind === 'frame') {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: boxCount ?? 3 }).map((_, i) => (
          <div key={i} style={{ width: 44, height: 44, border: '3px solid var(--ink)', borderRadius: 6, background: 'white' }} />
        ))}
      </div>
    );
  }
  // morpheme
  const color = morphType === 'root' ? '#F6C445' : morphType === 'prefix' ? '#7c3aed' : '#14b8a6';
  const textColor = morphType === 'root' ? '#241a05' : '#fff';
  return <PuzzlePiece text={morphText ?? ''} color={color} textColor={textColor} hasTab={morphType !== 'suffix'} hasNotch={morphType !== 'prefix'} />;
}

// One drag wrapper for every material, in the tray or on the canvas —
// pointer handlers passed in, appearance always comes from ItemVisual.
function Draggable({ onPointerDown, onPointerMove, onPointerUp, onDoubleClick, style, glowing, label, children }: {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
  style?: CSSProperties;
  glowing?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      style={{
        touchAction: 'none', userSelect: 'none', cursor: 'grab', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        boxShadow: glowing ? '0 0 0 6px rgba(34,197,94,0.35)' : undefined,
        borderRadius: glowing ? 14 : undefined,
        transition: 'box-shadow 0.2s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Polypad's own subcategory row — a plain clickable label + chevron that
// expands its own tile grid directly beneath it, independent of any
// other subcategory row in the same category.
function SubcategoryRow({ id, label, open, onToggle, children }: {
  id: string; label: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="lm-subcategory">
      <button type="button" className="lm-subcategory-header" onClick={onToggle} aria-expanded={open} aria-controls={`lm-sub-${id}`}>
        <span>{label}</span>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="lm-subcategory-body" id={`lm-sub-${id}`}>{children}</div>}
    </div>
  );
}

// A single collapsible top-level category in the left sidebar.
function Category({ label, color, open, onToggle, children }: {
  label: string; color: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="lm-category">
      <button
        type="button"
        className="lm-category-header"
        style={{ background: color, width: '100%', minHeight: 44, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{label}</span>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="lm-category-body">{children}</div>}
    </div>
  );
}

// A Word Lists row — plain text, not tile-styled (direct teacher
// instruction), but still draggable onto the board like every other
// material. The 🔈 button is separate so a tap can still just hear the
// word without placing a tile (its own pointerdown is stopped from
// bubbling up so it doesn't also start a drag).
function WordListRow({ word, rowId, onDragStart, tts }: {
  word: string; rowId: string; onDragStart: (e: React.PointerEvent) => void; tts: SyncedTTS;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Draggable label={word} onPointerDown={onDragStart} style={{ flex: 1, justifyContent: 'flex-start' }}>
        <span style={{ textAlign: 'left', padding: '6px 2px', fontSize: '0.95rem', color: 'var(--ink)', minHeight: 36, display: 'flex', alignItems: 'center' }}>
          <HighlightedText text={word} active={tts.activeId === rowId} wordIndex={tts.wordIndex} />
        </span>
      </Draggable>
      <SyncedSpeakButton
        id={rowId}
        text={word}
        tts={tts}
        label={word}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 6 }}
      />
    </div>
  );
}

// A Symbol Sentences tray card — direct teacher upload (a real
// Montessori grammar-box deck: full sentences shown purely as a row of
// colored symbols, no words). Dragging the card onto the board drops
// its whole symbol row as one unit; the sentence text itself stays
// symbols-only on the board, but direct follow-up instruction: "when
// you highlight over a symbol sentence in the menu, it should pop up
// with the example reference sentences saved in that original doc" —
// hovering/focusing the tray card reveals its real sentence text,
// reusing the same tooltip pattern the Grammar Symbol tiles already use.
function SymbolSentenceCard({ sentence, onPointerDown }: {
  sentence: SymbolSentence; onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <Draggable label={sentence.sentence} onPointerDown={onPointerDown} style={{ width: '100%' }}>
      <ReferencePopover mode="hover" body={sentence.sentence}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', width: '100%',
          padding: '8px 10px', border: '2px solid var(--ink)', borderRadius: 10, background: 'white',
          boxShadow: '2px 2px 0 rgba(31,17,71,0.15)',
        }}>
          {sentence.words.map((w, i) => (
            <img key={i} src={MONTESSORI_WORD_CLASS_INFO[w.wordClass].imageUrl} alt="" draggable={false} style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0, pointerEvents: 'none' }} />
          ))}
        </div>
      </ReferencePopover>
    </Draggable>
  );
}

// Text Box — direct teacher instruction: "add type text input fields so
// kids can type. SST option. text fields can be double tapped to edit
// text, moveable, resize text options." A self-contained widget (same
// pattern as the Sentence Formula frames): dragging it moves it around
// like any other material, double-tapping opens edit mode (a real
// textarea, focused automatically), and while editing a student can
// type, speak (🎤, browser speech-to-text), or grow/shrink the text
// with A-/A+.
function TextBoxWidget({ item, onPointerDown, onPointerMove, onPointerUp, onTextChange, onFontSizeChange, onRemove, onActivate }: {
  item: PlacedItem;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onTextChange: (value: string) => void;
  onFontSizeChange: (delta: number) => void;
  onRemove: () => void;
  onActivate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fontSize = item.fontSize ?? 20;
  const stt = useTextBoxVoiceToText((text) => onTextChange(`${item.textValue ?? ''} ${text}`.trim()));

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <div className="chrome-frame" style={{ position: 'absolute', left: item.x, top: item.y, padding: 10, zIndex: 5, minWidth: 200 }}>
        <textarea
          ref={inputRef}
          value={item.textValue ?? ''}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Type here..."
          style={{
            width: 220, minHeight: 70, fontFamily: "'Baloo 2', sans-serif", fontSize,
            border: '2px solid var(--ink)', borderRadius: 8, padding: 6, resize: 'both',
          }}
        />
        <div className="row-wrap" style={{ gap: 4, marginTop: 6, alignItems: 'center' }}>
          <button type="button" className="btn btn-sm" style={{ minWidth: 34, padding: '2px 8px' }} onClick={() => onFontSizeChange(-2)} aria-label="Smaller text">A-</button>
          <button type="button" className="btn btn-sm" style={{ minWidth: 34, padding: '2px 8px' }} onClick={() => onFontSizeChange(2)} aria-label="Bigger text">A+</button>
          {stt.supported && (
            <button type="button" className={`btn btn-sm ${stt.listening ? 'btn-primary' : ''}`} onClick={stt.toggle}>
              {stt.listening ? '🎙️ Listening…' : '🎤 Speak'}
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Done</button>
          <button type="button" className="btn btn-sm" onClick={onRemove} aria-label="Remove text box">🗑️</button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={item.textValue?.trim() ? item.textValue : 'Empty text box, double-tap to type'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={() => { setEditing(true); onActivate(); }}
      style={{
        position: 'absolute', left: item.x, top: item.y, zIndex: 5,
        touchAction: 'none', userSelect: 'none', cursor: 'grab', minWidth: 120, minHeight: 44,
        padding: '8px 12px', border: '2px dashed var(--content-border)', borderRadius: 8, background: 'white',
        fontFamily: "'Baloo 2', sans-serif", fontSize, whiteSpace: 'pre-wrap', maxWidth: 320,
      }}
    >
      {item.textValue?.trim() ? item.textValue : <span style={{ opacity: 0.45 }}>Double-tap to type</span>}
    </div>
  );
}

// Syllable Tapper — A23-ROADMAP Phase 3 phonological-awareness tool: a
// student types or speaks a word, then taps "👏 Tap" once per syllable
// they clap out themselves (self-directed, no auto-syllable-counting —
// this sandbox never claims to judge a spoken/typed answer as right or
// wrong). Same self-contained-widget pattern as TextBoxWidget: a drag
// handle on the title, ✕ to remove.
function SyllableTapperWidget({ item, onPointerDown, onPointerMove, onPointerUp, onWordChange, onTapCountChange, onRemove }: {
  item: PlacedItem;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onWordChange: (value: string) => void;
  onTapCountChange: (count: number) => void;
  onRemove: () => void;
}) {
  const stt = useTextBoxVoiceToText((text) => onWordChange(`${item.textValue ?? ''} ${text}`.trim()));
  const taps = item.tapCount ?? 0;
  return (
    <div className="chrome-frame" style={{ position: 'absolute', left: item.x, top: item.y, padding: 10, zIndex: 5, minWidth: 200 }}>
      <div className="space-between" style={{ alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ fontSize: '0.8rem', cursor: 'grab', touchAction: 'none' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          👏 Syllable Tapper
        </strong>
        <button type="button" className="btn btn-sm" onClick={onRemove} aria-label="Remove Syllable Tapper">✕</button>
      </div>
      <div className="row-wrap" style={{ gap: 4, marginBottom: 6, alignItems: 'center' }}>
        <input
          value={item.textValue ?? ''}
          onChange={(e) => onWordChange(e.target.value)}
          placeholder="Type or say the word"
          style={{ flex: 1, border: '2px solid var(--content-border)', borderRadius: 6, padding: '4px 6px', fontSize: '0.85rem' }}
        />
        {stt.supported && (
          <button type="button" className={`btn btn-sm ${stt.listening ? 'btn-primary' : ''}`} style={{ minWidth: 30, padding: '2px 6px' }} onClick={stt.toggle} aria-label={stt.listening ? 'Listening, tap to stop' : 'Speak the word'}>
            {stt.listening ? '🎙️' : '🎤'}
          </button>
        )}
      </div>
      <div className="row-wrap" style={{ gap: 4, marginBottom: 6, minHeight: 22 }} aria-label={`${taps} claps so far`}>
        {Array.from({ length: taps }).map((_, i) => (
          <span key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: '#1968AB', display: 'inline-block' }} />
        ))}
      </div>
      <div className="row-wrap" style={{ gap: 4 }}>
        <button type="button" className="btn btn-sm" onClick={() => onTapCountChange(Math.min(8, taps + 1))}>👏 Tap</button>
        <button type="button" className="btn btn-sm" onClick={() => onTapCountChange(0)} disabled={taps === 0}>↺ Reset</button>
      </div>
    </div>
  );
}

// Dictation Card — A23-ROADMAP Phase 3, "reusing the Morphemes 'connects
// only if real, never punitive' pattern": hear a word, write what you
// heard, then reveal to check yourself — never auto-graded, never a red
// X. Deliberately NOT randomized: a prior direct teacher instruction
// removed every randomize/surprise-me mechanic app-wide, so the prompt
// word is always chosen manually here (a dropdown of the student's own
// active Literacy Focus words when one exists, or a plain typed field —
// e.g. for a teacher dictating their own chosen word — when it doesn't),
// never auto-picked.
function DictationWidget({ item, wordOptions, onPointerDown, onPointerMove, onPointerUp, onPromptChange, onAnswerChange, onRemove, tts, settings }: {
  item: PlacedItem;
  wordOptions: string[];
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPromptChange: (value: string) => void;
  onAnswerChange: (value: string) => void;
  onRemove: () => void;
  tts: SyncedTTS;
  settings?: TTSSettings;
}) {
  const [revealed, setRevealed] = useState(false);
  const prompt = item.dictationPrompt ?? '';
  const speakId = `dict-${item.instanceId}`;
  return (
    <div className="chrome-frame" style={{ position: 'absolute', left: item.x, top: item.y, padding: 10, zIndex: 5, minWidth: 220 }}>
      <div className="space-between" style={{ alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ fontSize: '0.8rem', cursor: 'grab', touchAction: 'none' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          🎧 Dictation
        </strong>
        <button type="button" className="btn btn-sm" onClick={onRemove} aria-label="Remove Dictation Card">✕</button>
      </div>
      <div className="row-wrap" style={{ gap: 4, marginBottom: 6, alignItems: 'center' }}>
        {wordOptions.length > 0 ? (
          <select value={prompt} onChange={(e) => onPromptChange(e.target.value)} style={{ flex: 1, border: '2px solid var(--content-border)', borderRadius: 6, padding: '4px 6px', fontSize: '0.8rem' }}>
            <option value="">Pick a word…</option>
            {wordOptions.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        ) : (
          <input value={prompt} onChange={(e) => onPromptChange(e.target.value)} placeholder="Type the word to dictate" style={{ flex: 1, border: '2px solid var(--content-border)', borderRadius: 6, padding: '4px 6px', fontSize: '0.8rem' }} />
        )}
        {prompt && (
          <SyncedSpeakButton id={speakId} text={prompt} tts={tts} settings={settings} ariaLabel="Hear the word" style={{ padding: '2px 8px', minHeight: 28 }} />
        )}
      </div>
      <input
        value={item.textValue ?? ''}
        onChange={(e) => onAnswerChange(e.target.value)}
        placeholder="Write what you heard"
        style={{ width: '100%', boxSizing: 'border-box', border: '2px solid var(--ink)', borderRadius: 6, padding: '6px 8px', fontSize: '0.85rem', marginBottom: 6 }}
      />
      <div className="row-wrap" style={{ gap: 6, alignItems: 'center' }}>
        <button type="button" className="btn btn-sm" onClick={() => setRevealed((v) => !v)} disabled={!prompt}>{revealed ? '🙈 Hide' : '👁️ Reveal'}</button>
        {revealed && prompt && <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{prompt}</span>}
      </div>
    </div>
  );
}

// Word Matrix — A23-ROADMAP Phase 3 ("word matrix builder... under
// Morphemes"): a reference grid showing, for one chosen root, which of
// every prefix/suffix in the tray actually combines into a real word —
// derived directly from MORPHEME_COMBOS (the same single source of
// truth the jigsaw pieces themselves use to decide whether to connect),
// not a second hand-authored grid that could drift out of sync. Picking
// a different root is the only interaction; this is a reference tool, no
// build-it-yourself step (that's what the jigsaw pieces and Reverse
// Morphology prompts, right below, are for).
function WordMatrixWidget({ item, onPointerDown, onPointerMove, onPointerUp, onRootChange, onRemove }: {
  item: PlacedItem;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onRootChange: (rootId: string) => void;
  onRemove: () => void;
}) {
  const rootId = item.matrixRootId ?? MORPHEME_ROOTS[0].id;
  return (
    <div className="chrome-frame" style={{ position: 'absolute', left: item.x, top: item.y, padding: 10, zIndex: 5, minWidth: 260 }}>
      <div className="space-between" style={{ alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ fontSize: '0.8rem', cursor: 'grab', touchAction: 'none' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          🔢 Word Matrix
        </strong>
        <button type="button" className="btn btn-sm" onClick={onRemove} aria-label="Remove Word Matrix">✕</button>
      </div>
      <select value={rootId} onChange={(e) => onRootChange(e.target.value)} style={{ width: '100%', marginBottom: 8, border: '2px solid var(--content-border)', borderRadius: 6, padding: '4px 6px', fontSize: '0.8rem' }}>
        {MORPHEME_ROOTS.map((r) => <option key={r.id} value={r.id}>{r.text}</option>)}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
        {MORPHEME_AFFIXES.map((a) => {
          const word = MORPHEME_COMBOS[`${rootId}:${a.id}`];
          return (
            <div key={a.id} style={{ border: '1px solid var(--content-border)', borderRadius: 6, padding: '4px 6px', fontSize: '0.72rem', textAlign: 'center', background: word ? '#f0fdf4' : '#f8fafc', opacity: word ? 1 : 0.5 }}>
              <div style={{ fontWeight: 700 }}>{a.text}</div>
              <div>{word ?? '—'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// One Sentence Formula blank — direct teacher follow-up instructions:
// "drop down menus need to be alphabetized and scroll feature allows
// more to be shown. typing the start of a word also starts searching
// for the word... SST is option for text inputs." The picker list is
// alphabetized and scroll-capped, with its own search box that filters
// by prefix as the student types (helps with spelling since they only
// need the first letter or two), and the blank itself gets a 🎤
// speech-to-text button alongside the existing dropdown, same pattern
// as the Text Box tool.
function FormulaBlankField({ value, onType, onPick, placeholder, color, bank, open, onToggleOpen }: {
  value: string;
  onType: (v: string) => void;
  onPick: (text: string) => void;
  placeholder: string;
  color: string;
  bank: { text: string }[];
  open: boolean;
  onToggleOpen: () => void;
}) {
  const [search, setSearch] = useState('');
  const stt = useTextBoxVoiceToText((text) => onType(`${value} ${text}`.trim()));
  const filtered = bank
    .filter((o) => o.text.toLowerCase().startsWith(search.trim().toLowerCase()))
    .slice()
    .sort((a, b) => a.text.localeCompare(b.text));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, position: 'relative' }}>
      <input
        value={value}
        onChange={(e) => onType(e.target.value)}
        placeholder={placeholder}
        style={{ width: 92, border: `2px solid ${color}`, borderRadius: 6, padding: '4px 6px', fontSize: '0.85rem' }}
      />
      {stt.supported && (
        // A23-ROADMAP Phase 2: visual listening state made explicit here
        // too (was icon-only before), matching the Text Box tool's own
        // "🎙️ Listening…" label — paired with the new audio chime in
        // useTextBoxVoiceToText's toggle().
        <button type="button" className={`btn btn-sm ${stt.listening ? 'btn-primary' : ''}`} style={{ padding: '2px 6px', minHeight: 28 }} onClick={stt.toggle} aria-label={stt.listening ? 'Listening, tap to stop' : 'Speak this word'}>
          {stt.listening ? '🎙️' : '🎤'}
        </button>
      )}
      <button type="button" className="btn btn-sm" style={{ padding: '2px 6px', minHeight: 28, minWidth: 28 }} onClick={() => { setSearch(''); onToggleOpen(); }}>▾</button>
      {open && (
        <div className="chrome-frame" style={{ position: 'absolute', top: '110%', left: 0, zIndex: 10, padding: 6, width: 220 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type to search..."
            autoFocus
            style={{ width: '100%', border: '2px solid var(--content-border)', borderRadius: 6, padding: '4px 6px', fontSize: '0.78rem', marginBottom: 6, boxSizing: 'border-box' }}
          />
          <div className="row-wrap" style={{ gap: 4, maxHeight: 180, overflowY: 'auto' }}>
            {filtered.map((opt) => (
              <button key={opt.text} className="tag-pill" style={{ cursor: 'pointer' }} onClick={() => onPick(opt.text)}>{opt.text}</button>
            ))}
            {bank.length > 0 && filtered.length === 0 && <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>No matches</span>}
            {bank.length === 0 && <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Fill WHO first!</span>}
          </div>
        </div>
      )}
    </span>
  );
}

// Standalone v1: no login, nothing saved — ported from the Homeplot
// dashboard's native Literacy Manipulatives (GrammarSandbox.tsx). Every
// account/marketplace/save-file concept that tool had is gone here on
// purpose (see README): no student record, no purchased voice/color
// skins, no per-teacher "focus set," no saved-whiteboard list. What's
// left is the open canvas and every manipulative tool itself, unlocked
// for anyone who opens the page. TTS settings are just local component
// state (rate/voice), not tied to any account.
export default function LiteracyManipulatives() {
  const [ttsSettings, setTtsSettings] = useState<TTSSettings>({ rate: 1, voiceURI: null });

  const [placed, setPlaced] = useState<PlacedItem[]>([]);
  const [glowIds, setGlowIds] = useState<Set<string>>(new Set());
  // Direct teacher instruction: "ensure that after i drag and drop, the
  // x is not shown on the assets on the whiteboard. only show x upon
  // moving or selected. (click to view x on touchscreen)." A single
  // selected item's delete (and, for Symbol Sentences, settings) badge
  // shows; picking up an item to drag also selects it, so the badge
  // stays visible through the whole move, and a plain tap selects it
  // on touch. Tapping empty canvas clears the selection.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Symbol Sentences settings popup (per-word text inputs) — direct
  // follow-up instruction, same toggle pattern as openFormulaSettings.
  const [openSymbolSentenceSettings, setOpenSymbolSentenceSettings] = useState<string | null>(null);
  // Direct follow-up instruction: "have the same setting button appear
  // for single grammar symbols... the same text box feature should
  // appear with single grammar symbols." Same toggle pattern again.
  const [openShapeSettings, setOpenShapeSettings] = useState<string | null>(null);
  // Sentence Formulas joined into a paragraph chain — direct
  // instruction: "sentence formulas can be joined together (a
  // connection animation) to stack them into a paragraph form."
  // formulaCardRefs holds each card's real DOM node so a join can snap
  // to its actual measured height rather than a guessed one.
  const formulaCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [formulaGlowIds, setFormulaGlowIds] = useState<Set<string>>(new Set());
  const formulaGlowTimerRef = useRef<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // A23-ROADMAP Phase 1 (spec's own top priority): one shared TTS-with-
  // synced-word-highlighting engine, mounted once here and passed down to
  // every 🔈 button in this screen (SyncedSpeakButton) instead of each
  // one calling the plain speak() independently.
  const tts = useSyncedTTS();
  // A23-ROADMAP Phase 2: vowel/consonant coloring toggle for Alphabet
  // and Graphemes tiles (an Orton-Gillingham-style convention), off by
  // default (matching every other accommodation on this screen that
  // changes how tiles look — opt-in, never forced).
  const [vowelConsonantColors, setVowelConsonantColors] = useState(false);
  // A23-ROADMAP Phase 2: projector/presentation mode — hides the sidebar
  // and bumps zoom so the board reads from across a classroom; print
  // mode is just the existing "🖨️ Print" button calling window.print()
  // with the @media print rules in index.css doing the actual hiding.
  const [projectorMode, setProjectorMode] = useState(false);
  const toggleProjectorMode = () => {
    setProjectorMode((v) => {
      const next = !v;
      if (next) { setSidebarOpen(false); setZoom(1.5); } else { setZoom(1); }
      return next;
    });
  };
  // Zoom — direct teacher instruction: "add zoom feature for white
  // board." Scales the whole canvas visually (transform: scale, from
  // the top-left); placed items keep their real, unscaled x/y, so
  // canvasRelative() below divides pointer coordinates by zoom to stay
  // in that same logical space regardless of the current zoom level.
  const [zoom, setZoom] = useState(1);
  const zoomIn = () => setZoom((z) => Math.min(2, Math.round((z + 0.25) * 100) / 100));
  const zoomOut = () => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100));
  const zoomReset = () => setZoom(1);
  // Top toolbar (Help/Exit/materials-toggle/Draw/Undo/Redo/Clear/Save) —
  // direct teacher instruction: moved off the sidebar into its own
  // collapsible bar across the top of the screen.
  const [topBarOpen, setTopBarOpen] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragInstanceRef = useRef<string | null>(null);
  const glowTimerRef = useRef<number | null>(null);
  const historyRef = useRef<PlacedItem[][]>([]);
  const redoRef = useRef<PlacedItem[][]>([]);

  // Draw — merged Mark+Draw into one tool, direct teacher instruction.
  // A transparent canvas overlay sits on top of the shared tile canvas
  // (same technique the old Mark toggle used); Pen and Highlight are two
  // stroke styles of the same tool, not separate tools.
  const [drawOn, setDrawOn] = useState(false);
  const [drawMode, setDrawMode] = useState<'pen' | 'highlight'>('pen');
  const [drawColor, setDrawColor] = useState(BASE_PEN_COLORS[0]);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const drawLast = useRef<{ x: number; y: number } | null>(null);

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    shapes: true, symbolSentences: false, morphemes: false, letters: false, graphemes: false, punctuation: false, phono: false, frames: false, textbox: false, formulas: false, wordLists: false,
    wordChains: false, heartWords: false, spellingRules: false, dictation: false, writingScaffolds: false,
  });
  const toggleCategory = (key: string) => setOpenCategories((s) => ({ ...s, [key]: !s[key] }));
  const [openSubcategories, setOpenSubcategories] = useState<Record<string, boolean>>({
    page1: false, page2: false, page3: false, page4: false, page5: false, page6: false, page7: false, page8: false, page9: false, page10: false, page11: false,
    roots: true, affixes: true, phonics: true, morphemesList: true, spelling: true,
  });
  const toggleSubcategory = (key: string) => setOpenSubcategories((s) => ({ ...s, [key]: !s[key] }));

  // Alphabet — direct teacher instruction: full set of tiles, lowercase
  // and uppercase, toggled by double-tapping a tile. letterCase tracks
  // the tray's current case per letter (what gets dragged out next);
  // once placed, a tile's own case toggles independently via its own
  // double-tap, tracked directly on that placed instance's `letter`.
  const [letterCase, setLetterCase] = useState<Record<string, 'upper' | 'lower'>>({});
  const caseFor = (l: string) => letterCase[l] ?? 'upper';
  const toggleTrayCase = (l: string) => setLetterCase((c) => ({ ...c, [l]: caseFor(l) === 'upper' ? 'lower' : 'upper' }));
  const toggleLetterCase = (instanceId: string) => setPlaced((p) => p.map((pp) => (
    pp.instanceId === instanceId && pp.kind === 'letter' && pp.letter
      ? { ...pp, letter: pp.letter === pp.letter.toUpperCase() ? pp.letter.toLowerCase() : pp.letter.toUpperCase() }
      : pp
  )));

  // Sentence Formulas — direct teacher instruction: brought back as a
  // left-sidebar category (not a full-screen mode), reusing
  // sentenceFormulas.ts's real 22-formula content. Picking a formula adds
  // a self-contained frame widget to the canvas (its own placed item,
  // not draggable — a fixed-position card with a close button, to avoid
  // the widget's internal clickable blanks fighting canvas drag). Each
  // blank is both a plain text input (type your own word) and a "▾"
  // dropdown (pick from the real word bank), satisfying "drag and drop
  // or type" without the real cross-widget drag risk that would add.
  const [sfCategoryId, setSfCategoryId] = useState<FormulaCategory>('basic-action');
  const [openFramePicker, setOpenFramePicker] = useState<string | null>(null);
  // Direct teacher instruction: "to the left of the x, i want a settings
  // button for sentence formulas. the setting will change... the tenses
  // (past, present, future...) and adjusting any words currently within
  // the frame to be the selected tense." Tracks which formula's settings
  // popup is open, same pattern as openFramePicker.
  const [openFormulaSettings, setOpenFormulaSettings] = useState<string | null>(null);
  // Direct teacher instruction: "allow sentence formulas to be used to
  // build paragraphs... paste into the text field... if another
  // sentence formula is created, the paste... adding to the same text
  // field currently active." Tracks whichever Text Box the student
  // most recently created or opened for editing.
  const [activeTextBoxId, setActiveTextBoxId] = useState<string | null>(null);

  const addSentenceFrame = (formulaId: string) => {
    const count = placed.filter((p) => p.kind === 'sentenceFrame').length;
    const instanceId = `sf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPlaced((p) => [...p, { instanceId, kind: 'sentenceFrame', formulaId, frameFills: {}, x: 40, y: 20 + count * 130 }]);
  };

  const removePlacedItem = (instanceId: string) => setPlaced((p) => p
    .filter((pp) => pp.instanceId !== instanceId)
    .map((pp) => (pp.joinedToId === instanceId ? { ...pp, joinedToId: undefined } : pp)));

  // Direct teacher instruction: "if an object is selected and backspace
  // or delete is clicked, delete the object." Ignored while typing
  // anywhere (a Text Box, a Sentence Formula blank, a search box...) so
  // Backspace still just erases a character like normal there.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      if (!selectedId) return;
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing) return;
      e.preventDefault();
      removePlacedItem(selectedId);
      setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId]);

  // Quick-add from the top toolbar (direct teacher instruction: put
  // Text Box next to Draw) — a plain click, no drag context to place
  // from, so it just drops a fresh text box near the top-left of the
  // board, stacking down if more than one is added this way.
  const addTextBoxAtDefault = () => {
    pushHistory();
    const count = placed.filter((p) => p.kind === 'textbox').length;
    const instanceId = `tb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPlaced((p) => [...p, { instanceId, kind: 'textbox', textValue: '', fontSize: 20, x: 40, y: 20 + count * 70 }]);
    setActiveTextBoxId(instanceId);
  };

  // Direct follow-up instruction: "have the same setting button appear
  // for single grammar symbols, however when settings appear, if you
  // click to add a text field, it should appear and stay, same as
  // adding a text box... the same text box feature should appear with
  // single grammar symbols." Rather than a new lightweight input, this
  // spawns a real, independent Text Box item right next to the symbol —
  // literally the same persistent, double-tap-to-edit, resizable,
  // STT-capable tool the sidebar's Text Box already is.
  const addTextFieldNearShape = (shapeInstanceId: string) => {
    const shape = placed.find((p) => p.instanceId === shapeInstanceId);
    if (!shape) return;
    pushHistory();
    const instanceId = `tb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPlaced((p) => [...p, { instanceId, kind: 'textbox', textValue: '', fontSize: 16, x: shape.x, y: shape.y + 108 }]);
    setActiveTextBoxId(instanceId);
    setOpenShapeSettings(null);
  };

  const setFrameFill = (instanceId: string, segIndex: number, value: string) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, frameFills: { ...(pp.frameFills ?? {}), [segIndex]: value } } : pp)));
  };

  // Direct teacher instruction: "within the settings for each symbol
  // sentence should be an option for text input fields similar to the
  // current sentence formulas" — one typed word per symbol, shown under
  // that symbol once filled in. Same per-index fill pattern as
  // setFrameFill above.
  const setSymbolSentenceWordFill = (instanceId: string, wordIndex: number, value: string) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, wordFills: { ...(pp.wordFills ?? {}), [wordIndex]: value } } : pp)));
  };

  // Direct teacher instruction: changing a formula's tense setting must
  // adjust "any words currently within the frame" — re-tenses every
  // already-filled 'action' blank using the same reversible base-form
  // lookup the word bank itself uses (retenseActionWord), so this is
  // never a fabricated grammar judgment, just re-conjugating the same
  // fixed verb pool.
  const setFormulaTense = (instanceId: string, tense: FormulaTense) => {
    setPlaced((p) => p.map((pp) => {
      if (pp.instanceId !== instanceId || pp.kind !== 'sentenceFrame') return pp;
      const formula = SENTENCE_FORMULAS.find((f) => f.id === pp.formulaId);
      if (!formula) return { ...pp, tense };
      const fills = pp.frameFills ?? {};
      const whoIdx = formula.segments.findIndex((s) => s.kind === 'slot' && s.slot === 'who');
      const whoText = whoIdx >= 0 ? fills[whoIdx] : undefined;
      const whoVerbForm: 'singular' | 'plural' | null = whoText ? (WHO_WORDS.find((w) => w.text === whoText)?.verbForm ?? 'singular') : null;
      const newFills = { ...fills };
      formula.segments.forEach((seg, i) => {
        if (seg.kind === 'slot' && seg.slot === 'action' && newFills[i]) {
          newFills[i] = retenseActionWord(newFills[i], tense, whoVerbForm, seg.verbFormOverride);
        }
      });
      return { ...pp, tense, frameFills: newFills };
    }));
  };

  // Direct teacher instruction: "students should also be able to
  // duplicate formulas on their whiteboards, saving the words within
  // them." A shallow clone with a fresh instanceId, offset so it doesn't
  // sit exactly on top of the original.
  const duplicateFormula = (instanceId: string) => {
    setPlaced((p) => {
      const orig = p.find((pp) => pp.instanceId === instanceId);
      if (!orig || orig.kind !== 'sentenceFrame') return p;
      const newId = `sf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      return [...p, { ...orig, instanceId: newId, x: orig.x + 24, y: orig.y + 24, frameFills: { ...(orig.frameFills ?? {}) }, joinedToId: undefined }];
    });
  };

  const setTextBoxValue = (instanceId: string, value: string) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, textValue: value } : pp)));
  };
  const setTextBoxFontSize = (instanceId: string, delta: number) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, fontSize: Math.min(48, Math.max(12, (pp.fontSize ?? 20) + delta)) } : pp)));
  };
  const setSyllableWord = (instanceId: string, value: string) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, textValue: value } : pp)));
  };
  const setSyllableTapCount = (instanceId: string, count: number) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, tapCount: count } : pp)));
  };
  // Heart Words — a student marks which letters of a placed word are
  // the "heart" (tricky, irregular) part themselves by tapping each
  // letter, rather than the app asserting a possibly-wrong answer (see
  // heartWordContent.ts). Purely additive/toggle, never graded.
  const toggleHeartIndex = (instanceId: string, index: number) => {
    setPlaced((p) => p.map((pp) => {
      if (pp.instanceId !== instanceId) return pp;
      const set = new Set(pp.heartIndices ?? []);
      if (set.has(index)) set.delete(index); else set.add(index);
      return { ...pp, heartIndices: Array.from(set) };
    }));
  };
  const setDictationPrompt = (instanceId: string, value: string) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, dictationPrompt: value } : pp)));
  };
  const setDictationAnswer = (instanceId: string, value: string) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, textValue: value } : pp)));
  };
  const setMatrixRoot = (instanceId: string, rootId: string) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, matrixRootId: rootId } : pp)));
  };
  // A23-ROADMAP Phase 3: Elkonin-boxes-v2's "flexible count" — a placed
  // Sound Box frame's boxCount can now grow/shrink live via +/- controls
  // shown when it's selected (see the per-item controls badge below),
  // instead of only ever being fixed at whichever size was dragged out.
  // Multi-letter grouping (the v2 spec's other ask) was already possible
  // before this: a grapheme tile like "sh" already occupies one cell as
  // a single multi-letter unit.
  const adjustFrameBoxCount = (instanceId: string, delta: number) => {
    pushHistory();
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId && pp.kind === 'frame' ? { ...pp, boxCount: Math.max(1, Math.min(8, (pp.boxCount ?? 3) + delta)) } : pp)));
  };

  // Paragraph building — direct teacher instruction: "allow sentence
  // formulas to be used to build paragraphs... paste into the text
  // field... adding to the same text field currently active." Appends
  // to whichever Text Box was most recently created or opened; if none
  // exists yet (or it was deleted), starts a fresh one with this
  // sentence as its first line.
  const pasteSentenceToTextBox = (text: string) => {
    const newId = `tb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPlaced((p) => {
      const active = activeTextBoxId ? p.find((pp) => pp.instanceId === activeTextBoxId && pp.kind === 'textbox') : undefined;
      if (active) {
        return p.map((pp) => (pp.instanceId === active.instanceId ? { ...pp, textValue: `${(pp.textValue ?? '').trim()} ${text}`.trim() } : pp));
      }
      setActiveTextBoxId(newId);
      return [...p, { instanceId: newId, kind: 'textbox', textValue: text, fontSize: 20, x: 40, y: 20 }];
    });
  };

  // Morphemes — direct teacher instruction: puzzle pieces only link if
  // they form a real word ("pre" + "view" = "previewing" — a real
  // word); otherwise they never connect, and no definition appears.
  // Unlike the noun/verb snap (always snaps on number agreement,
  // whatever the words), this only snaps position when MORPHEME_COMBOS
  // confirms a real result — an invalid attempt simply doesn't move.
  const runMorphemeSnapCheck = (instanceId: string) => {
    setPlaced((current) => {
      const dragged = current.find((p) => p.instanceId === instanceId);
      if (!dragged || dragged.kind !== 'morpheme') return current;
      let bestId: string | null = null;
      let bestDist = SNAP_THRESHOLD;
      for (const other of current) {
        if (other.instanceId === instanceId || other.kind !== 'morpheme') continue;
        const isPair = dragged.morphType === 'root' ? other.morphType !== 'root' : other.morphType === 'root';
        if (!isPair) continue;
        const dist = Math.hypot(other.x - dragged.x, other.y - dragged.y);
        if (dist < bestDist) { bestDist = dist; bestId = other.instanceId; }
      }
      if (!bestId) return current;
      const other = current.find((p) => p.instanceId === bestId)!;
      const rootItem = dragged.morphType === 'root' ? dragged : other;
      const affixItem = dragged.morphType === 'root' ? other : dragged;
      if (!MORPHEME_COMBOS[`${rootItem.morphId}:${affixItem.morphId}`]) return current;
      // Direct follow-up instruction: "puzzle pieces should visually
      // click together when they make a real word" — a small overlap
      // (instead of the old 4px gap) so the tab bump actually nests
      // into the neighboring notch instead of just sitting nearby.
      const morphW = sizeFor('morpheme').w;
      const overlap = 8;
      const newX = affixItem.morphType === 'prefix' ? rootItem.x - morphW + overlap : rootItem.x + morphW - overlap;
      return current.map((p) => (p.instanceId === affixItem.instanceId ? { ...p, x: newX, y: rootItem.y } : p));
    });
  };

  // Real-word connections currently on the board, derived (not stored)
  // from position — recomputed every render, cheap given the tiny
  // MORPHEME_ROOTS/PREFIXES/SUFFIXES pool.
  const morphemeCombos = placed
    .filter((p) => p.kind === 'morpheme' && p.morphType === 'root')
    .flatMap((root) => placed
      .filter((p) => p.kind === 'morpheme' && p.morphType !== 'root' && Math.hypot(p.x - root.x, p.y - root.y) < 140)
      .map((affix) => {
        const word = MORPHEME_COMBOS[`${root.morphId}:${affix.morphId}`];
        if (!word) return null;
        const rootData = MORPHEME_ROOTS.find((r) => r.id === root.morphId);
        const meaning = AFFIX_MEANINGS[affix.morphText ?? ''] ?? '';
        // A23-ROADMAP Phase 2: "morpheme join-rule animation (e-drop,
        // consonant-doubling, visible at the seam)" — derived directly
        // from comparing the root's spelling to the real word (see
        // detectJoinRule), not a second hand-tagged data source.
        const joinRule = (rootData?.text && affix.morphText && affix.morphType && affix.morphType !== 'root')
          ? detectJoinRule(rootData.text, affix.morphText, affix.morphType, word)
          : null;
        const joinRuleNote = joinRule && rootData?.text && affix.morphText ? JOIN_RULE_NOTES[joinRule](rootData.text, affix.morphText) : null;
        return {
          id: `${root.instanceId}-${affix.instanceId}`, x: root.x, y: root.y,
          seamX: affix.morphType === 'prefix' ? root.x : affix.x,
          word, definition: `"${word}" = ${affix.morphType === 'prefix' ? affix.morphText : rootData?.text}${affix.morphType === 'prefix' ? '' : affix.morphText} (${affix.morphText} means "${meaning}")`,
          etymology: rootData?.etymology,
          joinRule, joinRuleNote,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x));

  const pushHistory = () => {
    historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), placed];
    setCanUndo(true);
    // A fresh action invalidates any redo history.
    redoRef.current = [];
    setCanRedo(false);
  };

  const undo = () => {
    const hist = historyRef.current;
    if (hist.length === 0) return;
    const prev = hist[hist.length - 1];
    historyRef.current = hist.slice(0, -1);
    redoRef.current = [...redoRef.current, placed];
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    setPlaced(prev);
  };

  const redo = () => {
    const red = redoRef.current;
    if (red.length === 0) return;
    const next = red[red.length - 1];
    redoRef.current = red.slice(0, -1);
    historyRef.current = [...historyRef.current, placed];
    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
    setPlaced(next);
  };

  const canvasRelative = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    // rect already reflects the current zoom (getBoundingClientRect
    // includes CSS transforms), so dividing by zoom converts back into
    // the canvas's own unscaled coordinate space that placed items'
    // x/y live in.
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
  };

  // Snap check — the one structural rule left: a dropped/moved grammar
  // tile looks for the nearest OTHER grammar tile of the opposite word
  // class whose number agrees. Every other material kind is skipped
  // entirely, purely free placement.
  const runSnapCheck = (instanceId: string) => {
    setPlaced((current) => {
      const dragged = current.find((p) => p.instanceId === instanceId);
      if (!dragged || dragged.kind !== 'grammar') return current;
      const draggedPiece = pieceById(dragged.pieceId ?? '');
      if (!draggedPiece) return current;

      let bestId: string | null = null;
      let bestDist = SNAP_THRESHOLD;
      for (const other of current) {
        if (other.instanceId === instanceId || other.kind !== 'grammar') continue;
        const otherPiece = pieceById(other.pieceId ?? '');
        if (!otherPiece || otherPiece.wordClass === draggedPiece.wordClass || otherPiece.number !== draggedPiece.number) continue;
        const dist = Math.hypot(other.x - dragged.x, other.y - dragged.y);
        if (dist < bestDist) { bestDist = dist; bestId = other.instanceId; }
      }
      if (!bestId) return current;

      const other = current.find((p) => p.instanceId === bestId)!;
      const nounEntry = draggedPiece.wordClass === 'noun' ? dragged : other;
      const verbEntry = draggedPiece.wordClass === 'verb' ? dragged : other;

      if (glowTimerRef.current) window.clearTimeout(glowTimerRef.current);
      setGlowIds(new Set([nounEntry.instanceId, verbEntry.instanceId]));
      glowTimerRef.current = window.setTimeout(() => setGlowIds(new Set()), 900);

      return current.map((p) => (p.instanceId === verbEntry.instanceId ? { ...p, x: nounEntry.x + TILE_W + SNAP_GAP, y: nounEntry.y } : p));
    });
  };

  // A tray pointerdown and the item it spawns are two different DOM
  // elements (the tray tile vs. the newly-created canvas tile), so
  // relying on setPointerCapture alone to keep the drag live is
  // unreliable (it can retarget events to the tray element, which has
  // no move/up handler, silently freezing the new tile in place). A
  // window-level listener sidesteps that entirely: it fires on every
  // pointer move/up regardless of which element is nominally the
  // event's target, so the newly spawned tile reliably tracks the
  // cursor and lands wherever the pointer is released.
  const bindGlobalDragTracking = (
    spawned: { instanceId: string; x: number; y: number }[],
    spawnAnchor: { x: number; y: number },
    anchorSize: { w: number; h: number },
    kind: PlacedKind,
  ) => {
    const offsets = new Map(spawned.map((it) => [it.instanceId, { dx: it.x - spawnAnchor.x, dy: it.y - spawnAnchor.y }]));
    const move = (ev: PointerEvent) => {
      const { x, y } = canvasRelative(ev.clientX, ev.clientY);
      const anchorX = x - anchorSize.w / 2;
      const anchorY = y - anchorSize.h / 2;
      setPlaced((p) => p.map((pp) => {
        const off = offsets.get(pp.instanceId);
        return off ? { ...pp, x: anchorX + off.dx, y: anchorY + off.dy } : pp;
      }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragInstanceRef.current = null;
      const anchorId = spawned[spawned.length - 1].instanceId;
      if (kind === 'grammar') runSnapCheck(anchorId);
      if (kind === 'morpheme') runMorphemeSnapCheck(anchorId);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startDragNewItem = (factory: () => Omit<PlacedItem, 'x' | 'y' | 'instanceId'>) => (e: React.PointerEvent) => {
    e.preventDefault();
    pushHistory();
    const { x, y } = canvasRelative(e.clientX, e.clientY);
    const instanceId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const base = factory();
    const size = sizeFor(base.kind, base.boxCount);
    const item = { ...base, instanceId, x: x - size.w / 2, y: y - size.h / 2 };
    setPlaced((p) => [...p, item]);
    if (base.kind === 'textbox') setActiveTextBoxId(instanceId);
    dragInstanceRef.current = instanceId;
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* not supported, window listener still tracks the drag */ }
    bindGlobalDragTracking([item], { x: item.x, y: item.y }, size, base.kind);
  };

  // Symbol Sentences — direct follow-up instruction: "when you drag and
  // drop symbol sentences, they should exist as a unit, with one option
  // for 'x' to close, not individual based on word." Now spawns ONE
  // 'symbolSentence' placed item (reusing the generic tray-spawn path
  // every other material uses) instead of N separate 'shape' items —
  // the whole row moves, selects, and deletes together. Its own real
  // words stay available for the settings popup (see PlacedItem.wordFills)
  // even though the board only ever shows the symbols.
  const startDragNewSymbolSentence = (sentence: SymbolSentence) => startDragNewItem(() => ({
    kind: 'symbolSentence',
    symbolSentenceId: sentence.id,
    boxCount: sentence.words.length,
    wordFills: {},
  }));

  const startDragPlaced = (instanceId: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    pushHistory();
    dragInstanceRef.current = instanceId;
    // Direct teacher instruction: picking an item up selects it (so its
    // delete/settings badge shows), and picking up a joined Sentence
    // Formula card detaches it from whatever it was stacked under —
    // anything joined BELOW it still comes along, via getChainDescendantIds.
    setSelectedId(instanceId);
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId && pp.kind === 'sentenceFrame' ? { ...pp, joinedToId: undefined } : pp)));
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* not supported */ }
  };

  // Walks the Sentence Formula "joinedToId" chain to find every card
  // currently stacked (directly or transitively) beneath rootId — used
  // both to drag a whole paragraph stack together and to stop a join
  // from creating a cycle.
  const getChainDescendantIds = (list: PlacedItem[], rootId: string): Set<string> => {
    const result = new Set<string>();
    let frontier = [rootId];
    while (frontier.length) {
      const next: string[] = [];
      for (const p of list) {
        if (p.kind === 'sentenceFrame' && p.joinedToId && frontier.includes(p.joinedToId) && !result.has(p.instanceId)) {
          result.add(p.instanceId);
          next.push(p.instanceId);
        }
      }
      frontier = next;
    }
    return result;
  };

  const onDragMove = (e: React.PointerEvent) => {
    const id = dragInstanceRef.current;
    if (!id) return;
    const { x, y } = canvasRelative(e.clientX, e.clientY);
    setPlaced((p) => {
      const dragged = p.find((pp) => pp.instanceId === id);
      if (!dragged) return p;
      const size = sizeFor(dragged.kind, dragged.boxCount);
      const newX = x - size.w / 2;
      const newY = y - size.h / 2;
      const dx = newX - dragged.x;
      const dy = newY - dragged.y;
      const descendants = dragged.kind === 'sentenceFrame' ? getChainDescendantIds(p, id) : null;
      return p.map((pp) => {
        if (pp.instanceId === id) return { ...pp, x: newX, y: newY };
        if (descendants?.has(pp.instanceId)) return { ...pp, x: pp.x + dx, y: pp.y + dy };
        return pp;
      });
    });
  };

  // Sound Boxes — direct teacher instruction: "ensure graphemes and
  // alphabet snap into the sound box frames." A dropped letter/grapheme
  // (both use the 'letter' PlacedKind, both happen to already be the
  // same 44x44 size as one box cell) snaps to whichever cell of a
  // nearby Sound Box frame it's closest to.
  const runSoundBoxSnap = (instanceId: string) => {
    setPlaced((current) => {
      const dragged = current.find((p) => p.instanceId === instanceId);
      if (!dragged) return current;
      const cellW = 44;
      const cellGap = 4;
      const cellPitch = cellW + cellGap;
      const centerX = dragged.x + cellW / 2;
      const centerY = dragged.y + cellW / 2;
      let best: { frame: PlacedItem; cellIndex: number; dist: number } | null = null;
      for (const f of current) {
        if (f.kind !== 'frame') continue;
        const n = f.boxCount ?? 3;
        const frameW = n * cellW + (n - 1) * cellGap;
        if (centerY < f.y - 24 || centerY > f.y + cellW + 24) continue;
        if (centerX < f.x - 24 || centerX > f.x + frameW + 24) continue;
        let cellIndex = Math.round((centerX - f.x - cellW / 2) / cellPitch);
        cellIndex = Math.max(0, Math.min(n - 1, cellIndex));
        const cellCenterX = f.x + cellIndex * cellPitch + cellW / 2;
        const dist = Math.abs(centerX - cellCenterX);
        if (!best || dist < best.dist) best = { frame: f, cellIndex, dist };
      }
      if (!best) return current;
      const targetX = best.frame.x + best.cellIndex * cellPitch;
      const targetY = best.frame.y;
      return current.map((p) => (p.instanceId === instanceId ? { ...p, x: targetX, y: targetY } : p));
    });
  };

  // Sentence Formula paragraph joining — direct teacher instruction:
  // "sentence formulas can be joined together (a connection animation)
  // to stack them into a paragraph form." Dropping one card with its
  // top edge near another card's bottom edge snaps it directly beneath
  // (aligned, using the target's real measured height), records the
  // link in joinedToId, and briefly pulses both cards.
  const runFormulaJoinCheck = (instanceId: string) => {
    setPlaced((current) => {
      const dragged = current.find((p) => p.instanceId === instanceId);
      if (!dragged || dragged.kind !== 'sentenceFrame') return current;
      const descendants = getChainDescendantIds(current, instanceId);
      let bestId: string | null = null;
      let bestDist = SNAP_THRESHOLD;
      for (const p of current) {
        if (p.kind !== 'sentenceFrame' || p.instanceId === instanceId || descendants.has(p.instanceId)) continue;
        const pEl = formulaCardRefs.current.get(p.instanceId);
        const pH = pEl?.offsetHeight ?? 120;
        const targetTop = p.y + pH;
        const dx = Math.abs(dragged.x - p.x);
        const dy = Math.abs(dragged.y - targetTop);
        if (dx < 80 && dy < SNAP_THRESHOLD) {
          const dist = dx + dy;
          if (dist < bestDist) { bestDist = dist; bestId = p.instanceId; }
        }
      }
      if (!bestId) return current;
      const target = current.find((p) => p.instanceId === bestId)!;
      const targetEl = formulaCardRefs.current.get(bestId);
      const targetH = targetEl?.offsetHeight ?? 120;
      if (formulaGlowTimerRef.current) window.clearTimeout(formulaGlowTimerRef.current);
      setFormulaGlowIds(new Set([instanceId, bestId]));
      formulaGlowTimerRef.current = window.setTimeout(() => setFormulaGlowIds(new Set()), 900);
      return current.map((p) => (p.instanceId === instanceId ? { ...p, x: target.x, y: target.y + targetH + 12, joinedToId: bestId } : p));
    });
  };

  const onDragEnd = (e: React.PointerEvent) => {
    const id = dragInstanceRef.current;
    dragInstanceRef.current = null;
    if (!id) return;
    // Drag-to-delete — direct teacher instruction: "allow dragging
    // objects (like frames, boxes) back into the left tool bar and
    // that act should delete it from view." The sidebar sits directly
    // left of the canvas, so releasing to the left of the canvas's own
    // screen edge (in real screen pixels, not the zoomed logical
    // space) is "dropped back on the tray."
    const canvasLeft = canvasRef.current?.getBoundingClientRect().left ?? 0;
    if (e.clientX < canvasLeft) {
      removePlacedItem(id);
      return;
    }
    const item = placed.find((p) => p.instanceId === id);
    if (item?.kind === 'grammar') runSnapCheck(id);
    if (item?.kind === 'morpheme') runMorphemeSnapCheck(id);
    if (item?.kind === 'letter') runSoundBoxSnap(id);
    if (item?.kind === 'sentenceFrame') runFormulaJoinCheck(id);
  };

  const clearBoard = () => {
    if (placed.length === 0) return;
    pushHistory();
    setPlaced([]);
  };

  // Draw canvas — same transparent-overlay technique as the old marker
  // tool, now the only drawing mechanism (Mark and Draw merged).
  const drawPosFor = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  };

  const drawStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    drawLast.current = drawPosFor(e);
  };

  const drawMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = drawCanvasRef.current?.getContext('2d');
    if (!ctx || !drawLast.current) return;
    const p = drawPosFor(e);
    ctx.globalAlpha = drawMode === 'highlight' ? 0.35 : 1;
    ctx.lineWidth = drawMode === 'highlight' ? 22 : 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = drawColor;
    ctx.beginPath();
    ctx.moveTo(drawLast.current.x, drawLast.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawLast.current = p;
  };

  const drawEnd = () => {
    drawing.current = false;
    drawLast.current = null;
  };

  const clearDrawing = () => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // No accounts, no marketplace: everyone gets the full base pen/
  // highlight color set — the dashboard's version adds purchased colors
  // on top of these same base arrays, which doesn't apply here.
  const activePalette = drawMode === 'pen' ? BASE_PEN_COLORS : BASE_HIGHLIGHT_COLORS;

  const setDrawModeAndColor = (mode: 'pen' | 'highlight') => {
    setDrawMode(mode);
    setDrawColor(mode === 'pen' ? BASE_PEN_COLORS[0] : BASE_HIGHLIGHT_COLORS[0]);
  };

  // No teacher "Literacy Focus" account, so there's never a picklist of
  // target words for the Dictation Card — it just falls back to its
  // plain typed-word field.
  const dictationWordOptions: string[] = [];

  return (
    <div className={`lm-page${projectorMode ? ' lm-projector' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top toolbar — same collapsible bar as the dashboard's native
          tool, minus Help (tied to a student account) and Exit (there's
          no "home" to leave to in a standalone page). */}
      <div className="lm-toolbar" style={{ flex: '0 0 auto' }}>
        {topBarOpen ? (
          <>
            <span className="lm-sidebar-title" style={{ marginRight: 8 }}>🧩 Literacy Manipulatives</span>
            <button className="btn btn-sm" onClick={() => setSidebarOpen((v) => !v)} aria-label={sidebarOpen ? 'Hide materials' : 'Show materials'}>{sidebarOpen ? '⟨⟨' : '⟩⟩'}</button>
            <span className="lm-toolbar-divider" />
            <button className={`btn btn-sm ${drawOn ? 'btn-primary' : ''}`} onClick={() => setDrawOn((v) => !v)}>🖍️ Draw</button>
            <button className="btn btn-sm" onClick={addTextBoxAtDefault}>⌨️ Text</button>
            <button className="btn btn-sm" onClick={undo} disabled={!canUndo}>↩️ Undo</button>
            <button className="btn btn-sm" onClick={redo} disabled={!canRedo}>↪️ Redo</button>
            <button className="btn btn-sm" onClick={clearBoard} disabled={placed.length === 0}>🗑️ Clear</button>
            <span className="lm-toolbar-divider" />
            <button className="btn btn-sm" onClick={zoomOut} disabled={zoom <= 0.5} aria-label="Zoom out">➖</button>
            <button className="btn btn-sm" onClick={zoomReset} aria-label="Reset zoom">{Math.round(zoom * 100)}%</button>
            <button className="btn btn-sm" onClick={zoomIn} disabled={zoom >= 2} aria-label="Zoom in">➕</button>
            <span className="lm-toolbar-divider" />
            <button
              className="btn btn-sm"
              aria-label="Change read-aloud speed"
              title="Read-aloud speed"
              onClick={() => setTtsSettings((s) => ({ ...s, rate: s.rate >= 1.25 ? 0.75 : Math.round((s.rate + 0.25) * 100) / 100 }))}
            >
              🔈 {ttsSettings.rate}x
            </button>
            <span className="lm-toolbar-divider" />
            <button className="btn btn-sm" onClick={() => window.print()}>🖨️ Print</button>
            <button className={`btn btn-sm ${projectorMode ? 'btn-primary' : ''}`} onClick={toggleProjectorMode}>🖥️ Projector Mode</button>
            <span style={{ flex: 1 }} />
            <button className="btn btn-sm" onClick={() => setTopBarOpen(false)} aria-label="Hide toolbar">▲ Hide bar</button>
          </>
        ) : (
          <button className="btn btn-sm" onClick={() => setTopBarOpen(true)} aria-label="Show toolbar">▼ Show toolbar</button>
        )}
      </div>
      {topBarOpen && drawOn && (
        <div className="lm-toolbar" style={{ flex: '0 0 auto', paddingTop: 0 }}>
          <button className={`btn btn-sm ${drawMode === 'pen' ? 'btn-primary' : ''}`} onClick={() => setDrawModeAndColor('pen')}>✏️ Pen</button>
          <button className={`btn btn-sm ${drawMode === 'highlight' ? 'btn-primary' : ''}`} onClick={() => setDrawModeAndColor('highlight')}>🖊️ Highlight</button>
          <span className="lm-toolbar-divider" />
          {activePalette.map((hex, i) => (
            <button
              key={`${hex}-${i}`}
              onClick={() => setDrawColor(hex)}
              aria-label="Color"
              style={{ width: 28, height: 28, borderRadius: '50%', background: hex, cursor: 'pointer', padding: 0, border: drawColor === hex ? '3px solid var(--ink)' : '2px solid var(--content-border)' }}
            />
          ))}
          <span className="lm-toolbar-divider" />
          <button className="btn btn-sm" onClick={clearDrawing}>🗑️ Clear marks</button>
        </div>
      )}

      <div className="lm-shell" style={{ flex: 1, minHeight: 0 }}>
      {sidebarOpen ? (
        <aside className="lm-sidebar">
          <Category label="🔺 Grammar Symbols" color="#e9d5ff" open={openCategories.shapes} onToggle={() => toggleCategory('shapes')}>
            <div className="row-wrap" style={{ gap: 8 }}>
              {(Object.keys(MONTESSORI_WORD_CLASS_INFO) as MontessoriWordClass[]).map((cls) => {
                const info = MONTESSORI_WORD_CLASS_INFO[cls];
                return (
                  <Draggable key={cls} label={info.label} onPointerDown={startDragNewItem(() => ({ kind: 'shape', wordClass: cls }))}>
                    <ItemVisual kind="shape" wordClass={cls} compact />
                  </Draggable>
                );
              })}
            </div>
          </Category>

          <Category label="📜 Symbol Sentences" color="#ddd6fe" open={openCategories.symbolSentences} onToggle={() => toggleCategory('symbolSentences')}>
            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', opacity: 0.6 }}>Drag a whole sentence onto the board, symbols only!</p>
            {SYMBOL_SENTENCE_PAGES.map((page) => (
              <SubcategoryRow key={page.id} id={page.id} label={`${page.icon} ${page.label}`} open={openSubcategories[page.id]} onToggle={() => toggleSubcategory(page.id)}>
                <div className="stack" style={{ gap: 8 }}>
                  {page.sentences.map((sentence) => (
                    <SymbolSentenceCard key={sentence.id} sentence={sentence} onPointerDown={startDragNewSymbolSentence(sentence)} />
                  ))}
                </div>
              </SubcategoryRow>
            ))}
          </Category>

          <Category label="🧩 Morphemes" color="#bae6fd" open={openCategories.morphemes} onToggle={() => toggleCategory('morphemes')}>
            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', opacity: 0.6 }}>Pieces only link if they make a real word!</p>
            <SubcategoryRow id="roots" label="Roots" open={openSubcategories.roots} onToggle={() => toggleSubcategory('roots')}>
              <div className="row-wrap" style={{ gap: 8 }}>
                {MORPHEME_ROOTS.map((r) => (
                  <Draggable key={r.id} label={r.text} onPointerDown={startDragNewItem(() => ({ kind: 'morpheme', morphText: r.text, morphType: 'root', morphId: r.id }))}>
                    <ItemVisual kind="morpheme" morphText={r.text} morphType="root" />
                  </Draggable>
                ))}
              </div>
            </SubcategoryRow>
            <SubcategoryRow id="affixes" label="Prefixes & suffixes" open={openSubcategories.affixes} onToggle={() => toggleSubcategory('affixes')}>
              <div className="row-wrap" style={{ gap: 8 }}>
                {MORPHEME_PREFIXES.map((a) => (
                  <Draggable key={a.id} label={a.text} onPointerDown={startDragNewItem(() => ({ kind: 'morpheme', morphText: a.text, morphType: 'prefix', morphId: a.id }))}>
                    <ItemVisual kind="morpheme" morphText={a.text} morphType="prefix" />
                  </Draggable>
                ))}
                {MORPHEME_SUFFIXES.map((a) => (
                  <Draggable key={a.id} label={a.text} onPointerDown={startDragNewItem(() => ({ kind: 'morpheme', morphText: a.text, morphType: 'suffix', morphId: a.id }))}>
                    <ItemVisual kind="morpheme" morphText={a.text} morphType="suffix" />
                  </Draggable>
                ))}
              </div>
            </SubcategoryRow>
            {/* A23-ROADMAP Phase 3: word matrix builder + reverse
                morphology, both under Morphemes as the roadmap
                specifies, both deriving their content from the same
                MORPHEME_COMBOS the jigsaw pieces already use. */}
            <SubcategoryRow id="wordMatrix" label="Word Matrix" open={openSubcategories.wordMatrix} onToggle={() => toggleSubcategory('wordMatrix')}>
              <Draggable label="Add a Word Matrix" onPointerDown={startDragNewItem(() => ({ kind: 'wordMatrix', matrixRootId: MORPHEME_ROOTS[0].id }))} style={{ width: '100%' }}>
                <div style={{
                  width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  border: '2px dashed var(--ink)', borderRadius: 8, background: 'white', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: '0.8rem', padding: '6px 10px',
                }}>
                  🔢 Add a Word Matrix
                </div>
              </Draggable>
            </SubcategoryRow>
            <SubcategoryRow id="reverseMorph" label="Reverse Morphology" open={openSubcategories.reverseMorph} onToggle={() => toggleSubcategory('reverseMorph')}>
              <p style={{ margin: '0 0 6px', fontSize: '0.68rem', opacity: 0.6 }}>Drag a word, then try to build it out of root/prefix/suffix pieces.</p>
              <div className="stack" style={{ gap: 2 }}>
                {REVERSE_MORPH_WORDS.map((w) => (
                  <WordListRow key={`revmorph-${w}`} word={w} rowId={`revmorph-tray-${w}`} onDragStart={startDragNewItem(() => ({ kind: 'reverseMorphPrompt', reverseMorphWord: w }))} tts={tts} />
                ))}
              </div>
            </SubcategoryRow>
          </Category>

          <Category label="🔡 Alphabet" color="#fed7aa" open={openCategories.letters} onToggle={() => toggleCategory('letters')}>
            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', opacity: 0.6 }}>Double-tap a letter to flip its case!</p>
            {/* A23-ROADMAP Phase 2: vowel/consonant coloring toggle,
                shared with Graphemes below (both are letter tiles). */}
            <button type="button" className={`btn btn-sm ${vowelConsonantColors ? 'btn-primary' : ''}`} style={{ fontSize: '0.7rem', marginBottom: 6 }} onClick={() => setVowelConsonantColors((v) => !v)}>
              🎨 Vowel/consonant colors: {vowelConsonantColors ? 'On' : 'Off'}
            </button>
            <div className="row-wrap" style={{ gap: 6 }}>
              {LETTERS.map((l) => {
                const display = caseFor(l) === 'lower' ? l.toLowerCase() : l;
                return (
                  <Draggable key={l} label={display} onPointerDown={startDragNewItem(() => ({ kind: 'letter', letter: display }))} onDoubleClick={() => toggleTrayCase(l)}>
                    <ItemVisual kind="letter" letter={display} vowelConsonantColors={vowelConsonantColors} />
                  </Draggable>
                );
              })}
            </div>
          </Category>

          <Category label="🔠 Graphemes" color="#fde68a" open={openCategories.graphemes} onToggle={() => toggleCategory('graphemes')}>
            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', opacity: 0.6 }}>Multi-letter spellings only (single letters are in Alphabet). Not UFLI-verified, see code comment.</p>
            {GRAPHEME_GROUPS.map((group) => (
              <SubcategoryRow key={group.key} id={`graph-${group.key}`} label={group.label} open={openSubcategories[`graph-${group.key}`]} onToggle={() => toggleSubcategory(`graph-${group.key}`)}>
                <div className="row-wrap" style={{ gap: 4 }}>
                  {group.graphemes.map((g) => (
                    <Draggable key={g} label={g} onPointerDown={startDragNewItem(() => ({ kind: 'letter', letter: g }))}>
                      <ItemVisual kind="letter" letter={g} vowelConsonantColors={vowelConsonantColors} />
                    </Draggable>
                  ))}
                </div>
              </SubcategoryRow>
            ))}
          </Category>

          {/* The dashboard's native tool gates this per-student on a
              teacher toggle (StudentManager.tsx). No accounts here, so
              it's always on — every tool unlocked for anyone. */}
          {(
            <Category label="❓ Punctuation" color="#cbd5e1" open={openCategories.punctuation} onToggle={() => toggleCategory('punctuation')}>
              <div className="row-wrap" style={{ gap: 8 }}>
                {PUNCTUATION_MARKS.map((m) => (
                  <Draggable key={m.id} label={m.name} onPointerDown={startDragNewItem(() => ({ kind: 'punctuation', punctId: m.id }))}>
                    <ItemVisual kind="punctuation" punctId={m.id} />
                  </Draggable>
                ))}
              </div>
            </Category>
          )}

          {/* A23-ROADMAP Phase 3: "phonological awareness (sound chips,
              syllable tapping, onset-rime slider) as new sidebar
              categories" — free-play manipulatives, no target word, no
              auto-counting/auto-splitting, matching this sandbox's
              standing "entirely unscripted" rule. */}
          <Category label="🔊 Phonological Awareness" color="#fce7f3" open={openCategories.phono} onToggle={() => toggleCategory('phono')}>
            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', opacity: 0.6 }}>Drag out chips, dividers, or a tapper to work with sounds yourself.</p>
            <div className="row-wrap" style={{ gap: 10, alignItems: 'flex-start' }}>
              <Draggable label="Sound chip" onPointerDown={startDragNewItem(() => ({ kind: 'soundChip' }))}>
                <ItemVisual kind="soundChip" />
              </Draggable>
              <Draggable label="Onset-rime divider" onPointerDown={startDragNewItem(() => ({ kind: 'divider' }))}>
                <ItemVisual kind="divider" />
              </Draggable>
              <Draggable label="Add a Syllable Tapper" onPointerDown={startDragNewItem(() => ({ kind: 'syllableTapper', textValue: '', tapCount: 0 }))}>
                <div style={{
                  minWidth: 130, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  border: '2px dashed var(--ink)', borderRadius: 8, background: 'white', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: '0.8rem', padding: '6px 10px',
                }}>
                  👏 Syllable Tapper
                </div>
              </Draggable>
            </div>
          </Category>

          <Category label="🟦 Sound Boxes" color="#bbf7d0" open={openCategories.frames} onToggle={() => toggleCategory('frames')}>
            <div className="stack" style={{ gap: 10 }}>
              {FRAME_SIZES.map((n) => (
                <Draggable key={n} label={`${n}-box frame`} onPointerDown={startDragNewItem(() => ({ kind: 'frame', boxCount: n }))}>
                  <ItemVisual kind="frame" boxCount={n} />
                </Draggable>
              ))}
            </div>
          </Category>

          <Category label="⌨️ Text Box" color="#c7d2fe" open={openCategories.textbox} onToggle={() => toggleCategory('textbox')}>
            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', opacity: 0.6 }}>Double-tap a text box to type, speak, or resize the text.</p>
            <Draggable label="Add a text box" onPointerDown={startDragNewItem(() => ({ kind: 'textbox', textValue: '', fontSize: 20 }))} style={{ width: '100%' }}>
              <div style={{
                width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                border: '2px dashed var(--ink)', borderRadius: 8, background: 'white', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: '0.85rem', padding: '6px 10px',
              }}>
                ⌨️ Add a text box
              </div>
            </Draggable>
          </Category>

          <Category label="📐 Sentence Formulas" color="#fbcfe8" open={openCategories.formulas} onToggle={() => toggleCategory('formulas')}>
            <div className="row-wrap" style={{ gap: 4 }}>
              {FORMULA_CATEGORIES.map((c) => (
                <button key={c.id} className={`btn btn-sm ${sfCategoryId === c.id ? 'btn-primary' : ''}`} style={{ padding: '3px 8px', fontSize: '0.75rem', minHeight: 30, minWidth: 30 }} onClick={() => setSfCategoryId(c.id)} title={c.label}>{c.icon}</button>
              ))}
            </div>
            <div className="stack" style={{ gap: 2, marginTop: 8 }}>
              {SENTENCE_FORMULAS.filter((f) => f.category === sfCategoryId).map((f) => (
                <button key={f.id} className="btn btn-sm" style={{ textAlign: 'left', fontSize: '0.78rem', minHeight: 32 }} onClick={() => addSentenceFrame(f.id)}>➕ {f.name}</button>
              ))}
            </div>
          </Category>

          {/* The dashboard's native tool has a teacher-curated "Word
              Lists" category here (Literacy Focus words), tied to a
              teacher/student account. This standalone v1 has no
              accounts, so that category is intentionally left out —
              dictationWordOptions below is always empty as a result,
              which just means the Dictation Card falls back to its
              plain typed-word field instead of a picklist. */}

          {/* A23-ROADMAP Phase 3: "word chains, ... reusing the Morphemes
              'connects only if real, never punitive' pattern" — every
              word here is real, each chain is a real one-letter-swap
              ladder (see wordChainContent.ts); reuses WordListRow, the
              same plain-reference-row-that's-also-draggable pattern Word
              Lists already established. */}
          <Category label="🔗 Word Chains" color={LM_WORD_CHAIN_COLOR} open={openCategories.wordChains} onToggle={() => toggleCategory('wordChains')}>
            {WORD_CHAINS.map((chain) => (
              <SubcategoryRow key={chain.id} id={`chain-${chain.id}`} label={chain.label} open={openSubcategories[`chain-${chain.id}`]} onToggle={() => toggleSubcategory(`chain-${chain.id}`)}>
                <div className="stack" style={{ gap: 2 }}>
                  {chain.words.map((w, i) => (
                    <WordListRow key={`${chain.id}-${i}-${w}`} word={w} rowId={`chain-${chain.id}-${i}`} onDragStart={startDragNewItem(() => ({ kind: 'letter', letter: w }))} tts={tts} />
                  ))}
                </div>
              </SubcategoryRow>
            ))}
          </Category>

          {/* A23-ROADMAP Phase 3: heart words — a student taps each
              letter of a placed word to mark it as a "heart" (tricky)
              letter themselves, rather than the app asserting a
              possibly-wrong "correct" irregular part (see
              heartWordContent.ts's own comment for why). */}
          <Category label="❤️ Heart Words" color="#fecdd3" open={openCategories.heartWords} onToggle={() => toggleCategory('heartWords')}>
            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', opacity: 0.6 }}>Drag a word onto the board, then tap its tricky letters to mark them with a heart.</p>
            <div className="stack" style={{ gap: 2 }}>
              {HEART_WORDS.map((hw) => (
                <WordListRow
                  key={hw.id}
                  word={hw.word}
                  rowId={`hw-tray-${hw.id}`}
                  onDragStart={startDragNewItem(() => ({ kind: 'heartWord', heartWordId: hw.id, boxCount: hw.word.length, heartIndices: [] }))}
                  tts={tts}
                />
              ))}
            </div>
          </Category>

          {/* A23-ROADMAP Phase 3: spelling rule reference cards. */}
          <Category label="📏 Spelling Rules" color={LM_SPELLING_RULE_COLOR} open={openCategories.spellingRules} onToggle={() => toggleCategory('spellingRules')}>
            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', opacity: 0.6 }}>Hover or focus a card to read the rule and an example.</p>
            <div className="row-wrap" style={{ gap: 8 }}>
              {SPELLING_RULES.map((r) => (
                <Draggable key={r.id} label={r.title} onPointerDown={startDragNewItem(() => ({ kind: 'spellingRule', ruleId: r.id }))}>
                  <ItemVisual kind="spellingRule" ruleId={r.id} />
                </Draggable>
              ))}
            </div>
          </Category>

          {/* A23-ROADMAP Phase 3: dictation mode. Deliberately NOT
              randomized (a prior direct teacher instruction removed
              every randomize/surprise-me mechanic app-wide) — the
              student or teacher picks the dictation word manually from
              a dropdown/typed field on the card itself, never an
              auto-picked one. */}
          <Category label="🎧 Dictation" color={LM_DICTATION_COLOR} open={openCategories.dictation} onToggle={() => toggleCategory('dictation')}>
            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', opacity: 0.6 }}>Pick a word, hear it, write what you heard, then reveal to check yourself.</p>
            <Draggable label="Add a Dictation Card" onPointerDown={startDragNewItem(() => ({ kind: 'dictation', dictationPrompt: '', textValue: '' }))} style={{ width: '100%' }}>
              <div style={{
                width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                border: '2px dashed var(--ink)', borderRadius: 8, background: 'white', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: '0.85rem', padding: '6px 10px',
              }}>
                🎧 Add a Dictation Card
              </div>
            </Draggable>
          </Category>

          {/* A23-ROADMAP Phase 3: writing scaffolds. See
              writingScaffoldContent.ts for the fade-level judgment call
              logged there. */}
          <Category label="📝 Writing Scaffolds" color={LM_WRITING_SCAFFOLD_COLOR} open={openCategories.writingScaffolds} onToggle={() => toggleCategory('writingScaffolds')}>
            <SubcategoryRow id="writingFrames" label="Writing Frames" open={openSubcategories.writingFrames} onToggle={() => toggleSubcategory('writingFrames')}>
              <div className="stack" style={{ gap: 4 }}>
                {WRITING_FRAMES.map((f) => (
                  <Draggable key={f.id} label={f.title} onPointerDown={startDragNewItem(() => ({ kind: 'writingFrame', writingFrameId: f.id, frameFills: {} }))} style={{ width: '100%' }}>
                    <div style={{ width: '100%', textAlign: 'left', padding: '6px 8px', border: '2px solid var(--ink)', borderRadius: 8, background: 'white', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: '0.78rem' }}>
                      📝 {f.title}
                    </div>
                  </Draggable>
                ))}
              </div>
            </SubcategoryRow>
            <SubcategoryRow id="sentenceStarters" label="Sentence Starters" open={openSubcategories.sentenceStarters} onToggle={() => toggleSubcategory('sentenceStarters')}>
              <div className="stack" style={{ gap: 2 }}>
                {SENTENCE_STARTERS.map((s) => (
                  <WordListRow key={s} word={s} rowId={`starter-${s}`} onDragStart={startDragNewItem(() => ({ kind: 'letter', letter: s }))} tts={tts} />
                ))}
              </div>
            </SubcategoryRow>
          </Category>
        </aside>
      ) : null}

      <div className="lm-main">
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <div
            ref={canvasRef}
            className="lm-canvas"
            style={{ position: 'relative', height: '100%', pointerEvents: drawOn ? 'none' : undefined, transform: `scale(${zoom})`, transformOrigin: '0 0' }}
            onPointerDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
          >
            {placed.filter((p) => p.kind !== 'sentenceFrame' && p.kind !== 'textbox' && p.kind !== 'symbolSentence' && p.kind !== 'syllableTapper' && p.kind !== 'heartWord' && p.kind !== 'dictation' && p.kind !== 'wordMatrix' && p.kind !== 'reverseMorphPrompt' && p.kind !== 'writingFrame').map((p) => (
              // Sound Boxes sit behind everything else on purpose (a
              // background a student drops letters onto, direct teacher
              // report: letter/grapheme tiles were rendering behind the
              // box outlines) — every other kind gets the higher z-index.
              <div key={p.instanceId} style={{ position: 'absolute', left: p.x, top: p.y, zIndex: p.kind === 'frame' ? 1 : 2 }}>
                <Draggable
                  label="Placed item"
                  glowing={glowIds.has(p.instanceId)}
                  onPointerDown={startDragPlaced(p.instanceId)}
                  onPointerMove={onDragMove}
                  onPointerUp={onDragEnd}
                  onDoubleClick={p.kind === 'letter' ? () => toggleLetterCase(p.instanceId) : undefined}
                  style={selectedId === p.instanceId ? { boxShadow: '0 0 0 3px rgba(124,58,237,0.35)', borderRadius: 10 } : undefined}
                >
                  <ItemVisual kind={p.kind} pieceId={p.pieceId} wordClass={p.wordClass} letter={p.letter} boxCount={p.boxCount} morphText={p.morphText} morphType={p.morphType} punctId={p.punctId} vowelConsonantColors={vowelConsonantColors} ruleId={p.ruleId} />
                </Draggable>
                {/* Delete (+ Settings for a single Grammar Symbol) —
                    direct teacher instruction: "ensure that after i drag
                    and drop, the x is not shown on the assets on the
                    whiteboard. only show x upon moving or selected.
                    (click to view x on touchscreen)." Picking an item up
                    (startDragPlaced) selects it, so the badge stays
                    visible through the whole drag and after, until
                    something else is selected or empty canvas is tapped.
                    Follow-up instruction: "have the same setting button
                    appear for single grammar symbols" (matching the
                    Symbol Sentence ⚙️/✕ pair). */}
                {selectedId === p.instanceId && (
                  <div className="lm-item-controls" style={{ position: 'absolute', top: -10, right: -10, display: 'flex', gap: 4, zIndex: 3 }}>
                    {/* A23-ROADMAP Phase 3: Elkonin-boxes-v2 flexible
                        count — a selected Sound Box frame can grow/shrink
                        live instead of only ever being the fixed size it
                        was dragged out at. */}
                    {p.kind === 'frame' && (
                      <>
                        <button
                          type="button"
                          onClick={() => adjustFrameBoxCount(p.instanceId, -1)}
                          onPointerDown={(e) => e.stopPropagation()}
                          aria-label="Remove a box"
                          title="Remove a box"
                          disabled={(p.boxCount ?? 3) <= 1}
                          style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--ink)', background: 'white', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustFrameBoxCount(p.instanceId, 1)}
                          onPointerDown={(e) => e.stopPropagation()}
                          aria-label="Add a box"
                          title="Add a box"
                          disabled={(p.boxCount ?? 3) >= 8}
                          style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--ink)', background: 'white', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                        >
                          +
                        </button>
                      </>
                    )}
                    {p.kind === 'shape' && (
                      <button
                        type="button"
                        onClick={() => setOpenShapeSettings((v) => (v === p.instanceId ? null : p.instanceId))}
                        onPointerDown={(e) => e.stopPropagation()}
                        aria-label="Grammar Symbol settings"
                        title="Settings"
                        style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--ink)', background: 'white', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                      >
                        ⚙️
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removePlacedItem(p.instanceId)}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-label="Remove"
                      style={{
                        width: 20, height: 20, borderRadius: '50%',
                        border: '2px solid var(--ink)', background: '#fee2e2', color: '#991b1b', fontSize: 11, fontWeight: 900,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, lineHeight: 1,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
                {/* Direct follow-up instruction: "when settings appear, if
                    you click to add a text field, it should appear and
                    stay, same as adding a text box... same text box
                    feature should appear with single grammar symbols."
                    Rather than a new lightweight widget, this spawns a
                    real, independent Text Box item next to the symbol —
                    the exact same persistent, double-tap-to-edit,
                    resizable, STT-capable tool the sidebar's own Text Box
                    already is, so "add a text field" really is "add a
                    text box." */}
                {p.kind === 'shape' && selectedId === p.instanceId && openShapeSettings === p.instanceId && (
                  <div className="chrome-frame" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 12, padding: 8, width: 170 }} onPointerDown={(e) => e.stopPropagation()}>
                    <button type="button" className="btn btn-sm" style={{ width: '100%', fontSize: '0.75rem' }} onClick={() => addTextFieldNearShape(p.instanceId)}>
                      ⌨️ Add a text field
                    </button>
                  </div>
                )}
              </div>
            ))}
            {/* Word Web — A23-ROADMAP Phase 3 ("word webs... under
                Morphemes"): rather than reviving the earlier, explicitly-
                removed radial tap-to-attach mode (redundant with the
                jigsaw pieces under the one-canvas model, per this file's
                own 2026-09-22 build log), this is a lightweight visual
                layered ON TOP of the existing jigsaw connections: a
                faint connector line from each connected root to each of
                its connected affixes, derived from the same
                morphemeCombos data the definition cards below already
                use. When two or more affixes connect to the same root,
                the lines fan out into a real web, with zero new
                interaction model. */}
            {morphemeCombos.length > 0 && (
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} aria-hidden="true">
                {morphemeCombos.map((c) => (
                  <line key={`web-${c.id}`} x1={c.x + 48} y1={c.y + 32} x2={c.seamX + 20} y2={c.y + 32} stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 3" />
                ))}
              </svg>
            )}
            {/* Morpheme definitions — direct teacher instruction: only
                appears once a piece combination is a real word, pulled
                from the root's own etymology plus the affix's ordinary
                meaning. Follow-up instruction: "add TTS for definitons
                of combined words using morphemes." */}
            {morphemeCombos.map((c) => {
              // A23-ROADMAP Phase 1: generalized into ReferencePopover
              // (inline mode) with synced word-highlighting — the visible
              // body text is now the exact same string that's spoken
              // (word + definition + etymology as one flowing passage),
              // so the highlighted word always matches what's on screen.
              // A23-ROADMAP Phase 2: a detected join rule's plain-language
              // note is appended to both the spoken and visible text.
              const spokenText = `${c.word}. ${c.definition}${c.etymology ? `. ${c.etymology}` : ''}${c.joinRuleNote ? ` ${c.joinRuleNote}` : ''}`;
              const speakId = `morph-${c.id}`;
              return (
                <div key={c.id}>
                  <ReferencePopover
                    mode="inline"
                    title="✨ Real word!"
                    body={<HighlightedText text={spokenText} active={tts.activeId === speakId} wordIndex={tts.wordIndex} />}
                    speakId={speakId}
                    speakText={spokenText}
                    tts={tts}
                    settings={ttsSettings}
                    style={{ position: 'absolute', left: c.x - 20, top: c.y + 72, width: 240, padding: 8, fontSize: '0.72rem', zIndex: 3 }}
                  />
                  {/* Join-rule animation, visible right at the seam
                      between the two puzzle pieces (not just named in
                      the card text below) — a small badge that pops in
                      once, per the spec's own "visible at the seam"
                      wording. */}
                  {c.joinRule && (
                    <div
                      className="lm-morpheme-join-badge"
                      style={{ position: 'absolute', left: c.seamX + 30, top: c.y - 20, zIndex: 4 }}
                      title={c.joinRuleNote ?? undefined}
                    >
                      {c.joinRule === 'e-drop' ? 'e̶' : '××'}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Symbol Sentences, placed as one unit — direct follow-up
                instructions: they drag/select/delete as a whole (not
                per-symbol), and a selected one also shows a ⚙️ settings
                button opening per-word text inputs (like Sentence
                Formula blanks) so a student can label the words under
                the symbols as the curriculum moves them toward full
                Sentence Formulas. */}
            {placed.filter((p) => p.kind === 'symbolSentence').map((item) => {
              const sentence = ALL_SYMBOL_SENTENCES.find((s) => s.id === item.symbolSentenceId);
              if (!sentence) return null;
              const fills = item.wordFills ?? {};
              const selected = selectedId === item.instanceId;
              return (
                <div key={item.instanceId} style={{ position: 'absolute', left: item.x, top: item.y, zIndex: 2 }}>
                  <Draggable
                    label={sentence.sentence}
                    glowing={false}
                    onPointerDown={startDragPlaced(item.instanceId)}
                    onPointerMove={onDragMove}
                    onPointerUp={onDragEnd}
                    style={selected ? { boxShadow: '0 0 0 3px rgba(124,58,237,0.35)', borderRadius: 10, padding: 2 } : { padding: 2 }}
                  >
                    <div style={{ display: 'flex', gap: 4 }}>
                      {sentence.words.map((w, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: 44 }}>
                          <img src={MONTESSORI_WORD_CLASS_INFO[w.wordClass].imageUrl} alt={w.word} draggable={false} style={{ width: 40, height: 40, objectFit: 'contain', pointerEvents: 'none' }} />
                          {fills[i] && <span style={{ fontSize: '0.62rem', fontWeight: 700, textAlign: 'center' }}>{fills[i]}</span>}
                        </div>
                      ))}
                    </div>
                  </Draggable>
                  {selected && (
                    <div className="lm-item-controls" style={{ position: 'absolute', top: -12, right: -12, display: 'flex', gap: 4, zIndex: 3 }}>
                      <button
                        type="button"
                        onClick={() => setOpenSymbolSentenceSettings((v) => (v === item.instanceId ? null : item.instanceId))}
                        onPointerDown={(e) => e.stopPropagation()}
                        aria-label="Symbol Sentence settings"
                        title="Settings"
                        style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--ink)', background: 'white', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                      >
                        ⚙️
                      </button>
                      <button
                        type="button"
                        onClick={() => removePlacedItem(item.instanceId)}
                        onPointerDown={(e) => e.stopPropagation()}
                        aria-label="Remove this Symbol Sentence"
                        style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--ink)', background: '#fee2e2', color: '#991b1b', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {selected && openSymbolSentenceSettings === item.instanceId && (
                    <div className="chrome-frame" style={{ position: 'absolute', top: '110%', left: 0, zIndex: 12, padding: 8, width: Math.max(220, sentence.words.length * 60) }} onPointerDown={(e) => e.stopPropagation()}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: 6, opacity: 0.7 }}>Type each word</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {sentence.words.map((w, i) => (
                          <input
                            key={i}
                            value={fills[i] ?? ''}
                            onChange={(e) => setSymbolSentenceWordFill(item.instanceId, i, e.target.value)}
                            placeholder={w.word}
                            style={{ width: 52, border: '2px solid var(--content-border)', borderRadius: 6, padding: '4px 4px', fontSize: '0.75rem', textAlign: 'center' }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Sentence Formula frames — self-contained widgets whose
                internal clickable blanks never fight canvas-drag pointer
                handling (only the title-bar "handle" starts a drag).
                Direct follow-up instruction: "sentence formulas can be
                moved around the whiteboard" / "joined together... to
                stack them into a paragraph form." */}
            {placed.filter((p) => p.kind === 'sentenceFrame').map((item) => {
              const formula = SENTENCE_FORMULAS.find((f) => f.id === item.formulaId);
              if (!formula) return null;
              const fills = item.frameFills ?? {};
              const tense: FormulaTense = item.tense ?? 'present';
              const whoIdx = formula.segments.findIndex((s) => s.kind === 'slot' && s.slot === 'who');
              const whoText = whoIdx >= 0 ? fills[whoIdx] : undefined;
              const whoVerbForm: 'singular' | 'plural' | null = whoText ? (WHO_WORDS.find((w) => w.text === whoText)?.verbForm ?? 'singular') : null;
              const isComplete = formula.segments.every((seg, i) => seg.kind !== 'slot' || (fills[i] && fills[i].trim()));
              const sentenceText = formula.segments.map((seg, i) => {
                if (seg.kind === 'fixed') return seg.text;
                if (seg.kind === 'aux') return auxWordFor(seg.auxType, whoText, WHO_WORDS);
                return fills[i] ?? '';
              }).join(' ').replace(/\s+([.!?])/g, '$1');
              // Grammar check — direct teacher instruction: "a check
              // notification... check for tenses, accuracy, plurals,
              // etc. and give a notice if it is a correct sentence or
              // if it needs improvement. tell exactly what needs to
              // improve." Checks each typed/picked word against the
              // same tense-and-plural-aware word bank the dropdown
              // itself offers (wordBankFor/actionWordsFor) — the exact
              // data already driving "correct" choices, not a new or
              // fabricated grammar judgment.
              const checkResults = isComplete ? formula.segments.map((seg, i) => {
                if (seg.kind !== 'slot') return null;
                const typed = (fills[i] ?? '').trim();
                if (!typed) return null;
                const bank = seg.slot === 'action' ? actionWordsForTense(whoVerbForm, seg.verbFormOverride, tense) : wordBankFor(seg.slot, 'general', whoVerbForm);
                const ok = bank.some((o) => o.text.toLowerCase() === typed.toLowerCase());
                return { label: SLOT_LABELS[seg.slot], typed, ok, suggestions: bank.slice(0, 4).map((o) => o.text) };
              }).filter((r): r is { label: string; typed: string; ok: boolean; suggestions: string[] } => r !== null) : [];
              // Capitalization check — direct follow-up instruction:
              // "sentence formulas must check and prompt
              // capitalization." Two honest, well-established rules
              // (not a general grammar judgment): the sentence's own
              // first fillable word must start with a capital letter,
              // and "I" is always capitalized wherever it appears.
              const capIssues: string[] = [];
              if (isComplete) {
                if (formula.segments[0]?.kind === 'slot') {
                  const first = (fills[0] ?? '').trim();
                  if (first && first[0] !== first[0].toUpperCase()) {
                    capIssues.push('Start your sentence with a capital letter.');
                  }
                }
                formula.segments.forEach((seg, i) => {
                  if (seg.kind === 'slot' && (fills[i] ?? '').trim() === 'i') {
                    capIssues.push('The word "I" is always capitalized, even in the middle of a sentence.');
                  }
                });
                if (whoIdx >= 0) {
                  const whoTyped = (fills[whoIdx] ?? '').trim();
                  const properMatch = PROPER_NOUNS.find((p) => p.text.toLowerCase() === whoTyped.toLowerCase());
                  if (properMatch && whoTyped && whoTyped !== properMatch.text) {
                    capIssues.push(`"${whoTyped}" names a person, so it should be written "${properMatch.text}" with a capital letter.`);
                  }
                }
              }
              const wordIssues = checkResults.filter((r) => !r.ok);
              const hasCheck = checkResults.length > 0 || capIssues.length > 0;
              const allOk = wordIssues.length === 0 && capIssues.length === 0;
              const checkSpeech = !hasCheck ? '' : [
                allOk ? 'This sentence looks correct!' : 'Here is a check for your sentence.',
                ...wordIssues.map((r) => `For ${r.label}, you wrote ${r.typed}. Words that usually fit here are ${r.suggestions.join(', ')}.`),
                ...capIssues,
              ].join(' ');
              // Direct teacher instruction: "when a correct sentence is
              // made using formulas, it should appear in a text field
              // (completed sentence with punctuation, capitalization)."
              const displaySentenceText = sentenceText ? sentenceText.charAt(0).toUpperCase() + sentenceText.slice(1) : sentenceText;
              return (
                <div
                  key={item.instanceId}
                  ref={(el) => { if (el) formulaCardRefs.current.set(item.instanceId, el); else formulaCardRefs.current.delete(item.instanceId); }}
                  className={`chrome-frame${formulaGlowIds.has(item.instanceId) ? ' lm-formula-glow' : ''}`}
                  style={{ position: 'absolute', left: item.x, top: item.y, padding: 12, maxWidth: 640, zIndex: 4 }}
                >
                  {/* A small connector shows this card is stacked into a
                      paragraph with the one above it. */}
                  {item.joinedToId && <div style={{ textAlign: 'center', fontSize: 12, marginBottom: 4, opacity: 0.6 }} aria-hidden="true">🔗 joined</div>}
                  <div className="space-between" style={{ marginBottom: 8, alignItems: 'center' }}>
                    {/* Direct follow-up instruction: "sentence formulas can
                        be moved around the whiteboard." Only the title
                        text is the drag handle, so the blanks/buttons
                        below never fight canvas-drag pointer handling. */}
                    <strong
                      style={{ fontSize: '0.85rem', cursor: 'grab', touchAction: 'none' }}
                      onPointerDown={startDragPlaced(item.instanceId)}
                      onPointerMove={onDragMove}
                      onPointerUp={onDragEnd}
                    >
                      {formula.name}
                    </strong>
                    {/* Direct teacher instruction: settings (tense) and
                        duplicate buttons to the left of the x, "all three
                        buttons... small, but the same size. slighly
                        smaller than the current x button." */}
                    <div className="lm-item-controls" style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'relative' }}>
                      <button
                        className="btn btn-sm"
                        style={{ width: 30, height: 30, minHeight: 30, minWidth: 30, padding: 0, fontSize: '0.85rem' }}
                        onClick={() => setOpenFormulaSettings((v) => (v === item.instanceId ? null : item.instanceId))}
                        aria-label="Sentence Formula settings"
                        title="Settings"
                      >
                        ⚙️
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ width: 30, height: 30, minHeight: 30, minWidth: 30, padding: 0, fontSize: '0.85rem' }}
                        onClick={() => duplicateFormula(item.instanceId)}
                        aria-label="Duplicate this Sentence Formula"
                        title="Duplicate"
                      >
                        ⧉
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ width: 30, height: 30, minHeight: 30, minWidth: 30, padding: 0, fontSize: '0.85rem' }}
                        onClick={() => removePlacedItem(item.instanceId)}
                        aria-label="Remove this Sentence Formula"
                      >
                        ✕
                      </button>
                      {openFormulaSettings === item.instanceId && (
                        <div className="chrome-frame" style={{ position: 'absolute', top: '110%', right: 0, zIndex: 12, padding: 8, width: 160 }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, marginBottom: 6, opacity: 0.7 }}>Tense</div>
                          <div className="row-wrap" style={{ gap: 4 }}>
                            {(Object.keys(TENSE_LABELS) as FormulaTense[]).map((t) => (
                              <button
                                key={t}
                                className={`btn btn-sm ${tense === t ? 'btn-primary' : ''}`}
                                style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                                onClick={() => { setFormulaTense(item.instanceId, t); setOpenFormulaSettings(null); }}
                              >
                                {TENSE_LABELS[t]}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="row-wrap" style={{ gap: 6, alignItems: 'center' }}>
                    {formula.segments.map((seg, i) => {
                      if (seg.kind === 'fixed') return <span key={i} style={{ fontWeight: 700 }}>{seg.text}</span>;
                      if (seg.kind === 'aux') return <span key={i} style={{ fontWeight: 700, fontStyle: 'italic', opacity: 0.75 }}>{auxWordFor(seg.auxType, whoText, WHO_WORDS)}</span>;
                      const montClass = SLOT_MONTESSORI_CLASS[seg.slot];
                      const color = montClass ? MONTESSORI_WORD_CLASS_INFO[montClass].color : 'var(--content-border)';
                      const bank = seg.slot === 'action' ? actionWordsForTense(whoVerbForm, seg.verbFormOverride, tense) : wordBankFor(seg.slot, 'general', whoVerbForm);
                      const pickerKey = `${item.instanceId}:${i}`;
                      return (
                        <FormulaBlankField
                          key={i}
                          value={fills[i] ?? ''}
                          onType={(v) => setFrameFill(item.instanceId, i, v)}
                          onPick={(text) => { setFrameFill(item.instanceId, i, text); setOpenFramePicker(null); }}
                          placeholder={SLOT_LABELS[seg.slot]}
                          color={color}
                          bank={bank}
                          open={openFramePicker === pickerKey}
                          onToggleOpen={() => setOpenFramePicker((v) => (v === pickerKey ? null : pickerKey))}
                        />
                      );
                    })}
                  </div>
                  {isComplete && (
                    <div style={{ marginTop: 10 }}>
                      {/* A23-ROADMAP Phase 1: was a read-only <input>, now a
                          styled div so the synced-TTS word highlight can
                          render inside it while a voice button below reads
                          it aloud (an <input>'s value can't hold markup). */}
                      <div
                        role="textbox"
                        aria-readonly="true"
                        aria-label="Completed sentence"
                        style={{ width: '100%', boxSizing: 'border-box', fontWeight: 700, fontFamily: "'Baloo 2', sans-serif", fontSize: '0.9rem', border: '2px solid var(--ink)', borderRadius: 6, padding: '6px 8px', background: 'white' }}
                      >
                        <HighlightedText text={displaySentenceText} active={tts.activeId === `sf-${item.instanceId}`} wordIndex={tts.wordIndex} />
                      </div>
                      <div className="row-wrap" style={{ gap: 6, marginTop: 6, alignItems: 'center' }}>
                        <button className="btn btn-sm" onClick={() => tts.speakSynced(`sf-${item.instanceId}`, sentenceText, ttsSettings)}>🔈 Read it</button>
                        <button className="btn btn-sm" onClick={() => pasteSentenceToTextBox(displaySentenceText)} title="Add this sentence to your paragraph text box">📋 Add to paragraph</button>
                      </div>
                    </div>
                  )}
                  {/* Grammar + capitalization check — direct teacher
                      instruction, calm SEL framing (never "wrong",
                      just what to check), always has a 🔈 to hear the
                      notice either way. */}
                  {hasCheck && (
                    <div className="chrome-frame" style={{ marginTop: 10, padding: 8, fontSize: '0.75rem', background: allOk ? '#f0fdf4' : '#fffbeb' }}>
                      <div className="space-between" style={{ alignItems: 'center', marginBottom: allOk ? 0 : 4 }}>
                        <strong>{allOk ? '✅ Looks correct!' : '💡 A few things to check'}</strong>
                        {/* A23-ROADMAP Phase 1: shared synced-TTS engine.
                            No word-highlight rendered against the bullet
                            list below, since its wording is reformatted
                            for scanning (not the same string as
                            checkSpeech) — highlighting against mismatched
                            text would mislead more than help, a deliberate
                            scope call rather than an oversight. */}
                        <SyncedSpeakButton id={`check-${item.instanceId}`} text={checkSpeech} tts={tts} settings={ttsSettings} style={{ padding: '2px 8px', minHeight: 26 }} ariaLabel="Hear the check" />
                      </div>
                      {!allOk && (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {wordIssues.map((r, i) => (
                            <li key={`w${i}`}>
                              <strong>{r.label}:</strong> "{r.typed}" — words that usually fit here: {r.suggestions.join(', ')}
                            </li>
                          ))}
                          {capIssues.map((msg, i) => (
                            <li key={`c${i}`}>{msg}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {placed.filter((p) => p.kind === 'textbox').map((item) => (
              <TextBoxWidget
                key={item.instanceId}
                item={item}
                onPointerDown={startDragPlaced(item.instanceId)}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onTextChange={(v) => setTextBoxValue(item.instanceId, v)}
                onFontSizeChange={(d) => setTextBoxFontSize(item.instanceId, d)}
                onRemove={() => removePlacedItem(item.instanceId)}
                onActivate={() => setActiveTextBoxId(item.instanceId)}
              />
            ))}
            {placed.filter((p) => p.kind === 'syllableTapper').map((item) => (
              <SyllableTapperWidget
                key={item.instanceId}
                item={item}
                onPointerDown={startDragPlaced(item.instanceId)}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onWordChange={(v) => setSyllableWord(item.instanceId, v)}
                onTapCountChange={(c) => setSyllableTapCount(item.instanceId, c)}
                onRemove={() => removePlacedItem(item.instanceId)}
              />
            ))}
            {placed.filter((p) => p.kind === 'dictation').map((item) => (
              <DictationWidget
                key={item.instanceId}
                item={item}
                wordOptions={dictationWordOptions}
                onPointerDown={startDragPlaced(item.instanceId)}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPromptChange={(v) => setDictationPrompt(item.instanceId, v)}
                onAnswerChange={(v) => setDictationAnswer(item.instanceId, v)}
                onRemove={() => removePlacedItem(item.instanceId)}
                tts={tts}
                settings={ttsSettings}
              />
            ))}
            {placed.filter((p) => p.kind === 'wordMatrix').map((item) => (
              <WordMatrixWidget
                key={item.instanceId}
                item={item}
                onPointerDown={startDragPlaced(item.instanceId)}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onRootChange={(rootId) => setMatrixRoot(item.instanceId, rootId)}
                onRemove={() => removePlacedItem(item.instanceId)}
              />
            ))}
            {/* Reverse Morphology prompt cards — same "title text is the
                drag handle" pattern Sentence Formula cards established,
                so the 🔈/✕ buttons in the body never fight canvas-drag. */}
            {placed.filter((p) => p.kind === 'reverseMorphPrompt').map((item) => {
              const word = item.reverseMorphWord ?? '';
              const speakId = `revmorph-${item.instanceId}`;
              const promptText = `Can you build "${word}" using morpheme pieces? Look for a root and one or more prefixes or suffixes that combine to make this word.`;
              return (
                <div
                  key={item.instanceId}
                  className="chrome-frame"
                  style={{ position: 'absolute', left: item.x, top: item.y, width: 220, padding: 8, fontSize: '0.72rem', zIndex: 4 }}
                >
                  <div className="space-between" style={{ alignItems: 'center', marginBottom: 4 }}>
                    <strong style={{ cursor: 'grab', touchAction: 'none', fontSize: '0.78rem' }} onPointerDown={startDragPlaced(item.instanceId)} onPointerMove={onDragMove} onPointerUp={onDragEnd}>
                      🔁 Build "{word}"
                    </strong>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <SyncedSpeakButton id={speakId} text={promptText} tts={tts} settings={ttsSettings} style={{ padding: '2px 6px', minHeight: 22 }} />
                      <button type="button" className="btn btn-sm" style={{ padding: '2px 6px', minHeight: 22 }} onClick={() => removePlacedItem(item.instanceId)} aria-label="Remove this prompt">✕</button>
                    </div>
                  </div>
                  <div>
                    <HighlightedText text={promptText} active={tts.activeId === speakId} wordIndex={tts.wordIndex} />
                  </div>
                </div>
              );
            })}
            {/* Writing Scaffolds — reuses the existing frameFills/
                setFrameFill (already built for Sentence Formulas) and
                pasteSentenceToTextBox (already built for "Add to
                paragraph"), so a Writing Frame's assembled text can join
                the same running paragraph Sentence Formulas already
                build into. */}
            {placed.filter((p) => p.kind === 'writingFrame').map((item) => {
              const frame = WRITING_FRAMES.find((f) => f.id === item.writingFrameId);
              if (!frame) return null;
              const fills = item.frameFills ?? {};
              const assembled = frame.lines.map((line, i) => `${line}${fills[i] ?? ''}`).join(' ').trim();
              const speakId = `wf-${item.instanceId}`;
              return (
                <div key={item.instanceId} className="chrome-frame" style={{ position: 'absolute', left: item.x, top: item.y, padding: 10, width: 280, zIndex: 4 }}>
                  <div className="space-between" style={{ alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ cursor: 'grab', touchAction: 'none', fontSize: '0.8rem' }} onPointerDown={startDragPlaced(item.instanceId)} onPointerMove={onDragMove} onPointerUp={onDragEnd}>
                      📝 {frame.title}
                    </strong>
                    <button type="button" className="btn btn-sm" onClick={() => removePlacedItem(item.instanceId)} aria-label={`Remove ${frame.title}`}>✕</button>
                  </div>
                  <div className="stack" style={{ gap: 6 }}>
                    {frame.lines.map((line, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{line}</span>
                        <input
                          value={fills[i] ?? ''}
                          onChange={(e) => setFrameFill(item.instanceId, i, e.target.value)}
                          style={{ flex: 1, border: '2px solid var(--content-border)', borderRadius: 6, padding: '4px 6px', fontSize: '0.8rem', minWidth: 0 }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="row-wrap" style={{ gap: 6, marginTop: 8, alignItems: 'center' }}>
                    {assembled && (
                      <SyncedSpeakButton id={speakId} text={assembled} tts={tts} settings={ttsSettings} style={{ padding: '2px 8px', minHeight: 26 }} />
                    )}
                    <button type="button" className="btn btn-sm" onClick={() => pasteSentenceToTextBox(assembled)} disabled={!assembled} title="Add this to your paragraph text box">📋 Add to paragraph</button>
                  </div>
                </div>
              );
            })}
            {/* Heart Words, placed as one unit — the student taps each
                letter of the word to toggle a heart marker over it
                themselves (self-directed, see heartWordContent.ts). */}
            {placed.filter((p) => p.kind === 'heartWord').map((item) => {
              const def = HEART_WORDS.find((h) => h.id === item.heartWordId);
              if (!def) return null;
              const hearts = new Set(item.heartIndices ?? []);
              const selected = selectedId === item.instanceId;
              return (
                <div key={item.instanceId} style={{ position: 'absolute', left: item.x, top: item.y, zIndex: 2 }}>
                  <Draggable
                    label={def.word}
                    onPointerDown={startDragPlaced(item.instanceId)}
                    onPointerMove={onDragMove}
                    onPointerUp={onDragEnd}
                    style={selected ? { boxShadow: '0 0 0 3px rgba(124,58,237,0.35)', borderRadius: 10, padding: 2 } : { padding: 2 }}
                  >
                    <div style={{ display: 'flex', gap: 2 }}>
                      {def.word.split('').map((ch, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleHeartIndex(item.instanceId, i)}
                          onPointerDown={(e) => e.stopPropagation()}
                          aria-label={hearts.has(i) ? `Letter ${ch}, marked as a heart letter, tap to unmark` : `Letter ${ch}, tap to mark as a heart letter`}
                          style={{
                            position: 'relative', width: 28, height: 34, border: '2px solid var(--ink)', borderRadius: 6, background: 'white',
                            fontWeight: 800, fontFamily: "'Baloo 2', sans-serif", fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                          }}
                        >
                          {ch}
                          {hearts.has(i) && <span style={{ position: 'absolute', top: -12, fontSize: '0.85rem', color: LM_HEART_COLOR }} aria-hidden="true">❤️</span>}
                        </button>
                      ))}
                    </div>
                  </Draggable>
                  {selected && (
                    <button
                      type="button"
                      className="lm-item-controls"
                      onClick={() => removePlacedItem(item.instanceId)}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-label="Remove this Heart Word"
                      style={{
                        position: 'absolute', top: -10, right: -10, width: 20, height: 20, borderRadius: '50%',
                        border: '2px solid var(--ink)', background: '#fee2e2', color: '#991b1b', fontSize: 11, fontWeight: 900,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, lineHeight: 1, zIndex: 3,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
            {placed.length === 0 && (
              <p style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', margin: 0, fontWeight: 700, opacity: 0.35, textAlign: 'center', width: 320 }}>
                Drag anything from the left onto this board!
              </p>
            )}
          </div>
          {/* Transparent draw canvas — only captures pointer events while
              drawOn is true, the content layer takes them back instantly
              when Draw is toggled off. */}
          <canvas
            ref={drawCanvasRef}
            width={1400}
            height={900}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              pointerEvents: drawOn ? 'auto' : 'none',
              touchAction: 'none', cursor: drawOn ? 'crosshair' : 'default',
              transform: `scale(${zoom})`, transformOrigin: '0 0',
            }}
            onPointerDown={drawOn ? drawStart : undefined}
            onPointerMove={drawOn ? drawMove : undefined}
            onPointerUp={drawOn ? drawEnd : undefined}
            onPointerLeave={drawOn ? drawEnd : undefined}
          />
        </div>
      </div>
      </div>
    </div>
  );
}
