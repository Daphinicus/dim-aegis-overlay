import { describe, it, expect } from 'vitest';
import fixture from '../fixtures/weapon-perk-collisions.json';
import { getPerkHashFromEnglish, getPerkIcon, getLocalizedPerkName, updateLocalizedRegistries } from '../../src/hash-translator';
import { weaponPerkBaseHash } from '../../src/weapon-perk-identity';
import { canonicalScoreHash, canonicalScorePerk, sourceScoreSlot } from '../../src/score-source';
import { evaluateCategoryPerks } from '../../src/perk-evaluation';
import { findVariantByOwnedOrigin } from '../../src/weapon-variant';
import { readDimPerks } from '../../src/dim-item-input';
import { computeGrade, evaluateCustomRoll, defaultRules } from '../../src/grading';
import { evaluateWeaponScore } from '../../src/score-model';
import { parseOwnedSnapshot } from '../../src/score-owned';
import { prepareMissingPlug } from '../../src/compare-native-tooltips';
import type { ScoreSlot, ScoreSource, OwnedScoreSnapshot } from '../../src/score-types';
const defs: Record<number, any> = fixture.definitions;
const collisions = [
  ['Lucky Shot',2054520291,896553940], ['Once More',2129059110,167605063],
  ['Trench Barrel',2360754333,806159697], ['Heat Sink',3772485195,1080094173],
  ['Longest Winter',2482418662,257592559], ['Heavy Metal',1964414318,1042964491]
] as const;
describe('official weapon identities', () => {
  for (const [name, trait, other] of collisions) it(`${name} uses the trait icon and tooltip definition`, () => {
    const normal=defs[trait], invalid=defs[other];
    updateLocalizedRegistries(Object.fromEntries([normal,invalid].map(d=>[d.hash,{name:d.displayProperties.name,icon:d.displayProperties.icon}])));
    for (const slot of ['perk1','perk2'] as const) {
      expect(getPerkHashFromEnglish(name,slot)).toBe(trait);
      expect(canonicalScorePerk(name,slot)).toBe(`perk:${trait}`);
      expect(canonicalScoreHash(other,{},slot)).toBeNull();
      expect(getPerkIcon(getPerkHashFromEnglish(name,slot)!)).toBe(normal.displayProperties.icon ?? null);
      const evaluated=evaluateCategoryPerks(name,[],{},slot)[0];
      expect(evaluated).toMatchObject({hash:trait,status:'missing',icon:normal.displayProperties.icon || undefined});
    }
    expect(getLocalizedPerkName(other)).toBe(invalid.displayProperties.name);
    const active={plugDef:normal}; const item={sockets:{allSockets:[{socketIndex:3,plugged:active,plugOptions:[active]}]}};
    let previewCalls=0;
    const preview=prepareMissingPlug(item,3,normal,{manifest:{d2Manifest:{}},dimApi:{settings:{customStats:[]}}},(_s:any,copy:any)=>{previewCalls++;return copy;});
    expect(preview?.plug.plugDef).toBe(normal);
    expect(prepareMissingPlug(item,3,invalid,{},()=>{throw Error('wrong-family preview');})).toBeUndefined();
    expect(previewCalls).toBe(1);
  });
  it('resolves literal Enhanced Battery and Enhanced Heatsink before variant prefixes',()=>{
    for(const name of ['Enhanced Battery','Enhanced Heatsink']){
      const hash=getPerkHashFromEnglish(name,'mag')!;
      expect(hash).toBeTruthy();
      expect(defs[hash].displayProperties.name).toBe(name);
      expect(defs[hash].itemTypeDisplayName).toBe('Battery');
      expect(defs[hash].plug.plugCategoryIdentifier).toBe('batteries');
      expect(canonicalScorePerk(name,'mag')).toBe(canonicalScoreHash(hash,{},'mag'));
      expect(sourceScoreSlot(name,'mag').state).toBe('ranked');
      expect(getPerkHashFromEnglish(name,'perk2')).toBeNull();
    }
    expect(canonicalScorePerk('Enhanced Incandescent','perk2')).toBe(canonicalScorePerk('Incandescent','perk2'));
    expect(canonicalScorePerk('Enhanced Fluted Barrel Barrel','barrel')).toBe(canonicalScorePerk('Fluted Barrel','barrel'));
  });
  it('preserves Hailstorm and Hail Storm as different exact traits',()=>{
    updateLocalizedRegistries(Object.fromEntries([2041229079,2000464223].map(hash=>[hash,{name:defs[hash].displayProperties.name,icon:defs[hash].displayProperties.icon}])));
    expect(getPerkHashFromEnglish('Hailstorm','perk2')).toBe(2041229079);
    expect(getPerkHashFromEnglish('Hail Storm','perk2')).toBe(2000464223);
    expect(getPerkHashFromEnglish('HAIL-STORM','perk2')).toBeNull();
    expect(getPerkHashFromEnglish('HAIL-STORM')).toBeNull();
    expect(weaponPerkBaseHash(2041229079)).not.toBe(weaponPerkBaseHash(2000464223));
    expect(canonicalScoreHash(2041229079,{},'perk2')).not.toBe(canonicalScoreHash(2000464223,{},'perk2'));
    const map={2000464223:{name:'Hail Storm',icon:'/x.png'}};
    const result=evaluateCategoryPerks('Hailstorm',[{hash:2000464223,...map[2000464223],active:true,slots:['perk2']}],map,'perk2');
    expect(result[0].status).toBe('missing');
  });
  it('separates the real Trench Barrel barrel from the trait and keeps stable valid score IDs',()=>{
    expect(getPerkHashFromEnglish('Trench Barrel','barrel')).toBe(806159697);
    expect(canonicalScoreHash(806159697,{},'barrel')).toBe('perk:806159697');
    expect(sourceScoreSlot('Trench Barrel','perk2')).toEqual({state:'ranked',recommendations:['perk:2360754333']});
    expect(canonicalScoreHash(2459015849,{},'perk2')).toBe('perk:2360754333');
    expect(sourceScoreSlot('Fluted Barrel','barrel')).toEqual({state:'ranked',recommendations:['perk:1124871858']});
    expect(sourceScoreSlot('Nail, Meet Hammer','origin')).toEqual({state:'ranked',recommendations:['perk:1209885908']});
    expect(getPerkHashFromEnglish('Lucky Shot','mag')).toBeNull();
    expect(canonicalScoreHash(896553940)).toBeNull();
  });
});
describe('grade and score input agreement',()=>{
  const plug=(hash:number,category:string)=>({plugDef:{hash,displayProperties:{name:'localized',icon:'/x.png'},plug:{plugCategoryIdentifier:category}}});
  it('rejects the wrong trait column and recipe options before calculating grade',()=>{
    const item:any={crafted:false,sockets:{allSockets:[
      {socketIndex:3,plugged:plug(2360754333,'frames'),plugOptions:[plug(2459015849,'frames')]},
      {socketIndex:4,plugged:plug(2054520291,'frames'),plugOptions:[plug(4170193963,'frames'),plug(2360754333,'frames')],reusablePlugItems:[{plugItemHash:2054520291}]}
    ]}};
    const {perksMap,activeHashes}=readDimPerks(item);
    expect(perksMap[2360754333].slots).toEqual(['perk1']);
    expect(perksMap[4170193963]).toBeUndefined();
    const available=Object.entries(perksMap).map(([hash,p])=>({hash:Number(hash),...p,active:activeHashes.includes(Number(hash))}));
    const correct=evaluateCategoryPerks('Trench Barrel',available,perksMap,'perk1');
    const wrong=evaluateCategoryPerks('Trench Barrel',available,perksMap,'perk2');
    expect(correct[0].status).toBe('active');expect(wrong[0].status).toBe('missing');
    expect(computeGrade('active',wrong[0].status,'active','active','active',false)).toBe('C');
    expect(evaluateCustomRoll(['active',wrong[0].status,'active','active','active'],defaultRules()).grade).toBe('C');
    item.crafted='crafted';
    expect(readDimPerks(item).perkHashes).toEqual([2360754333,2054520291]);
  });
  it('keeps selected state separate when a hash is available in both columns',()=>{
    const item:any={sockets:{allSockets:[
      {socketIndex:3,plugged:plug(2360754333,'frames'),plugOptions:[]},
      {socketIndex:4,plugged:plug(2054520291,'frames'),plugOptions:[plug(2360754333,'frames')]}
    ]}};
    const {perksMap,activeHashes}=readDimPerks(item);
    const available=Object.entries(perksMap).map(([hash,p])=>({hash:Number(hash),...p,active:activeHashes.includes(Number(hash))}));
    expect(evaluateCategoryPerks('Trench Barrel',available,perksMap,'perk1')[0].status).toBe('active');
    expect(evaluateCategoryPerks('Trench Barrel',available,perksMap,'perk2')[0].status).toBe('selectable');
    expect(evaluateCategoryPerks('None (Has access to Stocks instead)',available,perksMap,'barrel')).toEqual([]);
    expect(evaluateCategoryPerks('Trench Barrel, Lucky Shot',available,perksMap,'perk2')).toHaveLength(2);
  });
  it('keeps verified identities when runtime enhanced mappings are stale',()=>{
    const stale={2459015849:2054520291,806159697:2360754333};
    expect(canonicalScoreHash(2459015849,stale,'perk2')).toBe('perk:2360754333');
    expect(canonicalScoreHash(806159697,stale,'perk2')).toBeNull();
    expect(canonicalScoreHash(806159697,stale,'barrel')).toBe('perk:806159697');
    const map={2459015849:{name:'localized',icon:'/x.png'}};
    const available=[{hash:2459015849,...map[2459015849],active:true,slots:['perk2'] as const}];
    expect(evaluateCategoryPerks('Trench Barrel',available as any,map,'perk2',stale)[0].status).toBe('active');
    expect(evaluateCategoryPerks('Lucky Shot',available as any,map,'perk2',stale)[0].status).toBe('missing');
  });
  it('awards enhanced trait credit only in its actual slot; invalid bridge hashes stay unknown',()=>{
    const map={2459015849:{name:'localized',icon:'/x.png'}};
    expect(evaluateCategoryPerks('Trench Barrel',[{hash:2459015849,...map[2459015849],active:true,slots:['perk2']}],map,'perk2')[0].status).toBe('active');
    const raw:any={schemaVersion:1,itemHash:1,slots:{perk2:{state:'known',availableHashes:[806159697]}},masterwork:{state:'none'}};
    expect(parseOwnedSnapshot(JSON.stringify(raw),1,canonicalScoreHash).slots.perk2.state).toBe('unknown');
  });
});
// Independent arithmetic oracle: constants and formulas are written from the model contract,
// without importing its weight, capacity, or recommendation-credit helpers.
it('matches an independent Best/Omni calculation over 4,000 deterministic owned rolls',()=>{
  const slots:ScoreSlot[]=['barrel','mag','perk1','perk2','masterwork','origin'];
  const weights={pve:[8,12,35,35,6,4],pvp:[10,14,34,34,6,2]};
  const capacities=[2,2,3,3,1,1],tops=[100,90,78,65,50,37,25],tiers=['S','A','B','C','D','E','F'];
  const credit=(i:number)=>.9+.1*(.6**i);let seed=81273;
  const random=(n:number)=>{seed=(seed*16807)%2147483647;return seed%n;};
  for(let trial=0;trial<4000;trial++){
    const activity=trial%2?'pve':'pvp', tier=random(7),rank=random(10)+1;
    const source:ScoreSource={activity,rowId:'oracle',sourceRevision:'oracle',categoryKey:'Shotgun',tier:tiers[tier],rank,rankBounds:[1,10],slots:{} as any};
    const owned:OwnedScoreSnapshot={schemaVersion:1,itemHash:1,slots:{} as any};
    let quality=0,coverage=0,total=0,first=true,full=true;
    for(let j=0;j<slots.length;j++){
      const slot=slots[j];if(random(7)===0){source.slots[slot]={state:'not-applicable'};owned.slots[slot]={state:'known',available:[]};continue;}
      const count=slot==='origin'?1:random(5)+1, recs=Array.from({length:count},(_,i)=>`${slot}:${i}`);
      const have=recs.filter(()=>random(3)>0);source.slots[slot]={state:'ranked',recommendations:recs};owned.slots[slot]={state:'known',available:[...have,'unrecommended']};
      const indices=recs.flatMap((id,i)=>have.includes(id)?[i]:[]),weight=weights[activity][j];total+=weight;
      quality+=weight*(indices.length?credit(indices[0]):0);
      const max=Math.min(count,capacities[j]);coverage+=weight*indices.slice(0,max).reduce((sum,i)=>sum+credit(i),0)/recs.slice(0,max).reduce((sum,_,i)=>sum+credit(i),0);
      first&&=have.includes(recs[0]);full&&=recs.slice(0,max).every(id=>have.includes(id));
    }
    if(!total)continue;
    const ceiling=tops[tier]-4*(rank-1)/9,result=evaluateWeaponScore(source,owned);
    expect(result.quality).toBeCloseTo(quality/total,12);expect(result.coverage).toBeCloseTo(coverage/total,12);
    expect(result.best.value).toBeCloseTo(ceiling*quality/total,10);
    expect(result.omni.value).toBeCloseTo(ceiling*(.9*quality/total+.1*coverage/total),10);
    expect(result.allFirstChoices).toBe(first);expect(result.fullCoverage).toBe(full);
    expect(result.best.perfectOverall).toBe(ceiling===100&&first);
    expect(result.omni.perfectOverall).toBe(ceiling===100&&first&&full);
  }
});

describe('owned origin variant selection',()=>{
  const onslaught:any={name:'Forbearance (Onslaught Variant)',origin:'Indomitability',source:'Onslaught'};
  const vow:any={name:'Forbearance (Vow of the Disciple Variant)',origin:'Souldrinker',source:'Vow of the Disciple Raid'};
  it('selects actual Vow Forbearance when both source rows omit version tags',()=>{
    const map={3363267119:{name:'localized origin',icon:'',slots:['origin'] as any}};
    expect(findVariantByOwnedOrigin([onslaught,vow],map)).toBe(vow);
    expect(findVariantByOwnedOrigin([vow,onslaught],map)).toBe(vow);
  });
  it('does not use source labels, wrong socket membership, or ambiguous origin matches',()=>{
    expect(findVariantByOwnedOrigin([onslaught,vow],{2054520291:{name:'Souldrinker',icon:'',slots:['perk1']}})).toBeNull();
    expect(findVariantByOwnedOrigin([onslaught,vow],{3363267119:{name:'Souldrinker',icon:'',slots:['perk1']}})).toBeNull();
    expect(findVariantByOwnedOrigin([vow,{...vow,name:'another version'}],{3363267119:{name:'localized',icon:'',slots:['origin']}})).toBeNull();
  });
});
