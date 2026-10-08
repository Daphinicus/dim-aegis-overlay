import { STAT_BAR_SELECTOR, INVENTORY_BADGE_SELECTOR } from './stat-grade';
import { COMPARE_BUCKET_SELECTOR } from './compare-selectors';
import type { DimSearchInput } from './dim-item-input';
import type { BadgeCategory } from './badge-presentation';
import type { ScoringResult, WeaponEvaluationPayload } from './types';

interface InventoryBadge {
  kind: DimSearchInput['kind'];
  presentation?: Pick<WeaponEvaluationPayload, 'sheetArmor' | 'scoreEvaluations'> & { kind: DimSearchInput['kind'] };
  category: BadgeCategory;
  result: ScoringResult;
  signature: string;
}

/** Attach current cached grades before replacement inventory tiles first paint. */
export function createInventoryBadges(render: (tile: HTMLElement, badge: InventoryBadge) => void) {
  const selector = '.item-drag-container > .item[id]';
  let current = new Map<string, InventoryBadge>(), next = new Map<string, InventoryBadge>();
  let ready = false, disposed = false;
  const rendered = new WeakMap<HTMLElement, { badge: InventoryBadge; visible: boolean; bar: Element | null }>();

  function restore(tile: HTMLElement) {
    if (!ready || !tile.isConnected || !tile.matches(selector)) return;
    const badge = current.get(tile.id);
    // Other DIM pages can display the same item. Only restore native inventory
    // drag tiles, never Compare's simulated rolls or popup/picker previews.
    if (!badge || tile.closest('[role="dialog"], .item-popup') || tile.closest(COMPARE_BUCKET_SELECTOR)
      || !tile.closest('[role="main"]')?.querySelector(':scope > .store-row')) return;
    const saved = rendered.get(tile), visible = !!tile.querySelector(INVENTORY_BADGE_SELECTOR);
    const bar = tile.querySelector(STAT_BAR_SELECTOR);
    if (saved?.badge === badge && saved.visible === visible && saved.bar === bar) return;
    render(tile, badge);
    rendered.set(tile, { badge, bar, visible: !!tile.querySelector(INVENTORY_BADGE_SELECTOR) });
  }
  function collect(node: Node, tiles: Set<HTMLElement>) {
    if (!(node instanceof HTMLElement)) return;
    if (node.matches(selector)) tiles.add(node);
    node.querySelectorAll<HTMLElement>(selector).forEach(tile => tiles.add(tile));
  }
  const observer = new MutationObserver(records => {
    if (!ready) return;
    const tiles = new Set<HTMLElement>();
    for (const record of records) {
      if (record.type === 'attributes') tiles.add(record.target as HTMLElement);
      else {
        record.addedNodes.forEach(node => collect(node, tiles));
        // React can replace tile children while keeping the item element.
        if (record.target instanceof HTMLElement && record.target.matches(selector)) {
          tiles.add(record.target);
        } else if (record.removedNodes.length && record.target instanceof HTMLElement && record.target.hasAttribute("data-aegis-stat-bar")) {
          const tile = record.target.closest<HTMLElement>(selector);
          if (tile) tiles.add(tile);
        }
      }
    }
    // Mutation delivery precedes paint. Do only badge attachment here; full
    // annotations, tooltip data, and inventory bookkeeping retain their queues.
    tiles.forEach(restore);
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['id'] });
  function dispose() {
    disposed = true; ready = false;
    observer.disconnect(); current.clear(); next.clear();
    window.removeEventListener('pagehide', leave);
  }
  const leave = (event: PageTransitionEvent) => { if (!event.persisted) dispose(); };
  window.addEventListener('pagehide', leave);
  return {
    add(item: DimSearchInput, result: ScoringResult, data?: WeaponEvaluationPayload) {
      if (disposed) return;
      const category = item.kind === 'armor' ? 'armor' : item.isExotic ? 'exotic' : 'weapon';
      const presentation = data ? { kind: item.kind, sheetArmor: data.sheetArmor, scoreEvaluations: data.scoreEvaluations } : { kind: item.kind };
      const signature = JSON.stringify([presentation, item.hash, category, result.grade, result.weaponGrade, result.isOmniRoll,
        result.isPerfect5of5, result.upgradeAvailable, result.pveRollQuality, result.pvpRollQuality, result.customGrading]);
      const index = item.index || item.id;
      const previous = current.get(index);
      next.set(index, previous?.signature === signature ? previous : { kind: item.kind, presentation, category, result: { ...result }, signature });
    },
    status(status: 'pending' | 'ready' | 'unavailable') {
      if (disposed) return;
      ready = status === 'ready';
      if (ready) {
        current = next; next = new Map();
        document.querySelectorAll<HTMLElement>(selector).forEach(restore);
      } else {
        next.clear();
        if (status === 'unavailable') current.clear();
      }
    },
    dispose,
  };
}
