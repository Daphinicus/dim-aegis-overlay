import { safeSetInnerHTML } from './dom-utils';
import { displayGrade, applyGradeColors } from './grade-colors';
import type { ScoringResult } from './types';

// Verified against DIM standard 8.143.0 (BadgeInfo.badge); beta uses its module name.
// Keep private hooks here. Wishlist icons also have stable Font Awesome classes.
export const STAT_BAR_SELECTOR = ':scope > .SLO2oppG, :scope > [class*="BadgeInfo_badge"], :scope > [class*="BadgeInfo-badge-"], :scope > [class*="BadgeInfo-m_badge-"]';
export const INVENTORY_BADGE_SELECTOR = '.aegis-badge, .aegis-stat-grade';
export type StatGradeBasis = 'perk' | 'weapon';
type StatGradeResult = Pick<ScoringResult, 'grade' | 'weaponGrade'>;

const STAT_GRADE_LAYOUT_STYLE_ID = 'aegis-stat-grade-layout-style';
// A disabled ancestor flag does not prevent these descendant rules from
// invalidating tile subtrees when DIM changes search classes. Load them only
// while the layout is active. Keep the native hooks aligned with STAT_BAR_SELECTOR.
// Keep plus grades, 888, and both icons within even a 48px tile on Linux.
// Scale text and square icons together, with room for wider Firefox fallbacks.
const STAT_GRADE_LAYOUT_CSS = `
html[data-aegis-letter-layout] .item > :is(.SLO2oppG, [class*="BadgeInfo_badge"], [class*="BadgeInfo-badge-"], [class*="BadgeInfo-m_badge-"]) {
  --breaker-size: calc(var(--item-size) * .136);
  --element-size: calc(var(--item-size) * .17);
  font-size: calc(var(--item-size) * .17);
  letter-spacing: 0;
  padding-inline: 1px;
  column-gap: .25px;
}
html[data-aegis-letter-layout] .item > :is(.SLO2oppG, [class*="BadgeInfo_badge"], [class*="BadgeInfo-badge-"], [class*="BadgeInfo-m_badge-"]) > * { letter-spacing: 0 !important; flex-shrink: 0; }
html[data-aegis-letter-layout] .item > :is(.SLO2oppG, [class*="BadgeInfo_badge"], [class*="BadgeInfo-badge-"], [class*="BadgeInfo-m_badge-"]) > :is(img, div) { margin-inline-end: 0; }
`;

/** A preference-level switch keeps graded and ungraded inventory rows uniform. */
export function setStatGradeLayout(enabled: boolean) {
  const existingStyle = document.getElementById(STAT_GRADE_LAYOUT_STYLE_ID);
  if (enabled && !existingStyle) {
    const style = document.createElement('style');
    style.id = STAT_GRADE_LAYOUT_STYLE_ID;
    style.textContent = STAT_GRADE_LAYOUT_CSS;
    (document.head || document.documentElement).append(style);
  } else if (!enabled) {
    existingStyle?.remove();
  }
  document.documentElement.toggleAttribute('data-aegis-letter-layout', enabled);
}

export function statGradeLetter(result: StatGradeResult, basis: StatGradeBasis): string {
  // The active evaluator supplies exactly one activity. Never combine PvE/PvP.
  if (result.grade?.includes('|')) return '';
  const grade = basis === 'weapon' && !result.grade?.includes('/') ? result.weaponGrade || '' : displayGrade(result.grade || '');
  return /^[SABCDEF][+-]?$/i.test(grade) ? grade.replace(/-$/, '').toUpperCase() : '';
}

export function removeStatGrade(tile: HTMLElement) {
  tile.querySelectorAll('.aegis-stat-grade').forEach(badge => badge.remove());
  tile.querySelectorAll('[data-aegis-stat-bar]').forEach(bar => bar.removeAttribute('data-aegis-stat-bar'));
}

/** Use one text node in DIM's bar; never remove or rewrite React's children. */
export function renderStatGrade(tile: HTMLElement, result: StatGradeResult, basis: StatGradeBasis) {
  const bar = tile.querySelector<HTMLElement>(STAT_BAR_SELECTOR);
  if (!bar) { removeStatGrade(tile); return; }
  renderStatGradeInBar(bar, result, basis);
}

/** The options preview supplies its own static row, independent of DIM markup. */
export function renderStatGradeInBar(bar: HTMLElement, result: StatGradeResult, basis: StatGradeBasis) {
  const letter = statGradeLetter(result, basis);
  if (!letter) {
    bar.querySelector('.aegis-stat-grade')?.remove();
    bar.removeAttribute('data-aegis-stat-bar');
    return;
  }
  let badge = bar.querySelector<HTMLElement>(':scope > .aegis-stat-grade');
  if (!badge) { badge = document.createElement('span'); badge.className = 'aegis-stat-grade'; bar.append(badge); }
  badge.classList.remove('aegis-score');
  const text = letter;
  if (badge.textContent !== text) badge.textContent = text;
  if (badge.dataset.aegisGrade !== letter) badge.dataset.aegisGrade = letter;
  const label = 'Aegis: ' + letter;
  if (badge.getAttribute('aria-label') !== label) badge.setAttribute('aria-label', label);
  if (!bar.hasAttribute('data-aegis-stat-bar')) bar.setAttribute('data-aegis-stat-bar', '');
  applyGradeColors(badge);
}

/** Keep Scores in the same native stat-row position as the Letter style. */
export function renderStatScore(tile: HTMLElement, html: string, label: string) {
  const bar = tile.querySelector<HTMLElement>(STAT_BAR_SELECTOR);
  if (!bar) { removeStatGrade(tile); return; }
  renderStatScoreInBar(bar, html, label);
}

export function renderStatScoreInBar(bar: HTMLElement, html: string, label: string) {
  let badge = bar.querySelector<HTMLElement>(':scope > .aegis-stat-grade');
  if (!badge) { badge = document.createElement('span'); bar.append(badge); }
  badge.className = 'aegis-stat-grade aegis-score';
  badge.removeAttribute('data-aegis-grade');
  badge.style.removeProperty('color');
  if (badge.innerHTML !== html) safeSetInnerHTML(badge, html);
  if (badge.getAttribute('aria-label') !== label) badge.setAttribute('aria-label', label);
  if (!bar.hasAttribute('data-aegis-stat-bar')) bar.setAttribute('data-aegis-stat-bar', '');
}
