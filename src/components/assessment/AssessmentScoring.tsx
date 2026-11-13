import { useEffect, useMemo, useState } from 'react';
import { HomeButton } from '../HomeButton';
import {
  ASSESSMENTS,
  getAssessment,
  effectiveMark,
  emptyRows,
  lessonPlan,
  newRecord,
  pctText,
  rating,
  RATING_LABEL,
  summarize,
  USES,
  type AssessmentDef,
  type ColumnDef,
  type LevelDef,
  type Mark,
  type Rating,
  type RowData,
  type ScoringRecord,
  type Summary,
  type Tally,
} from '../../lib/assessments';
import './assessmentScoring.css';

// Assessment Scoring (her request 2026-11-13): the Symbolic Grammar score sheets as an online tool.
// One record per learner per sitting. Totals, percents, the summary page and "what to teach" fill in as you type.
// Saved in this browser only (no accounts yet), with a CSV export.

const STORE_KEY = 'sg-assessment-scoring-v1';
type Tab = 'score' | 'summary' | 'saved';

interface Store { records: ScoringRecord[]; currentId: string }

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (Array.isArray(s.records) && s.records.length) return s;
    }
  } catch { /* storage blocked: start fresh */ }
  const rec = newRecord(ASSESSMENTS[0], ASSESSMENTS[0].levels[0].id);
  return { records: [rec], currentId: rec.id };
}

function saveStore(s: Store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
}

function hasAnyData(rec: ScoringRecord): boolean {
  return Object.values(rec.rows).some((rows) => rows.some((r) => Object.keys(r.n).length || Object.keys(r.m).length || Object.keys(r.s).length));
}

function levelOf(def: AssessmentDef, rec: ScoringRecord): LevelDef {
  return def.levels.find((l) => l.id === rec.levelId) ?? def.levels[0];
}

function rowLabels(level: LevelDef): string[] {
  return level.rows.map((kind, i) => `${i + 1} ${kind}`);
}

