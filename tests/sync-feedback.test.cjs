const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const sourceRoot=process.env.SYNC_FEEDBACK_SOURCE_ROOT||root;
const text=name=>fs.readFileSync(path.join(sourceRoot,name),'utf8');
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exportsObject={};
vm.runInNewContext(transpile(fs.readFileSync(path.join(root,'src/sync-feedback.ts'),'utf8')),{exports:exportsObject});
const {sheetFailureMessage,sheetSyncFeedback}=exportsObject;
const parsed=ts.createSourceFile('background.ts',text('src/background.ts'),ts.ScriptTarget.Latest,true);
const fn=parsed.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='fetchAndCacheAegisSheet');
async function background(seed={},fresh={},ratingError,concurrent=false){
 const state={...seed},writes=[];let ratingCalls=0;
 const context={sheetSync:undefined,console,Date,Promise,Object,Error,sheetFailureMessage,PVE_DB_CDN_URL:'pve',PVP_DB_CDN_URL:'pvp',SHEET_ID:'pve',PVP_SHEET_ID:'pvp',ALL_TABS:[],
  fetchAndCachePerkRatings:async()=>{ratingCalls++;if(ratingError)throw new Error(ratingError);},fetchWithTimeout:async()=>({ok:false}),
  fetchSpreadsheetDatabase:async id=>fresh[id]?.sheet,fetchShoppingListDatabase:async id=>fresh[id]?.shopping,
  chrome:{storage:{local:{get:async()=>({...state}),set:async patch=>{writes.push({...patch});Object.assign(state,patch);}}}}};
 vm.runInNewContext(transpile(fn.getText(parsed)),context);
 const results=await Promise.all(Array.from({length:concurrent?2:1},()=>context.fetchAndCacheAegisSheet()));return{state,writes,result:results[0],ratingCalls,context};
}
const old={weapons:{old:{name:'Old'}},categories:{Autos:[]}};
const shopping={items:[{name:'Shopping'}],byName:{},alternativesMap:{}};
(async()=>{
 const fresh=await background();assert.equal(fresh.writes[0].aegisSheetSyncStatus,'loading','Automatic first sync records loading before network work');
 assert.equal(fresh.state.aegisSheetSyncStatus,'error');assert.match(fresh.state.aegisSheetSyncError,/no cached spreadsheet data/);assert.equal(fresh.state.aegisSheetLastSync,undefined);
 const retained=await background({aegisSheetDbPvE:old,aegisSheetLastSync:123});assert.equal(retained.state.aegisSheetDbPvE,old);assert.equal(retained.state.aegisSheetLastSync,123);assert.match(retained.result.error,/available cached data retained/);
 const partial=await background({}, {pve:{sheet:old,shopping}});assert.equal(partial.state.aegisSheetSyncStatus,'partial');assert.equal(partial.result.partial,true);assert.equal(partial.state.aegisSheetDbPvE,old);assert.equal(partial.state.aegisSheetLastSync,undefined);
 const failedRating=await background({}, {},'fixture rating failure');assert.equal(failedRating.state.aegisSheetSyncStatus,'error');assert.equal(failedRating.state.aegisSheetSyncError,'fixture rating failure');
 const retry=await background(fresh.state,{pve:{sheet:old,shopping},pvp:{sheet:old,shopping}});assert.equal(retry.state.aegisSheetSyncStatus,'success');assert.equal(retry.state.aegisSheetSyncError,null);assert.ok(retry.state.aegisSheetLastSync>0);
 const coalesced=await background({}, {},undefined,true);assert.equal(coalesced.ratingCalls,1,'Concurrent retries share one refresh');assert.equal(coalesced.context.sheetSync,undefined,'Settled refresh releases its operation');
 assert.equal(sheetSyncFeedback({}).status,'idle');assert.equal(sheetSyncFeedback({aegisSheetLastSync:123}).status,'success');
 const {build}=await import('vite');const output=await build({configFile:false,publicDir:false,logLevel:'error',resolve:{extensions:['.ts','.tsx','.js','.mjs','.json']},build:{write:false,lib:{entry:path.join(sourceRoot,'src/popup.ts'),name:'PopupFeedbackRegression',formats:['iife']}}});const code=(Array.isArray(output)?output[0]:output).output[0].code;
 let renderChecks=0;
 for(const language of ['en','es','ko','ja','zh-CHS','zh-CHT']){
  const dom=new JSDOM(text('public/popup.html'),{url:'https://fixture.invalid/',pretendToBeVisual:true,runScripts:'outside-only'});const w=dom.window;w.structuredClone=structuredClone;w.ResizeObserver=class{observe(){} unobserve(){} disconnect(){}};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  await new Promise(resolve=>w.document.readyState==='loading'?w.document.addEventListener('DOMContentLoaded',resolve,{once:true}):resolve());
  const state={lastSeenChangelogVersion:'1.9.5',aegisLanguage:language},listeners=[],held=[],manualHeld=[];
  const get=(keys,callback)=>{const result={};for(const key of keys)if(key in state)result[key]=state[key];queueMicrotask(()=>callback?.(result));return Promise.resolve(result);};
  w.chrome={storage:{local:{get,set:(patch,cb)=>{Object.assign(state,patch);queueMicrotask(()=>cb?.());return Promise.resolve();}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{getManifest:()=>({version:'1.9.5'}),sendMessage:(m,cb)=>{const reply=m.action==='getSpreadsheetsSyncState'?{...state,inFlight:state.aegisSheetSyncStatus==='loading'&&!state.fixtureInterrupted,interrupted:state.fixtureInterrupted}:{success:false,error:'fixture request failure'};if(state.fixtureHoldManual&&m.action==='syncSpreadsheets')manualHeld.push(()=>cb(reply));else if(state.fixtureHold&&m.action==='getSpreadsheetsSyncState')held.push(()=>cb(reply));else queueMicrotask(()=>cb(reply));}}};
  w.eval(code);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await new Promise(resolve=>setTimeout(resolve,30));
  const row=w.document.querySelector('#sheets-sync-status-row'),status=w.document.querySelector('#sheets-sync-status-text'),button=w.document.querySelector('#sync-sheets-button');
  assert.notEqual(w.document.querySelector('#sync-status').textContent,'Synced','Empty wishlist is never reported synced');assert.ok(status.textContent.length);assert.equal(row.style.display,'block');assert.equal(status.getAttribute('aria-live'),'polite');renderChecks++;
  for(const phase of ['loading','error','partial','success']){
   Object.assign(state,{aegisSheetSyncStatus:phase,aegisSheetSyncError:phase==='error'||phase==='partial'?'fixture persisted failure':null});listeners.forEach(fn=>fn({aegisSheetSyncStatus:{newValue:phase}},'local'));await new Promise(resolve=>setTimeout(resolve,20));
   assert.equal(button.disabled,phase==='loading');assert.equal(button.querySelector('.spinner').classList.contains('hidden'),phase!=='loading');
   if(phase==='error'||phase==='partial')assert.ok(status.textContent.includes('fixture persisted failure'));assert.ok(status.textContent.length);renderChecks++;
  }
  Object.assign(state,{aegisSheetSyncStatus:'loading',fixtureInterrupted:true});listeners.forEach(fn=>fn({aegisSheetSyncStatus:{newValue:'loading'}},'local'));await new Promise(resolve=>setTimeout(resolve,20));assert.equal(button.disabled,false,'Orphaned loading permits retry');assert.ok(status.textContent.length);renderChecks++;
  const mutations=[];const observer=new w.MutationObserver(changes=>mutations.push(...changes));observer.observe(status,{childList:true,subtree:true});listeners.forEach(fn=>fn({aegisBadgeScale:{newValue:1}},'local'));await new Promise(resolve=>setTimeout(resolve,20));assert.equal(mutations.length,0,'Unchanged sync feedback is not re-announced');observer.disconnect();
  Object.assign(state,{aegisSheetSyncStatus:'loading',fixtureInterrupted:false,fixtureHold:true});listeners.forEach(fn=>fn({aegisSheetSyncStatus:{newValue:'loading'}},'local'));await new Promise(resolve=>setTimeout(resolve,20));assert.equal(held.length,1);Object.assign(state,{aegisSheetSyncStatus:'success',fixtureHold:false});listeners.forEach(fn=>fn({aegisSheetSyncStatus:{newValue:'success'}},'local'));await new Promise(resolve=>setTimeout(resolve,20));const terminal=status.textContent;held.shift()();assert.equal(status.textContent,terminal,'Older loading reply cannot replace terminal feedback');assert.equal(button.disabled,false);renderChecks++;
  Object.assign(state,{aegisSheetSyncStatus:'loading',fixtureInterrupted:true,fixtureHold:true});listeners.forEach(fn=>fn({aegisSheetSyncStatus:{newValue:'loading'}},'local'));await new Promise(resolve=>setTimeout(resolve,20));state.fixtureHoldManual=true;button.click();await new Promise(resolve=>setTimeout(resolve,20));const retryFeedback=status.textContent;held.splice(0).forEach(fn=>fn());assert.equal(status.textContent,retryFeedback,'Older interrupted reply cannot replace retry feedback');renderChecks++;
  dom.window.close();
 }
 console.log('PASS: real background first-failure/cache/partial/exception/retry contracts and '+renderChecks+' popup state checks across six languages.');
})().catch(error=>{console.error(error);process.exitCode=1;});
