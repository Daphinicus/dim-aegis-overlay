const assert = require('node:assert/strict');
const fs = require('node:fs');
const { bundle, launchBrowser } = require('./browser-helpers.cjs');

(async () => {
  const inline = await bundle('src/inline-search-editor.ts', 'Inline');
  const control = await bundle('src/search-display-control.ts', 'Control');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 850, height: 300 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://www.bungie.net/**', route => route.abort());
    await page.setContent(`<style>${fs.readFileSync('public/styles.css', 'utf8')}
      body{background:#222;color:white;font:13px Arial}.search-host{display:block}.bar{display:flex;align-items:center;position:relative;width:100%;background:#333}input{flex:1;min-width:0}button{flex-shrink:0}
      </style><span class="search-host"><div class="bar"><input name="filter" aria-label="Search"><div class="aegis-search-widget"><button class="aegis-search-widget-btn">Shield</button></div><button>Star</button></div></span>
      <script>${inline}\n${control}
      window.stored={};window.storageListeners=[];window.changes=[];
      window.chrome={storage:{local:{get(keys,callback){queueMicrotask(()=>callback({...stored}));},async set(values){
        const changes={};for(const key in values){changes[key]={oldValue:stored[key],newValue:values[key]};stored[key]=values[key];}
        for(const listener of storageListeners)listener(changes,'local');
      }},onChanged:{addListener(listener){storageListeners.push(listener);}}}};
      const input=document.querySelector('input');
      input.value='aegis:p:>=s breaker:overload';
      input.__reactProps$test={onChange:e=>changes.push(e.target.value),onKeyDown(){}};
      window.attach=()=>{window.dispose=Inline.attachInlineSearchEditor(input,term=>/^(aegis:|breaker:|notes:|is:|custom:)/.test(term),document.documentElement.getAttribute('data-aegis-search-display')||'exact');};
      window.disposeControl=Control.attachSearchDisplayControl(document.querySelector('.bar'));
      attach();new MutationObserver(()=>dispose.setMode(document.documentElement.getAttribute('data-aegis-search-display'))).observe(document.documentElement,{attributes:true,attributeFilter:['data-aegis-search-display']});
      </script>`);
    const editor = page.locator('.aegis-inline-search'), input = page.locator('input'), toggle = page.locator('.aegis-search-display-btn');
    const raw = 'aegis:p:>=s breaker:overload';
    const currentMode = () => toggle.getAttribute('data-mode');
    const cycle = async mode => { await toggle.click(); await page.waitForFunction(expected => document.querySelector('.aegis-search-display-btn').dataset.mode === expected, mode); };
    assert.equal(await currentMode(), 'exact');
    assert.deepEqual(await editor.locator('.aegis-search-token-label').allTextContents(), ['aegis:p:>=s', 'breaker:overload']);
    await editor.focus(); await page.keyboard.press('Home'); await page.keyboard.type('notes:before');
    assert.equal(await input.inputValue(), 'notes:before ' + raw, 'Typing before an immutable badge stays in one draft');
    assert.equal(await editor.locator('.aegis-search-token').count(), 2);
    await cycle('readable');
    assert.equal(await editor.locator('.aegis-search-token').count(), 2, 'Switching badge style preserves an active middle draft');
    await page.keyboard.type('x');
    assert.equal(await input.inputValue(), 'notes:beforex ' + raw, 'Switching badge style preserves the draft caret');
    await input.evaluate((el, raw) => { el.value = raw; el.dispatchEvent(new Event('input', { bubbles: true })); }, raw);
    await page.waitForFunction(() => !document.querySelector('.aegis-inline-search').textContent.includes('before'));
    await cycle('classic'); await cycle('exact');
    await page.evaluate(() => { changes.length = 0; });
    await editor.focus(); await page.keyboard.press('End');
    await cycle('readable');
    assert.deepEqual(await editor.locator('.aegis-search-token-label').allTextContents(), ['Perk ≥ S', 'Overload']);
    assert.equal(await editor.locator('strong').textContent(), '≥');
    assert.match(await editor.locator('img').getAttribute('src'), /DestinyBreakerTypeDefinition_/);
    assert.equal(await editor.locator('.aegis-search-token').first().getAttribute('title'), 'aegis:p:>=s');
    assert.equal(await input.inputValue(), raw);
    assert.equal(await page.evaluate(() => changes.length), 0, 'Changing presentation never submits a query');
    assert.equal(await editor.evaluate(el => document.activeElement === el), true, 'Pointer switching preserves editor focus');
    await page.keyboard.type(' notes:"two  spaces"');
    assert.equal(await input.inputValue(), raw + ' notes:"two  spaces"', 'Typing after shorter labels uses raw query offsets');
    assert.equal(await editor.locator('.aegis-search-token').count(), 2, 'Readable mode keeps the active draft editable');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Control+a');
    // Firefox's synthetic event owns a different store than the constructor input.
    const copy = await editor.evaluate(el => {
      const event = new ClipboardEvent('copy', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true }); el.dispatchEvent(event); return event.clipboardData.getData('text/plain');
    });
    assert.equal(copy, raw + ' notes:"two  spaces"', 'Copy returns exact syntax, not readable labels or icon text');
    await cycle('classic');
    assert.equal(await editor.isVisible(), false);
    assert.equal(await input.getAttribute('data-aegis-native-search'), null, 'Classic restores DIM input');
    assert.equal(await input.evaluate(el => document.activeElement === el), true);
    assert.equal(await input.evaluate(el => el.selectionEnd - el.selectionStart), copy.length, 'Selection survives mode changes');
    await page.keyboard.press('End'); await page.keyboard.type(' draft');
    await page.keyboard.press('Control+z');
    assert.equal(await input.inputValue(), copy + ' draf', 'Classic shares query undo history');
    await cycle('exact');
    await page.keyboard.press('Control+z');
    assert.equal(await input.inputValue(), copy + ' dra', 'Undo survives switching from Classic to badges');
    await page.keyboard.press('Control+Shift+z');
    assert.equal(await input.inputValue(), copy + ' draf', 'Redo survives presentation changes');
    await cycle('readable');
    await editor.getByRole('button', { name: 'Remove breaker:overload', exact: true }).click();
    assert.equal(await input.inputValue(), 'aegis:p:>=s notes:"two  spaces" draf', 'X removes the intended raw term');
    await page.keyboard.press('Control+z');
    assert.equal(await input.inputValue(), copy + ' draf');
    // A selection between a shortened badge and another token must still refer
    // to the raw query, including backward selections and clipboard operations.
    await editor.evaluate(el => {
      const nodes = [...el.childNodes], badge = el.querySelector('[data-search-raw="breaker:overload"]');
      const index = nodes.indexOf(badge); document.getSelection().setBaseAndExtent(el, index + 1, el, index);
    });
    const cut = await editor.evaluate(el => {
      const event = new ClipboardEvent('cut', { clipboardData: new DataTransfer(), bubbles: true, cancelable: true }); el.dispatchEvent(event); return event.clipboardData.getData('text/plain');
    });
    assert.equal(cut, 'breaker:overload', 'Backward selection cuts exact syntax');
    assert.equal(await input.inputValue(), 'aegis:p:>=s  notes:"two  spaces" draf');
    await page.keyboard.press('Control+z');
    await input.evaluate(el => { el.value = 'custom:future -breaker:overload OR (aegis:w:<=a notes:"<img src=x>")'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(() => document.querySelector('[data-search-raw="custom:future"]'));
    assert.equal(await editor.locator('.aegis-search-token-label').first().textContent(), 'custom:future', 'Unknown terms retain exact text');
    assert.equal(await editor.locator('.aegis-search-token-label img').count(), 0, 'Readable text cannot inject HTML');
    assert.deepEqual(await editor.locator('.aegis-search-operator').allTextContents(), ['-', 'OR']);
    await page.setViewportSize({ width: 360, height: 300 });
    assert.equal(await page.evaluate(() => {
      const editor = document.querySelector('.aegis-inline-search').getBoundingClientRect();
      const widget = document.querySelector('.aegis-search-widget').getBoundingClientRect();
      const bar = document.querySelector('.bar'), bounds = bar.getBoundingClientRect();
      const button = document.querySelector('.aegis-search-display-btn'), control = button.getBoundingClientRect();
      return editor.right <= widget.left + 1 && widget.right <= bounds.right &&
        !bar.contains(button) && bar.nextElementSibling === button &&
        control.left >= bounds.right + 5 && control.left <= bounds.right + 7 &&
        Math.abs(control.top + control.height / 2 - bounds.top - bounds.height / 2) <= 1 &&
        control.right <= document.documentElement.clientWidth;
    }), true, 'Toggle sits immediately outside the bar on the right, without overlap or wrapping at narrow widths');
    await toggle.focus(); await page.keyboard.press('Space');
    assert.equal(await currentMode(), 'classic', 'Keyboard activation cycles the mode');
    assert.equal(await toggle.evaluate(el => document.activeElement === el), true, 'Keyboard cycling keeps button focus');
    assert.equal(await page.evaluate(() => stored.aegisSearchDisplay), 'classic', 'Choice is persisted');
    const beforeComposition = await input.inputValue();
    await input.focus();
    await input.evaluate(el => {
      el.setSelectionRange(el.value.length, el.value.length);
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      el.value += ' 日本';
      el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText', data: '日本' }));
    });
    await page.evaluate(() => chrome.storage.local.set({ aegisSearchDisplay: 'readable' }));
    assert.equal(await currentMode(), 'readable', 'Other-tab preference changes are applied');
    assert.equal(await editor.isVisible(), false, 'A mode change waits for native composition to finish');
    await input.evaluate(el => el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '日本' })));
    assert.equal(await editor.isVisible(), true);
    assert.equal(await input.inputValue(), beforeComposition + ' 日本', 'Composition is retained across a deferred mode change');
    await page.keyboard.press('Control+z');
    assert.equal(await input.inputValue(), beforeComposition, 'Native composition is one shared undo step');
    await page.evaluate(() => { disposeControl(); disposeControl = Control.attachSearchDisplayControl(document.querySelector('.bar')); });
    assert.equal(await toggle.count(), 1, 'Remount does not duplicate the control');
    assert.equal(await currentMode(), 'readable', 'Remount retains the chosen mode');
    await page.setViewportSize({ width: 850, height: 300 });
    await page.screenshot({ path: 'scratch/search-display-readable.png' });
    await page.evaluate(() => { dispose(); disposeControl(); });
    assert.equal(await input.getAttribute('data-aegis-native-search'), null);
    assert.equal(await page.locator('[data-aegis-search-display-host], [data-aegis-search-display-bar]').count(), 0, 'Disposal restores native layout');
    assert.deepEqual(errors, []);
    console.log('PASS: three display modes, exact query preservation, readable offsets, copy/cut, undo, icons, unknown terms, storage, keyboard focus, narrow layout, and cleanup');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
