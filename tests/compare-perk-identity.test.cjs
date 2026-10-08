const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const cache=new Map();
function load(name){name=name.replace('./','');if(name==='i18n')return{t:key=>key};if(cache.has(name))return cache.get(name);const output=ts.transpileModule(fs.readFileSync('src/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};cache.set(name,module.exports);new Function('require','module','exports',output)(load,module,module.exports);return module.exports;}
const {getPerkHashFromEnglish,getPerkIcon,getLocalizedPerkName,updateLocalizedRegistries,getEnglishPerkNameFromHash}=load('hash-translator');
const {prepareMissingPlug}=load('compare-native-tooltips');
const fixture=require('./fixtures/lucky-shot-definitions.json').definitions;
const normal=fixture[2054520291],enhanced=fixture[4170193963],emote=fixture[896553940];
assert.equal(normal.plug.plugCategoryIdentifier,'frames');assert.equal(enhanced.plug.plugCategoryIdentifier,'frames');assert.equal(emote.plug.plugCategoryIdentifier,'emote');
for(const name of ['Lucky Shot',' lucky shot ','LUCKY SHOT','LuckyShot'])assert.equal(getPerkHashFromEnglish(name),normal.hash,'Resolve the weapon trait despite the emote name collision');
updateLocalizedRegistries(Object.fromEntries([normal,enhanced,emote].map(d=>[d.hash,{name:d.displayProperties.name,icon:d.displayProperties.icon}])));
assert.equal(getPerkIcon('Lucky Shot'),normal.displayProperties.icon,'Use the trait icon, not the emote icon');
assert.equal(getLocalizedPerkName('Lucky Shot'),normal.displayProperties.name);
assert.equal(getEnglishPerkNameFromHash(emote.hash),'lucky shot','Preserve exact-hash item localization');
const active={plugDef:normal,enabled:true},socket={socketIndex:3,plugged:active,plugOptions:[active]},item={id:'Long Arm regression',sockets:{allSockets:[socket]}},before=JSON.stringify(item),state={manifest:{d2Manifest:{}},dimApi:{settings:{customStats:[]}}};
let calls=0;for(const definition of [normal,enhanced]){const result=prepareMissingPlug(item,3,definition,state,(context,copy,overrides)=>{calls++;assert.deepEqual(overrides,{3:normal.hash});return copy;});assert.equal(result.plug.plugDef,definition);}
assert.equal(prepareMissingPlug(item,3,emote,state,()=>{throw Error('Emote must never enter weapon stat preview');}),undefined);assert.equal(calls,2);assert.equal(JSON.stringify(item),before,'Real sockets and selection stay unchanged');
console.log('PASS: real Lucky Shot normal/enhanced/emote collision, aliases, icon identity, exact-hash localization, socket-category rejection, and unchanged weapon data.');
