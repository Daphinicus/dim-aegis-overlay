const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const fixture = require('./fixtures/firefly-definitions.json');
const definitions = fixture.definitions;
const dom = new JSDOM('', { url: 'https://app.destinyitemmanager.com' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Event']) global[key] = dom.window[key];
global.matchMedia = () => ({ matches: true });
const cache = new Map();
function load(name) {
  if (name.endsWith('.json')) return JSON.parse(fs.readFileSync('src/' + name, 'utf8'));
  name = name.replace('./', '');
  if (name === 'i18n') return { t: key => key };
  if (name === 'tooltip') return { getRecommendedMasterworks: () => [] };
  if (cache.has(name)) return cache.get(name);
  const output = ts.transpileModule(fs.readFileSync('src/' + name + '.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  cache.set(name, module.exports);
  new Function('require', 'module', 'exports', output)(load, module, module.exports);
  return module.exports;
}
const translator = load('hash-translator');
const identity = load('weapon-perk-identity');
const { initComparePerks } = load('compare-perks');
const { evaluateCategoryPerks } = load('perk-evaluation');
const links = require('../data/trait-to-enhanced-trait.json');
const legacy = definitions[1561789734], normal = definitions[3824105627], enhanced = definitions[1183436451];
const icon = definition => definition.displayProperties.icon;
assert.equal(links[normal.hash], enhanced.hash, 'Use the verified normal/enhanced link');
for (const definition of [legacy, normal, enhanced]) assert.equal(definition.plug.plugCategoryIdentifier, 'frames');
assert.equal(icon(normal), icon(enhanced));
assert.notEqual(icon(legacy), icon(normal), 'Legacy Firefly has a different glyph');
translator.updateLocalizedRegistries(Object.fromEntries(Object.values(definitions).map(d => [d.hash, { name: d.displayProperties.name, icon: icon(d) }])));

// Exercise the unmodified production controller and SVG creation, not a modeled resolver.
for (const enhancedColumn of [false, true]) {
  const owned = definitions[enhancedColumn ? 4170193963 : 2054520291];
  document.body.innerHTML = `<div role="dialog"><div style="grid-template-rows:80px auto">
    <div role="rowheader">Perks</div><div><div><div class="item" data-aegis-item-hash="1"></div></div></div>
    <div role="cell"><div class="native-socket"><div role="button" title="Native tooltip"><div>
    <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><image href="${icon(owned)}"/>
    ${enhancedColumn ? '<path fill="#eade8b" d="M 0 20 L 10 0 L 20 20 Z"/>' : ''}</svg></div></div></div></div></div></div>`;
  const item = document.querySelector('.item');
  item.dataset.aegisWeaponPossiblePerks = JSON.stringify({ perk1s: ['Lucky Shot', 'Firefly'] });
  const native = document.querySelector('[role="button"]');
  const nativeImage = native.querySelector('image');
  const data = { sheetWeapon: {}, activeHashes: [owned.hash], perksMap: {
    [owned.hash]: { name: 'Lucky Shot', icon: icon(owned) },
  }, sheetPerks: { all: [{ type: 'perk1', name: 'Firefly', hash: legacy.hash, icon: icon(legacy), rankIndex: 1 }] } };
  const controller = initComparePerks({ getData: () => data, getMode: () => 'pve', getOrder: () => 'sheet',
    getEnhancedToNormal: () => Object.fromEntries(Object.entries(links).map(([n, e]) => [e, Number(n)])), enabled: () => true });
  controller.flush();
  const missing = document.querySelector('[data-aegis-compare-generated]');
  assert.ok(missing, 'Firefly recommendation creates a missing comparison bubble');
  assert.equal(missing.dataset.aegisComparePerkHash, String(enhancedColumn ? enhanced.hash : normal.hash),
    'Missing Firefly uses the current manifest definition for the normal/enhanced column');
  assert.equal(missing.querySelector('image').getAttribute('href'), 'https://www.bungie.net' + icon(normal),
    'Actual generated SVG uses the flame/crosshair glyph');
  assert.equal(!!missing.querySelector('path[fill="#eade8b"]'), enhancedColumn, 'Native enhancement marker follows column');
  assert.equal(native.querySelector('image'), nativeImage, 'Native icon node remains unchanged');
  assert.equal(nativeImage.getAttribute('href'), icon(owned));
  assert.equal(missing.getAttribute('role'), 'img');
  // Optional source-derived SVG specimens for non-browser visual corroboration.
  if (process.env.AEGIS_FIREFLY_SVG_DIR) fs.writeFileSync(process.env.AEGIS_FIREFLY_SVG_DIR + '/' + (enhancedColumn ? 'enhanced' : 'normal') + '.svg', missing.querySelector('svg').outerHTML);
}
for (const definition of [legacy, normal, enhanced]) {
  assert.equal(identity.weaponPerkBaseHash(definition.hash, 'perk1'), normal.hash);
  assert.equal(identity.weaponPerkScoreHash(definition.hash, 'perk1'), enhanced.hash, 'Existing canonical numerical score identity remains stable');
}
assert.equal(translator.getPerkHashFromEnglish('Firefly', 'perk1'), normal.hash);
assert.equal(translator.getPerkHashFromEnglish('Enhanced Firefly', 'perk1'), normal.hash);
assert.equal(translator.getPerkIcon('Firefly'), icon(normal));
assert.equal(translator.getPerkIcon(legacy.hash), icon(legacy), 'Exact legacy hash retains its own manifest icon');
const missingEvaluation = evaluateCategoryPerks('Firefly', [], {}, 'perk1');
assert.equal(missingEvaluation[0].hash, normal.hash);
assert.equal(missingEvaluation[0].icon, icon(normal), 'Missing tooltip recommendation also uses current presentation');
for (const definition of [legacy, normal, enhanced]) {
  const evaluation = evaluateCategoryPerks('Firefly', [{ hash: definition.hash, name: 'Firefly', icon: icon(definition), active: true }], {}, 'perk1');
  assert.equal(evaluation[0].hash, definition.hash, 'Owned Firefly retains exact identity');
  assert.equal(evaluation[0].icon, icon(definition), 'Owned Firefly retains exact manifest icon');
  assert.equal(evaluation[0].status, 'active');
}
dom.window.close();
console.log('PASS: Firefly manifest link, normal/enhanced production comparison SVG hashes/icons/markers, untouched native icons, and stable score identity.');
