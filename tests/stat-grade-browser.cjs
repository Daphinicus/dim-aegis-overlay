const assert = require('node:assert/strict');
const fs = require('node:fs');
const { bundle, launchBrowser } = require('./browser-helpers.cjs');

(async () => {
  const scripts = await Promise.all([bundle('src/stat-grade.ts', 'Stat'), bundle('src/grade-colors.ts', 'Colors'), bundle('src/grading.ts', 'Grading')]);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<main></main>');
    await page.addStyleTag({ content: fs.readFileSync('public/styles.css', 'utf8') + `
      .item{font-family:Arial;position:relative}.icon{height:60px}
      .bar{display:flex;align-items:center;justify-content:flex-end;height:1.4em;padding:0 2px;box-sizing:border-box;font-weight:700}
      .bar .mock-icon{width:.8em;height:.8em;flex:0 0 auto}` });
    await page.addScriptTag({ content: scripts.join('\n') });
    const result = await page.evaluate(() => {
      const check = (condition, message) => { if (!condition) throw Error(message); };
      for (const [grade, expected] of [['BS+','S+'],['SF➔A+','A+'],['S+ | F',''],['PVP/PVP',''],['A/S','S'],['B+','B+'],['S-','S'],['—','']]) {
        check(Stat.statGradeLetter({grade}, 'perk') === expected, grade);
      }
      check(Stat.statGradeLetter({grade:'S+',weaponGrade:'B+'}, 'weapon') === 'B+', 'One weapon grade with plus');
      check(Stat.statGradeLetter({grade:'S+'}, 'weapon') === '', 'Missing weapon tier never substitutes a perk grade');
      let cases = 0;
      for (const hook of ['SLO2oppG','BadgeInfo_badge__abc','BadgeInfo-badge-abc']) {
        for (const width of [50,60,72,96]) for (const rating of [true,false]) for (const grade of ['S+','A+','B+','C','D','E','F']) {
          const tile = document.createElement('div');
          tile.className = 'item';
          tile.style.width = width + 'px';
          tile.style.fontSize = width / 5 + 'px';
          tile.innerHTML = '<div class="icon"></div><div class="bar ' + hook + '">' + (rating ? '<span class="app-icon fa-thumbs-up">T</span>' : '') + '<i class="mock-icon"></i><i class="mock-icon"></i><span>550</span></div>';
          document.querySelector('main').append(tile);
          const bar = tile.lastElementChild, children = [...bar.children], height = tile.getBoundingClientRect().height;
          const originals = children.map(n => n.outerHTML);
          Stat.renderStatGrade(tile, {grade}, 'perk');
          const letter = bar.querySelector('.aegis-stat-grade'), letterBox = letter.getBoundingClientRect(), rowBox = bar.getBoundingClientRect();
          check(letter.textContent === grade && letter.childElementCount === 0, 'One grade in one text node');
          check(tile.getBoundingClientRect().height === height, 'No new row');
          check(getComputedStyle(letter).fontSize === getComputedStyle(bar).fontSize, 'Inherit native row size');
          check(Math.abs(letterBox.left - rowBox.left - 2) < .1, 'Left aligned');
          check(Math.abs(letterBox.top + letterBox.height / 2 - rowBox.top - rowBox.height / 2) < .1, 'Vertically centered');
          check(bar.lastElementChild.previousElementSibling.getBoundingClientRect().right <= rowBox.right + .1, 'Native content stays inside row');
          check(getComputedStyle(letter).backgroundImage === 'none' && getComputedStyle(letter).textShadow === 'none' && getComputedStyle(letter).transitionDuration === '0s', 'No decorative work');
          Stat.renderStatGrade(tile, {grade:'C'}, 'perk');
          check(bar.querySelector('.aegis-stat-grade') === letter, 'Reuse the same span');
          check(children.every((n,i) => n.outerHTML === originals[i]), 'Do not rewrite native children');
          Stat.removeStatGrade(tile);
          check(!bar.hasAttribute('data-aegis-stat-bar') && bar.children.length === children.length, 'Reversible removal');
          check(children.every(n => n.isConnected), 'Retain native node identities');
          tile.remove();
          cases++;
        }
      }
      const mock = document.createElement('div');
      mock.innerHTML = '<div class="mock-row"><span class="fa-thumbs-up">T</span><span>550</span></div>';
      document.body.append(mock);
      const row = mock.firstElementChild;
      Stat.renderStatGradeInBar(row, {grade:'S+',weaponGrade:'B+'}, 'perk');
      const letter = row.querySelector('.aegis-stat-grade'), palette = Grading.defaultGradeSettings();
      palette.colorsEnabled = true;
      palette.colors['S+'] = '#123456';
      Colors.applyGradeColors(letter, palette);
      check(getComputedStyle(letter).color === 'rgb(18, 52, 86)', 'Use the plus-grade palette color');
      Stat.removeStatGrade(mock);
      check(getComputedStyle(row.firstElementChild).display !== 'none', 'Restore mock thumb without DIM selectors');
      return {cases};
    });
    assert.deepEqual(errors, []);
    console.log('PASS: Letter ' + result.cases + ' standard/beta cases; plus grades, row-relative sizing, left/center alignment, one-node reuse, native restoration, custom plus colors, and independent preview rendering.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
