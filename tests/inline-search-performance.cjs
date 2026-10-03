const assert = require('node:assert/strict');
const fs = require('node:fs');
const { bundle, launchBrowser } = require('./browser-helpers.cjs');

(async () => {
  const code = await bundle('src/inline-search-editor.ts', 'Inline');
  const browser = await launchBrowser();
  try {
    for (const mode of ['exact', 'readable']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const initial = 'is:weapon '.repeat(12) + 'aegis:god ';
    const draft = 'notes:performance-probe-1234567890';
    await page.setContent(`<style>${fs.readFileSync('public/styles.css', 'utf8')}
      body{background:#222;color:white}.bar{display:flex;position:relative;width:850px}
      .inventory{display:grid;grid-template-columns:repeat(20,48px);gap:4px}.item{height:48px;background:#555}
      </style><div class="bar"><input name="filter"><button class="aegis-search-widget">Shield</button></div>
      <div class="inventory">${'<div class="item">Weapon</div>'.repeat(1200)}</div><script>${code}
      const input=document.querySelector('input');input.value=${JSON.stringify(initial)};
      input.__reactProps$test={onChange(){},onKeyDown(){}};
      window.dispose=Inline.attachInlineSearchEditor(input,()=>true,${JSON.stringify(mode)});</script>`);
    await page.locator('.aegis-inline-search').focus();
    await page.keyboard.press('End');
    await page.evaluate(() => {
      const editor = document.querySelector('.aegis-inline-search');
      window.originalBadges = [...editor.querySelectorAll('.aegis-search-token')];
      window.stats = { durations: [], rebuilds: 0, clones: 0, geometryReads: 0, synchronousGeometryReads: 0, added: 0, removed: 0 };
      const replace = editor.replaceChildren.bind(editor);
      editor.replaceChildren = (...args) => { stats.rebuilds++; return replace(...args); };
      const clone = Range.prototype.cloneContents;
      Range.prototype.cloneContents = function () { stats.clones++; return clone.call(this); };
      let started, handlingInput = false;
      const rect = Range.prototype.getBoundingClientRect;
      Range.prototype.getBoundingClientRect = function () {
        stats.geometryReads++;
        if (handlingInput) stats.synchronousGeometryReads++;
        return rect.call(this);
      };
      editor.addEventListener('beforeinput', () => { started = performance.now(); handlingInput = true; }, true);
      editor.addEventListener('beforeinput', () => { stats.durations.push(performance.now() - started); handlingInput = false; });
      new MutationObserver(records => {
        for (const mutation of records) { stats.added += mutation.addedNodes.length; stats.removed += mutation.removedNodes.length; }
      }).observe(editor, { childList: true, subtree: true });
    });
    await page.keyboard.type(draft);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const result = await page.evaluate(() => {
      const editor = document.querySelector('.aegis-inline-search');
      const sorted = [...stats.durations].sort((a, b) => a - b);
      // Measure visibility after collecting the instrumented counters.
      const counts = { ...stats, durations: undefined };
      const bounds = editor.getBoundingClientRect();
      const caret = document.getSelection().getRangeAt(0).getBoundingClientRect();
      return {
        ...counts, keystrokes: sorted.length, totalMs: stats.durations.reduce((a, b) => a + b, 0),
        medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.floor(sorted.length * .95)],
        query: document.querySelector('input').value,
        badgesRetained: originalBadges.every((badge, index) => badge === editor.querySelectorAll('.aegis-search-token')[index]),
        caretVisible: caret.left >= bounds.left - 1 && caret.right <= bounds.right + 1,
      };
    });
    assert.equal(result.query, initial + draft, 'Every character reaches DIM');
    assert.equal(result.keystrokes, draft.length, 'The benchmark measures the complete typing sequence');
    assert.equal(result.badgesRetained, true, 'Typing retains existing badge and button nodes');
    assert.equal(result.rebuilds, 0, 'Typing does not rebuild the editor');
    assert.equal(result.clones, 0, 'Selection handling does not copy the DOM');
    assert.equal(result.synchronousGeometryReads, 0, 'Caret layout is measured outside the key handler');
    assert.ok(result.added + result.removed <= 12, 'Typing creates only draft and syntax-transition nodes');
    assert.equal(result.caretVisible, true, 'Deferred scrolling keeps the caret visible in a long query');
    await page.keyboard.press('Home');
    await page.waitForFunction(() => document.querySelector('.aegis-inline-search').scrollLeft === 0);
    console.log(`PASS: ${mode} search rendering, stable badge nodes, bounded DOM mutations, and deferred caret scrolling`);
    if (process.argv[2]) {
      console.log(JSON.stringify(result, null, 2));
      fs.mkdirSync('scratch', { recursive: true });
      fs.writeFileSync('scratch/search-editor-perf-' + process.argv[2] + '-' + mode + '.json', JSON.stringify(result, null, 2));
    }
    await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
