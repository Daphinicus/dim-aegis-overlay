import { normalizeBadgeSize } from './badge-presentation';

const styleId = 'aegis-inventory-badge-scale';
const inventoryScope = ':where(.item > .aegis-badge *)';
const variableShadow = '0 calc(1 * var(--aegis-badge-px, 1px)) calc(2 * var(--aegis-badge-px, 1px)) rgba(0, 0, 0, 0.8)';
let size: number | undefined;
let key = '';
let scaledShadow = '';

/** Resolve shared split-label lengths once per settings change, not per tile. */
export function inventoryBadgeScaleCss(sizePercent: number, textPercent: number): string {
  const unit = normalizeBadgeSize(sizePercent) / 100;
  const text = Number.isFinite(textPercent) ? textPercent / 100 : 1;
  const px = (multiple: number) => `calc(${multiple} * ${unit}px)`;
  const half = `.aegis-split-half${inventoryScope}`;
  // Retain the original class specificity and rule order. The type selector wins
  // against extension-injected rules without overriding more specific modes.
  // Color-only exceptions must follow the equally specific footer/star rules.
  return `
html ${half} {
  padding: 0 ${px(4.5)} !important;
  text-shadow: 0 ${px(1)} ${px(2)} rgba(0, 0, 0, 0.9) !important;
  letter-spacing: ${px(-.3)} !important;
}
html .aegis-split-half.aegis-split-right${inventoryScope} {
  border-left: ${px(1)} solid rgba(0, 0, 0, 0.35) !important;
}
html .aegis-badge-split .aegis-split-half.aegis-split-transition${inventoryScope} {
  font-size: calc(8.5 * ${unit}px * ${text}) !important;
  padding: 0 ${px(2.5)} !important;
  letter-spacing: ${px(-.4)} !important;
}
html .aegis-badge-split.aegis-has-roll-star ${half} {
  padding: ${px(1)} ${px(2)} !important;
}
html .aegis-badge.aegis-style-footer ${half} {
  padding: ${px(1)} 0 !important;
}
html .aegis-badge.aegis-color-only ${half} {
  padding: 0 !important;
  border: 0 !important;
}
html .aegis-badge.aegis-color-only .aegis-split-label${inventoryScope} {
  font-size: 0 !important;
}`;
}

/** Return whether existing colored inventory badges need new inline shadows. */
export function setInventoryBadgeScale(sizePercent: unknown, textPercent: unknown): boolean {
  const nextSize = normalizeBadgeSize(sizePercent);
  const nextText = typeof textPercent === 'number' && Number.isFinite(textPercent) ? textPercent : 100;
  const nextKey = `${nextSize}:${nextText}`;
  const sizeChanged = size !== nextSize;
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (nextKey === key && style?.isConnected) return false;
  if (!style) {
    style = document.createElement('style'); style.id = styleId;
    (document.head || document.documentElement).appendChild(style);
  }
  style.textContent = inventoryBadgeScaleCss(nextSize, nextText);
  const unit = nextSize / 100;
  scaledShadow = `0 calc(1 * ${unit}px) calc(2 * ${unit}px) rgba(0, 0, 0, 0.8)`;
  size = nextSize; key = nextKey;
  const root = document.documentElement.style;
  if (root.getPropertyValue('--aegis-badge-size') !== String(unit)) root.setProperty('--aegis-badge-size', String(unit));
  if (root.getPropertyValue('--aegis-badge-scale') !== String(nextText / 100)) root.setProperty('--aegis-badge-scale', String(nextText / 100));
  return sizeChanged;
}

export function inventoryBadgeTextShadow(node: HTMLElement): string {
  // Options previews and reading surfaces retain their original local units.
  // Before initialization, preserve the existing stylesheet fallback as well.
  return size !== undefined && node.closest('.item > .aegis-badge') ? scaledShadow : variableShadow;
}
