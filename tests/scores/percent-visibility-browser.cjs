const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 480 } });
    await page.setContent(`<style>body{background:#171b23;color:white;font:20px Arial}.value{display:inline-block;color:rgb(40,220,70)}.dimsum-grade-percent{font-size:.65em;line-height:1;vertical-align:baseline}</style>
      <main><div class="value" id="native" aria-label="PvE Best selections: 94.23%">94.23<span class="aegis-score-percent">%</span></div>
      <div class="value" id="delegated">94.23<span class="dimsum-grade-percent">%</span></div>
      <div class="value" id="zero">0<span class="aegis-score-percent">%</span></div>
      <span class="aegis-score-value aegis-score-unavailable" style="color:rgba(218,232,242,.4)">—</span>
      <span id="ordinary">50%</span></main>`);
    await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8') });
    const before = await page.locator('#delegated').boundingBox();
    const results = [];
    for (const zoom of [1, 1.5, 2]) {
      await page.evaluate(z => document.body.style.zoom = String(z), zoom);
      for (const show of [true, false, true]) {
        await page.evaluate(show => {
          if (show) document.documentElement.removeAttribute('data-aegis-score-percent');
          else document.documentElement.dataset.aegisScorePercent = 'off';
        }, show);
        const values = await page.locator('.aegis-score-percent,.dimsum-grade-percent').evaluateAll(nodes => nodes.map(node => {
          const css = getComputedStyle(node), parent = getComputedStyle(node.parentElement);
          return { position: css.position, clip: css.clipPath, ratio: parseFloat(css.fontSize) / parseFloat(parent.fontSize), color: css.color, parentColor: parent.color, text: node.parentElement.textContent };
        }));
        assert.equal(values.length, 3);
        for (const value of values) {
          assert.ok(Math.abs(value.ratio - .65) < .001);
          assert.equal(value.color, value.parentColor);
          assert.equal(value.position === 'absolute', !show);
          assert.equal(value.clip, show ? 'none' : 'inset(50%)');
          assert.ok(value.text.endsWith('%'));
        }
        assert.equal(await page.locator('#ordinary').innerText(), '50%');
        assert.equal(await page.locator('.aegis-score-unavailable').innerText(), '—');
        assert.equal(await page.locator('#native').getAttribute('aria-label'), 'PvE Best selections: 94.23%');
        const accessible = await page.locator('#delegated').ariaSnapshot();
        assert.ok(accessible.includes('94.23') && accessible.includes('%'), 'Hidden suffix remains in accessible text: ' + accessible);
        results.push({ zoom, show, values });
      }
    }
    await page.evaluate(() => { document.body.style.zoom = '1'; document.documentElement.dataset.aegisScorePercent = 'off'; });
    assert.ok((await page.locator('#delegated').boundingBox()).width < before.width, 'Hidden suffix uses no inline space');
    const out = path.join(root, 'scratch/score-live/percent-toggle-fixture');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out + '-results.json', JSON.stringify(results, null, 2));
    await page.screenshot({ path: out + '.png' });
    console.log('Passed nine zoom/visibility cases; native/delegated accessibility, color, zero, and dash preserved.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
