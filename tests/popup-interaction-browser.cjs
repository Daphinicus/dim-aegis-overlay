const fs = require('node:fs');
const ts = require('typescript');
const { runFixture } = require('./browser-helpers.cjs');
const script = ts.transpileModule(fs.readFileSync('src/popup-interaction.ts', 'utf8').replace(/export /g, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
runFixture(`<pre id="result">Running</pre><script>
${script}
const check = (value, message) => { if (!value) throw Error(message); };
async function run() {
  let dismissed = 0;
  initPopupInteraction(() => dismissed++);
  const tile = document.createElement('div'); tile.className = 'item';
  tile.style.cssText = 'position:fixed;left:100px;top:200px;width:80px;height:80px';
  document.body.append(tile);
  check(!isTileTooltipSuppressed(), 'Hover is available before clicking');
  tile.click();
  check(dismissed === 1 && isTileTooltipSuppressed(), 'Click immediately hides and suppresses hover');
  const popup = document.createElement('div'); popup.className = 'item-popup';
  popup.style.cssText = 'position:fixed;left:300px;top:0;width:400px;height:600px';
  document.body.append(popup);
  await Promise.resolve();
  check(getPopupSidebarSide(popup, 280) === 'right', 'Unadapted native layout can still fit a sidebar');
  openingUntil = 0;
  check(isTileTooltipSuppressed(), 'Mounted popup suppresses hover after opening delay');
  popup.style.left = '800px';
  check(getPopupSidebarSide(popup, 280) === null && popup.style.left === '800px', 'Unavailable adapter falls back inline without competing placement');
  popup.dataset.aegisNativePopupLayout = 'ready';
  popup.dataset.aegisNativePopupSide = 'left';
  check(getPopupSidebarSide(popup, 280) === 'left' && popup.style.left === '800px', 'Card consumes native decision without writing popup coordinates');
  check(popup.dataset.aegisPopupPanelWidth === '280', 'Measured width is available to native placement');
  popup.dataset.aegisNativePopupSide = 'inline';
  check(getPopupSidebarSide(popup, 280) === null, 'Native inline decision is authoritative');
  check(getPopupSidebarSide(popup, 280, false) === null && popup.dataset.aegisPopupPanelWidth === '0', 'Inline preference removes reserved width');
  popup.remove(); await Promise.resolve();
  check(!isTileTooltipSuppressed(), 'Closing restores hover');
  document.querySelector('#result').textContent = 'PASS: Tooltip lifecycle and single-owner popup placement contract';
}
run().catch(error => document.querySelector('#result').textContent = 'FAIL: ' + error.message);
</script>`, { viewport: { width: 1280, height: 800 } }).catch(error => { console.error(error); process.exitCode = 1; });
