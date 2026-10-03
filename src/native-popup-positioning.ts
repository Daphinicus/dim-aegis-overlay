import { arrow, autoPlacement, computePosition, flip, offset, shift, type Padding, type Placement } from '@floating-ui/dom';

interface PopupOptions {
  contents: { current: HTMLElement | null };
  reference: { current: HTMLElement | null };
  arrowClassName?: string;
  menuClassName?: string;
  boundarySelector?: string;
  placement?: Placement | 'auto';
  offset?: number;
  fixed?: boolean;
  padding?: Padding;
}

/** Own the native placement transaction: prepare content, measure, then position. */
export function installNativePopupPositioning(options: PopupOptions, prepare: (popup: HTMLElement) => void) {
  const popup = options.contents.current;
  const reference = options.reference.current;
  if (!popup || !reference) return;
  const managed = popup.matches('.item-popup');
  let disposed = false;
  let revision = 0;
  let queued = false;
  let sizeKey = '';
  const dimensions = () => [popup.offsetWidth, popup.offsetHeight, reference.getBoundingClientRect().toJSON(),
    window.innerWidth, window.innerHeight, popup.dataset.aegisPopupPanelWidth].map(value => JSON.stringify(value)).join(':');
  const update = () => {
    queued = false;
    if (disposed || !popup.isConnected || !reference.isConnected) return;
    const request = ++revision;
    const strategy = options.fixed ? 'fixed' : 'absolute';
    // As in DIM's native hook, use a known origin before measuring. All work
    // through computePosition resolves in microtasks, before the next paint.
    Object.assign(popup.style, { position: strategy, left: '0px', top: '0px' });
    if (managed) {
      popup.dataset.aegisNativePopupLayout = 'preparing';
      popup.dataset.aegisNativePopupSide = 'right';
      prepare(popup);
      popup.dispatchEvent(new Event('aegis-popup-layout', { bubbles: true }));
      if (!popup.querySelector('[data-aegis-details="true"]') && popup.dataset.aegisPopupPanelWidth !== '0') {
        popup.dataset.aegisPopupPanelWidth = '0';
      }
    }
    const boundary = options.boundarySelector ? document.querySelector(options.boundarySelector) : null;
    const nativePadding = options.padding ?? {
      left: 10, right: 10, bottom: 10,
      top: (parseInt(document.documentElement.style.getPropertyValue('--header-height'), 10) || 0) + (boundary?.clientHeight || 0) + 5,
    };
    const padding = typeof nativePadding === 'number'
      ? { top: nativePadding, bottom: nativePadding, left: nativePadding, right: nativePadding }
      : { top: 0, bottom: 0, left: 0, right: 0, ...nativePadding };
    const panelWidth = managed ? Number(popup.dataset.aegisPopupPanelWidth) || 0 : 0;
    const anchor = reference.getBoundingClientRect();
    const width = popup.getBoundingClientRect().width;
    const gap = options.offset ?? (options.arrowClassName ? 8 : 0);
    const reserve = panelWidth ? panelWidth + 12 : 0;
    const fitsRight = reserve > 0 && anchor.right + gap + width + reserve <= document.documentElement.clientWidth - padding.right;
    const fitsLeft = reserve > 0 && anchor.left - gap - width - reserve >= padding.left;
    const side = fitsRight ? 'right' : fitsLeft ? 'left' : null;
    if (managed) {
      popup.dataset.aegisNativePopupSide = side || 'inline';
      popup.dataset.aegisNativePopupLayout = 'ready';
      // Inline changes height. Attach it before Floating UI measures its rects.
      popup.dispatchEvent(new Event('aegis-popup-layout', { bubbles: true }));
    }
    const resolvedPadding = side ? { ...padding, left: padding.left + reserve, right: padding.right + reserve } : padding;
    const tip = options.arrowClassName ? popup.querySelector<HTMLElement>(`.${options.arrowClassName}`) : null;
    const preferred = side || options.placement || 'auto';
    sizeKey = dimensions();
    void computePosition(reference, popup, {
      placement: preferred === 'auto' ? undefined : preferred,
      strategy,
      middleware: [offset(gap), preferred === 'auto' ? autoPlacement({ padding: resolvedPadding }) : flip({ padding: resolvedPadding }),
        shift({ padding: resolvedPadding }), tip ? arrow({ element: tip }) : null],
    }).then(result => {
      if (disposed || request !== revision || !popup.isConnected) return;
      Object.assign(popup.style, { position: strategy, left: `${result.x}px`, top: `${result.y}px` });
      popup.setAttribute('data-popper-placement', result.placement);
      if (tip && result.middlewareData.arrow) {
        const { x, y } = result.middlewareData.arrow;
        tip.style.left = x === undefined ? '' : `${x}px`;
        tip.style.top = y === undefined ? '' : `${y}px`;
        const menu = options.menuClassName ? popup.querySelector<HTMLElement>(`.${options.menuClassName}`) : null;
        if (menu && y !== undefined) menu.style.marginTop = `${Math.round(Math.max(0, Math.min(popup.offsetHeight - menu.offsetHeight, y + 5 - menu.offsetHeight / 2)))}px`;
      }
      if (managed) {
        if (side) popup.dataset.aegisNativePopupSide = result.placement.startsWith('left') ? 'left' : 'right';
        popup.dispatchEvent(new Event('aegis-popup-layout', { bubbles: true }));
      }
      sizeKey = dimensions();
    });
  };
  const schedule = () => {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(update);
  };
  const resize = new ResizeObserver(() => { if (dimensions() !== sizeKey) schedule(); });
  resize.observe(popup); resize.observe(reference);
  const attributes = new MutationObserver(() => { if (dimensions() !== sizeKey) schedule(); });
  attributes.observe(popup, { attributes: true, attributeFilter: ['data-aegis-popup-panel-width'] });
  window.addEventListener('resize', schedule);
  update();
  return () => {
    disposed = true; revision++;
    resize.disconnect(); attributes.disconnect(); window.removeEventListener('resize', schedule);
  };
}

