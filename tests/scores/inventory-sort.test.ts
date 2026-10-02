// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { inventorySortItem, installInventorySortProvider, INVENTORY_SORT_STATE, INVENTORY_SORT_NODE,
  INVENTORY_SORT_REQUEST, type InventorySortSettings } from '../../src/inventory-sort';
import { initSearchEvaluator, publishSearchMessage, SEARCH_REQUEST, type SearchFact, type SearchResponse } from '../../src/search-bridge';
import type { WeaponEvaluationPayload } from '../../src/types';

const settings: InventorySortSettings = { mode: 'pve', profile: 'best', comparisonActivity: 'pvp',
  source: 'aegis', dbMode: 'spreadsheet', gradeDisplayMode: 'equipped' };
const item = { id: '12345', hash: 987, kind: 'weapon' as const };
const payload = (grade: string | null, pve = 89.991, pvp = 92.245): WeaponEvaluationPayload => ({
  name: 'Test', perksMap: {}, result: { grade, matchPercentage: 0, matchedPerks: [], missingPerks: [], notes: '', wishlistPerks: [] },
  scoreEvaluations: { pve: { best: { value: pve }, omni: { value: 78.123456 } },
    pvp: { best: { value: pvp }, omni: { value: null } } } as any,
});
const read = () => JSON.parse(document.getElementById(INVENTORY_SORT_NODE)!.textContent!);
const connect = (detail: unknown = JSON.stringify({ type: 'connect' })) =>
  document.dispatchEvent(new CustomEvent(INVENTORY_SORT_REQUEST, { cancelable: true, detail }));
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); document.documentElement.replaceChildren(document.createElement('head'), document.createElement('body')); vi.unstubAllGlobals(); });

it('preserves raw values, profile selection, real zero, and unavailable Omni independently of grades', () => {
  const data = payload('F');
  expect(inventorySortItem(item, data, settings)).toMatchObject({ id: item.id, hash: item.hash,
    selected: { score: 89.991, grade: 10 }, grades: { pve: { label: 'F', rank: 10 }, pvp: { label: null, rank: null } } });
  expect(inventorySortItem(item, data, { ...settings, profile: 'omni' }).selected.score).toBe(78.123456);
  expect(inventorySortItem(item, data, { ...settings, mode: 'pvp', profile: 'omni' }).selected.score).toBeNull();
  data.scoreEvaluations!.pve!.best.value = 0;
  expect(inventorySortItem(item, data, settings).selected.score).toBe(0);
  data.scoreEvaluations!.pve!.best.value = NaN;
  expect(inventorySortItem(item, data, settings).selected.score).toBeNull();
  delete data.scoreEvaluations;
  expect(inventorySortItem(item, data, settings).selected).toEqual({ score: null, grade: 10 });
});

it('uses native grade ranks for tiers, potential arrows, custom grades, and exotic viability', () => {
  for (const [label, rank] of [['BS+', 105], ['BF➔S+', 105], ['A➔B', 70], ['E', 30], ['S', 100], ['PvP', 40], ['—', null], ['90%', null], ['', null]] as const) {
    expect(inventorySortItem(item, payload(label), settings).selected.grade, label).toBe(rank);
  }
});

it('uses the better available grade in Both and the explicit comparison activity for numbers', () => {
  const data = payload('A | S+'); data.result.pveGrade = 'A'; data.result.pvpGrade = 'S+';
  const both = { ...settings, mode: 'both' as const };
  expect(inventorySortItem(item, data, both)).toMatchObject({ grades: { pve: { rank: 85 }, pvp: { rank: 105 } }, selected: { score: 92.245, grade: 105 } });
  data.result.pvpGrade = '—';
  expect(inventorySortItem(item, data, both).selected.grade).toBe(85);
  data.result.pveGrade = '—';
  expect(inventorySortItem(item, data, both).selected.grade).toBeNull();
  expect(inventorySortItem(item, data, { ...both, comparisonActivity: 'pve' }).selected.score).toBe(89.991);
});

it('keeps armor out of numerical scores and orders set grades with the existing display policy', () => {
  expect(inventorySortItem({ ...item, kind: 'armor' }, payload('C/S+'), settings)).toMatchObject({
    scores: { pve: { best: null, omni: null }, pvp: { best: null, omni: null } }, selected: { score: null, grade: 105 } });
});

