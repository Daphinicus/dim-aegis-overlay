import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const file of ['stat-row-spacing-browser.cjs', 'stat-grade-browser.cjs', 'badge-dimming-browser.cjs', 'inventory-badges-browser.cjs', 'grade-preload-browser.cjs', 'inline-search-editor-browser.cjs', 'search-display-browser.cjs', 'review-ui-browser.cjs', 'inline-search-performance.cjs', 'native-search-browser.cjs', 'compare-browser.cjs', 'compare-popup-boundary-browser.cjs', 'footer-browser.cjs', 'badge-scale-browser.cjs', 'badge-scale-dependencies-browser.cjs', 'badge-structure-browser.cjs', 'badge-stars-browser.cjs', 'popup-layer-browser.cjs', 'popup-interaction-browser.cjs', 'popup-first-paint-browser.cjs', 'version-pill-browser.cjs', 'perk-tooltip-lifecycle-browser.cjs', 'perk-tooltip-positioning.test.cjs']) {
  const result = spawnSync(process.execPath, [`tests/${file}`], {
    cwd: root, stdio: 'inherit', windowsHide: true, timeout: 60000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
