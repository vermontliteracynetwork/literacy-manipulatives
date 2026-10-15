import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useSyncedTTS, SyncedSpeakButton } from './components/SyncedSpeakButton';
import { ReferencePopover } from './components/ReferencePopover';
import { SANDBOX_PIECES } from './lib/grammarContent';
import { MORPHEME_GROUPS, KIND_LABEL, buildWord, canFollow, isCore, kindExplanation, madeUpMeaning, morphemeById, pieceLabel, type Morpheme } from './lib/morphemes';
import { lookupDefinition, peekDefinition } from './lib/dictionary';
import { MorphemePiece, pieceBodyWidth, pieceOuterSize } from './components/MorphemePiece';
import { FloatingCard } from './components/FloatingCard';
import { Icon } from './components/Icon';
import { SharePanel } from './components/SharePanel';
import { JoinScreen } from './components/JoinScreen';
import { WelcomeChoice } from './components/WelcomeChoice';
import { SettingsPanel } from './components/SettingsPanel';
import { isFontChoice, useFontChoice, type FontChoice } from './lib/fontChoice';
import { diffItems, isJoinRoute, shareConfigured, studentId as myStudentId, useHostSession, useStudentSession, type Ops, type Snapshot } from './lib/share';
import { MONTESSORI_WORD_CLASS_INFO, type MontessoriWordClass } from './lib/montessoriGrammar';
import { SYMBOL_SENTENCE_PAGES, ALL_SYMBOL_SENTENCES, type SymbolSentence } from './lib/symbolSentences';
import { searchSymbolSentences, symbolsForWords, type PatternWord } from './lib/sentenceSearch';
import { PUNCTUATION_MARKS } from './lib/punctuationContent';
import { BUBBLE_BLACK, BUBBLE_WHITE, nextPunct, randomWordInSentence, sentenceTokens, stripPunctuation, textOn, type BubbleStyle } from './lib/wordBubbles';
import {
  LM_PUNCTUATION_COLOR, LM_PUNCTUATION_TEXT_COLOR, LM_PHONO_COLOR,
} from './lib/literacyDesignTokens';
import { playListeningStartChime, playListeningStopChime } from './lib/audioCues';
import { GRAMMAR_WORD_CLASS_COLORS, GRAMMAR_WORD_CLASS_TEXT_COLORS } from './types';
import type { GrammarPiece, TTSSettings } from './types';

// Literacy Manipulatives, rebuilt per direct teacher redesign (2026-09-22),
// replacing the previous mode-switching build entirely: "the design...
// is too scripted, too prompted. it should really just be a drag and
// drop... an interactive whiteboard to explore all the tools... entirely
// unscripted and not aligned with a curriculum... this is open play,
// dont build the activity component until all design, features,
// navigation, and tools in literacy manipulatives is developed
// completely." Every earlier scripted mode is gone from this screen.
// Removed 2026-10-15 at her request: Word Matrix, Reverse Morphology,
// Syllable Tapper, Sentence Formulas, Word Chains, Spelling Rules,
// Heart Words, and the Dictation Card.
//
// This is now ONE shared canvas plus a left-side material palette
// (nav moved off the old top bar, direct instruction: "the bar across
// the top should move to the left hand side"), Polypad/GeoGebra-style:
// every material (word tiles, blank Montessori grammar shapes, morpheme
// pieces, letters, sound-box frames) drags from the sidebar onto the
// canvas and can be freely repositioned, mixed, and combined, with no
// fixed target/correct-answer/completion state anywhere. The one
// surviving "smart" behavior is the noun+verb number-agreement snap -
// a structural grammar rule applied to any two words regardless of
// content (like real magnetic tiles), not a curriculum target, and it
// predates and survived every design review this sandbox has had.
const TILE_W = 120;
const TILE_H = 58;
const SNAP_GAP = 14;
const SNAP_THRESHOLD = 160;
const HISTORY_LIMIT = 20;
export interface Stroke { id: string; mode: 'pen' | 'highlight'; color: string; points: [number, number][] }
const strokeWidth = (st: Stroke) => (st.mode === 'highlight' ? 22 : 6);
function paintStroke(ctx: CanvasRenderingContext2D, st: Stroke) {
  if (st.points.length === 0) return;
  ctx.globalAlpha = st.mode === 'highlight' ? 0.35 : 1;
  ctx.lineWidth = strokeWidth(st);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = st.color;
  ctx.beginPath();
  ctx.moveTo(st.points[0][0], st.points[0][1]);
  for (const [x, y] of st.points.slice(1)) ctx.lineTo(x, y);
  if (st.points.length === 1) ctx.lineTo(st.points[0][0] + 0.1, st.points[0][1]);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
// Distance from point p to segment ab, for the eraser's hit test.
function distToSegment(p: [number, number], a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
const ERASER_RADIUS = 14;
const SENTENCE_GAP = 8; // space between snapped sentence pieces
const LINE_SNAP = 70; // how close (px) a dropped piece must be to snap into a row
// Pieces that snap into a sentence row: Grammar Symbols, Symbol Sentences, punctuation tiles.
const SENTENCE_KINDS: PlacedKind[] = ['shape', 'symbolSentence', 'punctuation'];

// Speech-to-text for the Text Box tool, direct teacher instruction
// ("SST option" on the new typeable fields). The browser's own Web
// Speech API, feature-detected once at module scope, same pattern this
// project used before speech-to-text was removed app-wide (2026-09-22,
// "remove STT, but allow TTS for the items or things highlighted by
// the student", that removal was about ArticleReader specifically;
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

// Grapheme tiles (her request 2026-10-15, with the UFLI Foundations "Scope & Sequence At-a-Glance (K-2)"): one
// group per red header on that sheet, every spelling pattern from Digraphs on, in the sheet's order. Affixes
// (Reading Longer Words' -es/-ed/-ing, Suffixes & Prefixes, Suffix Spelling Changes, Additional Affixes) are
// left out here on purpose: they live in Morphemes only. Each tile's sound (from the sheet) shows on hover.
// The VCe "_ce"/"_ge" patterns are written "-ce"/"-ge" so the tile doesn't draw a split-vowel connector.
const GRAPHEME_GROUPS: { key: string; label: string; graphemes: { g: string; sound: string }[] }[] = [
  { key: 'digraphs', label: 'Digraphs', graphemes: [
    { g: 'ff', sound: 'FLSZ rule /f/' }, { g: 'll', sound: 'FLSZ rule /l/' }, { g: 'ss', sound: 'FLSZ rule /s/' }, { g: 'zz', sound: 'FLSZ rule /z/' },
    { g: 'all', sound: '-all' }, { g: 'oll', sound: '-oll' }, { g: 'ull', sound: '-ull' },
    { g: 'ck', sound: '/k/' }, { g: 'sh', sound: '/sh/' }, { g: 'th', sound: '/th/ voiced and unvoiced' }, { g: 'ch', sound: '/ch/' },
    { g: 'wh', sound: '/w/' }, { g: 'ph', sound: '/f/' }, { g: 'ng', sound: '/ng/' }, { g: 'nk', sound: '/nk/' },
  ] },
  { key: 'vce', label: 'VCe', graphemes: [
    { g: 'a_e', sound: '/ā/' }, { g: 'i_e', sound: '/ī/' }, { g: 'o_e', sound: '/ō/' }, { g: 'e_e', sound: '/ē/' }, { g: 'u_e', sound: '/ū/, /yū/' },
    { g: '-ce', sound: '/s/' }, { g: '-ge', sound: '/j/' },
  ] },
  { key: 'ending', label: 'Ending Spelling Patterns', graphemes: [
    { g: 'tch', sound: '/ch/' }, { g: 'dge', sound: '/j/' },
    { g: 'ild', sound: 'long VCC' }, { g: 'old', sound: 'long VCC' }, { g: 'ind', sound: 'long VCC' }, { g: 'olt', sound: 'long VCC' }, { g: 'ost', sound: 'long VCC' },
    { g: 'y', sound: '/ī/ or /ē/' }, { g: '-le', sound: '-le' },
  ] },
  { key: 'r-controlled', label: 'R-Controlled Vowels', graphemes: [
    { g: 'ar', sound: '/ar/' }, { g: 'or', sound: '/or/' }, { g: 'ore', sound: '/or/' }, { g: 'er', sound: '/er/' }, { g: 'ir', sound: '/er/' }, { g: 'ur', sound: '/er/' }, { g: 'wor', sound: '/er/ (w + or)' },
  ] },
  { key: 'long-vowel-teams', label: 'Long Vowel Teams', graphemes: [
    { g: 'ai', sound: '/ā/' }, { g: 'ay', sound: '/ā/' }, { g: 'ee', sound: '/ē/' }, { g: 'ea', sound: '/ē/' }, { g: 'ey', sound: '/ē/' },
    { g: 'oa', sound: '/ō/' }, { g: 'ow', sound: '/ō/' }, { g: 'oe', sound: '/ō/' }, { g: 'ie', sound: '/ī/' }, { g: 'igh', sound: '/ī/' },
  ] },
  { key: 'other-vowel-teams', label: 'Other Vowel Teams', graphemes: [
    { g: 'oo', sound: '/oo/ or /ū/' }, { g: 'u', sound: '/oo/' }, { g: 'ew', sound: '/ū/' }, { g: 'ui', sound: '/ū/' }, { g: 'ue', sound: '/ū/' },
    { g: 'au', sound: '/aw/' }, { g: 'aw', sound: '/aw/' }, { g: 'augh', sound: '/aw/' }, { g: 'ea', sound: '/ĕ/' }, { g: 'a', sound: '/ŏ/' },
  ] },
  { key: 'diphthongs', label: 'Diphthongs', graphemes: [
    { g: 'oi', sound: '/oi/' }, { g: 'oy', sound: '/oi/' }, { g: 'ou', sound: '/ow/' }, { g: 'ow', sound: '/ow/' },
  ] },
  { key: 'silent', label: 'Silent Letters', graphemes: [
    { g: 'kn', sound: '/n/' }, { g: 'wr', sound: '/r/' }, { g: 'mb', sound: '/m/' },
  ] },
  { key: 'low-frequency', label: 'Low Frequency Spellings', graphemes: [
    { g: 'ar', sound: '/er/ (as in dollar)' }, { g: 'or', sound: '/er/ (as in doctor)' },
    { g: 'air', sound: '/air/' }, { g: 'are', sound: '/air/' }, { g: 'ear', sound: '/air/ or /ear/' },
    { g: 'ei', sound: 'alternate /ā/' }, { g: 'ey', sound: 'alternate /ā/' }, { g: 'eigh', sound: 'alternate /ā/' }, { g: 'aigh', sound: 'alternate /ā/' }, { g: 'ea', sound: 'alternate /ā/' },
    { g: 'ew', sound: 'alternate long u /yū/' }, { g: 'eu', sound: 'alternate long u /yū/' }, { g: 'ue', sound: 'alternate long u /yū/' }, { g: 'ou', sound: 'alternate long u /ū/' },
    { g: 'ough', sound: '/aw/ or /ō/' },
    { g: 'c', sound: 'signal vowel /s/' }, { g: 'g', sound: 'signal vowel /j/' },
    { g: 'ch', sound: '/sh/ or /k/' }, { g: 'gn', sound: '/n/' }, { g: 'gh', sound: '/g/' }, { g: 't', sound: 'silent t' },
  ] },
];

// Always-available baseline colors, direct teacher instruction: "grabbing
// purchased/earned/inventory markers of students in addition to regular."
// A student with nothing purchased yet still has real colors to draw
// with; owned Marketplace colors are appended after these.
const BASE_PEN_COLORS = ['#1f1147', '#dc2626', '#2563eb', '#16a34a', '#f97316', 'var(--brand-blue)'];
const BASE_HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4'];

type PlacedKind = 'grammar' | 'shape' | 'letter' | 'frame' | 'morpheme' | 'textbox' | 'symbolSentence' | 'punctuation' | 'soundChip' | 'divider';

// A word or punctuation mark dropped into a Writing Scaffold line (from a Grammar Symbol, a Symbol Sentence, or a
// punctuation tile), kept as a symbol with its word bubble inside the frame.

interface PlacedItem {
  instanceId: string;
  // On a shared board: the student who put this piece there (so a student's Clear only removes their own).
  addedBy?: string;
  kind: PlacedKind;
  x: number;
  y: number;
  pieceId?: string; // grammar
  wordClass?: MontessoriWordClass; // shape
  letter?: string; // letter
  boxCount?: number; // frame; also reused for symbolSentence's word count (sizing only)
  morphId?: string; // morpheme, id into lib/morphemes.ts
  // Snapping in a line (her request 2026-10-15: sentence pieces "snap in line beside each other as sentences are
  // built" and "snapped pieces move as a unit"; morpheme puzzle pieces too). The id of the piece this one is
  // attached to on its left; position is then always computed from that piece, so the row moves as one.
  snapLeftId?: string;
  inFrameId?: string; // letter, sound chip or split line: the Sound Box it's snapped to (moves with the frame)
  chipColor?: string; // soundChip, its color (double tap to change)
  cellIndex?: number; // letter, which box of that frame
  cellSize?: number; // frame, box size in px (resizable, default 44)
  groupId?: string; // items grouped together (Select → Group) move as one
  textValue?: string; // textbox
  fontSize?: number; // textbox
  symbolSentenceId?: string; // symbolSentence, id into ALL_SYMBOL_SENTENCES
  wordFills?: Record<number, string>; // symbolSentence, typed word per symbol, shown in that symbol's word bubble (replaces the default word)
  punctFills?: Record<number, string>; // symbolSentence, punctuation icon after word N, when changed from the sentence's own mark
  bubbleStyle?: BubbleStyle; // shape + symbolSentence, word bubbles drawn as an outline (default) or solid
  bubbleWord?: string; // shape, the word typed (or picked with the random-word die) in a single Grammar Symbol's bubble
  punctId?: string; // punctuation, id into PUNCTUATION_MARKS
}

const pieceById = (id: string): GrammarPiece | undefined => SANDBOX_PIECES.find((p) => p.id === id);

const CELL_GAP = 4;
const DEFAULT_CELL = 44;
const frameWidth = (n: number, cell: number) => n * cell + (n - 1) * CELL_GAP;
const MAX_BOXES = 10;
const CHIP_COLORS = [LM_PHONO_COLOR, '#FAF003', '#D2222E', '#1968AB', '#42AC74', '#F87220', '#9877B9', '#FFFFFF'];

function sizeFor(kind: PlacedKind, boxCount?: number, item?: Partial<PlacedItem>): { w: number; h: number } {
  if (kind === 'grammar') return { w: TILE_W, h: TILE_H };
  if (kind === 'morpheme') { const m = morphemeById(item?.morphId); return m ? pieceOuterSize(m) : { w: 96, h: 70 }; }
  if (kind === 'frame') { const n = boxCount ?? 3; const c = item?.cellSize ?? DEFAULT_CELL; return { w: frameWidth(n, c), h: c }; }
  if (kind === 'textbox') return { w: 160, h: 56 };
  if (kind === 'shape') return { w: 130, h: 150 };
  if (kind === 'symbolSentence') { const n = boxCount ?? 3; return { w: n * 110 + 60, h: 130 }; }
  if (kind === 'soundChip') return { w: 36, h: 36 };
  if (kind === 'divider') return { w: 10, h: 70 };
  return { w: 44, h: 44 }; // letter
}

// Pure appearance for any placed/tray item, one render path shared by
// the sidebar tray and the canvas, so every material looks identical in
// both places (a real navigation-clarity fix: one visual language, not
// a different tile style per old "mode").
// Vowel/consonant coloring toggle (A23-ROADMAP Phase 2), a common
// Orton-Gillingham-style convention: color a letter/grapheme tile by
// whether it spells a vowel or consonant sound, a second visual channel
// alongside the letters themselves. Classified by the tile's first
// alphabetic character (works correctly for every single letter and for
// every grapheme in GRAPHEME_GROUPS below, including split-vowel "a_e"
// style spellings and consonant digraphs like "sh"/"wr"), a real,
// simple, honest heuristic, not a claim of phonetic authority.
function vcColorFor(text: string | undefined, on: boolean): CSSProperties | undefined {
  if (!on || !text) return undefined;
  const first = text.replace(/[^a-zA-Z]/g, '')[0]?.toLowerCase();
  if (!first) return undefined;
  const isVowel = 'aeiou'.includes(first);
  return { color: isVowel ? '#b91c1c' : '#1d4ed8' };
}

function ItemVisual({ kind, pieceId, wordClass, letter, boxCount, morphId, compact, punctId, vowelConsonantColors, cellSize, tileSize, linkedLeft, linkedRight, chipColor }: {
  kind: PlacedKind; pieceId?: string; wordClass?: MontessoriWordClass; letter?: string; boxCount?: number;
  morphId?: string; compact?: boolean; punctId?: string; vowelConsonantColors?: boolean; cellSize?: number; tileSize?: number;
  linkedLeft?: boolean; linkedRight?: boolean; chipColor?: string;
}) {
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
          fontFamily: 'var(--lm-font)', fontWeight: 800, fontSize: '1.3rem', boxShadow: '2px 2px 0 rgba(31,17,71,0.2)',
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
        fontFamily: 'var(--lm-font)', fontWeight: 800, fontSize: '1rem', boxShadow: '2px 2px 0 rgba(31,17,71,0.2)', textAlign: 'center',
      }}>
        {piece.text}
      </div>
    );
  }
  if (kind === 'shape') {
    // Direct teacher instruction: "the current grammar symbols need to
    // be 2x the size on default", doubled from 48/40 to 96/80,
    // everywhere this renders (tray and canvas share this component).
    // Follow-up instruction: "shrink the size of the grammar symbols
    // when they are in the drop down menu, right now they take up too
    // much space", the `compact` prop (sidebar tray only) shrinks the
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
    // A23-ROADMAP Phase 3: a blank phoneme-segmenting counter, the real
    // physical-manipulative convention (drag out one chip per sound you
    // hear), no target word, no auto-count, matching this sandbox's
    // standing free-play philosophy.
    return <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--ink)', background: chipColor ?? LM_PHONO_COLOR, boxShadow: '2px 2px 0 rgba(31,17,71,0.2)' }} />;
  }
  if (kind === 'divider') {
    // A23-ROADMAP Phase 3: Onset-Rime Divider, a plain physical-style
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
    // A23-ROADMAP Phase 2: "grapheme split-vowel connector", a VCe
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
          minWidth: tileSize ?? 40, height: tileSize ?? 40, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
          border: '3px solid var(--ink)', borderRadius: 8, background: 'white',
          fontFamily: 'var(--lm-font)', fontWeight: 800, fontSize: tileSize ? tileSize * 0.42 : '1.1rem', boxShadow: '2px 2px 0 rgba(31,17,71,0.2)', ...colorStyle,
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
        minWidth: tileSize ?? 40, height: tileSize ?? 40, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
        border: '3px solid var(--ink)', borderRadius: 8, background: 'white',
        fontFamily: 'var(--lm-font)', fontWeight: 800, fontSize: tileSize ? tileSize * ((letter?.length ?? 1) > 2 ? 0.32 : 0.48) : ((letter?.length ?? 1) > 2 ? '0.85rem' : '1.2rem'), boxShadow: '2px 2px 0 rgba(31,17,71,0.2)', ...colorStyle,
      }}>
        {letter}
      </div>
    );
  }
  if (kind === 'frame') {
    return (
      <div style={{ display: 'flex', gap: CELL_GAP }}>
        {Array.from({ length: boxCount ?? 3 }).map((_, i) => (
          <div key={i} style={{ width: cellSize ?? DEFAULT_CELL, height: cellSize ?? DEFAULT_CELL, boxSizing: 'border-box', border: '3px solid var(--ink)', borderRadius: 6, background: 'white' }} />
        ))}
      </div>
    );
  }
  // morpheme
  const m = morphemeById(morphId);
  return m ? <MorphemePiece m={m} scale={compact ? 0.72 : 1} linkedLeft={linkedLeft} linkedRight={linkedRight} /> : null;
}

