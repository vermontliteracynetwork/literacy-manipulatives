import type { ReviewStatus } from './types';

// Review statuses a teacher sets on this device (spec section 10: Draft, Reviewed, Approved; students see
// Approved only). Keys: "<sense id>:sense" for a meaning (its definition, explanation and examples) and
// "<word>:entry" for a word's header facts (forms, Tier, frequency band). Kept on this device until accounts exist.
const KEY = 'wx-review-v1';
const read = (): Record<string, ReviewStatus> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } };
let store = read();
const listeners = new Set<() => void>();
export const onReview = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const reviewKeys = () => Object.keys(store).filter((k) => store[k] === 'approved');
export const statusOf = (key: string, fallback: ReviewStatus): ReviewStatus => store[key] ?? fallback;
export function setStatus(key: string, status: ReviewStatus) {
  store = { ...store, [key]: status };
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* not saved */ }
  listeners.forEach((f) => f());
}
