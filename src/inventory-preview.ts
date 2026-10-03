/** The DOM protocol uses attributes and plain events across Firefox extension worlds. */
export function inventoryPreviewManaged(target: HTMLElement): boolean {
  return document.documentElement.getAttribute('data-dimsum-inventory-preview') === '1'
    && !!document.getElementById('dimsum-inventory-tooltip')
    && target.matches('.item') && !target.closest('.item-popup');
}

export interface InventoryPreviewLayout { widthMode: 'auto' | 'fixed'; width: number }

export function installInventoryPreview(options: {
  enabled: () => boolean;
  revision: (target: HTMLElement) => unknown;
  render: (target: HTMLElement, content: HTMLElement, layout: InventoryPreviewLayout) => boolean;
  dismiss: () => void;
}) {
  document.dispatchEvent(new Event('aegis-preview-dispose'));
  let alive = true;
  const cache = new Map<HTMLElement, { revision: unknown; layoutKey: string; sample: HTMLElement }>();
  const announce = () => {
    document.documentElement.setAttribute('data-aegis-preview-provider', '1');
    document.documentElement.setAttribute('data-aegis-preview-enabled', String(options.enabled()));
    document.dispatchEvent(new Event('aegis-preview-provider'));
  };
  function request(event: Event) {
    const target = event.target;
    if (!alive || !(target instanceof HTMLElement) || !inventoryPreviewManaged(target)) return;
    const root = document.getElementById('dimsum-inventory-tooltip');
    const host = document.getElementById('dimsum-inventory-aegis');
    if (!root || !host || root.dataset.version !== '1' || root.hidden) return;
    const token = target.getAttribute('data-dimsum-preview-request');
    if (!token || token !== root.dataset.request) return;
    options.dismiss();
    host.replaceChildren();
    const enabled = root.dataset.aegis === 'inherit' ? options.enabled() : root.dataset.aegis === 'true';
    const revision = options.revision(target);
    const requestedWidth = Number(root.dataset.width);
    const layout: InventoryPreviewLayout = {
      widthMode: root.dataset.widthMode === 'fixed' ? 'fixed' : 'auto',
      width: Number.isFinite(requestedWidth) ? Math.max(260, Math.min(640, requestedWidth)) : 320,
    };
    const layoutKey = `${layout.widthMode}:${layout.widthMode === 'fixed' ? layout.width : innerWidth}`;
    if (!enabled || !revision) {
      host.dataset.state = enabled ? 'unavailable' : 'disabled';
    } else {
      let entry = cache.get(target);
      if (!entry || entry.revision !== revision || entry.layoutKey !== layoutKey) {
        const sample = document.createElement('div'); sample.className = 'aegis-tooltip';
        if (options.render(target, sample, layout) && sample.childElementCount) {
          entry = { revision, layoutKey, sample }; cache.set(target, entry);
          if (cache.size > 24) cache.delete(cache.keys().next().value!);
        } else entry = undefined;
      } else { cache.delete(target); cache.set(target, entry); }
      if (!alive || !target.isConnected || token !== root.dataset.request) return;
      if (entry) {
        host.replaceChildren(...Array.from(entry.sample.childNodes, node => node.cloneNode(true)));
        host.dataset.width = entry.sample.dataset.width;
        host.dataset.state = 'ready';
      } else host.dataset.state = 'unavailable';
    }
    host.dispatchEvent(new Event('aegis-preview-content', { bubbles: true }));
  }
  function refresh(target?: HTMLElement) {
    if (!alive) return;
    if (target) cache.delete(target); else cache.clear();
    document.documentElement.setAttribute('data-aegis-preview-enabled', String(options.enabled()));
    if (!target || target.hasAttribute('data-dimsum-preview-request')) document.dispatchEvent(new Event('aegis-preview-update'));
  }
  function owner() { if (document.documentElement.getAttribute('data-dimsum-inventory-preview') === '1') options.dismiss(); }
  function dispose() {
    alive = false; cache.clear();
    document.removeEventListener('dimsum-preview-request', request);
    document.removeEventListener('dimsum-preview-owner', owner);
    document.removeEventListener('aegis-preview-dispose', dispose);
    document.documentElement.removeAttribute('data-aegis-preview-provider');
    document.documentElement.removeAttribute('data-aegis-preview-enabled');
    document.dispatchEvent(new Event('aegis-preview-provider'));
  }
  document.addEventListener('dimsum-preview-request', request);
  document.addEventListener('dimsum-preview-owner', owner);
  document.addEventListener('aegis-preview-dispose', dispose);
  announce(); owner();
  return { refresh, dispose };
}
