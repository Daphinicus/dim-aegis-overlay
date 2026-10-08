const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { launchBrowser, bundle } = require('./browser-helpers.cjs');

// Preserve the old zoom geometry as an independent reference while changing how
// inventory badges are sized. Previews and other hosts retain zoom.
const legacy = `.item > .aegis-badge { --aegis-badge-px: 1px; zoom: var(--aegis-badge-size, 1); }
.item > .aegis-badge.aegis-style-footer,
.item > .aegis-badge.aegis-style-footer.aegis-color-only {
  --aegis-footer-layout-scale: 1; --aegis-badge-px: 1px;
  zoom: var(--aegis-badge-size, 1); scale: none; translate: none;
  inset: auto calc(1px / var(--aegis-badge-size, 1)) 0 !important;
  width: auto !important; max-width: 100% !important;
}
.item:has(> .aegis-style-footer.aegis-badge-split[data-aegis-adaptive-footer]) {
 --aegis-footer-height: var(--aegis-measured-footer-height, var(--aegis-split-footer-height, 16px));
 padding-bottom: calc(var(--aegis-footer-height) * var(--aegis-badge-size, 1)) !important;
}`;
const sizing = ts.transpileModule(fs.readFileSync(path.join(root, 'src/footer-sizing.ts'), 'utf8').replace(/export /g, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');

async function populate() {
  const cases = [];
  for (const style of ['footer', 'classic', 'pill', 'notch']) for (const mode of ['single', 'wide', 'split', 'dual', 'star', 'color', 'split-color'])
    for (const position of ['classic', 'pill'].includes(style) ? ['bl', 'tl', 'tr', 'br'] : ['bl'])
    for (const width of [40, 60, 96]) for (const size of [.7, 1, 1.05, 1.5]) for (const text of [.7, 1.3]) {
      const tile = document.createElement('div'); tile.className = 'item'; tile.dataset.scaleCase = `${style}/${mode}/${width}/${size}/${text}${position === "bl" ? "" : "/" + position}`;
      tile.style.cssText = `width:${width}px;height:${width + 16}px;--item-size:${width}px;--aegis-badge-size:${size};--aegis-badge-scale:${text};--aegis-split-footer-height:${mode === 'dual' ? 25 : 16}px`;
      const split = ['split', 'dual', 'star', 'split-color'].includes(mode);
      const flags = `${mode === "wide" ? "aegis-badge-wide" : ""} ${split ? 'aegis-badge-split' : ''} ${mode.includes('color') ? 'aegis-color-only' : ''} ${mode === 'star' ? 'aegis-has-roll-star' : ''}`;
      const grade = mode === 'dual' ? 'SF➔S+' : mode === 'star' ? '✦ AS+' : 'BS+';
      const letters = split ? `<div class="aegis-split-inner">${['left','right'].map(side => `<span class="aegis-split-half aegis-split-${side} aegis-badge-s ${mode === 'dual' ? 'aegis-split-transition' : ''}"><span class="aegis-grade-text">${grade}</span></span>`).join('')}</div>` : `<span class="aegis-grade-text">${grade}</span>`;
      tile.innerHTML = `<div class="icon"></div><div class="aegis-badge aegis-style-${style} aegis-pos-${position} aegis-badge-s ${flags}">${letters}<span class="aegis-badge-upgrade-arrow aegis-upgrade-${mode === 'dual' ? 'chevron' : mode === 'star' ? 'circle' : 'triangle'}">▲</span></div>`;
      document.querySelector('.grid').append(tile);
      updateFooterSize(tile.lastElementChild, mode === 'dual');
      if (typeof Colors !== 'undefined') Colors.applyGradeColors(tile.lastElementChild);
      cases.push({ label: tile.dataset.scaleCase, tile, style, size });
    }
  window.cases = cases;
  await document.fonts.ready;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.snapshot = () => cases.map(({ label, tile, style, size }) => {
    const badge = tile.lastElementChild, t = tile.getBoundingClientRect();
    const rect = n => { const r = n.getBoundingClientRect(); return [r.x-t.x,r.y-t.y,r.width,r.height]; };
    return { label, style, size, tileHeight:t.height, badge:rect(badge), icon:rect(tile.firstElementChild),
      zoom:getComputedStyle(badge).zoom,
      texts:[...badge.querySelectorAll('.aegis-grade-text')].map(n=>{const r=document.createRange();r.selectNodeContents(n);return [...r.getClientRects()].map(b=>[b.x-t.x,b.y-t.y,b.width,b.height])}),
      arrow:rect(badge.querySelector('.aegis-badge-upgrade-arrow')) };
  });
}
module.exports = { css, legacy, sizing, populate };

if (require.main === module) (async () => {
  const colors = await bundle(path.join(root, 'src/grade-colors.ts'), 'Colors');
  const browser = await launchBrowser();
  try {
    const deviceScaleFactor = Number(process.env.AEGIS_TEST_DPR || 1);
    const page = await browser.newPage({ viewport: { width: 1400, height: 1100 }, deviceScaleFactor });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<iframe name="scaled"></iframe><iframe name="legacy"></iframe><style>body{margin:0;background:#20242a}iframe{width:690px;height:1080px;border:0}</style>');
    const frames = [page.frame({ name: 'scaled' }), page.frame({ name: 'legacy' })];
    for (const [index, frame] of frames.entries()) {
      await frame.setContent(`<style>${css}${index ? legacy : ''}
        body{margin:8px;background:#20242a;color:white}.grid{display:flex;gap:12px;flex-wrap:wrap;align-items:start}
        .item{position:relative;contain:strict;box-sizing:border-box;flex:none;background:#353944}
        .icon{height:var(--item-size);background:linear-gradient(45deg,#614972,#968947);border:1px solid #ccc;box-sizing:border-box}
        .aegis-badge{transition:none!important}
      </style><div class="grid"></div>`);
      await frame.addScriptTag({ content: sizing + '\n' + colors });
      await frame.evaluate(populate);
    }
    const [actual, reference] = await Promise.all(frames.map(f => f.evaluate(() => snapshot())));
    const differences = [];
    for (let i = 0; i < actual.length; i++) {
      const a = actual[i], b = reference[i];
      const delta = (x,y) => Math.max(...x.map((v,k)=>Math.abs(v-y[k])));
      const geometry = Math.max(Math.abs(a.tileHeight-b.tileHeight),delta(a.badge,b.badge),delta(a.icon,b.icon));
      const lines = a.texts.every((text,j)=>text.length===b.texts[j].length);
      const textDelta = lines ? Math.max(0,...a.texts.flatMap((text,j)=>text.map((r,k)=>delta(r,b.texts[j][k])))) : Infinity;
      differences.push({label:a.label,geometry,lines,textDelta,arrow:delta(a.arrow,b.arrow)});
      assert.equal(Number(a.zoom),1,a.label+' scales inventory badges without zoom');
    }
    if (differences.some(d=>d.geometry>.15||!d.lines||d.textDelta>1)) console.log(JSON.stringify(differences.filter(d=>d.geometry>.15||!d.lines||d.textDelta>1).slice(0,30),null,2));
    assert.ok(differences.every(d=>d.geometry<.15),'tile, icon, and badge geometry match legacy zoom');
    assert.ok(differences.every(d=>d.arrow<1),'upgrade indicators retain their size and position');
    assert.ok(differences.every(d=>d.lines),'grade wrapping matches legacy zoom');
    assert.ok(differences.every(d=>d.textDelta<1),'lettering stays within one CSS pixel of legacy zoom');
    // Hover fading must preserve badge geometry in every style at the selected size.
    for (const frame of frames) {
      await frame.addStyleTag({ content: '.item:hover .aegis-badge.aegis-hover-fade{transition:none!important}' });
      await frame.evaluate(() => { for (const {tile} of cases) tile.lastElementChild.classList.add('aegis-hover-fade'); });
    }
    for (const style of ['footer', 'classic', 'pill', 'notch']) for (const mode of ['single', 'split', 'dual', 'star', 'color', 'split-color']) {
      const label = `${style}/${mode}/60/1.05/1.3`, hovered = [];
      for (const frame of frames) {
        await frame.locator(`[data-scale-case="${label}"]`).hover({ position: { x: 10, y: 10 } });
        hovered.push(await frame.evaluate(label => snapshot().find(value => value.label === label), label));
      }
      assert.ok(hovered[0].badge.every((v,i)=>Math.abs(v-hovered[1].badge[i])<.15), label+' preserves hover geometry');
    }
    const shadows = await frames[0].evaluate(() => {
      const inventory = ['classic', 'pill', 'notch', 'footer'].map(style => {
        const badge = document.querySelector('[data-scale-case="' + style + '/single/60/1.5/1.3"] .aegis-badge');
        return getComputedStyle(badge).textShadow;
      });
      const reading = document.createElement('span');
      reading.className = 'aegis-tooltip-grade'; reading.textContent = 'S';
      document.body.append(reading); Colors.applyGradeColors(reading);
      return { inventory, reading: getComputedStyle(reading).textShadow };
    });
    assert.ok(shadows.inventory.every(value => value.endsWith('0px 1.5px 3px')), 'dynamic grade colors scale their text shadow');
    assert.ok(shadows.reading.endsWith('0px 1px 2px'), 'reading-grade text shadows retain their original size');
    assert.deepEqual(errors,[]);
    console.log(`PASS: ${actual.length} badge scale cases preserve geometry and wrapping at DPR ${deviceScaleFactor}`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
