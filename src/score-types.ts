export type ScoreActivity = 'pve' | 'pvp';
export type ScoreProfile = 'best' | 'omni';
export type ScorePrecision = 0 | 1 | 2;
export type ScoreSlot = 'barrel' | 'mag' | 'perk1' | 'perk2' | 'masterwork' | 'origin';
export type CanonicalPerkId = string;
export type SourceSlot = { state: 'ranked'; recommendations: readonly CanonicalPerkId[] }
  | { state: 'not-applicable' } | { state: 'unknown'; reason: string };
export type OwnedSlot = { state: 'known'; available: readonly CanonicalPerkId[] }
  | { state: 'unknown'; reason: string };
export interface OwnedScoreSnapshot {
  schemaVersion: 1;
  itemHash: number;
  instanceId?: string;
  slots: Record<ScoreSlot, OwnedSlot>;
}
export interface RawOwnedScoreSnapshot {
  schemaVersion: 1;
  itemHash: number;
  instanceId?: string;
  slots: Record<Exclude<ScoreSlot, 'masterwork'>,
    { state: 'known'; availableHashes: readonly number[] } | { state: 'unknown'; reason: string }>;
  masterwork: { state: 'known'; statHash: number } | { state: 'none' } | { state: 'unknown'; reason: string };
}
export interface ScoreSource {
  activity: ScoreActivity;
  rowId: string;
  sourceRevision: string;
  categoryKey: string;
  weaponName?: string;
  frame?: string;
  versionTag?: string;
  tier: string;
  rank: number | null;
  rankBounds: readonly [number, number] | null;
  slots: Record<ScoreSlot, SourceSlot>;
  reason?: string;
}
export interface ScoreValue {
  value: number | null;
  perfectOverall: boolean;
  reason?: string;
}
export interface SlotScoreBreakdown {
  slot: ScoreSlot;
  weight: number;
  bestIndex: number | null;
  quality: number;
  coverage: number | null;
  benchmarkCapacity?: number;
  reason?: string;
}
export interface WeaponScoreEvaluation {
  modelVersion: string;
  sourceRevision: string;
  sourceId: string;
  ceiling: number | null;
  quality: number | null;
  coverage: number | null;
  allFirstChoices: boolean;
  fullCoverage: boolean;
  best: ScoreValue;
  omni: ScoreValue;
  slots: readonly SlotScoreBreakdown[];
}
export type ScoreEvaluations = Partial<Record<ScoreActivity, WeaponScoreEvaluation>>;
export interface ScoreSettings {
  aegisRatingDisplay: 'grades' | 'scores';
  aegisScoreProfile: ScoreProfile;
  aegisScorePrecision: ScorePrecision;
  aegisScoreShowPercent: boolean;
  aegisScoreComparisonActivity: ScoreActivity;
}
