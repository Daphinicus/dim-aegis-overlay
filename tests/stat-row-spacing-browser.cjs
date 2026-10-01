const assert = require('node:assert/strict');
const fs = require('node:fs');
const { bundle, launchBrowser } = require('./browser-helpers.cjs');

(async () => {
  const script = await bundle('src/stat-grade.ts', 'Stat');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent('<main></main>');
    await page.addStyleTag({ content: `
      .item { width: var(--item-size); }
      .native-row { --breaker-size: calc(var(--item-size) * .16); --element-size: calc(var(--item-size) * .2); height: calc(var(--item-size) * .2 + 4px); font-size: calc(var(--item-size) * .2); line-height: calc(var(--item-size) * .2 + 4px); width: 100%; box-sizing: border-box; padding: 0 2px; display: flex; justify-content: flex-end; align-items: center; white-space: pre; overflow: hidden; }
      .native-row > div { width: var(--element-size); height: var(--element-size); background-size: 100% auto; margin-right: 1px; }
      .native-row > img { width: var(--breaker-size); height: var(--breaker-size); }
    ` + fs.readFileSync('public/styles.css', 'utf8') });
    await page.addScriptTag({ content: script });
    const count = await page.evaluate(() => {
      const check = (value, message) => { if (!value) throw Error(message); };
      const layoutRules = () => [...document.styleSheets].flatMap(sheet => [...sheet.cssRules]).filter(rule => rule.selectorText?.includes('data-aegis-letter-layout'));
      let count = 0;
      Stat.setStatGradeLayout(false);
      check(layoutRules().length === 0, 'Disabled layout has no native descendant rules');
      Stat.setStatGradeLayout(true);
      check(layoutRules().length === 3, 'Enabled layout supplies all native row rules');
      const style = document.getElementById('aegis-stat-grade-layout-style');
      const mutations = new MutationObserver(() => {});
      mutations.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      Stat.setStatGradeLayout(true);
      check(document.getElementById('aegis-stat-grade-layout-style') === style && mutations.takeRecords().length === 0, 'Repeated activation preserves the sheet without writes');
      mutations.disconnect();
      for (const hook of ['SLO2oppG', 'BadgeInfo_badge__abc', 'BadgeInfo-badge-abc', 'BadgeInfo-m_badge-abc']) {
        for (const font of ['Arial', 'Segoe UI', 'system-ui']) for (const width of [50, 62, 72, 96]) for (const grade of ['A+', 'S+', 'B+', 'A', '']) for (const mask of [0, 1, 2, 3]) {
          const tile = document.createElement('div'); tile.className = 'item'; tile.style.cssText = `--item-size:${width}px;font-family:${font}`;
          const row = document.createElement('div'); row.className = 'native-row ' + hook; tile.append(row);
          if (mask & 1) { const icon = document.createElement('img'); icon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'; row.append(icon); }
          if (mask & 2) row.append(document.createElement('div'));
          const power = document.createElement('span'); power.textContent = '888'; row.append(power);
          document.querySelector('main').append(tile);
          if (grade) Stat.renderStatGrade(tile, { grade }, 'perk');
          const box = row.getBoundingClientRect(), parts = [...row.children].map(n => ({ n, r: n.getBoundingClientRect() })).sort((a, b) => a.r.left - b.r.left);
          const detail = JSON.stringify({ hook, font, width, grade, mask });
          check(Math.abs(parseFloat(getComputedStyle(row).fontSize) - width * .185) < .02, 'Shared row size: ' + detail);
          check(Math.abs(box.height - (width * .2 + 4)) < .02, 'Native height: ' + detail);
          for (const { n, r } of parts) {
            check(r.left >= box.left + .94 && r.right <= box.right - .94, 'Content fits: ' + detail);
            check(Math.abs(r.top + r.height / 2 - box.top - box.height / 2) < .02, 'Centered: ' + detail);
            if (n.matches('img, div')) {
              // An overflowing flex row can look bounded while squashing its damage icon.
              check(Math.abs(r.width - r.height) < .02, 'Square icon: ' + detail);
              check(Math.abs(r.width - width * (n.tagName === 'IMG' ? .148 : .185)) < .02, 'Uniform icon size: ' + detail);
            }
          }
          if (grade) {
            check(Math.abs(parts[0].r.left - box.left - 1) < .02, 'Left aligned: ' + detail);
            const gaps = parts.slice(2).map((p, i) => p.r.left - parts[i + 1].r.right);
            check(gaps.every(gap => Math.abs(gap - .25) < .04), 'Compact right group: ' + detail);
            check(Math.abs(parts.at(-1).r.right - box.right + 1) < .02, 'Right aligned: ' + detail);
          }
          Stat.setStatGradeLayout(false);
          check(Math.abs(parseFloat(getComputedStyle(row).fontSize) - width * .2) < .02, 'Restore native size: ' + detail);
          Stat.setStatGradeLayout(true);
          tile.remove(); count++;
        }
      }
      Stat.setStatGradeLayout(false);
      check(!document.documentElement.hasAttribute('data-aegis-letter-layout'), 'Remove mode attribute');
      check(layoutRules().length === 0, 'Remove native descendant rules on deactivation');
      return count;
    });
    assert.ok(count > 0);
    console.log(`PASS: ${count} Letter stats rows without DIM-SUM; square icons, uniform sizing, left grade and compact right group, native height, mode restoration, standard and beta hooks.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
