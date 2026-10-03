import type { AegisSheetWeapon } from './types';
import type { PerkInfo } from './dim-item-input';
import { canonicalScoreHash, sourceScoreSlot } from './score-source';

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
