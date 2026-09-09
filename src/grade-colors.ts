import { Grade, GradeSettings, defaultGradeSettings, gradeValue } from './grading';
import { hexToHsv, hsvToHex } from './color-picker';

let settings = defaultGradeSettings();
const originals = new WeakMap<HTMLElement, [string, string, string][]>();
const colorProperties = ['background', 'color', 'text-shadow'];
const badgeSelector = '.aegis-badge, .aegis-split-half, .aegis-title-badge, .aegis-popup-grade-badge, .aegis-tooltip-grade, .aegis-shopping-item-badge, [data-aegis-grade]';

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

export function gradeGradient(color: string): string {
  const [h, s, v] = hexToHsv(color);
  const samples = gradientSamples.map(([base, end]) => {
    const angle = (h - base[0]) * Math.PI / 180;
    const distance = s * s + base[1] * base[1] - 2 * s * base[1] * Math.cos(angle);
    return { base, end, weight: 1 / Math.max(distance, .000001) ** 2 };
  });
  const total = samples.reduce((sum, sample) => sum + sample.weight, 0);
  let hue = h, saturation = s, value = 0;
  for (const { base, end, weight } of samples) {
    const share = weight / total;
    hue += (((end[0] - base[0] + 540) % 360) - 180) * share;
    saturation += (end[1] - base[1]) * Math.min(1, s / base[1]) * share;
    value += v * end[2] / base[2] * share;
  }
  const darker = hsvToHex([(hue + 360) % 360, Math.max(0, Math.min(100, saturation)), Math.min(100, value)]);
  return `linear-gradient(135deg, ${color}, ${darker})`;
}

const gradientSamples = [
  ['#ffd700', '#ff8c00'], ['#da70d6', '#8a2be2'], ['#00f2fe', '#4facfe'],
  ['#bdc3c7', '#2c3e50'], ['#e67e22', '#d35400'], ['#e74c3c', '#c0392b'],
].map(pair => pair.map(color => hexToHsv(color)));

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
    const grade = badge.dataset.aegisGrade || displayGrade(badge.textContent || '');
    const color = palette.colorsEnabled && palette.colors[grade as Grade];
    if (!color) continue;
    originals.set(badge, colorProperties.map(property => [property, badge.style.getPropertyValue(property), badge.style.getPropertyPriority(property)]));
    badge.style.setProperty('background', gradeGradient(color), 'important');
    badge.style.setProperty('color', '#ffffff', 'important');
    badge.style.setProperty('text-shadow', '0 1px 2px rgba(0, 0, 0, 0.8)', 'important');
  }
}

export function applyGradeGlow(target: HTMLElement, grade: string) {
  const color = settings.colorsEnabled && settings.colors[displayGrade(grade) as Grade];
  if (color) target.style.setProperty('--aegis-glow-color', color);
  else target.style.removeProperty('--aegis-glow-color');
}
