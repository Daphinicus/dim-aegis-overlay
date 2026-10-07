const assert = require('node:assert/strict');
const path = require('node:path');
const { launchBrowser } = require('./browser-helpers.cjs');

(async () => {
  const { build } = await import('vite');
  const source = name => JSON.stringify(path.resolve('src', name).replaceAll('\\', '/'));
  const result = await build({ configFile: false, publicDir: false, logLevel: 'error',
    resolve: { extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'] },
    plugins: [{ name: 'popup-guard-fixture', resolveId: id => id.endsWith('popup-guard-fixture') ? 'popup-guard-fixture' : null,
      load: id => id === 'popup-guard-fixture' ? `
        import { initPopupInteraction, isTileTooltipSuppressed } from ${source('popup-interaction.ts')};
        import { showTooltip, hideTooltip } from ${source('tooltip.ts')};
        let dismissals = 0;
        initPopupInteraction(() => { dismissals++; hideTooltip(); });
        window.popupFixture = {
          suppressed: isTileTooltipSuppressed,
          get dismissals() { return dismissals; },
          render(embedded) {
            const host = embedded ? document.createElement('div') : undefined;
            showTooltip(document.getElementById('item'), {grade:'A',notes:'',matchedPerks:[],missingPerks:[]},
              'Fixture armor', {}, [], false, null, undefined, false, null, {},
              {piece2Rating:'A',piece2Name:'Set bonus',piece2Desc:'Recommendation',source:'Activity',sourceType:'Activity'},
              null, 'pve', 'sheet', null, null, {contentHost:host});
            const tooltip = document.getElementById('aegis-hover-tooltip');
            return host ? host.childElementCount : !!tooltip && !tooltip.classList.contains('hidden');
          },
        };` : null }],
    build: { write: false, lib: { entry: 'popup-guard-fixture', name: 'PopupGuardFixture', formats: ['iife'] } },
  });
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    await page.setContent('<div id="item" class="item">Armor</div><section class="item-popup" data-dimsum-workspace-native="details" id="details"></section>');
    await page.addScriptTag({ content: (Array.isArray(result) ? result[0] : result).output[0].code });
    assert.equal(await page.evaluate(() => popupFixture.suppressed()), false, 'Persistent Details leaves tooltips available');
    assert.ok(await page.evaluate(() => popupFixture.render(true)), 'Uncached embedded recommendations render with Details open');
    assert.equal(await page.evaluate(() => popupFixture.render(false)), true, 'Standalone recommendations render with Details open');
    await page.evaluate(() => document.getElementById('details').append(document.createElement('span')));
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(await page.evaluate(() => popupFixture.dismissals), 0, 'Details mutations do not dismiss tooltips');

    await page.evaluate(() => {
      const popup = document.createElement('div'); popup.id = 'floating'; popup.className = 'item-popup'; document.body.append(popup);
    });
    assert.equal(await page.evaluate(() => popupFixture.suppressed()), true, 'A floating popup still blocks standalone tooltips');
    assert.equal(await page.evaluate(() => popupFixture.render(false)), false, 'Standalone renderer honors floating-popup suppression');
    assert.ok(await page.evaluate(() => popupFixture.render(true)), 'Embedded rendering delegates visibility to its owner');
    assert.ok(await page.evaluate(() => popupFixture.dismissals) > 0, 'Floating popups retain dismissal behavior');
    await page.evaluate(() => document.getElementById('floating').remove());
    assert.equal(await page.evaluate(() => popupFixture.suppressed()), false, 'Removing the floating popup restores tooltips beside Details');
    console.log('PASS: persistent Details, fresh embedded recommendations, standalone rendering, mutation dismissal, and floating-popup boundaries.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
