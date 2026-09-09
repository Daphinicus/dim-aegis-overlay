import { Grade, GradeSettings, defaultGradeSettings, gradeValue } from './grading';
import { hexToHsv, hsvToHex } from './color-picker';

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

function linearRgb(color: string) {
  return color.slice(1).match(/../g)!.map(channel => parseInt(channel, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
}

function luminance(color: string) {
  const [r, g, b] = linearRgb(color);
  return r * .2126 + g * .7152 + b * .0722;
}

const gradientCache = new Map<string, string>();

export function gradeGradient(color: string): string {
  const cached = gradientCache.get(color);
  if (cached) return cached;
  const [h, s, v] = hexToHsv(color);
  // Blend the original palette's hue, saturation and lightness changes by proximity to its base colors.
  const samples = gradientSamples.map(({ base, end, lightRatio }) => {
    const angle = (h - base[0]) * Math.PI / 180;
    const distance = s * s + base[1] * base[1] - 2 * s * base[1] * Math.cos(angle);
    return { base, end, lightRatio, weight: 1 / Math.max(distance, .000001) ** 2 };
  });
  const total = samples.reduce((sum, sample) => sum + sample.weight, 0);
  let hue = h, saturation = s, value = 0, lightRatio = 0;
  for (const sample of samples) {
    const { base, end, weight } = sample;
    const share = weight / total;
    hue += (((end[0] - base[0] + 540) % 360) - 180) * share;
    saturation += (end[1] - base[1]) * Math.min(1, s / base[1]) * share;
    value += v * end[2] / base[2] * share;
    lightRatio += sample.lightRatio * share;
  }
  const shade = hsvToHex([(hue + 360) % 360, Math.max(0, Math.min(100, saturation)), Math.min(100, value)]);
  const scale = luminance(shade) ? luminance(color) * lightRatio / luminance(shade) : 0;
  const darker = '#' + linearRgb(shade).map(channel => {
    const value = Math.min(1, channel * scale);
    return Math.round(255 * (value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055)).toString(16).padStart(2, '0');
  }).join('');
  const gradient = `linear-gradient(135deg, ${color}, ${darker})`;
  if (gradientCache.size >= 128) gradientCache.clear();
  gradientCache.set(color, gradient);
  return gradient;
}

const gradientSamples = [
  ['#ffd700', '#ff8c00'], ['#da70d6', '#8a2be2'], ['#00f2fe', '#4facfe'],
  ['#bdc3c7', '#2c3e50'], ['#e67e22', '#d35400'], ['#7f8c8d', '#5a5a5a'], ['#e74c3c', '#c0392b'],
].map(([base, end]) => ({ base: hexToHsv(base), end: hexToHsv(end), lightRatio: luminance(end) / luminance(base) }));

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
