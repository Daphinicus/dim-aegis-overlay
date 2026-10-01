import registry from '../data/score-origin-benchmarks.json';
export interface OriginBenchmarkRecord {
  itemHashes: number[];
  sourceIds: string[];
  legalSets: string[][];
  maximumVerified: boolean;
  evidence: string[];
}
export const ORIGIN_BENCHMARK_REVISION = registry.revision;
/** Empty/partial metadata never pretends to prove the maximum for a real weapon. */
export function resolveOriginSets(itemHash: number, sourceId: string,
  records: readonly OriginBenchmarkRecord[] = registry.records): readonly (readonly string[])[] | null {
  const matches = records.filter(r => r.maximumVerified && r.evidence.length && r.itemHashes.includes(itemHash) && r.sourceIds.includes(sourceId));
  return matches.length === 1 && matches[0].legalSets.length ? matches[0].legalSets : null;
}
