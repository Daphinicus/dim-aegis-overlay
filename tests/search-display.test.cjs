const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  const file = path.resolve(__dirname, '../src', name + '.ts');
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; cache.set(file, module.exports);
  new Function('require', 'module', 'exports', output)(name => name.startsWith('.') ? load(name) : require(name), module, module.exports);
  return module.exports;
}
const { readableSearchTerm: label, normalizeSearchDisplay: mode } = load('search-display');
for (const value of [undefined, null, '', 'unknown', {}, 'exact']) assert.equal(mode(value), 'exact');
assert.equal(mode('classic'), 'classic'); assert.equal(mode('readable'), 'readable');
for (const [query, expected] of [
  ['aegis:p:>=s', 'Perk ≥ S'], ['AEGIS:PERK:<=a+', 'Perk ≤ A+'], ['aegis:w:s', 'Weapon S'],
  ['aegis:w:=s', 'Weapon = S'], ['aegis:god', 'Perk ≥ S'], ['aegis:godroll', 'Perfect roll'],
  ['aegis:pve:>b', 'PvE perk > B'], ['aegis:a:2p:>=a', 'Armor 2-piece ≥ A'],
  ['aegis:4piece:<=b', 'Armor 4-piece ≤ B'], ['aegis:armor:s/a', 'Armor S/A'],
  ['aegis:shopping:ready', 'Shopping: ready'], ['aegis:"source:King\'s Fall"', "Source: King's Fall"],
  ['breaker:overload', 'Overload'], ['is:handcannon', 'Hand cannon'], ['power:>=2000', 'Power ≥ 2000'],
  ['notes:"two  spaces"', 'Notes: two  spaces'], ['tag:keep', 'Tag: keep'],
]) assert.equal(label(query).text, expected, query);
assert.equal(label('aegis:p:>=s').operator, '≥');
assert.equal(label('aegis:p:s').operator, undefined, 'A bare grade is not falsely described as exact equality');
assert.match(label('breaker:overload').icon, /DestinyBreakerTypeDefinition_da558352b624d799cf50de14d7cb9565\.png$/);
for (const query of ['custom:unexpected', 'is:unknown', 'aegis:p:>=z', 'aegis:meta', 'words', 'notes:"draft', 'breaker:anything', 'is:constructor', 'breaker:constructor', 'constructor:value']) {
  assert.equal(label(query).text, query, 'Unrecognized/incomplete syntax is preserved: ' + query);
}
console.log('PASS: search display defaults, readable labels, grade comparisons, quoted values, icon identity, and exact fallback');
