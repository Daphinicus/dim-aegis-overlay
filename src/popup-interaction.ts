// DIM uses this stable class on the positioned root. Its generated ItemPopup
// classes also occur on headers and action rails, which are not popup roots.
const popupSelector = '.item-popup';
const tileSelector = '.item, .item-tile, [id^="item-"], [class*="StoreItem"], [class*="InventoryItem"], [class*="ItemTile"]';
let enabled = false;
let clickedTile: HTMLElement | null = null;
let openingUntil = 0;
const popupAnchors = new WeakMap<HTMLElement, HTMLElement | null>();
export function isTileTooltipSuppressed(): boolean {
  return enabled && (Date.now() < openingUntil || !!document.querySelector(popupSelector));
}

export function initPopupInteraction(dismissTooltip: () => void) {
  enabled = true;
  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const tile = target.closest<HTMLElement>(tileSelector);
    if (!tile || tile.closest(popupSelector)) return;
    clickedTile = tile;
    // Cover the interval before DIM mounts its popup without leaving a failed
    // or modified click permanently suppressing hover.
    openingUntil = Date.now() + 500;
    dismissTooltip();
  }, true);
  let repositionFrame = 0;
  const schedulePosition = () => {
    if (repositionFrame) return;
    repositionFrame = requestAnimationFrame(() => {
      repositionFrame = 0;
      document.dispatchEvent(new Event('aegis-overview-resize'));
    });
  };
  const geometryObserver = new MutationObserver(schedulePosition);
  const sizes = new ResizeObserver(schedulePosition);
  const observed = new Set<HTMLElement>();
  const observer = new MutationObserver(() => {
    const popups = document.querySelectorAll<HTMLElement>(popupSelector);
    for (const popup of popups) {
      if (!popupAnchors.has(popup)) popupAnchors.set(popup, clickedTile);
      if (!observed.has(popup)) {
        observed.add(popup);
        if (!popup.hasAttribute('data-aegis-native-popup-layout')) {
          geometryObserver.observe(popup, { attributes: true, attributeFilter: ['style', 'data-popper-placement'] });
          sizes.observe(popup);
        }
      }
    }
    if ([...observed].some(popup => !popup.isConnected)) {
      geometryObserver.disconnect();
      for (const popup of observed) {
        if (!popup.isConnected) { sizes.unobserve(popup); observed.delete(popup); }
        else if (!popup.hasAttribute('data-aegis-native-popup-layout')) geometryObserver.observe(popup, { attributes: true, attributeFilter: ['style', 'data-popper-placement'] });
      }
    }
    if (popups.length) dismissTooltip();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', () => {
    document.dispatchEvent(new Event('aegis-overview-resize'));
  });
}

/** Consume native placement; never reposition DIM from the card renderer. */
export function getPopupSidebarSide(popup: HTMLElement, panelWidth: number, allowSidebar = true): 'left' | 'right' | null {
  const width = allowSidebar ? String(panelWidth) : '0';
  if (popup.dataset.aegisPopupPanelWidth !== width) popup.dataset.aegisPopupPanelWidth = width;
  if (!allowSidebar) return null;
  if (popup.hasAttribute('data-aegis-native-popup-layout')) {
    const side = popup.dataset.aegisNativePopupSide;
    return side === 'left' || side === 'right' ? side : null;
  }
  // If DIM changes its module contract, retain its placement and use inline
  // content whenever a sidebar would not fit. Do not restore post-paint flips.
  if (!popupAnchors.has(popup)) popupAnchors.set(popup, clickedTile);
  const tile = popupAnchors.get(popup);
  if (!tile?.isConnected) return null;
  const anchor = tile.getBoundingClientRect();
  const rect = popup.getBoundingClientRect();
  const side = anchor.left + anchor.width / 2 < rect.left + rect.width / 2 ? 'right' : 'left';
  const left = side === 'right' ? rect.right + 12 : rect.left - 12 - panelWidth;
  const right = left + panelWidth;
  return left >= 8 && right <= document.documentElement.clientWidth - 8 &&
    (right <= anchor.left || left >= anchor.right) ? side : null;
}
