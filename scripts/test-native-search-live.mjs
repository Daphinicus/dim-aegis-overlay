import fs from 'node:fs';
import path from 'node:path';
import { connect } from './load-testing.mjs';
import helpers from '../tests/browser-helpers.cjs';

// Opt-in integration test. Only Compare and the Strip Sockets preview are opened.
// Existing DIM tabs are not reloaded. The installed testing build is restored.
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
  // Override presentation only in this disposable tab. Do not persist a test
  // preference or change the display of the user's other DIM tabs.
  await evaluate(`document.documentElement.setAttribute('data-aegis-search-display','exact');true`);
  await evaluate(await helpers.bundle('src/dim-search-adapter.ts', 'AegisSearchProbe'));
  // Use browser keystrokes: the legacy input listener consumed the first filter
  // on Space, which direct Redux dispatch and parser tests cannot reproduce.
  await evaluate(`AegisSearchProbe.findDimStore().dispatch({type:'shell/SEARCH_QUERY',payload:{query:'',updateVersion:true}});true`);
  await new Promise(resolve => setTimeout(resolve, 300));
  await evaluate(`document.querySelector('.aegis-inline-search').focus();true`);
  const type = async text => {
    await client.command('input.performActions', { context: tab, actions: [{ type: 'key', id: 'search-keyboard',
      actions: [...text].flatMap(value => [{ type: 'keyDown', value }, { type: 'keyUp', value }]) }] });
    await new Promise(resolve => setTimeout(resolve, 650));
  };
  await type('\uE010');
  await type('aegis:go');
  if (await evaluate(`document.querySelectorAll('.aegis-search-token').length`) !== 0) throw Error('A partial typed term became a badge');
  await type('d');
  if (await evaluate(`document.querySelectorAll('.aegis-search-token').length`) !== 0) throw Error('A term became a badge before the user committed it');
  await type(' ');
  if (!(await evaluate(`document.querySelector('.aegis-search-token')?.contentEditable === 'false'`))) throw Error('Space did not produce an immutable badge');
  const afterSpace = JSON.parse(await evaluate(`JSON.stringify({text:document.querySelector('input[name="filter"]').value,pills:document.querySelectorAll('.aegis-filter-pill').length,editor:document.querySelector('.aegis-inline-search').outerHTML,active:document.activeElement.className,focused:document.hasFocus(),selection:document.getSelection()?.anchorNode?.textContent})`));
  if (afterSpace.text !== 'aegis:god ' || afterSpace.pills) throw Error('Space consumed the first Aegis filter: '+JSON.stringify(afterSpace));
  await type('-aegis:god');
  // DIM debounces input with a timer, which Gecko throttles in background tabs.
  const typingDeadline = Date.now() + 15000;
  while (await evaluate(`AegisSearchProbe.findDimStore().getState().shell.searchQuery`) !== 'aegis:god -aegis:god' && Date.now() < typingDeadline) {
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const combined = JSON.parse(await evaluate(`JSON.stringify((()=>{
    const runtime=AegisSearchProbe.discoverDimSearch(),state=runtime.store.getState();
    const valid=runtime.selectors.find(fn=>String(fn.resultFunc).endsWith('.valid'));
    const filtered=runtime.selectors.find(fn=>String(fn.resultFunc).includes('.location.hash')&&String(fn.resultFunc).includes('.filter('));
    return {text:document.querySelector('input[name="filter"]').value,query:state.shell.searchQuery,valid:valid(state),count:filtered(state).length,pills:document.querySelectorAll('.aegis-filter-pill').length};
  })())`));
  if (combined.text !== 'aegis:god -aegis:god' || combined.query !== combined.text ||
      !combined.valid || combined.count !== 0 || combined.pills) throw Error('Typed Aegis filters did not combine: ' + JSON.stringify(combined));
  console.log('PASS: Space preserves the first Aegis filter; a second typed filter intersects native results without detached pills');
  await evaluate(`AegisSearchProbe.findDimStore().dispatch({type:'shell/SEARCH_QUERY',payload:{query:'',updateVersion:true}});true`);
  const clearDeadline = Date.now() + 15000;
  while (!(await evaluate(`document.querySelector('input[name="filter"]').value === '' && document.querySelector('.aegis-inline-search').textContent === ''`)) && Date.now() < clearDeadline) {
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  await evaluate(`document.querySelector('.aegis-inline-search').focus();true`);
  await type('\uE010'); // End establishes a caret even in an unfocused background document.
  await type('is:handc');
  if (!(await evaluate(`document.activeElement.classList.contains('aegis-inline-search')`))) throw Error('Typing lost focus to the hidden native input');
  await type('\uE004'); // WebDriver's Tab key exercises DIM's native completion.
  const completed = await evaluate(`document.querySelector('input[name="filter"]').value`);
  if (!completed.includes('is:handcannon')) throw Error('Native Tab completion failed: ' + completed);
  console.log('PASS: Native DIM Tab autocomplete works through the inline editor');
  const completionDeadline = Date.now() + 15000;
  while (await evaluate(`AegisSearchProbe.findDimStore().getState().shell.searchQuery`) !== completed && Date.now() < completionDeadline) await new Promise(resolve => setTimeout(resolve, 250));
  await evaluate(`AegisSearchProbe.findDimStore().dispatch({type:'shell/SEARCH_QUERY',payload:{query:'',updateVersion:true}});true`);
  const badgeClearDeadline = Date.now() + 15000;
  while (!(await evaluate(`document.querySelector('input[name="filter"]').value === '' && document.querySelector('.aegis-inline-search').textContent === ''`)) && Date.now() < badgeClearDeadline) await new Promise(resolve => setTimeout(resolve, 250));
  await evaluate(`document.querySelector('.aegis-inline-search').focus();true`);
  await type('\uE010');
  await type('breaker:barrier');
  if (await evaluate(`document.querySelectorAll('.aegis-search-token').length`) !== 0) throw Error('Typing the native term produced a premature badge: ' + await evaluate(`JSON.stringify({value:document.querySelector('input[name="filter"]').value,editor:document.querySelector('.aegis-inline-search').outerHTML,active:document.activeElement.className})`));
  await type(' ');
  const badgeState = JSON.parse(await evaluate(`JSON.stringify((()=>{
    const input=document.querySelector('input[name="filter"]'), editor=document.querySelector('.aegis-inline-search'), badge=editor.querySelector('.aegis-search-token');
    return {value:input.value,badges:editor.querySelectorAll('.aegis-search-token').length,editable:badge?.contentEditable,nativePosition:getComputedStyle(input).position,nativeWidth:input.getBoundingClientRect().width};
  })())`));
  if (badgeState.value !== 'breaker:barrier ' || badgeState.badges !== 1 || badgeState.editable !== 'false' || badgeState.nativePosition !== 'absolute' || badgeState.nativeWidth > 2) throw Error('Native badge conversion or duplicate-field regression: '+JSON.stringify(badgeState));
  const bounds = JSON.parse(await evaluate(`JSON.stringify((()=>{const r=document.querySelector('input[name="filter"]').parentElement.getBoundingClientRect();return {type:'box',x:r.x,y:r.y,width:r.width,height:r.height};})())`));
  const screenshot = await client.command('browsingContext.captureScreenshot', { context:tab, origin:'viewport', clip:bounds });
  fs.mkdirSync('scratch', {recursive:true});
  fs.writeFileSync('scratch/inline-search-live-'+new URL(url).hostname+'.png',Buffer.from(screenshot.data,'base64'));
  await type('\uE003'); // Backspace: remove trailing space, then the whole badge.
  await type('\uE003');
  if (await evaluate(`document.querySelector('input[name="filter"]').value`) !== '') throw Error('Backspace partially edited a badge');
  console.log('PASS: Draft text converts only on commit, badges are immutable, native input is hidden, and Backspace removes whole terms');
  const modeQuery = 'aegis:p:>=s breaker:overload';
  await evaluate(`AegisSearchProbe.findDimStore().dispatch({type:'shell/SEARCH_QUERY',payload:{query:${JSON.stringify(modeQuery)},updateVersion:true}});document.documentElement.setAttribute('data-aegis-search-display','readable');true`);
  const modeDeadline = Date.now() + 15000;
  while (!(await evaluate(`document.querySelector('.aegis-search-token-label')?.textContent==='Perk ≥ S' && document.querySelectorAll('.aegis-search-token').length===2`)) && Date.now() < modeDeadline) await new Promise(resolve => setTimeout(resolve, 250));
  const readable = JSON.parse(await evaluate(`JSON.stringify((()=>{const e=document.querySelector('.aegis-inline-search');return {labels:[...e.querySelectorAll('.aegis-search-token-label')].map(n=>n.textContent),raw:document.querySelector('input[name=filter]').value,icon:e.querySelector('img')?.src};})())`));
  if (readable.raw !== modeQuery || readable.labels.join('|') !== 'Perk ≥ S|Overload' || !readable.icon?.includes('DestinyBreakerTypeDefinition_')) throw Error('Readable mode changed the query or displayed incorrect labels: '+JSON.stringify(readable));
  const iconDeadline = Date.now() + 10000;
  while (!(await evaluate(`document.querySelector('.aegis-search-token-icon')?.naturalWidth>0`)) && Date.now() < iconDeadline) await new Promise(resolve => setTimeout(resolve, 250));
  if (!(await evaluate(`document.querySelector('.aegis-search-token-icon')?.naturalWidth>0`))) throw Error('The champion icon did not load');
  const readableBounds = JSON.parse(await evaluate(`JSON.stringify((()=>{const r=document.querySelector('input[name="filter"]').parentElement.getBoundingClientRect();return {type:'box',x:r.x,y:r.y,width:r.width,height:r.height};})())`));
  const readableScreenshot = await client.command('browsingContext.captureScreenshot', { context:tab, origin:'viewport', clip:readableBounds });
  fs.writeFileSync('scratch/search-display-live-'+new URL(url).hostname+'.png',Buffer.from(readableScreenshot.data,'base64'));
  await evaluate(`document.querySelector('.aegis-inline-search').focus();true`);
  await type('\uE010');
  await type(' notes:probe');
  if (await evaluate(`document.querySelector('input[name=filter]').value`) !== modeQuery + ' notes:probe') throw Error('Readable labels changed typing offsets');
  await evaluate(`document.documentElement.setAttribute('data-aegis-search-display','classic');true`);
  await new Promise(resolve => setTimeout(resolve, 300));
  if (!(await evaluate(`document.querySelector('.aegis-inline-search').hidden && !document.querySelector('input[name=filter]').hasAttribute('data-aegis-native-search')`))) throw Error('Classic mode did not restore the native input');
  await type('\uE003');
  const classicQuery = modeQuery + ' notes:prob';
  const classicDeadline = Date.now() + 15000;
  while (await evaluate(`AegisSearchProbe.findDimStore().getState().shell.searchQuery`) !== classicQuery && Date.now() < classicDeadline) await new Promise(resolve => setTimeout(resolve, 250));
  if (await evaluate(`AegisSearchProbe.findDimStore().getState().shell.searchQuery`) !== classicQuery) throw Error('Classic typing did not reach DIM');
  await evaluate(`document.documentElement.setAttribute('data-aegis-search-display','exact');true`);
  await new Promise(resolve => setTimeout(resolve, 300));
  if (await evaluate(`document.querySelector('input[name=filter]').value`) !== classicQuery) throw Error('Switching to exact badges changed the edited query');
  console.log('PASS: readable labels and champion icon retain exact queries; Classic typing reaches DIM; switching back preserves edits');
  const probe = fs.readFileSync('tests/native-search-live-probe.js', 'utf8');
  await evaluate(`window.__nativeSearchPending=true;Promise.resolve(${probe}).then(result=>{window.__nativeSearchResult=result;window.__nativeSearchPending=false},error=>{window.__nativeSearchResult={passed:false,error:error.message};window.__nativeSearchPending=false});true`);
  // Gecko can throttle each timer in this background tab after it has been idle.
  const consumerDeadline = Date.now() + 180000;
  let report;
  do {
    report = JSON.parse(await evaluate('JSON.stringify({pending:window.__nativeSearchPending,stage:window.__nativeSearchStage,result:window.__nativeSearchResult})'));
    if (!report.pending) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  } while (Date.now() < consumerDeadline);
  const result = { browser: session.capabilities.browserName, version: session.capabilities.browserVersion,
    host: new URL(url).hostname, inventory: summary, ...report };
  console.log(JSON.stringify(result, null, 2));
  if (report.pending || !report.result?.passed) throw Error('Native consumer checks failed');
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
