const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { bundle, launchBrowser } = require('./browser-helpers.cjs');
const { css, sizing, populate } = require('./badge-scale-browser.cjs');

async function templateCode() {
  const source = ts.createSourceFile('content.ts', fs.readFileSync(path.join(__dirname, '../src/content.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
  const names = ['getBadgeTemplate', 'getGradeLetterFromDisplay'];
  const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.equal(functions.length, names.length);
  const code = ts.transpileModule(functions.map(node => node.getText(source).replace(/^export /, '')).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return (await Promise.all([
    bundle(path.join(__dirname, '../src/badge-presentation.ts'), 'Presentation'),
    bundle(path.join(__dirname, '../src/grade-colors.ts'), 'Colors'),
    bundle(path.join(__dirname, '../src/grading.ts'), 'Grading'),
  ])).join('\n') + `
    const {rollBadgeSymbol} = Presentation;
    const {displayGrade} = Colors;
    const getGradeValue = Grading.gradeValue;
    const badgeTemplates = new Map();
    let aegisBadgeStyle = 'classic', aegisBadgePosition = 'bottom-left', aegisFadeHover = false;
    let aegisUpgradeStyle = 'none', aegisShowPerfectStar = true, aegisShowOmniStar = true;
    ${code}`;
}

async function populateTemplates(legacy) {
  await populate();
  for (const { tile, style, label } of cases) {
    const mode = label.split('/')[1], position = label.split('/')[5] || 'bl';
    aegisBadgeStyle = style;
    aegisBadgePosition = ({bl:'bottom-left',br:'bottom-right',tl:'top-left',tr:'top-right'})[position];
    aegisUpgradeStyle = mode === 'dual' ? 'chevron' : mode === 'star' ? 'circle' : 'triangle';
    const result = { grade: ({single:'B',wide:'BS+',split:'BS+ | A',dual:'SF➔S+ | A➔A+',star:'AS+ | B+',color:'BS+','split-color':'BS+ | A'})[mode], upgradeAvailable:true };
    if (mode === 'star') { result.pveRollQuality = {isOmniRoll:true}; result.pvpRollQuality = {isPerfect5of5:true}; }
    const badge = getBadgeTemplate(result, style).cloneNode(true);
    // Reconstruct the previous text-wrapper structure as the visual reference.
    if (legacy) for (const half of badge.querySelectorAll('.aegis-split-label')) {
      const span = document.createElement('span'); span.className = 'aegis-grade-text';
      span.append(...half.childNodes); half.replaceChildren(span); half.classList.remove('aegis-split-label');
    }
    releaseFooterSize(tile.lastElementChild);
    tile.lastElementChild.replaceWith(badge);
    Presentation.applyBadgePresentation(badge, mode.includes('color') ? 'color' : 'grade');
    Colors.applyGradeColors(badge);
    updateFooterSize(badge, mode === 'dual');
  }
  await document.fonts.ready;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

function snapshot() {
  return cases.map(({label,tile}) => {
    const badge = tile.lastElementChild, t = tile.getBoundingClientRect();
    const rect = n => { const r = n.getBoundingClientRect(); return [r.x-t.x,r.y-t.y,r.width,r.height]; };
    return {label,tileHeight:t.height,badge:rect(badge),icon:rect(tile.firstElementChild),aria:badge.getAttribute('aria-label'),
      texts:[...badge.querySelectorAll('.aegis-grade-text,.aegis-split-label')].map(n => {
        if (badge.classList.contains('aegis-color-only')) return [];
        const range = document.createRange(); range.selectNodeContents(n);
        return [...range.getClientRects()].map(r=>[r.x-t.x,r.y-t.y,r.width,r.height]);
      }),arrow:rect(badge.querySelector('.aegis-badge-upgrade-arrow'))};
  });
}
function compare(actual, reference) {
  const delta = (a,b) => Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
  const differences = actual.map((a,i) => {
    const b = reference[i], lines = a.texts.every((t,j)=>t.length===b.texts[j].length);
    return {label:a.label,geometry:Math.max(Math.abs(a.tileHeight-b.tileHeight),delta(a.badge,b.badge),delta(a.icon,b.icon)),
      aria:a.aria===b.aria,lines,text:lines?Math.max(0,...a.texts.flatMap((t,j)=>t.map((r,k)=>delta(r,b.texts[j][k])))):Infinity,arrow:delta(a.arrow,b.arrow)};
  });
  const failed = differences.filter(d=>d.geometry>.05||!d.aria||!d.lines||d.text>.05||d.arrow>.05);
  assert.deepEqual(failed,[],JSON.stringify(failed.slice(0,8)));
}
module.exports = { templateCode, populateTemplates, snapshot, compare };

if (require.main === module) (async () => {
  const code = await templateCode(), browser = await launchBrowser();
  try {
    const deviceScaleFactor = Number(process.env.AEGIS_TEST_DPR || 1);
    const page = await browser.newPage({viewport:{width:1400,height:1100}, deviceScaleFactor}), errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.setContent('<iframe name="actual"></iframe><iframe name="reference"></iframe><style>body{margin:0}iframe{width:690px;height:1080px;border:0}</style>');
    const frames = [page.frame({name:'actual'}),page.frame({name:'reference'})];
    for (const [index, frame] of frames.entries()) {
      await frame.setContent(`<style>${css}
        body{margin:8px;background:#20242a;color:white}.grid{display:flex;gap:12px;flex-wrap:wrap;align-items:start}
        .item{position:relative;contain:strict;box-sizing:border-box;flex:none;background:#353944}
        .icon{height:var(--item-size);background:linear-gradient(45deg,#614972,#968947);border:1px solid #ccc;box-sizing:border-box}
        .aegis-badge{transition:none!important}
      </style><div class="grid"></div>`);
      await frame.addScriptTag({content:sizing+'\n'+code+'\n'+populate.toString()});
      await frame.evaluate(populateTemplates,!!index);
    }
    for (const colors of ['perk','archetype','gradient']) {
      for (const frame of frames) await frame.evaluate(colors=>{Colors.setBadgeColor(colors);Colors.applyGradeColors(document.body)},colors);
      compare(...await Promise.all(frames.map(frame=>frame.evaluate(snapshot))));
    }
    // Change dimensions and visibility on existing nodes: no template rebuild is needed.
    for (const size of [.7,1.5,1]) {
      for (const frame of frames) await frame.evaluate(async size=>{
        for (const {tile} of cases) {tile.style.setProperty('--aegis-badge-size',size);Presentation.applyBadgePresentation(tile.lastElementChild,'grade')}
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      },size);
      compare(...await Promise.all(frames.map(frame=>frame.evaluate(snapshot))));
    }
    const counts = await Promise.all(frames.map(frame=>frame.locator('.aegis-badge *').count()));
    // Compare painted output separately: equal rectangles can still hide clipping.
    const visual = frames[0];
    await visual.evaluate(() => {
      const grid = document.querySelector('.grid'), tiles = [];
      for (const style of ['classic','pill','notch','footer']) for (const mode of ['single','split','dual','star','color','split-color']) {
        const original = cases.find(c=>c.label===style+'/'+mode+'/60/1.05/1.3').tile;
        const tile = original.cloneNode(true); tile.style.setProperty('--aegis-badge-size','1.05');
        Presentation.applyBadgePresentation(tile.lastElementChild, mode.includes('color')?'color':'grade');
        tiles.push(tile);
      }
      grid.replaceChildren(...tiles);
    });
    const wait = () => visual.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await wait();
    const flatPixels = await page.screenshot({clip:{x:0,y:0,width:690,height:1080}});
    await visual.evaluate(()=>{for(const half of document.querySelectorAll('.aegis-split-label')){const span=document.createElement('span');span.className='aegis-grade-text';span.append(...half.childNodes);half.replaceChildren(span);half.classList.remove('aegis-split-label')}});
    await wait();
    const referencePixels = await page.screenshot({clip:{x:0,y:0,width:690,height:1080}});
    if (!flatPixels.equals(referencePixels) && process.env.AEGIS_TEST_ARTIFACT_DIR) {
      fs.mkdirSync(process.env.AEGIS_TEST_ARTIFACT_DIR, {recursive:true});
      fs.writeFileSync(path.join(process.env.AEGIS_TEST_ARTIFACT_DIR, 'badge-flat.png'), flatPixels);
      fs.writeFileSync(path.join(process.env.AEGIS_TEST_ARTIFACT_DIR, 'badge-reference.png'), referencePixels);
    }
    assert.ok(flatPixels.equals(referencePixels), 'painted grades, backgrounds, stars, and upgrades match the previous structure');
    assert.ok(counts[0]<counts[1],'remove redundant elements without replacing them with observers or generated labels');
    assert.deepEqual(errors,[]);
    console.log(`PASS: 1,680 production badge cases preserve geometry, wrapping, colors, labels, and dynamic sizing (${counts[1]-counts[0]} fewer elements, DPR ${deviceScaleFactor})`);
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

