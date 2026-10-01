import { it, expect } from 'vitest';
import { extractRawOwnedSnapshot, parseOwnedSnapshot } from '../../src/score-owned';
import { canonicalScorePerk, canonicalScoreHash, buildScoreSourceIndex, sourceScoreSlot } from '../../src/score-source';
import { getPerkHashFromEnglish } from '../../src/hash-translator';
import { evaluateOwnedActivity } from '../../src/score-runtime';
import { resolveOriginSets } from '../../src/score-origins';
import { parseScorePredicate, matchesScorePredicate } from '../../src/score-search';
import { scoreRowMetadata } from '../../scripts/score-sync.mjs';
import pve from '../../data/pve-database.json';
import pvp from '../../data/pvp-database.json';
import type { AegisSheetDatabase } from '../../src/types';
import type { OwnedScoreSnapshot } from '../../src/score-types';
import { SCORE_SLOTS } from '../../src/score-config';
const pveDb = pve as AegisSheetDatabase, pvpDb = pvp as AegisSheetDatabase;
const plug = (hash: number, id: string) => ({ plugDef: { hash, plug: { plugCategoryIdentifier: id } } });
function modeledItem() {
  return { hash: 123, id: 'instance', crafted: false, sockets: { fromDefinitions: false, allSockets: [
    { socketIndex: 1, plugged: plug(1, 'weapon_barrels'), plugOptions: [plug(1,'weapon_barrels'),plug(2,'weapon_barrels')], reusablePlugItems: [{plugItemHash:1},{plugItemHash:2}], hasRandomizedPlugItems:true },
    { socketIndex: 2, plugged: plug(3, 'weapon_magazines'), reusablePlugItems: [{plugItemHash:3}] },
    { socketIndex: 3, plugged: plug(4, 'weapon_perks'), reusablePlugItems: [{plugItemHash:4},{plugItemHash:5},{plugItemHash:6}] },
    { socketIndex: 4, plugged: plug(7, 'weapon_perks'), reusablePlugItems: [{plugItemHash:7},{plugItemHash:8},{plugItemHash:9}] },
    { socketIndex: 5, plugged: plug(10, 'origin_traits'), plugOptions: [plug(10,'origin_traits'),plug(11,'origin_traits')], hasRandomizedPlugItems:false }
  ] }, masterworkInfo: { stats: [{ hash: 1240592695, isPrimary: true, value:1 }] } };
}
it('extracts live runtime choices; previews and crafting pools cannot inflate ownership', () => {
  const item = modeledItem();
  const first = extractRawOwnedSnapshot(item);
  expect(first.slots.perk1).toEqual({ state:'known', availableHashes:[4,5,6] });
  const socket = item.sockets.allSockets[2] as any;
  socket.actuallyPlugged=socket.plugged; socket.plugged=plug(999,'weapon_perks');
  socket.plugOptions=[plug(999,'weapon_perks')]; socket.plugSet={plugs:[plug(1000,'weapon_perks')]};
  expect(extractRawOwnedSnapshot(item)).toEqual(first);
  (item as any).crafted='crafted';
  expect(extractRawOwnedSnapshot(item).slots.perk1).toEqual({state:'known',availableHashes:[4]});
  item.sockets.fromDefinitions=true;
  expect(extractRawOwnedSnapshot(item).slots.perk1.state).toBe('unknown');
});
it('keeps socket identity and masterwork changes even with identical flat hash sets', () => {
  const item=modeledItem(); const before=extractRawOwnedSnapshot(item);
  item.sockets.allSockets[2].socketIndex=4; item.sockets.allSockets[3].socketIndex=3;
  const moved=extractRawOwnedSnapshot(item); expect(moved.slots.perk1).toEqual(before.slots.perk2);
  item.masterworkInfo.stats[0].hash=155624089;
  expect(extractRawOwnedSnapshot(item).masterwork).toEqual({state:'known',statHash:155624089});
});
it('validates stale instance IDs, corrupt data, unknown hashes, and enhanced duplicates', () => {
  const raw=extractRawOwnedSnapshot(modeledItem());
  const resolve=(h:number)=>h===6? 'id:5':`id:${h}`;
  const parsed=parseOwnedSnapshot(JSON.stringify(raw),123,resolve,'instance');
  expect(parsed.slots.perk1).toEqual({state:'known',available:['id:4','id:5']});
  expect(parsed.slots.masterwork).toEqual({state:'known',available:['stat:range']});
  expect(parseOwnedSnapshot(JSON.stringify(raw),123,resolve,'different').slots.perk1.state).toBe('unknown');
  expect(parseOwnedSnapshot('{bad',123,resolve).slots.barrel.state).toBe('unknown');
  expect(parseOwnedSnapshot(JSON.stringify(raw),123,()=>null).slots.barrel.state).toBe('unknown');
});
it('does not borrow manifest options when a random socket has incomplete runtime data', () => {
  const item=modeledItem();delete (item.sockets.allSockets[0] as any).reusablePlugItems;
  expect(extractRawOwnedSnapshot(item).slots.barrel.state).toBe('unknown');
});
it('shared sync preserves Finnald Type, Slot and Affinity independently', () => {
  const row=['Auto Rifle','Energy','Solar'];const map:any={Type:0,Slot:1,Affinity:2};
  const get=(row:string[],keys:string[])=>row[map[keys[0]]]??'';
  expect(scoreRowMetadata(get,row,'Legendary Weapons',4)).toEqual({categoryKey:'Auto Rifle',weaponType:'Auto Rifle',weaponSlot:'Energy',affinity:'Solar',sourceRowId:'Legendary Weapons:4'});
});
it('normalizes official identities without fuzzy matching or reordering', () => {
  expect(canonicalScorePerk('Enhanced Incandescent')).toBe(canonicalScorePerk('Incandescent'));
  const base=getPerkHashFromEnglish('Incandescent')!;
  expect(canonicalScoreHash(999,{999:base})).toBe(canonicalScorePerk('Incandescent'));
  expect(sourceScoreSlot('None (Has access to Stocks instead)','barrel').state).toBe('not-applicable');
  expect(sourceScoreSlot('','mag').state).toBe('unknown');
  expect(sourceScoreSlot('Headseeker (???)','perk2').state).toBe('unknown');
  expect(sourceScoreSlot('Threat Detector\nSubsistence','perk1')).toEqual({state:'ranked',recommendations:[canonicalScorePerk('Threat Detector'),canonicalScorePerk('Subsistence')]});
});
it('real source first choices reproduce calibration and reuse cached results', () => {
  const index=buildScoreSourceIndex(pveDb,'pve');const s=index.get('no hesitation')!;
  const owned: OwnedScoreSnapshot={schemaVersion:1,itemHash:0,instanceId:'modeled',slots:Object.fromEntries(SCORE_SLOTS.map(slot=>[slot,s.slots[slot].state==='ranked'?{state:'known',available:[(s.slots[slot] as any).recommendations[0]]}:{state:'known',available:[]}])) as OwnedScoreSnapshot['slots']};
  const result=evaluateOwnedActivity(pveDb,'pve','No Hesitation',owned);
  expect(result.best.value).toBe(100);expect(result.omni.value).toBeCloseTo(95.9942778216259,9);
  expect(evaluateOwnedActivity(pveDb,'pve','No Hesitation',owned)).toBe(result);
  expect(evaluateOwnedActivity(null,'pvp','No Hesitation',owned).best.value).toBeNull();
  const pvpIndex=buildScoreSourceIndex(pvpDb,'pvp');
  expect(pvpIndex.get('abyss defiant')?.categoryKey).toBe('Auto Rifle');
  expect(pvpIndex.get('abyss defiant')?.rank).toBeNull();
});
it('origin benchmarks require matching identity and evidence; never union records', () => {
  expect(resolveOriginSets(1,'row')).toBeNull();
  const records=[{itemHashes:[1],sourceIds:['row'],legalSets:[['a','b'],['c','d']],maximumVerified:true,evidence:['synthetic-test']}];
  expect(resolveOriginSets(1,'row',records)).toEqual([['a','b'],['c','d']]);
  expect(resolveOriginSets(2,'row',records)).toBeNull();
  expect(resolveOriginSets(1,'row',[...records,...records])).toBeNull();
});
it('numeric predicates use raw activity-specific scores and reject malformed operands', () => {
  const scores:any={pve:{best:{value:89.999},omni:{value:null},fullCoverage:false},pvp:{best:{value:92},omni:{value:90},fullCoverage:true}};
  expect(matchesScorePredicate(parseScorePredicate('aegis:score:>=90')!,scores,'both','best')).toBe(true);
  expect(matchesScorePredicate(parseScorePredicate('aegis:pve:score:>=90')!,scores,'both','best')).toBe(false);
  expect(matchesScorePredicate(parseScorePredicate('aegis:pve:score:unrated')!,scores,'both','omni')).toBe(true);
  expect(matchesScorePredicate(parseScorePredicate('aegis:score:<90')!,scores,'pve','omni')).toBe(false);
  expect(matchesScorePredicate(parseScorePredicate('aegis:pve:score:>89.99')!,scores,'pve','best')).toBe(true);
  for (const query of ['score:>100.01','score:-1','score:NaN','score:>=90x']) expect(parseScorePredicate(query)).toBeNull();
});
