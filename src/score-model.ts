import { SCORE_CAPACITIES, SCORE_CEILINGS, SCORE_MODEL_VERSION, SCORE_SLOTS, SCORE_WEIGHTS } from './score-config';
import type { OwnedScoreSnapshot, ScoreSource, SlotScoreBreakdown, WeaponScoreEvaluation } from './score-types';

export const recommendationCredit = (index: number): number => 0.90 + 0.10 * Math.pow(0.60, index);
export function weaponCeiling(tier: string, rank: number | null, bounds: readonly [number, number] | null): number | null {
  const top = Object.hasOwn(SCORE_CEILINGS, tier) ? SCORE_CEILINGS[tier] : undefined;
  if (top === undefined) return null;
  if (rank === null) return top;
  if (!Number.isFinite(rank) || !bounds || !bounds.every(Number.isFinite) || bounds[0] > bounds[1] || rank < bounds[0] || rank > bounds[1]) return null;
  return top - (bounds[1] > bounds[0] ? 4 * (rank - bounds[0]) / (bounds[1] - bounds[0]) : 0);
}

export function unratedScore(reason: string, revision = '', sourceId = ''): WeaponScoreEvaluation {
  return { modelVersion: SCORE_MODEL_VERSION, sourceRevision: revision, sourceId, ceiling: null, quality: null,
    coverage: null, allFirstChoices: false, fullCoverage: false, best: { value: null, perfectOverall: false, reason },
    omni: { value: null, perfectOverall: false, reason }, slots: [] };
}

/** Pure official recommendation index. Origin sets are complete legal combinations, never pooled plug lists. */
export function evaluateWeaponScore(source: ScoreSource, owned: OwnedScoreSnapshot,
  originLegalSets: readonly (readonly string[])[] | null = null): WeaponScoreEvaluation {
  if (source.reason) return unratedScore(source.reason, source.sourceRevision, source.rowId);
  const ceiling = weaponCeiling(source.tier, source.rank, source.rankBounds);
  if (ceiling === null || !source.categoryKey) return unratedScore('unresolved-ranking', source.sourceRevision, source.rowId);
  const applicable = SCORE_SLOTS.filter(s => source.slots[s].state !== 'not-applicable');
  if (!applicable.length) return unratedScore('no-criteria', source.sourceRevision, source.rowId);
  for (const slot of applicable) {
    const rec = source.slots[slot];
    if (rec.state === 'unknown') return { ...unratedScore(rec.reason, source.sourceRevision, source.rowId), ceiling };
    if (rec.state === 'ranked' && !rec.recommendations.length) return { ...unratedScore('empty-recommendations', source.sourceRevision, source.rowId), ceiling };
    if (owned.slots[slot].state === 'unknown') return { ...unratedScore(`unknown-owned-${slot}`, source.sourceRevision, source.rowId), ceiling };
  }
  const total = applicable.reduce((sum, s) => sum + SCORE_WEIGHTS[source.activity][s], 0);
  let quality = 0, coverage = 0, allFirstChoices = true, fullCoverage = true;
  let coverageReason: string | undefined;
  const breakdown: SlotScoreBreakdown[] = [];
  for (const slot of applicable) {
    const rec = source.slots[slot], available = owned.slots[slot];
    if (rec.state !== 'ranked' || available.state !== 'known') continue;
    const recommendations = [...new Set(rec.recommendations)];
    const own = new Set(available.available);
    const matched = recommendations.map((id, index) => own.has(id) ? index : -1).filter(i => i >= 0);
    const weight = SCORE_WEIGHTS[source.activity][slot] / total;
    const q = matched.length ? recommendationCredit(matched[0]) : 0;
    quality += weight * q;
    allFirstChoices &&= own.has(recommendations[0]);
    let numerator: number, denominator: number, complete: boolean;
    let reason: string | undefined;
    const capacity = Math.min(recommendations.length, SCORE_CAPACITIES[slot]);
    if (slot === 'origin' && recommendations.length > 1) {
      if (!originLegalSets?.length || !originLegalSets.some(set => [...own].every(id => set.includes(id)))) {
        reason = originLegalSets?.length ? 'inconsistent-origin-benchmark' : 'unknown-origin-benchmark';
        coverageReason = reason;
        fullCoverage = false;
        breakdown.push({ slot, weight, bestIndex: matched[0] ?? null, quality: weight * q, coverage: null, reason });
        continue;
      }
      const legalCredit = originLegalSets.map(set => recommendations.reduce((sum, id, i) => sum + (set.includes(id) ? recommendationCredit(i) : 0), 0));
      denominator = Math.max(...legalCredit);
      numerator = matched.reduce((sum, i) => sum + recommendationCredit(i), 0);
      complete = originLegalSets.some((set, i) => legalCredit[i] === denominator && recommendations.every(id => own.has(id) === set.includes(id)));
    } else {
      denominator = recommendations.slice(0, capacity).reduce((sum, _, i) => sum + recommendationCredit(i), 0);
      numerator = matched.slice(0, capacity).reduce((sum, i) => sum + recommendationCredit(i), 0);
      complete = recommendations.slice(0, capacity).every(id => own.has(id));
    }
    if (!denominator) {
      coverageReason = 'inconsistent-origin-benchmark'; fullCoverage = false;
      breakdown.push({ slot, weight, bestIndex: matched[0] ?? null, quality: weight * q, coverage: null, reason: coverageReason });
      continue;
    }
    const c = Math.min(1, numerator / denominator);
    coverage += weight * c;
    fullCoverage &&= complete;
    breakdown.push({ slot, weight, bestIndex: matched[0] ?? null, quality: weight * q, coverage: weight * c, benchmarkCapacity: slot === 'origin' && recommendations.length > 1 ? undefined : capacity });
  }
  const bestPerfect = ceiling === 100 && allFirstChoices;
  const omniPerfect = bestPerfect && fullCoverage && !coverageReason;
  const bounded = (n: number, perfect: boolean): number => perfect ? 100 : Math.min(100 - Number.EPSILON * 100, Math.max(0, n));
  return { modelVersion: SCORE_MODEL_VERSION, sourceRevision: source.sourceRevision, sourceId: source.rowId, ceiling,
    quality, coverage: coverageReason ? null : coverage, allFirstChoices, fullCoverage: fullCoverage && !coverageReason,
    best: { value: bounded(ceiling * quality, bestPerfect), perfectOverall: bestPerfect },
    omni: { value: coverageReason ? null : bounded(ceiling * (.9 * quality + .1 * coverage), omniPerfect), perfectOverall: omniPerfect, reason: coverageReason }, slots: breakdown };
}
