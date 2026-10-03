import { getLocalizedPerkName, getPerkIcon } from './hash-translator';
import { matchesWeaponPerk, weaponPerkBaseHash, type WeaponPerkSlot } from './weapon-perk-identity';
import { canonicalScorePerk, sourceScoreSlot } from './score-source';
export interface EvaluatedPerk {
  name: string;
  hash?: number;
  icon?: string;
  matched: boolean;
  status: 'active' | 'selectable' | 'missing';
}

export type AvailablePerk = { hash: number; name: string; icon: string; active: boolean; slots?: WeaponPerkSlot[]; activeSlots?: WeaponPerkSlot[] };

// Cache only string preparation; manifest lookups and localized details stay current.
const recommendationCache = new Map<string, string[]>();

function prepareRecommendations(recString: string, slot: WeaponPerkSlot) {
  const key = `${slot}:${recString}`;
  let recs = recommendationCache.get(key);
  if (!recs) {
    recs = recString.split(/[\/\n]+/).flatMap(raw => {
      const token = raw.trim();
      return canonicalScorePerk(token, slot) ? [token] : token.split(',').map(value => value.trim());
    }).filter(Boolean);
    if (recommendationCache.size >= 1500) recommendationCache.delete(recommendationCache.keys().next().value!);
    recommendationCache.set(key, recs);
  }
  return recs;
}

export function evaluateCategoryPerks(
  recString: string,
  availablePerks: AvailablePerk[],
  perksMap: Record<number, { name: string; icon: string }>,
  slot: WeaponPerkSlot,
  enhancedToNormalMap: Record<number, number> = {}
): EvaluatedPerk[] {
  if (!recString || !recString.trim() || sourceScoreSlot(recString, slot).state === 'not-applicable') {
    return [];
  }

  const results: EvaluatedPerk[] = [];

  for (const rawRec of prepareRecommendations(recString, slot)) {

    const id = canonicalScorePerk(rawRec, slot);
    const recHash = id ? weaponPerkBaseHash(Number(id.slice(5)), slot) : null;
    let foundPerk: AvailablePerk | null = null;

    const matchesRec = (p: AvailablePerk) => {
      if (p.slots && !p.slots.includes(slot)) return false;
      if (recHash) return matchesWeaponPerk(enhancedToNormalMap[p.hash] || p.hash, recHash, slot, p.slots);
      // Unknown recommendation text must not match a different plug through fuzzy names.
      return false;
    };
    
    const isActive = (perk: AvailablePerk) => perk.activeSlots ? perk.activeSlots.includes(slot) : perk.active;
    // First pass: try to find an active matching perk
    for (const perk of availablePerks) {
      if (isActive(perk) && matchesRec(perk)) {
        foundPerk = perk;
        break;
      }
    }

    // Second pass: if no active match, try to find a selectable matching perk
    if (!foundPerk) {
      for (const perk of availablePerks) {
        if (matchesRec(perk)) {
          foundPerk = perk;
          break;
        }
      }
    }

    if (foundPerk) {
      results.push({
        name: perksMap[foundPerk.hash]?.name || foundPerk.name,
        hash: foundPerk.hash,
        icon: foundPerk.icon,
        matched: true,
        status: isActive(foundPerk) ? 'active' : 'selectable',
      });
    } else {
      // Localized display name and icon for missing perks
      const displayName = recHash ? getLocalizedPerkName(recHash, rawRec) : rawRec;
      const missingIcon = recHash ? getPerkIcon(recHash) : null;
      results.push({
        name: displayName,
        hash: recHash || undefined,
        icon: missingIcon || undefined,
        matched: false,
        status: 'missing',
      });
    }
  }

  return results;
}

