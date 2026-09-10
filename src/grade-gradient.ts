type Triple = [number, number, number];

const encode = (value: number) => value <= .0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - .055;
const toHex = (values: number[]) => '#' + values.map(value => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0')).join('');

// OKLab conversions: https://bottosson.github.io/posts/oklab/ (public domain).
function toLab(color: string): Triple {
  const [r, g, b] = color.slice(1).match(/../g)!.map(channel => parseInt(channel, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}

function toLinearRgb([L, a, b]: Triple): Triple {
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3;
  const m = (L - .1055613458 * a - .0638541728 * b) ** 3;
  const s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
}

const toLch = ([L, a, b]: Triple): Triple => [L, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360];
const fromLch = ([L, C, h]: Triple): Triple => [L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)];
const inGamut = (values: number[]) => values.every(value => value >= -1e-7 && value <= 1 + 1e-7);

function fitGamut([L, C, h]: Triple): string {
  const candidate = toLinearRgb(fromLch([L, C, h]));
  if (inGamut(candidate)) return toHex(candidate.map(encode));
  let low = 0, high = C;
  // Reduce chroma while preserving the selected lightness and hue.
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (inGamut(toLinearRgb(fromLch([L, mid, h])))) low = mid;
    else high = mid;
  }
  return toHex(toLinearRgb(fromLch([L, low, h])).map(encode));
}

const references = [
  ['#ffd700', '#ff8c00'], ['#da70d6', '#8a2be2'], ['#00f2fe', '#4facfe'],
  ['#bdc3c7', '#2c3e50'], ['#e67e22', '#d35400'], ['#7f8c8d', '#5a5a5a'], ['#e74c3c', '#c0392b'],
  ['#ffff00', '#ffa800'], ['#00ff00', '#00b86b'], ['#0000ff', '#2420b8'], ['#386bff', '#0054d6'],
].map(([base, end]) => {
  const position = toLab(base), source = toLch(position), target = toLch(toLab(end));
  return { position, radiusSquared: Math.min(.12, source[1] * 2) ** 2,
    lightness: target[0] / source[0], chroma: target[1] / source[1],
    shift: target[1] < 1e-6 ? 0 : ((target[2] - source[2] + 540) % 360) - 180 };
});

export function gradeGradientEnd(color: string): string {
  const position = toLab(color), [L, C, h] = toLch(position);
  let total = 1, lightness = .83, chroma = 1, shift = 0;
  let depthTotal = 1, depth = .83;
  // Near-gray references have a smaller reach so their strong chroma ratios do not saturate pastels.
  for (const reference of references) {
    const distance = position.reduce((sum, value, i) => sum + (value - reference.position[i]) ** 2, 0);
    const weight = (reference.radiusSquared / Math.max(distance, 1e-12)) ** 1.5;
    total += weight;
    lightness += weight * reference.lightness;
    chroma += weight * reference.chroma;
    shift += weight * reference.shift;
    const depthWeight = (.12 ** 2 / Math.max(distance, 1e-12)) ** 1.5;
    depthTotal += depthWeight;
    depth += depthWeight * reference.lightness;
  }
  const neutralFade = Math.min(1, C / .005);
  const depthRatio = depth / depthTotal;
  // Share the stronger darkening broadly, scaling chroma with it to keep pastels subdued.
  return fitGamut([L * depthRatio, C * (1 + (chroma / total - 1) * neutralFade) * depthRatio / (lightness / total), h + shift / total * neutralFade]);
}
