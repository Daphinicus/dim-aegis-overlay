import { applyGradeColors, applyGradeGlow, displayGrade, setMaxTierGlow } from './grade-colors';
import { t } from './i18n';
import type { PreviewItem } from './preview-items';

interface PreviewSettings {
  aegisBadgeStyle?: string;
  aegisBadgePosition?: string;
  aegisUpgradeStyle?: string;
  aegisMode?: string;
  aegisTwoTier?: boolean;
  aegisGradeDisplayMode?: string;
  aegisMaxTierGlow?: boolean;
}

let items: PreviewItem[] = [];
let settings: PreviewSettings = {};
let timer: ReturnType<typeof setTimeout>;
let revision = 0;
let tabId: number | undefined;

function examples(): PreviewItem[] {
  return [['S', 'S+', 'A', 'A'], ['B', 'A', 'S', 'B+'], ['F', 'D', 'C', 'C']].map(([weapon, perk, pvpWeapon, pvpPerk], index) => {
    const part = (tier: string, roll: string) => `${settings.aegisTwoTier ? tier : ''}${index === 1 && settings.aegisGradeDisplayMode === 'potential' ? 'S+' : roll}${index === 1 && settings.aegisGradeDisplayMode === 'dual' ? '➔S+' : ''}`;
    return { id: `example-${index}`, name: t('exampleWeapon'), icon: 'weapon-mockup.png', power: '550',
      grade: settings.aegisMode === 'both' ? `${part(weapon, perk)} | ${part(pvpWeapon, pvpPerk)}`
        : settings.aegisMode === 'pvp' ? part(pvpWeapon, pvpPerk) : part(weapon, perk), upgradeAvailable: index === 1 };
  });
}

export function renderOptionsPreview() {
  const samples = items.length ? items : examples();
  setMaxTierGlow(settings.aegisMaxTierGlow === true);
  document.querySelectorAll<HTMLElement>('.options-preview .interactive-weapon-tile').forEach((tile, index) => {
    const item = samples[index];
    tile.hidden = !item;
    if (!item) return;
    tile.classList.toggle('preview-inventory-item', items.length > 0);
    tile.title = item.name;
    const image = tile.querySelector<HTMLImageElement>('.mock-weapon-img')!;
    delete image.dataset.i18nAlt;
    image.src = item.icon;
    image.alt = item.name;
    tile.querySelector('.options-preview-power')!.textContent = item.power;
    const badge = tile.querySelector<HTMLElement>('.aegis-badge')!;
    const style = settings.aegisBadgeStyle || 'classic';
    const position = ({ 'top-left': 'tl', 'top-right': 'tr', 'bottom-left': 'bl', 'bottom-right': 'br' } as Record<string, string>)[settings.aegisBadgePosition || 'bottom-left'];
    badge.className = `aegis-badge aegis-badge-${displayGrade(item.grade)[0]?.toLowerCase() || 'none'} aegis-style-${style} aegis-pos-${position}`;
    badge.replaceChildren();
    const parts = item.grade.split('|').map(part => part.trim());
    const split = parts.length > 1;
    const dual = !split && /[➔→]/.test(item.grade);
    const twoTier = !split && (item.grade.length > 2 || (item.grade.length === 2 && !/[+-]$/.test(item.grade)));
    if (!split && (twoTier || dual || item.isOmniRoll || item.isPerfect5of5)) badge.classList.add('aegis-badge-wide');
    const inner = split ? document.createElement('div') : badge;
    if (split) {
      badge.classList.add('aegis-badge-split');
      inner.className = 'aegis-split-inner';
      badge.append(inner);
    } else if (dual) badge.classList.add('aegis-badge-dual');
    if (!split && item.isOmniRoll) badge.classList.add('aegis-badge-omni');
    else if (!split && item.isPerfect5of5 && !dual) badge.classList.add('aegis-badge-perfect');
    parts.forEach((part, index) => {
      const label = split ? document.createElement('span') : badge;
      if (label !== badge) {
        label.className = `aegis-split-half aegis-split-${index ? 'right' : 'left'} aegis-badge-${displayGrade(part)[0]?.toLowerCase() || 'none'}`;
        if (/[➔→]/.test(part)) label.classList.add('aegis-split-transition');
        inner.append(label);
      }
      const prefix = !split && style === 'classic' ? item.isOmniRoll ? '✦ ' : item.isPerfect5of5 && !dual ? '★ ' : '' : '';
      label.textContent = prefix + part;
      if (style === 'footer' || style === 'notch') {
        const text = document.createElement('span');
        text.className = 'aegis-grade-text';
        text.textContent = label.textContent;
        label.replaceChildren(text);
      }
    });
    if (item.upgradeAvailable && settings.aegisUpgradeStyle !== 'none') {
      const icon = document.createElement('span');
      icon.className = `aegis-badge-upgrade-arrow aegis-upgrade-${settings.aegisUpgradeStyle || 'circle'}`;
      icon.textContent = '▲';
      badge.append(icon);
    }
    applyGradeColors(badge);
    applyGradeGlow(tile, item.grade);
  });
  const status = document.querySelector<HTMLElement>('.options-preview-status')!;
  status.dataset.i18n = items.length ? 'compactPreviewInventory' : 'compactPreviewExamples';
  status.textContent = t(status.dataset.i18n);
}

export function updateOptionsPreview(value: PreviewSettings) {
  settings = value;
  renderOptionsPreview();
  clearTimeout(timer);
  const request = ++revision;
  timer = setTimeout(async () => {
    try {
      const tabs = await chrome.tabs.query({ url: ['https://app.destinyitemmanager.com/*', 'https://beta.destinyitemmanager.com/*'] });
      tabs.sort((a, b) => Number(b.active) - Number(a.active) || (b.lastAccessed || 0) - (a.lastAccessed || 0));
      let response: PreviewItem[] = [];
      for (const tab of tabs) {
        if (tab.id === undefined) continue;
        try {
          const result = await chrome.tabs.sendMessage(tab.id, { action: 'getOptionsPreviewItems', ids: tab.id === tabId ? items.map(item => item.id) : [] });
          if (Array.isArray(result) && result.length) { response = result; tabId = tab.id; break; }
        } catch { /* DIM may still be loading its content script. */ }
      }
      if (request !== revision) return;
      items = response.slice(0, 3);
      renderOptionsPreview();
    } catch {
      if (request === revision) { items = []; renderOptionsPreview(); }
    }
  }, 80);
}
