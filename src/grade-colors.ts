import { Grade, GradeSettings, defaultGradeSettings, gradeValue } from './grading';

let settings = defaultGradeSettings();
const originals = new WeakMap<HTMLElement, [string, string, string][]>();
const colorProperties = ['background', 'color', 'text-shadow'];
const badgeSelector = '.aegis-badge, .aegis-split-half, .aegis-title-badge, .aegis-popup-grade-badge, .aegis-tooltip-grade, .aegis-shopping-item-badge';

export function setGradeColors(value: GradeSettings) { settings = value; }

export function displayGrade(text: string): string {
  const clean = text.replace(/[★✦▲]/g, '').trim().toUpperCase();
  if (clean.includes('|') || clean.includes('/')) {
    return clean.split(/[|/]/).map(displayGrade).sort((a, b) => gradeValue(b) - gradeValue(a))[0] || '';
  }
  const last = clean.split(/[➔→]/).pop()!.trim();
  const match = last.match(/^(?:[SABCDEF][+-]?)?([SABCDEF][+-]?)$/);
  return match?.[1] || '';
}

export function rollGradeDisplay(text: string): string {
  return text.split(/[➔→]/).map(displayGrade).join('➔');
}

export function applyGradeColors(root: HTMLElement, palette = settings) {
  const badges = [...(root.matches(badgeSelector) ? [root] : []), ...root.querySelectorAll<HTMLElement>(badgeSelector)];
  for (const badge of badges) {
    if (originals.has(badge)) {
      for (const [property, value, priority] of originals.get(badge)!) {
        if (value) badge.style.setProperty(property, value, priority);
        else badge.style.removeProperty(property);
      }
      originals.delete(badge);
    }
    if (badge.querySelector('.aegis-split-half')) continue;
    const grade = displayGrade(badge.textContent || '');
    const color = palette.colorsEnabled && palette.colors[grade as Grade];
    if (!color) continue;
    originals.set(badge, colorProperties.map(property => [property, badge.style.getPropertyValue(property), badge.style.getPropertyPriority(property)]));
    badge.style.setProperty('background', color, 'important');
    badge.style.setProperty('color', '#ffffff', 'important');
    badge.style.setProperty('text-shadow', '0 1px 2px rgba(0, 0, 0, 0.8)', 'important');
  }
}

export function applyGradeGlow(target: HTMLElement, grade: string) {
  const color = settings.colorsEnabled && settings.colors[displayGrade(grade) as Grade];
  if (color) target.style.setProperty('--aegis-glow-color', color);
  else target.style.removeProperty('--aegis-glow-color');
}
