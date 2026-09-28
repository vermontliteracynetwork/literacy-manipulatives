export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Human-readable form of an ISO date for anywhere a teacher needs to know
// exactly which day they're looking at (e.g. "Monday, September 8, 2026").
export const formatDateLong = (isoDate: string): string =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

export const isWeekend = (isoDate: string): boolean => {
  const d = new Date(`${isoDate}T00:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
};

const JS_DAY_TO_WEEKDAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

// Today's weekday key for the weekly schedule, or null on a weekend (no school day to auto-load).
export const currentDayOfWeek = (): 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | null => {
  const key = JS_DAY_TO_WEEKDAY[new Date().getDay()];
  return key === 'sun' || key === 'sat' ? null : key;
};

// Count the number of "school days" (Mon-Fri) strictly between two ISO dates (exclusive of both ends).
const schoolDaysBetween = (fromISO: string, toISO: string): number => {
  const from = new Date(`${fromISO}T00:00:00`);
  const to = new Date(`${toISO}T00:00:00`);
  let count = 0;
  const cursor = new Date(from);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor < to) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

/**
 * A streak continues if the last completed day and today are the same day,
 * consecutive, or separated only by a weekend (weekends auto-freeze).
 */
export const streakContinues = (lastCompletedISO: string | null, todayISOStr: string): boolean => {
  if (!lastCompletedISO) return false;
  if (lastCompletedISO === todayISOStr) return true;
  const gapSchoolDays = schoolDaysBetween(lastCompletedISO, todayISOStr);
  return gapSchoolDays === 0;
};
