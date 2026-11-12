import '@fontsource-variable/inclusive-sans/wght.css';
import '@fontsource-variable/inclusive-sans/wght-italic.css';
import './wordExplorer.css';
import '../../lib/fontChoice';
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '../Icon';
import { MainMenu } from '../MainMenu';
import { ListContext, ReaderProvider, SpeakButton, Spoken, TapProvider, TapWord, useReader } from './parts';
import { WordPage } from './WordPage';
import { SettingsDialog } from './SettingsDialog';
import { WordOfDayCard } from './WordOfDay';
import { Browse, type BrowseMode } from './Browse';
import { SourcesPage } from './SourcesPage';
import { startList } from '../../lib/word-explorer/lists';
import { HomeButton } from '../HomeButton';
import { loadIndex, onIndex, indexReady } from '../../lib/word-explorer/data';
import { autocomplete, search, type SearchResult } from '../../lib/word-explorer/search';
import { SEED_ENTRIES } from '../../lib/word-explorer/seed';
import { pushRecent, readRecent, readSettings, saveSettings, type WxSettings } from '../../lib/word-explorer/settings';
import { loadWordTypes } from '../../lib/wordTypes';
import { myWords, subscribeMyWords } from '../../lib/writer/myWords';

// Word Explorer: the dictionary and thesaurus app (build spec, Phase 1). One view: the header, the word trail and
// the center panel, which changes in place. Engines live in src/lib/word-explorer (UI-free).

type Page = { kind: 'home' } | { kind: 'word'; word: string; note?: string; tab?: string } | { kind: 'results'; query: string }
  | { kind: 'browse'; mode?: BrowseMode } | { kind: 'sources' };

function pageFromUrl(): Page {
  const p = new URLSearchParams(window.location.search);
  const w = p.get('w');
  if (w) return { kind: 'word', word: w.toLowerCase(), tab: p.get('tab') ?? undefined };
  const q = p.get('q');
  if (q) return { kind: 'results', query: q };
  const view = p.get('view');
  if (view === 'browse') return { kind: 'browse' };
  if (view === 'sources') return { kind: 'sources' };
  // The Word List Maker is its own tool now (/lists); old links still work.
  if (view === 'lists' || view === 'list') { window.location.replace(`/lists${p.get('l') ? `?l=${encodeURIComponent(p.get('l')!)}` : ''}`); }
  return { kind: 'home' };
}
function urlFor(page: Page) {
  if (page.kind === 'word') return `/words?w=${encodeURIComponent(page.word)}${page.tab ? `&tab=${page.tab}` : ''}`;
  if (page.kind === 'results') return `/words?q=${encodeURIComponent(page.query)}`;
  if (page.kind === 'browse') return '/words?view=browse';
  if (page.kind === 'sources') return '/words?view=sources';
  return '/words';
}

const SIZE = { medium: '100%', large: '112.5%', xl: '125%' } as const;

