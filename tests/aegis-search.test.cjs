const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  const file = path.resolve(__dirname, '../src', name + '.ts');
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; cache.set(file, module.exports);
  new Function('require', 'module', 'exports', output)(name => name.startsWith('.') ? load(name) : require(name), module, module.exports);
  return module.exports;
}
const { parseAegisArgument, matchesAegisArgument: match, compareGrades, finalizeSearchGrade, aegisQuery, compactSearchData } = load('aegis-search');
const context = { mode: 'pve', chase: false };
// Captured from the pre-integration DOM matcher, with A02 activity-grade corrections.
// Unrated items must not enter native bulk actions through rating comparisons.
for (const fixture of JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/aegis-search-parity.json'), 'utf8'))) {
  for (const [query, expected] of Object.entries(fixture.expected)) {
    const unratedRatingQuery = !fixture.data.result.grade && !/^(?:(?:s|source):|(?:shopping|shop|priority)(?::|$)|chase$|bis$|bestinclass$)/.test(query);
    const wanted = unratedRatingQuery ? false : expected;
    assert.equal(match(query, fixture.data, fixture.context), wanted, `${fixture.name}: ${query}`);
    assert.equal(match(query, compactSearchData(fixture.data), fixture.context), wanted, `Compact ${fixture.name}: ${query}`);
  }
}
const weapon = { name: 'Test', result: { grade: 'A', isPerfect5of5: true, isOmniRoll: true, upgradeAvailable: true }, sheetWeapon: { tier: 'S', source: "King's Fall" }, shoppingItem: { priority: 'high' }, shoppingAlt: {}, isBestInClass: true };
for (const alias of ['5/5','perfect','5of5','godroll','omni','master','allperks','upgradeable','upgradable','upgrade','bis','bestinclass','shopping','shop','shopping:high','priority:1','priority:high','shopping:ready','shopping:alt','shopping:alternative','p:>=a','perk:a','w:s','weapon:s','source:king\'s fall','s:fall','a']) {
  assert.equal(parseAegisArgument(alias).ok, true, alias);
  assert.equal(match(alias, weapon, context), true, alias);
}
for (const invalid of ['', 'meta', 'unknown', 'p:', 'source:', 'p:>=', 'foo:a', 'shopping:unknown']) assert.equal(parseAegisArgument(invalid).ok, false, invalid);
assert.equal(match('god', weapon, context), false);
assert.equal(match('chase', weapon, {...context, chase: true}), true);
assert.equal(match('shopping:farm', weapon, context), false);
assert.equal(match('shopping', weapon, {...context,mode:'pvp'}), false, 'Preserve PvP shopping selection');
assert.equal(match('god', {...weapon,result:{grade:'F | S',pveGrade:'F',pvpGrade:'S'}},context),true);
assert.equal(match('pve:>=a', {...weapon,result:{grade:'F | S',pveGrade:'F',pvpGrade:'S'}},context),false);
assert.equal(match('pvp:>=a', {...weapon,result:{grade:'F | S',pveGrade:'F',pvpGrade:'S'}},context),true);
const armor={name:'Armor',result:{grade:'A/S'}};
for (const q of ['a:a','armor:4p:s','2piece:a','4piece:>=s','a/s']) assert.equal(match(q,armor,context),true,q);
assert.equal(match('god',armor,context),false);
assert.equal(match('armor:s',weapon,context),false);
assert.equal(compareGrades('BF➔S+', '>=s'),true);
assert.equal(compareGrades('SA','s'),true);
assert.equal(compareGrades('A+', '>a'),true);
for (const [mode,expected] of [['equipped','BF'],['dual','BF➔S'],['potential','BS']]) {
 const result={grade:'F',potentialGrade:'S'};finalizeSearchGrade(result,{tier:'B'},'pve',mode,true);
 assert.equal(result.grade,expected); assert.equal(result.upgradeAvailable,true);
}
const exotic={grade:'F',potentialGrade:'S'};finalizeSearchGrade(exotic,{tier:'A',source:'Exotic'},'pve','potential',true);assert.equal(exotic.grade,'A');
const both={grade:'A | S'};finalizeSearchGrade(both,{tier:'B'},'both','dual',true);assert.equal(both.grade,'A | S');
assert.equal(aegisQuery("source:king's fall"),'aegis:"source:king\'s fall"');
const { projectDimItem }=load('dim-item-input');
const item={id:'1234567890123456789',hash:123,name:'Test',weapon:true,sockets:{allSockets:[{plugged:{plugDef:{hash:1,displayProperties:{name:'One'}}},plugOptions:[{plugDef:{hash:2,displayProperties:{name:'Two'}}}]}]},masterworkInfo:{statName:'Tier 10 Reload Speed Masterwork'}};
const projected=projectDimItem(item);assert.equal(projected.id,item.id);assert.deepEqual(projected.perkHashes,[1,2]);assert.deepEqual(projected.activeHashes,[1]);assert.equal(projected.masterwork,'Reload');assert.equal(projected.ready,true);
assert.equal(projectDimItem({...item,sockets:null}).ready,false);
assert.equal(projectDimItem({...item,id:'0'}),null);
const {sameSearchRevision}=load('search-bridge');
const revision={session:'a',accountEpoch:1,inventoryRevision:2,evaluationRevision:3};
assert.equal(sameSearchRevision(revision,{...revision}),true);
for(const key of Object.keys(revision))assert.equal(sameSearchRevision(revision,{...revision,[key]:key==='session'?'b':99}),false,key);
console.log('PASS: Aegis search grammar, matching, finalization, projection, and revision checks');
const {updateAegisQuery: edit}=load('search-query-edit');
assert.equal(edit('((aegis:p:>=s) aegis:p:>=a) aegis:p:>=b','aegis:p:>=a'),'aegis:p:>=a');
assert.equal(edit('is:weapon aegis:perk:s aegis:w:s','aegis:p:a'),'is:weapon aegis:p:a aegis:w:s');
assert.equal(edit('aegis:a:2p:s aegis:armor:4piece:a','aegis:a:2p:b'),'aegis:a:2p:b aegis:armor:4piece:a');
assert.equal(edit('aegis:god','aegis:p:>=b'),'aegis:p:>=b');
assert.equal(edit('aegis:upgrade','aegis:upgradable'),'aegis:upgradable');
assert.equal(edit('aegis:"source:deep stone crypt" notes:"aegis:s:fake"','aegis:"source:king\'s fall"'),'aegis:"source:king\'s fall" notes:"aegis:s:fake"');
assert.equal(edit('is:weapon or is:armor','aegis:p:a'),'(is:weapon or is:armor) aegis:p:a');
assert.equal(edit('aegis:p:s or is:armor','aegis:p:a'),'aegis:p:a or is:armor');
assert.equal(edit('-aegis:perk:s','aegis:p:a'),'aegis:p:a');
assert.equal(edit('not (is:armor or is:weapon)','aegis:p:a'),'-(is:armor or is:weapon) aegis:p:a');
assert.equal(edit('notes:"unfinished','aegis:p:a'),'(notes:"unfinished) aegis:p:a');
assert.equal(edit('/* my search */ aegis:p:s','aegis:w:a'),'/* my search */ aegis:p:s aegis:w:a');
assert.equal(edit('/* my search */ aegis:p:s','aegis:p:a'),'/* my search */ aegis:p:a');
console.log('PASS: target replacement, aliases, duplicate cleanup, quoted values, Boolean groups, and independent armor targets');
