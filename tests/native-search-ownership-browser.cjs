const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { bundle, launchBrowser } = require('./browser-helpers.cjs');

(async () => {
  const owner = await bundle('src/native-search-input.ts', 'SearchOwner');
  const inline = await bundle('src/inline-search-editor.ts', 'Inline');
  const control = await bundle('src/search-display-control.ts', 'Control');
  // Exercise the production widget lifecycle without starting inventory services.
  const source = fs.readFileSync('src/content.ts', 'utf8');
  const start = source.indexOf('let searchWidget: {');
  const end = source.indexOf('/**\n * Scans', start) === -1
    ? source.indexOf('/**\r\n * Scans', start) : source.indexOf('/**\n * Scans', start);
  assert.ok(start > 0 && end > start, 'Production widget lifecycle boundary');
  const widget = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.abort());
    await page.setContent(`<dialog open id="dimsum-shaders-dialog" class="dimsum-owned-controls">
      <div id="shader-bar"><input type="search" value="Indigo" aria-label="Shader search"></div>
      </dialog><div class="aegis-explorer-panel"><input type="search" name="filter"></div>`);
    await page.addScriptTag({ content: `${owner}\n${inline}\n${control}
      window.stored={aegisSearchDisplay:'exact'}; window.storageWrites=0; window.changes=[];
      window.chrome={storage:{local:{get(keys,callback){queueMicrotask(()=>callback({...stored}));},
        async set(values){storageWrites++;Object.assign(stored,values);}},onChanged:{addListener(){}}}};
      const IS_WINNOWER_HOST=false;
      const findNativeSearchInput=SearchOwner.findNativeSearchInput;
      const attachSearchDisplayControl=Control.attachSearchDisplayControl;
      const t=key=>key;
      const appendSearchQuery=query=>changes.push(query);
      const populateSourceFilter=()=>{}, populateComboboxMenu=()=>{};
      ${widget}
      window.mount=()=>setupSearchWidget();
      window.makeNative=()=>{
        const row=document.createElement('div');row.id='native-row';
        row.innerHTML='<div id="native-bar"><input name="filter" value="is:weapon" aria-label="DIM search"></div>';
        row.querySelector('input').__reactProps$test={onChange:e=>changes.push(e.target.value),onKeyDown(){}};
        document.body.append(row);return row;
      };
      const shader=document.querySelector('#shader-bar input');
      shader.__reactProps$test={onChange:e=>changes.push(e.target.value),onKeyDown(){}};
      mount();Inline.initInlineSearchEditor();` });
    await page.waitForTimeout(40);
    assert.equal(await page.locator('.aegis-search-widget, .aegis-search-display-btn, .aegis-inline-search').count(), 0,
      'Only extension-owned searches: no widget, display control, or editor');
    assert.equal(await page.evaluate(() => SearchOwner.findNativeSearchInput()), null);
    assert.equal(await page.locator('#shader-bar input').inputValue(), 'Indigo');
    await page.evaluate(() => { makeNative(); mount(); });
    await page.waitForFunction(() => !!document.querySelector('#native-bar .aegis-inline-search'));
    assert.equal(await page.locator('#native-bar .aegis-search-widget').count(), 1, 'Skip earlier Shader search and bind DIM');
    assert.equal(await page.locator('#native-row > .aegis-search-display-btn').count(), 1);
    assert.equal(await page.locator('#dimsum-shaders-dialog [class^="aegis-"]').count(), 0);
    await page.evaluate(() => { for (let i = 0; i < 10; i++) mount(); });
    assert.equal(await page.locator('.aegis-search-widget').count(), 1, 'Repeated mount stays idempotent');
    assert.equal(await page.locator('.aegis-inline-search').count(), 1);
    // A connected target can become extension-owned; isConnected alone is insufficient.
    await page.evaluate(() => { document.querySelector('#dimsum-shaders-dialog').append(document.querySelector('#native-row')); mount(); });
    await page.waitForFunction(() => !document.querySelector('.aegis-inline-search'));
    assert.equal(await page.locator('.aegis-search-widget, .aegis-search-display-btn').count(), 0,
      'Rejected connected input disposes the widget and display control before returning');
    assert.equal(await page.locator('#native-bar input[name="filter"]').getAttribute('data-aegis-native-search'), null);
    await page.evaluate(() => { document.body.append(document.querySelector('#native-row')); mount(); });
    await page.waitForFunction(() => !!document.querySelector('#native-bar .aegis-inline-search'));
    await page.evaluate(() => { document.querySelector('#native-row').remove(); mount(); });
    await page.waitForFunction(() => !document.querySelector('.aegis-inline-search'));
    assert.equal(await page.locator('.aegis-search-widget, .aegis-search-display-btn').count(), 0, 'Native removal cleans up');
    await page.evaluate(() => { makeNative(); mount(); });
    await page.waitForFunction(() => !!document.querySelector('#native-bar .aegis-inline-search'));
    assert.equal(await page.locator('#native-bar input[name="filter"]').inputValue(), 'is:weapon', 'Restoration preserves DIM query');
    assert.equal(await page.locator('#shader-bar input').inputValue(), 'Indigo', 'Shader query is never overwritten');
    assert.equal(await page.evaluate(() => storageWrites), 0, 'Lifecycle does not reset saved display preference');
    assert.deepEqual(await page.evaluate(() => changes), [], 'No filter/query writes during mount or disposal');
    assert.deepEqual(errors, [], 'No browser errors');
    await page.evaluate(() => window.__aegisInlineSearchDispose());
    console.log('PASS: extension search exclusion, native anchor order, connected ownership rejection, cleanup, restoration, query and preference preservation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
