import { findNativeSearchInput } from './native-search-input';
import { isAegisArgumentAvailable, matchesAegisArgument, parseAegisArgument, type SearchAvailability } from './aegis-search';
import { projectDimItem } from './dim-item-input';
import { updateAegisQuery } from './search-query-edit';
import { SEARCH_INVALIDATE, SEARCH_QUERY, SEARCH_REQUEST, SEARCH_RESPONSE,
  publishSearchMessage, readSearchMessage, sameSearchRevision,
  type SearchRequest, type SearchResponse, type SearchFact } from './search-bridge';

// These types describe the discovered runtime, not a supported DIM public API.
type Selector = ((state: any) => any) & {
  resultFunc?: Function; dependencies?: Selector[];
  clearCache?: () => void; memoizedResultFunc?: { clearCache?: () => void };
};
interface Store { getState(): any; subscribe(fn: () => void): () => void; dispatch(action: unknown): unknown }
interface Runtime { store: Store; config: Selector; allItems: Selector; selectors: Selector[]; validate?: Selector }
let validateTerm: ((query: string) => boolean) | undefined;
export function isNativeSearchTermValid(query: string): boolean {
  try { return validateTerm?.(query) === true; } catch { return false; }
}
type FilterMap = { kvFilters: Record<string, unknown>; allFilters: unknown[] };
function setSearchStatus(status: 'pending' | 'ready' | 'unavailable'): void {
  document.documentElement.dataset.aegisSearchStatus = status;
  const button = document.querySelector<HTMLButtonElement>('.aegis-search-widget-btn');
  if (button) {
    button.title = status === 'ready' ? 'Aegis filters' : status === 'pending' ? 'Aegis filters: loading ratings' : 'Aegis filters unavailable';
    button.setAttribute('aria-busy', String(status === 'pending'));
  }
}

export function findDimStore(): Store | null {
  for (const element of document.querySelectorAll('body > div')) {
    const key = Object.keys(element).find(key => key.startsWith('__reactContainer$'));
    const root = key && (element as any)[key];
    const queue = root ? [root.stateNode?.current || root] : [];
    const seen = new Set();
    while (queue.length && seen.size < 10000) {
      const fiber = queue.pop();
      if (!fiber || seen.has(fiber)) continue;
      seen.add(fiber);
      const candidate = fiber.memoizedProps?.store;
      if (typeof candidate?.getState === 'function' && typeof candidate.subscribe === 'function' &&
          typeof candidate.dispatch === 'function') return candidate;
      if (fiber.child) queue.push(fiber.child);
      if (fiber.sibling) queue.push(fiber.sibling);
    }
  }
  return null;
}

export function discoverDimSearch(): Runtime | null {
  const host = (window as any).rspackChunkdim || (window as any).webpackChunkdim;
  const store = findDimStore();
  if (!host?.push || !store) return null;
  let requireModule: any;
  host.push([[`aegis-native-search-${Date.now()}`], {}, (value: unknown) => { requireModule = value; }]);
  if (!requireModule?.m) return null;
  const modules = Object.entries(requireModule.m).filter(([, factory]) => {
    const source = String(factory);
    return source.includes('Filter.ItemId') && source.includes('filtersMap') && source.includes('wishListsByHash');
  });
  if (modules.length !== 1) return null;
  const exports = requireModule(modules[0][0]);
  const selectors = Object.values(exports).filter((fn): fn is Selector =>
    typeof fn === 'function' && typeof (fn as Selector).resultFunc === 'function');
  const select = (match: (source: string) => boolean) => {
    const found = selectors.filter(fn => match(String(fn.resultFunc)));
    return found.length === 1 ? found[0] : undefined;
  };
  const filtered = select(source => source.includes('.location.hash') && source.includes('.filter('));
  const factory = select(source => source.includes('internal error: filter construction'));
  const validate = select(source => source.includes('.filtersMap') && !source.includes('case'));
  const valid = select(source => source.endsWith('.valid'));
  const config = factory?.dependencies?.[0];
  const allItems = filtered?.dependencies?.[0];
  const caches = [...new Set([...selectors, ...(factory?.dependencies || [])])];
  if (!config || !allItems || !validate || !valid || caches.some(fn => typeof fn.clearCache !== 'function' ||
      typeof fn.memoizedResultFunc?.clearCache !== 'function')) return null;
  const state = store.getState();
  if (typeof state.shell?.searchResultsOpen !== 'boolean' || !Array.isArray(allItems(state))) return null;
  return { store, config, allItems, selectors: caches, validate };
}

