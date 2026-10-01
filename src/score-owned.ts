import { SCORE_SLOTS } from './score-config';
import type { OwnedScoreSnapshot, RawOwnedScoreSnapshot, ScoreSlot } from './score-types';

export const MASTERWORK_STAT_IDS: Readonly<Record<number, string>> = {
  1240592695: 'range', 155624089: 'stability', 943549884: 'handling', 4188031367: 'reload',
  3614673599: 'blast radius', 2523465841: 'velocity', 2961396640: 'charge time',
  447667954: 'draw time', 4043523819: 'impact', 2837207746: 'swing speed'
};
export function unknownOwned(itemHash: number, instanceId?: string): OwnedScoreSnapshot {
  return { schemaVersion: 1, itemHash, instanceId, slots: Object.fromEntries(SCORE_SLOTS.map(slot => [slot, { state: 'unknown', reason: `unknown-owned-${slot}` }])) as OwnedScoreSnapshot['slots'] };
}
/** Untrusted page bridge input. A bad slot stays unknown rather than becoming an empty known list. */
export function parseOwnedSnapshot(rawText: string | null, itemHash: number,
  resolve: (hash: number) => string | null, instanceId?: string): OwnedScoreSnapshot {
  const out = unknownOwned(itemHash, instanceId);
  if (!rawText || rawText.length > 64000) return out;
  try {
    const raw = JSON.parse(rawText) as RawOwnedScoreSnapshot;
    if (raw.schemaVersion !== 1 || raw.itemHash !== itemHash || (instanceId && raw.instanceId !== instanceId)) return out;
    for (const slot of SCORE_SLOTS) {
      if (slot === 'masterwork') {
        if (raw.masterwork?.state === 'known' && MASTERWORK_STAT_IDS[raw.masterwork.statHash]) {
          out.slots.masterwork = { state: 'known', available: [`stat:${MASTERWORK_STAT_IDS[raw.masterwork.statHash]}`] };
        }
        continue;
      }
      const input = raw.slots?.[slot];
      if (input?.state !== 'known' || !Array.isArray(input.availableHashes) || input.availableHashes.length > 128 || !input.availableHashes.every(h => Number.isSafeInteger(h) && h > 0)) continue;
      const ids = input.availableHashes.map(resolve);
      if (ids.some(id => id === null)) continue;
      out.slots[slot] = { state: 'known', available: [...new Set(ids as string[])].sort() };
    }
  } catch { /* keep the explicit unknown snapshot */ }
  return out;
}

function category(def: any): ScoreSlot | 'trait' | null {
  const id = (def?.plug?.plugCategoryIdentifier ?? '').toLowerCase();
  if (/origin|^enhancements\./.test(id)) return 'origin';
  if (/sword_guard|weapon_magazine|weapon_battery|bow_arrow/.test(id)) return 'mag';
  if (/weapon_barrel|weapon_scope|bow_string|sword_blade|grenade_launcher_barrel/.test(id)) return 'barrel';
  if (/^weapon_perks|^weapon_perk|^word_perks/.test(id)) return 'trait';
  return null;
}

/** DIM live sockets: reusablePlugItems are runtime options; plugSet contains recipes/pools.
 * See DIM src/app/inventory/store/sockets.ts buildSocket and item-types.ts DimSocket.
 * This adapter never visits plugSet.plugs or definition randomized plug sets.
 */
export function extractRawOwnedSnapshot(item: any): RawOwnedScoreSnapshot {
  const slots = Object.fromEntries(SCORE_SLOTS.filter(s => s !== 'masterwork').map(s => [s, { state: 'unknown', reason: `unknown-owned-${s}` }])) as RawOwnedScoreSnapshot['slots'];
  const raw: RawOwnedScoreSnapshot = { schemaVersion: 1, itemHash: Number(item.hash), instanceId: item.id ? String(item.id) : undefined, slots, masterwork: { state: 'unknown', reason: 'unknown-owned-masterwork' } };
  if (item.sockets?.fromDefinitions !== false || !item.id || !Array.isArray(item.sockets?.allSockets)) return raw;
  let traitIndex = 0;
  for (const socket of [...item.sockets.allSockets].sort((a, b) => a.socketIndex - b.socketIndex)) {
    const actual = socket.actuallyPlugged ?? socket.plugged;
    const def = actual?.plugDef ?? socket.plugOptions?.[0]?.plugDef;
    let slot = category(def);
    if (slot === 'trait') {
      traitIndex++;
      if (traitIndex > 2) continue;
      slot = traitIndex === 1 ? 'perk1' : 'perk2';
    }
    if (!slot || slot === 'masterwork') continue;
    const actualHash = actual?.plugDef?.hash;
    if (!Number.isSafeInteger(actualHash) || actualHash <= 0) continue;
    let hashes: number[];
    if (item.crafted === 'crafted' || socket.plugSet?.craftingData) {
      hashes = [actualHash];
    } else if (Array.isArray(socket.reusablePlugItems)) {
      hashes = socket.reusablePlugItems.map((plug: any) => plug.plugItemHash).filter((h: unknown): h is number => typeof h === 'number' && Number.isSafeInteger(h) && h > 0);
      hashes.push(actualHash);
    } else if (!socket.hasRandomizedPlugItems && Array.isArray(socket.plugOptions)) {
      // Fixed/static socket options belong to this version (e.g. selectable origin traits).
      hashes = socket.plugOptions.map((plug: any) => plug.plugDef?.hash).filter((h: unknown): h is number => typeof h === 'number' && Number.isSafeInteger(h) && h > 0);
      hashes.push(actualHash);
    } else continue;
    const prior = raw.slots[slot];
    raw.slots[slot] = { state: 'known', availableHashes: [...new Set([...(prior.state === 'known' ? prior.availableHashes : []), ...hashes])].sort((a, b) => a - b) };
  }
  const primary = item.masterworkInfo?.stats?.filter((stat: any) => stat.isPrimary && MASTERWORK_STAT_IDS[stat.hash]);
  if (primary?.length === 1) raw.masterwork = { state: 'known', statHash: primary[0].hash };
  else {
    for (const socket of item.sockets.allSockets) {
      const def = (socket.actuallyPlugged ?? socket.plugged)?.plugDef;
      if (!/masterwork/.test(def?.plug?.plugCategoryIdentifier ?? '')) continue;
      const stats = def?.investmentStats?.filter((stat: any) => MASTERWORK_STAT_IDS[stat.statTypeHash]);
      if (stats?.length === 1) { raw.masterwork = { state: 'known', statHash: stats[0].statTypeHash }; break; }
    }
  }
  return raw;
}