export function WordExplorer() {
  const [settings, setSettings] = useState<WxSettings>(readSettings);
  const [page, setPage] = useState<Page>(pageFromUrl);
  const [trail, setTrail] = useState<string[]>(() => { const p = pageFromUrl(); return p.kind === 'word' ? [p.word] : []; });
  const [showSettings, setShowSettings] = useState(false);
  const [, setReady] = useState(indexReady());
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => { loadIndex(); loadWordTypes(); return onIndex(() => setReady(true)); }, []);
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.fontSize;
    html.style.fontSize = SIZE[settings.textSize];
    document.title = 'Word Explorer';
    return () => { html.style.fontSize = before; };
  }, [settings.textSize]);
  useEffect(() => {
    const pop = () => setPage(pageFromUrl());
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);

  const go = useCallback((next: Page, push = true) => {
    setPage(next);
    if (push) window.history.pushState(null, '', urlFor(next));
    if (next.kind === 'word') {
      pushRecent(next.word);
      setTrail((t) => (t[t.length - 1] === next.word ? t : [...t, next.word].slice(-12)));
    }
    if (next.kind === 'home') setTrail([]);
    window.requestAnimationFrame(() => { mainRef.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); });
  }, []);
  const openWord = useCallback((word: string, tab?: string) => go({ kind: 'word', word, tab }), [go]);

  const runSearch = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    await loadIndex();
    const r = search(q);
    if (r.exact) return go({ kind: 'word', word: r.exact });
    if (r.bases.length && !r.contraction) return go({ kind: 'word', word: r.bases[0], note: `"${r.query}" is a form of "${r.bases[0]}".` });
    go({ kind: 'results', query: q });
  }, [go]);

  const update = (s: WxSettings) => { setSettings(s); saveSettings(s); };

  return (
    <ReaderProvider rate={settings.speed}>
      <TapProvider open={openWord}>
      <ListContext.Provider value={{ makeList: (recipe, name) => startList(recipe, name) }}>
        <SayButtons on={settings.sayButtons}>
          <div className="wx" data-theme={settings.theme} data-size={settings.textSize} data-spacing={settings.spacing} data-lines={settings.lineSpacing} data-font={settings.font} data-buttons={settings.buttonSize} data-calm={settings.calm ? 'on' : 'off'} data-motion={settings.reduceMotion ? 'reduce' : 'full'}>
            <a className="wx-skip" href="#wx-main">Skip to the word</a>
            <Header onHome={() => go({ kind: 'home' })} onSearch={runSearch} onSettings={() => setShowSettings(true)} onBrowse={() => go({ kind: 'browse' })} />
            <Trail trail={trail} current={page.kind === 'word' ? page.word : null}
              onHome={() => go({ kind: 'home' })}
              onPick={(w, i) => { setTrail((t) => t.slice(0, i + 1)); setPage({ kind: 'word', word: w }); window.history.pushState(null, '', urlFor({ kind: 'word', word: w })); }} />
            <main id="wx-main" ref={mainRef} tabIndex={-1} className="wx-main">
              {page.kind === 'home' && <Home onSearch={runSearch} settings={settings} onOpen={openWord} onBrowse={(m) => go({ kind: 'browse', mode: m })} onLists={() => window.location.assign('/lists')} />}
              {page.kind === 'word' && <WordPage key={`${page.word}-${page.tab ?? ''}`} word={page.word} note={page.note} initialTab={page.tab} teacher={settings.teacherView} preset={settings.preset} />}
              {page.kind === 'results' && <Results result={search(page.query)} />}
              {page.kind === 'browse' && <Browse key={page.mode ?? 'az'} initialMode={page.mode} view={settings.browseView} onView={(v) => update({ ...settings, browseView: v })} />}
              {page.kind === 'sources' && <SourcesPage teacher={settings.teacherView} />}
            </main>
            {showSettings && <SettingsDialog settings={settings} onChange={update} onClose={() => setShowSettings(false)} />}
            <MainMenu />
          </div>
        </SayButtons>
      </ListContext.Provider>
      </TapProvider>
    </ReaderProvider>
  );
}

// "Say button names when I tap them": every button and link reads its name aloud (spec section 9). Buttons that
// already speak (read aloud, tappable words) opt out with data-nosay.
function SayButtons({ on, children }: { on: boolean; children: React.ReactNode }) {
  const { read } = useReader();
  return (
    <div onClickCapture={(e) => {
      if (!on) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>('button, a');
      if (!el || el.closest('[data-nosay]')) return;
      const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
      if (name) read('button', name);
    }}>{children}</div>
  );
}

// ---------- header ----------
type Recognizer = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const Recognition = typeof window === 'undefined' ? undefined
  : ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Recognizer) | undefined;

