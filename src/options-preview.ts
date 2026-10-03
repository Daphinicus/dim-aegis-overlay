import { readScoreSettings } from './score-config';
import { setScorePercentVisibility } from './score-display';
import { formatScore, scoreValueHtml } from './score-format';
import type { ScoreSettings } from './score-types';
import { renderStatGradeInBar, renderStatScoreInBar, removeStatGrade } from './stat-grade';
import { applyGradeColors, applyGradeGlow, setTileGlow, resolveTileGlow } from './grade-colors';
import type { TileGlow } from './types';
import { applyBadgePresentation, normalizeBadgeVisibility, rollBadgeSymbol, type BadgeVisibilitySettings } from './badge-presentation';

interface PreviewSettings extends Partial<ScoreSettings> {
  scoringSource?: string;
  aegisDbMode?: string;
  aegisBadgeVisibility?: BadgeVisibilitySettings;
  aegisBadgeStyle?: string;
  aegisStatGradeBasis?: string;
  aegisBadgePosition?: string;
  aegisUpgradeStyle?: string;
  aegisShowPerfectStar?: boolean;
  aegisShowOmniStar?: boolean;
  aegisMode?: string;
  aegisTwoTier?: boolean;
  aegisGradeDisplayMode?: string;
  aegisMaxTierGlow?: boolean;
  aegisTileGlow?: TileGlow;
}

let settings: PreviewSettings = {};

export function renderOptionsPreview() {
  setScorePercentVisibility(settings.aegisScoreShowPercent !== false);
  const tile = document.getElementById('interactive-weapon-tile');
  if (!tile) return;

  setTileGlow(resolveTileGlow(settings.aegisTileGlow, settings.aegisMaxTierGlow));

  const badge = tile.querySelector<HTMLElement>('.aegis-badge');
  if (!badge) return;

  const useScores = settings.aegisRatingDisplay === 'scores' && settings.scoringSource !== 'lightgg' && settings.aegisDbMode !== 'wishlist';
  const style = settings.aegisBadgeStyle || 'classic';
  const statPreview = tile.querySelector<HTMLElement>('.aegis-stat-preview');
  tile.classList.toggle('aegis-tile-stat', style === 'stat');
  if (style === 'stat') {
    badge.className = 'aegis-badge aegis-badge-hidden';
    tile.classList.remove('aegis-tile-footer');
    const basis = settings.aegisStatGradeBasis === 'weapon' ? 'weapon' : 'perk';
    const grade = basis === 'weapon' ? 'B+' : 'S+';
    const visibility = normalizeBadgeVisibility(settings.aegisBadgeVisibility).weapon;
    if (statPreview && visibility !== 'off') {
      if (useScores) {
        const scoreSettings = readScoreSettings({ ...settings });
        const value = { value: settings.aegisMode === 'pvp' ? 92.456 : 87.234, perfectOverall: false };
        const text = formatScore(value, scoreSettings.aegisScorePrecision);
        renderStatScoreInBar(statPreview, scoreValueHtml(value, scoreSettings.aegisScorePrecision), 'Aegis: ' + text);
      } else renderStatGradeInBar(statPreview, { grade: 'S+', weaponGrade: 'B+' }, basis);
    }
    else removeStatGrade(tile);
    applyGradeGlow(tile, useScores || visibility === 'off' ? '' : grade);
    return;
  }
  removeStatGrade(tile);
  tile.classList.toggle('aegis-tile-footer', style === 'footer');
  const posVal = settings.aegisBadgePosition || 'bottom-left';
  const posKey = posVal.replace('bottom-left', 'bl').replace('top-left', 'tl').replace('top-right', 'tr').replace('bottom-right', 'br');

  // Preview grade string (BS+ in two-tier, S+ in standard)
  const gradeStr = settings.aegisTwoTier ? 'BS+' : 'S+';

  badge.className = `aegis-badge aegis-badge-s aegis-badge-wide aegis-style-${style} aegis-pos-${posKey}`;
  badge.replaceChildren();

  if (useScores) {
    const scoreSettings = readScoreSettings({ ...settings });
    const pve = scoreValueHtml({value: 87.234, perfectOverall: false}, scoreSettings.aegisScorePrecision);
    const pvp = scoreValueHtml({value: 92.456, perfectOverall: false}, scoreSettings.aegisScorePrecision);
    badge.classList.remove('aegis-badge-s');
    badge.classList.add('aegis-score');
    if (settings.aegisMode === 'both') {
      badge.classList.add('aegis-badge-split');
      badge.innerHTML = `<span class="aegis-split-half aegis-split-left aegis-score">${pve}</span><span class="aegis-split-half aegis-split-right aegis-score">${pvp}</span>`;
    } else badge.innerHTML = settings.aegisMode === 'pvp' ? pvp : pve;
    const visibility = normalizeBadgeVisibility(settings.aegisBadgeVisibility).weapon;
    applyBadgePresentation(badge, visibility);
    badge.classList.toggle('aegis-badge-hidden', visibility === 'off');
    applyGradeGlow(tile, '');
    return;
  }

  const label = document.createElement('span');
  label.className = 'aegis-grade-text';
  const symbol = rollBadgeSymbol({ isPerfect5of5: true, isOmniRoll: true }, settings.aegisShowPerfectStar, settings.aegisShowOmniStar);
  badge.classList.toggle('aegis-has-roll-star', !!symbol);
  label.textContent = symbol ? `${symbol} ${gradeStr}` : gradeStr;
  badge.append(label);

  if (settings.aegisUpgradeStyle && settings.aegisUpgradeStyle !== 'none') {
    const icon = document.createElement('span');
    icon.className = `aegis-badge-upgrade-arrow aegis-upgrade-${settings.aegisUpgradeStyle}`;
    icon.textContent = '▲';
    badge.append(icon);
  }

  applyGradeColors(badge);
  const visibility = normalizeBadgeVisibility(settings.aegisBadgeVisibility).weapon;
  applyBadgePresentation(badge, visibility);
  badge.classList.toggle('aegis-badge-hidden', visibility === 'off');

  applyGradeGlow(tile, visibility === 'off' ? '' : gradeStr);

  // Update corner targets active highlight
  tile.querySelectorAll<HTMLElement>('.corner-target').forEach(target => {
    target.classList.toggle('active-corner', target.dataset.pos === posVal);
  });
}

export function updateOptionsPreview(value: PreviewSettings) {
  settings = value;
  renderOptionsPreview();
}

