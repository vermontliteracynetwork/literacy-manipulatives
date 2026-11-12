import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icon';
import { PosSymbol, TapWord } from './parts';
import { PrintSheet, type PrintKind } from './PrintSheet';
import { partsOf, emptyRecipe, hintFor, listWords, loadLists, readLists, runRecipe, sortWords, TOPICS, UNITS, wordsOfList, writeLists, type Block, type Recipe, type SavedList, type SortBy, type ListWord } from '../../lib/word-explorer/lists';
import { PATTERNS, PATTERN_GROUPS, patternLabel, soundLabel, SOUNDS, spellingsOfSound } from '../../lib/word-explorer/phonics';
import { mainPos, PREFIXES, SUFFIXES } from '../../lib/word-explorer/morphology';
import { ROOTS } from '../../lib/word-explorer/roots';
import { getEntry } from '../../lib/word-explorer/data';
import { addMyWord } from '../../lib/writer/myWords';
import { newId } from '../../lib/procedures/types';
import { BAND_NAMES } from './parts';
import type { PartOfSpeech, SyllableType } from '../../lib/word-explorer/types';
import type { WxSettings } from '../../lib/word-explorer/settings';

// The Word List Maker (build spec 4.4 and section 6): filter blocks on the left, the live list on the right.

const SYLLABLES: SyllableType[] = ['closed', 'open', 'silent e', 'vowel team', 'r-controlled', 'consonant-le', 'diphthong'];
const POS: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'article'];
const LISTED = PATTERNS.filter((p) => !p.extra && !p.tagOnly);
const SHOW_LIMIT = 300;

function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return <button type="button" className={`wx-chip${on ? ' armed' : ''}`} aria-pressed={on} aria-label={label} onClick={onClick}>{on && <Icon name="check" size={18} />}{children}</button>;
}
const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function ModeControl({ kind, b, set }: { kind: 'spelling' | 'syllables' | 'parts' | 'pos'; b: Block; set: (b: Block) => void }) {
  return (
    <div className="wx-mode">
      <div className="wx-choice-row" role="radiogroup" aria-label="How this filter works">
        <button type="button" role="radio" aria-checked={b.mode === 'only'} className={`wx-btn wx-btn-small${b.mode === 'only' ? ' wx-btn-primary' : ''}`} onClick={() => set({ ...b, mode: 'only' })}>Only include</button>
        <button type="button" role="radio" aria-checked={b.mode === 'must'} className={`wx-btn wx-btn-small${b.mode === 'must' ? ' wx-btn-primary' : ''}`} onClick={() => set({ ...b, mode: 'must' })}>Must include, can include others</button>
      </div>
      {b.mode === 'must' && (
        <div className="wx-choice-row" role="radiogroup" aria-label="Any one or all">
          <button type="button" role="radio" aria-checked={b.match === 'any'} className={`wx-btn wx-btn-small${b.match === 'any' ? ' wx-btn-primary' : ''}`} onClick={() => set({ ...b, match: 'any' })}>Any one</button>
          <button type="button" role="radio" aria-checked={b.match === 'all'} className={`wx-btn wx-btn-small${b.match === 'all' ? ' wx-btn-primary' : ''}`} onClick={() => set({ ...b, match: 'all' })}>All</button>
        </div>
      )}
      <p className="wx-hint" role="status">{hintFor(kind, b)}</p>
    </div>
  );
}

// A teacher can lock any block for a student (spec section 6): the block keeps the teacher's picks and the student
// cannot change it.
interface LockCtl { teacher: boolean; locked: boolean; toggle: () => void }
function BlockCard({ n, title, children, picked, onClear, lock }: { n: number; title: string; children: React.ReactNode; picked: number; onClear: () => void; lock?: LockCtl }) {
  const [open, setOpen] = useState(n <= 2);
  const frozen = !!lock && lock.locked && !lock.teacher;
  return (
    <section className="wx-block">
      <div className="wx-block-head">
        <button type="button" className="wx-block-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span>{n}. {title}</span>{picked > 0 && <span className="wx-fact">{picked} picked</span>}
        </button>
        {lock?.locked && <span className="wx-status wx-status-reviewed">Locked</span>}
        {picked > 0 && !frozen && <button type="button" className="wx-btn wx-btn-small" onClick={onClear}>Clear</button>}
        {lock?.teacher && <button type="button" className={`wx-btn wx-btn-small${lock.locked ? ' wx-btn-primary' : ''}`} aria-pressed={lock.locked} onClick={lock.toggle}>{lock.locked ? 'Unlock' : 'Lock for students'}</button>}
      </div>
      {open && (frozen
        ? <fieldset disabled className="wx-block-body wx-frozen"><p className="wx-hint">Your teacher set this filter.</p>{children}</fieldset>
        : <div className="wx-block-body">{children}</div>)}
    </section>
  );
}