/** Adapt only DIM's usePopper module, before its exports are consumed by React. */
export function interceptDimPopupModules(host: Record<string, any>, prepare: (popup: HTMLElement) => void) {
  const wrappedFactories = new WeakSet<Function>();
  const instrument = (chunk: any) => {
    const factories = chunk?.[1];
    if (!factories || typeof factories !== 'object') return;
    for (const [id, factory] of Object.entries(factories)) {
      if (typeof factory !== 'function' || wrappedFactories.has(factory)) continue;
      const source = Function.prototype.toString.call(factory);
      if (!['arrowClassName', 'menuClassName', 'boundarySelector', 'computeSidecarPosition', 'data-popper-placement', 'useLayoutEffect'].every(token => source.includes(token))) continue;
      const replacement = function(this: unknown, module: any, exports: any, require: any) {
        let react: any;
        const hooks = new WeakMap<Function, Function>();
        const wrap = (value: any) => {
          if (typeof value !== 'function') return value;
          let hook = hooks.get(value);
          if (!hook) {
            hook = (options: PopupOptions, deps: unknown[] = []) => {
              // Other DIM tooltips keep their original hook and middleware.
              if (!options.menuClassName || !react?.useLayoutEffect) return value(options, deps);
              react.useLayoutEffect(() => installNativePopupPositioning(options, prepare), [
                options.contents, options.reference, options.arrowClassName, options.menuClassName,
                options.boundarySelector, options.placement, options.offset, options.fixed, options.padding, ...deps,
              ]);
            };
            hooks.set(value, hook);
          }
          return hook;
        };
        const scopedRequire = new Proxy(require, {
          apply(target, thisArg, args) {
            const value: any = Reflect.apply(target, thisArg, args);
            if (typeof value?.useLayoutEffect === 'function') react = value;
            return value;
          },
          get(target, property, receiver) {
            if (property !== 'd') return Reflect.get(target, property, receiver);
            return (targetExports: any, getters: Record<string, () => any>, ...rest: any[]) => target.d(targetExports,
              Object.fromEntries(Object.entries(getters).map(([key, getter]) => [key, () => wrap(getter())])), ...rest);
          },
        });
        return Reflect.apply(factory, this, [module, exports, scopedRequire]);
      };
      wrappedFactories.add(replacement);
      factories[id] = replacement;
    }
  };
  for (const name of ['rspackChunkdim', 'webpackChunkdim']) {
    const chunks = host[name] ||= [];
    if (!Array.isArray(chunks)) continue;
    chunks.forEach(instrument);
    let delegate = chunks.push;
    Object.defineProperty(chunks, 'push', {
      configurable: true,
      // Capture each delegate when read. The bundler keeps its old push method;
      // forwarding to a mutable delegate would recurse when it replaces push.
      get() {
        const push = delegate;
        return function(this: any, ...entries: any[]) {
          entries.forEach(instrument);
          return Reflect.apply(push, this, entries);
        };
      },
      set(push) { delegate = push; },
    });
  }
}
