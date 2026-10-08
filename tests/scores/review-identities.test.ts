import { describe, expect, it } from 'vitest';
import { canonicalScoreHash, canonicalScorePerk, buildScoreSourceIndex, sourceScoreSlot } from '../../src/score-source';
import { evaluateOwnedActivity, scoreInputSource } from '../../src/score-runtime';
import { evaluateCategoryPerks } from '../../src/perk-evaluation';
import { findVariantByItemMetadata, weaponVariants } from '../../src/weapon-variant';
import { weaponPerkBaseHash } from '../../src/weapon-perk-identity';
import links from '../../data/trait-to-enhanced-trait.json';
import { computeGrade } from '../../src/grading';
import { matchesAegisArgument, compareGrades } from '../../src/aegis-search';
import { SCORE_SLOTS } from '../../src/score-config';
import pve from '../../data/pve-database.json';
import pvp from '../../data/pvp-database.json';
import type { AegisSheetDatabase } from '../../src/types';
import type { OwnedScoreSnapshot, ScoreSource } from '../../src/score-types';
const firstChoices = (source: ScoreSource, hash: number): OwnedScoreSnapshot => ({schemaVersion:1,itemHash:hash,slots:Object.fromEntries(SCORE_SLOTS.map(slot=>[slot,{state:'known',available:source.slots[slot].state==='ranked'?[source.slots[slot].recommendations[0]]:[]}])) as any});

describe('A01 verified enhancement identity',()=>{
  it('normalizes every verified indexed enhancement link in the trait family',()=>{
    let verified=0;
    for(const [normal,enhanced] of Object.entries(links)){
      const base=weaponPerkBaseHash(Number(normal),'perk2');
      if(base===null || weaponPerkBaseHash(enhanced,'perk2')===null) continue;
      expect(weaponPerkBaseHash(enhanced,'perk2')).toBe(base);verified++;
    }
    expect(verified).toBeGreaterThan(200);
  });
  it('uses Golden Tricorn enhancement links for source, owned score, and grade',()=>{
    expect(canonicalScoreHash(4290541820,{},'perk2')).toBe(canonicalScorePerk('Golden Tricorn','perk2'));
    expect(canonicalScorePerk('Golden Tricorn Enhanced','perk2')).toBe(canonicalScorePerk('Golden Tricorn','perk2'));
  });
  it('keeps modeled Optative first-choice grades and Best/Omni equal after enhancement',()=>{
    const db:any={categories:{HCs:[{name:'Optative',rank:'1',tier:'C',barrel:'Fluted Barrel',mag:'Alloy Magazine',perk1:'Repulsor Brace',perk2:'Golden Tricorn',origin:'Nano-Munitions',mw:'Reload'}]}};
    const source=buildScoreSourceIndex(db,'pve').get('optative')!;
    const normal=firstChoices(source,2814976388), enhanced=structuredClone(normal);
    enhanced.slots.perk2={state:'known',available:[canonicalScoreHash(4290541820,{},'perk2')!]};
    const before=evaluateOwnedActivity(db,'pve','Optative',normal),after=evaluateOwnedActivity(db,'pve','Optative',enhanced);
    expect(before.best.value).toBe(65);expect(before.omni.value).toBe(65);
    expect(after.best.value).toBe(before.best.value);expect(after.omni.value).toBe(before.omni.value);
    const status=evaluateCategoryPerks('Golden Tricorn',[{hash:4290541820,name:'localized',icon:'',active:true,slots:['perk2']}],{},'perk2')[0].status;
    expect(computeGrade('active',status,'active','active','active',false)).toBe('S+');
  });
  it('does not guess an enhancement from a name prefix or cross socket families',()=>{
    expect(canonicalScorePerk('Enhanced Battery','mag')).toBe('perk:2680121939');
    expect(canonicalScorePerk('Enhanced Battery','perk2')).toBeNull();
    expect(canonicalScorePerk('Enhanced Fluted Barrel','barrel')).toBeNull();
  });
});

