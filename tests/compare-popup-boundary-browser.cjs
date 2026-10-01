const fs = require('node:fs');
const ts = require('typescript');
const { runFixture } = require('./browser-helpers.cjs');
const source = ts.createSourceFile('content.ts', fs.readFileSync('src/content.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const inject = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'injectPopupSummary');
const script = ts.transpileModule(fs.readFileSync('src/compare-selectors.ts', 'utf8').replace(/export /g, '') + '\n' + inject.getText(source), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
runFixture(`<pre id="result">Running</pre><script>
let cleanups = 0;
const boundPopupTitles = new WeakSet();
const cancelPopupDetails = () => cleanups++;
const aegisPopupSummaryMode = 'full';
${script}
try {
  for (const name of ['Sheet-m_sheet-example', 'opaqueReleaseSheet']) {
    const sheet = document.createElement('section'); sheet.className = name; sheet.setAttribute('role', 'dialog');
    sheet.innerHTML = '<div style="grid-template-rows:min-content"><div role="rowheader">Name</div><div role="cell"><div class="item-popup"><h1>Armor</h1></div></div></div>';
    document.body.append(sheet);
    const before = sheet.innerHTML;
    for (const node of [sheet, sheet.firstElementChild, sheet.querySelector('.item-popup')]) injectPopupSummary(node, {grade: 'C'}, 'Sheet', undefined, undefined, {});
    if (cleanups || sheet.innerHTML !== before) throw Error('Compare received item-details mutation: ' + name);
    sheet.remove();
  }
  const popup = document.createElement('div'); popup.className = 'item-popup'; popup.innerHTML = '<h1>Armor details</h1><div class="aegis-popup-summary">Old</div>';
  document.body.append(popup);
  injectPopupSummary(popup, {grade: ''}, 'Sheet');
  if (cleanups !== 1 || popup.querySelector('.aegis-popup-summary')) throw Error('Actual item details lost native summary cleanup');
  document.querySelector('#result').textContent = 'PASS: Compare sheets, grids, and descendants reject popup cards; actual item details still update.';
} catch (error) { document.querySelector('#result').textContent = 'FAIL: ' + error.message; }
</script>`);
