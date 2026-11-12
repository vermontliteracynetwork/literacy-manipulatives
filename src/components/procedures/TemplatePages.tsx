import { useEffect, useRef, useState } from 'react';
import { GRAMMAR_SYMBOL_INFO, type SymbolWordClass } from '../../lib/grammarSymbols';
import { SENTENCE_FORMULAS } from '../../lib/writer/formulas';
import { FormulaSymbols } from '../SentenceFormulas';
import type { ActivityData, AssessmentData, Block, FormulaData, GoalData, PageKind, PageData, ReviewData } from '../../lib/procedures/types';

// The set templates of a Daily Procedure page: what shows in the middle (big and plain, since in Learn mode this is
// what students see on a shared screen), and the form on the right that edits it in Edit mode.

const lines = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);
const join = (l: string[]) => l.join('\n');

// ---------- the page as students see it ----------
export function TemplateView({ kind, data, learn, pageTitle = '' }: { kind: PageKind; data: PageData; learn: boolean; pageTitle?: string }) {
  if (kind === 'goal') return <GoalView d={data as GoalData} />;
  if (kind === 'review-symbols') return <ReviewView d={data as ReviewData} learn={learn} />;
  if (kind === 'formula') return <FormulaView d={data as FormulaData} learn={learn} pageTitle={pageTitle} />;
  if (kind === 'activity') return <ActivityView d={data as ActivityData} learn={learn} />;
  if (kind === 'assessment') return <AssessmentView d={data as AssessmentData} learn={learn} />;
  return null;
}

function GoalView({ d }: { d: GoalData }) {
  return (
    <div className="dp-goal">
      <ol className="dp-agenda" aria-label="Today's agenda">{d.agenda.map((a, i) => <li key={i}><span className="dp-agenda-n">{i + 1}</span>{a}</li>)}</ol>
      <p className="dp-goal-label">Today's goal</p>
      <p className="dp-goal-text">{d.goal}</p>
      {d.closing && <p className="dp-goal-closing">{d.closing}</p>}
    </div>
  );
}

function Timer({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => { setLeft(seconds); setRunning(false); }, [seconds]);
  useEffect(() => {
    if (!running) return;
    t.current = window.setInterval(() => setLeft((l) => { if (l <= 1) { setRunning(false); return 0; } return l - 1; }), 1000);
    return () => window.clearInterval(t.current);
  }, [running]);
  return (
    <div className="dp-timer" role="timer" aria-live="off">
      <span className={`dp-timer-time${left === 0 ? ' done' : ''}`}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
      <button type="button" className="btn btn-sm btn-primary" onClick={() => { if (left === 0) setLeft(seconds); setRunning((r) => !r); }}>{running ? 'Pause' : left === 0 ? 'Again' : 'Start'}</button>
      <button type="button" className="btn btn-sm" onClick={() => { setRunning(false); setLeft(seconds); }}>Reset</button>
    </div>
  );
}

