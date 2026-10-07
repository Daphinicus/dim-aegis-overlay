import { WEAPON_PERK_NAMES, WEAPON_PERK_HASHES, WEAPON_PERK_ALIASES, WEAPON_PERK_AMBIGUOUS } from './weapon-perk-identities';
import { CANONICAL_PERK_HASHES, HASH_TO_ENGLISH_PERK } from './canonical-hashes';
export type WeaponPerkSlot = 'barrel' | 'mag' | 'perk1' | 'perk2' | 'origin';
const family = (slot: WeaponPerkSlot) => slot === 'perk1' || slot === 'perk2' ? 'trait' : slot;
const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
/** A name identifies a weapon plug only within its socket family. */
export function resolveWeaponPerkHash(name: string, slot?: WeaponPerkSlot): number | null {
  const raw = name.toLowerCase().trim().replace(/\s+/g, ' ');
  // Enhanced Battery and Enhanced Heatsink are literal part names. Resolve the
  // complete name; enhancement aliases exist only for verified hash links.
  const candidates = WEAPON_PERK_NAMES[raw] ?? WEAPON_PERK_ALIASES[nameKey(raw)];
  if (!candidates) return null;
  if (slot) return candidates[family(slot)] ?? null;
  // Trait names take precedence over cosmetics and same-named equipment parts.
  return candidates.trait ?? candidates.origin ?? candidates.barrel ?? candidates.mag ?? null;
}
/** Ambiguous spacing/punctuation aliases must not fall back to the global registry. */
export function isAmbiguousWeaponPerkName(name: string, slot?: WeaponPerkSlot): boolean {
  const raw = name.toLowerCase().trim().replace(/\s+/g, ' ');
  if (WEAPON_PERK_NAMES[raw]) return false;
  const conflicts = WEAPON_PERK_AMBIGUOUS[nameKey(raw)];
  return !!conflicts?.length && (!slot || conflicts.includes(family(slot)));
}
/** Preserve exact plug-family identity while collapsing normal/enhanced duplicates. */
export function weaponPerkBaseHash(hash: number, slot?: WeaponPerkSlot): number | null {
  const identity = WEAPON_PERK_HASHES[hash];
  return identity && (!slot || identity[0] === family(slot)) ? identity[1] : null;
}
/** Keep existing numerical IDs when the canonical definition belongs to this exact family. */
export function weaponPerkScoreHash(hash: number, slot?: WeaponPerkSlot): number | null {
  const base = weaponPerkBaseHash(hash, slot);
  if (!base) return null;
  const name = HASH_TO_ENGLISH_PERK[base];
  const canonical = name ? CANONICAL_PERK_HASHES[name.toLowerCase().trim()] ?? CANONICAL_PERK_HASHES[nameKey(name)] : undefined;
  return canonical && weaponPerkBaseHash(canonical, slot) === base ? canonical : base;
}
export function matchesWeaponPerk(hash: number, recommendation: number, slot: WeaponPerkSlot, ownedSlots?: readonly WeaponPerkSlot[]): boolean {
  if (ownedSlots && !ownedSlots.includes(slot)) return false;
  const base = weaponPerkBaseHash(hash, slot);
  return base !== null && base === weaponPerkBaseHash(recommendation, slot);
}