export function AssessmentScoring() {
  const [store, setStore] = useState<Store>(loadStore);
  const [tab, setTab] = useState<Tab>('score');
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => { saveStore(store); }, [store]);

  const rec = store.records.find((r) => r.id === store.currentId) ?? store.records[0];
  const def = getAssessment(rec.assessmentId);
  const level = levelOf(def, rec);
  const sum = useMemo(() => summarize(def, level, rec.rows), [def, level, rec.rows]);

  const update = (patch: Partial<ScoringRecord>) =>
    setStore((s) => ({ ...s, records: s.records.map((r) => (r.id === rec.id ? { ...r, ...patch, updatedAt: Date.now() } : r)) }));

  const setRow = (qid: string, i: number, fn: (r: RowData) => RowData) => {
    const rows = { ...rec.rows, [qid]: (rec.rows[qid] ?? []).map((r, j) => (j === i ? fn(r) : r)) };
    update({ rows });
  };

  const changeLevel = (levelId: string) => {
    if (levelId === rec.levelId) return;
    if (hasAnyData(rec) && !window.confirm('Changing the level clears the scores entered for this learner. Change it?')) return;
    const lv = def.levels.find((l) => l.id === levelId) ?? def.levels[0];
    update({ levelId: lv.id, rows: emptyRows(lv), teach: {}, lessonRatings: {} });
  };

  const changeAssessment = (id: string) => {
    if (id === rec.assessmentId) return;
    if (hasAnyData(rec) && !window.confirm('Changing the assessment clears the scores entered for this learner. Change it?')) return;
    const d = getAssessment(id);
    update({ assessmentId: d.id, levelId: d.levels[0].id, rows: emptyRows(d.levels[0]), teach: {}, lessonRatings: {} });
  };

  const startNew = () => {
    const r = newRecord(def, rec.levelId);
    r.assessor = rec.assessor;
    setStore((s) => ({ records: [r, ...s.records], currentId: r.id }));
    setTab('score');
  };

  const open = (id: string) => { setStore((s) => ({ ...s, currentId: id })); setTab('score'); };

  const remove = (id: string) => {
    const target = store.records.find((r) => r.id === id);
    if (!window.confirm(`Delete the scores for ${target?.learner || 'this learner'}? This cannot be undone.`)) return;
    setStore((s) => {
      const records = s.records.filter((r) => r.id !== id);
      if (!records.length) { const r = newRecord(def, rec.levelId); return { records: [r], currentId: r.id }; }
      return { records, currentId: s.currentId === id ? records[0].id : s.currentId };
    });
  };

  return (
    <div className="as-page">
      <header className="as-header no-print">
        <HomeButton />
        <div className="as-title">
          <h1>Assessment Scoring</h1>
          <p>Symbolic Grammar score sheets. Totals, percents and what to teach fill in as you score.</p>
        </div>
        <div className="as-header-actions">
          <button type="button" className="btn btn-sm" onClick={() => setShowGuide((v) => !v)} aria-expanded={showGuide}>How to score</button>
          <button type="button" className="btn btn-sm" onClick={() => window.print()}>Print</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={startNew}>New learner</button>
        </div>
      </header>

      {showGuide && <Guide def={def} onClose={() => setShowGuide(false)} />}

      <section className="as-info" aria-label="Learner and assessment">
        <div className="as-field">
          <label htmlFor="as-unit">Assessment</label>
          <select id="as-unit" value={rec.assessmentId} onChange={(e) => changeAssessment(e.target.value)}>
            {ASSESSMENTS.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>
        <div className="as-field">
          <span className="as-label" id="as-level-label">Level</span>
          <div className="as-seg" role="radiogroup" aria-labelledby="as-level-label">
            {def.levels.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={l.id === rec.levelId} className={l.id === rec.levelId ? 'on' : ''} onClick={() => changeLevel(l.id)}>{l.id}</button>
            ))}
          </div>
        </div>
        <div className="as-field as-grow">
          <label htmlFor="as-learner">Learner</label>
          <input id="as-learner" value={rec.learner} onChange={(e) => update({ learner: e.target.value })} placeholder="Name" />
        </div>
        <div className="as-field">
          <label htmlFor="as-date">Date</label>
          <input id="as-date" type="date" value={rec.date} onChange={(e) => update({ date: e.target.value })} />
        </div>
        <div className="as-field as-grow">
          <label htmlFor="as-assessor">Assessor</label>
          <input id="as-assessor" value={rec.assessor} onChange={(e) => update({ assessor: e.target.value })} />
        </div>
        <div className="as-field">
          <label htmlFor="as-use">Use</label>
          <select id="as-use" value={rec.use} onChange={(e) => update({ use: e.target.value as ScoringRecord['use'] })}>
            <option value="">Choose</option>
            {USES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
        <div className="as-field as-grow">
          <label htmlFor="as-mode">Response mode</label>
          <input id="as-mode" value={rec.responseMode} onChange={(e) => update({ responseMode: e.target.value })} placeholder="Written, typed, dictated..." />
        </div>
      </section>

      <nav className="as-tabs no-print" role="tablist" aria-label="Scoring views">
        {(['score', 'summary', 'saved'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'score' ? 'Score sheet' : t === 'summary' ? 'Summary and what to teach' : `Saved (${store.records.length})`}
          </button>
        ))}
        <span className="as-tab-score">Target total <strong>{sum.targetTotal} / {sum.targetMax}</strong></span>
      </nav>

      <main className="as-main">
        <div className={tab === 'score' ? '' : 'as-hidden-screen'}>
          <ScoreSheet def={def} level={level} rec={rec} sum={sum} setRow={setRow} />
        </div>
        <div className={tab === 'summary' ? '' : 'as-hidden-screen'}>
          <SummaryView def={def} level={level} rec={rec} sum={sum} update={update} />
        </div>
        {tab === 'saved' && <SavedView records={store.records} currentId={rec.id} open={open} remove={remove} />}
      </main>
    </div>
  );
}

/* ---------- How to score ---------- */

