import type { AegisMode } from './types';
import type { ScoreEvaluations, ScoreSettings } from './score-types';
import { formatScore, scoreColor, scoreValueHtml } from './score-format';
import { t } from './i18n';

const escape = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export function scorePresentation(evaluations: ScoreEvaluations | undefined, mode: AegisMode, settings: ScoreSettings) {
  const activities = mode === 'both' ? ['pve', 'pvp'] as const : [mode] as const;
  const parts = activities.map(activity => {
    const evaluation = evaluations?.[activity];
    const score = evaluation?.[settings.aegisScoreProfile];
    return { activity, text: formatScore(score, settings.aegisScorePrecision),
      fullCoverage: settings.aegisScoreProfile === 'omni' && !!evaluation?.fullCoverage,
      reason: score?.reason, color: scoreColor(score), html: scoreValueHtml(score, settings.aegisScorePrecision) };
  });
  const basis = t(settings.aegisScoreProfile === 'best' ? 'scoreBest' : 'scoreOmni');
  const text = parts.map(p => p.text).join(' | ');
  const label = parts.map(p => `${p.activity === 'pve' ? 'PvE' : 'PvP'} ${basis}: ${p.text}`).join(', ');
  return { parts, text, label, fullCoverage: parts.some(p => p.fullCoverage),
    html: parts.length === 2 ? `<span class="aegis-split-half aegis-split-left aegis-score">${parts[0].fullCoverage ? '✦ ' : ''}${parts[0].html}</span><span class="aegis-split-half aegis-split-right aegis-score">${parts[1].fullCoverage ? '✦ ' : ''}${parts[1].html}</span>` : `${parts[0].fullCoverage ? '✦ ' : ''}${parts[0].html}` };
}
export function scoreReason(reason?: string): string {
  if (!reason) return t('scoreUnrated');
  if (reason.includes('origin-benchmark')) return t('scoreUnknownOrigins');
  if (reason.startsWith('unknown-owned')) return t('scoreUnknownOwned');
  if (reason === 'unsupported-exotic') return t('scoreExoticUnsupported');
  if (reason === 'unresolved-variant') return t('scoreUnknownVariant');
  return t('scoreUnknownSource');
}
export function scoreDetailsHtml(evaluations: ScoreEvaluations | undefined, mode: AegisMode, settings: ScoreSettings): string {
  const display = scorePresentation(evaluations, mode, settings);
  return `<details class="aegis-score-details"><summary>${escape(t('scoreDetails'))}</summary>${display.parts.map(p => {
    const result = evaluations?.[p.activity];
    const value = result?.[settings.aegisScoreProfile];
    return `<div class="aegis-score-details-activity"><strong>${p.activity === 'pve' ? 'PvE' : 'PvP'} · ${p.html}</strong>${value?.value === null || !value ? `<p>${escape(scoreReason(value?.reason))}</p>` : `<div>${escape(t('scoreCeiling'))}: ${result?.ceiling?.toFixed(2)}%</div><div>${escape(t('scoreQuality'))}: ${((result?.quality ?? 0) * 100).toFixed(2)}%</div>${settings.aegisScoreProfile === 'omni' ? `<div>${escape(t('scoreCoverage'))}: ${((result?.coverage ?? 0) * 100).toFixed(2)}%</div>` : ''}`}</div>`;
  }).join('')}<p class="aegis-score-help">${escape(t('scoreCategoryHelp'))}</p><button type="button" class="aegis-copy-score-details">${escape(t('copyScoreDetails'))}</button></details>`;
}
/** Retain feedback through the cloned cards used by the inventory preview. */
export function bindScoreDetails(root: HTMLElement, details: unknown): void {
  const serialized = JSON.stringify(details);
  root.querySelectorAll<HTMLButtonElement>('.aegis-copy-score-details').forEach(button => {
    button.dataset.aegisScoreDetails = serialized;
  });
}

// Delegation survives cached card clones and keeps copying tied to a user click.
document.addEventListener('click', async event => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.aegis-copy-score-details') : null;
  if (!button?.dataset.aegisScoreDetails) return;
  event.stopPropagation();
  try {
    await navigator.clipboard.writeText(button.dataset.aegisScoreDetails);
    button.textContent = t('scoreCopied');
  } catch { button.textContent = t('scoreCopyFailed'); }
});
