/**
 * Forecast scoring. The database computes the same numbers in SQL
 * (supabase/migrations/..._functions.sql); these mirror it for the UI and tests.
 */

/** Brier score for one prediction: (p - outcome)^2, p as a 0..1 probability. */
export const brier = (pPercent: number, happened: boolean) => (pPercent / 100 - (happened ? 1 : 0)) ** 2;

/** Brier skill against always guessing 50%: 1 is perfect, 0 is coin-flip, negative is worse. */
export const skill = (meanBrier: number) => 1 - meanBrier / 0.25;

/** Ear score: skill mapped to 0..100, where 50 is coin-flip accuracy. */
export const ear = (meanBrier: number) => Math.max(0, Math.min(100, Math.round(50 + 50 * skill(meanBrier))));

/** Crowd forecast: mean probability, each person weighted 1 + 2*max(0, skill). */
export function consensus(preds: { p: number; skill?: number | null }[]): number | null {
  if (!preds.length) return null;
  let sw = 0, sp = 0;
  for (const x of preds) { const w = 1 + 2 * Math.max(0, x.skill ?? 0); sw += w; sp += w * x.p; }
  return Math.round(sp / sw);
}

/** Feed ranking, same as the post_feed view's hot column. */
export function hot(p: { likes: number; laughs: number; comment_count: number; agree: number; disagree: number; created_at: string }, now = Date.now()): number {
  const e = 1 + p.likes + p.laughs * 1.4 + p.comment_count * 3 + (p.agree + p.disagree) * 0.4;
  return e / Math.pow((now - new Date(p.created_at).getTime()) / 36e5 + 2, 1.3);
}
