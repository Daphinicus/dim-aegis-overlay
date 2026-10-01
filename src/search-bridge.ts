import type { DimSearchInput } from './dim-item-input';
import type { SearchContext, SearchAvailability, AegisSearchData } from './aegis-search';

export interface SearchRevision {
  session: string;
  accountEpoch: number;
  inventoryRevision: number;
  evaluationRevision: number;
}
export interface SearchRequest extends SearchRevision { items: DimSearchInput[]; inventoryReady: boolean }
export interface SearchFact { id: string; hash: number; data: AegisSearchData; context: SearchContext }
export interface SearchResponse extends SearchRevision {
  status: 'pending' | 'ready' | 'unavailable';
  facts: SearchFact[];
  available?: SearchAvailability;
}
export const SEARCH_REQUEST = 'aegis-native-search-request';
export const SEARCH_RESPONSE = 'aegis-native-search-response';
export const SEARCH_INVALIDATE = 'aegis-native-search-invalidate';
export const SEARCH_QUERY = 'aegis-native-search-query';
export interface SearchQueryAddition { mode: 'append'; query: string }

export function appendSearchQuery(query: string): void {
  publishSearchMessage(SEARCH_QUERY, { mode: 'append', query } satisfies SearchQueryAddition);
}

export function sameSearchRevision(a: SearchRevision, b: SearchRevision): boolean {
  return a.session === b.session && a.accountEpoch === b.accountEpoch &&
    a.inventoryRevision === b.inventoryRevision && a.evaluationRevision === b.evaluationRevision;
}

// JSON nodes work across Firefox's isolated-world boundary without exporting objects.
export function publishSearchMessage(id: string, value: unknown): void {
  let node = document.getElementById(id);
  if (!node) {
    node = document.createElement('script');
    (node as HTMLScriptElement).type = 'application/json';
    node.id = id;
    document.documentElement.append(node);
  }
  node.textContent = JSON.stringify(value);
  document.dispatchEvent(new Event(id));
}
export function readSearchMessage<T>(id: string): T | null {
  try { return JSON.parse(document.getElementById(id)?.textContent || 'null') as T | null; }
  catch { return null; }
}

let disposePreviousEvaluator: (() => void) | undefined;
export function initSearchEvaluator(evaluate: (item: DimSearchInput) => SearchFact,
  ready: () => boolean, availability: () => SearchAvailability, cacheStats: () => unknown = () => ({}),
  onStatus: (status: SearchResponse['status']) => void = () => {}): { invalidate: () => void; dispose: () => void } {
  disposePreviousEvaluator?.();
  let generation = 0;
  let disposed = false;
  let preload: { status: SearchResponse['status']; items: number } = { status: 'pending', items: 0 };
  // A synchronous DOM handshake proves the content script is active. JSON in
  // attributes crosses Firefox extension worlds without exporting objects.
  const preloadRequest = (event: Event) => {
    if (disposed || !(event.target instanceof HTMLElement)) return;
    event.target.setAttribute('data-aegis-grade-preload', JSON.stringify({
      ...preload, status: ready() ? preload.status : 'pending', cache: cacheStats(),
    }));
  };
  document.addEventListener('dimsum-grade-preload-request', preloadRequest);
  const receive = () => {
    if (disposed) return;
    const request = readSearchMessage<SearchRequest>(SEARCH_REQUEST);
    if (!request || !Array.isArray(request.items)) { preload = { status: 'unavailable', items: 0 }; onStatus('unavailable'); return; }
    const token = ++generation;
    const respond = (status: SearchResponse['status'], facts: SearchFact[] = []) => {
      preload = { status, items: facts.length };
      onStatus(status);
      const { session, accountEpoch, inventoryRevision, evaluationRevision } = request;
      publishSearchMessage(SEARCH_RESPONSE, { session, accountEpoch, inventoryRevision, evaluationRevision, status, facts, available: availability() });
    };
    respond('pending');
    void (async () => {
      if (!request.inventoryReady || !ready() || request.items.some(item => !item.ready)) { respond('unavailable'); return; }
      const facts: SearchFact[] = [];
      try {
        for (let i = 0; i < request.items.length; i++) {
          if (token !== generation) return;
          facts.push(evaluate(request.items[i]));
          // Keep DIM responsive while grading a large vault.
          if (i % 50 === 49) await new Promise<void>(resolve => {
            // Timer throttling can otherwise leave a background DIM tab pending for minutes.
            const channel = new MessageChannel();
            channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };
            channel.port2.postMessage(null);
          });
        }
        if (token === generation) respond('ready', facts);
      } catch {
        if (token === generation) respond('unavailable');
      }
    })();
  };
  document.addEventListener(SEARCH_REQUEST, receive);
  const dispose = () => {
    disposed = true; ++generation; onStatus('unavailable');
    document.removeEventListener(SEARCH_REQUEST, receive);
    document.removeEventListener('dimsum-grade-preload-request', preloadRequest);
    window.removeEventListener('pagehide', leave);
  };
  const leave = (event: PageTransitionEvent) => { if (!event.persisted) dispose(); };
  disposePreviousEvaluator = dispose;
  window.addEventListener('pagehide', leave);
  receive();
  return { dispose, invalidate() { if (!disposed) { ++generation; preload = { status: 'pending', items: 0 }; onStatus('pending'); document.dispatchEvent(new Event(SEARCH_INVALIDATE)); } } };
}