// One drag wrapper for every material, in the tray or on the canvas -
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

// Polypad's own subcategory row, a plain clickable label + chevron that
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

// The small search box at the top of a sidebar category (her request 2026-10-15: search bars instead of
// the little subtext under each category title).
function TraySearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input className="lm-tray-search" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />;
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

// A Symbol Sentences tray card, direct teacher upload (a real
// Montessori grammar-box deck: full sentences shown purely as a row of
// colored symbols, no words). Dragging the card onto the board drops
// its whole symbol row as one unit; the sentence text itself stays
// symbols-only on the board, but direct follow-up instruction: "when
// you highlight over a symbol sentence in the menu, it should pop up
// with the example reference sentences saved in that original doc" -
// hovering/focusing the tray card reveals its real sentence text,
// reusing the same tooltip pattern the Grammar Symbol tiles already use.
// The word bubble attached under a Grammar Symbol (her picture, 2026-10-15): a pill in the symbol's own color,
// outlined or solid, that a student taps and types into. Typing never starts a drag, and punctuation is kept
// out (it gets its own icon).
function WordBubble({ value, placeholder, color, bubbleStyle, onChange, label, owner, idx = 0 }: {
  value: string; placeholder: string; color: string; bubbleStyle: BubbleStyle; onChange: (v: string) => void; label: string;
  owner?: string; idx?: number;
}) {
  const solid = bubbleStyle === 'solid';
  const shown = value || placeholder;
  return (
    <input
      className="lm-bubble"
      value={value}
      placeholder={placeholder}
      aria-label={label}
      data-owner={owner}
      data-idx={idx}
      size={Math.max(4, shown.length + 1)}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => onChange(stripPunctuation(e.target.value))}
      style={{ borderColor: color, background: solid ? color : BUBBLE_WHITE, color: solid ? textOn(color) : BUBBLE_BLACK }}
    />
  );
}

// Punctuation is always its own small gray icon (never typed into a word). Tapping it steps . ? ! ,
function PunctIcon({ mark, onTap }: { mark: string; onTap?: () => void }) {
  return (
    <button type="button" className="lm-punct-icon" aria-label={`Punctuation ${mark}. Tap to change it`} onPointerDown={(e) => e.stopPropagation()} onClick={onTap}>
      {mark}
    </button>
  );
}

function BubbleSwatch({ solid }: { solid: boolean }) {
  return <i className={`lm-bubble-swatch ${solid ? 'solid' : 'outline'}`} aria-hidden="true" />;
}

// "Word bubbles:" with the outline and solid choices right beside it, shown as their shapes only.
function BubbleToggle({ value, onChange }: { value: BubbleStyle; onChange: (v: BubbleStyle) => void }) {
  return (
    <div className="lm-bubble-toggle" role="radiogroup" aria-label="Word bubbles">
      <span>Word bubbles:</span>
      {(['outline', 'solid'] as const).map((v) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} aria-label={v === 'outline' ? 'Outline bubbles' : 'Solid bubbles'} title={v === 'outline' ? 'Outline' : 'Solid'} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          <BubbleSwatch solid={v === 'solid'} />
        </button>
      ))}
    </div>
  );
}

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

// Text Box, direct teacher instruction: "add type text input fields so
// kids can type. SST option. text fields can be double tapped to edit
// text, moveable, resize text options." A self-contained widget (same
// pattern as the Sentence Formula frames): dragging it moves it around
// like any other material, double-tapping opens edit mode (a real
// textarea, focused automatically), and while editing a student can
// type, speak (🎤, browser speech-to-text), or grow/shrink the text
// with A-/A+.
function TextBoxWidget({ item, onPointerDown, onPointerMove, onPointerUp, onTextChange, onFontSizeChange, onRemove }: {
  item: PlacedItem;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onTextChange: (value: string) => void;
  onFontSizeChange: (delta: number) => void;
  onRemove: () => void;
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
            width: 220, minHeight: 70, fontFamily: 'var(--lm-font)', fontSize,
            border: '2px solid var(--ink)', borderRadius: 8, padding: 6, resize: 'both',
          }}
        />
        <div className="row-wrap" style={{ gap: 4, marginTop: 6, alignItems: 'center' }}>
          <button type="button" className="btn btn-sm" style={{ minWidth: 34, padding: '2px 8px' }} onClick={() => onFontSizeChange(-2)} aria-label="Smaller text">A-</button>
          <button type="button" className="btn btn-sm" style={{ minWidth: 34, padding: '2px 8px' }} onClick={() => onFontSizeChange(2)} aria-label="Bigger text">A+</button>
          {stt.supported && (
            <button type="button" className={`btn btn-sm ${stt.listening ? 'btn-primary' : ''}`} onClick={stt.toggle}>
              {stt.listening ? 'Listening...' : 'Speak'}
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Done</button>
          <button type="button" className="btn btn-sm" onClick={onRemove} aria-label="Remove text box">Delete</button>
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
      onDoubleClick={() => setEditing(true)}
      style={{
        position: 'absolute', left: item.x, top: item.y, zIndex: 5,
        touchAction: 'none', userSelect: 'none', cursor: 'grab', minWidth: 120, minHeight: 44,
        padding: '8px 12px', border: '2px dashed var(--content-border)', borderRadius: 8, background: 'white',
        fontFamily: 'var(--lm-font)', fontSize, whiteSpace: 'pre-wrap', maxWidth: 320,
      }}
    >
      {item.textValue?.trim() ? item.textValue : <span style={{ opacity: 0.45 }}>Double-tap to type</span>}
    </div>
  );
}