function ReviewView({ d, learn }: { d: ReviewData; learn: boolean }) {
  const [shown, setShown] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setShown((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <div className="dp-review">
      <ul className="dp-directions">{d.directions.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <div className="dp-symbols">
        {d.symbols.map((s, i) => {
          const info = GRAMMAR_SYMBOL_INFO[s.cls];
          const open = !learn || shown.has(i);
          return (
            <div key={i} className="dp-symbol">
              <img src={info.imageUrl} alt="" />
              <span className="dp-symbol-name">{info.name}</span>
              {s.motion && <span className="dp-symbol-motion">Motion: {s.motion}</span>}
              {open ? <ul className="dp-words">{s.words.map((w) => <li key={w}>{w}</li>)}</ul> : null}
              {learn && <button type="button" className="btn btn-sm" onClick={() => toggle(i)}>{open ? 'Hide words' : 'Show words'}</button>}
            </div>
          );
        })}
      </div>
      {d.timerSeconds > 0 && <><p className="dp-small-head">Speed sort</p><Timer seconds={d.timerSeconds} /></>}
    </div>
  );
}

function Reveal({ block, learn }: { block: Block; learn: boolean }) {
  const [open, setOpen] = useState(!learn);
  useEffect(() => setOpen(!learn), [learn]);
  return (
    <section className={`dp-block${open ? ' open' : ''}`}>
      <button type="button" className="dp-block-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{block.label}</span><span className="dp-block-toggle">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <ul className="dp-block-lines">{block.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </section>
  );
}

function FormulaView({ d, learn, pageTitle }: { d: FormulaData; learn: boolean; pageTitle: string }) {
  const cards = d.codes.map((c) => SENTENCE_FORMULAS.find((f) => f.code === c)).filter((f): f is NonNullable<typeof f> => !!f);
  return (
    <div className="dp-formula">
      {`${d.lesson} ${d.name}`.trim() !== pageTitle.trim() && <p className="dp-formula-title"><span className="dp-formula-lesson">{d.lesson}</span> {d.name}</p>}
      <div className="dp-formula-cards">
        {cards.map((f) => (
          <figure key={f.code} className="dp-formula-card">
            <FormulaSymbols slots={f.slots} labels />
            <figcaption><strong>{f.code}</strong> {f.formula}</figcaption>
          </figure>
        ))}
        {d.codes.filter((c) => !cards.some((f) => f.code === c)).map((c) => <span key={c} className="dp-code-missing">{c}</span>)}
      </div>
      <div className="dp-blocks">{d.blocks.map((b, i) => <Reveal key={`${i}-${b.label}`} block={b} learn={learn} />)}</div>
    </div>
  );
}

function ActivityView({ d, learn }: { d: ActivityData; learn: boolean }) {
  const [flips, setFlips] = useState<Record<number, string>>({});
  const flip = (i: number) => setFlips((f) => ({ ...f, [i]: d.piles[i].cards[Math.floor(Math.random() * d.piles[i].cards.length)] }));
  return (
    <div className="dp-activity">
      {d.directions[0] && <p className="dp-activity-title">{d.directions[0]}</p>}
      <ol className="dp-directions">{d.directions.slice(1).map((x, i) => <li key={i}>{x}</li>)}</ol>
      {d.piles.length > 0 && (
        <>
          <div className="dp-piles">
            {d.piles.map((p, i) => (
              <button key={i} type="button" className={`dp-pile${flips[i] ? ' flipped' : ''}`} onClick={() => flip(i)} aria-label={flips[i] ? `${p.label}: ${flips[i]}. Tap to flip again.` : `Flip a ${p.label} card`}>
                <span className="dp-pile-label">{p.label}</span>
                <span className="dp-pile-card">{flips[i] ?? '?'}</span>
              </button>
            ))}
          </div>
          <div className="dp-row">
            <button type="button" className="btn btn-primary" onClick={() => d.piles.forEach((_, i) => flip(i))}>Flip all</button>
            <button type="button" className="btn" onClick={() => setFlips({})}>Turn them over</button>
          </div>
        </>
      )}
      {d.examples.length > 0 && <Reveal block={{ label: 'Example', lines: d.examples }} learn={learn} />}
    </div>
  );
}

function AssessmentView({ d, learn }: { d: AssessmentData; learn: boolean }) {
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const score = d.items.filter((_, i) => d.checks.every((_, j) => marks[`${i}-${j}`])).length;
  return (
    <div className="dp-assess">
      {d.intro && <p className="dp-assess-intro">{d.intro}</p>}
      <ol className="dp-assess-items">
        {d.items.map((it, i) => (
          <li key={i}>
            <span className="dp-assess-prompt">{it.prompt}</span>
            {!learn && (
              <span className="dp-assess-teacher">
                <span className="dp-muted">Skill {it.skill}. Answer: {it.answer}</span>
                {d.checks.map((c, j) => (
                  <label key={c} className="dp-check"><input type="checkbox" checked={!!marks[`${i}-${j}`]} onChange={(e) => setMarks((m) => ({ ...m, [`${i}-${j}`]: e.target.checked }))} /> {c}</label>
                ))}
              </span>
            )}
          </li>
        ))}
      </ol>
      {!learn && <p className="dp-score">Score (all checks met): {score} / {d.items.length}. Scores are not saved; record them on the tracker.</p>}
    </div>
  );
}

// ---------- the editing form (right panel, Edit mode) ----------
function Field({ label, value, onChange, rows = 1, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <label className="dp-field">
      <span>{label}{hint && <span className="dp-muted"> ({hint})</span>}</span>
      {rows > 1 ? <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /> : <input value={value} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}
// A list edited as one line per item. Kept as typed text while editing so blank lines don't vanish under the cursor.
function ListField({ label, value, onChange, rows = 4 }: { label: string; value: string[]; onChange: (v: string[]) => void; rows?: number }) {
  const [text, setText] = useState(join(value));
  useEffect(() => { if (join(lines(text)) !== join(value)) setText(join(value)); }, [value]);
  return <Field label={label} hint="one per line" rows={rows} value={text} onChange={(t) => { setText(t); onChange(lines(t)); }} />;
}

const CLASSES = Object.keys(GRAMMAR_SYMBOL_INFO) as SymbolWordClass[];

export function TemplateEditor({ kind, data, onChange }: { kind: PageKind; data: PageData; onChange: (d: PageData) => void }) {
  if (kind === 'goal') {
    const d = data as GoalData;
    return (<>
      <ListField label="Agenda" value={d.agenda} onChange={(agenda) => onChange({ ...d, agenda })} rows={5} />
      <Field label="Goal" rows={3} value={d.goal} onChange={(goal) => onChange({ ...d, goal })} />
      <Field label="Closing line" rows={2} value={d.closing ?? ''} onChange={(closing) => onChange({ ...d, closing })} />
    </>);
  }
  if (kind === 'review-symbols') {
    const d = data as ReviewData;
    const setSym = (i: number, patch: Partial<ReviewData['symbols'][number]>) => onChange({ ...d, symbols: d.symbols.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
    return (<>
      <ListField label="Directions" value={d.directions} onChange={(directions) => onChange({ ...d, directions })} />
      {d.symbols.map((s, i) => (
        <fieldset key={i} className="dp-fieldset">
          <legend>Symbol {i + 1}</legend>
          <label className="dp-field"><span>Symbol</span>
            <select value={s.cls} onChange={(e) => setSym(i, { cls: e.target.value as SymbolWordClass })}>{CLASSES.map((c) => <option key={c} value={c}>{GRAMMAR_SYMBOL_INFO[c].name}</option>)}</select>
          </label>
          <Field label="Motion" value={s.motion} onChange={(motion) => setSym(i, { motion })} />
          <Field label="Words" hint="3 to 5 words, comma between words" value={s.words.join(', ')} onChange={(w) => setSym(i, { words: w.split(',').map((x) => x.trim()).filter(Boolean) })} />
          {(s.words.length < 3 || s.words.length > 5) && <p className="dp-warn">The routine uses 3 to 5 words for each symbol. This one has {s.words.length}.</p>}
          <button type="button" className="btn btn-sm" onClick={() => onChange({ ...d, symbols: d.symbols.filter((_, k) => k !== i) })}>Remove symbol</button>
        </fieldset>
      ))}
      <button type="button" className="btn btn-sm" onClick={() => onChange({ ...d, symbols: [...d.symbols, { cls: 'adjective', motion: '', words: [] }] })}>Add a symbol</button>
      <Field label="Speed sort timer (seconds, 0 for none)" value={String(d.timerSeconds)} onChange={(v) => onChange({ ...d, timerSeconds: Math.max(0, Number(v.replace(/\D/g, '')) || 0) })} />
    </>);
  }
  if (kind === 'formula') {
    const d = data as FormulaData;
    const setBlock = (i: number, patch: Partial<Block>) => onChange({ ...d, blocks: d.blocks.map((b, k) => (k === i ? { ...b, ...patch } : b)) });
    return (<>
      <Field label="Lesson" value={d.lesson} onChange={(lesson) => onChange({ ...d, lesson })} />
      <Field label="Formula name" value={d.name} onChange={(name) => onChange({ ...d, name })} />
      <Field label="Formula codes" hint="comma between codes, from the Formula Master List" value={d.codes.join(', ')} onChange={(v) => onChange({ ...d, codes: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
      {d.blocks.map((b, i) => (
        <fieldset key={i} className="dp-fieldset">
          <legend>Part {i + 1}</legend>
          <Field label="Name" value={b.label} onChange={(label) => setBlock(i, { label })} />
          <ListField label="Lines" value={b.lines} onChange={(l) => setBlock(i, { lines: l })} />
          <button type="button" className="btn btn-sm" onClick={() => onChange({ ...d, blocks: d.blocks.filter((_, k) => k !== i) })}>Remove part</button>
        </fieldset>
      ))}
      <button type="button" className="btn btn-sm" onClick={() => onChange({ ...d, blocks: [...d.blocks, { label: 'New part', lines: [] }] })}>Add a part</button>
    </>);
  }
  if (kind === 'activity') {
    const d = data as ActivityData;
    return (<>
      <ListField label="Title, then directions" value={d.directions} onChange={(directions) => onChange({ ...d, directions })} rows={5} />
      <ListField label="Examples (hidden until shown)" value={d.examples} onChange={(examples) => onChange({ ...d, examples })} rows={3} />
      {d.piles.map((p, i) => (
        <fieldset key={i} className="dp-fieldset">
          <legend>Card pile {i + 1}</legend>
          <Field label="Name" value={p.label} onChange={(label) => onChange({ ...d, piles: d.piles.map((x, k) => (k === i ? { ...x, label } : x)) })} />
          <Field label="Cards" hint="comma between cards" value={p.cards.join(', ')} onChange={(v) => onChange({ ...d, piles: d.piles.map((x, k) => (k === i ? { ...x, cards: v.split(',').map((c) => c.trim()).filter(Boolean) } : x)) })} />
          <button type="button" className="btn btn-sm" onClick={() => onChange({ ...d, piles: d.piles.filter((_, k) => k !== i) })}>Remove pile</button>
        </fieldset>
      ))}
      <button type="button" className="btn btn-sm" onClick={() => onChange({ ...d, piles: [...d.piles, { label: 'Pile', cards: [] }] })}>Add a card pile</button>
    </>);
  }
  if (kind === 'assessment') {
    const d = data as AssessmentData;
    const setItem = (i: number, patch: Partial<AssessmentData['items'][number]>) => onChange({ ...d, items: d.items.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
    return (<>
      <Field label="What students see first" rows={2} value={d.intro} onChange={(intro) => onChange({ ...d, intro })} />
      {d.items.map((it, i) => (
        <fieldset key={i} className="dp-fieldset">
          <legend>Item {i + 1}</legend>
          <Field label="Prompt" value={it.prompt} onChange={(prompt) => setItem(i, { prompt })} />
          <Field label="Skill" value={it.skill} onChange={(skill) => setItem(i, { skill })} />
          <Field label="Answer (teacher only)" value={it.answer} onChange={(answer) => setItem(i, { answer })} />
          <button type="button" className="btn btn-sm" onClick={() => onChange({ ...d, items: d.items.filter((_, k) => k !== i) })}>Remove item</button>
        </fieldset>
      ))}
      <button type="button" className="btn btn-sm" onClick={() => onChange({ ...d, items: [...d.items, { prompt: '', skill: '', answer: '' }] })}>Add an item</button>
      <Field label="Checks for each item" hint="comma between checks" value={d.checks.join(', ')} onChange={(v) => onChange({ ...d, checks: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
    </>);
  }
  return null;
}
