import { Grade, GradeSettings, defaultGradeSettings, gradeValue } from './grading';
import { gradeGradientEnd } from './grade-gradient';

export const defaultGradeColors: Record<Grade, string> = { 'S+': '#ffd700', S: '#ffd700', 'A+': '#da70d6', A: '#da70d6', 'B+': '#00f2fe', B: '#00f2fe', C: '#bdc3c7', D: '#e67e22', E: '#7f8c8d', F: '#e74c3c' };

let settings = defaultGradeSettings();
let twoTierColors = false;
let maxTierGlow = false;
const originals = new WeakMap<HTMLElement, [string, string, string][]>();
const colorProperties = ['background', 'color', 'text-shadow'];
const badgeSelector = '.aegis-badge, .aegis-split-half, .aegis-title-badge, .aegis-popup-grade-badge, .aegis-tooltip-grade, .aegis-shopping-item-badge, [data-aegis-grade]';

export function setGradeColors(value: GradeSettings) { settings = value; }
export function setTwoTierColors(enabled: boolean) { twoTierColors = enabled; }
export function setMaxTierGlow(enabled: boolean) { maxTierGlow = enabled; }

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

const gradientCache = new Map<string, string>();

export function gradeGradient(color: string): string {
  color = color.toLowerCase();
  const cached = gradientCache.get(color);
  if (cached) return cached;
  const gradient = `linear-gradient(135deg, ${color}, ${gradeGradientEnd(color)})`;
  if (gradientCache.size >= 128) gradientCache.clear();
  gradientCache.set(color, gradient);
  return gradient;
}

export function twoTierGrades(text: string): [Grade, Grade] | null {
  if (/[|/]/.test(text)) return null;
  const parts = text.replace(/[★✦▲]/g, '').trim().toUpperCase().split(/[➔→]/);
  const pair = parts[0].trim().match(/^([SABCDEF][+-]?)([SABCDEF][+-]?)$/);
  const perk = displayGrade(parts[parts.length - 1]) as Grade;
  if (!pair || !defaultGradeColors[pair[1] as Grade] || !defaultGradeColors[perk]) return null;
  return [pair[1] as Grade, perk];
}

export function twoTierGradient(text: string, palette = settings): string | null {
  const pair = twoTierGrades(text);
  if (!pair) return null;
  const color = (grade: Grade) => (palette.colorsEnabled && palette.colors[grade] || defaultGradeColors[grade]).toLowerCase();
  const weaponColor = color(pair[0]), perkColor = color(pair[1]);
  if (weaponColor === perkColor) return gradeGradient(perkColor);
  return `linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.18)), linear-gradient(90deg, ${weaponColor}, ${perkColor})`;
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
    const text = badge.dataset.aegisGrade || badge.textContent || '';
    const gradient = twoTierColors ? twoTierGradient(text, palette) : null;
    const grade = badge.dataset.aegisGrade || displayGrade(text);
    const color = palette.colorsEnabled && palette.colors[grade as Grade];
    if (!gradient && !color) continue;
    originals.set(badge, colorProperties.map(property => [property, badge.style.getPropertyValue(property), badge.style.getPropertyPriority(property)]));
    badge.style.setProperty('background', gradient || gradeGradient(color as string), 'important');
    badge.style.setProperty('color', '#ffffff', 'important');
    badge.style.setProperty('text-shadow', '0 1px 2px rgba(0, 0, 0, 0.8)', 'important');
  }
}

export function hasMaxTierGrade(text: string): boolean {
  return text.split('|').some(part => {
    const pair = twoTierGrades(part);
    return !!pair && (pair[0] === 'S' || pair[0] === 'S+') && pair[1] === 'S+';
  });
}

export function applyGradeGlow(target: HTMLElement, grade: string) {
  target.classList.toggle('aegis-gold-glow', maxTierGlow ? hasMaxTierGrade(grade) : grade.replace(/[★✦▲]/g, '').trim().startsWith('S'));
  const color = settings.colorsEnabled && settings.colors[displayGrade(grade) as Grade];
  if (color) target.style.setProperty('--aegis-glow-color', color);
  else target.style.removeProperty('--aegis-glow-color');
}
