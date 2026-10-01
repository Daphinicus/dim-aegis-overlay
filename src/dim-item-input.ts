import { masterworkStatName } from './masterwork';
type PerkInfo = { name: string; icon: string };

// DIM objects are a runtime integration boundary, validated before projection.
export interface DimSearchInput {
  id: string; hash: number; name: string; kind: 'weapon' | 'armor';
  perkHashes: number[]; activeHashes: number[]; perksMap: Record<number, PerkInfo>;
  masterwork: string; variantText: string; ready: boolean; isExotic?: boolean; index?: string;
}
export function readDimMasterwork(item: any): string {
  let equippedMasterwork = '';
  // Prefer the primary stat hash; DIM's display names depend on its language.
  if (item.masterworkInfo) {
    const mwStatName =
      masterworkStatName(item.masterworkInfo.stats) ||
      item.masterworkInfo.statName ||
      item.masterworkInfo.stat?.displayProperties?.name ||
      item.masterworkInfo.name ||
      item.masterworkInfo.typeName ||
      '';
    if (mwStatName) {
      // Strip "masterwork(ed)" as a whole word only (word boundary prevents mid-word cuts)
      equippedMasterwork = mwStatName
        .replace(/\bmasterwork(?:ed|s)?\b\s*:?\s*/gi, '')
        .replace(/:\s*/g, '')
        .trim();
    }
  }

  // === Strategy 2: Socket scan — look for weapon_masterwork* category ===
  if (!equippedMasterwork && item.sockets && item.sockets.allSockets) {
    for (const socket of item.sockets.allSockets) {
      if (!socket || !socket.plugged?.plugDef) continue;
      const def = socket.plugged.plugDef;
      const catId = (def.plug?.plugCategoryIdentifier || '').toLowerCase();
      const typeName = (def.itemTypeDisplayName || '').toLowerCase();
      // Match weapon masterwork or generic masterwork sockets
      if (catId.startsWith('weapon_masterwork') ||
          catId.includes('masterwork') ||
          typeName.includes('masterwork')) {
        const mwName = (def.displayProperties?.name || '').trim();
        if (mwName) {
          equippedMasterwork = mwName
            .replace(/\bmasterwork(?:ed|s)?\b\s*:?\s*/gi, '')
            .replace(/:\s*/g, '')
            .trim();
        }
        if (equippedMasterwork) break;
      }
    }
  }

  // === Normalize full D2 stat names to match sheet abbreviations ===
  // DIM uses "Reload Speed" but sheets typically say "Reload"; "Blast Radius" → stays, etc.

  // First: strip any "Tier N" prefix (present when statName is null for partial MW)
  // e.g. "tier 1stability" → "stability", "Tier 10Reload Speed" → "Reload Speed"
  equippedMasterwork = equippedMasterwork
    .replace(/\btier\s*\d+\s*/gi, '')
    .trim();

  const mwNormMap: Record<string, string> = {
    'reload speed': 'Reload',
    'reload': 'Reload',
    'charge time': 'Charge Time',
    'draw time': 'Draw Time',
    'blast radius': 'Blast Radius',
    'projectile speed': 'Velocity',
    'swing speed': 'Swing Speed',
    'range': 'Range',
    'handling': 'Handling',
    'stability': 'Stability',
    'velocity': 'Velocity',
    'impact': 'Impact',
  };
  const mwLower = equippedMasterwork.toLowerCase();
  if (mwNormMap[mwLower]) {
    equippedMasterwork = mwNormMap[mwLower];
  }

  return equippedMasterwork;
}
export function projectDimItem(item: any): DimSearchInput | null {
  if (!item || typeof item.id !== 'string' || !/^\d+$/.test(item.id) || item.id === '0' || !Number.isFinite(item.hash)) return null;
  const kind = item.bucket?.inWeapons || item.weapon ? 'weapon' : item.bucket?.inArmor || item.armor ? 'armor' : null;
  if (!kind) return null;
  const { perkHashes, activeHashes, perksMap } = readDimPerks(item);
  const sockets = item.sockets?.allSockets;
  return { id: item.id, hash: item.hash, name: item.name || '', kind, perkHashes, activeHashes, perksMap,
    masterwork: readDimMasterwork(item), variantText: item.name || '', isExotic: item.isExotic === true,
    index: typeof item.index === 'string' ? item.index : item.id,
    ready: !!item.name && (kind === 'armor' || (Array.isArray(sockets) && activeHashes.length > 0)) };
}

export function readDimPerks(item: any): Pick<DimSearchInput, 'perkHashes' | 'activeHashes' | 'perksMap'> {
  const perkHashes: number[] = [], activeHashes: number[] = [];
  const perksMap: Record<number, PerkInfo> = {};
  const sockets = item.sockets?.allSockets;
  for (const socket of sockets || []) {
    if (!socket) continue;
    if (socket.plugged?.plugDef?.hash) activeHashes.push(socket.plugged.plugDef.hash);
    for (const plug of [socket.plugged, ...(socket.plugOptions || [])]) {
      const def = plug?.plugDef;
      if (!def?.hash) continue;
      if (!perkHashes.includes(def.hash)) perkHashes.push(def.hash);
      perksMap[def.hash] = { name: def.displayProperties?.name || 'Unknown Perk', icon: def.displayProperties?.icon || '' };
    }
  }
  return { perkHashes, activeHashes, perksMap };
}
