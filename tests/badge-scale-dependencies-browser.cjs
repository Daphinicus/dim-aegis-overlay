const path = require('node:path');
const assert = require('node:assert/strict');
const { bundle, launchBrowser } = require('./browser-helpers.cjs');
const { css, sizing, populate } = require('./badge-scale-browser.cjs');
const { templateCode, populateTemplates, snapshot, compare } = require('./badge-structure-browser.cjs');

(async () => {
  const code = await templateCode();
  const controller = await bundle(path.join(__dirname, 'badge-scale-dependencies.fixture.ts'), 'Dependencies');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1100 }, deviceScaleFactor: Number(process.env.AEGIS_TEST_DPR || 1) });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<iframe name="actual"></iframe><iframe name="reference"></iframe><style>body{margin:0}iframe{width:690px;height:1080px;border:0}</style>');
    const frames = [page.frame({ name: 'actual' }), page.frame({ name: 'reference' })];
    for (const frame of frames) {
      await frame.setContent(`<style>${css}
        body{margin:8px;background:#20242a;color:white}.grid{display:flex;gap:12px;flex-wrap:wrap;align-items:start}
        .item{position:relative;contain:strict;box-sizing:border-box;flex:none;background:#353944}
        .icon{height:var(--item-size);background:linear-gradient(45deg,#614972,#968947);border:1px solid #ccc;box-sizing:border-box}
        .item .aegis-badge,.item:hover .aegis-badge.aegis-hover-fade{transition:none!important}
      </style><div class="grid"></div><div id="reading"><span class="aegis-tooltip-grade">S+</span><span class="aegis-popup-grade-badge">A</span><div class="interactive-weapon-tile"><div class="aegis-badge aegis-style-pill">S+</div></div></div>`);
      await frame.addScriptTag({ content: sizing + '\n' + code + '\n' + controller + '\nColors=Dependencies.Colors;\n' + populate.toString() });
      await frame.evaluate(populateTemplates, false);
      await frame.evaluate(() => {
        // Settings are global in production. Keep one geometry/style case per
        // setting pair, then drive all retained nodes through the real setter.
        cases = cases.filter(({ tile, label }) => {
          const keep = label.split('/')[3] === '1' && label.split('/')[4] === '1.3';
          if (!keep) { releaseFooterSize(tile.lastElementChild); tile.remove(); }
          return keep;
        });
        Colors.applyGradeColors(document.getElementById('reading'));
      });
    }
    async function configure(size, text) {
      for (const [i, frame] of frames.entries()) await frame.evaluate(async ({ size, text, actual }) => {
        for (const { tile } of cases) {
          tile.style.setProperty('--aegis-badge-size', String(size / 100));
          tile.style.setProperty('--aegis-badge-scale', String(text / 100));
        }
        if (actual) {
          if (Dependencies.Scale.setInventoryBadgeScale(size, text)) Colors.refreshInventoryBadgeShadows();
        } else {
          document.documentElement.style.setProperty('--aegis-badge-size', String(size / 100));
          document.documentElement.style.setProperty('--aegis-badge-scale', String(text / 100));
        }
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, { size, text, actual: i === 0 });
    }
    function appearance() {
      return cases.map(({ tile }) => [tile.lastElementChild, ...tile.lastElementChild.querySelectorAll('*')].map(node => {
        const s = getComputedStyle(node);
        const pseudo = getComputedStyle(node, '::after');
        return [s.color, s.backgroundImage, s.textShadow, s.fontSize, s.fontFamily, s.fontWeight, s.letterSpacing, s.padding, s.borderLeft, s.borderRadius, s.gap, pseudo.content, pseudo.boxShadow];
      }));
    }
    let checked = 0;
    for (const size of [70, 100, 105, 150]) for (const text of [70, 130]) {
      await configure(size, text);
      const values = await Promise.all(frames.map(frame => frame.evaluate(snapshot)));
      compare(...values); checked += values[0].length;
      assert.deepEqual(...await Promise.all(frames.map(frame => frame.evaluate(appearance))), `computed appearance at ${size}/${text}`);
    }
    // Exercise changes that used to reuse an inline color-style cache.
    await configure(105, 130);
    for (const color of ['perk', 'archetype', 'gradient']) {
      for (const frame of frames) await frame.evaluate(color => {
        Colors.setBadgeColor(color); Colors.applyGradeColors(document.body);
      }, color);
      assert.deepEqual(...await Promise.all(frames.map(frame => frame.evaluate(appearance))));
    }
    for (const frame of frames) await frame.evaluate(() => {
      for (const { tile } of cases) tile.lastElementChild.classList.add('aegis-hover-fade');
    });
    for (const style of ['classic', 'pill', 'notch', 'footer']) {
      // One pointer cannot hover both frames at once. Capture each hovered
      // state before moving to the other frame, with geometry transitions off.
      const hovered = [];
      for (const frame of frames) {
        await frame.locator(`[data-scale-case="${style}/split/60/1/1.3"]`).hover({ position: { x: 10, y: 10 } });
        hovered.push(await frame.evaluate(snapshot));
      }
      compare(...hovered);
    }
    for (const frame of frames) await frame.locator('#reading').hover();
    const reading = await Promise.all(frames.map(frame => frame.evaluate(() => [...document.querySelectorAll('#reading *')].map(n => {
      const s = getComputedStyle(n); return [s.fontFamily, s.fontSize, s.lineHeight, s.padding, s.textShadow, s.zoom];
    }))));
    assert.deepEqual(...reading, 'previews and reading surfaces retain their original typography and sizing');
    const lifecycle = await frames[0].evaluate(async () => {
      const tile = cases.find(c => c.label === 'footer/split/60/1/1.3').tile.cloneNode(true);
      document.querySelector('.grid').appendChild(tile);
      Colors.applyGradeColors(tile.lastElementChild);
      const freshShadow = tile.querySelector('.aegis-split-half').style.textShadow;
      if (freshShadow.includes('var(')) throw Error('Newly attached badges must use the current resolved shadow');
      tile.remove();
      const sheet = document.getElementById('aegis-inventory-badge-scale');
      let changes = 0;
      const observer = new MutationObserver(records => changes += records.length);
      observer.observe(sheet, { childList: true, subtree: true, characterData: true });
      for (let i = 0; i < 10; i++) {
        Dependencies.Scale.setInventoryBadgeScale(105, 130);
        Colors.applyGradeColors(document.body);
      }
      await Promise.resolve(); observer.disconnect();
      const dynamic = [...document.querySelectorAll('.item > .aegis-badge .aegis-split-half')].filter(n => n.style.textShadow.includes('var(')).length;
      const old = sheet.textContent; sheet.remove();
      Dependencies.Scale.setInventoryBadgeScale(105, 130);
      const restored = document.getElementById('aegis-inventory-badge-scale').textContent === old;
      return { changes, dynamic, restored, count: document.querySelectorAll('#aegis-inventory-badge-scale').length };
    });
    assert.deepEqual(lifecycle, { changes: 0, dynamic: 0, restored: true, count: 1 });
    const repaired = await frames[0].evaluate(() => {
      const label = document.querySelector('.item > .aegis-badge .aegis-split-half');
      const expected = label.style.background;
      label.style.setProperty('background', 'red', 'important');
      Dependencies.Scale.setInventoryBadgeScale(150, 130);
      Colors.refreshInventoryBadgeShadows();
      Colors.applyGradeColors(label);
      return label.style.background === expected;
    });
    assert.ok(repaired, 'size updates preserve invalidation of externally changed color styles');
    for (const frame of frames) await frame.evaluate(() => {
      const sheet = document.querySelector('style');
      sheet.textContent = sheet.textContent.replace('.item .aegis-badge,.item:hover .aegis-badge.aegis-hover-fade{transition:none!important}', '');
      document.querySelector('[data-scale-case="footer/split/60/1/1.3"] .aegis-badge').classList.remove('aegis-hover-fade');
    });
    const duration = frame => frame.evaluate(() => getComputedStyle(document.querySelector('[data-scale-case="footer/split/60/1/1.3"] .aegis-badge')).transitionDuration);
    assert.equal(await duration(frames[0]), await duration(frames[1]), 'idle transitions preserve the variable-based reference');
    for (const frame of frames) await frame.evaluate(() => document.querySelector('[data-scale-case="footer/split/60/1/1.3"] .aegis-badge').classList.add('aegis-hover-fade'));
    assert.equal(await duration(frames[0]), await duration(frames[1]), 'enabled hover fading keeps the original idle transition');
    for (const frame of frames) {
      await frame.locator('[data-scale-case="footer/split/60/1/1.3"]').hover({position:{x:10,y:10}});
      assert.equal(await duration(frame), '0.15s, 0.15s', 'hover entry keeps the original transition');
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: ${checked} production badge cases preserve geometry, wrapping, and computed appearance; size/text/color updates, hover, reading surfaces, and stylesheet reuse pass.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
