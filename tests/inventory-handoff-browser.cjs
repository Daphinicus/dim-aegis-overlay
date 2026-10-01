const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { bundle, launchBrowser } = require('./browser-helpers.cjs');
(async () => {
  const source = ts.createSourceFile('content.ts', fs.readFileSync('src/content.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const names = ['getBadgeTemplate', 'getGradeLetterFromDisplay', 'publishInventoryGrade', 'injectBadge', 'removeBadge'];
  const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.equal(functions.length, names.length);
  const rendering = ts.transpileModule(functions.map(node => node.getText(source).replace(/^export /, '')).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const scripts = await Promise.all([bundle('src/badge-presentation.ts', 'Presentation'), bundle('src/grade-colors.ts', 'Colors'), bundle('src/grading.ts', 'Grading')]);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent('<div class="item" data-aegis-item-hash="123"></div>');
    await page.addScriptTag({ content: scripts.join('\n') + `
      const { rollBadgeSymbol, applyBadgePresentation, badgeCategory } = Presentation;
      const { displayGrade, inventoryGradeAppearance, applyGradeColors } = Colors;
      const getGradeValue = Grading.gradeValue;
      const badgeTemplates = new Map(), renderedBadges = new WeakMap(), badgeResults = new WeakMap();
      const IS_WINNOWER_HOST = false;
      let aegisBadgeStyle = 'classic', aegisBadgePosition = 'bottom-left', aegisFadeHover = false;
      let aegisUpgradeStyle = 'none', aegisShowPerfectStar = true, aegisShowOmniStar = true;
      let aegisBadgeVisibility = { weapon: 'off', armor: 'off', exotic: 'off' }, aegisGradeDisplayMode = 'equipped';
      const removeStatGrade = () => {}, releaseFooterSize = () => {}, updateFooterSize = () => {}, applyGradeGlow = () => {}, t = s => s;
    ` + rendering });
    const result = await page.evaluate(() => {
      const tile = document.querySelector('.item');
      const read = () => JSON.parse(tile.getAttribute('data-aegis-inventory-grade'));
      const grade = { grade: 'S+|A', pveRollQuality: { isPerfect5of5: true }, upgradeAvailable: true };
      injectBadge(tile, grade); const hidden = read();
      const noBadge = !tile.querySelector('.aegis-badge');
      let writes = 0; const observer = new MutationObserver(records => writes += records.length);
      observer.observe(tile, { attributes: true, attributeFilter: ['data-aegis-inventory-grade'] });
      injectBadge(tile, grade); const unchangedWrites = observer.takeRecords().length;
      Colors.setGradeColors({ colorsEnabled: true, colors: { 'S+': '#123abc', A: '#456def' } });
      injectBadge(tile, grade); const recolored = read();
      aegisBadgeVisibility.weapon = 'grade'; injectBadge(tile, grade);
      const nativeRestored = !!tile.querySelector('.aegis-badge');
      removeBadge(tile); const cleared = !tile.hasAttribute('data-aegis-inventory-grade');
      observer.disconnect();
      return { hidden, noBadge, unchangedWrites, recolored, nativeRestored, cleared };
    });
    assert.deepEqual(result.hidden.labels.map(label => label.text), ['★ S+', 'A']);
    assert.equal(result.hidden.upgrade, true, 'Upgrade data is independent of Aegis decoration settings');
    assert.equal(result.noBadge, true); assert.equal(result.unchangedWrites, 0);
    assert.equal(result.recolored.labels[0].color, '#123abc');
    assert.equal(result.nativeRestored, true); assert.equal(result.cleared, true);
    console.log('PASS: cached inventory grade handoff with badges off, split stars, custom colors, upgrade data, unchanged-write suppression and native restoration.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