function Header({ onHome, onSearch, onSettings, onBrowse }: { onHome: () => void; onSearch: (q: string) => void; onSettings: () => void; onBrowse: () => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState('');
  const listId = useId();
  const ready = useSyncExternalStore(onIndex, indexReady);
  const options = useMemo(() => (ready && q.trim() ? autocomplete(q) : []), [q, ready]);
  const shown = open && options.length > 0;
  const pick = (w: string) => { setQ(w); setOpen(false); setActive(-1); onSearch(w); };

  const listen = () => {
    if (!Recognition) { setVoiceMsg('Saying a word to search does not work on this device. Try typing it.'); return; }
    const r = new Recognition();
    r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => { const t = e.results[0]?.[0]?.transcript?.trim() ?? ''; if (t) { const w = t.split(/\s+/).slice(-1)[0].replace(/[.!?,]$/, ''); setQ(w); onSearch(w); } };
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); setVoiceMsg('I did not hear a word. Try again.'); };
    setVoiceMsg('Listening. Say one word.');
    setListening(true);
    r.start();
  };

  return (
    <header className="wx-header">
      <HomeButton className="wx-btn" />
      <button type="button" className="wx-appname" onClick={onHome}><Icon name="book" size={28} /><span>Word Explorer</span></button>
      <form className="wx-search" role="search" onSubmit={(e) => { e.preventDefault(); setOpen(false); if (active >= 0 && options[active]) pick(options[active]); else onSearch(q); }}>
        <label htmlFor="wx-q" className="wx-sr">Search for a word</label>
        <div className="wx-combo">
          <input id="wx-q" className="wx-input" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false}
            placeholder="Type a word" value={q} role="combobox" aria-expanded={shown} aria-controls={listId} aria-autocomplete="list"
            aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(options.length - 1, a + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
              if (e.key === 'Escape') { setOpen(false); setActive(-1); }
            }} />
          {shown && (
            <ul id={listId} role="listbox" className="wx-options" aria-label="Words that start that way">
              {options.map((w, i) => (
                <li key={w} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'on' : ''}
                  onPointerDown={(e) => e.preventDefault()} onClick={() => pick(w)}>{w}</li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" className="wx-btn wx-btn-primary"><Icon name="search" size={22} /><span>Search</span></button>
        <button type="button" className={`wx-btn wx-btn-secondary${listening ? ' on' : ''}`} aria-pressed={listening} onClick={listen}>
          <Icon name="mic" size={22} /><span>Search by sound</span>
        </button>
      </form>
      <button type="button" className="wx-btn" onClick={onBrowse}><Icon name="book" size={22} /><span>Browse</span></button>
      <a className="wx-btn" href="/lists"><Icon name="menu" size={22} /><span>Word Lists</span></a>
      <button type="button" className="wx-btn" onClick={onSettings}><Icon name="gear" size={22} /><span>Settings</span></button>
      {voiceMsg && <p className="wx-voice-msg" role="status">{voiceMsg}</p>}
    </header>
  );
}

function Trail({ trail, current, onHome, onPick }: { trail: string[]; current: string | null; onHome: () => void; onPick: (w: string, i: number) => void }) {
  return (
    <nav className="wx-trail" aria-label="Word trail">
      <span className="wx-trail-label">Word trail:</span>
      <ol>
        <li><button type="button" className="wx-chip" onClick={onHome}><Icon name="book" size={20} /><span>Start</span></button></li>
        {trail.map((w, i) => (
          <li key={`${w}-${i}`}>
            <span className="wx-trail-sep" aria-hidden="true">&gt;</span>
            <button type="button" className="wx-chip" aria-current={w === current && i === trail.length - 1 ? 'page' : undefined} onClick={() => onPick(w, i)}>{w}</button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ---------- home ----------
const INTRO = 'Look up a word. Hear it, see what it means, and find words like it. Tap a word once to hear it. Tap it again to open it.';
function Home({ onSearch, settings, onOpen, onBrowse, onLists }: { onSearch: (q: string) => void; settings: WxSettings; onOpen: (w: string) => void; onBrowse: (m: BrowseMode) => void; onLists: () => void }) {
  const recent = useMemo(readRecent, []);
  const mine = useSyncExternalStore(subscribeMyWords, myWords);
  return (
    <div className="wx-home">
      <section className="wx-card wx-hero">
        <h1 className="wx-h1">Word Explorer</h1>
        <p className="wx-lead"><Spoken id="intro" text={INTRO} /> <SpeakButton id="intro" text={INTRO} label="Read these directions" /></p>
        <form className="wx-hero-search" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get('w'); onSearch(String(v ?? '')); }}>
          <label htmlFor="wx-home-q" className="wx-h2">What word do you want to explore?</label>
          <div className="wx-hero-row">
            <input id="wx-home-q" name="w" className="wx-input wx-input-lg" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Type a word" />
            <button type="submit" className="wx-btn wx-btn-primary"><Icon name="search" size={22} /><span>Find it</span></button>
          </div>
        </form>
      </section>
      <WordOfDayCard settings={settings} onOpen={onOpen} />
      <section className="wx-card">
        <h2 className="wx-h2">Find a word</h2>
        <div className="wx-topic-tiles">
          <button type="button" className="wx-btn" onClick={() => onBrowse('az')}>A to Z</button>
          <button type="button" className="wx-btn" onClick={() => onBrowse('pictures')}><Icon name="image" size={22} /><span>By picture</span></button>
          <button type="button" className="wx-btn" onClick={() => onBrowse('sounds')}><Icon name="speaker" size={22} /><span>By sound</span></button>
          <button type="button" className="wx-btn" onClick={onLists}><Icon name="menu" size={22} /><span>Make a word list</span></button>
        </div>
      </section>
      <section className="wx-card">
        <h2 className="wx-h2">Words to try</h2>
        <div className="wx-chips">{Object.keys(SEED_ENTRIES).map((w) => <TapWord key={w} word={w} />)}</div>
      </section>
      {recent.length > 0 && (
        <section className="wx-card">
          <h2 className="wx-h2">Recent</h2>
          <div className="wx-chips">{recent.map((w) => <TapWord key={w} word={w} />)}</div>
        </section>
      )}
      <section className="wx-card">
        <h2 className="wx-h2">My Words</h2>
        {mine.length ? <div className="wx-chips">{mine.map((w) => <TapWord key={w.word} word={w.word} />)}</div>
          : <p className="wx-muted">Words you save show up here. Open a word and tap "Save to My Words".</p>}
      </section>
    </div>
  );
}

// ---------- search results (no exact match) ----------
function Results({ result }: { result: SearchResult }) {
  const { query, contraction, soundsLike, spelledLike, bases, blocked } = result;
  const none = !contraction && !soundsLike.length && !spelledLike.length && !bases.length;
  const lead = blocked ? 'That word is not in Word Explorer. Try a different word.'
    : contraction ? `"${query}" is two words put together.`
    : none ? `Word Explorer could not find "${query}". Try spelling it a different way, or tap Search by sound and say it.`
    : `Word Explorer could not find "${query}". Did you mean one of these?`;
  return (
    <div className="wx-results">
      <section className="wx-card">
        <h1 className="wx-h1">Search: {query}</h1>
        <p className="wx-lead"><Spoken id="results" text={lead} /> <SpeakButton id="results" text={lead} label="Read this message" /></p>
        {contraction && (
          <div className="wx-contraction">
            <span className="wx-contraction-word">{query}</span><span aria-hidden="true">=</span>
            {contraction.map((w, i) => <span key={w} className="wx-contraction-part">{i > 0 && <span aria-hidden="true">+</span>}<TapWord word={w} /></span>)}
          </div>
        )}
      </section>
      {!blocked && bases.length > 0 && (
        <section className="wx-card"><h2 className="wx-h2">It comes from</h2><div className="wx-chips">{bases.map((w) => <TapWord key={w} word={w} />)}</div></section>
      )}
      {!blocked && soundsLike.length > 0 && (
        <section className="wx-card"><h2 className="wx-h2">Words that sound like it</h2><div className="wx-chips">{soundsLike.map((w) => <TapWord key={w} word={w} bold />)}</div></section>
      )}
      {!blocked && spelledLike.length > 0 && (
        <section className="wx-card"><h2 className="wx-h2">Words spelled almost the same</h2><div className="wx-chips">{spelledLike.map((w) => <TapWord key={w} word={w} />)}</div></section>
      )}
    </div>
  );
}
