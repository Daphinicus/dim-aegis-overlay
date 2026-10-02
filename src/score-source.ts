import type { AegisSheetDatabase, AegisSheetWeapon } from './types';
import type { ScoreActivity, ScoreSource, ScoreSlot, SourceSlot } from './score-types';
import { SCORE_SLOTS } from './score-config';
import { getEnglishPerkNameFromHash, getPerkHashFromEnglish } from './hash-translator';
import categoryRecovery from '../data/score-weapon-categories.json';

const categoryNames: Record<string, string> = categoryRecovery;
// Exact spellings used in the source sheets, verified against Bungie's English identities.
const sourcePerkAliases: Readonly<Record<string, string>> = {
  'hammer-forged rifling rifling': 'Hammer-forged Rifling',
  'fluted barrel barrel': 'Fluted Barrel',
  'omolon fluid dynamics dynamics': 'Omolon Fluid Dynamics',
  'ricochet': 'Ricochet Rounds',
  'extended magazine': 'Extended Mag',
  'high explosive': 'High-Explosive Ordnance',
  'tempered truss': 'Tempered Truss Rod',
  'auxiliary': 'Auxiliary Reserves',
  'overclocked': 'Overclocked Heatsink',
  'destablizing rounds': 'Destabilizing Rounds',
  'attritiion orbs': 'Attrition Orbs',
  'ambitious assasin': 'Ambitious Assassin',
  'ambition assassin': 'Ambitious Assassin',
  'blunt execution': 'Blunt Execution Rounds',
  'hammer, meet nail': 'Nail, Meet Hammer',
  'hammer forged': 'Hammer-forged Rifling',
  'rifled': 'Rifled Barrel'
};
export function canonicalScorePerk(name: string): string | null {
  const base = name.trim().replace(/^enhanced\s+/i, '');
  const hash = getPerkHashFromEnglish(sourcePerkAliases[base.toLowerCase()] ?? base);
  return hash ? `perk:${hash}` : null;
}
export function canonicalScoreHash(hash: number, enhanced: Record<number, number> = {}): string | null {
  const base = enhanced[hash] ?? hash;
  const english = getEnglishPerkNameFromHash(base);
  return english ? canonicalScorePerk(english) : null;
}
const statAliases: Record<string, string> = { 'reload speed': 'reload', 'projectile speed': 'velocity', 'cooling efficiency': 'heat efficiency' };
const statNames = new Set(['range', 'handling', 'stability', 'reload', 'charge time', 'draw time', 'blast radius', 'velocity', 'impact', 'swing speed', 'heat efficiency', 'accuracy', 'shield duration', 'persistence']);
export function sourceScoreSlot(raw: string | undefined, slot: ScoreSlot): SourceSlot {
  if (!raw?.trim()) return { state: 'unknown', reason: `unknown-source-${slot}` };
  if (/^(none(?:\b|$)|n\/a$|-$)/i.test(raw.trim())) return { state: 'not-applicable' };
  if (raw.includes('?')) return { state: 'unknown', reason: `uncertain-source-${slot}` };
  // A comma can belong to a perk name, such as Nail, Meet Hammer.
  const tokens = raw.split(/[\n\/]+/).flatMap(line => {
    const token = line.trim();
    return slot !== 'masterwork' && canonicalScorePerk(token) ? [token] : token.split(',');
  }).map(x => x.trim()).filter(Boolean);
  const ids = tokens.map(token => {
    if (slot !== 'masterwork') return canonicalScorePerk(token);
    const normalized = token.toLowerCase();
    const stat = statAliases[normalized] ?? normalized;
    return statNames.has(stat) ? `stat:${stat}` : null;
  });
  if (!ids.length || ids.some(id => id === null)) return { state: 'unknown', reason: `unresolved-source-${slot}` };
  return { state: 'ranked', recommendations: [...new Set(ids as string[])] };
}

export function scoreCategory(weapon: AegisSheetWeapon, category: string, activity: ScoreActivity): string {
  if (category === 'Exotic Weapons' || weapon.source === 'Exotic') return '';
  if (weapon.categoryKey && weapon.categoryKey !== 'Legendary Weapons') return weapon.categoryKey;
  if (activity === 'pve' && category !== 'Legendary Weapons') return category;
  if (weapon.weaponType) return weapon.weaponType;
  const name = weapon.name.toLowerCase().trim().replace(/\s*\([^)]*\)\s*$/, '');
  return categoryNames[name] ?? '';
}
export function sourceRevision(db: AegisSheetDatabase): string {
  // Exclude translated notes: language changes must not change numerical inputs.
  const text = JSON.stringify(Object.entries(db.categories).map(([category, rows]) => [category, rows.map(w => [w.name, w.categoryKey, w.weaponType, w.versionTag, w.tier, w.rank, w.barrel, w.mag, w.perk1, w.perk2, w.mw, w.origin])]));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `score-source-${(hash >>> 0).toString(16)}-${text.length}`;
}
export function buildScoreSourceIndex(db: AegisSheetDatabase, activity: ScoreActivity): Map<string, ScoreSource> {
  const revision = sourceRevision(db);
  const entries = Object.entries(db.categories).flatMap(([category, rows]) => rows.map(weapon => ({ category, weapon, key: scoreCategory(weapon, category, activity) })));
  const peers = new Map<string, number[]>();
  const seen = new Set<string>();
  for (const { weapon, key } of entries) {
    const id = weapon.sourceRowId ?? `${key}:${weapon.name}:${weapon.versionTag ?? ''}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!key || !/^\d+$/.test(weapon.rank.trim())) continue;
    const peerKey = `${key}:${weapon.tier}`;
    const ranks = peers.get(peerKey) ?? [];
    ranks.push(Number(weapon.rank)); peers.set(peerKey, ranks);
  }
  const index = new Map<string, ScoreSource>();
  for (const { category, weapon, key } of entries) {
    const ranks = peers.get(`${key}:${weapon.tier}`);
    const source: ScoreSource = { activity, rowId: weapon.sourceRowId ?? `${key}:${weapon.name}:${weapon.versionTag ?? ''}`, sourceRevision: revision,
      categoryKey: key, tier: weapon.tier.trim(), rank: /^\d+$/.test(weapon.rank.trim()) ? Number(weapon.rank) : null,
      rankBounds: ranks?.length ? [Math.min(...ranks), Math.max(...ranks)] : null,
      slots: Object.fromEntries(SCORE_SLOTS.map(slot => [slot, sourceScoreSlot(weapon[slot === 'masterwork' ? 'mw' : slot], slot)])) as Record<ScoreSlot, SourceSlot>,
      reason: category === 'Exotic Weapons' || weapon.source === 'Exotic' ? 'unsupported-exotic' : !key ? 'unresolved-category' : weapon.rank.trim() && !/^\d+$/.test(weapon.rank.trim()) ? 'unresolved-ranking' : undefined };
    index.set(weapon.name.toLowerCase().trim(), source);
  }
  return index;
}