// Standalone v1: no login, nothing saved, ported from the Homeplot
// dashboard's native Literacy Manipulatives (GrammarSandbox.tsx). Every
// account/marketplace/save-file concept that tool had is gone here on
// purpose (see README): no student record, no purchased voice/color
// skins, no per-teacher "focus set," no saved-whiteboard list. What's
// left is the open canvas and every manipulative tool itself, unlocked
// for anyone who opens the page. TTS settings are just local component
// state (rate/voice), not tied to any account.
export default function LiteracyManipulatives() {
  const [ttsSettings] = useState<TTSSettings>({ rate: 1, voiceURI: null });

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
  // Group / ungroup / line up (her request 2026-10-15): Select mode picks several pieces, then the action bar
  // groups them (they move as one), ungroups them, or lines them up centered on each other.
  const [selectMode, setSelectMode] = useState(false);
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set());
  // Drag-to-select (her request 2026-10-15): drag across empty board to draw a box; everything it touches is
  // selected and then moves together when you drag any one of them.
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // Word bubbles for newly placed symbols start as an outline or solid (the toggle in the Grammar Symbols and
  // Symbol Sentences trays, which also switches every bubble already on the board).
  const [bubbleDefault, setBubbleDefault] = useState<BubbleStyle>('outline');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // A23-ROADMAP Phase 1 (spec's own top priority): one shared TTS-with-
  // synced-word-highlighting engine, mounted once here and passed down to
  // every 🔈 button in this screen (SyncedSpeakButton) instead of each
  // one calling the plain speak() independently.
  const tts = useSyncedTTS();
  // A23-ROADMAP Phase 2: vowel/consonant coloring toggle for Alphabet
  // and Graphemes tiles (an Orton-Gillingham-style convention), off by
  // default (matching every other accommodation on this screen that
  // changes how tiles look, opt-in, never forced).
  const [vowelConsonantColors, setVowelConsonantColors] = useState(false);
  // Zoom, direct teacher instruction: "add zoom feature for white
  // board." Scales the whole canvas visually (transform: scale, from
  // the top-left); placed items keep their real, unscaled x/y, so
  // canvasRelative() below divides pointer coordinates by zoom to stay
  // in that same logical space regardless of the current zoom level.
  const [zoom, setZoom] = useState(1);
  const zoomIn = () => setZoom((z) => Math.min(2, Math.round((z + 0.25) * 100) / 100));
  const zoomOut = () => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100));
  const zoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  // Moving around the board (her request 2026-10-15): two fingers pinch to zoom and slide to move the board on
  // a touch screen; on a computer, a trackpad pinch (or ctrl + scroll) zooms and a two-finger scroll moves it.
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const boardRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ zoom, pan });
  viewRef.current = { zoom, pan };
  const pinchRef = useRef(false);
  useEffect(() => {
    // Listeners live on the window and check the event happened over the board, so they keep working even if
    // the board element is replaced (a laptop trackpad pinch arrives as ctrl + scroll).
    const overBoard = (e: Event) => !!boardRef.current && e.target instanceof Node && boardRef.current.contains(e.target);
    const board = { getBoundingClientRect: () => boardRef.current?.getBoundingClientRect() ?? new DOMRect() };
    const clampZoom = (z: number) => Math.min(2.5, Math.max(0.4, z));
    // Zoom so the board point under (sx, sy) on screen stays under it.
    const zoomAround = (sx: number, sy: number, nextZoom: number, from = viewRef.current) => {
      const rect = board.getBoundingClientRect();
      const mx = sx - rect.left, my = sy - rect.top;
      const z = clampZoom(nextZoom);
      const px = (mx - from.pan.x) / from.zoom, py = (my - from.pan.y) / from.zoom;
      setZoom(z);
      setPan({ x: mx - px * z, y: my - py * z });
    };
    const onWheel = (e: WheelEvent) => {
      if (!overBoard(e)) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      if (e.ctrlKey || e.metaKey) zoomAround(e.clientX, e.clientY, viewRef.current.zoom * Math.exp(-Math.max(-25, Math.min(25, e.deltaY * unit)) * 0.012));
      else setPan((pp) => ({ x: pp.x - e.deltaX * unit, y: pp.y - e.deltaY * unit }));
    };
    // Safari on a Mac reports trackpad pinches as gesture events instead of ctrl + scroll.
    let gestureStart = viewRef.current;
    const onGestureStart = (e: Event) => { if (!overBoard(e)) return; e.preventDefault(); gestureStart = viewRef.current; };
    const onGestureChange = (e: Event) => {
      if (!overBoard(e)) return;
      e.preventDefault();
      const g = e as Event & { scale: number; clientX: number; clientY: number };
      zoomAround(g.clientX, g.clientY, gestureStart.zoom * g.scale, gestureStart);
    };
    // Touch: two fingers pinch and slide. A second finger landing stops any piece drag or selection box.
    const touches = new Map<number, { x: number; y: number }>();
    let start: { dist: number; mx: number; my: number; view: { zoom: number; pan: { x: number; y: number } } } | null = null;
    const twoFinger = () => {
      const [a, b] = [...touches.values()];
      return { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !overBoard(e)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        pinchRef.current = true;
        dragInstanceRef.current = null;
        setMarquee(null);
        start = { ...twoFinger(), view: viewRef.current };
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size !== 2 || !start) return;
      const now = twoFinger();
      const rect = board.getBoundingClientRect();
      const z = clampZoom(start.view.zoom * (now.dist / start.dist));
      const px = (start.mx - rect.left - start.view.pan.x) / start.view.zoom;
      const py = (start.my - rect.top - start.view.pan.y) / start.view.zoom;
      setZoom(z);
      setPan({ x: now.mx - rect.left - px * z, y: now.my - rect.top - py * z });
    };
    const onUp = (e: PointerEvent) => {
      if (!touches.delete(e.pointerId)) return;
      if (touches.size < 2) start = null;
      if (touches.size === 0) pinchRef.current = false;
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('gesturestart', onGestureStart, { passive: false } as AddEventListenerOptions);
    window.addEventListener('gesturechange', onGestureChange, { passive: false } as AddEventListenerOptions);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('gesturestart', onGestureStart);
      window.removeEventListener('gesturechange', onGestureChange);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
    };
  }, []);
  // Top toolbar (Help/Exit/materials-toggle/Draw/Undo/Redo/Clear/Save) -
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

  // Draw, merged Mark+Draw into one tool, direct teacher instruction.
  // A transparent canvas overlay sits on top of the shared tile canvas
  // (same technique the old Mark toggle used); Pen and Highlight are two
  // stroke styles of the same tool, not separate tools.
  const [drawOn, setDrawOn] = useState(false);
  const [drawMode, setDrawMode] = useState<'pen' | 'highlight' | 'eraser'>('pen');
  // Every pen/highlighter mark is kept as its own stroke so the eraser can remove one mark at a time (her
  // request 2026-10-15). Points are in the draw canvas's own 1400x900 space.
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const liveStroke = useRef<Stroke | null>(null);

  // ---- Share (live board for students) ----
  // The teacher's board is the one true copy: it applies edits from students who have edit access and sends
  // the whole board back out. A student's board mirrors the teacher's; an editing student sends only what
  // they changed.
  const joinMode = useRef(isJoinRoute()).current;
  const applyOps = (ops: Ops<PlacedItem, Stroke>) => {
    setPlaced((p) => {
      const removes = new Set(ops.removes);
      const byId = new Map(ops.upserts.map((u) => [u.instanceId, u]));
      const next = p.filter((pp) => !removes.has(pp.instanceId)).map((pp) => byId.get(pp.instanceId) ?? pp);
      for (const u of ops.upserts) if (!p.some((pp) => pp.instanceId === u.instanceId)) next.push(u);
      return next;
    });
    if (ops.strokeAdds.length || ops.strokeRemoves.length) {
      setStrokes((list) => [...list.filter((st) => !ops.strokeRemoves.includes(st.id)), ...ops.strokeAdds.filter((a) => !list.some((st) => st.id === a.id))]);
    }
  };
  // The teacher's font follows onto every student's screen (her request 2026-10-15).
  const [teacherFont, setTeacherFont] = useState<FontChoice | null>(null);
  const fontChoice = useFontChoice(joinMode ? teacherFont : null);
  // What I have selected (a group counts as a whole), shown to everyone else on a shared board as my outline.
  const focusSel = placed.find((pp) => pp.instanceId === selectedId);
  const myFocusIds = [...new Set([
    ...(focusSel ? (focusSel.groupId ? placed.filter((pp) => pp.groupId === focusSel.groupId).map((pp) => pp.instanceId) : [focusSel.instanceId]) : []),
    ...multiSel,
  ])].sort();
  const host = useHostSession<PlacedItem, Stroke>(placed, strokes, applyOps, fontChoice.font, myFocusIds);
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Every launch opens on the welcome pop-up, "Start a whiteboard" or "Join a board" (her request 2026-10-15).
  // A page that embeds the board (the dashboard's iframe) can pass ?welcome=0 to skip it.
  const [welcomeOpen, setWelcomeOpen] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('welcome') !== '0'; } catch { return true; }
  });
  const closeWelcome = () => setWelcomeOpen(false);
  const fromTeacher = useRef(false);
  const myAdded = useRef(new Set<string>());
  const lastSynced = useRef<{ placed: PlacedItem[]; strokes: Stroke[] }>({ placed: [], strokes: [] });
  const student = useStudentSession<PlacedItem, Stroke>((snap: Snapshot<PlacedItem, Stroke>) => {
    fromTeacher.current = true;
    if (isFontChoice(snap.font)) setTeacherFont(snap.font);
    lastSynced.current = { placed: snap.placed, strokes: snap.strokes };
    setPlaced(snap.placed);
    setStrokes(snap.strokes);
  }, myFocusIds);
  const studentCanEdit = joinMode && student.status === 'joined' && student.access === 'edit';
  const studentViewOnly = joinMode && !studentCanEdit;
  useEffect(() => {
    if (!studentCanEdit) return;
    if (fromTeacher.current) { fromTeacher.current = false; return; }
    const t = window.setTimeout(() => {
      const diff = diffItems(lastSynced.current.placed, placed);
      const removes = diff.removes;
      // Pieces this student just added are marked as theirs.
      const upserts = diff.upserts.map((u) => {
        if (lastSynced.current.placed.some((o) => o.instanceId === u.instanceId)) return u;
        myAdded.current.add(u.instanceId);
        return u.addedBy ? u : { ...u, addedBy: myStudentId };
      });
      const strokeAdds = strokes.filter((st) => !lastSynced.current.strokes.some((o) => o.id === st.id));
      const strokeRemoves = lastSynced.current.strokes.filter((o) => !strokes.some((st) => st.id === o.id)).map((o) => o.id);
      if (upserts.length || removes.length || strokeAdds.length || strokeRemoves.length) {
        student.sendOps({ upserts, removes, strokeAdds, strokeRemoves });
        lastSynced.current = { placed, strokes };
      }
    }, 60);
    return () => window.clearTimeout(t);
  }, [placed, strokes, studentCanEdit]);
  const [drawColor, setDrawColor] = useState(BASE_PEN_COLORS[0]);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const drawLast = useRef<{ x: number; y: number } | null>(null);

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    shapes: true, symbolSentences: false, morphemes: false, letters: false, graphemes: false, punctuation: false, phono: false, frames: false, textbox: false,
  });
  const toggleCategory = (key: string) => setOpenCategories((s) => ({ ...s, [key]: !s[key] }));
  const [openSubcategories, setOpenSubcategories] = useState<Record<string, boolean>>({
    page1: false, page2: false, page3: false, page4: false, page5: false, page6: false, page7: false, page8: false, page9: false, page10: false, page11: false,
    prefixes: true, suffixes: false, bases: false, roots: false,
  });
  const toggleSubcategory = (key: string) => setOpenSubcategories((s) => ({ ...s, [key]: !s[key] }));
  const [morphSearch, setMorphSearch] = useState('');
  const [catSearch, setCatSearch] = useState<Record<string, string>>({});
  const searchFor = (k: string) => catSearch[k] ?? '';
  const setSearch = (k: string) => (v: string) => setCatSearch((c) => ({ ...c, [k]: v }));
  const matches = (k: string, ...texts: string[]) => { const q = searchFor(k).trim().toLowerCase(); return !q || texts.some((t) => t.toLowerCase().includes(q)); };

  // Alphabet, direct teacher instruction: full set of tiles, lowercase
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

  // Removing a piece from the middle of a snapped row closes the gap (the piece after it re-attaches to the
  // piece before it); letters in a removed Sound Box stay on the board, just no longer attached.
  const removePlacedItem = (instanceId: string) => setPlaced((p) => {
    const gone = p.find((pp) => pp.instanceId === instanceId);
    return p
      .filter((pp) => pp.instanceId !== instanceId)
      .map((pp) => {
        if (pp.snapLeftId === instanceId) return { ...pp, snapLeftId: gone?.snapLeftId };
        if (pp.inFrameId === instanceId) return { ...pp, inFrameId: undefined, cellIndex: undefined };
        return pp;
      });
  });

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

  const setPlacedField = (instanceId: string, patch: Partial<PlacedItem>) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, ...patch } : pp)));
  };
  const setAllBubbles = (style: BubbleStyle) => {
    setBubbleDefault(style);
    setPlaced((p) => p.map((pp) => (pp.kind === 'shape' || pp.kind === 'symbolSentence' ? { ...pp, bubbleStyle: style } : pp)));
  };
  const setSymbolSentencePunct = (instanceId: string, slot: number, mark: string) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, punctFills: { ...(pp.punctFills ?? {}), [slot]: mark } } : pp)));
  };

  // Direct teacher instruction: "within the settings for each symbol
  // sentence should be an option for text input fields similar to the
  // current sentence formulas", one typed word per symbol, shown under
  // that symbol once filled in. Same per-index fill pattern as
  // setFrameFill above.
  const setSymbolSentenceWordFill = (instanceId: string, wordIndex: number, value: string) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, wordFills: { ...(pp.wordFills ?? {}), [wordIndex]: value } } : pp)));
  };

  const setTextBoxValue = (instanceId: string, value: string) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, textValue: value } : pp)));
  };
  const setTextBoxFontSize = (instanceId: string, delta: number) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, fontSize: Math.min(48, Math.max(12, (pp.fontSize ?? 20) + delta)) } : pp)));
  };
  // A23-ROADMAP Phase 3: Elkonin-boxes-v2's "flexible count", a placed
  // Sound Box frame's boxCount can now grow/shrink live via +/- controls
  // shown when it's selected (see the per-item controls badge below),
  // instead of only ever being fixed at whichever size was dragged out.
  // Multi-letter grouping (the v2 spec's other ask) was already possible
  // before this: a grapheme tile like "sh" already occupies one cell as
  // a single multi-letter unit.
  const adjustFrameBoxCount = (instanceId: string, delta: number) => {
    pushHistory();
    setPlaced((p) => {
      const frame = p.find((pp) => pp.instanceId === instanceId);
      const n = Math.max(1, Math.min(MAX_BOXES, (frame?.boxCount ?? 3) + delta));
      return p.map((pp) => {
        if (pp.instanceId === instanceId && pp.kind === 'frame') return { ...pp, boxCount: n };
        // A letter in a box that just went away stays put, no longer attached.
        if (pp.inFrameId === instanceId && (pp.cellIndex ?? 0) >= n) return { ...pp, inFrameId: undefined, cellIndex: undefined };
        return pp;
      });
    });
  };

  // Sound Boxes (her request 2026-10-15): double tap a Sound Box to show small + buttons at its left end, between
  // boxes, and at its right end; each adds a box right there. Letters after it shift over with their boxes, and
  // adding on the left grows the Sound Box leftward so the boxes already there stay put.
  const [boxInsertFor, setBoxInsertFor] = useState<string | null>(null);
  // Sound chips: double tap for a small menu of colors.
  const [chipMenuFor, setChipMenuFor] = useState<string | null>(null);
  useEffect(() => { if (chipMenuFor && selectedId !== chipMenuFor) setChipMenuFor(null); }, [selectedId, chipMenuFor]);
  useEffect(() => { if (boxInsertFor && selectedId !== boxInsertFor) setBoxInsertFor(null); }, [selectedId, boxInsertFor]);
  const insertBox = (frameId: string, at: number) => {
    pushHistory();
    setPlaced((p) => {
      const frame = p.find((pp) => pp.instanceId === frameId);
      if (!frame || (frame.boxCount ?? 3) >= MAX_BOXES) return p;
      const step = (frame.cellSize ?? DEFAULT_CELL) + CELL_GAP;
      return p.map((pp) => {
        if (pp.instanceId === frameId) return { ...pp, boxCount: (pp.boxCount ?? 3) + 1, x: at === 0 ? pp.x - step : pp.x };
        if (pp.inFrameId === frameId && (pp.kind === 'divider' ? (pp.cellIndex ?? 0) > at : (pp.cellIndex ?? 0) >= at)) return { ...pp, cellIndex: (pp.cellIndex ?? 0) + 1 };
        return pp;
      });
    });
  };

  // Movable pop-ups on the board: a morpheme's meaning card (tap a piece) and the word card a snapped word
  // shows. Kept outside `placed` so they never land in undo history.
  const [morphCards, setMorphCards] = useState<{ id: string; morphId: string; x: number; y: number }[]>([]);
  const openMorphemeCard = (item: PlacedItem) => {
    if (!item.morphId) return;
    setMorphCards((cards) => [...cards.filter((c) => c.morphId !== item.morphId), { id: `mc-${Date.now()}`, morphId: item.morphId!, x: item.x, y: item.y + 80 }]);
  };
  // Word cards: offset from the word's first piece (so the card follows the word), or closed for that word.
  const [wordCardState, setWordCardState] = useState<Record<string, { dx: number; dy: number; closedWord?: string }>>({});

  // ---- Snapped rows (sentences and morpheme words) ----
  // Each attached piece stores only `snapLeftId`; its position is always computed from the piece on its left
  // (see the layout effect below), so dragging the first piece moves the whole row as one unit.
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const setItemRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) itemRefs.current.set(id, el); else itemRefs.current.delete(id);
  };
  const measured = (item: PlacedItem) => {
    const el = itemRefs.current.get(item.instanceId);
    return el ? { w: el.offsetWidth, h: el.offsetHeight } : sizeFor(item.kind, item.boxCount, item);
  };
  const rightOf = (list: PlacedItem[], id: string) => list.find((pp) => pp.snapLeftId === id);
  const rowFrom = (list: PlacedItem[], id: string): PlacedItem[] => {
    const out: PlacedItem[] = [];
    let cur = list.find((pp) => pp.instanceId === id);
    while (cur && !out.includes(cur)) { out.push(cur); cur = rightOf(list, cur.instanceId); }
    return out;
  };
  // Keeps every snapped row laid out and every lettered Sound Box filled, after each change: a morpheme sits
  // exactly one body-width to the right (its notch on the left piece's knob); a sentence piece sits a small gap
  // to the right, bottoms lined up; a letter sits centered in its box and grows with the box.
  useLayoutEffect(() => {
    const pos = new Map(placed.map((pp) => [pp.instanceId, { x: pp.x, y: pp.y }]));
    const byId = new Map(placed.map((pp) => [pp.instanceId, pp]));
    const heads = placed.filter((pp) => !pp.snapLeftId || !byId.has(pp.snapLeftId));
    for (const head of heads) {
      const row = rowFrom(placed, head.instanceId);
      for (let i = 1; i < row.length; i++) {
        const left = row[i - 1];
        const item = row[i];
        const lp = pos.get(left.instanceId)!;
        if (item.kind === 'morpheme') {
          const lm = morphemeById(left.morphId);
          pos.set(item.instanceId, { x: lp.x + (lm ? pieceBodyWidth(lm) : 96), y: lp.y });
        } else {
          const ls = measured(left);
          const is = measured(item);
          pos.set(item.instanceId, { x: lp.x + ls.w + SENTENCE_GAP, y: lp.y + ls.h - is.h });
        }
      }
    }
    for (const pp of placed) {
      if (!pp.inFrameId) continue;
      const f = byId.get(pp.inFrameId);
      if (!f) continue;
      const fp = pos.get(f.instanceId)!;
      const cell = f.cellSize ?? DEFAULT_CELL;
      const pitch = cell + CELL_GAP;
      const i = pp.cellIndex ?? 0;
      // Letters sit in their box, sound chips centered under it, split lines on the line between two boxes.
      if (pp.kind === 'letter') pos.set(pp.instanceId, { x: fp.x + i * pitch, y: fp.y });
      else if (pp.kind === 'soundChip') pos.set(pp.instanceId, { x: fp.x + i * pitch + cell / 2 - 18, y: fp.y + cell + 8 });
      else if (pp.kind === 'divider') pos.set(pp.instanceId, { x: fp.x + i * pitch - CELL_GAP / 2 - 5, y: fp.y + cell / 2 - 35 });
    }
    const changed = placed.some((pp) => {
      const q = pos.get(pp.instanceId)!;
      return Math.abs(q.x - pp.x) > 0.5 || Math.abs(q.y - pp.y) > 0.5;
    });
    if (changed) setPlaced((cur) => cur.map((pp) => { const q = pos.get(pp.instanceId); return q ? { ...pp, x: q.x, y: q.y } : pp; }));
  });

  // Words currently built from snapped morpheme pieces (two or more), derived from the board every render.
  const morphemeWords = placed
    .filter((pp) => pp.kind === 'morpheme' && !placed.some((q) => q.instanceId === pp.snapLeftId))
    .map((head) => {
      const row = rowFrom(placed, head.instanceId).filter((pp) => pp.kind === 'morpheme');
      const parts = row.map((pp) => morphemeById(pp.morphId)).filter((m): m is Morpheme => !!m);
      return { head, row, parts, ...buildWord(parts) };
    })
    .filter((w) => w.parts.length >= 2);

  // Look up each new word's dictionary meaning, then redraw its card.
  const [, setDefsVersion] = useState(0);
  const wordsKey = morphemeWords.map((w) => w.word).join('|');
  useEffect(() => {
    let alive = true;
    for (const word of wordsKey.split('|').filter(Boolean)) {
      if (peekDefinition(word) === undefined) void lookupDefinition(word).then(() => { if (alive) setDefsVersion((v) => v + 1); });
    }
    return () => { alive = false; };
  }, [wordsKey]);

  const groupSelected = () => {
    if (multiSel.size < 2) return;
    pushHistory();
    const gid = `g-${Date.now()}`;
    setPlaced((p) => p.map((pp) => (multiSel.has(pp.instanceId) ? { ...pp, groupId: gid } : pp)));
  };
  const ungroupSelected = () => {
    pushHistory();
    setPlaced((p) => {
      const gids = new Set(p.filter((pp) => multiSel.has(pp.instanceId) && pp.groupId).map((pp) => pp.groupId));
      return p.map((pp) => (pp.groupId && gids.has(pp.groupId) ? { ...pp, groupId: undefined } : pp));
    });
  };
  // Settings for a selected piece (her request 2026-10-15): a tap shows a small gear (and the X); the gear (or a
  // double tap) opens a little toolbar with what that piece can do: random words, outline or solid bubbles,
  // group or ungroup, and so on. Grouped pieces share one gear and one toolbar until they're ungrouped.
  const [toolsFor, setToolsFor] = useState<string | null>(null);
  // A student switched to view only (her request 2026-10-15): nothing stays selected or half-dragged.
  useEffect(() => {
    if (!studentViewOnly) return;
    setSelectedId(null);
    setMultiSel(new Set());
    setToolsFor(null);
    setMarquee(null);
    dragInstanceRef.current = null;
    (document.activeElement as HTMLElement | null)?.blur?.();
  }, [studentViewOnly]);
  const unitOf = (id: string | null) => {
    const it = placed.find((pp) => pp.instanceId === id);
    if (!it) return [];
    return it.groupId ? placed.filter((pp) => pp.groupId === it.groupId) : [it];
  };
  const toolsOpenFor = (id: string) => !!toolsFor && toolsFor === selectedId && unitOf(selectedId).some((pp) => pp.instanceId === id);
  const rowMembers = (id: string) => {
    let head = placed.find((pp) => pp.instanceId === id);
    const seen = new Set<string>();
    while (head?.snapLeftId && !seen.has(head.instanceId)) { seen.add(head.instanceId); const l = placed.find((pp) => pp.instanceId === head!.snapLeftId); if (!l) break; head = l; }
    return head ? rowFrom(placed, head.instanceId) : [];
  };
  // "a" before a consonant sound, "an" before a vowel, keeping a capital A at the start.
  const fixArticles = (words: string[]): Record<number, string> => Object.fromEntries(words.map((w, i) => {
    if (!/^an?$/i.test(w) || !words[i + 1]) return [i, w];
    const an = /^[aeiou]/i.test(words[i + 1]);
    const fixed = an ? 'an' : 'a';
    return [i, w[0] === 'A' ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed];
  }));
  // The first word of a sentence: the start of a Symbol Sentence card, or the first symbol of a snapped row.
  const startsSentence = (p: PlacedItem[], pp: PlacedItem) => {
    if (pp.snapLeftId && p.some((q) => q.instanceId === pp.snapLeftId)) return false;
    return pp.kind === 'symbolSentence' || p.some((q) => q.snapLeftId === pp.instanceId);
  };
  const randomizeWords = (ids: Set<string>) => {
    pushHistory();
    setPlaced((p) => p.map((pp) => {
      if (!ids.has(pp.instanceId)) return pp;
      const first = startsSentence(p, pp);
      if (pp.kind === 'shape') return { ...pp, bubbleWord: randomWordInSentence(pp.wordClass ?? 'noun', first) };
      if (pp.kind === 'symbolSentence') {
        const sentence = ALL_SYMBOL_SENTENCES.find((ss) => ss.id === pp.symbolSentenceId);
        if (!sentence) return pp;
        return { ...pp, wordFills: fixArticles(sentence.words.map((w, i) => randomWordInSentence(w.wordClass, first && i === 0))) };
      }
      return pp;
    }).map((pp, _i, all) => {
      // In a snapped row of symbols, a random "a" or "an" matches the word after it too.
      if (pp.kind !== 'shape' || !ids.has(pp.instanceId) || !/^an?$/i.test(pp.bubbleWord ?? '')) return pp;
      const next = all.find((q) => q.snapLeftId === pp.instanceId && q.kind === 'shape');
      if (!next?.bubbleWord) return pp;
      return { ...pp, bubbleWord: fixArticles([pp.bubbleWord!, next.bubbleWord])[0] };
    }));
  };
  const setUnitBubbles = (ids: Set<string>, style: BubbleStyle) => setPlaced((p) => p.map((pp) => (ids.has(pp.instanceId) && (pp.kind === 'shape' || pp.kind === 'symbolSentence') ? { ...pp, bubbleStyle: style } : pp)));
  const setGroup = (ids: Set<string>, gid: string | undefined) => { pushHistory(); setPlaced((p) => p.map((pp) => (ids.has(pp.instanceId) ? { ...pp, groupId: gid } : pp))); };
  const removeUnit = (ids: Set<string>) => {
    pushHistory();
    for (const id of ids) removePlacedItem(id);
    setSelectedId(null);
    setToolsFor(null);
  };

  // Line pieces up on each other's middles (side by side) or centers (stacked), or spread them in a neat row.
  const alignSelected = (how: 'middle' | 'center' | 'row') => {
    const items = placed.filter((pp) => multiSel.has(pp.instanceId) && !pp.snapLeftId && !pp.inFrameId);
    if (items.length < 2) return;
    pushHistory();
    const sized = items.map((pp) => ({ pp, ...measured(pp) }));
    const pos = new Map<string, { x: number; y: number }>();
    if (how === 'middle' || how === 'row') {
      const mid = sized.reduce((a, it) => a + it.pp.y + it.h / 2, 0) / sized.length;
      sized.forEach((it) => pos.set(it.pp.instanceId, { x: it.pp.x, y: mid - it.h / 2 }));
    }
    if (how === 'center') {
      const mid = sized.reduce((a, it) => a + it.pp.x + it.w / 2, 0) / sized.length;
      sized.forEach((it) => pos.set(it.pp.instanceId, { x: mid - it.w / 2, y: it.pp.y }));
    }
    if (how === 'row') {
      let x = Math.min(...sized.map((it) => it.pp.x));
      [...sized].sort((a, b) => a.pp.x - b.pp.x).forEach((it) => {
        pos.set(it.pp.instanceId, { x, y: pos.get(it.pp.instanceId)!.y });
        x += it.w + 16;
      });
    }
    setPlaced((p) => p.map((pp) => { const q = pos.get(pp.instanceId); return q ? { ...pp, ...q } : pp; }));
  };

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

  // While sharing, the teacher's pointer is sent along so watching students see where the teacher points.
  const canvasRelativeRef = useRef(canvasRelative);
  useEffect(() => { canvasRelativeRef.current = canvasRelative; });
  const sendPointer = host.sendPointer;
  useEffect(() => {
    if (host.status !== 'live') return;
    const board = boardRef.current;
    if (!board) return;
    const move = (e: PointerEvent) => {
      const { x, y } = canvasRelativeRef.current(e.clientX, e.clientY);
      sendPointer({ x, y, kind: e.pointerType === 'mouse' ? 'mouse' : 'touch' });
    };
    const leave = () => sendPointer(null);
    board.addEventListener('pointermove', move);
    board.addEventListener('pointerdown', move);
    board.addEventListener('pointerleave', leave);
    return () => { board.removeEventListener('pointermove', move); board.removeEventListener('pointerdown', move); board.removeEventListener('pointerleave', leave); leave(); };
  }, [host.status, sendPointer]);

  // Snap check, the one structural rule left: a dropped/moved grammar
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
      handleDrop(anchorId, kind);
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
    const size = sizeFor(base.kind, base.boxCount, base);
    const item = { ...base, instanceId, x: x - size.w / 2, y: y - size.h / 2 };
    setPlaced((p) => [...p, item]);
    dragInstanceRef.current = instanceId;
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* not supported, window listener still tracks the drag */ }
    bindGlobalDragTracking([item], { x: item.x, y: item.y }, size, base.kind);
  };

  // Symbol Sentences, direct follow-up instruction: "when you drag and
  // drop symbol sentences, they should exist as a unit, with one option
  // for 'x' to close, not individual based on word." Now spawns ONE
  // 'symbolSentence' placed item (reusing the generic tray-spawn path
  // every other material uses) instead of N separate 'shape' items -
  // the whole row moves, selects, and deletes together. Its own real
  // words stay available for the settings popup (see PlacedItem.wordFills)
  // even though the board only ever shows the symbols.
  // A typed pattern from the Symbol Sentences search, dragged out as a row of Grammar Symbols already
  // snapped together (each one still its own symbol with its own word bubble and dice).
  const startDragNewRow = (pattern: PatternWord[]) => (e: React.PointerEvent) => {
    e.preventDefault();
    if (!pattern.length) return;
    pushHistory();
    const { x, y } = canvasRelative(e.clientX, e.clientY);
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const size = sizeFor('shape');
    const items: PlacedItem[] = pattern.map((w, i) => ({
      instanceId: `row-${stamp}-${i}`, kind: 'shape', wordClass: w.wordClass, bubbleWord: w.word || undefined,
      snapLeftId: i ? `row-${stamp}-${i - 1}` : undefined, x: x - size.w / 2 + i * 120, y: y - size.h / 2,
    }));
    setPlaced((p) => [...p, ...items]);
    dragInstanceRef.current = items[0].instanceId;
    bindGlobalDragTracking([items[0]], { x: items[0].x, y: items[0].y }, size, 'shape');
  };

  const startDragNewSymbolSentence = (sentence: SymbolSentence) => startDragNewItem(() => ({
    kind: 'symbolSentence',
    symbolSentenceId: sentence.id,
    boxCount: sentence.words.length,
    wordFills: {},
  }));

  const startDragPlaced = (instanceId: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    if (pinchRef.current) return;
    // Select mode (or shift-click): tapping adds or removes a piece from the multi-selection instead of dragging.
    if (selectMode || e.shiftKey) {
      setMultiSel((set) => { const next = new Set(set); if (next.has(instanceId)) next.delete(instanceId); else next.add(instanceId); return next; });
      return;
    }
    pushHistory();
    dragInstanceRef.current = instanceId;
    // Direct teacher instruction: picking an item up selects it (so its
    // delete/settings badge shows), and picking up a joined Sentence
    // Formula card detaches it from whatever it was stacked under -
    // anything joined BELOW it still comes along, via getChainDescendantIds.
    setSelectedId(instanceId);
    if (!multiSel.has(instanceId) && multiSel.size) setMultiSel(new Set());
    dragStartRef.current = { x: e.clientX, y: e.clientY, moved: false };
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* not supported */ }
  };

  const dragStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  // Only the picked-up piece moves here; anything snapped to its right follows through the layout effect.
  const onDragMove = (e: React.PointerEvent) => {
    const id = dragInstanceRef.current;
    if (!id || pinchRef.current) return;
    const start = dragStartRef.current;
    if (start && !start.moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) {
      start.moved = true;
      if (multiSel.size > 1 && multiSel.has(id)) { /* moving a whole selection: keep rows and boxes intact */ } else
      // Once a piece really starts moving (a plain tap only selects it): a piece in the middle or end of a
      // snapped row lifts out on its own and the row closes the gap; the first piece takes the whole row
      // along. A letter lifted out of a Sound Box leaves it.
      setPlaced((p) => {
        const item = p.find((pp) => pp.instanceId === id);
        if (!item) return p;
        if (item.inFrameId) return p.map((pp) => (pp.instanceId === id ? { ...pp, inFrameId: undefined, cellIndex: undefined } : pp));
        if (!item.snapLeftId) return p;
        return p.map((pp) => {
          if (pp.instanceId === id) return { ...pp, snapLeftId: undefined };
          if (pp.snapLeftId === id) return { ...pp, snapLeftId: item.snapLeftId };
          return pp;
        });
      });
    }
    if (start && !start.moved) return;
    const { x, y } = canvasRelative(e.clientX, e.clientY);
    setPlaced((p) => {
      const dragged = p.find((pp) => pp.instanceId === id);
      if (!dragged) return p;
      const size = sizeFor(dragged.kind, dragged.boxCount, dragged);
      const nx = x - size.w / 2;
      const ny = y - size.h / 2;
      const dx = nx - dragged.x;
      const dy = ny - dragged.y;
      // Everything grouped with the dragged piece moves the same amount, and so does everything picked with
      // drag-to-select when the dragged piece is one of them. (Pieces snapped into a row or a Sound Box follow
      // their row or box on their own.)
      const moving = new Set<string>();
      if (multiSel.has(id)) multiSel.forEach((m) => moving.add(m));
      const groups = new Set(p.filter((pp) => pp.instanceId === id || moving.has(pp.instanceId)).map((pp) => pp.groupId).filter(Boolean));
      return p.map((pp) => {
        if (pp.instanceId === id) return { ...pp, x: nx, y: ny };
        const follows = moving.has(pp.instanceId) || (pp.groupId && groups.has(pp.groupId));
        if (follows && !pp.snapLeftId && !pp.inFrameId) return { ...pp, x: pp.x + dx, y: pp.y + dy };
        return pp;
      });
    });
  };

  // Sound Boxes, direct teacher instruction: "ensure graphemes and
  // alphabet snap into the sound box frames." A dropped letter/grapheme
  // (both use the 'letter' PlacedKind, both happen to already be the
  // same 44x44 size as one box cell) snaps to whichever cell of a
  // nearby Sound Box frame it's closest to.
  const runSoundBoxSnap = (instanceId: string) => {
    setPlaced((current) => {
      const dragged = current.find((p) => p.instanceId === instanceId);
      if (!dragged) return current;
      const size = measured(dragged);
      const centerX = dragged.x + (dragged.kind === 'letter' ? 20 : size.w / 2);
      const centerY = dragged.y + (dragged.kind === 'letter' ? 20 : size.h / 2);
      let best: { frame: PlacedItem; cellIndex: number; dist: number } | null = null;
      for (const f of current) {
        if (f.kind !== 'frame') continue;
        const n = f.boxCount ?? 3;
        const cell = f.cellSize ?? DEFAULT_CELL;
        const pitch = cell + CELL_GAP;
        if (centerX < f.x - 24 || centerX > f.x + frameWidth(n, cell) + 24) continue;
        if (dragged.kind === 'divider') {
          // A split line goes on the line between two boxes.
          if (n < 2 || centerY < f.y - 30 || centerY > f.y + cell + 30) continue;
          const b = Math.max(1, Math.min(n - 1, Math.round((centerX - f.x + CELL_GAP / 2) / pitch)));
          const dist = Math.abs(centerX - (f.x + b * pitch - CELL_GAP / 2));
          if (dist > pitch * 0.6) continue;
          if (!best || dist < best.dist) best = { frame: f, cellIndex: b, dist };
          continue;
        }
        // A sound chip goes under a box; a letter goes in one.
        if (dragged.kind === 'soundChip' ? (centerY < f.y + cell / 2 || centerY > f.y + cell + 70) : (centerY < f.y - 24 || centerY > f.y + cell + 24)) continue;
        const cellIndex = Math.max(0, Math.min(n - 1, Math.round((centerX - f.x - cell / 2) / pitch)));
        const dist = Math.abs(centerX - (f.x + cellIndex * pitch + cell / 2));
        if (!best || dist < best.dist) best = { frame: f, cellIndex, dist };
      }
      if (!best) return current;
      return current.map((p) => (p.instanceId === instanceId ? { ...p, inFrameId: best!.frame.instanceId, cellIndex: best!.cellIndex } : p));
    });
  };

  // Sound Box resizing (her request 2026-10-15): drag the corner handle; the boxes grow or shrink together and
  // any letters in them grow with them.
  const startFrameResize = (instanceId: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    pushHistory();
    const target = e.currentTarget as Element;
    try { target.setPointerCapture(e.pointerId); } catch { /* window listener below still tracks */ }
    const move = (ev: PointerEvent) => {
      const { x } = canvasRelative(ev.clientX, ev.clientY);
      setPlaced((p) => p.map((pp) => {
        if (pp.instanceId !== instanceId) return pp;
        const n = pp.boxCount ?? 3;
        const cell = Math.round(Math.max(36, Math.min(140, (x - pp.x - (n - 1) * CELL_GAP) / n)));
        return { ...pp, cellSize: cell };
      }));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Sentence rows (her request 2026-10-15): a Grammar Symbol, Symbol Sentence, or punctuation tile dropped
  // just right of another one snaps in line beside it (or just left of the first one in a row, in front of it),
  // bottoms lined up. Morpheme pieces snap the same way, but only where a knob meets a notch.
  const runRowSnap = (instanceId: string) => {
    setPlaced((current) => {
      const dragged = current.find((p) => p.instanceId === instanceId);
      if (!dragged) return current;
      const isMorph = dragged.kind === 'morpheme';
      if (!isMorph && !SENTENCE_KINDS.includes(dragged.kind)) return current;
      const row = rowFrom(current, instanceId);
      const tail = row[row.length - 1];
      const rowIds = new Set(row.map((r) => r.instanceId));
      const morph = (pp: PlacedItem) => morphemeById(pp.morphId);
      const sameFamily = (pp: PlacedItem) => (isMorph ? pp.kind === 'morpheme' : SENTENCE_KINDS.includes(pp.kind));
      const fits = (left: PlacedItem, right: PlacedItem) => {
        if (!isMorph) return true;
        const l = morph(left); const r = morph(right);
        return !!l && !!r && canFollow(l, r);
      };
      // Prefixes and suffixes only join up around a base or root: the word being made must have one.
      const headOf = (id: string) => {
        let cur = current.find((c) => c.instanceId === id);
        const seen = new Set<string>();
        while (cur?.snapLeftId && !seen.has(cur.instanceId)) {
          seen.add(cur.instanceId);
          const left = current.find((c) => c.instanceId === cur!.snapLeftId);
          if (!left) break;
          cur = left;
        }
        return cur?.instanceId ?? id;
      };
      const hasCoreWith = (q: PlacedItem) => {
        if (!isMorph) return true;
        return [...row, ...rowFrom(current, headOf(q.instanceId))].some((pp) => { const m = morph(pp); return !!m && isCore(m); });
      };
      const dSize = measured(dragged);
      const tSize = measured(tail);
      let best: { kind: 'after' | 'before'; target: PlacedItem; dist: number } | null = null;
      for (const q of current) {
        if (rowIds.has(q.instanceId) || !sameFamily(q)) continue;
        const qs = measured(q);
        // After q: dragged's left edge near q's right edge.
        const afterX = isMorph ? q.x + (morph(q) ? pieceBodyWidth(morph(q)!) : qs.w) : q.x + qs.w + SENTENCE_GAP;
        const afterY = isMorph ? q.y : q.y + qs.h - dSize.h;
        const dA = Math.hypot(dragged.x - afterX, dragged.y - afterY);
        const qRight = rightOf(current, q.instanceId);
        if (dA < LINE_SNAP && fits(q, dragged) && (!qRight || fits(tail, qRight)) && hasCoreWith(q) && (!best || dA < best.dist)) best = { kind: 'after', target: q, dist: dA };
        // Before q (only the first piece of a row): the dragged row's tail ends where q starts.
        if (!q.snapLeftId || !current.some((c) => c.instanceId === q.snapLeftId)) {
          const tailRight = isMorph ? tail.x + (morph(tail) ? pieceBodyWidth(morph(tail)!) : tSize.w) : tail.x + tSize.w + SENTENCE_GAP;
          const dB = Math.hypot(q.x - tailRight, isMorph ? q.y - tail.y : (q.y + qs.h) - (tail.y + tSize.h));
          if (dB < LINE_SNAP && fits(tail, q) && hasCoreWith(q) && (!best || dB < best.dist)) best = { kind: 'before', target: q, dist: dB };
        }
      }
      if (!best) return current;
      const target = best.target;
      if (glowTimerRef.current) window.clearTimeout(glowTimerRef.current);
      setGlowIds(new Set([instanceId, target.instanceId]));
      glowTimerRef.current = window.setTimeout(() => setGlowIds(new Set()), 900);
      if (best.kind === 'after') {
        const qRight = rightOf(current, target.instanceId);
        return current.map((pp) => {
          if (pp.instanceId === instanceId) return { ...pp, snapLeftId: target.instanceId };
          if (qRight && pp.instanceId === qRight.instanceId) return { ...pp, snapLeftId: tail.instanceId };
          return pp;
        });
      }
      return current.map((pp) => (pp.instanceId === target.instanceId ? { ...pp, snapLeftId: tail.instanceId } : pp));
    });
  };

  // One place every drop (from the tray or on the board) ends up.
  const handleDrop = (id: string, kind: PlacedKind) => {
    if (kind === 'grammar') runSnapCheck(id);
    if (kind === 'morpheme' || SENTENCE_KINDS.includes(kind)) runRowSnap(id);
    if (kind === 'letter' || kind === 'soundChip' || kind === 'divider') runSoundBoxSnap(id);
  };

  const onDragEnd = (e: React.PointerEvent) => {
    const id = dragInstanceRef.current;
    dragInstanceRef.current = null;
    if (!id) return;
    // Drag-to-delete, direct teacher instruction: "allow dragging
    // objects (like frames, boxes) back into the left tool bar and
    // that act should delete it from view." The sidebar sits directly
    // left of the canvas, so releasing to the left of the canvas's own
    // screen edge (in real screen pixels, not the zoomed logical
    // space) is "dropped back on the tray."
    // Everything that was moving with it goes too (her request 2026-10-15): its group, the pieces snapped after
    // it, the rest of a multi-selection, and letters sitting in a Sound Box being dragged.
    const canvasLeft = boardRef.current?.getBoundingClientRect().left ?? 0;
    if (e.clientX < canvasLeft) {
      const gone = new Set<string>([id]);
      if (multiSel.has(id)) multiSel.forEach((m) => gone.add(m));
      let grew = true;
      while (grew) {
        grew = false;
        const groups = new Set(placed.filter((pp) => gone.has(pp.instanceId) && pp.groupId).map((pp) => pp.groupId));
        for (const pp of placed) {
          if (gone.has(pp.instanceId)) continue;
          if ((pp.groupId && groups.has(pp.groupId)) || (pp.snapLeftId && gone.has(pp.snapLeftId)) || (pp.inFrameId && gone.has(pp.inFrameId))) { gone.add(pp.instanceId); grew = true; }
        }
      }
      setPlaced((cur) => cur
        .filter((pp) => !gone.has(pp.instanceId))
        .map((pp) => (pp.snapLeftId && gone.has(pp.snapLeftId) ? { ...pp, snapLeftId: undefined } : pp)));
      setSelectedId(null);
      setMultiSel(new Set());
      dragStartRef.current = null;
      return;
    }
    const item = placed.find((p) => p.instanceId === id);
    // A tap without moving a morpheme piece opens its meaning card (her request: "a hover or click on ipad
    // needs to show the morpheme meaning").
    const tapped = !!dragStartRef.current && !dragStartRef.current.moved;
    if (item?.kind === 'morpheme' && tapped) openMorphemeCard(item);
    dragStartRef.current = null;
    if (item && !tapped) handleDrop(id, item.kind);
  };

  // Clearing the whole board asks first (her request 2026-10-15). Undo still brings it back.
  const [confirmClear, setConfirmClear] = useState(false);
  const isMine = (pp: PlacedItem) => pp.addedBy === myStudentId || myAdded.current.has(pp.instanceId);
  const clearBoard = () => {
    setConfirmClear(false);
    // A student on a shared board only clears what they added themselves.
    if (joinMode) {
      if (!placed.some(isMine)) return;
      pushHistory();
      setPlaced((p) => p.filter((pp) => !isMine(pp)));
      return;
    }
    if (placed.length === 0) return;
    pushHistory();
    setPlaced([]);
  };

  // Tab in a word bubble jumps to the next bubble in the same sentence (her request 2026-10-15): a Symbol
  // Sentence card, a snapped row, or a group, read left to right and top to bottom. Shift+Tab goes back.
  const tabToNextBubble = (e: React.KeyboardEvent) => {
    const input = e.target as HTMLElement;
    if (e.key !== 'Tab' || !input.classList.contains('lm-bubble')) return;
    const owner = input.dataset.owner;
    const start = placed.find((pp) => pp.instanceId === owner);
    if (!owner || !start) return;
    const ids = new Set<string>([owner]);
    const addRow = (id: string) => {
      let head = placed.find((pp) => pp.instanceId === id);
      const seen = new Set<string>();
      while (head?.snapLeftId && !seen.has(head.instanceId)) { seen.add(head.instanceId); const l = placed.find((pp) => pp.instanceId === head!.snapLeftId); if (!l) break; head = l; }
      if (head) for (const r of rowFrom(placed, head.instanceId)) ids.add(r.instanceId);
    };
    addRow(owner);
    for (const id of [...ids]) {
      const g = placed.find((pp) => pp.instanceId === id)?.groupId;
      if (g) for (const pp of placed) if (pp.groupId === g) { ids.add(pp.instanceId); addRow(pp.instanceId); }
    }
    const items = placed.filter((pp) => ids.has(pp.instanceId));
    const band = (pp: PlacedItem) => Math.round((pp.y + measured(pp).h / 2) / 60);
    items.sort((a, b) => band(a) - band(b) || a.x - b.x);
    const order = new Map(items.map((pp, i) => [pp.instanceId, i]));
    const bubbles = [...document.querySelectorAll<HTMLInputElement>('.lm-canvas input.lm-bubble')]
      .filter((el) => el.dataset.owner && order.has(el.dataset.owner))
      .sort((a, b) => order.get(a.dataset.owner!)! - order.get(b.dataset.owner!)! || Number(a.dataset.idx) - Number(b.dataset.idx));
    if (bubbles.length < 2) return;
    e.preventDefault();
    const i = bubbles.indexOf(input as HTMLInputElement);
    const next = bubbles[(i + (e.shiftKey ? -1 : 1) + bubbles.length) % bubbles.length];
    next.focus();
    next.select();
  };

  // The eraser also removes pieces (her request 2026-10-15): with the eraser on, tap a Sound Box, a tile, a
  // symbol, anything, and it comes off the board. A tap on a pen mark erases just the mark.
  const marksAt = (pt: [number, number]) => strokes.some((st) => {
    const reach = ERASER_RADIUS + strokeWidth(st) / 2;
    if (st.points.length === 1) return Math.hypot(pt[0] - st.points[0][0], pt[1] - st.points[0][1]) <= reach;
    for (let i = 1; i < st.points.length; i++) if (distToSegment(pt, st.points[i - 1], st.points[i]) <= reach) return true;
    return false;
  });
  const eraseItemAt = (clientX: number, clientY: number) => {
    const { x, y } = canvasRelative(clientX, clientY);
    const hits = placed.filter((pp) => { const sz = measured(pp); return x >= pp.x && x <= pp.x + sz.w && y >= pp.y && y <= pp.y + sz.h; });
    if (!hits.length) return;
    // The smallest piece under the tap is the one on top (a letter in a Sound Box, a symbol on a scaffold).
    const area = (pp: PlacedItem) => { const sz = measured(pp); return sz.w * sz.h; };
    const target = hits.reduce((a, b) => (area(b) < area(a) ? b : a));
    pushHistory();
    removePlacedItem(target.instanceId);
  };

  // Draw canvas, same transparent-overlay technique as the old marker
  // tool, now the only drawing mechanism (Mark and Draw merged).
  const drawPosFor = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  };

  // The eraser removes any whole mark it touches.
  const eraseAt = (pt: [number, number]) => {
    setStrokes((list) => {
      const keep = list.filter((st) => {
        const reach = ERASER_RADIUS + strokeWidth(st) / 2;
        if (st.points.length === 1) return Math.hypot(pt[0] - st.points[0][0], pt[1] - st.points[0][1]) > reach;
        for (let i = 1; i < st.points.length; i++) if (distToSegment(pt, st.points[i - 1], st.points[i]) <= reach) return false;
        return true;
      });
      return keep.length === list.length ? list : keep;
    });
  };

  const drawStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const p = drawPosFor(e);
    if (drawMode === 'eraser') {
      if (marksAt([p.x, p.y])) eraseAt([p.x, p.y]);
      else { drawing.current = false; eraseItemAt(e.clientX, e.clientY); }
      return;
    }
    liveStroke.current = { id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, mode: drawMode, color: drawColor, points: [[p.x, p.y]] };
    drawLast.current = p;
  };

  const drawMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const p = drawPosFor(e);
    if (drawMode === 'eraser') { eraseAt([p.x, p.y]); return; }
    const ctx = drawCanvasRef.current?.getContext('2d');
    const st = liveStroke.current;
    if (!ctx || !st || !drawLast.current) return;
    st.points.push([p.x, p.y]);
    paintStroke(ctx, { ...st, points: [[drawLast.current.x, drawLast.current.y], [p.x, p.y]] });
    drawLast.current = p;
  };

  const drawEnd = () => {
    drawing.current = false;
    drawLast.current = null;
    const st = liveStroke.current;
    liveStroke.current = null;
    if (st) setStrokes((list) => [...list, st]);
  };

  const clearDrawing = () => setStrokes([]);

  // Repaint every kept mark whenever the list changes (a mark finished, erased, cleared, or arrived from a
  // shared board).
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const st of strokes) paintStroke(ctx, st);
  }, [strokes]);

  // No accounts, no marketplace: everyone gets the full base pen/
  // highlight color set, the dashboard's version adds purchased colors
  // on top of these same base arrays, which doesn't apply here.
  const activePalette = drawMode === 'highlight' ? BASE_HIGHLIGHT_COLORS : BASE_PEN_COLORS;

  const setDrawModeAndColor = (mode: 'pen' | 'highlight' | 'eraser') => {
    setDrawMode(mode);
    if (mode !== 'eraser') setDrawColor(mode === 'pen' ? BASE_PEN_COLORS[0] : BASE_HIGHLIGHT_COLORS[0]);
  };

  if (joinMode && student.status === 'ended') {
    // The teacher stopped sharing or closed their tab (her request 2026-10-15): the welcome screen, saying so,
    // with the same two ways forward.
    return <WelcomeChoice title="This board has been closed." onStart={() => window.location.assign('/?welcome=0')} />;
  }
  if (joinMode && student.status !== 'joined') {
    return <JoinScreen status={student.status} error={student.error} onCheckCode={student.checkCode} onJoin={(n) => { void student.join(n); }} />;
  }

  return (
    <div className={`lm-page${studentViewOnly ? ' lm-readonly' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {welcomeOpen && !joinMode && <WelcomeChoice onStart={closeWelcome} />}
      {confirmClear && (
        <div className="lm-welcome-backdrop" onClick={() => setConfirmClear(false)}>
          <div className="lm-welcome lm-confirm" role="alertdialog" aria-labelledby="lm-confirm-title" onClick={(e) => e.stopPropagation()}>
            {joinMode ? (
              <>
                <h2 id="lm-confirm-title">Clear what you added?</h2>
                <p>
                  {placed.some(isMine)
                    ? "Only the pieces you put on this board will be removed. Your teacher's pieces and other students' pieces stay."
                    : "You haven't added any pieces yet. You can only clear pieces you put on this board."}
                </p>
              </>
            ) : (
              <>
                <h2 id="lm-confirm-title">Clear the whole board?</h2>
                <p>Every piece on the board will be removed. Pen marks stay. You can press Undo to bring the pieces back.</p>
              </>
            )}
            <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
              {joinMode && !placed.some(isMine) ? (
                <button className="btn" autoFocus onClick={() => setConfirmClear(false)}>OK</button>
              ) : (
                <>
                  <button className="btn" autoFocus onClick={() => setConfirmClear(false)}>Keep my board</button>
                  <button className="btn btn-danger" onClick={clearBoard}>{joinMode ? 'Clear my pieces' : 'Clear board'}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {settingsOpen && !joinMode && <SettingsPanel font={fontChoice.font} onFont={fontChoice.setFont} onClose={() => setSettingsOpen(false)} />}
      {shareOpen && !joinMode && (
        <SharePanel
          code={host.code}
          status={host.status}
          error={host.error}
          onRetry={() => { void host.start(); }}
          students={host.students}
          access={host.access}
          onSetAccess={host.setStudentAccess}
          onStop={() => { void host.stop(); setShareOpen(false); }}
          onClose={() => setShareOpen(false)}
        />
      )}
      {/* Top toolbar, same collapsible bar as the dashboard's native
          tool, minus Help (tied to a student account) and Exit (there's
          no "home" to leave to in a standalone page). */}
      <div className="lm-toolbar" style={{ flex: '0 0 auto' }}>
        {studentViewOnly ? (
          // A view-only student just watches: no tools, only who they are and what they can do.
          <>
            <span className="lm-sidebar-title" style={{ marginRight: 8 }}>Literacy Manipulatives</span>
            <span className="lm-share-badge"><Icon name="eye" /> Watching your teacher's board{student.name ? `, ${student.name}` : ''}</span>
          </>
        ) : topBarOpen ? (
          <>
            <span className="lm-sidebar-title" style={{ marginRight: 8 }}>Literacy Manipulatives</span>
            <button className="btn btn-sm" onClick={() => setSidebarOpen((v) => !v)} aria-label={sidebarOpen ? 'Hide materials' : 'Show materials'}>{sidebarOpen ? '⟨⟨' : '⟩⟩'}</button>
            <span className="lm-toolbar-divider" />
            <button className={`btn btn-sm ${drawOn ? 'btn-primary' : ''}`} onClick={() => setDrawOn((v) => !v)}>Draw</button>
            <button className={`btn btn-sm ${selectMode ? 'btn-primary' : ''}`} onClick={() => { setSelectMode((v) => !v); setMultiSel(new Set()); }} title="Pick several pieces to group or line up">Select</button>
            <button className="btn btn-sm" onClick={undo} disabled={!canUndo}>Undo</button>
            <button className="btn btn-sm" onClick={redo} disabled={!canRedo}>Redo</button>
            <button className="btn btn-sm" onClick={() => setConfirmClear(true)} disabled={placed.length === 0}>Clear</button>
            <span className="lm-toolbar-divider" />
            <button className="btn btn-sm" onClick={zoomOut} disabled={zoom <= 0.5} aria-label="Zoom out">−</button>
            <button className="btn btn-sm" onDoubleClick={zoomReset} aria-label="Double click to go back to the start view" title="Double click to go back to the start view">{Math.round(zoom * 100)}%</button>
            <button className="btn btn-sm" onClick={zoomIn} disabled={zoom >= 2} aria-label="Zoom in">+</button>
            <span className="lm-toolbar-divider" />
            {/* Share replaces Print and Projector Mode (her request 2026-10-15). */}
            {joinMode ? (
              <span className="lm-share-badge"><Icon name="pencil" /> You can move pieces{student.name ? `, ${student.name}` : ''}</span>
            ) : (
              <button
                className={`btn btn-sm ${host.status === 'live' ? 'btn-primary' : ''}`}
                onClick={() => { if (shareOpen) { setShareOpen(false); return; } setShareOpen(true); if (shareConfigured && host.status === 'off') void host.start(); }}
                aria-expanded={shareOpen}
                aria-label={host.status === 'live' && host.code ? `Sharing, code ${host.code}` : 'Share'}
              >
                {host.status === 'live' && host.code ? host.code : 'Share'}
              </button>
            )}
            {!joinMode && <button className={`btn btn-sm ${settingsOpen ? 'btn-primary' : ''}`} onClick={() => setSettingsOpen((o) => !o)}>Settings</button>}
            <span style={{ flex: 1 }} />
            <button className="btn btn-sm" onClick={() => setTopBarOpen(false)} aria-label="Hide toolbar">▲ Hide bar</button>
          </>
        ) : (
          <button className="btn btn-sm" onClick={() => setTopBarOpen(true)} aria-label="Show toolbar">▼ Show toolbar</button>
        )}
      </div>
      {topBarOpen && drawOn && (
        <div className="lm-toolbar" style={{ flex: '0 0 auto', paddingTop: 0 }}>
          <button className={`btn btn-sm ${drawMode === 'pen' ? 'btn-primary' : ''}`} onClick={() => setDrawModeAndColor('pen')}>Pen</button>
          <button className={`btn btn-sm ${drawMode === 'highlight' ? 'btn-primary' : ''}`} onClick={() => setDrawModeAndColor('highlight')}>Highlight</button>
          <button className={`btn btn-sm ${drawMode === 'eraser' ? 'btn-primary' : ''}`} onClick={() => setDrawModeAndColor('eraser')} title="Tap a mark or a piece to erase it">Eraser</button>
          <span className="lm-toolbar-divider" />
          {drawMode !== 'eraser' && activePalette.map((hex, i) => (
            <button
              key={`${hex}-${i}`}
              onClick={() => setDrawColor(hex)}
              aria-label="Color"
              style={{ width: 28, height: 28, borderRadius: '50%', background: hex, cursor: 'pointer', padding: 0, border: drawColor === hex ? '3px solid var(--ink)' : '2px solid var(--content-border)' }}
            />
          ))}
          <span className="lm-toolbar-divider" />
          <button className="btn btn-sm" onClick={clearDrawing} disabled={strokes.length === 0}>Clear marks</button>
        </div>
      )}

      <div className="lm-shell" style={{ flex: 1, minHeight: 0 }}>
      {sidebarOpen && !studentViewOnly ? (
        <aside className="lm-sidebar">
          <Category label="Grammar Symbols" color="#E5B9E0" open={openCategories.shapes} onToggle={() => toggleCategory('shapes')}>
            <TraySearch value={searchFor('shapes')} onChange={setSearch('shapes')} placeholder="Find a grammar symbol" />
            <BubbleToggle value={bubbleDefault} onChange={setAllBubbles} />
            {(() => {
              const byName = (Object.keys(MONTESSORI_WORD_CLASS_INFO) as MontessoriWordClass[]).filter((cls) => matches('shapes', MONTESSORI_WORD_CLASS_INFO[cls].name, MONTESSORI_WORD_CLASS_INFO[cls].label));
              // Typing a word (not a part of speech name) shows that word's symbol, ready to drag out with the
              // word already in its bubble.
              const byWord = byName.length ? [] : symbolsForWords(searchFor('shapes'));
              return (
                <div className="row-wrap" style={{ gap: 8 }}>
                  {byName.map((cls) => {
                    const info = MONTESSORI_WORD_CLASS_INFO[cls];
                    return (
                      <Draggable key={cls} label={info.label} onPointerDown={startDragNewItem(() => ({ kind: 'shape', wordClass: cls }))}>
                        <ItemVisual kind="shape" wordClass={cls} compact />
                      </Draggable>
                    );
                  })}
                  {byWord.map((w, i) => {
                    const info = MONTESSORI_WORD_CLASS_INFO[w.wordClass];
                    return (
                      <div key={`${w.word}-${i}`} className="lm-word-symbol">
                        <Draggable label={`${w.word}: ${info.name}`} onPointerDown={startDragNewItem(() => ({ kind: 'shape', wordClass: w.wordClass, bubbleWord: w.word }))}>
                          <ItemVisual kind="shape" wordClass={w.wordClass} compact />
                        </Draggable>
                        <span><strong>{w.word}</strong> {info.name.toLowerCase()}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Category>

          <Category label="Symbol Sentences" color="#C0D6F5" open={openCategories.symbolSentences} onToggle={() => toggleCategory('symbolSentences')}>
            <TraySearch value={searchFor('sentences')} onChange={setSearch('sentences')} placeholder="Type a sentence or parts of speech" />
            <BubbleToggle value={bubbleDefault} onChange={setAllBubbles} />
            {searchFor('sentences').trim() ? (() => {
              // Her request 2026-10-15: type an example sentence ("the big dog jumped" finds "the small cat
              // ran") or the parts of speech ("proper noun verb adjective"); matching cards show, and the typed
              // pattern itself can be dragged out as a row of symbols.
              const { pattern, matches: found } = searchSymbolSentences(searchFor('sentences'));
              return (
                <div className="stack" style={{ gap: 8 }}>
                  {pattern && (
                    <Draggable label="Drag out this pattern" onPointerDown={startDragNewRow(pattern)} style={{ width: '100%' }}>
                      <div className="lm-pattern-card">
                        <span className="lm-pattern-icons">
                          {pattern.map((w, i) => <img key={i} src={MONTESSORI_WORD_CLASS_INFO[w.wordClass].imageUrl} alt={MONTESSORI_WORD_CLASS_INFO[w.wordClass].name} draggable={false} />)}
                        </span>
                        <span className="lm-pattern-text">{pattern.map((w) => w.word || MONTESSORI_WORD_CLASS_INFO[w.wordClass].name.toLowerCase()).join(' ')}</span>
                      </div>
                    </Draggable>
                  )}
                  {found.map((sentence) => (
                    <SymbolSentenceCard key={sentence.id} sentence={sentence} onPointerDown={startDragNewSymbolSentence(sentence)} />
                  ))}
                  {pattern && !pattern.some((w) => w.wordClass === 'verb') && <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>A sentence needs a verb (an action word).</span>}
                  {found.length === 0 && <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>No card with that pattern yet. Drag the pattern above to build it.</span>}
                </div>
              );
            })() : SYMBOL_SENTENCE_PAGES.map((page) => (
              <SubcategoryRow key={page.id} id={page.id} label={page.label} open={openSubcategories[page.id]} onToggle={() => toggleSubcategory(page.id)}>
                <div className="stack" style={{ gap: 8 }}>
                  {page.sentences.map((sentence) => (
                    <SymbolSentenceCard key={sentence.id} sentence={sentence} onPointerDown={startDragNewSymbolSentence(sentence)} />
                  ))}
                </div>
              </SubcategoryRow>
            ))}
          </Category>

          {/* Morphemes (her request 2026-10-15): every morpheme from the DSF Level 1 Unit 1 tile deck and the 111
              Greek/Latin list, sorted into prefixes, suffixes, free bases and Greek & Latin roots. Hover a piece
              to see its meaning; on the board, tap a piece for its card. */}
          <Category label="Morphemes" color="#C5E4ED" open={openCategories.morphemes} onToggle={() => toggleCategory('morphemes')}>
            <input className="lm-tray-search" type="search" value={morphSearch} onChange={(e) => setMorphSearch(e.target.value)} placeholder="Find a morpheme or meaning" aria-label="Find a morpheme or meaning" />
            {MORPHEME_GROUPS.map((group) => {
              const q = morphSearch.trim().toLowerCase();
              const items = q ? group.items.filter((m) => m.text.toLowerCase().includes(q) || m.meaning.toLowerCase().includes(q)) : group.items;
              if (q && items.length === 0) return null;
              return (
                <SubcategoryRow key={group.key} id={group.key} label={`${group.label} (${items.length})`} open={!!q || openSubcategories[group.key]} onToggle={() => toggleSubcategory(group.key)}>
                  <div className="row-wrap" style={{ gap: 6 }}>
                    {items.map((m) => (
                      <Draggable key={m.id} label={`${pieceLabel(m)}: ${m.meaning}`} onPointerDown={startDragNewItem(() => ({ kind: 'morpheme', morphId: m.id }))}>
                        <ReferencePopover mode="hover" title={`${pieceLabel(m)} (${KIND_LABEL[m.kind].toLowerCase()})`} body={m.meaning}>
                          <ItemVisual kind="morpheme" morphId={m.id} compact />
                        </ReferencePopover>
                      </Draggable>
                    ))}
                  </div>
                </SubcategoryRow>
              );
            })}
          </Category>

          <Category label="Alphabet" color="#FEDBC1" open={openCategories.letters} onToggle={() => toggleCategory('letters')}>
            {/* A23-ROADMAP Phase 2: vowel/consonant coloring toggle,
                shared with Graphemes below (both are letter tiles). */}
            <button type="button" className={`btn btn-sm ${vowelConsonantColors ? 'btn-primary' : ''}`} style={{ fontSize: '0.7rem', marginBottom: 6 }} onClick={() => setVowelConsonantColors((v) => !v)}>
              Vowel/consonant colors: {vowelConsonantColors ? 'On' : 'Off'}
            </button>
            <TraySearch value={searchFor('letters')} onChange={setSearch('letters')} placeholder="Find a letter" />
            <div className="row-wrap" style={{ gap: 6 }}>
              {LETTERS.filter((l) => matches('letters', l)).map((l) => {
                const display = caseFor(l) === 'lower' ? l.toLowerCase() : l;
                return (
                  <Draggable key={l} label={display} onPointerDown={startDragNewItem(() => ({ kind: 'letter', letter: display }))} onDoubleClick={() => toggleTrayCase(l)}>
                    <ItemVisual kind="letter" letter={display} vowelConsonantColors={vowelConsonantColors} />
                  </Draggable>
                );
              })}
            </div>
          </Category>

          <Category label="Graphemes" color="#FBF2BB" open={openCategories.graphemes} onToggle={() => toggleCategory('graphemes')}>
            <TraySearch value={searchFor('graphemes')} onChange={setSearch('graphemes')} placeholder="Find a spelling or sound" />
            {GRAPHEME_GROUPS.filter((group) => group.graphemes.some(({ g, sound }) => matches('graphemes', g, sound))).map((group) => (
              <SubcategoryRow key={group.key} id={`graph-${group.key}`} label={group.label} open={!!searchFor('graphemes').trim() || openSubcategories[`graph-${group.key}`]} onToggle={() => toggleSubcategory(`graph-${group.key}`)}>
                <div className="row-wrap" style={{ gap: 4 }}>
                  {group.graphemes.filter(({ g, sound }) => matches('graphemes', g, sound)).map(({ g, sound }) => (
                    <Draggable key={`${g}-${sound}`} label={`${g}, ${sound}`} onPointerDown={startDragNewItem(() => ({ kind: 'letter', letter: g }))}>
                      <ReferencePopover mode="hover" title={g} body={sound}>
                        <ItemVisual kind="letter" letter={g} vowelConsonantColors={vowelConsonantColors} />
                      </ReferencePopover>
                    </Draggable>
                  ))}
                </div>
              </SubcategoryRow>
            ))}
          </Category>

          {/* The dashboard's native tool gates this per-student on a
              teacher toggle (StudentManager.tsx). No accounts here, so
              it's always on, every tool unlocked for anyone. */}
          {(
            <Category label="Punctuation" color="#cbd5e1" open={openCategories.punctuation} onToggle={() => toggleCategory('punctuation')}>
              <TraySearch value={searchFor('punct')} onChange={setSearch('punct')} placeholder="Find a mark" />
              <div className="row-wrap" style={{ gap: 8 }}>
                {PUNCTUATION_MARKS.filter((m) => matches('punct', m.name, m.mark, m.label)).map((m) => (
                  <Draggable key={m.id} label={m.name} onPointerDown={startDragNewItem(() => ({ kind: 'punctuation', punctId: m.id }))}>
                    <ItemVisual kind="punctuation" punctId={m.id} />
                  </Draggable>
                ))}
              </div>
            </Category>
          )}

          {/* A23-ROADMAP Phase 3: "phonological awareness (sound chips,
              syllable tapping, onset-rime slider) as new sidebar
              categories", free-play manipulatives, no target word, no
              auto-counting/auto-splitting, matching this sandbox's
              standing "entirely unscripted" rule. */}
          <Category label="Phonological Awareness" color="#FFDAE0" open={openCategories.phono} onToggle={() => toggleCategory('phono')}>
            <div className="row-wrap" style={{ gap: 10, alignItems: 'flex-start' }}>
              <Draggable label="Sound chip" onPointerDown={startDragNewItem(() => ({ kind: 'soundChip' }))}>
                <ItemVisual kind="soundChip" />
              </Draggable>
              <Draggable label="Sound split line" onPointerDown={startDragNewItem(() => ({ kind: 'divider' }))}>
                <ItemVisual kind="divider" />
              </Draggable>
            </div>
          </Category>

          <Category label="Sound Boxes" color="#C6E8CC" open={openCategories.frames} onToggle={() => toggleCategory('frames')}>
            <div className="stack" style={{ gap: 10 }}>
              {FRAME_SIZES.map((n) => (
                <Draggable key={n} label={`${n}-box frame`} onPointerDown={startDragNewItem(() => ({ kind: 'frame', boxCount: n }))}>
                  <ItemVisual kind="frame" boxCount={n} />
                </Draggable>
              ))}
            </div>
          </Category>

          <Category label="Text Box" color="#C0D6F5" open={openCategories.textbox} onToggle={() => toggleCategory('textbox')}>
            <Draggable label="Add a text box" onPointerDown={startDragNewItem(() => ({ kind: 'textbox', textValue: '', fontSize: 20 }))} style={{ width: '100%' }}>
              <div style={{
                width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                border: '2px dashed var(--ink)', borderRadius: 8, background: 'white', fontFamily: 'var(--lm-font)', fontWeight: 700, fontSize: '0.85rem', padding: '6px 10px',
              }}>
                Add a text box
              </div>
            </Draggable>
          </Category>

        </aside>
      ) : null}

      <div className="lm-main">
        <div ref={boardRef} className="lm-board" style={{ position: 'relative', flex: 1, minHeight: 0 }}
            onPointerDown={(e) => {
              if (drawOn || studentViewOnly || pinchRef.current || (e.target !== e.currentTarget && e.target !== canvasRef.current)) return;
              setSelectedId(null);
              const { x, y } = canvasRelative(e.clientX, e.clientY);
              setMarquee({ x0: x, y0: y, x1: x, y1: y });
              try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* not supported */ }
            }}
            onPointerMove={(e) => {
              if (!marquee || pinchRef.current) return;
              const { x, y } = canvasRelative(e.clientX, e.clientY);
              setMarquee((m) => (m ? { ...m, x1: x, y1: y } : m));
            }}
            onPointerUp={() => {
              if (!marquee) return;
              const l = Math.min(marquee.x0, marquee.x1), r = Math.max(marquee.x0, marquee.x1);
              const t = Math.min(marquee.y0, marquee.y1), b = Math.max(marquee.y0, marquee.y1);
              setMarquee(null);
              if (r - l < 6 && b - t < 6) { setMultiSel(new Set()); return; }
              const hit = placed.filter((pp) => {
                const sz = measured(pp);
                return pp.x < r && pp.x + sz.w > l && pp.y < b && pp.y + sz.h > t;
              });
              // Selecting one piece of a group selects the whole group.
              const groups = new Set(hit.map((pp) => pp.groupId).filter(Boolean));
              setMultiSel(new Set(placed.filter((pp) => hit.includes(pp) || (pp.groupId && groups.has(pp.groupId))).map((pp) => pp.instanceId)));
            }}
          >
          {(selectMode || multiSel.size > 0) && (
            <div className="lm-select-bar" role="toolbar" aria-label="Selected pieces">
              <strong>{multiSel.size ? `${multiSel.size} selected` : 'Tap pieces, or drag a box around them'}</strong>
              <button className="btn btn-sm" disabled={multiSel.size < 2} onClick={groupSelected}>Group</button>
              <button className="btn btn-sm" disabled={!placed.some((pp) => multiSel.has(pp.instanceId) && pp.groupId)} onClick={ungroupSelected}>Ungroup</button>
              <button className="btn btn-sm" disabled={multiSel.size < 2} onClick={() => alignSelected('middle')} title="Line up their middles side by side">Align middles</button>
              <button className="btn btn-sm" disabled={multiSel.size < 2} onClick={() => alignSelected('center')} title="Line up their centers in a column">Align centers</button>
              <button className="btn btn-sm" disabled={multiSel.size < 2} onClick={() => alignSelected('row')} title="Even row, middles lined up">Line up</button>
              <button className="btn btn-sm" onClick={() => { setSelectMode(false); setMultiSel(new Set()); }}>Done</button>
            </div>
          )}
          <div
            ref={canvasRef}
            className="lm-canvas"
            onKeyDown={tabToNextBubble}
            style={{ position: 'relative', height: '100%', overflow: 'visible', pointerEvents: drawOn ? 'none' : undefined, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
          >
            {placed.filter((p) => p.kind !== 'textbox' && p.kind !== 'symbolSentence').map((p) => (
              // Sound Boxes sit behind everything else on purpose (a
              // background a student drops letters onto, direct teacher
              // report: letter/grapheme tiles were rendering behind the
              // box outlines), every other kind gets the higher z-index.
              // A Grammar Symbol and its word bubble stack as one centered column (her report 2026-10-15: bubbles
              // must sit centered under the symbol, even when the word is wider than the icon).
              <div key={p.instanceId} ref={setItemRef(p.instanceId)} style={{ position: 'absolute', left: p.x, top: p.y, zIndex: p.kind === 'frame' ? 1 : 2, ...(p.kind === 'shape' ? { display: 'flex', flexDirection: 'column', alignItems: 'center' } : {}) }}>
                <Draggable
                  label="Placed item"
                  glowing={glowIds.has(p.instanceId)}
                  onPointerDown={startDragPlaced(p.instanceId)}
                  onPointerMove={onDragMove}
                  onPointerUp={onDragEnd}
                  onDoubleClick={p.kind === 'letter' ? () => toggleLetterCase(p.instanceId)
                    : p.kind === 'soundChip' ? () => { setSelectedId(p.instanceId); setChipMenuFor((cur) => (cur === p.instanceId ? null : p.instanceId)); }
                    : p.kind === 'frame' ? () => { setSelectedId(p.instanceId); setBoxInsertFor((cur) => (cur === p.instanceId ? null : p.instanceId)); }
                    : undefined}
                  style={multiSel.has(p.instanceId) ? { outline: '3px dashed var(--brand-blue)', outlineOffset: 3, borderRadius: 10 } : selectedId === p.instanceId ? { boxShadow: '0 0 0 3px rgba(25,104,171,0.35)', borderRadius: 10 } : undefined}
                >
                  <ItemVisual
                    kind={p.kind} pieceId={p.pieceId} wordClass={p.wordClass} letter={p.letter} boxCount={p.boxCount} morphId={p.morphId} punctId={p.punctId}
                    vowelConsonantColors={vowelConsonantColors} cellSize={p.cellSize}
                    tileSize={p.kind === 'letter' && p.inFrameId ? (placed.find((f) => f.instanceId === p.inFrameId)?.cellSize ?? DEFAULT_CELL) : undefined}
                    linkedLeft={p.kind === 'morpheme' && !!p.snapLeftId && placed.some((q) => q.instanceId === p.snapLeftId && q.kind === 'morpheme')}
                    linkedRight={p.kind === 'morpheme' && placed.some((q) => q.snapLeftId === p.instanceId && q.kind === 'morpheme')}
                    chipColor={p.chipColor}
                  />
                </Draggable>
                {/* The word bubble is part of the symbol (her picture, 2026-10-15): it sits right under the icon and
                    moves with it. Tap it to type a word. */}
                {p.kind === 'shape' && (
                  <div className="lm-bubble-row">
                    <WordBubble
                      value={p.bubbleWord ?? ''}
                      placeholder={MONTESSORI_WORD_CLASS_INFO[p.wordClass ?? 'noun'].name.toLowerCase()}
                      color={MONTESSORI_WORD_CLASS_INFO[p.wordClass ?? 'noun'].color}
                      bubbleStyle={p.bubbleStyle ?? bubbleDefault}
                      label={`${MONTESSORI_WORD_CLASS_INFO[p.wordClass ?? 'noun'].name} word`}
                      onChange={(v) => setPlacedField(p.instanceId, { bubbleWord: v })}
                      owner={p.instanceId}
                    />
                  </div>
                )}
                {/* Delete (+ Settings for a single Grammar Symbol) -
                    direct teacher instruction: "ensure that after i drag
                    and drop, the x is not shown on the assets on the
                    whiteboard. only show x upon moving or selected.
                    (click to view x on touchscreen)." Picking an item up
                    (startDragPlaced) selects it, so the badge stays
                    visible through the whole drag and after, until
                    something else is selected or empty canvas is tapped.
                    Follow-up instruction: "have the same setting button
                    appear for single grammar symbols" (matching the
                    Symbol Sentence settings/close pair). */}
                {p.kind === 'soundChip' && chipMenuFor === p.instanceId && selectedId === p.instanceId && (
                  <div className="lm-chip-menu lm-item-controls" role="radiogroup" aria-label="Chip color" onPointerDown={(e) => e.stopPropagation()}>
                    {CHIP_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={(p.chipColor ?? LM_PHONO_COLOR) === c}
                        aria-label={`Color ${c}`}
                        className={(p.chipColor ?? LM_PHONO_COLOR) === c ? 'on' : ''}
                        style={{ background: c }}
                        onClick={() => { setPlacedField(p.instanceId, { chipColor: c }); setChipMenuFor(null); }}
                      />
                    ))}
                  </div>
                )}
                {p.kind === 'frame' && boxInsertFor === p.instanceId && selectedId === p.instanceId && (p.boxCount ?? 3) < MAX_BOXES && (
                  Array.from({ length: (p.boxCount ?? 3) + 1 }).map((_, i) => {
                    const cell = p.cellSize ?? DEFAULT_CELL;
                    const n = p.boxCount ?? 3;
                    const x = i === 0 ? -16 : i === n ? frameWidth(n, cell) + 16 : i * (cell + CELL_GAP) - CELL_GAP / 2;
                    return (
                      <button
                        key={i}
                        type="button"
                        className="lm-box-plus lm-item-controls"
                        style={{ left: x, top: cell / 2 }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => insertBox(p.instanceId, i)}
                        aria-label={i === 0 ? 'Add a box at the start' : i === n ? 'Add a box at the end' : `Add a box between box ${i} and box ${i + 1}`}
                      >+</button>
                    );
                  })
                )}
                {selectedId === p.instanceId && p.kind === 'frame' && (
                  <div className="lm-resize-handle lm-item-controls" onPointerDown={startFrameResize(p.instanceId)} role="slider" aria-label="Resize sound boxes" aria-valuenow={p.cellSize ?? DEFAULT_CELL} aria-valuemin={36} aria-valuemax={140} title="Drag to resize">⤡</div>
                )}
              </div>
            ))}
            {/* Everyone else's selection on a shared board, outlined in their color with their name. */}
            {Object.values(joinMode ? student.remoteFocus : host.remoteFocus).map((f) => {
              const items = f.ids.map((id) => placed.find((pp) => pp.instanceId === id)).filter((pp): pp is PlacedItem => !!pp);
              if (!items.length) return null;
              return items.map((pp, i) => {
                const sz = measured(pp);
                return (
                  <div key={`${f.from}-${pp.instanceId}`} className="lm-remote-focus" style={{ left: pp.x - 5, top: pp.y - 5, width: sz.w + 10, height: sz.h + 10, borderColor: f.color }} aria-hidden="true">
                    {i === 0 && <span className="lm-remote-name" style={{ background: f.color }}>{f.name}</span>}
                  </div>
                );
              });
            })}
            {/* A watching student sees where the teacher is pointing: an arrow for a mouse, a finger for touch. */}
            {studentViewOnly && student.teacherPointer && (
              <div className={`lm-teacher-pointer ${student.teacherPointer.kind}`} style={{ left: student.teacherPointer.x, top: student.teacherPointer.y }} aria-hidden="true">
                <Icon name={student.teacherPointer.kind === 'touch' ? 'finger' : 'arrow'} size={student.teacherPointer.kind === 'touch' ? 56 : 44} />
              </div>
            )}
            {/* The selected piece's (or group's) gear and X, and its settings toolbar when open. */}
            {(() => {
              const sel = placed.find((pp) => pp.instanceId === selectedId);
              if (!sel || sel.kind === 'textbox' || multiSel.size > 1 || studentViewOnly) return null;
              const unit = unitOf(sel.instanceId);
              const ids = new Set(unit.map((pp) => pp.instanceId));
              const right = Math.max(...unit.map((pp) => pp.x + measured(pp).w));
              const top = Math.min(...unit.map((pp) => pp.y));
              const open = toolsFor === sel.instanceId;
              const worded = unit.filter((pp) => pp.kind === 'shape' || pp.kind === 'symbolSentence');
              const style = worded[0]?.bubbleStyle ?? bubbleDefault;
              const row = rowMembers(sel.instanceId);
              const canGroupRow = !sel.groupId && row.length > 1;
              const loneSentence = unit.length === 1 && sel.kind === 'symbolSentence';
              const loneFrame = unit.length === 1 && sel.kind === 'frame';
              const hasTools = worded.length > 0 || !!sel.groupId || canGroupRow || loneFrame;
              const stop = (e: React.PointerEvent) => e.stopPropagation();
              return (
                <div className="lm-unit-controls lm-item-controls" style={{ left: right + 12, top: top - 22 }} onPointerDown={stop}>
                  {open && hasTools && (
                    <div className="lm-unit-tools" role="toolbar" aria-label={sel.groupId ? 'Group settings' : 'Settings'}>
                      {worded.length > 0 && (
                        <>
                          <button type="button" className="lm-tool-btn" onClick={() => randomizeWords(ids)} title="Random words"><Icon name="dice" size={16} /> Random</button>
                          <span className="lm-tool-pair" role="radiogroup" aria-label="Word bubbles">
                            <button type="button" role="radio" aria-checked={style !== 'solid'} className={`lm-tool-btn${style !== 'solid' ? ' on' : ''}`} onClick={() => setUnitBubbles(ids, 'outline')} aria-label="Outline bubbles"><BubbleSwatch solid={false} /></button>
                            <button type="button" role="radio" aria-checked={style === 'solid'} className={`lm-tool-btn${style === 'solid' ? ' on' : ''}`} onClick={() => setUnitBubbles(ids, 'solid')} aria-label="Solid bubbles"><BubbleSwatch solid /></button>
                          </span>
                        </>
                      )}
                      {loneSentence && <button type="button" className="lm-tool-btn" onClick={() => setPlacedField(sel.instanceId, { wordFills: {}, punctFills: {} })} title="Put the sentence's own words back">Reset words</button>}
                      {loneFrame && (
                        <>
                          <button type="button" className="lm-tool-btn" onClick={() => adjustFrameBoxCount(sel.instanceId, -1)} disabled={(sel.boxCount ?? 3) <= 1} aria-label="Remove a box">− Box</button>
                          <button type="button" className="lm-tool-btn" onClick={() => adjustFrameBoxCount(sel.instanceId, 1)} disabled={(sel.boxCount ?? 3) >= MAX_BOXES} aria-label="Add a box">+ Box</button>
                        </>
                      )}
                      {sel.groupId && <button type="button" className="lm-tool-btn" onClick={() => setGroup(ids, undefined)}>Ungroup</button>}
                      {canGroupRow && <button type="button" className="lm-tool-btn" onClick={() => setGroup(new Set(row.map((pp) => pp.instanceId)), `g-${Date.now()}`)}>Group</button>}
                    </div>
                  )}
                  <div className="lm-unit-badges">
                    {hasTools && (
                      <button type="button" className={`lm-ctl${open ? ' on' : ''}`} onClick={() => setToolsFor(open ? null : sel.instanceId)} aria-label={open ? 'Close settings' : 'Settings'} aria-expanded={open} title="Settings"><Icon name="gear" size={16} /></button>
                    )}
                    <button type="button" className="lm-ctl lm-ctl-x" onClick={() => removeUnit(ids)} aria-label={unit.length > 1 ? 'Remove this group' : 'Remove'}>×</button>
                  </div>
                </div>
              );
            })()}
            {/* A word built from snapped morpheme pieces gets a movable card (× to close, drag to move) that says
                whether it's a real word and what each part means. A made-up word from real parts is welcome too. */}
            {morphemeWords.map((w) => {
              const st = wordCardState[w.head.instanceId];
              if (st?.closedWord === w.word) return null;
              const speakId = `word-${w.head.instanceId}`;
              const partsText = w.parts.map((m) => `${pieceLabel(m)} means ${m.meaning}`).join('. ');
              // Real words get their dictionary meaning; a made-up word gets what it could mean if it were real.
              const def = peekDefinition(w.word);
              const real = w.real || !!def?.text;
              const looking = def === undefined;
              const guess = madeUpMeaning(w.parts);
              const meaningLine = def?.text
                ? `${def.partOfSpeech ? `(${def.partOfSpeech}) ` : ''}${def.text}`
                : looking && w.real ? 'Looking up the meaning...' : guess;
              const meaningLabel = def?.text ? 'Means' : real ? 'From its parts' : 'Could mean';
              const spoken = `${w.word}. ${real ? 'This is a real word.' : 'This is a nonsense word built from real parts.'} ${looking && w.real ? '' : `${meaningLabel}: ${meaningLine}`} ${partsText}.`;
              return (
                <FloatingCard
                  key={`word-${w.head.instanceId}`}
                  x={w.head.x + (st?.dx ?? 0)}
                  y={w.head.y + 78 + (st?.dy ?? 0)}
                  width={300}
                  zoom={zoom}
                  title={<>{w.word}<span className={`lm-word-tag ${real ? 'real' : 'nonsense'}`}>{real ? 'Real' : 'Nonsense'}</span></>}
                  tone={real ? 'real' : 'nonsense'}
                  subtitle={<><strong>{meaningLabel}:</strong> {meaningLine}</>}
                  actions={<SyncedSpeakButton id={speakId} text={spoken} tts={tts} settings={ttsSettings} className="lm-float-speak" ariaLabel={`Hear ${w.word}`} />}
                  onMove={(x, y) => setWordCardState((s) => ({ ...s, [w.head.instanceId]: { ...(s[w.head.instanceId] ?? {}), dx: x - w.head.x, dy: y - w.head.y - 78 } }))}
                  onClose={() => setWordCardState((s) => ({ ...s, [w.head.instanceId]: { dx: s[w.head.instanceId]?.dx ?? 0, dy: s[w.head.instanceId]?.dy ?? 0, closedWord: w.word } }))}
                >
                  <ul className="lm-float-parts" style={{ marginTop: 0 }}>
                    {w.parts.map((m, i) => <li key={i}><strong>{pieceLabel(m)}</strong> = {m.meaning}</li>)}
                  </ul>
                </FloatingCard>
              );
            })}
            {/* A morpheme's meaning card (tap a piece on the board). A root's card also explains what a root is. */}
            {morphCards.map((c) => {
              const m = morphemeById(c.morphId);
              if (!m) return null;
              const speakId = `mcard-${c.id}`;
              const spoken = `${pieceLabel(m)}. ${m.meaning}. ${kindExplanation(m)}`;
              return (
                <FloatingCard
                  key={c.id}
                  x={c.x}
                  y={c.y}
                  zoom={zoom}
                  title={pieceLabel(m)}
                  actions={<SyncedSpeakButton id={speakId} text={spoken} tts={tts} settings={ttsSettings} className="lm-float-speak" ariaLabel={`Hear ${m.text}`} />}
                  onMove={(x, y) => setMorphCards((cards) => cards.map((cc) => (cc.id === c.id ? { ...cc, x, y } : cc)))}
                  onClose={() => setMorphCards((cards) => cards.filter((cc) => cc.id !== c.id))}
                >
                  <span className="lm-float-kind">{m.origin ? `${m.origin} ` : ''}{KIND_LABEL[m.kind].toLowerCase()}</span>
                  <p style={{ margin: '4px 0', fontWeight: 800 }}>Means: {m.meaning}</p>
                  {m.example && <p style={{ margin: '0 0 4px' }}>Example: <em>{m.example}</em></p>}
                  {m.note && <p style={{ margin: '0 0 4px', fontSize: '0.78rem', opacity: 0.75 }}>{m.note}</p>}
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>{kindExplanation(m)}</p>
                </FloatingCard>
              );
            })}
            {/* Symbol Sentences, placed as one unit, direct follow-up
                instructions: they drag/select/delete as a whole (not
                per-symbol), and a selected one also shows a settings
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
                <div key={item.instanceId} ref={setItemRef(item.instanceId)} style={{ position: 'absolute', left: item.x, top: item.y, zIndex: 2 }}>
                  <Draggable
                    label={sentence.sentence}
                    glowing={glowIds.has(item.instanceId)}
                    onPointerDown={startDragPlaced(item.instanceId)}
                    onPointerMove={onDragMove}
                    onPointerUp={onDragEnd}
                    style={multiSel.has(item.instanceId) ? { outline: '3px dashed var(--brand-blue)', outlineOffset: 3, borderRadius: 10, padding: 2 } : selected ? { boxShadow: '0 0 0 3px rgba(25,104,171,0.35)', borderRadius: 10, padding: 2 } : { padding: 2 }}
                  >
                    <div className="lm-sentence">
                      {sentenceTokens(sentence).map((t) => {
                        if (t.type === 'punct') {
                          const mark = item.punctFills?.[t.slot] ?? t.mark;
                          return <div key={`p${t.slot}`} className="lm-sentence-col punct"><PunctIcon mark={mark} onTap={() => setSymbolSentencePunct(item.instanceId, t.slot, nextPunct(mark))} /></div>;
                        }
                        const w = sentence.words[t.index];
                        const info = MONTESSORI_WORD_CLASS_INFO[w.wordClass];
                        return (
                          <div key={t.index} className="lm-sentence-col">
                            <img src={info.imageUrl} alt={info.name} draggable={false} />
                            <WordBubble value={fills[t.index] ?? w.word} placeholder={info.name.toLowerCase()} color={info.color} bubbleStyle={item.bubbleStyle ?? bubbleDefault}
                              label={`${info.name} word ${t.index + 1}`} onChange={(v) => setSymbolSentenceWordFill(item.instanceId, t.index, v)}
                              owner={item.instanceId} idx={t.index} />
                            {/* A random-word die for each word, shown once the card's settings are open. */}
                            {toolsOpenFor(item.instanceId) && (
                              <button type="button" className="lm-ctl lm-item-controls" onPointerDown={(e) => e.stopPropagation()} onClick={() => setSymbolSentenceWordFill(item.instanceId, t.index, randomWordInSentence(w.wordClass, t.index === 0 && startsSentence(placed, item)))} aria-label={`Random ${info.name.toLowerCase()}`} title={`Random ${info.name.toLowerCase()}`}><Icon name="dice" size={16} /></button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Draggable>
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
              />
            ))}
            {marquee && (
              <div className="lm-marquee" style={{ left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1), width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0) }} />
            )}
            {placed.length === 0 && (
              <p style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', margin: 0, fontWeight: 700, opacity: 0.35, textAlign: 'center', width: 320 }}>
                Drag anything from the left onto this board!
              </p>
            )}
          </div>
          {/* Transparent draw canvas, only captures pointer events while
              drawOn is true, the content layer takes them back instantly
              when Draw is toggled off. */}
          <canvas
            ref={drawCanvasRef}
            width={1400}
            height={900}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              pointerEvents: drawOn ? 'auto' : 'none',
              touchAction: 'none', cursor: drawOn ? (drawMode === 'eraser' ? 'cell' : 'crosshair') : 'default',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0',
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
