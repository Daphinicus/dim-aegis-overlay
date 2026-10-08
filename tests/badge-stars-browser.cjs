const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { bundle, launchBrowser } = require('./browser-helpers.cjs');

(async () => {
  const source = ts.createSourceFile('content.ts', fs.readFileSync('src/content.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const names = ['getBadgeTemplate', 'getGradeLetterFromDisplay', 'formatShoppingBadgeHtml'];
  const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.equal(functions.length, names.length);
  const rendering = ts.transpileModule(functions.map(node => node.getText(source).replace(/^export /, '')).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const scripts = await Promise.all([
    bundle('src/badge-presentation.ts', 'Presentation'),
    bundle('src/grade-colors.ts', 'Colors'),
    bundle('src/grading.ts', 'Grading'),
    bundle('src/footer-sizing.ts', 'FooterSizing'),
    bundle('src/popup.ts', 'Popup'),
  ]);
  const css = fs.readFileSync('public/styles.css', 'utf8');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 700, height: 650 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.abort());
    await page.setContent(`<style>${css}
      .item { position:relative; width:60px; height:76px; contain:strict; }
    </style><div class="item"></div>`);
    await page.addScriptTag({ content: scripts.slice(0, 4).join('\n') + `
      const {rollBadgeSymbol, applyBadgePresentation} = Presentation;
      const {displayGrade} = Colors;
      const getGradeValue = Grading.gradeValue;
      const badgeTemplates = new Map();
      const scoresEnabled=()=>false; const weaponDataMap=new WeakMap(),nativeScoreData=new Map();
      const IS_WINNOWER_HOST= false;
      let aegisBadgeStyle = 'classic', aegisBadgePosition = 'bottom-left', aegisFadeHover = false;
      let aegisUpgradeStyle = 'none', aegisShowPerfectStar = true, aegisShowOmniStar = true;
      let aegisGradeDisplayMode = 'equipped', aegisTwoTier = false;
      ${rendering}` });
    const checks = await page.evaluate(async () => {
      let count = 0;
      const check = (ok, label) => { if (!ok) throw new Error(label); count++; };
      const text = badge => badge.textContent.trim().replace(/\s+/g, ' ');
      const perfect = { grade: 'S+', isPerfect5of5: true };
      const omni = { ...perfect, isOmniRoll: true };
      for (const style of ['classic', 'pill', 'notch', 'footer']) {
        aegisBadgeStyle = style;
        aegisShowPerfectStar = aegisShowOmniStar = true;
        const badge = getBadgeTemplate(perfect, style);
        check(text(badge) === '★ S+', style + ' shows the perfect star');
        check(text(getBadgeTemplate(omni, style)) === '✦ S+', style + ' gives omni priority');
        check(text(getBadgeTemplate({ grade: 'A' }, style)) === 'A', style + ' leaves ordinary grades alone');
        check(text(getBadgeTemplate({ grade: 'S / A', isPerfect5of5: true }, style)) === 'S / A', style + ' excludes armor');
        check(formatShoppingBadgeHtml('S+', perfect).includes('★ S+'), style + ' shopping badge shows perfect');
        check(formatShoppingBadgeHtml('S+', omni).includes('✦ S+'), style + ' shopping badge shows omni');
        const split = { grade: 'S+ | AS+', pveRollQuality: perfect, pvpRollQuality: omni };
        const dual = getBadgeTemplate(split, style);
        check(text(dual.querySelector('.aegis-split-left')) === '★ S+', style + ' uses PvE quality');
        check(text(dual.querySelector('.aegis-split-right')) === '✦ AS+', style + ' uses PvP quality');
        check(text(getBadgeTemplate({ ...split, pveRollQuality: {} }, style).querySelector('.aegis-split-left')) === 'S+', style + ' never copies the other activity star');
        aegisShowOmniStar = false;
        check(text(getBadgeTemplate(omni, style)) === '★ S+', style + ' can show perfect with omni disabled');
        aegisShowPerfectStar = false;
        const plain = getBadgeTemplate(perfect, style);
        check(text(plain) === 'S+' && plain !== badge, style + ' settings invalidate cached presentation');
        check(text(getBadgeTemplate(split, style)) === 'S+ AS+', style + ' both split stars turn off');
        check(!formatShoppingBadgeHtml('S+', omni).includes('✦'), style + ' shopping respects disabled star');
        aegisShowOmniStar = true;
        check(text(getBadgeTemplate(omni, style)) === '✦ S+', style + ' omni works with perfect disabled');
        const colorOnly = getBadgeTemplate(omni, style).cloneNode(true);
        applyBadgePresentation(colorOnly, 'color');
        document.querySelector('.item').replaceChildren(colorOnly);
        check(getComputedStyle(colorOnly.querySelector('.aegis-grade-text')).display === 'none', style + ' color-only hides stars with grades');
        check(Colors.displayGrade(text(badge)) === 'S+', style + ' star preserves grade parsing');
        const splitColor = getBadgeTemplate(split, style).cloneNode(true);
        applyBadgePresentation(splitColor, 'color');
        document.querySelector('.item').replaceChildren(splitColor);
        check(splitColor.getBoundingClientRect().height === (['footer', 'notch'].includes(style) ? 3 : 8), style + ' split color-only keeps its compact height');
        aegisShowPerfectStar = true;
        for (const grade of ['BS+ | AS+', 'SF➔S+ | AA➔S+']) {
          const starred = getBadgeTemplate({ ...split, grade }, style).cloneNode(true);
          document.querySelector('.item').replaceChildren(starred);
          FooterSizing.updateFooterSize(starred, grade.includes('➔'));
          for (const scale of [0.7, 1, 1.3]) {
            document.documentElement.style.setProperty('--aegis-badge-scale', scale);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            for (const half of starred.querySelectorAll('.aegis-split-half')) {
              const range = document.createRange();
              range.selectNodeContents(half.querySelector('.aegis-grade-text') || half);
              const textBounds = range.getBoundingClientRect(), bounds = half.getBoundingClientRect();
              check(textBounds.left >= bounds.left - 0.2 && textBounds.right <= bounds.right + 0.2 && textBounds.top >= bounds.top - 0.2 && textBounds.bottom <= bounds.bottom + 0.2, style + ' keeps the complete starred grade visible at text scale ' + scale);
            }
            if (style === 'footer') {
              const tile = starred.parentElement.getBoundingClientRect(), badgeBounds = starred.getBoundingClientRect();
              check(Math.abs(badgeBounds.top - tile.top - 76) < 0.2, 'Starred footer reserves its measured height');
            }
          }
          FooterSizing.releaseFooterSize(starred);
        }
        document.documentElement.style.setProperty('--aegis-badge-scale', 1);
      }
      return count;
    });

    // Exercise the real popup, including tab placement, storage, and its live preview.
    const markup = fs.readFileSync('public/popup.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*>/g, '');
    await page.setContent(markup);
    await page.addStyleTag({ content: css + fs.readFileSync('public/compact-options.css', 'utf8') });
    await page.addScriptTag({ content: `
      window.stored = { lastSeenChangelogVersion:'1.9.5', aegisBadgeStyle:'footer' };
      const listeners = [];
      window.chrome = {
        runtime: { getManifest: () => ({version:'1.9.5'}), sendMessage: (_message, callback) => callback?.({success:true}) },
        storage: {
          onChanged: { addListener: listener => listeners.push(listener) },
          local: {
            get: (keys, callback) => {
              const result = Object.fromEntries(keys.filter(key => key in stored).map(key => [key, stored[key]]));
              if (callback) queueMicrotask(() => callback(result));
              return Promise.resolve(result);
            },
            set: (values, callback) => {
              const changes = Object.fromEntries(Object.entries(values).map(([key,value]) => [key,{oldValue:stored[key],newValue:value}]));
              Object.assign(stored, values);
              queueMicrotask(() => { listeners.forEach(listener => listener(changes,'local')); callback?.(); });
              return Promise.resolve();
            }
          }
        }
      };` });
    await page.addScriptTag({ content: scripts[4] });
    await page.evaluate(() => document.dispatchEvent(new Event('DOMContentLoaded')));
    await page.locator('#tab-Badges').click();
    const perfectToggle = page.locator('#aegis-show-perfect-star');
    const omniToggle = page.locator('#aegis-show-omni-star');
    assert.ok(await perfectToggle.isChecked(), 'Perfect star defaults on');
    assert.ok(await omniToggle.isChecked(), 'Omni star defaults on');
    assert.equal(await page.locator('#options-Badges #aegis-roll-stars-group').count(), 1, 'Toggles appear in Badges');
    const preview = page.locator('#mock-aegis-badge .aegis-grade-text');
    assert.equal(await preview.textContent(), '✦ S+');
    await omniToggle.uncheck();
    await page.waitForFunction(() => document.querySelector('#mock-aegis-badge .aegis-grade-text').textContent === '★ S+');
    await perfectToggle.uncheck();
    await page.waitForFunction(() => document.querySelector('#mock-aegis-badge .aegis-grade-text').textContent === 'S+');
    assert.equal(await page.evaluate(() => stored.aegisShowPerfectStar), false);
    assert.equal(await page.evaluate(() => stored.aegisShowOmniStar), false);
    await page.locator('#aegis-badge-style-segmented [data-value="pill"]').click();
    assert.equal(await preview.textContent(), 'S+', 'Style changes preserve disabled stars');
    await omniToggle.check();
    await page.waitForFunction(() => document.querySelector('#mock-aegis-badge .aegis-grade-text').textContent === '✦ S+');
    assert.ok(!await perfectToggle.isChecked(), 'Toggles remain independent');
    await page.locator('#aegis-badge-style-segmented [data-value="stat"]').click();
    await page.waitForFunction(() => !document.querySelector('#aegis-stat-grade-options').hidden);
    assert.equal(await page.locator('.aegis-stat-preview .aegis-stat-grade').textContent(), 'S+');
    await page.locator('#aegis-stat-grade-basis [data-value=weapon]').click();
    await page.waitForFunction(() => document.querySelector('.aegis-stat-preview .aegis-stat-grade').textContent === 'B+');
    await page.locator('#aegis-stat-grade-mode [data-value=pvp]').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => stored.aegisStatGradeMode === 'pvp');
    assert.equal(await page.locator('#aegis-stat-grade-mode [data-value=pvp]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#aegis-badge-style-segmented [data-value=stat]').textContent(), 'Letter');
    for (const width of [320, 380]) for (const language of ['en','es','ko','ja','zh-CHS','zh-CHT']) {
      await page.setViewportSize({ width, height: 650 });
      await page.evaluate(language => chrome.storage.local.set({ aegisLanguage: language }), language);
      await page.waitForTimeout(220);
      const layout = await page.evaluate(() => {
        const group = document.getElementById('aegis-stat-grade-options'), description = group.querySelector('.description');
        const row = document.querySelector('.aegis-stat-preview'), tile = row.parentElement, letter = row.querySelector('.aegis-stat-grade');
        const box = n => n.getBoundingClientRect();
        return {
          fullWidth: Math.abs(box(description).width - box(group).width) < 1,
          overflow: group.scrollWidth > group.clientWidth + 1,
          hasDescriptionIcon: !!description.querySelector('svg'),
          hiddenThumb: getComputedStyle(row.querySelector('.fa-thumbs-up')).display === 'none',
          contained: box(row).top > box(tile).top && box(row).bottom <= box(tile).bottom,
          leftAligned: Math.abs(box(letter).left - box(row).left - 2) < 1,
          centered: Math.abs(box(letter).top + box(letter).height / 2 - box(row).top - box(row).height / 2) < 1,
          color: getComputedStyle(row).backgroundColor,
          independent: !row.className.includes('BadgeInfo') && !row.classList.contains('SLO2oppG'),
          sliders: [...group.querySelectorAll('.segmented-control')].every(n => n.querySelector('.option-selection') && n.querySelector('button[aria-pressed="true"]')),
        };
      });
      assert.ok(layout.fullWidth && !layout.overflow && layout.hasDescriptionIcon, language + ': full-width localized description');
      assert.ok(layout.hiddenThumb && layout.contained && layout.leftAligned && layout.centered && layout.independent, language + ': static inline preview');
      assert.equal(layout.color, 'rgb(154, 173, 17)', 'Match the original mock image row');
      assert.ok(layout.sliders, 'Both choices use the existing sliding selector');
    }
    await page.evaluate(() => chrome.storage.local.set({ aegisLanguage: 'en' }));
    await page.locator('#aegis-badge-style-segmented [data-value="footer"]').click();
    await page.waitForFunction(() => document.querySelector('#mock-aegis-badge .aegis-grade-text')?.textContent === '✦ S+');
    assert.ok(!await perfectToggle.isChecked(), 'Letter mode preserves saved stars');
    assert.equal(await page.locator('.aegis-stat-preview .aegis-stat-grade').count(), 0);
    assert.notEqual(await page.locator('.aegis-stat-preview .fa-thumbs-up').evaluate(n => getComputedStyle(n).display), 'none', 'Leaving Letter restores the mock wishlist icon');
    assert.deepEqual(errors, [], 'No browser errors');
    console.log(`PASS: ${checks} badge star checks; popup toggles, defaults, storage, and preview`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
