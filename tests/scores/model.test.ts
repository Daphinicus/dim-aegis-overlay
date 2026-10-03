import { describe, it, expect } from 'vitest';
import fixtures from '../../docs/score-acceptance-fixtures.json';
import { evaluateWeaponScore, weaponCeiling } from '../../src/score-model';
import { formatScore, compareScores } from '../../src/score-format';
import { readScoreSettings, SCORE_SLOTS } from '../../src/score-config';
import type { ScoreSource, OwnedScoreSnapshot, ScorePrecision } from '../../src/score-types';
const sources = fixtures.sources as Record<string, any>;
function evaluate(c: any) {
  const s = sources[c.source];
  const source: ScoreSource = { ...s, rowId: c.source, sourceRevision: 'fixture', slots: Object.fromEntries(SCORE_SLOTS.map(slot => {
    const recs = s.recommendations[slot];
    return [slot, recs === null ? { state: 'unknown', reason: 'unknown-source' } : recs.length ? { state: 'ranked', recommendations: recs } : { state: 'not-applicable' }];
  })) };
  const owned: OwnedScoreSnapshot = { schemaVersion: 1, itemHash: 1, slots: Object.fromEntries(SCORE_SLOTS.map(slot => [slot, c.owned[slot] === null ? { state: 'unknown', reason: 'fixture' } : { state: 'known', available: c.owned[slot] }])) as OwnedScoreSnapshot['slots'] };
  return evaluateWeaponScore(source, owned, c.originLegalSets);
}
describe('portable scoring contract', () => {
  for (const c of fixtures.scoreCases) it(c.id, () => {
    const r = evaluate(c);
    for (const [field, actual] of Object.entries({ ceiling: r.ceiling, best: r.best.value, omni: r.omni.value, quality: r.quality, coverage: r.coverage, allFirstChoices: r.allFirstChoices, fullCoverage: r.fullCoverage, bestPerfectOverall: r.best.perfectOverall, omniPerfectOverall: r.omni.perfectOverall })) {
      const expected = (c.expected as Record<string, any>)[field];
      if (typeof expected === 'number') expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(fixtures.rawTolerance);
      else expect(actual).toBe(expected);
    }
  });
  for (const c of fixtures.rankCases) it(c.id, () => {
    const r = weaponCeiling(c.tier, c.rank, c.rankBounds as [number, number] | null);
    if (c.expected === null) expect(r).toBeNull();
    else expect(r).toBeCloseTo(c.expected, 9);
  });
  for (const [i, c] of fixtures.formatCases.entries()) it(`format ${i}: ${c.expected}`, () => {
    expect(formatScore({ value: c.value, perfectOverall: c.perfectOverall }, c.precision as ScorePrecision)).toBe(c.expected);
  });
  for (const c of fixtures.orderingCases) for (const p of c.profiles) it(`${p}: ${c.lower} < ${c.higher}`, () => {
    const low = evaluate(fixtures.scoreCases.find(x => x.id === c.lower));
    const high = evaluate(fixtures.scoreCases.find(x => x.id === c.higher));
    expect((low as any)[p].value).toBeLessThan((high as any)[p].value);
  });
});
it('validates storage and does not sort unknown as zero', () => {
  expect(readScoreSettings({ aegisScorePrecision: '2', aegisScoreProfile: 'bad', aegisRatingDisplay: null })).toEqual({ aegisRatingDisplay: 'grades', aegisScoreProfile: 'best', aegisScorePrecision: 0, aegisScoreShowPercent: true, aegisScoreComparisonActivity: 'pve' });
  expect(compareScores({ value: 0, perfectOverall: false }, { value: null, perfectOverall: false })).toBe(-1);
});
