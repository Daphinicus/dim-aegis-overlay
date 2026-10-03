import type { ScorePrecision, ScoreValue } from './score-types';

export function formatScore(score: ScoreValue | undefined, precision: ScorePrecision = 0): string {
  if (score?.value === null || score?.value === undefined || !Number.isFinite(score.value)) return '—';
  const dp = precision === 1 || precision === 2 ? precision : 0;
  const scale = 10 ** dp;
  const rounded = Math.floor(Math.max(0, score.value) * scale + .5 + 1e-9) / scale;
  const display = score.perfectOverall ? 100 : Math.min(rounded, 100 - 1 / scale);
  return `${display.toFixed(dp)}%`;
}
/** Use raw values so changing decimal precision does not change the color. */
export function scoreColor(score: ScoreValue | undefined): string {
  if (score?.value === null || score?.value === undefined || !Number.isFinite(score.value)) return 'rgba(218, 232, 242, 0.4)';
  const hue = Math.max(0, Math.min(100, score.value)) * 1.2;
  return `hsl(${Number(hue.toFixed(4))}, 75%, 65%)`;
}

export function scoreValueHtml(score: ScoreValue | undefined, precision: ScorePrecision = 0): string {
  const text = formatScore(score, precision);
  const html = text === '—' ? text : `${text.slice(0, -1)}<span class="aegis-score-percent">%</span>`;
  return `<span class="aegis-score-value${text === '—' ? ' aegis-score-unavailable' : ''}" style="color: ${scoreColor(score)}">${html}</span>`;
}

/** Descending; unknown values always follow rated values, including a real zero. */
export function compareScores(a?: ScoreValue, b?: ScoreValue): number {
  const av = a?.value ?? null, bv = b?.value ?? null;
  if (av === null) return bv === null ? 0 : 1;
  return bv === null ? -1 : bv - av;
}
