import type { ScoreActivity, ScoreSettings, ScoreSlot } from './score-types';
export const SCORE_MODEL_VERSION = 'aegis-score-v1';
export const SCORE_SLOTS: readonly ScoreSlot[] = ['barrel', 'mag', 'perk1', 'perk2', 'masterwork', 'origin'];
export const SCORE_CEILINGS: Readonly<Record<string, number>> = { S: 100, A: 90, B: 78, C: 65, D: 50, E: 37, F: 25 };
export const SCORE_WEIGHTS: Record<ScoreActivity, Record<ScoreSlot, number>> = {
  pve: { barrel: 8, mag: 12, perk1: 35, perk2: 35, masterwork: 6, origin: 4 },
  pvp: { barrel: 10, mag: 14, perk1: 34, perk2: 34, masterwork: 6, origin: 2 }
};
export const SCORE_CAPACITIES: Record<ScoreSlot, number> = { barrel: 2, mag: 2, perk1: 3, perk2: 3, masterwork: 1, origin: 1 };
export const SCORE_SETTING_KEYS = ['aegisRatingDisplay', 'aegisScoreProfile', 'aegisScorePrecision', 'aegisScoreComparisonActivity'] as const;
export function readScoreSettings(raw: Record<string, unknown>): ScoreSettings {
  return {
    aegisRatingDisplay: raw.aegisRatingDisplay === 'scores' ? 'scores' : 'grades',
    aegisScoreProfile: raw.aegisScoreProfile === 'omni' ? 'omni' : 'best',
    aegisScorePrecision: raw.aegisScorePrecision === 1 || raw.aegisScorePrecision === 2 ? raw.aegisScorePrecision : 0,
    aegisScoreComparisonActivity: raw.aegisScoreComparisonActivity === 'pvp' ? 'pvp' : 'pve'
  };
}
