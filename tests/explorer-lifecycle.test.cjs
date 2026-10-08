const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

// Execute the production lifecycle/filtering functions and their real FAB,
// close, input and scroll bindings. Row presentation and unrelated badge/locale
// services are boundary stubs; the unchanged overlay test covers the complete
// content controller, numerical assertions and full database at 5000 ms.
const source = fs.readFileSync(process.env.AEGIS_EXPLORER_CONTENT_FILE || 'src/content.ts', 'utf8');
const file = ts.createSourceFile('content.ts', source, ts.ScriptTarget.Latest, true);
function productionFunction(name, optional = false) {
  const node = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  if (optional && !node) return '';
  assert.ok(node, `Production ${name} exists`);
  return node.getText(file);
}
let snapshot;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(file) === 'initSearchEvaluator') snapshot = node.arguments.at(-1);
  ts.forEachChild(node, visit);
}
visit(file);
assert.ok(snapshot && ts.isArrowFunction(snapshot), 'Use the production search snapshot callback');
const sheet = JSON.parse(fs.readFileSync('data/pve-database.json', 'utf8'));
assert.equal(Object.values(sheet.categories).flat().length, 889, 'Keep the complete source benchmark');
const dom = new JSDOM('<div data-aegis-item-hash="123"></div>', { url: 'https://app.destinyitemmanager.com' });
const { document, Event } = dom.window;
const logs = [], rows = [], publications = [], services = [], badgeItems = [], processed = [];
const timers = new Map();
let timerId = 0, locale = 'en';
const context = vm.createContext({
  document, Event, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element,
  explorerUi: null, activeTab: 'explorer', aegisMode: 'pve', aegisSheetDb: sheet, aegisSheetDbPvE: sheet,
  aegisSheetDbPvP: null, chaseList: {}, completedWeapons: {}, diagnosticLogs: [],
  currentExplorerMatches: [], renderedExplorerCount: 0, EXPLORER_CHUNK_SIZE: 40,
  AMMO_TYPE_MAP: {}, nativeOwnershipAuthoritative: false,
  nativeOwnedInventory: new Map(), nativeScoreData: new Map(), playerVaultInventory: new Map(), inventorySortItems: new Map(),
  inventorySortProvider: { publish: (status, response, items) => publications.push({ status, response, items }) },
  inventoryEvaluations: { clear() {} }, weaponEvaluations: { clear() {} }, armorEvaluations: { clear() {} },
  weaponFallbackCache: new WeakMap(), badgeResults: new WeakMap(), badgePresentationTimer: undefined,
  badgePresentationQueue: { clear: () => services.push('badge-clear'), add: item => badgeItems.push(item) },
  comparePerks: { refresh: () => services.push('compare-refresh') }, overviewPerks: { refresh: () => services.push('overview-refresh') },
  setupRegistryObserver: () => services.push('registry'), setupSearchWidget: () => services.push('search'),
  processElement: item => processed.push(item), updateProgressIndicator: () => services.push('progress'),
  addDiagnosticLog: value => logs.push(value), getExplorerTitle: () => `${locale} explorer`, t: key => `${locale}:${key}`,
  getLocalizedWeaponName: name => name, getEnglishWeaponNameFromHash: () => 'No Hesitation', getEnglishPerkNameFromHash: () => null,
  normName: name => name.toLowerCase().trim(),
  populateFilters: () => services.push('filters'), populateSourceFilter: () => services.push('source'),
  populateComboboxMenu: id => services.push('combobox:' + id), populateFramesFilter() {},
  setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
  renderExplorerRowHtml: match => {
    rows.push(match);
    const row = document.createElement('div'); row.className = 'aegis-explorer-row';
    row.dataset.weaponName = match.weapon.name; row.dataset.notes = match.weapon.notes;
    return row.outerHTML;
  },
});
const names = ['renderNextExplorerChunk', 'renderResults', 'initAegisExplorer', 'scheduleBadgePresentation', 'reprocessAllElements'];
const code = productionFunction('getOpenExplorerPanel', true) + '\n' + names.map(name => productionFunction(name)).join('\n') +
  '\nconst onSearchSnapshot = ' + snapshot.getText(file) + '; globalThis.onSearchSnapshot = onSearchSnapshot;';
vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
function flushPresentation() {
  const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback());
}
function latestDatabase(notes) {
  const database = structuredClone(sheet);
  database.weapons['no hesitation'].notes = notes;
  database.categories.Autos.find(weapon => weapon.name === 'No Hesitation').notes = notes;
  context.aegisSheetDb = context.aegisSheetDbPvE = database;
}
function results(panel) { return panel.querySelector('.aegis-explorer-results'); }
function rowCount(panel) { return results(panel).querySelectorAll('.aegis-explorer-row').length; }

