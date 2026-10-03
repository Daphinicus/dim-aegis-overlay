const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { bundle, runFixture } = require('./browser-helpers.cjs');
(async () => {
  const adapter = await bundle('src/dim-search-adapter.ts','Adapter');
  const bridge = await bundle('src/search-bridge.ts','Bridge');
  const editor = await bundle('src/search-query-edit.ts','QueryEditor');
  const root = path.resolve('tests/fixtures/dim-search');
  const sources = {};
  function collect(dir) { for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name); if(entry.isDirectory())collect(file);
    else if(file.endsWith('.ts'))sources[path.relative(root,file).replaceAll('\\','/').replace(/\.ts$/,'')] = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  }} collect(root);
  await runFixture(`<input name="filter"><button id="action">Preview</button><pre id="result">Running</pre><script>
${adapter}
${bridge}
${editor}
const sources=${JSON.stringify(sources)};
const shims={
 'app/i18next-t':{tl:v=>v},'app/i18n':{DIM_LANG_INFOS:{en:{latinBased:true}}},'app/utils/log':{errorLog(){}},
 'app/utils/media-queries':{isPhonePortraitFromMediaQuery:()=>false},'fast-equals':{deepEqual:()=>false},
 'typesafe-actions':{getType:fn=>fn.type,createAction:(type,map=v=>v)=>()=>Object.assign((...args)=>({type,payload:map(...args)}),{type})}
};
const modules={};
function load(name,parent='') {
 if(name.startsWith('.')){const parts=parent.split('/');parts.pop();for(const part of name.split('/')){if(part==='..')parts.pop();else if(part!=='.')parts.push(part);}name=parts.join('/');}
 if(shims[name])return shims[name];if(modules[name])return modules[name].exports;
 const module={exports:{}};modules[name]=module;
 new Function('require','module','exports','$DIM_FLAVOR',sources[name])(n=>load(n,name),module,module.exports,'test');return module.exports;
}
const {makeSearchFilterFactory,parseAndValidateQuery}=load('app/search/search-filter');
const {shell}=load('app/shell/reducer');
const check=(v,m)=>{if(!v)throw Error(m)};
const settle=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function run(){
 crypto.randomUUID ||= () => 'fixture-session';
 const items=[{id:'1',hash:101,name:'One',weapon:true,sockets:{allSockets:[{plugged:{plugDef:{hash:11,displayProperties:{name:'Perk'}}}}]}},{id:'2',hash:102,name:'Two',weapon:true,sockets:{allSockets:[{plugged:{plugDef:{hash:12,displayProperties:{name:'Perk'}}}}]}}];
 let state={shell:{...shell(undefined,{type:'unknown'}),searchQuery:'notes:"two  spaces" and aegis:god',searchQueryVersion:7},inventory:{items,stores:[{}]},accounts:{currentAccountMembershipId:'account1',currentAccountDestinyVersion:2}};
 let notifications=0, evaluations=0; const listeners=new Set();
 const store={getState:()=>state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},dispatch:action=>{state={...state,shell:shell(state.shell,action)};notifications++;for(const fn of [...listeners])fn();}};
 let map={kvFilters:{notes:{keywords:'notes',format:'freeform',filter:()=>()=>true}},isFilters:{},allFilters:[]};
 const config=()=>({filtersMap:map}); const allItems=s=>s.inventory.items;
 let cleared=0;const selectors=[{clearCache(){cleared++},memoizedResultFunc:{clearCache(){cleared++}}}];
 const dispose=Adapter.installDimSearch({store,config,allItems,selectors,validate:()=>query=>parseAndValidateQuery(query,map,{})});
 check(!Adapter.isNativeSearchTermValid('unknown:filter'),'Badge validation rejects unsupported native filters');
 const request=()=>Bridge.readSearchMessage(Bridge.SEARCH_REQUEST);
 const publish=(req,grade='S')=>Bridge.publishSearchMessage(Bridge.SEARCH_RESPONSE,{...req,status:'ready',available:{ratings:true,shopping:true,source:true,armor:true,chase:true},facts:req.items.map((item,i)=>({id:item.id,hash:item.hash,data:{name:item.name,result:{grade:i?'F':grade,upgradeAvailable:true}},context:{mode:'pve',chase:false}}))});
 const valid=q=>parseAndValidateQuery(q,map,{}).valid;
 const results=q=>items.filter(makeSearchFilterFactory({filtersMap:map},{})(q)).map(i=>i.id).join(',');
 for(const q of ['aegis:god','-aegis:god','aegis:god or notes:x']){check(!valid(q),'Pending invalidates '+q);check(results(q)==='','Pending returns no results '+q);}
 let first=request();publish(first);await settle();
 check(Adapter.isNativeSearchTermValid('aegis:god'),'Badge validation uses the installed native validator');
 check(results('aegis:god')==='1','Exact native membership');
 check(results('-aegis:god')==='2','Native NOT');
 check(results('aegis:god or notes:x')==='1,2','Native OR');
 check(results('aegis:p:>=s and notes:x')==='1','Native AND');
 check(results('aegis:god aegis:p:>=a')==='1','Space combines two Aegis filters');
 check(results('aegis:god aegis:p:f')==='','Both Aegis filters constrain the results');
 check(results('aegis:god or aegis:p:f')==='1,2','Native OR combines two Aegis filters');
 check(results('aegis:god -aegis:god')==='','Negated Aegis filter preserves the first filter');
 const atoms=['aegis:god','aegis:p:f','notes:"two  spaces"','-aegis:god'];
 for(const a of atoms) for(const b of atoms) for(const c of atoms) for(const first of [' ',' and ',' or ']) for(const second of [' ',' and ',' or ']) {
   const original=a+first+b+second+c;
   const edited=QueryEditor.updateAegisQuery(original,'aegis:upgrade');
   check(valid(edited)&&results(edited)===results(original),'Query editing preserves native precedence: '+original+' -> '+edited);
 }
 check(results(QueryEditor.updateAegisQuery('((aegis:p:>=s) aegis:p:>=a) aegis:p:>=b','aegis:p:f'))==='2','Target replacement removes old thresholds');
 check(valid('aegis:"source:deep stone crypt"'),'Quoted source validates');
 check(!valid('aegis:meta'),'Unsupported grammar fails closed');
 check(state.shell.searchQuery==='notes:"two  spaces" and aegis:god'&&state.shell.searchQueryVersion===7,'Refresh preserves query bytes/version');
 const input=document.querySelector('input');input.value='pending native typing';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));input.blur();
 Bridge.publishSearchMessage(Bridge.SEARCH_RESPONSE,{...first,status:'pending',facts:[]});await settle();
 check(input.value==='pending native typing','Pending edit survives refresh');
 // A native action can keep an independent query and stale props until React commits.
 let invoked=0;const button=document.querySelector('#action');button.__reactFiber$fixture={memoizedProps:{query:'aegis:god'},return:null};button.addEventListener('click',()=>invoked++);
 state={...state,shell:{...state.shell,searchQuery:''}};
 button.click();check(invoked===0,'Pending independent consumer cannot invoke stale action');
 publish(first);await settle();button.click();check(invoked===1,'Ready consumer can invoke preview');
 button.__reactProps$fixture={onClick:()=>{}};
 Bridge.publishSearchMessage(Bridge.SEARCH_QUERY,'aegis:upgrade');check(state.shell.searchQuery==='aegis:upgrade','Widget dispatches native query');
 Bridge.appendSearchQuery('aegis:p:>=a');check(state.shell.searchQuery==='aegis:upgrade aegis:p:>=a','Widget adds to the existing query');
 const widget=document.createElement('div');widget.className='aegis-search-widget';input.after(widget);
 input.value='aegis:upgrade or notes:"two  spaces"';
 Bridge.appendSearchQuery('aegis:p:f');
 check(state.shell.searchQuery==='(aegis:upgrade or notes:"two  spaces") aegis:p:f','Widget preserves unsynchronized typing and quoted whitespace');
 check(results(state.shell.searchQuery)==='2','New filter applies to every OR branch');
 input.value='';Bridge.appendSearchQuery('aegis:god');check(state.shell.searchQuery==='aegis:god','Empty input starts a new query');
 Bridge.publishSearchMessage(Bridge.SEARCH_QUERY,'');check(state.shell.searchQuery==='','Explicit clear still clears');
 widget.remove();
 const before=request();document.dispatchEvent(new Event(Bridge.SEARCH_INVALIDATE));const after=request();check(after.evaluationRevision===before.evaluationRevision+1,'Settings revision advances');
 publish(before);check(!valid('aegis:god'),'Obsolete settings response rejected');publish(after,'F');await settle();check(results('aegis:god')==='','Ready empty matches remain valid');check(valid('aegis:god'),'Ready empty query valid');
 button.click();check(invoked===1,'Old handler stays blocked even after a delayed commit');
 button.__reactProps$fixture={onClick:()=>{}};button.click();check(invoked===2,'New committed handler is usable');
 const dialog=document.createElement('div');dialog.setAttribute('role','dialog');
 const confirm=document.createElement('button');dialog.append(confirm);document.body.append(dialog);
 dialog.__reactFiber$fixture={child:{memoizedProps:{query:'aegis:god',reportSockets(){}},child:null,sibling:null}};
 let confirmed=0;confirm.addEventListener('click',()=>confirmed++);
 Bridge.publishSearchMessage(Bridge.SEARCH_RESPONSE,{...after,status:'pending',facts:[]});confirm.click();
 check(confirmed===0,'Sibling query protects the confirmation footer');
 const close=document.createElement('button');close.setAttribute('aria-keyshortcuts','esc');dialog.append(close);
 let closed=false;close.addEventListener('click',()=>closed=true);close.click();check(closed,'Pending preview can still close');dialog.remove();
 publish(after);await settle();
 const unavailable={...Bridge.readSearchMessage(Bridge.SEARCH_RESPONSE),available:{ratings:true,shopping:false,source:true,armor:true,chase:true}};
 Bridge.publishSearchMessage(Bridge.SEARCH_RESPONSE,unavailable);await settle();
 check(!valid('-aegis:shopping')&&valid('aegis:god'),'Missing shopping data invalidates only dependent queries');
 const current=request();state={...state,accounts:{...state.accounts,currentAccountMembershipId:'account2'}};store.dispatch({type:'unknown'});check(request().accountEpoch===current.accountEpoch+1,'Account epoch advances');publish(current);check(!valid('aegis:god'),'Old account response rejected');
 publish(request());await settle();const unchanged=request().inventoryRevision;store.dispatch({type:'unknown'});check(request().inventoryRevision===unchanged,'Unrelated dispatch does not regrade');
 const oldMap=map;map={kvFilters:{},isFilters:{},allFilters:[]};store.dispatch({type:'unknown'});await settle();check(!oldMap.kvFilters.aegis&&!!map.kvFilters.aegis,'Map replacement cleans owned registration');
 dispose();check(!map.kvFilters.aegis&&map.allFilters.length===0,'Disposal removes only owned filter');
 check(!Adapter.isNativeSearchTermValid('notes:x'),'Disposal releases the native badge validator');
 check(cleared>0&&notifications<50,'Refresh clears both caches without feedback loop');
 const available=()=>({ratings:true,shopping:true,source:true,armor:true,chase:true});
 const evaluator=Bridge.initSearchEvaluator(item=>{evaluations++;return {id:item.id,hash:item.hash,data:{name:item.name,result:{grade:'S'}},context:{mode:'pve',chase:false}}},()=>true,available);
 window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
 const large={...request(),inventoryRevision:100,inventoryReady:true,items:Array.from({length:1601},(_,i)=>({id:String(i+1),hash:i+1,name:'Item',ready:true}))};
 const completed=()=>new Promise(resolve=>{const listener=()=>{const value=Bridge.readSearchMessage(Bridge.SEARCH_RESPONSE);if(value.status==='ready'){document.removeEventListener(Bridge.SEARCH_RESPONSE,listener);resolve(value)}};document.addEventListener(Bridge.SEARCH_RESPONSE,listener)});
 const completion=completed();Bridge.publishSearchMessage(Bridge.SEARCH_REQUEST,large);const largeResult=await completion;
 check(largeResult.facts.length===1601,'Inventory evaluation has no DOM/cache cap');
 const oldCompletion=completed();Bridge.publishSearchMessage(Bridge.SEARCH_REQUEST,{...large,inventoryRevision:101});
 Bridge.publishSearchMessage(Bridge.SEARCH_REQUEST,{...large,inventoryRevision:102,items:large.items.slice(0,1)});
 const newest=await oldCompletion;check(newest.inventoryRevision===102&&newest.facts.length===1,'Obsolete asynchronous batch cannot publish');
 Bridge.publishSearchMessage(Bridge.SEARCH_REQUEST,{...large,inventoryReady:false});check(Bridge.readSearchMessage(Bridge.SEARCH_RESPONSE).status==='unavailable','Loading empty inventory is not ready');
 evaluator.dispose();const evaluated=evaluations;Bridge.publishSearchMessage(Bridge.SEARCH_REQUEST,large);check(evaluations===evaluated,'Evaluator listener is disposed');
 document.querySelector('#result').textContent='PASS: native DIM Boolean parsing, unavailable states, query preservation, action guard, revisions, map replacement, and cleanup';
}
run().catch(error=>document.querySelector('#result').textContent='FAIL: '+error.stack);
</script>`);
})().catch(error=>{console.error(error);process.exitCode=1});
