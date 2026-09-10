export interface PreviewAppearance {
  html: string;
  width: number;
  height: number;
}

const tags = new Set(['div', 'span', 'img', 'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polygon', 'polyline', 'text']);
const attributes = ['viewBox', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform'];
const properties = ['display', 'position', 'top', 'right', 'bottom', 'left', 'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
  'box-sizing', 'margin', 'padding', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius', 'background', 'background-size', 'background-position', 'background-repeat',
  'color', 'opacity', 'visibility', 'content-visibility', 'overflow', 'z-index', 'box-shadow', 'filter', 'transform', 'transform-origin',
  'clip-path', 'mask-image', 'mask-size', 'mask-position', 'mask-repeat',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-shadow', 'white-space',
  'vertical-align', 'flex', 'flex-direction', 'align-items', 'justify-content', 'gap', 'object-fit', 'object-position',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'text-anchor'];

function copyStyle(target: HTMLElement | SVGElement, style: CSSStyleDeclaration) {
  for (const property of properties) {
    if (target instanceof SVGElement && target.localName !== 'svg' && !/^(fill|stroke|opacity|visibility|display|transform|font|text-anchor)/.test(property)) continue;
    target.style.setProperty(property, style.getPropertyValue(property));
  }
}

function copyLayer(source: Element): Element | undefined {
  if (!tags.has(source.localName) || [...source.classList].some(name => name.startsWith('aegis-'))) return;
  const style = getComputedStyle(source);
  if (style.display === 'none' || style.visibility === 'hidden' || style.contentVisibility === 'hidden') return;
  const target = document.createElementNS(source.namespaceURI, source.localName) as HTMLElement | SVGElement;
  copyStyle(target, style);
  if (source instanceof HTMLImageElement) {
    (target as HTMLImageElement).src = source.currentSrc || source.src;
    (target as HTMLImageElement).alt = '';
  }
  if (source instanceof SVGElement) {
    for (const attribute of attributes) if (source.hasAttribute(attribute)) target.setAttribute(attribute, source.getAttribute(attribute)!);
  }
  for (const node of source.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) target.append(document.createTextNode(node.textContent || ''));
    else if (node instanceof Element) {
      const child = copyLayer(node);
      if (child) target.append(child);
    }
  }
  if (source instanceof HTMLElement) for (const pseudo of ['::before', '::after']) {
    const decoration = getComputedStyle(source, pseudo);
    if (decoration.content !== '""') continue;
    const layer = document.createElement('div');
    copyStyle(layer, decoration);
    if (pseudo === '::before') target.prepend(layer); else target.append(layer);
  }
  return target;
}

export function capturePreviewAppearance(item: HTMLElement): PreviewAppearance | undefined {
  const art = item.querySelector<HTMLElement>('.item-img');
  if (!art) return;
  const bounds = art.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const power = item.querySelector<HTMLElement>('[class*="BadgeInfo_badge"]:not([class*="badgeContent"])');
  const height = Math.max(bounds.bottom, power?.getBoundingClientRect().bottom || 0) - bounds.top;
  const root = document.createElement('div');
  root.style.cssText = `position:relative;contain:layout paint style;width:${bounds.width}px;height:${height}px;pointer-events:none;`;
  for (const child of item.children) {
    const layer = copyLayer(child);
    if (layer) root.append(layer);
  }
  return { html: root.outerHTML, width: bounds.width, height };
}
