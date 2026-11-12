import { setStatus } from '../../lib/word-explorer/review';

// Teacher view: Draft, Reviewed and Approve for one field (students see Approved only).
export function ReviewButtons({ statusKey, status, what, compact = false }: { statusKey: string; status: string; what: string; compact?: boolean }) {
  return (
    <div className="wx-review" role="group" aria-label={`Review ${what}`}>
      {!compact && <span className="wx-review-label">Review {what}:</span>}
      {(['draft', 'reviewed', 'approved'] as const).map((s) => (
        <button key={s} type="button" className={`wx-btn wx-btn-small${status === s ? ' wx-btn-primary' : ''}`} aria-pressed={status === s} onClick={() => setStatus(statusKey, s)}>
          {s === 'draft' ? 'Draft' : s === 'reviewed' ? 'Reviewed' : 'Approve'}
        </button>
      ))}
    </div>
  );
}
