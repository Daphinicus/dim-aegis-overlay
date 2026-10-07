import type { AegisSheetDatabase, AegisSheetWeapon } from './types';
import type { PerkInfo } from './dim-item-input';
import { canonicalScoreHash, sourceScoreSlot } from './score-source';
import frames from '../data/score-weapon-frames.json';

const weaponFrames: Readonly<Record<string, string>> = frames;
const frameKey = (frame: string) => frame.toLowerCase().replace(/\bframe\b/g, '').replace(/[^a-z0-9]/g, '');
/** Resolve editions from public hash metadata, never from the roll's perk quality. */
export function findVariantByItemMetadata<T extends { frame?: string }>(variants: readonly T[], itemHash: number): T | null {
  const frame = weaponFrames[itemHash];
  if (!frame || variants.some(variant => !variant.frame)) return null;
  const matches = variants.filter(variant => frameKey(variant.frame!) === frameKey(frame));
  return matches.length === 1 ? matches[0] : null;
}

/** Prefer an unambiguous owned origin over source labels or legacy variant guesses. */
export function findVariantByOwnedOrigin(
  variants: AegisSheetWeapon[],
  perksMap?: Record<number, PerkInfo>,
): AegisSheetWeapon | null {
  const origins = new Set(Object.entries(perksMap || {}).flatMap(([hash, perk]) => {
    if (perk.slots && !perk.slots.includes('origin')) return [];
    const id = canonicalScoreHash(Number(hash), {}, 'origin');
    return id ? [id] : [];
  }));
  if (!origins.size) return null;
  const matches = variants.filter(variant => {
    const source = sourceScoreSlot(variant.origin, 'origin');
    return source.state === 'ranked' && source.recommendations.some(id => origins.has(id));
  });
  return matches.length === 1 ? matches[0] : null;
}

const variantIndexes = new WeakMap<AegisSheetDatabase, Map<string, AegisSheetWeapon[]>>();
const variantIdentityRequirements = new WeakMap<AegisSheetDatabase, Map<string, boolean>>();
const weaponBase = (name: string) => name.toLowerCase().trim()
  .replace(/\s*\([^)]*\)\s*$/, '')
  .replace(/\s+(brave|pantheon|rotn|legacy|adept|timelost|harrowed|re-issue|reissued)(\s+version)?$/, '').trim();
/** Category rows are authoritative: older name-only variant indexes can omit an edition. */
export function weaponVariants(db: AegisSheetDatabase, name: string): AegisSheetWeapon[] {
  let index = variantIndexes.get(db);
  if (!index) {
    index = new Map();
    const seen = new Set<string>();
    const families = new Map<string, { frames: Set<string>; categories: Set<string> }>();
    const add = (weapon: AegisSheetWeapon, category: string) => {
      const id = weapon.sourceRowId ?? JSON.stringify([weapon.categoryKey ?? category, weapon.name, weapon.versionTag ?? '', weapon.frame]);
      if (seen.has(id)) return;
      seen.add(id);
      const base = weaponBase(weapon.name), rows = index!.get(base) ?? [];
      rows.push(weapon); index!.set(base, rows);
      const family = families.get(base) ?? { frames: new Set<string>(), categories: new Set<string>() };
      family.frames.add(frameKey(weapon.frame ?? ''));
      const sourceCategory = weapon.categoryKey && weapon.categoryKey !== 'Legendary Weapons'
        ? weapon.categoryKey : weapon.weaponType || category;
      family.categories.add(sourceCategory.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, ''));
      families.set(base, family);
    };
    for (const [category, rows] of Object.entries(db.categories ?? {})) for (const weapon of rows) add(weapon, category);
    // Compatibility for source payloads whose categories are unavailable.
    if (!index.size) for (const rows of Object.values(db.variants ?? {})) for (const weapon of rows) add(weapon, '');
    variantIndexes.set(db, index);
    variantIdentityRequirements.set(db, new Map([...families].map(([base, family]) => [base, family.frames.size > 1 || family.categories.size > 1])));
  }
  return index.get(weaponBase(name)) ?? [];
}

/** Cross-frame/category editions require verified metadata or owned-origin identity.
 * Same-family editions retain their existing source-specific fallback behavior. */
export function weaponVariantsNeedIdentity(db: AegisSheetDatabase, name: string): boolean {
  weaponVariants(db, name);
  return variantIdentityRequirements.get(db)?.get(weaponBase(name)) ?? false;
}
