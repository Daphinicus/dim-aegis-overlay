import type { ScorePrecision, ScoreValue } from './score-types';

export function formatScore(score: ScoreValue | undefined, precision: ScorePrecision = 0): string {
  if (score?.value === null || score?.value === undefined || !Number.isFinite(score.value)) return '—';
  const dp = precision === 1 || precision === 2 ? precision : 0;
  const scale = 10 ** dp;
  const rounded = Math.floor(Math.max(0, score.value) * scale + .5 + 1e-9) / scale;
  const display = score.perfectOverall ? 100 : Math.min(rounded, 100 - 1 / scale);
  return `${display.toFixed(dp)}%`;
}
/** Descending; unknown values always follow rated values, including a real zero. */
export function compareScores(a?: ScoreValue, b?: ScoreValue): number {
  const av = a?.value ?? null, bv = b?.value ?? null;
  if (av === null) return bv === null ? 0 : 1;
  return bv === null ? -1 : bv - av;
}
