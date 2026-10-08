import type { AegisSheetDatabase } from './types';
import type { OwnedScoreSnapshot, ScoreActivity, ScoreSource, WeaponScoreEvaluation } from './score-types';
import { buildScoreSourceIndex } from './score-source';
import { evaluateWeaponScore, unratedScore } from './score-model';
import { getEnglishWeaponNameFromHash } from './hash-translator';
import { ORIGIN_BENCHMARK_REVISION, resolveOriginSets } from './score-origins';
import { SCORE_MODEL_VERSION } from './score-config';
import { findVariantByItemMetadata } from './weapon-variant';

interface SourceIndex { rows: Map<string, ScoreSource>; families: Map<string, ScoreSource[]> }
const indexes = new WeakMap<AegisSheetDatabase, Partial<Record<ScoreActivity, SourceIndex>>>();
const evaluations = new Map<string, WeaponScoreEvaluation>();
const MAX_SCORE_CACHE = 4000;
let hits = 0, misses = 0;
export function scoreCacheStats() { return { entries: evaluations.size, hits, misses }; }
export function clearScoreCache(): void { evaluations.clear(); hits = 0; misses = 0; }
const baseName = (name: string): string => name.toLowerCase().trim()
  .replace(/\s*\([^)]*\)\s*$/, '')
  .replace(/\s+(brave|pantheon|rotn|legacy|adept|timelost|harrowed|re-issue|reissued)(\s+version)?$/, '').trim();

export function evaluateOwnedActivity(db: AegisSheetDatabase | null, activity: ScoreActivity,
  name: string, owned: OwnedScoreSnapshot): WeaponScoreEvaluation {
  if (!db) return unratedScore('missing-source');
  let byActivity = indexes.get(db);
  if (!byActivity) { byActivity = {}; indexes.set(db, byActivity); }
  let index = byActivity[activity];
  if (!index) {
    const rows = buildScoreSourceIndex(db, activity);
    const families = new Map<string, ScoreSource[]>();
    for (const [name, source] of rows) {
      const family = baseName(source.weaponName ?? name), group = families.get(family) ?? [];
      group.push(source); families.set(family, group);
    }
    index = { rows, families }; byActivity[activity] = index;
  }
  const english = (getEnglishWeaponNameFromHash(owned.itemHash) ?? name).toLowerCase().trim();
  const base = baseName(english);
  const candidates = index.families.get(base) ?? [];
  let source: ScoreSource | undefined;
  if (candidates.length === 1) source = candidates[0];
  else if (candidates.length > 1) {
    const metadata = findVariantByItemMetadata(candidates, owned.itemHash);
    if (metadata) source = metadata;
    const origin = owned.slots.origin;
    const discriminated = origin.state === 'known' ? candidates.filter(c => c.slots.origin.state === 'ranked' && c.slots.origin.recommendations.some(id => origin.available.includes(id))) : [];
    if (!source && discriminated.length === 1) source = discriminated[0];
    else if (!source) {
      // Exact named special editions can resolve identity; a generic name cannot select a reissue by perk quality.
      const exact = candidates.filter(c => index.rows.get(english) === c);
      if (english !== base && exact.length === 1) source = exact[0];
    }
  }
  if (!source) return unratedScore(candidates.length ? 'unresolved-variant' : 'missing-source');
  const key = JSON.stringify([activity, owned.itemHash, owned.instanceId, owned.slots, source.rowId, source.sourceRevision, ORIGIN_BENCHMARK_REVISION, SCORE_MODEL_VERSION]);
  const cached = evaluations.get(key);
  if (cached) { hits++; return cached; }
  misses++;
  const result = evaluateWeaponScore(source, owned, resolveOriginSets(owned.itemHash, source.rowId));
  if (evaluations.size >= MAX_SCORE_CACHE) evaluations.delete(evaluations.keys().next().value!);
  evaluations.set(key, result);
  return result;
}

export function scoreInputSource(db: AegisSheetDatabase | null, activity: ScoreActivity, sourceId: string): ScoreSource | undefined {
  return db ? [...(indexes.get(db)?.[activity]?.rows.values() ?? [])].find(row => row.rowId === sourceId) : undefined;
}