export function ListMaker({ initial, initialName, teacher, settings, onSettings }: { initial?: Recipe; initialName?: string; teacher: boolean; settings?: WxSettings; onSettings?: (s: WxSettings) => void }) {
  const [ready, setReady] = useState(listWords().length > 0);
  const [recipe, setRecipe] = useState<Recipe>(initial ?? emptyRecipe());
  const [name, setName] = useState(initialName ?? 'My word list');
  const [keepUpdating, setKeepUpdating] = useState(true);
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [sort, setSort] = useState<SortBy>('frequency');
  const [saved, setSaved] = useState<SavedList[]>(readLists);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [lockedWords, setLockedWords] = useState<string[] | null>(null);
  const [addText, setAddText] = useState('');
  const [letterQ, setLetterQ] = useState('');
  const [partQ, setPartQ] = useState('');
  const [message, setMessage] = useState('');
  const [print, setPrint] = useState<{ kind: PrintKind; large: boolean; contrast: boolean } | null>(null);
  const [printLarge, setPrintLarge] = useState(false);
  const [printContrast, setPrintContrast] = useState(false);
  const [seed, setSeed] = useState(recipe.related?.seed ?? '');
  const [seedSenses, setSeedSenses] = useState<{ id: string; label: string; syn: string[]; ant: string[] }[]>([]);

  useEffect(() => { loadLists().then(() => setReady(true)); }, []);
  const set = <K extends keyof Recipe>(k: K, v: Recipe[K]) => setRecipe((r) => ({ ...r, [k]: v }));
  const setBlock = (k: 'spelling' | 'syllables' | 'parts' | 'pos') => (b: Block) => set(k, b);

  const locked = settings?.lockedBlocks ?? {};
  const eff = useMemo<Recipe>(() => (teacher ? recipe : { ...recipe, ...(locked as Partial<Recipe>) }), [recipe, locked, teacher]);
  const lockFor = (key: keyof Recipe): LockCtl | undefined => (settings && onSettings ? {
    teacher, locked: key in locked,
    toggle: () => {
      const next = { ...locked };
      if (key in next) delete next[key]; else next[key] = recipe[key] ?? null;
      onSettings({ ...settings, lockedBlocks: next });
    },
  } : undefined);
  const results = useMemo(() => (ready ? runRecipe(eff) : []), [eff, ready]);
  const byWord = useMemo(() => new Map(listWords().map((w) => [w.word, w])), [ready]);
  const live = useMemo(() => {
    if (lockedWords) return lockedWords.map((w) => byWord.get(w)).filter((w): w is ListWord => !!w);
    const base = results.filter((w) => !removed.includes(w.word));
    const extra = added.filter((w) => !base.some((b) => b.word === w)).map((w) => byWord.get(w)).filter((w): w is ListWord => !!w);
    return sortWords([...base, ...extra], sort, recipe.spelling.sel[0]);
  }, [results, removed, added, sort, lockedWords, byWord, recipe.spelling.sel]);

  // Synonyms and antonyms block: the seed word's meanings.
  useEffect(() => {
    let live = true;
    if (!seed.trim()) { setSeedSenses([]); return; }
    getEntry(seed.trim().toLowerCase()).then((e) => {
      if (!live || !e) { setSeedSenses([]); return; }
      setSeedSenses(e.senses.filter((s) => teacher || s.definition.status === 'approved').map((s) => ({ id: s.id, label: `${s.signpost} (${s.pos})`, syn: s.synonyms.map((x) => x.wordId), ant: s.antonyms.map((x) => x.wordId) })));
    });
    return () => { live = false; };
  }, [seed, teacher]);
  const setRelated = (patch: Partial<NonNullable<Recipe['related']>>) => {
    const cur = recipe.related ?? { seed, senseId: seedSenses[0]?.id ?? '', synonyms: true, antonyms: false, words: [] };
    const next = { ...cur, seed, ...patch };
    const s = seedSenses.find((x) => x.id === next.senseId) ?? seedSenses[0];
    next.senseId = s?.id ?? '';
    next.words = s ? [...(next.synonyms ? s.syn : []), ...(next.antonyms ? s.ant : [])] : [];
    set('related', next);
  };

  const lq = letterQ.trim().toLowerCase().replace('_', '');
  // Letters typed exactly come first ("ai" before "air").
  const letterHits = lq ? LISTED.filter((p) => p.letters.replace('_', '').includes(lq)).sort((x, y) => Number(y.letters.replace('_', '') === lq) - Number(x.letters.replace('_', '') === lq) || x.letters.length - y.letters.length) : [];
  const soundKeys = Object.keys(SOUNDS).filter((k) => k && spellingsOfSound(k).length > 1);
  const allParts = [...PREFIXES.map((p) => `prefix:${p.text}`), ...[...new Set(SUFFIXES.map((s) => s.text))].map((s) => `suffix:${s}`), ...ROOTS.map((r) => `root:${r.text}`)];
  const partHits = allParts.filter((p) => !partQ.trim() || p.split(':')[1].startsWith(partQ.trim().toLowerCase()));

  const save = () => {
    const words = live.map((w) => w.word);
    const entry: SavedList = { id: currentId ?? newId(), name: name.trim() || 'Word list', recipe: eff, keepUpdating, words, added, removed, sort, updatedAt: new Date().toISOString() };
    const next = [entry, ...saved.filter((l) => l.id !== entry.id)];
    writeLists(next); setSaved(next); setCurrentId(entry.id);
    setMessage('Saved'); window.setTimeout(() => setMessage(''), 2000);
  };
  const openList = (l: SavedList) => {
    setRecipe(l.recipe); setName(l.name); setKeepUpdating(l.keepUpdating); setAdded(l.added); setRemoved(l.removed); setSort(l.sort); setCurrentId(l.id);
    setLockedWords(l.keepUpdating ? null : l.words);
    setSeed(l.recipe.related?.seed ?? '');
  };
  const lock = (on: boolean) => { setKeepUpdating(!on); setLockedWords(on ? live.map((w) => w.word) : null); };
  const assign = async () => {
    const data = btoa(unescape(encodeURIComponent(JSON.stringify({ n: name, w: live.map((w) => w.word) }))));
    const url = `${window.location.origin}/words?view=list&l=${encodeURIComponent(data)}`;
    try { await navigator.clipboard.writeText(url); setMessage('Link copied. Send it to students or post it in the unit.'); } catch { window.prompt('Copy this link for students:', url); }
  };

  const spellingPicked = eff.spelling.sel;
  return (
    <div className="wx-listmaker">
      <div className="wx-lm-filters">
        <h1 className="wx-h1">Word List Maker</h1>
        {saved.length > 0 && (
          <details className="wx-mylists">
            <summary className="wx-btn">My lists ({saved.length})</summary>
            <ul>{saved.map((l) => (
              <li key={l.id}>
                <button type="button" className="wx-btn wx-btn-small" onClick={() => openList(l)}>{l.name}</button>
                <span className="wx-muted">{wordsOfList(l).length} words · {l.keepUpdating ? 'keeps updating' : 'locked'}</span>
                <button type="button" className="wx-btn wx-btn-small" onClick={() => { const next = saved.filter((x) => x.id !== l.id); writeLists(next); setSaved(next); if (currentId === l.id) setCurrentId(null); }}>Delete</button>
              </li>
            ))}</ul>
          </details>
        )}
        {lockedWords && <p className="wx-note">This list is locked: its words stay the same. Choose "Keep updating" to use the filters again.</p>}

        <BlockCard n={1} lock={lockFor('spelling')} title="Spelling patterns and sounds" picked={spellingPicked.length} onClear={() => setBlock('spelling')({ ...eff.spelling, sel: [] })}>
          <ModeControl kind="spelling" b={eff.spelling} set={setBlock('spelling')} />
          <label className="wx-swap-label" htmlFor="lm-letters">Find letters (like ai)</label>
          <input id="lm-letters" className="wx-input" value={letterQ} onChange={(e) => setLetterQ(e.target.value)} placeholder="Type letters" autoComplete="off" />
          {letterHits.length > 0 && <div className="wx-chips">{letterHits.map((p) => <Chip key={p.id} on={spellingPicked.includes(p.id)} onClick={() => setBlock('spelling')({ ...eff.spelling, sel: toggleIn(spellingPicked, p.id) })}>{patternLabel(p)}</Chip>)}</div>}
          <p className="wx-small-head">All spellings of a sound</p>
          <div className="wx-chips">
            {soundKeys.map((k) => {
              const ids = spellingsOfSound(k).map((p) => p.id);
              const on = ids.every((id) => spellingPicked.includes(id));
              return <Chip key={k} on={on} label={`All spellings of ${soundLabel(k)}`} onClick={() => setBlock('spelling')({ ...eff.spelling, sel: on ? spellingPicked.filter((x) => !ids.includes(x)) : [...new Set([...spellingPicked, ...ids])] })}>{soundLabel(k)}</Chip>;
            })}
          </div>
          {PATTERN_GROUPS.filter((g) => LISTED.some((p) => p.group === g)).map((g) => (
            <details key={g} className="wx-group">
              <summary>{g}</summary>
              <div className="wx-chips">{LISTED.filter((p) => p.group === g).map((p) => <Chip key={p.id} on={spellingPicked.includes(p.id)} onClick={() => setBlock('spelling')({ ...eff.spelling, sel: toggleIn(spellingPicked, p.id) })}>{patternLabel(p)}</Chip>)}</div>
            </details>
          ))}
        </BlockCard>

        <BlockCard n={2} lock={lockFor('syllables')} title="Syllable types" picked={eff.syllables.sel.length} onClear={() => setBlock('syllables')({ ...eff.syllables, sel: [] })}>
          <ModeControl kind="syllables" b={eff.syllables} set={setBlock('syllables')} />
          <div className="wx-chips">{SYLLABLES.map((s) => <Chip key={s} on={eff.syllables.sel.includes(s)} onClick={() => setBlock('syllables')({ ...eff.syllables, sel: toggleIn(eff.syllables.sel, s) })}>{s}</Chip>)}</div>
        </BlockCard>

        <BlockCard n={3} lock={lockFor('parts')} title="Prefixes, suffixes and roots" picked={eff.parts.sel.length} onClear={() => setBlock('parts')({ ...eff.parts, sel: [] })}>
          <ModeControl kind="parts" b={eff.parts} set={setBlock('parts')} />
          <input className="wx-input" value={partQ} onChange={(e) => setPartQ(e.target.value)} placeholder="Find a word part" aria-label="Find a word part" autoComplete="off" />
          <div className="wx-chips wx-chips-scroll">{partHits.map((p) => <Chip key={p} on={eff.parts.sel.includes(p)} onClick={() => setBlock('parts')({ ...eff.parts, sel: toggleIn(eff.parts.sel, p) })}>{p.replace(':', ': ')}</Chip>)}</div>
        </BlockCard>

        <BlockCard n={4} lock={lockFor('pos')} title="Part of speech" picked={eff.pos.sel.length} onClear={() => setBlock('pos')({ ...eff.pos, sel: [] })}>
          <ModeControl kind="pos" b={eff.pos} set={setBlock('pos')} />
          <div className="wx-chips">{POS.map((p) => <Chip key={p} on={eff.pos.sel.includes(p)} onClick={() => setBlock('pos')({ ...eff.pos, sel: toggleIn(eff.pos.sel, p) })}><PosSymbol pos={p} size={20} decorative />{p}</Chip>)}</div>
        </BlockCard>

        <BlockCard n={5} lock={lockFor('tier')} title="Tier" picked={eff.tier.length} onClear={() => set('tier', [])}>
          <div className="wx-chips">{['1', '2', '3'].map((t) => <Chip key={t} on={eff.tier.includes(t)} onClick={() => set('tier', toggleIn(eff.tier, t))}>Tier {t}</Chip>)}</div>
        </BlockCard>
        <BlockCard n={6} lock={lockFor('band')} title="Frequency" picked={eff.band.length} onClear={() => set('band', [])}>
          <div className="wx-chips">{['1', '2', '3', '4', '5'].map((b) => <Chip key={b} on={eff.band.includes(b)} onClick={() => set('band', toggleIn(eff.band, b))}>{BAND_NAMES[Number(b)]}</Chip>)}</div>
        </BlockCard>
        <BlockCard n={7} lock={lockFor('topic')} title="Topic, unit or formula" picked={eff.topic.length} onClear={() => set('topic', [])}>
          <div className="wx-chips">{TOPICS.map((t) => <Chip key={t} on={eff.topic.includes(t)} onClick={() => set('topic', toggleIn(eff.topic, t))}>{t}</Chip>)}</div>
          <p className="wx-small-head">Words in her formula units' model sentences</p>
          <div className="wx-chips">{UNITS.map((u) => <Chip key={u} on={eff.topic.includes(`unit:${u}`)} onClick={() => set('topic', toggleIn(eff.topic, `unit:${u}`))}>Unit {u}</Chip>)}</div>
        </BlockCard>
        <BlockCard n={8} lock={lockFor('picture')} title="Has a picture" picked={eff.picture ? 1 : 0} onClear={() => set('picture', false)}>
          <Chip on={eff.picture} onClick={() => set('picture', !eff.picture)}>Only words with a picture</Chip>
        </BlockCard>
        <BlockCard n={9} lock={lockFor('related')} title="Synonyms and antonyms" picked={recipe.related && (recipe.related.synonyms || recipe.related.antonyms) ? 1 : 0} onClear={() => { set('related', undefined); setSeed(''); }}>
          <p className="wx-hint">Pick a word and one of its meanings. The other filters' modes do not change this one.</p>
          <input className="wx-input" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Seed word, like happy" aria-label="Seed word" autoComplete="off" />
          {seedSenses.length > 0 && (
            <>
              <label className="wx-select-label">Meaning
                <select className="wx-input" value={recipe.related?.senseId ?? seedSenses[0].id} onChange={(e) => setRelated({ senseId: e.target.value })}>
                  {seedSenses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
              <div className="wx-chips">
                <Chip on={!!recipe.related?.synonyms} onClick={() => setRelated({ synonyms: !recipe.related?.synonyms })}>Synonyms</Chip>
                <Chip on={!!recipe.related?.antonyms} onClick={() => setRelated({ antonyms: !recipe.related?.antonyms })}>Antonyms</Chip>
              </div>
            </>
          )}
          {seed.trim() && !seedSenses.length && <p className="wx-muted">No meanings to pick for that word yet.</p>}
        </BlockCard>
      </div>

      <aside className="wx-lm-list" aria-label="The list">
        <label className="wx-swap-label" htmlFor="lm-name">List name</label>
        <input id="lm-name" className="wx-input" value={name} onChange={(e) => setName(e.target.value)} />
        <p className="wx-lm-count" role="status">{ready ? `${live.length} ${live.length === 1 ? 'word' : 'words'}` : 'Loading words...'}</p>
        <div className="wx-choice-row" role="radiogroup" aria-label="Keep updating or lock">
          <button type="button" role="radio" aria-checked={keepUpdating} className={`wx-btn wx-btn-small${keepUpdating ? ' wx-btn-primary' : ''}`} onClick={() => lock(false)}>Keep updating</button>
          <button type="button" role="radio" aria-checked={!keepUpdating} className={`wx-btn wx-btn-small${!keepUpdating ? ' wx-btn-primary' : ''}`} onClick={() => lock(true)}>Lock this list</button>
        </div>
        <label className="wx-select-label">Sort
          <select className="wx-input" value={sort} onChange={(e) => setSort(e.target.value as SortBy)}>
            <option value="frequency">Most common first</option><option value="az">A to Z</option><option value="pattern">By pattern</option>
          </select>
        </label>
        <form className="wx-hero-row" onSubmit={(e) => {
          e.preventDefault();
          const w = addText.trim().toLowerCase();
          if (!w || !byWord.has(w)) { setMessage(w ? `${w} is not in Word Explorer.` : ''); return; }
          setAdded((a) => [...new Set([...a, w])]); setRemoved((r) => r.filter((x) => x !== w));
          if (lockedWords) setLockedWords((l) => [...new Set([...(l ?? []), w])]);
          setAddText('');
        }}>
          <input className="wx-input" value={addText} onChange={(e) => setAddText(e.target.value)} placeholder="Add a word" aria-label="Add a word" autoComplete="off" />
          <button type="submit" className="wx-btn">Add</button>
        </form>
        <ul className="wx-lm-words">
          {live.slice(0, SHOW_LIMIT).map((w) => (
            <li key={w.word}>
              <TapWord word={w.word} />
              <button type="button" className="wx-btn wx-btn-small" aria-label={`Remove ${w.word}`} onClick={() => { setRemoved((r) => [...r, w.word]); setAdded((a) => a.filter((x) => x !== w.word)); if (lockedWords) setLockedWords((l) => (l ?? []).filter((x) => x !== w.word)); }}><Icon name="close" size={18} /></button>
            </li>
          ))}
        </ul>
        {live.length > SHOW_LIMIT && <p className="wx-muted">Showing the first {SHOW_LIMIT}. Add more filters to make the list shorter.</p>}
        <div className="wx-lm-actions">
          <button type="button" className="wx-btn wx-btn-primary" onClick={save}>Save</button>
          <button type="button" className="wx-btn" onClick={() => { live.forEach((w) => addMyWord(w.word, partsOf(w)[0] ?? 'noun')); setMessage(`${live.length} words added to My Words.`); }} disabled={!live.length}>Add to My Words</button>
          {teacher && <button type="button" className="wx-btn" onClick={() => void assign()} disabled={!live.length}>Assign (copy a link)</button>}
        </div>
        <fieldset className="wx-choice">
          <legend>Print</legend>
          <div className="wx-chips">
            <Chip on={printLarge} onClick={() => setPrintLarge((v) => !v)}>Large print</Chip>
            <Chip on={printContrast} onClick={() => setPrintContrast((v) => !v)}>High contrast</Chip>
          </div>
          <div className="wx-choice-row">
            {([['wall', 'Word wall cards'], ['flash', 'Flash cards'], ['frayer', 'Frayer cards'], ['sort', 'Two-column sort'], ['spelling', 'Spelling list']] as [PrintKind, string][]).map(([k, label]) => (
              <button key={k} type="button" className="wx-btn wx-btn-small" disabled={!live.length} onClick={() => setPrint({ kind: k, large: printLarge, contrast: printContrast })}>{label}</button>
            ))}
          </div>
        </fieldset>
        {message && <p className="wx-note" role="status">{message}</p>}
        <details className="wx-recipe">
          <summary>Recipe (the filters this list saves)</summary>
          <pre>{JSON.stringify(eff, (k, v) => (k === 'words' ? undefined : v), 1)}</pre>
        </details>
      </aside>
      {print && <PrintSheet kind={print.kind} large={print.large} contrast={print.contrast} title={name} words={live.map((w) => w.word)} groups={recipe.spelling.sel.slice(0, 2)} onDone={() => setPrint(null)} />}
    </div>
  );
}

// A list shared with "Assign": the words, read aloud, saved to My Words, printed.
export function SharedList({ data }: { data: string }) {
  let parsed: { n: string; w: string[] } | null = null;
  try { parsed = JSON.parse(decodeURIComponent(escape(atob(data)))); } catch { parsed = null; }
  const [print, setPrint] = useState<PrintKind | null>(null);
  if (!parsed) return <p className="wx-empty">This list link does not work. Ask your teacher for a new one.</p>;
  return (
    <section className="wx-card">
      <h1 className="wx-h1">{parsed.n}</h1>
      <p className="wx-muted">{parsed.w.length} words. Tap a word to hear it, tap twice to open it.</p>
      <div className="wx-chips">{parsed.w.map((w) => <TapWord key={w} word={w} />)}</div>
      <div className="wx-lm-actions">
        <button type="button" className="wx-btn" onClick={() => parsed!.w.forEach((w) => addMyWord(w, mainPos(w) ?? 'noun'))}>Add all to My Words</button>
        <button type="button" className="wx-btn" onClick={() => setPrint('flash')}>Print flash cards</button>
      </div>
      {print && <PrintSheet kind={print} large={false} contrast={false} title={parsed.n} words={parsed.w} groups={[]} onDone={() => setPrint(null)} />}
    </section>
  );
}