try {
  context.initAegisExplorer();
  const first = context.explorerUi;
  assert.equal(first.panel.classList.contains('open'), false);
  assert.equal(first.panel.classList.contains('hidden'), false, 'Closed Explorer never used a hidden class');
  const closedHtml = results(first.panel).innerHTML;
  context.renderResults(); context.renderResults();
  assert.equal(results(first.panel).innerHTML, closedHtml, 'Closed startup and repeated updates do not replace results');
  assert.equal(rows.length, 0, 'Closed Explorer builds no row presentation');

  latestDatabase('latest database while closed');
  context.reprocessAllElements();
  assert.equal(processed.length, 1, 'Native annotated items still reprocess while Explorer is closed');
  assert.ok(services.includes('compare-refresh') && services.includes('overview-refresh'), 'Native compare and overview refresh remain');
  const tile = document.querySelector('[data-aegis-item-hash]');
  context.badgeResults.set(tile, {});
  context.scheduleBadgePresentation(); flushPresentation();
  assert.deepEqual(badgeItems, [tile], 'Closed Explorer does not suppress badge presentation');
  context.onSearchSnapshot('pending', { facts: [] }, { items: [] });
  assert.equal(publications.at(-1).status, 'pending', 'Pending sort publication remains unconditional');
  context.nativeOwnedInventory.set('owned', { data: {}, name: 'No Hesitation' });
  context.inventorySortItems.set('owned', { id: 'owned', hash: 123 });
  context.onSearchSnapshot('ready', { facts: [{ id: 'owned', hash: 123 }] }, { items: [{ id: 'owned', hash: 123, name: 'No Hesitation' }] });
  assert.equal(publications.at(-1).items.length, 1, 'Ready owned sort publication remains unconditional');
  assert.equal(context.playerVaultInventory.get('no hesitation').length, 1, 'Closed Explorer keeps latest authoritative ownership');
  assert.equal(results(first.panel).innerHTML, closedHtml);
  assert.equal(rows.length, 0);

  first.panel.querySelector('.aegis-explorer-search-input').value = 'No Hesitation';
  first.fab.click();
  assert.equal(first.panel.classList.contains('open'), true);
  assert.equal(rowCount(first.panel), 1, 'First open renders the latest full-database filtered row');
  assert.equal(results(first.panel).querySelector('.aegis-explorer-row').dataset.notes, 'latest database while closed');
  assert.deepEqual(services.slice(-5), ['filters', 'source', 'combobox:element', 'combobox:ammo', 'progress']);
  const input = first.panel.querySelector('.aegis-explorer-search-input'); input.value = ''; input.dispatchEvent(new Event('input'));
  assert.equal(context.currentExplorerMatches.length, 889, 'Opening/filtering preserves all benchmark rows');
  assert.equal(rowCount(first.panel), 40);
  results(first.panel).dispatchEvent(new Event('scroll'));
  assert.equal(rowCount(first.panel), 80, 'Open infinite scroll renders the next exact chunk');
  first.panel.querySelector('.aegis-explorer-close').click();
  const beforeClosedRows = rows.length;
  results(first.panel).dispatchEvent(new Event('scroll'));
  assert.equal(context.renderNextExplorerChunk(), false, 'A queued chunk after close becomes a no-op');
  assert.equal(rowCount(first.panel), 80); assert.equal(rows.length, beforeClosedRows);
  latestDatabase('newer model before reopen');
  context.renderResults();
  results(first.panel).scrollTop = 153;
  first.fab.click();
  assert.equal(rowCount(first.panel), 40, 'Reopen regenerates the latest result snapshot');
  assert.equal(results(first.panel).scrollTop, 153, 'Reopen retains result scroll position');
  input.value = 'No Hesitation'; input.dispatchEvent(new Event('input'));
  assert.equal(results(first.panel).querySelector('.aegis-explorer-row').dataset.notes, 'newer model before reopen');

  // A connected unrelated results node must not receive the current owner's rows.
  const unrelated = document.createElement('div'); unrelated.className = 'aegis-explorer-results'; unrelated.textContent = 'unrelated';
  document.body.prepend(unrelated); context.renderResults();
  assert.equal(unrelated.textContent, 'unrelated', 'Rendering stays within the owned current panel');
  first.panel.remove(); first.fab.remove();
  const detachedHtml = results(first.panel).innerHTML, detachedRows = rows.length;
  context.renderResults(); assert.equal(context.renderNextExplorerChunk(), false);
  assert.equal(results(first.panel).innerHTML, detachedHtml); assert.equal(rows.length, detachedRows);
  locale = 'fr'; context.initAegisExplorer();
  const replacement = context.explorerUi;
  assert.notEqual(replacement.panel, first.panel);
  assert.equal(replacement.panel.classList.contains('open'), false, 'Locale/replacement starts with a closed current owner');
  assert.equal(replacement.panel.querySelector('.aegis-explorer-title').textContent, 'fr explorer');
  context.renderResults(); assert.equal(rowCount(replacement.panel), 0);
  replacement.panel.querySelector('.aegis-explorer-search-input').value = 'No Hesitation'; replacement.fab.click();
  assert.equal(rowCount(replacement.panel), 1, 'The replacement opens with current model and locale');
  assert.equal(results(first.panel).innerHTML, detachedHtml, 'Replacement never mutates the detached old panel');
  assert.equal(unrelated.textContent, 'unrelated');
  console.log('PASS: production Explorer closed work, full889 filtering, latest first/reopen snapshot, owned scope, 40-row scroll, close-before-chunk, disposal/replacement, and unaffected native ownership/sort/badge refresh.');
} finally { dom.window.close(); }
