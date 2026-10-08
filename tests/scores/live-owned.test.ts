import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/live-owned.json';
import { extractRawOwnedSnapshot, parseOwnedSnapshot } from '../../src/score-owned';
import { sourceScoreSlot } from '../../src/score-source';

function runtimeItem(fixture: typeof fixtures.items[number]) {
  const plug = (hash: number, category: string) => ({ plugDef: { hash, plug: { plugCategoryIdentifier: category } } });
  return {
    hash: fixture.itemHash, id: 'captured-instance', crafted: fixture.crafted,
    masterworkInfo: fixture.masterworkStats ? { stats: fixture.masterworkStats } : undefined,
    sockets: { fromDefinitions: fixture.fromDefinitions, allSockets: fixture.sockets.map(socket => ({
      socketIndex: socket.socketIndex, hasRandomizedPlugItems: socket.hasRandomizedPlugItems,
      plugged: plug(socket.plugged, socket.category),
      actuallyPlugged: socket.actual ? plug(socket.actual, socket.category) : undefined,
      reusablePlugItems: socket.reusable,
      plugOptions: socket.options.map(option => plug(option.hash, socket.category)),
      // Captured recipe counts never become selectable ownership.
      plugSet: socket.crafting ? { craftingData: { captured: true } } : undefined,
    })) },
  };
}

describe('captured DIM ownership', () => {
  for (const fixture of fixtures.items) {
    it(`reads the real barrel and magazine families on ${fixture.name}`, () => {
      const raw = extractRawOwnedSnapshot(runtimeItem(fixture));
      expect(raw.slots.barrel.state).toBe('known');
      expect(raw.slots.mag.state).toBe('known');
      const traits = fixture.sockets.filter(socket => socket.category === 'frames');
      if (traits.length === 2) {
        expect(raw.slots.perk1.state).toBe('known');
        expect(raw.slots.perk2.state).toBe('known');
      }
    });
  }
  it('retains actual alternatives on a random drop with crafting metadata', () => {
    const item = runtimeItem(fixtures.items.find(item => item.name === 'Explosive Personality')!);
    expect(item.crafted).toBe(false);
    expect(extractRawOwnedSnapshot(item).slots.perk1).toEqual({ state: 'known', availableHashes: [2779035018, 3300816228] });
    expect(extractRawOwnedSnapshot(item).slots.perk2).toEqual({ state: 'known', availableHashes: [3108830275] });
  });
  it('keeps crafted Regnant configured and excludes its recipe pools', () => {
    const fixture = fixtures.items.find(item => item.name === 'Regnant')!;
    expect(fixture.sockets.some(socket => socket.recipeCount > 10)).toBe(true);
    const raw = extractRawOwnedSnapshot(runtimeItem(fixture));
    expect(raw.slots.perk1).toEqual({ state: 'known', availableHashes: [3528046508] });
    expect(raw.slots.perk2).toEqual({ state: 'known', availableHashes: [2275087323] });
  });
  it('retains coexisting Accelerated Assault origins without claiming a verified maximum', () => {
    const item = runtimeItem(fixtures.items.find(item => item.name === 'Lotus-Eater')!);
    const raw = extractRawOwnedSnapshot(item);
    expect(raw.slots.origin).toEqual({ state: 'known', availableHashes: [1621842933, 2223800157, 2671305723] });
    expect(raw.masterwork).toEqual({ state: 'known', statHash: 1240592695 });
  });
  it('reads accuracy, shield duration, and heat efficiency as distinct masterworks', () => {
    for (const [name, stat] of [['Biting Winds', 'accuracy'], ['Ecliptic Distaff', 'shield duration'], ['All or Nothing', 'heat efficiency']]) {
      const item = runtimeItem(fixtures.items.find(item => item.name === name)!);
      const raw = extractRawOwnedSnapshot(item);
      expect(parseOwnedSnapshot(JSON.stringify(raw), item.hash, hash => `perk:${hash}`, item.id).slots.masterwork)
        .toEqual({ state: 'known', available: [`stat:${stat}`] });
      expect(sourceScoreSlot(stat, 'masterwork')).toEqual({ state: 'ranked', recommendations: [`stat:${stat}`] });
    }
  });
});
