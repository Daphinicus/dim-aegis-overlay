import { Grade, GradeSettings, defaultGradeSettings, gradeValue } from './grading';

let settings = defaultGradeSettings();
const originals = new WeakMap<HTMLElement, [string, string, string][]>();
const colorProperties = ['background', 'color', 'text-shadow', 'box-shadow'];
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

export function contrastText(hex: string): string {
  const rgb = hex.slice(1).match(/../g)!.map(x => parseInt(x, 16) / 255)
    .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? '#000000' : '#ffffff';
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
    badge.style.setProperty('color', contrastText(color), 'important');
    badge.style.setProperty('text-shadow', 'none', 'important');
    badge.style.setProperty('box-shadow', 'none', 'important');
  }
}

export function applyGradeGlow(target: HTMLElement, grade: string) {
  const color = settings.colorsEnabled && settings.colors[displayGrade(grade) as Grade];
  if (color) target.style.setProperty('--aegis-glow-color', color);
  else target.style.removeProperty('--aegis-glow-color');
}
