import { displayGrade } from './grade-colors';
import { gradeValue } from './grading';
import type { DimSearchInput } from './dim-item-input';
import type { SearchResponse, SearchRevision } from './search-bridge';
import type { WeaponEvaluationPayload, AegisMode } from './types';
import type { ScoreProfile, ScoreActivity } from './score-types';

export const INVENTORY_SORT_STATE = 'aegis:inventory-sort-state-v1';
export const INVENTORY_SORT_NODE = 'aegis-inventory-sort-state-v1';
export const INVENTORY_SORT_REQUEST = 'aegis:inventory-sort-request-v1';
const DISPOSE = 'aegis:inventory-sort-dispose-v1';
export interface InventorySortGrade { label: string | null; rank: number | null }
export interface InventorySortItem {
  id: string; hash: number; kind: DimSearchInput['kind'];
  scores: Record<ScoreActivity, Record<ScoreProfile, number | null>>;
  grades: Record<ScoreActivity, InventorySortGrade>;
  selected: { score: number | null; grade: number | null };
}
export interface InventorySortSettings {
  mode: AegisMode; profile: ScoreProfile; comparisonActivity: ScoreActivity;
  source: string; dbMode: string; gradeDisplayMode: 'equipped' | 'dual' | 'potential';
}
export interface InventorySortState {
  version: 1; generation: number; status: SearchResponse['status'];
  revision: SearchRevision | null; settings: InventorySortSettings; items: InventorySortItem[];
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function grade(label: string | null | undefined): InventorySortGrade {
  // Use Aegis's existing roll-display policy for tiers, potential arrows, and armor sets.
  const rank = gradeValue(displayGrade(label || '') || (label?.trim().toUpperCase() === 'PVP' ? 'PVP' : ''));
  return { label: label || null, rank: rank > 0 ? rank : null };
}

/** Project cached owned evaluations without reading badges or rounding percentages. */
export function inventorySortItem(item: Pick<DimSearchInput, 'id' | 'hash' | 'kind'>,
  data: WeaponEvaluationPayload, settings: InventorySortSettings): InventorySortItem {
  const scores = { pve: { best: null, omni: null }, pvp: { best: null, omni: null } } as InventorySortItem['scores'];
  if (item.kind === 'weapon') for (const activity of ['pve', 'pvp'] as const) {
    for (const profile of ['best', 'omni'] as const) scores[activity][profile] = finite(data.scoreEvaluations?.[activity]?.[profile].value);
  }
  const grades = { pve: grade(null), pvp: grade(null) };
  if (item.kind === 'weapon') {
    if (settings.mode === 'both') {
      grades.pve = grade(data.result.pveGrade);
      grades.pvp = grade(data.result.pvpGrade);
    } else grades[settings.mode] = grade(data.result.grade);
  }
  const ranks = Object.values(grades).map(value => value.rank).filter((value): value is number => value !== null);
  const selectedGrade = item.kind === 'armor' ? grade(data.result.grade).rank
    : settings.mode === 'both' ? (ranks.length ? Math.max(...ranks) : null) : grades[settings.mode].rank;
  const activity = settings.mode === 'both' ? settings.comparisonActivity : settings.mode;
  return { id: item.id, hash: item.hash, kind: item.kind, scores, grades,
    selected: { score: scores[activity][settings.profile], grade: selectedGrade } };
}

/** Publish complete inventory snapshots using JSON nodes across extension worlds. */
export function installInventorySortProvider(options: {
  settings: () => InventorySortSettings; connected: () => boolean;
}) {
  document.dispatchEvent(new Event(DISPOSE));
  let alive = true;
  let generation = 0;
  function connected() { try { return alive && options.connected(); } catch { return false; } }
  function publish(status: InventorySortState['status'], response?: SearchResponse, items: InventorySortItem[] = []) {
    if (!alive) return;
    const revision = response ? { session: response.session, accountEpoch: response.accountEpoch,
      inventoryRevision: response.inventoryRevision, evaluationRevision: response.evaluationRevision } : null;
    const state: InventorySortState = { version: 1, generation: ++generation, status, revision,
      settings: options.settings(), items: status === 'ready' ? items : [] };
    let node = document.getElementById(INVENTORY_SORT_NODE);
    if (!node) {
      node = document.createElement('script'); (node as HTMLScriptElement).type = 'application/json';
      node.id = INVENTORY_SORT_NODE; document.documentElement.append(node);
    }
    node.textContent = JSON.stringify(state);
    document.dispatchEvent(new Event(INVENTORY_SORT_STATE));
  }
  function request(event: Event) {
    if (event.target !== document || !event.cancelable) return;
    if (!connected()) { dispose(); return; }
    const detail = (event as CustomEvent).detail;
    if (typeof detail !== 'string' || detail.length > 80) return;
    try { if (JSON.parse(detail)?.type === 'connect') event.preventDefault(); } catch { /* Ignore malformed commands. */ }
  }
  function leave(event: PageTransitionEvent) { if (!event.persisted) dispose(); }
  function dispose() {
    if (!alive) return;
    alive = false;
    document.removeEventListener(INVENTORY_SORT_REQUEST, request);
    document.removeEventListener(DISPOSE, dispose);
    window.removeEventListener('pagehide', leave);
    document.getElementById(INVENTORY_SORT_NODE)?.remove();
    document.dispatchEvent(new Event(INVENTORY_SORT_STATE));
  }
  document.addEventListener(INVENTORY_SORT_REQUEST, request);
  document.addEventListener(DISPOSE, dispose);
  window.addEventListener('pagehide', leave);
  publish('pending');
  return { publish, dispose };
}
