import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { getEnglishWeaponNameFromHash, getPerkHashFromEnglish } from '../../src/hash-translator';
import * as variantHelpers from '../../src/weapon-variant';
import pve from '../../data/pve-database.json';
import type { AegisSheetDatabase, AegisSheetWeapon } from '../../src/types';

// Exercise the actual content resolver, without importing its browser startup lifecycle.
// A coordinator may select the combined read-only source and model the proposed guard in memory.
const contentFile = process.env.AEGIS_CONTENT_SOURCE || path.resolve('src/content.ts');
let source = fs.readFileSync(contentFile, 'utf8');
if (process.env.AEGIS_RESOLVER_REVIEW_GUARD === '1') {
  const anchor = '    if (originVariant) return originVariant;';
  if (!source.includes(anchor)) throw Error('Content resolver origin boundary not found');
  source = source.replace(anchor, anchor + '\n    if (weaponVariantsNeedIdentity(db, baseNormalized)) return null;');
}
const tree = ts.createSourceFile(contentFile, source, ts.ScriptTarget.Latest, true);
const names = ['cleanPerkName', 'cleanWeaponNameBase', 'weaponLookupName', 'findAegisWeapon', 'isWordSubsequence', 'getPerkMatchData', 'isPerkMatch'];
const declarations = names.map(name => {
  const declaration = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  if (!declaration) throw Error(`Missing actual content function: ${name}`);
  return declaration.getText(tree);
}).join('\n');
const compiled = ts.transpileModule(declarations, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const resolve = new Function('helpers', `const {getEnglishWeaponNameFromHash,findVariantByOwnedOrigin,findVariantByItemMetadata,weaponVariants,weaponVariantsNeedIdentity}=helpers;
const aegisSheetDb=null,weaponFallbackCache=new WeakMap(),perkMatchCache=new Map();
${compiled};return findAegisWeapon;`)({...variantHelpers,getEnglishWeaponNameFromHash}) as (name:string,perks?:any,active?:number[],text?:string,hash?:number,db?:AegisSheetDatabase)=>AegisSheetWeapon|null;

const legacy = (pve as AegisSheetDatabase).categories.Sidearms.find(row=>row.name==='High Albedo')!;
const rocket = (pve as AegisSheetDatabase).categories['Rocket Sidearms'].find(row=>row.name==='High Albedo')!;
const modeledDb = (rows:AegisSheetWeapon[]):AegisSheetDatabase => {
  const categories:Record<string,AegisSheetWeapon[]>={};
  for(const row of rows){const category=row.categoryKey || (row.frame==='Micro-Missile'?'Rocket Sidearms':'Sidearms');(categories[category] ||= []).push(row);}
  return {weapons:{'high albedo':rows.at(-1)!},variants:{'high albedo':[rows[0]]},categories};
};
const overlap = {[getPerkHashFromEnglish('Threat Detector','perk1')!]:{name:'Threat Detector',icon:'',slots:['perk1']},[getPerkHashFromEnglish('Unrelenting','perk2')!]:{name:'Unrelenting',icon:'',slots:['perk2']}};

describe('A04 actual content edition resolver',()=>{
  it('uses verified hashes before overlapping perk quality and preserves source order independence',()=>{
    for(const rows of [[legacy,rocket],[rocket,legacy]]){
      const db=modeledDb(rows);
      expect(resolve('High Albedo',overlap,[],undefined,1197486957,db)).toBe(legacy);
      expect(resolve('High Albedo',overlap,[],undefined,2662459958,db)).toBe(rocket);
    }
  });
  it('keeps unknown hashes unresolved across frames despite matching legacy perks or no perks',()=>{
    for(const rows of [[legacy,rocket],[rocket,legacy]]){
      const db=modeledDb(rows);
      expect(resolve('High Albedo',overlap,[],undefined,0,db)).toBeNull();
      expect(resolve('High Albedo',{},[],undefined,0,db)).toBeNull();
    }
  });
  it('keeps ambiguous verified frame matches unresolved across categories despite overlapping perks',()=>{
    const second={...legacy,sourceRowId:'modeled-second-primary',categoryKey:'Other Sidearms',perk1:'Threat Detector',perk2:'Unrelenting'};
    for(const rows of [[legacy,second,rocket],[rocket,second,legacy],[legacy,second],[second,legacy]]){
      expect(resolve('High Albedo',overlap,[],undefined,1197486957,modeledDb(rows))).toBeNull();
    }
  });
  it('allows verified owned origin to resolve a cross-family edition before the boundary',()=>{
    const origin=getPerkHashFromEnglish('Winterized Gear','origin')!;expect(origin).toBeTruthy();
    const perks={[origin]:{name:'localized origin',icon:'',slots:['origin']}};
    for(const rows of [[legacy,rocket],[rocket,legacy]]) expect(resolve('High Albedo',perks,[],undefined,0,modeledDb(rows))).toBe(rocket);
  });
  it('preserves existing same-family variant fallback outside the cross-family identity boundary',()=>{
    const first={...legacy,name:'Modeled Weapon (Original Variant)',sourceRowId:'modeled-first'};
    const second={...legacy,name:'Modeled Weapon (Reissued Variant)',sourceRowId:'modeled-second',perk1:'Kill Clip',perk2:'Golden Tricorn'};
    const db:AegisSheetDatabase={weapons:{'modeled weapon':second},variants:{'modeled weapon':[first,second]},categories:{Sidearms:[first,second]}};
    expect(resolve('Modeled Weapon',overlap,[],undefined,0,db)).toBe(first);
  });
});