describe('A02 activity grades and unavailable comparisons',()=>{
  const context:any={mode:'pve',chase:false};
  it('resolves single-mode No Hesitation S+ from the active grade',()=>{
    const data:any={result:{grade:'S+'}};
    expect(matchesAegisArgument('pve:>=s',data,context)).toBe(true);
    expect(matchesAegisArgument('pve:<a',data,context)).toBe(false);
    expect(matchesAegisArgument('pvp:>=s',data,context)).toBe(false);
    expect(matchesAegisArgument('pvp:>=s',data,{...context,mode:'pvp'})).toBe(true);
  });
  it('never treats unavailable Corrasion PvP as a zero grade',()=>{
    const data:any={result:{grade:'S+ | -',pveGrade:'S+',pvpGrade:''}};
    for(const query of ['pvp:<a','pvp:<=f','pvp:=f','pvp:f']) expect(matchesAegisArgument(query,data,{...context,mode:'both'})).toBe(false);
    expect(matchesAegisArgument('pve:>=s',data,{...context,mode:'both'})).toBe(true);
    for(const grade of ['', '-', 'unrated', '?', 'garbage']) expect(compareGrades(grade,'<a')).toBe(false);
    expect(compareGrades('F','<a')).toBe(true);
  });
});

describe('A04 duplicate High Albedo editions',()=>{
  it('recovers distinct category identity for cached PvP editions by source frame',()=>{
    const rows=[...buildScoreSourceIndex(pvp as AegisSheetDatabase,'pvp').values()].filter(row=>row.weaponName?.startsWith('High Albedo'));
    expect(rows.find(row=>row.frame==='Adaptive Burst')?.categoryKey).toBe('Sidearms');
    expect(rows.find(row=>row.frame==='Micro-Missile')?.categoryKey).toBe('Rocket Sidearms');
  });
  it('retains stable same-category frame identities without selecting ambiguous or unknown metadata',()=>{
    const base:any={name:'High Albedo',tier:'D',rank:'1',barrel:'Fluted Barrel',mag:'Alloy Magazine',perk1:'Threat Detector',perk2:'Unrelenting',mw:'Reload',origin:'None'};
    const db:any={categories:{Sidearms:[{...base,frame:'Adaptive Burst'},{...base,frame:'Micro-Missile'}]}};
    const sources=[...buildScoreSourceIndex(db,'pve').values()];
    expect(sources).toHaveLength(2);expect(new Set(sources.map(row=>row.rowId)).size).toBe(2);
    const reversed:any={categories:{Sidearms:[...db.categories.Sidearms].reverse()}};
    expect([...buildScoreSourceIndex(reversed,'pve').values()].map(row=>row.rowId).sort()).toEqual(sources.map(row=>row.rowId).sort());
    expect(findVariantByItemMetadata([{frame:'Adaptive Burst'},{frame:'Adaptive Burst'}],1197486957)).toBeNull();
    expect(findVariantByItemMetadata([{frame:'Adaptive Burst'},{}],1197486957)).toBeNull();
  });
  it('retains both rows and resolves legacy Primary by verified item metadata in either order',()=>{
    const original=pve as AegisSheetDatabase;
    const reordered={...original,categories:Object.fromEntries(Object.entries(original.categories).reverse().map(([name,rows])=>[name,[...rows].reverse()]))};
    const legacy=original.categories.Sidearms.find(row=>row.name==='High Albedo')!;
    const source:ScoreSource={activity:'pve',rowId:'legacy',sourceRevision:'modeled',categoryKey:'Sidearms',tier:'D',rank:38,rankBounds:[38,38],slots:Object.fromEntries(SCORE_SLOTS.map(slot=>[slot,sourceScoreSlot(legacy[slot==='masterwork'?'mw':slot],slot)])) as any};
    for(const db of [original,reordered]){
      const rows=weaponVariants(db,'High Albedo');
      expect(rows).toHaveLength(2);
      expect(findVariantByItemMetadata(rows,1197486957)?.frame).toBe('Adaptive Burst');
      expect(findVariantByItemMetadata(rows,2662459958)?.frame).toBe('Micro-Missile');
      expect(findVariantByItemMetadata(rows,0)).toBeNull();
      const index=buildScoreSourceIndex(db,'pve');
      expect([...index.values()].filter(row=>row.rowId.includes('High Albedo'))).toHaveLength(2);
      const result=evaluateOwnedActivity(db,'pve','localized weapon name',firstChoices(source,1197486957));
      expect(result.best.value).toBe(50);expect(result.omni.value).toBeCloseTo(49.1071428571,9);
      expect(scoreInputSource(db,'pve',result.sourceId)?.categoryKey).toBe('Sidearms');
      // DIM's legacy item has no origin socket: extraction leaves that slot unknown.
      const nativeLegacy=firstChoices(source,1197486957);nativeLegacy.slots.origin={state:'unknown',reason:'unknown-owned-origin'};
      const absentOrigin=evaluateOwnedActivity(db,'pve','High Albedo',nativeLegacy);
      expect(absentOrigin.best.value).toBe(50);expect(absentOrigin.omni.value).toBeCloseTo(49.1071428571,9);
    }
  });
});