it('acknowledges string-only connect without recalculation and clears pending/unavailable items', () => {
  let current = { ...settings }; let connected = true;
  const provider = installInventorySortProvider({ settings: () => current, connected: () => connected }); cleanups.push(provider.dispose);
  expect(read()).toMatchObject({ version: 1, generation: 1, status: 'pending', revision: null, items: [] });
  expect(connect()).toBe(false); const generation = read().generation;
  expect(connect()).toBe(false); expect(read().generation).toBe(generation);
  for (const command of [{ type: 'connect' }, '{', JSON.stringify({ type: 'set', mode: 'pvp' }), 'x'.repeat(81)]) expect(connect(command)).toBe(true);
  const response: SearchResponse = { session: 'session', accountEpoch: 1, inventoryRevision: 2, evaluationRevision: 3, status: 'ready', facts: [] };
  provider.publish('ready', response, [inventorySortItem(item, payload('F'), current)]);
  expect(read()).toMatchObject({ status: 'ready', revision: { session: 'session', accountEpoch: 1, inventoryRevision: 2, evaluationRevision: 3 }, items: [{ id: '12345' }] });
  current = { ...current, profile: 'omni' };
  provider.publish('pending'); expect(read()).toMatchObject({ status: 'pending', revision: null, settings: { profile: 'omni' }, items: [] });
  provider.publish('unavailable', undefined, [inventorySortItem(item, payload('F'), current)]); expect(read().items).toEqual([]);
  connected = false; expect(connect()).toBe(true); expect(document.getElementById(INVENTORY_SORT_NODE)).toBeNull();
});

it('disposes old providers on replacement and page exit, while preserving a cached page', () => {
  const notifications = vi.fn(); document.addEventListener(INVENTORY_SORT_STATE, notifications);
  cleanups.push(() => document.removeEventListener(INVENTORY_SORT_STATE, notifications));
  const old = installInventorySortProvider({ settings: () => settings, connected: () => true });
  const current = installInventorySortProvider({ settings: () => settings, connected: () => true }); cleanups.push(current.dispose);
  const state = document.getElementById(INVENTORY_SORT_NODE);
  old.publish('ready'); old.dispose(); expect(document.getElementById(INVENTORY_SORT_NODE)).toBe(state);
  window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); expect(connect()).toBe(false);
  window.dispatchEvent(new PageTransitionEvent('pagehide')); expect(connect()).toBe(true);
  expect(document.getElementById(INVENTORY_SORT_NODE)).toBeNull(); expect(notifications).toHaveBeenCalled();
});

it('shares complete inventory evaluation and rejects interrupted generations without per-tile work', async () => {
  const deferred: (() => void)[] = [];
  vi.stubGlobal('MessageChannel', class {
    port1 = { onmessage: () => {}, close: () => {} };
    port2 = { close: () => {}, postMessage: () => deferred.push(() => this.port1.onmessage()) };
  });
  const provider = installInventorySortProvider({ settings: () => settings, connected: () => true }); cleanups.push(provider.dispose);
  const entries = new Map<string, ReturnType<typeof inventorySortItem>>();
  const evaluate = vi.fn((input: any): SearchFact => { const data = payload('A'); entries.set(input.id, inventorySortItem(input, data, settings));
    return { id: input.id, hash: input.hash, data: { result: { grade: 'A' } }, context: { mode: 'pve', chase: false } }; });
  const evaluator = initSearchEvaluator(evaluate, () => true, () => ({ ratings: true, shopping: false, source: true, armor: false, chase: false }),
    undefined, undefined, (status, response) => {
      if (status !== 'ready') entries.clear();
      provider.publish(status, response, response?.facts.map(fact => entries.get(fact.id)!) || []);
    }); cleanups.push(evaluator.dispose);
  const request = (revision: number, count: number) => publishSearchMessage(SEARCH_REQUEST, { session: 'session', accountEpoch: 1,
    inventoryRevision: revision, evaluationRevision: 1, inventoryReady: true,
    items: Array.from({ length: count }, (_, n) => ({ ...item, id: String(n + 1), ready: true })) });
  request(1, 70); expect(read().status).toBe('pending'); expect(read().items).toEqual([]); expect(evaluate).toHaveBeenCalledTimes(50);
  evaluator.invalidate(); expect(read()).toMatchObject({ status: 'pending', revision: null, items: [] });
  request(2, 2); expect(read()).toMatchObject({ status: 'ready', revision: { inventoryRevision: 2 }, items: [{ id: '1' }, { id: '2' }] });
  deferred.splice(0).forEach(fn => fn()); await Promise.resolve();
  expect(read().revision.inventoryRevision).toBe(2); expect(read().items).toHaveLength(2); expect(evaluate).toHaveBeenCalledTimes(52);
  expect(connect()).toBe(false); expect(evaluate).toHaveBeenCalledTimes(52);
  request(3, 70); expect(read().status).toBe('pending');
  publishSearchMessage(SEARCH_REQUEST, {items: null}); expect(read().status).toBe('unavailable');
  deferred.splice(0).forEach(fn => fn()); await Promise.resolve();
  expect(read().status).toBe('unavailable'); expect(read().items).toEqual([]);
  request(3, 0); expect(read()).toMatchObject({ status: 'ready', revision: { inventoryRevision: 3 }, items: [] });
  evaluator.dispose(); expect(read()).toMatchObject({ status: 'unavailable', items: [] });
});
