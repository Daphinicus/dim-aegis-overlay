const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const baseline = process.env.AEGIS_UI_BASELINE === '1';
const read = file => baseline ? require('node:child_process').execFileSync('git', ['show', '72579b5691c8b87dfdf14d53475694e96a12f831:' + file], {encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024}) : fs.readFileSync(file,'utf8');
(async()=>{
const dom = new JSDOM(read('public/popup.html'), { url:'https://example.test', pretendToBeVisual:true });
for (const name of ['window','document','navigator','localStorage','Element','HTMLElement','HTMLInputElement','HTMLButtonElement','HTMLBRElement','Node','Text','MutationObserver','DOMParser','Event','KeyboardEvent','AbortController']) global[name] = dom.window[name];
Object.defineProperty(dom.window.HTMLElement.prototype,'inert',{value:false,writable:true,configurable:true});
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
const frames = new Set();
global.ResizeObserver = class { constructor(callback) { this.callback = callback; frames.add(this); } observe() {} disconnect() { frames.delete(this); } };
const stored = { scoringSource:'aegis', aegisDbMode:'sheet', aegisRatingDisplay:'scores', aegisMode:'both', aegisScoreProfile:'omni', aegisScorePrecision:2, aegisScoreShowPercent:false, aegisScoreComparisonActivity:'pvp', lastSeenChangelogVersion:'1.9.5' };
const storageListeners=[];
global.chrome = { runtime:{getManifest:()=>({version:'1.9.5'})}, storage:{local:{get:(keys, callback)=>{if(callback) callback(stored);else return Promise.resolve(stored);},set:(values, callback)=>{Object.assign(stored, values);callback?.();return Promise.resolve();}}, onChanged:{addListener(listener){storageListeners.push(listener);}}} };
const cache = new Map();
function load(name, overrides = {}) {
  if (cache.has(name)) return cache.get(name);
  const file = path.resolve('src', name + '.ts');
  let source = read(path.relative(process.cwd(),file).replaceAll('\\','/'));
  if (name === 'tooltip') source += '\nexport { positionTooltip as testPositionTooltip };';
  const output = ts.transpileModule(source, { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022, esModuleInterop:true} }).outputText;
  const module = {exports:{}}; cache.set(name,module.exports);
  new Function('require','module','exports',output)(dep=>overrides[dep] || (dep.startsWith('.') ? load(path.posix.normalize(path.posix.join(path.posix.dirname(name),dep))) : require(dep)),module,module.exports);
  return module.exports;
}
await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
load('popup', Object.fromEntries(['compact-options','options-preview','options-motion','grade-settings','grade-colors','version-pill'].map(name=>['./'+name,new Proxy({}, {get:()=>()=>{}})])));
document.dispatchEvent(new Event('DOMContentLoaded'));
const tests = [];
async function test(id, run) { try {await run(); console.log('PASS '+id);} catch(error) {tests.push(id);console.error('FAIL '+id+': '+error.message);} }
const key = (node,value,shiftKey=false)=>node.dispatchEvent(new KeyboardEvent('keydown',{key:value,shiftKey,bubbles:true,cancelable:true}));
await test('A07 selected score semantics',()=>{
  for (const lang of ['en','es','ko','ja','zh-CHS','zh-CHT']) {
    stored.aegisLanguage=lang; storageListeners.forEach(listener=>listener({aegisLanguage:{newValue:lang}},'local'));
  for (const id of ['rating-display','score-profile','score-precision','score-percent','score-comparison']) {
    const group=document.getElementById('aegis-'+id+'-segmented');assert.equal(group.getAttribute('role'),'group');assert.ok(document.getElementById(group.getAttribute('aria-labelledby'))?.textContent);
    const buttons = [...group.querySelectorAll('button')];
    assert.equal(buttons.filter(button=>button.getAttribute('aria-pressed')==='true').length,1,id);
    for (const button of buttons) assert.equal(button.getAttribute('aria-pressed'),String(button.classList.contains('active')));
  }}
  stored.aegisLanguage='auto'; storageListeners.forEach(listener=>listener({aegisLanguage:{newValue:'auto'}},'local'));
});
await test('A11 keyboard language selection',()=>{
  stored.aegisLanguage='auto';storageListeners.forEach(listener=>listener({aegisLanguage:{newValue:'auto'}},'local'));
  const trigger=document.getElementById('language-select-input');trigger.focus();key(trigger,'Enter');key(trigger,'ArrowDown');key(trigger,'Enter');
  assert.equal(stored.aegisLanguage,'en');assert.equal(trigger.getAttribute('aria-expanded'),'false');assert.equal(document.activeElement,trigger);
  for(const lang of ['en','es','ko','ja','zh-CHS','zh-CHT']) {
    key(trigger,'Enter');key(trigger,'Home');
    const index=['auto','en','es','ko','ja','zh-CHS','zh-CHT'].indexOf(lang);
    for(let step=0;step<index;step++) key(trigger,'ArrowDown');
    const option=document.getElementById(trigger.getAttribute('aria-activedescendant'));assert.equal(option.dataset.value,lang);
    key(trigger,'Enter');assert.equal(stored.aegisLanguage,lang);assert.equal(option.getAttribute('aria-selected'),'true');
  }
  key(trigger,'ArrowUp');key(trigger,'End');assert.equal(document.getElementById(trigger.getAttribute('aria-activedescendant')).dataset.value,'zh-CHT');key(trigger,'Escape');assert.equal(trigger.getAttribute('aria-expanded'),'false');
  key(trigger,'Enter');key(trigger,'Tab');assert.equal(trigger.getAttribute('aria-expanded'),'false');
  key(trigger,'Enter');document.getElementById('open-changelog-btn').click();assert.equal(trigger.getAttribute('aria-expanded'),'false');
  document.getElementById('changelog-close-btn').click();
});
await test('A12 modal focus, Tab containment, Escape, return',()=>{
  const open=document.getElementById('open-changelog-btn');open.focus();open.click();
  const modal=document.getElementById('changelog-modal'),close=document.getElementById('changelog-close-btn'),ack=document.getElementById('changelog-ack-btn');
  assert.ok(modal.contains(document.activeElement));assert.equal(modal.getAttribute('aria-modal'),'true');assert.ok(document.querySelector('.popup-container').inert);
  ack.focus();key(ack,'Tab');assert.equal(document.activeElement,close);key(close,'Tab',true);assert.equal(document.activeElement,ack);
  key(ack,'Escape');assert.ok(modal.classList.contains('hidden'));assert.equal(document.activeElement,open);assert.equal(document.querySelector('.popup-container').inert,false);
});
const i18n=load('i18n'),display=load('search-display');
await test('A13 six language readable chips and raw query retention',()=>{
  const tree=ts.createSourceFile('i18n.ts',read('src/i18n.ts'),ts.ScriptTarget.Latest,true);
  const table=tree.statements.flatMap(statement=>statement.declarationList?.declarations||[]).find(declaration=>declaration.name.text==='translations').initializer;
  const dicts=Object.fromEntries(table.properties.map(table=>[table.name.text,Object.fromEntries(table.initializer.properties.map(entry=>[entry.name.text,entry.initializer.text]))]));
  const keys=Object.keys(dicts.en).filter(key=>key.startsWith('searchLabel'));assert.ok(keys.length>70,'complete readable-chip dictionary');
  for(const [lang,dict]of Object.entries(dicts))for(const key of [...keys,'searchRemoveTerm'])assert.ok(dict[key]?.trim(),lang+': '+key);
  const expected={en:'Weapon',es:'Arma',ko:'무기',ja:'武器','zh-CHS':'武器','zh-CHT':'武器'};
  const input=document.createElement('input');input.name='filter';input.value='is:weapon aegis:godroll ';input.__reactProps$test={onChange(){throw Error('Language changed native query');},onKeyDown(){}};document.body.append(input);
  const stop=load('inline-search-editor').attachInlineSearchEditor(input,()=>true,'readable');
  for (const [lang,word] of Object.entries(expected)) {
    i18n.setLanguage(lang);assert.equal(display.readableSearchTerm('is:weapon').text,word,lang);
    assert.equal(input.nextElementSibling.querySelector('.aegis-search-token-label').textContent,word,lang+' mounted refresh');
    assert.equal(input.nextElementSibling.querySelector('button').getAttribute('aria-label'),i18n.t('searchRemoveTerm',{term:'is:weapon'}));
    assert.equal(input.value,'is:weapon aegis:godroll ');
  }
  stop();input.remove();
});
await test('A06 viewport cap and growth reposition',async()=>{
  const tooltip=load('tooltip');const target=document.createElement('div');document.body.append(target);target.getBoundingClientRect=()=>({left:100,right:150,top:443,width:50,height:50,bottom:493});
  const card=tooltip.initTooltip();let height=312.875;
  Object.defineProperties(card,{offsetWidth:{get:()=>320},offsetHeight:{get:()=>Math.min(height,parseFloat(card.style.maxHeight)||Infinity)}});
  Object.defineProperty(window,'innerHeight',{value:768,configurable:true});
  tooltip.testPositionTooltip(target,card);assert.ok(parseFloat(card.style.top)+card.offsetHeight<=756);
  tooltip.showTooltip(target,{grade:'A',notes:'',matchedPerks:[],missingPerks:[]},'Armor',{},[],false,null,undefined,false,null,{}, {piece2Rating:'A',piece2Name:'Bonus',piece2Desc:'Text',piece4Rating:'B',piece4Name:'Bonus',piece4Desc:'Text'},null,'pve','sheet',null,null,{});
  height=457.875;for(const observer of frames) observer.callback([]);await new Promise(requestAnimationFrame);
  assert.ok(parseFloat(card.style.top)+card.offsetHeight<=756,'disclosure growth is repositioned');
  height=1000;tooltip.testPositionTooltip(target,card);assert.equal(card.style.maxHeight,'744px');assert.equal(card.style.overflowY,'auto');assert.ok(parseFloat(card.style.top)+card.offsetHeight<=756);
  tooltip.hideTooltip();assert.equal(frames.size,0,'placement observers cleaned on hide');
  const show = () => tooltip.showTooltip(target,{grade:'A',notes:'',matchedPerks:[],missingPerks:[]},'Armor',{},[],false,null,undefined,false,null,{}, {piece2Rating:'A',piece2Name:'Bonus',piece2Desc:'Text',piece4Rating:'B',piece4Name:'Bonus',piece4Desc:'Text'},null,'pve','sheet',null,null,{});
  show();assert.equal(frames.size,1);window.dispatchEvent(new Event('pagehide'));assert.equal(frames.size,0,'pagehide releases placement work');
  show();assert.equal(frames.size,1);cache.delete('tooltip');load('tooltip').initTooltip();assert.equal(frames.size,0,'replacement module releases previous placement work');
});
console.log(tests.length ? 'Failed findings: '+tests.join(', ') : 'All review UI regressions passed');
dom.window.close();process.exit(tests.length?1:0);
})().catch(error=>{console.error(error);process.exit(1);});
