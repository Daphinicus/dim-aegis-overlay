import fs from 'node:fs';
import path from 'node:path';
import { connect } from './load-testing.mjs';
import helpers from '../tests/browser-helpers.cjs';

// Opt-in typing benchmark in a separate, signed-in DIM tab. Existing tabs are
// not reloaded, and the installed testing build is restored afterward. Timings
// cover synchronous beforeinput work, not end-to-end input-to-paint latency.
const config = JSON.parse(fs.readFileSync('testing-build.local', 'utf8'));
const manifestPath = path.resolve('dist/manifest.json');
const originalManifest = fs.readFileSync(manifestPath);
const client = await connect(config.launcher.port);
let tab, installed = false, sessionCreated = false;
try {
  const session = await client.command('session.new', { capabilities: {} });
  sessionCreated = true;
  if (path.resolve(session.capabilities['moz:profile']).toLowerCase() !== path.resolve(config.launcher.profileDirectory).toLowerCase()) {
    throw Error('The debugging connection belongs to a different testing profile');
  }
  const { contexts } = await client.command('browsingContext.getTree', { maxDepth: 0 });
  const source = contexts.find(context => /^https:\/\/app\.destinyitemmanager\.com\/.+\/inventory$/.test(context.url));
  if (!source) throw Error('Open a signed-in DIM inventory tab first');
  fs.copyFileSync('dist/manifest.firefox.json', manifestPath);
  await client.command('webExtension.install', { extensionData: { type: 'path', path: path.resolve('dist') }, 'moz:permanent': false });
  installed = true;
  tab = (await client.command('browsingContext.create', { type: 'tab', background: true })).context;
  const url = process.argv.includes('--beta') ? source.url.replace('//app.', '//beta.') : source.url;
  await client.command('browsingContext.navigate', { context: tab, url, wait: 'interactive' });
  const evaluate = async expression => {
    const response = await client.command('script.evaluate', { target: { context: tab }, awaitPromise: false, expression });
    if (response.type === 'exception') throw Error(response.exceptionDetails.text);
    return response.result?.value;
  };
  const deadline = Date.now() + 60000;
  let summary;
  do {
    summary = JSON.parse(await evaluate(`JSON.stringify((()=>{const response=JSON.parse(document.getElementById('aegis-native-search-response')?.textContent||'null');return response&&{status:response.status,count:response.facts.length,rated:response.facts.filter(f=>f.data.result.grade).length,annotated:document.querySelectorAll('[data-aegis-instance-id]').length}})())`));
    if (summary?.status === 'ready' && summary.count > 0) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  } while (Date.now() < deadline);
  if (summary?.status !== 'ready' || !summary.count) throw Error('Native inventory search did not become ready');
  const display = process.argv.includes('--readable') ? 'readable' : 'exact';
  await evaluate(`document.documentElement.setAttribute('data-aegis-search-display',${JSON.stringify(display)});true`);

  await evaluate(await helpers.bundle('src/dim-search-adapter.ts','AegisSearchProbe'));
  const initial='is:weapon '.repeat(12)+'aegis:god ';
  await evaluate('AegisSearchProbe.findDimStore().dispatch({type:"shell/SEARCH_QUERY",payload:{query:'+JSON.stringify(initial)+',updateVersion:true}});true');
  const settleDeadline=Date.now()+20000;
  let ready = false;
  while (!(ready = await evaluate('document.querySelector("input[name=filter]")?.value === '+JSON.stringify(initial)+' && document.querySelectorAll(".aegis-search-token").length===13')) && Date.now()<settleDeadline) await new Promise(r=>setTimeout(r,250));
  if (!ready) throw Error('The benchmark query and badges did not become ready');
  await evaluate(String.raw`(()=>{
    const editor=document.querySelector('.aegis-inline-search'); editor.focus();
    const selection=document.getSelection();selection.selectAllChildren(editor);selection.collapseToEnd();
    const stats=window.__searchPerf={durations:[],rebuilds:0,clones:0,geometryReads:0,synchronousGeometryReads:0,added:0,removed:0};
    const replace=editor.replaceChildren.bind(editor);editor.replaceChildren=(...args)=>{stats.rebuilds++;return replace(...args);};
    const clone=Range.prototype.cloneContents;Range.prototype.cloneContents=function(){stats.clones++;return clone.call(this);};
    let start,handlingInput=false;
    const rect=Range.prototype.getBoundingClientRect;Range.prototype.getBoundingClientRect=function(){stats.geometryReads++;if(handlingInput)stats.synchronousGeometryReads++;return rect.call(this);};
    editor.addEventListener('beforeinput',()=>{start=performance.now();handlingInput=true;},true);editor.addEventListener('beforeinput',()=>{stats.durations.push(performance.now()-start);handlingInput=false;});
    new MutationObserver(records=>{for(const m of records){stats.added+=m.addedNodes.length;stats.removed+=m.removedNodes.length;}}).observe(editor,{childList:true,subtree:true});
    return true;
  })()`);
  const text='notes:performance-probe-1234567890';
  await client.command('input.performActions',{context:tab,actions:[{type:'key',id:'profile-keyboard',actions:[...text].flatMap(value=>[{type:'keyDown',value},{type:'keyUp',value}])}]});
  const result=JSON.parse(await evaluate(`JSON.stringify((()=>{const stats=window.__searchPerf,sorted=[...stats.durations].sort((a,b)=>a-b);return {...stats,durations:undefined,keystrokes:sorted.length,totalMs:stats.durations.reduce((a,b)=>a+b,0),medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.floor(sorted.length*.95)],query:document.querySelector('input[name=filter]').value};})())`));
  if (result.query !== initial + text || result.keystrokes !== text.length) throw Error('The benchmark did not type the complete query');
  const report = { browser: session.capabilities.browserName, display, inventory: summary.count, ...result };
  console.log(JSON.stringify(report,null,2));
  fs.mkdirSync('scratch',{recursive:true});
  fs.writeFileSync('scratch/search-editor-live-'+(process.argv.slice(2).find(arg => !arg.startsWith('--'))||'sample')+'.json',JSON.stringify(report,null,2));
} finally {
  if (tab) await client.command('browsingContext.close', { context: tab }).catch(() => {});
  try {
    if (installed) await client.command('webExtension.install', { extensionData: { type: 'path', path: config.extensionDirectory }, 'moz:permanent': false });
  } finally {
    fs.writeFileSync(manifestPath, originalManifest);
    if (sessionCreated) await client.command('session.end').catch(() => {});
    client.close();
  }
}