function Guide({ def, onClose }: { def: AssessmentDef; onClose: () => void }) {
  return (
    <section className="as-guide no-print" aria-label="How to score">
      <div className="as-guide-head">
        <h2>{def.title}: how to score</h2>
        <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
      </div>
      <p className="as-muted">Read each sentence once and tally. About 5 minutes per learner. One record per learner, at the level they took.</p>
      <div className="as-guide-cols">
        {def.guide.map((g) => (
          <div key={g.heading}>
            <h3>{g.heading}</h3>
            <ul>{g.points.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Score sheet ---------- */

function ColHead({ c }: { c: ColumnDef }) {
  return (
    <th scope="col" className={`as-col as-col-${c.kind}`}>
      <span className="as-col-label">{c.label}</span>
      {c.hint && <span className="as-col-hint">{c.hint}</span>}
      <span className="as-col-unit">{c.kind === 'count' ? '#' : c.kind === 'check' ? '✓ or ✗' : 'correct / used'}</span>
    </th>
  );
}

function CheckCell({ value, forced, onChange, label }: { value: Mark; forced?: boolean; onChange: (m: Mark) => void; label: string }) {
  const next: Record<Mark, Mark> = { '': 'y', y: 'n', n: '' };
  const text = value === 'y' ? '✓' : value === 'n' ? '✗' : '';
  const state = value === 'y' ? 'yes' : value === 'n' ? 'no' : 'blank';
  return (
    <button
      type="button"
      className={`as-check as-check-${value || 'blank'}`}
      disabled={forced}
      onClick={() => onChange(next[value])}
      onKeyDown={(e) => {
        if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); onChange('y'); }
        else if (e.key === 'n' || e.key === 'N' || e.key === 'x' || e.key === 'X') { e.preventDefault(); onChange('n'); }
        else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); onChange(''); }
      }}
      aria-label={`${label}: ${state}${forced ? ' (Capital or End mark is ✗)' : ''}`}
      title="Click, or press Y for ✓ and N for ✗"
    >{text}</button>
  );
}

function NumInput({ value, onChange, label, className = '' }: { value: string; onChange: (v: string) => void; label: string; className?: string }) {
  return (
    <input
      className={`as-num ${className}`}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
    />
  );
}

function totalText(c: ColumnDef, t: Tally): string {
  if (c.kind === 'count') return t.b ? String(t.a) : '';
  if (c.kind === 'check') return t.b ? `✓ ${t.a}` : '';
  return t.b || t.a ? `${t.a} / ${t.b}` : '';
}

function ScoreSheet({ def, level, rec, sum, setRow }: {
  def: AssessmentDef; level: LevelDef; rec: ScoringRecord; sum: Summary;
  setRow: (qid: string, i: number, fn: (r: RowData) => RowData) => void;
}) {
  const labels = rowLabels(level);
  const colName = (k: string) => def.columns.find((c) => c.key === k)?.label ?? k;

  return (
    <div className="as-sheet">
      <h2 className="print-only">{def.title} Score Sheet · Level {level.id} · {rec.learner}</h2>
      <nav className="as-qnav no-print" aria-label="Jump to a question">
        {sum.questions.map((q) => (
          <a key={q.id} href={`#as-${q.id}`} className={q.scored ? (q.met ? 'met' : 'missed') : ''}>
            {q.id}<span className="as-sr">{q.scored ? (q.met ? ', target met' : ', target not met') : ', not scored yet'}</span>
          </a>
        ))}
        <a href="#as-totals">Totals</a>
      </nav>
      <div className="as-table-wrap">
        <table className="as-table">
          <thead>
            <tr>
              <th scope="col" className="as-rowhead">Sentence #</th>
              {def.columns.map((c) => <ColHead key={c.key} c={c} />)}
            </tr>
          </thead>
          {level.questions.map((q) => {
            const res = sum.questions.find((r) => r.id === q.id)!;
            const rows = rec.rows[q.id] ?? [];
            return (
              <tbody key={q.id} id={`as-${q.id}`}>
                <tr className="as-qband">
                  <th colSpan={def.columns.length + 1} scope="rowgroup">
                    <span className="as-qid">{q.id}</span>
                    <span className="as-target-skill">Target skill: <mark>{q.skill}</mark></span>
                    <span>Required words: <strong>{q.requiredWords}</strong></span>
                    <span className="as-muted">Scored in: {colName(q.scoredIn)} (outlined on the {q.id} total row)</span>
                  </th>
                </tr>
                {rows.map((r, i) => {
                  const rowLabel = `${q.id} sentence ${labels[i]}`;
                  return (
                    <tr key={i} className={`as-row as-row-${level.rows[i].toLowerCase()}`}>
                      <th scope="row" className="as-rowhead">{labels[i]}</th>
                      {def.columns.map((c) => {
                        if (c.kind === 'count') {
                          return (
                            <td key={c.key} className={`as-cell as-cell-${c.kind}`}>
                              <NumInput value={r.n[c.key] ?? ''} label={`${rowLabel}, ${c.label}`} onChange={(v) => setRow(q.id, i, (x) => ({ ...x, n: { ...x.n, [c.key]: v } }))} />
                            </td>
                          );
                        }
                        if (c.kind === 'check') {
                          const forced = c.key === 'complete' && (r.m.capital === 'n' || r.m.endMark === 'n');
                          return (
                            <td key={c.key} className={`as-cell as-cell-${c.kind}`}>
                              <CheckCell value={effectiveMark(r, c.key)} forced={forced} label={`${rowLabel}, ${c.label}`} onChange={(m) => setRow(q.id, i, (x) => ({ ...x, m: { ...x.m, [c.key]: m } }))} />
                            </td>
                          );
                        }
                        const v = r.s[c.key] ?? { c: '', u: '' };
                        const bad = v.c !== '' && v.u !== '' && Number(v.c) > Number(v.u);
                        return (
                          <td key={c.key} className={`as-cell as-cell-skill${bad ? ' as-bad' : ''}`} title={bad ? 'Correct is more than used' : undefined}>
                            <NumInput value={v.c} label={`${rowLabel}, ${c.label} correct`} onChange={(val) => setRow(q.id, i, (x) => ({ ...x, s: { ...x.s, [c.key]: { ...(x.s[c.key] ?? { c: '', u: '' }), c: val } } }))} />
                            <span aria-hidden="true">/</span>
                            <NumInput value={v.u} label={`${rowLabel}, ${c.label} used`} onChange={(val) => setRow(q.id, i, (x) => ({ ...x, s: { ...x.s, [c.key]: { ...(x.s[c.key] ?? { c: '', u: '' }), u: val } } }))} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="as-total">
                  <th scope="row" className="as-rowhead">{q.id} total</th>
                  {def.columns.map((c) => {
                    const isTarget = c.key === q.scoredIn;
                    if (isTarget) {
                      return (
                        <td key={c.key} className={`as-target ${res.scored ? (res.met ? 'met' : 'missed') : ''}`}>
                          <strong>{res.score} / {q.target}</strong>
                          {res.score > q.target && <span className="as-extra">+{res.score - q.target}</span>}
                        </td>
                      );
                    }
                    return <td key={c.key}>{totalText(c, res.totals[c.key])}</td>;
                  })}
                </tr>
              </tbody>
            );
          })}
          <tfoot id="as-totals">
            <tr className="as-grand">
              <th scope="row" className="as-rowhead">TOTAL</th>
              {def.columns.map((c) => <td key={c.key}>{totalText(c, sum.columns[c.key])}</td>)}
            </tr>
            <tr className="as-grand as-pct">
              <th scope="row" className="as-rowhead">PERCENT</th>
              {def.columns.map((c) => {
                const p = sum.columns[c.key].pct;
                const r = rating(p);
                return <td key={c.key} className={r ? `as-r-${r}` : ''}>{pctText(p)}</td>;
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="as-muted as-foot">
        ✓ columns: percent = ✓ ÷ sentences scored. correct / used: correct ÷ used. Required words: required sentences that use their required words ÷ required sentences.
        Target score (outlined cells): correct ÷ required; extra correct uses are additional points, so it can pass 100%. Blank is not zero: leave a skill blank when it does not appear.
      </p>
    </div>
  );
}

/* ---------- Summary ---------- */

function RatingChip({ r }: { r: Rating | null }) {
  if (!r) return <span className="as-chip as-chip-none">Not scored</span>;
  return <span className={`as-chip as-r-${r}`}>{RATING_LABEL[r]}</span>;
}

function SummaryView({ def, level, rec, sum, update }: {
  def: AssessmentDef; level: LevelDef; rec: ScoringRecord; sum: Summary; update: (p: Partial<ScoringRecord>) => void;
}) {
  const plan = lessonPlan(def, level, sum, rec.teach);
  const pctCols = def.columns.filter((c) => c.key !== 'totalWords' && c.key !== 'requiredWords');
  const reqPct = sum.columns.requiredWords.pct;
  const completePct = sum.columns.complete?.pct ?? null;
  const toTeach = plan
    .map((p) => ({ ...p, final: (rec.lessonRatings[p.code] || p.suggested) as Rating | null }))
    .filter((p) => p.final && p.final !== 'secure')
    .sort((a, b) => (a.final === b.final ? a.code.localeCompare(b.code, undefined, { numeric: true }) : a.final === 'priority' ? -1 : 1));

  return (
    <div className="as-summary">
      <h2 className="as-section-title">Summary · Level {level.id}{rec.learner ? ` · ${rec.learner}` : ''}</h2>
      <div className="as-stats">
        <Stat label="Sentences written" value={String(sum.sentences)} />
        <Stat label="Required words used" value={pctText(reqPct) || '0%'} sub={`${sum.requiredUsed} of ${sum.requiredSentences} required sentences`} />
        <Stat label="Complete sentences" value={pctText(completePct) || ''} />
        <Stat label="Average words per sentence" value={sum.avgWords == null ? '' : sum.avgWords.toFixed(1)} />
        <Stat label="Shortest to longest sentence" value={sum.shortest == null ? '' : `${sum.shortest} to ${sum.longest}`} />
        <Stat label="Target total" value={`${sum.targetTotal} / ${sum.targetMax}`} />
      </div>
      <div className="as-legend">
        <div className="as-r-priority"><strong>Under 60% · Priority</strong><span>Teach the checked skills first, with extra practice.</span></div>
        <div className="as-r-developing"><strong>60 to 89% · Developing</strong><span>Teach the checked skills at the normal pace.</span></div>
        <div className="as-r-secure"><strong>90% or more · Secure</strong><span>Quick review and move on.</span></div>
      </div>

      <div className="as-summary-grid">
        <section>
          <h3>Every sentence</h3>
          <table className="as-sumtable">
            <thead><tr><th scope="col">Column</th><th scope="col">%</th><th scope="col">Rating</th><th scope="col">Teach next <span className="as-muted">(check each skill with errors)</span></th></tr></thead>
            <tbody>
              {pctCols.map((c) => {
                const res = sum.columns[c.key];
                const r = rating(res.pct);
                return (
                  <tr key={c.key}>
                    <th scope="row">{c.label}<span className="as-muted as-small">{c.kind === 'skill' ? (res.b ? ` ${res.a} of ${res.b}` : '') : res.b ? ` ${res.a} of ${res.b}` : ''}</span></th>
                    <td className="as-pctcell">{pctText(res.pct)}</td>
                    <td><RatingChip r={r} /></td>
                    <td>
                      <div className="as-teach">
                        {(level.teachNext[c.key] ?? []).map((code) => {
                          const id = `${c.key}:${code}`;
                          return (
                            <label key={code}>
                              <input type="checkbox" checked={!!rec.teach[id]} onChange={(e) => update({ teach: { ...rec.teach, [id]: e.target.checked } })} />
                              {code} {def.lessons[code]}
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section>
          <h3>Target questions</h3>
          <table className="as-sumtable">
            <thead><tr><th scope="col">Q</th><th scope="col">Target skill</th><th scope="col">Score</th><th scope="col">Met?</th></tr></thead>
            <tbody>
              {level.questions.map((q) => {
                const res = sum.questions.find((r) => r.id === q.id)!;
                return (
                  <tr key={q.id}>
                    <th scope="row">{q.id}</th>
                    <td>{q.lesson} {q.skill}</td>
                    <td className="as-pctcell">{res.score} / {q.target}</td>
                    <td>{res.scored ? (res.met ? <span className="as-chip as-r-secure">Yes</span> : <span className="as-chip as-r-priority">Not yet</span>) : <span className="as-chip as-chip-none">Not scored</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      <section className="as-plan">
        <h3>What to teach: rate each lesson</h3>
        <p className="as-muted">Each lesson is read across all of the learner's sentences. The suggestion is the lowest rating among the columns that list the lesson, and at least Developing when its target question was missed. Change any rating with your own judgment.</p>
        <table className="as-sumtable">
          <thead><tr><th scope="col">Lesson</th><th scope="col">Read in</th><th scope="col">Target</th><th scope="col">Suggested</th><th scope="col">Your rating</th></tr></thead>
          <tbody>
            {plan.map((p) => (
              <tr key={p.code} className={p.checked ? 'as-checked' : ''}>
                <th scope="row">{p.code} {p.title}{p.checked && <span className="as-flag">checked</span>}</th>
                <td className="as-small">{p.columns.map((k) => def.columns.find((c) => c.key === k)?.label).join(', ')}</td>
                <td className="as-small">{p.targets.map((t) => `${t.id} ${t.attempted ? (t.met ? 'met' : 'not yet') : 'not scored'}`).join(', ')}</td>
                <td><RatingChip r={p.suggested} /></td>
                <td>
                  <select
                    aria-label={`Your rating for ${p.code} ${p.title}`}
                    value={rec.lessonRatings[p.code] ?? ''}
                    onChange={(e) => update({ lessonRatings: { ...rec.lessonRatings, [p.code]: e.target.value as Rating | '' } })}
                  >
                    <option value="">Use suggestion</option>
                    <option value="priority">Priority</option>
                    <option value="developing">Developing</option>
                    <option value="secure">Secure</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="as-plan">
        <h3>Teaching order</h3>
        {toTeach.length === 0 ? (
          <p className="as-muted">Nothing rated Priority or Developing yet.</p>
        ) : (
          <ol className="as-order">
            {toTeach.map((p) => (
              <li key={p.code}><RatingChip r={p.final} /> {p.code} {p.title}</li>
            ))}
          </ol>
        )}
        <label className="as-notes">
          Notes
          <textarea value={rec.notes} onChange={(e) => update({ notes: e.target.value })} rows={3} />
        </label>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="as-stat">
      <span className="as-stat-label">{label}</span>
      <span className="as-stat-value">{value || '·'}</span>
      {sub && <span className="as-stat-sub">{sub}</span>}
    </div>
  );
}

/* ---------- Saved and growth ---------- */

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(records: ScoringRecord[]) {
  const head = ['Learner', 'Date', 'Assessor', 'Use', 'Assessment', 'Level', 'Response mode', 'Sentences', 'Avg words', 'Shortest', 'Longest', 'Required words %'];
  const def0 = ASSESSMENTS[0];
  const pctCols = def0.columns.filter((c) => c.kind !== 'count');
  head.push(...pctCols.map((c) => `${c.label} %`), 'Target total', 'Target max');
  for (let i = 1; i <= 10; i++) head.push(`Q${i}`);
  const lines = [head.map(csvCell).join(',')];
  for (const r of records) {
    const def = getAssessment(r.assessmentId);
    const level = levelOf(def, r);
    const s = summarize(def, level, r.rows);
    const row: (string | number)[] = [r.learner, r.date, r.assessor, r.use, def.title, level.id, r.responseMode, s.sentences, s.avgWords == null ? '' : s.avgWords.toFixed(1), s.shortest ?? '', s.longest ?? '', s.columns.requiredWords.pct == null ? '' : Math.round(s.columns.requiredWords.pct)];
    row.push(...pctCols.map((c) => { const p = s.columns[c.key]?.pct; return p == null ? '' : Math.round(p); }));
    row.push(s.targetTotal, s.targetMax);
    for (let i = 0; i < 10; i++) { const q = s.questions[i]; row.push(q ? `${q.score}/${q.target}` : ''); }
    lines.push(row.map(csvCell).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `symbolic-grammar-scores-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const USE_ORDER: Record<string, number> = { pretest: 0, 'mid-check': 1, posttest: 2, benchmark: 3, '': 4 };

function SavedView({ records, currentId, open, remove }: { records: ScoringRecord[]; currentId: string; open: (id: string) => void; remove: (id: string) => void }) {
  const [filter, setFilter] = useState('');
  const learners = [...new Set(records.map((r) => r.learner.trim()).filter(Boolean))].sort();
  const [growthFor, setGrowthFor] = useState('');
  const shown = records
    .filter((r) => !filter.trim() || r.learner.toLowerCase().includes(filter.trim().toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const growth = records
    .filter((r) => r.learner.trim() === growthFor)
    .sort((a, b) => a.date.localeCompare(b.date) || USE_ORDER[a.use] - USE_ORDER[b.use]);
  const def0 = ASSESSMENTS[0];
  const growthCols = def0.columns.filter((c) => c.kind !== 'count');

  return (
    <div className="as-saved">
      <div className="as-saved-bar">
        <label className="as-field as-grow">
          <span className="as-label">Find a learner</span>
          <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Name" />
        </label>
        <button type="button" className="btn btn-sm" onClick={() => exportCsv(records)}>Export all as CSV</button>
      </div>
      <p className="as-muted">Scores save in this browser as you type. Export a CSV to keep a copy or share it.</p>
      <table className="as-sumtable">
        <thead><tr><th scope="col">Learner</th><th scope="col">Date</th><th scope="col">Use</th><th scope="col">Assessment</th><th scope="col">Target total</th><th scope="col"><span className="as-sr">Actions</span></th></tr></thead>
        <tbody>
          {shown.map((r) => {
            const def = getAssessment(r.assessmentId);
            const level = levelOf(def, r);
            const s = summarize(def, level, r.rows);
            return (
              <tr key={r.id} className={r.id === currentId ? 'as-current' : ''}>
                <th scope="row">{r.learner || <span className="as-muted">No name yet</span>}</th>
                <td>{r.date}</td>
                <td>{USES.find((u) => u.value === r.use)?.label ?? ''}</td>
                <td>{def.title} · Level {level.id}</td>
                <td>{s.targetTotal} / {s.targetMax}</td>
                <td className="as-actions">
                  <button type="button" className="btn btn-sm" onClick={() => open(r.id)} aria-label={`Open ${r.learner || 'record'} ${r.date}`}>{r.id === currentId ? 'Open (current)' : 'Open'}</button>
                  <button type="button" className="btn btn-sm" onClick={() => remove(r.id)} aria-label={`Delete ${r.learner || 'record'} ${r.date}`}>Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="as-plan">
        <h3>Growth</h3>
        <p className="as-muted">Pretest, mid-check and posttest on the same numbers.</p>
        <label className="as-field">
          <span className="as-label">Learner</span>
          <select value={growthFor} onChange={(e) => setGrowthFor(e.target.value)}>
            <option value="">Choose a learner</option>
            {learners.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        {growthFor && (
          <div className="as-table-wrap">
            <table className="as-sumtable as-growth">
              <thead>
                <tr>
                  <th scope="col">Sitting</th>
                  <th scope="col">Sentences</th>
                  <th scope="col">Required words</th>
                  {growthCols.map((c) => <th key={c.key} scope="col">{c.label}</th>)}
                  <th scope="col">Target total</th>
                </tr>
              </thead>
              <tbody>
                {growth.map((r) => {
                  const def = getAssessment(r.assessmentId);
                  const level = levelOf(def, r);
                  const s = summarize(def, level, r.rows);
                  return (
                    <tr key={r.id}>
                      <th scope="row">{USES.find((u) => u.value === r.use)?.label ?? 'Sitting'} · {r.date} · {def.title} {level.id}</th>
                      <td>{s.sentences}</td>
                      <td className={s.columns.requiredWords.pct == null ? '' : `as-r-${rating(s.columns.requiredWords.pct)}`}>{pctText(s.columns.requiredWords.pct)}</td>
                      {growthCols.map((c) => {
                        const p = s.columns[c.key]?.pct ?? null;
                        return <td key={c.key} className={p == null ? '' : `as-r-${rating(p)}`}>{pctText(p)}</td>;
                      })}
                      <td>{s.targetTotal} / {s.targetMax}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
