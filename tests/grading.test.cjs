const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../node_modules/typescript');
const cache = new Map();
function load(name) {
  const file = path.resolve(__dirname, '../src', name + '.ts');
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; cache.set(file, module.exports);
  new Function('require', 'module', 'exports', output)(name => load(name), module, module.exports);
  return module.exports;
}
const { GRADES, computeGrade, defaultRules, defaultGradeSettings, normalizeGradeSettings, evaluateRules, evaluateCustomRoll, gradeValue, unreachableGrades } = load('grading');
const { displayGrade, rollGradeDisplay, contrastText } = load('grade-colors');

const rules = defaultRules();
const states = ['active', 'selectable', 'missing'];
for (let n = 0; n < 243; n++) {
  const slots = Array.from({ length: 5 }, (_, i) => states[Math.floor(n / 3 ** i) % 3]);
  assert.equal(evaluateRules(slots, rules), computeGrade(...slots, false), `default equipped ${slots}`);
  assert.equal(evaluateCustomRoll(slots, rules).potentialGrade, computeGrade(...slots, true), `default potential ${slots}`);
}
assert.deepEqual(unreachableGrades(rules), []);
assert.equal(computeGrade('active', 'active', 'active', 'active', 'active', false), 'S+');
assert.equal(computeGrade('active', 'active', 'active', 'missing', 'active', false), 'S');
assert.equal(computeGrade('active', 'active', 'missing', 'active', 'active', false), 'A+');
assert.equal(computeGrade('active', 'active', 'missing', 'missing', 'active', false), 'A');

let seed = 48271;
const pick = values => { seed = (seed * 16807) % 2147483647; return values[seed % values.length]; };
for (let profile = 0; profile < 30; profile++) {
  const custom = defaultRules();
  for (const grade of GRADES.filter(g => g !== 'F')) {
    custom[grade] = { traits: pick(['both', 'mixed', 'one', 'available']), extras: pick(['none', 'mag', 'barrel', 'either', 'both']), origin: pick([true, false]), enabled: pick([true, true, false]) };
  }
  for (let n = 0; n < 243; n++) {
    const slots = Array.from({ length: 5 }, (_, i) => states[Math.floor(n / 3 ** i) % 3]);
    const result = evaluateCustomRoll(slots, custom);
    assert.ok(gradeValue(result.potentialGrade) >= gradeValue(result.grade));
    const candidate = [...slots];
    for (const index of result.swaps) { assert.equal(slots[index], 'selectable'); candidate[index] = 'active'; }
    assert.equal(evaluateRules(candidate, custom), result.potentialGrade);
  }
}
for (let i = 1; i < GRADES.length; i++) assert.ok(gradeValue(GRADES[i - 1]) > gradeValue(GRADES[i]));
assert.deepEqual(normalizeGradeSettings(null), defaultGradeSettings());
assert.deepEqual(normalizeGradeSettings({ version: 2, rulesEnabled: true }), defaultGradeSettings());
const settings = defaultGradeSettings();settings.colorsEnabled = true;settings.colors = { S: '#abcdef', 'S+': 'red; position:fixed' };settings.pve.S.origin = 'invalid';
const normalized = normalizeGradeSettings(settings);
assert.deepEqual(normalized.colors, { S: '#abcdef' });
assert.deepEqual(normalized.pve, defaultRules());
assert.notEqual(normalized.pve, normalized.pvp);
assert.equal(defaultGradeSettings().colors.S, undefined);
for (const [input, expected] of [['S+', 'S+'], ['SS+', 'S+'], ['S+F', 'F'], ['A+S+', 'S+'], ['BS➔S+', 'S+'], ['B+F→A+', 'A+'], ['★ S+ ▲', 'S+'], ['✦ A+', 'A+'], ['—', ''], ['S/A+', 'S']]) assert.equal(displayGrade(input), expected, input);
assert.equal(rollGradeDisplay('B+S➔S+'), 'S➔S+');
assert.equal(contrastText('#ffffff'), '#000000');
assert.equal(contrastText('#000000'), '#ffffff');
console.log('Passed: 486 default parity cases, 7,290 custom roll/potential cases, exact-grade parsing/order, and preference validation.');
