export type BadgeCategory = 'armor' | 'exotic' | 'weapon';
export type BadgeVisibility = 'grade' | 'color' | 'off';
export type BadgeVisibilitySettings = Record<BadgeCategory, BadgeVisibility>;

export interface BadgeRollQuality {
  isPerfect5of5?: boolean;
  isOmniRoll?: boolean;
}

export function rollBadgeSymbol(roll: BadgeRollQuality | undefined, showPerfect = true, showOmni = true): string {
  if (showOmni && roll?.isOmniRoll) return '✦';
  if (showPerfect && roll?.isPerfect5of5) return '★';
  return '';
}

export function normalizeBadgeVisibility(value: unknown): BadgeVisibilitySettings {
  const input = value as Partial<BadgeVisibilitySettings> | null;
  const mode = (category: BadgeCategory): BadgeVisibility =>
    input?.[category] === 'color' || input?.[category] === 'off' ? input[category]! : 'grade';
  return { armor: mode('armor'), exotic: mode('exotic'), weapon: mode('weapon') };
}

export function normalizeBadgeSize(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(150, Math.max(70, value)) : 100;
}

export function badgeCategory(element: HTMLElement): BadgeCategory {
  if (element.dataset.aegisItemType === 'armor') return 'armor';
  const exotic = element.dataset.aegisItemExotic;
  if (exotic !== undefined) return exotic === 'true' ? 'exotic' : 'weapon';
  const icon = element.matches('.item-img') ? element : element.querySelector('.item-img');
  return icon && [...icon.classList].some(name => /(?:^|_)exotic(?:-|$)/.test(name)) ? 'exotic' : 'weapon';
}

export function applyBadgePresentation(badge: HTMLElement, mode: BadgeVisibility) {
  badge.classList.toggle('aegis-color-only', mode === 'color');
  badge.setAttribute('aria-label', badge.textContent || '');
}
