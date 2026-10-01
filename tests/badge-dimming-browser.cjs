const fs = require('node:fs'), assert = require('node:assert/strict'), ts = require('typescript');
const { bundle, launchBrowser } = require('./browser-helpers.cjs');

(async () => {
  const source = ts.createSourceFile('content.ts', fs.readFileSync('src/content.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const names = ['publishInventoryGrade','injectBadge', 'removeBadge', 'getBadgeTemplate', 'getGradeLetterFromDisplay'];
  const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.equal(functions.length, names.length);
  const rendering = ts.transpileModule(functions.map(node => node.getText(source).replace(/^export /, '')).join('\n'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const scripts = await Promise.all([
    bundle('src/stat-grade.ts', 'StatGrade'), bundle('src/badge-presentation.ts', 'Presentation'), bundle('src/grade-colors.ts', 'Colors'),
    bundle('src/grading.ts', 'Grading'), bundle('src/footer-sizing.ts', 'Footer'),
  ]);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<main><section data-dimsum-tab-panel="Weapons"><div class="tab-content">
      <div class="item-drag-container"><div id="direct" class="item" data-aegis-item-hash="1"><div class="item-img"></div></div></div>
      <div id="wrapper" class="item-drag-container" data-aegis-item-hash="2"><div id="wrapped" class="item"><div class="item-img"></div></div></div>
      <div id="picker" class="item" data-aegis-item-hash="3"><div class="item-img"></div></div>
    </div></section></main>`);
    await page.addStyleTag({ content: fs.readFileSync('public/styles.css', 'utf8') });
    // DIM standard 8.143.0 and beta 8.143.0.4890 apply search opacity to the item
    // itself. Its private class name is irrelevant to descendant compositing.
    await page.addStyleTag({ content: '.item {position:relative;width:60px;height:76px}.item-img{height:60px}.native-search-hidden{opacity:var(--search-hidden-opacity,.2)}' });
    await page.addScriptTag({ content: scripts.join('\n') + `
      const {rollBadgeSymbol,applyBadgePresentation,badgeCategory}=Presentation;
      const {displayGrade,inventoryGradeAppearance,applyGradeGlow,applyGradeColors}=Colors;
      const {updateFooterSize,releaseFooterSize}=Footer;
   const {renderStatGrade,removeStatGrade}=StatGrade;
   let aegisStatGradeBasis="perk";
      const getGradeValue=Grading.gradeValue,t=value=>value;
      const badgeTemplates=new Map(),renderedBadges=new WeakMap(),badgeResults=new WeakMap();
      const IS_WINNOWER_HOST=false;
      let aegisBadgeStyle='footer',aegisBadgePosition='bottom-left',aegisFadeHover=false;
      let aegisUpgradeStyle='none',aegisShowPerfectStar=true,aegisShowOmniStar=true,aegisGradeDisplayMode='dual';
      let aegisBadgeVisibility={weapon:'grade',armor:'grade',exotic:'grade'};
      ${rendering}
    ` });
    const result = await page.evaluate(async () => {
      const check = (ok, label) => { if (!ok) throw Error(label); };
      const frame = () => new Promise(requestAnimationFrame);
      const tiles = ['direct', 'wrapped', 'picker'].map(id => document.getElementById(id));
      const roots = ['direct', 'wrapper', 'picker'].map(id => document.getElementById(id));
      const panel = document.querySelector('section'), content = document.querySelector('.tab-content');
      let cases = 0, intermediateFrames = 0, badgeWrites = 0;
      for (const style of ['classic', 'pill', 'notch', 'footer']) {
        for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
          aegisBadgeStyle = style; aegisBadgePosition = position;
          roots.forEach(root => injectBadge(root, { grade: 'S+ | A', pveRollQuality: { isPerfect5of5: true } }));
          const badges = tiles.map(tile => tile.querySelector('.aegis-badge'));
          badges.forEach((badge, i) => check(badge?.parentElement === tiles[i], 'All badge styles belong to the native tile, including wrapped annotations and picker tiles'));
          const observer = new MutationObserver(records => { badgeWrites += records.length; });
          badges.forEach(badge => observer.observe(badge, { attributes: true, attributeFilter: ['style', 'data-aegis-dimmed'] }));
          for (const opacity of [.2, .65, 1]) {
            tiles.forEach(tile => { tile.classList.add('native-search-hidden'); tile.style.setProperty('--search-hidden-opacity', opacity); });
            await frame();
            badges.forEach((badge, i) => {
              check(+getComputedStyle(tiles[i]).opacity === opacity, 'Native search opacity is respected');
              check(+getComputedStyle(badge).opacity === 1, 'The badge does not multiply the native search fade');
              check(getComputedStyle(badge).filter === 'none', 'No extra badge grayscale is applied');
              check(!badge.hasAttribute('data-aegis-dimmed'), 'No separate badge dimming state');
            });
            cases++;
          }
          tiles.forEach(tile => { tile.classList.remove('native-search-hidden'); tile.style.removeProperty('--search-hidden-opacity'); });
          await frame();
          observer.disconnect();
        }
      }
      for (const target of [panel, content]) {
        const animation = target.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'both' });
        animation.id = 'dimsum-tab-panel';
        const until = performance.now() + 220;
        while (performance.now() < until) {
          await frame();
          const opacity = +getComputedStyle(target).opacity;
          if (opacity > 0 && opacity < 1) intermediateFrames++;
          tiles.forEach(tile => check(+getComputedStyle(tile.querySelector('.aegis-badge')).opacity === 1, 'Panel motion composites badges without another fade'));
        }
        animation.cancel();
      }
      tiles[0].classList.add('native-search-hidden');
      tiles[0].querySelector('.aegis-badge').remove();
      injectBadge(roots[0], { grade: 'A' });
      check(tiles[0].querySelector('.aegis-badge').parentElement === tiles[0], 'Late badge attachment stays inside the already-filtered tile');
      check(+getComputedStyle(tiles[0]).opacity === .2 && +getComputedStyle(tiles[0].querySelector('.aegis-badge')).opacity === 1, 'Late badges need no synchronization pass');
      content.style.filter = 'grayscale(.8)';
      check(getComputedStyle(content).filter === 'grayscale(0.8)' && getComputedStyle(tiles[0].querySelector('.aegis-badge')).filter === 'none', 'Ancestor filtering applies without duplicating it on the badge');
      content.style.filter = ''; tiles[0].classList.remove('native-search-hidden');
      return { cases, intermediateFrames, badgeWrites };
    });
    assert.equal(result.cases, 48);
    assert.ok(result.intermediateFrames > 0);
    assert.equal(result.badgeWrites, 0, 'Native search changes never write badge dimming styles or state');
    assert.deepEqual(errors, []);
    console.log('PASS: tile-owned badges follow native search opacity and panel motion across all styles/positions; no compounded opacity, grayscale, dimming state, or per-search badge writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