export function installDimSearch(runtime: Runtime): () => void {
  const { store, config, allItems, selectors } = runtime;
  const ownedValidator = runtime.validate ? (query: string) => runtime.validate!(store.getState())(query).valid : undefined;
  validateTerm = ownedValidator;
  let disposed = false, refreshQueued = false;
  let ownedMap: FilterMap | undefined;
  let facts = new Map<string, SearchFact>();
  let ready = false;
  let available: SearchAvailability = { ratings: false, shopping: false, source: false, armor: false, chase: false };
  let previousInventory: unknown, previousAccount = '', fingerprint = '';
  let guardUntilCommit = false;
  let previousHandlers = new WeakMap<Element, unknown>();
  const clickHandler = (element: Element) => {
    const key = Object.keys(element).find(key => key.startsWith('__reactProps$'));
    return key ? (element as any)[key]?.onClick : undefined;
  };
  let request: SearchRequest = { session: crypto.randomUUID(), accountEpoch: 0,
    inventoryRevision: 0, evaluationRevision: 0, items: [], inventoryReady: false };
  const suggestions = ['god', 'upgrade', 'p:>=a', 'shopping', 'chase'];
  Object.defineProperty(suggestions, 'includes', {
    value: (argument: string) => {
      const parsed = parseAegisArgument(argument);
      return ready && parsed.ok && isAegisArgumentAvailable(parsed.value, available);
    },
  });
  const definition = { keywords: 'aegis', description: 'Aegis ratings', format: 'query', suggestions,
    filter: ({ filterValue }: { filterValue: string }) => {
      const parsed = parseAegisArgument(filterValue);
      return (item: { id: string; hash: number }) => {
        const fact = facts.get(item.id);
        return ready && parsed.ok && isAegisArgumentAvailable(parsed.value, available) && fact?.hash === item.hash && matchesAegisArgument(parsed.value, fact.data, fact.context);
      };
    },
  };
  const refresh = () => {
    if (refreshQueued || disposed) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      if (disposed) return;
      for (const selector of selectors) {
        selector.clearCache!(); selector.memoizedResultFunc!.clearCache!();
      }
      store.dispatch({ type: 'shell/TOGGLE_SEARCH_RESULTS', payload: store.getState().shell.searchResultsOpen });
    });
  };
  const removeOwned = () => {
    if (ownedMap?.kvFilters.aegis === definition) delete ownedMap.kvFilters.aegis;
    const index = ownedMap?.allFilters.indexOf(definition) ?? -1;
    if (index >= 0) ownedMap!.allFilters.splice(index, 1);
    ownedMap = undefined;
  };
  const register = () => {
    const map = config(store.getState())?.filtersMap as FilterMap | undefined;
    if (map === ownedMap) return;
    removeOwned();
    if (!map?.kvFilters || !Array.isArray(map.allFilters) || map.kvFilters.aegis ||
        !Object.isExtensible(map.kvFilters) || !Object.isExtensible(map.allFilters)) throw new Error('Incompatible DIM search map');
    map.kvFilters.aegis = definition;
    map.allFilters.push(definition);
    ownedMap = map;
    refresh();
  };
  const publish = () => {
    setSearchStatus('pending');
    previousHandlers = new WeakMap();
    for (const element of document.querySelectorAll('button, a, [role="button"]')) {
      const handler = clickHandler(element);
      if (handler) previousHandlers.set(element, handler);
    }
    ready = false; guardUntilCommit = true; facts = new Map(); refresh();
    publishSearchMessage(SEARCH_REQUEST, request);
  };
  const update = () => {
    if (disposed) return;
    try {
      register();
      const state = store.getState();
      const account = `${state.accounts?.currentAccountMembershipId}:${state.accounts?.currentAccountDestinyVersion}`;
      if (state.inventory === previousInventory && account === previousAccount) return;
      previousInventory = state.inventory;
      const accountChanged = account !== previousAccount;
      if (accountChanged) { previousAccount = account; request.accountEpoch++; }
      const items = allItems(state).map(projectDimItem).filter(Boolean) as SearchRequest['items'];
      const inventoryReady = Array.isArray(state.inventory?.stores) && state.inventory.stores.length > 0;
      const next = JSON.stringify([inventoryReady, items]);
      if (!accountChanged && fingerprint === next) return;
      fingerprint = next;
      request = { ...request, inventoryRevision: request.inventoryRevision + 1, items, inventoryReady };
      publish();
    } catch { dispose(); }
  };
  const receive = () => {
    const response = readSearchMessage<SearchResponse>(SEARCH_RESPONSE);
    if (!response || !sameSearchRevision(response, request) || !Array.isArray(response.facts)) return;
    if (response.status === 'ready' && response.available && request.inventoryReady) {
      const expected = new Map(request.items.map(item => [item.id, item.hash]));
      if (response.facts.length !== expected.size || response.facts.some(fact => expected.get(fact.id) !== fact.hash) ||
          new Set(response.facts.map(fact => fact.id)).size !== expected.size) return;
      facts = new Map(response.facts.map(fact => [fact.id, fact])); available = response.available; ready = true;
      // Retain the interaction guard until React has had a chance to commit new props.
      const revision = { ...request };
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (ready && sameSearchRevision(revision, request)) guardUntilCommit = false;
      }));
    } else { ready = false; facts.clear(); }
    setSearchStatus(ready ? 'ready' : response.status === 'pending' ? 'pending' : 'unavailable');
    refresh();
  };
  const invalidate = () => { request = { ...request, evaluationRevision: request.evaluationRevision + 1 }; publish(); };
  const setQuery = () => {
    const message = readSearchMessage<unknown>(SEARCH_QUERY);
    let query: string;
    if (typeof message === 'string') query = message;
    else if (message && typeof message === 'object' && 'mode' in message && message.mode === 'append' &&
        'query' in message && typeof message.query === 'string' && message.query.trim()) {
      // DIM debounces typing. Read the widget's input so an unfinished edit is
      // included, even when Redux still contains the previous search.
      const wrapper = document.querySelector('.aegis-search-widget')?.parentElement;
      const input = wrapper ? findNativeSearchInput(wrapper) : null;
      const current = (input?.value ?? store.getState().shell.searchQuery ?? '').trim();
      const addition = message.query.trim();
      query = updateAegisQuery(current, addition);
    } else return;
    store.dispatch({ type: 'shell/SEARCH_QUERY', payload: { query, updateVersion: true } });
  };
  const guardAction = (event: Event) => {
    if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return;
    const element = event.target instanceof Element ? event.target : null;
    if (!element || element.closest('input, textarea, .aegis-inline-search, .aegis-search-widget')) return;
    if (element.closest('[aria-keyshortcuts="esc"]')) return;
    const action = element.closest('button, a, [role="button"]');
    const staleHandler = action && previousHandlers.has(action) && previousHandlers.get(action) === clickHandler(action);
    if (!guardUntilCommit && ready && !staleHandler) return;
    // Native dialogs can retain a query after the header has been cleared.
    let fiber: any;
    for (let node: Element | null = element; node && !fiber; node = node.parentElement) {
      const key = Object.keys(node).find(key => key.startsWith('__reactFiber$'));
      if (key) fiber = (node as any)[key];
    }
    for (let depth = 0; fiber && depth < 100; depth++, fiber = fiber.return) {
      const props = fiber.memoizedProps;
      if ([props?.query, props?.searchQuery].some(query => typeof query === 'string' && /\baegis:/i.test(query))) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
    }
    // Strip Sockets keeps its query in a sibling of the confirmation footer.
    const dialog = element.closest('[role="dialog"]');
    const key = dialog && Object.keys(dialog).find(key => key.startsWith('__reactFiber$'));
    const root = key && (dialog as any)[key];
    const queue = root?.child ? [root.child] : [];
    let visited = 0;
    while (queue.length && visited++ < 10000) {
      const child = queue.pop();
      const props = child?.memoizedProps;
      if ([props?.query, props?.searchQuery].some(query => typeof query === 'string' && /\baegis:/i.test(query))) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (child?.child) queue.push(child.child);
      if (child?.sibling) queue.push(child.sibling);
    }
  };
  let unsubscribe = () => {};
  function dispose() {
    if (disposed) return;
    if (validateTerm === ownedValidator) validateTerm = undefined;
    setSearchStatus('unavailable');
    ready = false; facts.clear(); removeOwned();
    unsubscribe();
    document.removeEventListener(SEARCH_RESPONSE, receive);
    document.removeEventListener(SEARCH_INVALIDATE, invalidate);
    document.removeEventListener(SEARCH_QUERY, setQuery);
    document.removeEventListener('click', guardAction, true);
    document.removeEventListener('keydown', guardAction, true);
    for (const selector of selectors) { selector.clearCache!(); selector.memoizedResultFunc!.clearCache!(); }
    disposed = true;
    store.dispatch({ type: 'shell/TOGGLE_SEARCH_RESULTS', payload: store.getState().shell.searchResultsOpen });
  }
  document.addEventListener(SEARCH_RESPONSE, receive);
  document.addEventListener(SEARCH_INVALIDATE, invalidate);
  document.addEventListener(SEARCH_QUERY, setQuery);
  document.addEventListener('click', guardAction, true);
  document.addEventListener('keydown', guardAction, true);
  unsubscribe = store.subscribe(update);
  update();
  return dispose;
}

export function initDimSearch(): void {
  if (!/^(app|beta)\.destinyitemmanager\.com$/.test(location.hostname)) return;
  const host = window as any;
  host.__aegisNativeSearchDispose?.();
  let attempts = 0, stop: (() => void) | undefined, currentStore: Store | undefined;
  let stopped = false;
  const discover = () => {
    if (stopped) return;
    try {
      if (currentStore && findDimStore() === currentStore) return;
      if (currentStore) { stop?.(); currentStore = undefined; attempts = 0; }
      if (attempts >= 60) return;
      const runtime = discoverDimSearch();
      if (runtime) { stop = installDimSearch(runtime); currentStore = runtime.store; return; }
    } catch { /* Unsupported DIM builds leave aegis: queries invalid. */ }
    if (++attempts >= 60) setSearchStatus('unavailable');
  };
  setSearchStatus('pending');
  const timer = setInterval(discover, 1000);
  const leave = (event: PageTransitionEvent) => { if (!event.persisted) host.__aegisNativeSearchDispose(); };
  host.__aegisNativeSearchDispose = () => {
    stopped = true; clearInterval(timer); stop?.();
    window.removeEventListener('pagehide', leave);
  };
  window.addEventListener('pagehide', leave);
}
