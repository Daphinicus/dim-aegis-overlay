import type { AegisMode } from './types';
import type { ScoreActivity, ScoreEvaluations, ScoreProfile } from './score-types';

export interface ScorePredicate { activity?: ScoreActivity; operation: 'unrated' | 'omni' | '>' | '>=' | '<' | '<=' | '='; threshold?: number }
export function parseScorePredicate(query: string): ScorePredicate | null {
  const match = /^(?:(pve|pvp):)?score:(unrated|omni|(?:>=|<=|>|<|=)?(?:\d+(?:\.\d+)?))$/i.exec(query.replace(/^aegis:/i, '').trim());
  if (!match) return null;
  const activity = match[1]?.toLowerCase() as ScoreActivity | undefined;
  const operand = match[2].toLowerCase();
  if (operand === 'unrated' || operand === 'omni') return { activity, operation: operand };
  const numeric = /^(>=|<=|>|<|=)?(.*)$/.exec(operand)!;
  const threshold = Number(numeric[2]);
  if (threshold < 0 || threshold > 100) return null;
  return { activity, operation: (numeric[1] || '=') as ScorePredicate['operation'], threshold };
}
export function matchesScorePredicate(predicate: ScorePredicate, scores: ScoreEvaluations | undefined, mode: AegisMode, profile: ScoreProfile): boolean {
  const activities: readonly ScoreActivity[] = predicate.activity ? [predicate.activity] : mode === 'both' ? ['pve', 'pvp'] : [mode];
  return activities.some(activity => {
    const evaluation = scores?.[activity], value = evaluation?.[profile].value ?? null;
    if (predicate.operation === 'unrated') return value === null;
    if (predicate.operation === 'omni') return !!evaluation?.fullCoverage;
    if (value === null) return false;
    switch (predicate.operation) {
      case '>': return value > predicate.threshold!;
      case '>=': return value >= predicate.threshold!;
      case '<': return value < predicate.threshold!;
      case '<=': return value <= predicate.threshold!;
      case '=': return value === predicate.threshold!;
    }
  });
}
