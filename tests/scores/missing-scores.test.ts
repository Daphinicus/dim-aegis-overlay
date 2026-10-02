import { describe, expect, it } from 'vitest';
import { canonicalScorePerk, sourceScoreSlot } from '../../src/score-source';
import { extractRawOwnedSnapshot, parseOwnedSnapshot } from '../../src/score-owned';

describe('source text behind missing scores', () => {
  it('preserves commas inside canonical origin names and recommendation order', () => {
    expect(sourceScoreSlot('Nail, Meet Hammer', 'origin')).toEqual({ state: 'ranked', recommendations: ['perk:1209885908'] });
    expect(sourceScoreSlot('Omolon Fluid Dynamics\nNail, Meet Hammer', 'origin')).toEqual({ state: 'ranked', recommendations: ['perk:1186131696', 'perk:1209885908'] });
    expect(sourceScoreSlot('Threat Detector, Subsistence', 'perk1')).toEqual({ state: 'ranked', recommendations: [canonicalScorePerk('Threat Detector'), canonicalScorePerk('Subsistence')] });
  });
  it('resolves recorded sheet spellings without guessing unknown or uncertain text', () => {
    expect(sourceScoreSlot('Hammer-forged Rifling\nFluted Barrel Barrel\nCorkscrew Rifling', 'barrel')).toEqual({ state: 'ranked', recommendations: [canonicalScorePerk('Hammer-forged Rifling'), 'perk:1124871858', canonicalScorePerk('Corkscrew Rifling')] });
    expect(sourceScoreSlot('Ricochet\nExtended Magazine', 'mag')).toEqual({ state: 'ranked', recommendations: ['perk:1885400500', 'perk:1890997540'] });
    expect(sourceScoreSlot('Tempered Truss\nAuxiliary\nBallistic Tuning', 'barrel')).toEqual({ state: 'ranked', recommendations: ['perk:5699512', 'perk:580685494', canonicalScorePerk('Ballistic Tuning')] });
    expect(sourceScoreSlot('High Explosive\nSpike Grenades', 'mag')).toEqual({ state: 'ranked', recommendations: ['perk:1380253176', canonicalScorePerk('Spike Grenades')] });
    expect(sourceScoreSlot('Unverified Magazine', 'mag').state).toBe('unknown');
    expect(sourceScoreSlot('Headseeker (???)\nKill Clip', 'perk2').state).toBe('unknown');
  });
  it('matches Cooling Efficiency and Persistence by stat identity', () => {
    for (const [hash, name, canonical] of [[4006394725, 'Cooling Efficiency', 'heat efficiency'], [3085395333, 'Persistence', 'persistence']] as const) {
      const item = { hash: 1, id: 'captured-shape', masterworkInfo: { stats: [{ hash, isPrimary: true }] }, sockets: { fromDefinitions: false, allSockets: [] } };
      expect(parseOwnedSnapshot(JSON.stringify(extractRawOwnedSnapshot(item)), 1, () => null, item.id).slots.masterwork).toEqual({ state: 'known', available: [`stat:${canonical}`] });
      expect(sourceScoreSlot(name, 'masterwork')).toEqual({ state: 'ranked', recommendations: [`stat:${canonical}`] });
    }
  });
});
import craftedFixtures from './fixtures/crafted-no-masterwork.json';
import pve from '../../data/pve-database.json';
import pvp from '../../data/pvp-database.json';
import { canonicalScoreHash } from '../../src/score-source';
import { evaluateOwnedActivity } from '../../src/score-runtime';
import type { AegisSheetDatabase } from '../../src/types';

describe('captured crafted weapons with no masterwork bonus', () => {
  for (const fixture of craftedFixtures.items) it(`scores ${fixture.name} with zero masterwork credit`, () => {
    const item = { ...fixture, id: 'captured-instance' };
    const raw = extractRawOwnedSnapshot(item);
    expect(raw.masterwork).toEqual({ state: 'none' });
    const owned = parseOwnedSnapshot(JSON.stringify(raw), item.hash, canonicalScoreHash, item.id);
    expect(owned.slots.masterwork).toEqual({ state: 'known', available: [] });
    for (const [activity, db] of [['pve', pve], ['pvp', pvp]] as const) {
      const result = evaluateOwnedActivity(db as AegisSheetDatabase, activity, item.name, owned);
      expect(result.best.value).not.toBeNull();
      expect(result.slots.find(slot => slot.slot === 'masterwork')).toMatchObject({ quality: 0, coverage: 0, weight: 0.06 });
      expect(result.allFirstChoices).toBe(false);
    }
  });
  it('keeps missing, contradictory, or definition-only metadata unknown', () => {
    const fixture = craftedFixtures.items.find(x => x.name === 'Explosive Personality')!;
    const original = { ...fixture, id: 'captured-instance' };
    const mutations = [
      (item: any) => { item.masterworkInfo = undefined; },
      (item: any) => { item.sockets.fromDefinitions = true; },
      (item: any) => { delete item.sockets.allSockets[0].plugged.plugDef.investmentStats; },
      (item: any) => { item.sockets.allSockets[0].plugged.plugDef.investmentStats = [{ statTypeHash: 943549884, value: 10 }]; },
      (item: any) => { delete item.sockets.allSockets[0].plugged.stats; },
      (item: any) => { item.sockets.allSockets[0].plugged.stats = { 943549884: { value: 10 } }; },
      (item: any) => { item.crafted = false; },
      (item: any) => { item.sockets.allSockets = item.sockets.allSockets.filter((s: any) => s.plugged.plugDef.hash !== 233125175); },
    ];
    for (const mutate of mutations) {
      const item = structuredClone(original); mutate(item);
      expect(extractRawOwnedSnapshot(item).masterwork.state).toBe('unknown');
    }
  });
  it('ignores crafted frame previews and recognizes selected bonus changes', () => {
    const fixture = craftedFixtures.items.find(x => x.name === 'Explosive Personality')!;
    const item: any = structuredClone({ ...fixture, id: 'captured-instance' });
    const frame = item.sockets.allSockets[0];
    frame.actuallyPlugged = frame.plugged;
    frame.plugged = { plugDef: { hash: 621911507, plug: { plugCategoryIdentifier: 'intrinsics' }, investmentStats: [{ statTypeHash: 943549884, value: 10 }] }, stats: { 943549884: { value: 10 } } };
    expect(extractRawOwnedSnapshot(item).masterwork).toEqual({ state: 'none' });
    item.masterworkInfo = { stats: [{ hash: 943549884, isPrimary: true, value: 10 }] };
    expect(extractRawOwnedSnapshot(item).masterwork).toEqual({ state: 'known', statHash: 943549884 });
    item.masterworkInfo.stats[0].value = 20;
    expect(extractRawOwnedSnapshot(item).masterwork).toEqual({ state: 'known', statHash: 943549884 });
  });
});
