const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/content.ts','utf8');
const parsed = ts.createSourceFile('content.ts',source,ts.ScriptTarget.Latest,true);
const functions = parsed.statements.filter(node=>ts.isFunctionDeclaration(node) &&
  ['evaluateWeapon','evaluateArmorItem','reprocessAllElements','updatePerkNameToIcon'].includes(node.name?.text)).map(node=>node.getText(parsed)).join('\n');
const cacheSource = fs.readFileSync('src/evaluation-cache.ts','utf8').replace('export function','function');
let weaponCalls=0,armorCalls=0,invalidations=0;
const context=vm.createContext({
  computeWeaponEvaluation:()=>({result:{grade:++weaponCalls%2?'A':'B'}}),
  computeArmorEvaluation:()=>({result:{grade:'A/S',revision:++armorCalls}}),
  inventoryEvaluations:new Map(),weaponFallbackCache:new WeakMap(),
  setupRegistryObserver(){},setupSearchWidget(){},playerVaultInventory:new Map(),
  document:{querySelectorAll:()=>[],querySelector:()=>null},comparePerks:{refresh(){}},overviewPerks:{refresh(){}},
  perkNameToIcon:{},cleanPerkName:name=>name.toLowerCase(),updatePerkNameToHash(){},
  nativeSearchEvaluator:{invalidate(){invalidations++;}},
});
vm.runInContext(ts.transpileModule(cacheSource+`
const weaponEvaluations=createEvaluationCache(),armorEvaluations=createEvaluationCache();
`+functions,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
const evaluate=(args)=>{context.args=args;return vm.runInContext('evaluateWeapon(...args)',context);};
const args=['Weapon',10,[1,2],{1:{name:'One',icon:'/1.png'},2:{name:'Two',icon:'/2.png'}},[1],'Weapon','123','Range'];
const first=evaluate(args);
assert.equal(evaluate(structuredClone(args)),first,'fresh DIM models reuse full-inventory evaluations');
const tile=structuredClone(args);tile[7]='range';
assert.equal(evaluate(tile),first,'tile and state masterwork capitalization share a cache entry');
assert.equal(weaponCalls,1,'route remounts and repeated indexing do not rescore unchanged rolls');
for(const [index,value] of [[0,'Weapon (Adept)'],[1,11],[2,[1,2,3]],[3,{1:{name:'Updated',icon:'/new.png'}}],[4,[2]],[5,'Variant'],[7,'Handling']]){
  const changed=structuredClone(args);changed[index]=value;const before=weaponCalls;
  evaluate(changed);assert.equal(weaponCalls,before+1,'changed grading input '+index+' invalidates the entry');
}
const preview=structuredClone(args);preview[6]='0';evaluate(preview);evaluate(preview);
assert.equal(weaponCalls,10,'non-instance previews do not collide in the inventory cache');
const armor=vm.runInContext("evaluateArmorItem('Armor',20)",context);
assert.equal(vm.runInContext("evaluateArmorItem('Armor',20)",context),armor,'armor grades also survive new tile instances');
const before=weaponCalls;
vm.runInContext('reprocessAllElements()',context);
evaluate(args);vm.runInContext("evaluateArmorItem('Armor',20)",context);
assert.equal(weaponCalls,before+1);assert.equal(armorCalls,2,'score/database/locale reprocessing invalidates both caches');
let registryUpdate;
function visit(node){
  if(ts.isIfStatement(node)&&node.expression.getText(parsed)==='changes.perkRegistry')registryUpdate=node.getText(parsed);
  ts.forEachChild(node,visit);
}
visit(parsed);assert.ok(registryUpdate);
const updateRegistry=()=>vm.runInContext(ts.transpileModule(registryUpdate,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
context.changes={perkRegistry:{newValue:{1:{name:'One',icon:'/1.png'}}}};
updateRegistry();assert.equal(invalidations,1,'changed icon data rewarms the full grade index');
const named=evaluate(args);const calls=weaponCalls;
updateRegistry();assert.equal(invalidations,1,'persisting unchanged names does not discard prepared grades');
assert.equal(evaluate(args),named);assert.equal(weaponCalls,calls);
const bounded=vm.runInContext('createEvaluationCache(2)',context);
bounded.get('1','a',()=>1);bounded.get('2','a',()=>2);bounded.get('1','a',()=>99);bounded.get('3','a',()=>3);
assert.equal(bounded.get('1','a',()=>99),1,'recent entries survive eviction');
assert.equal(bounded.get('2','a',()=>22),22,'old entries are evicted');
assert.equal(bounded.stats().entries,2);
console.log('PASS: shared state/tile grade caching, refreshed models, all score inputs, preview isolation, armor, scoring invalidation, and bounded retention.');
