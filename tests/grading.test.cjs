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
const { displayGrade, rollGradeDisplay, gradeGradient, twoTierGradient, defaultGradeColors, hasMaxTierGrade } = load('grade-colors');
for (const [base, end] of [['#ffd700','#ff8c00'],['#da70d6','#8a2be2'],['#00f2fe','#4facfe'],['#bdc3c7','#2c3e50'],['#e67e22','#d35400'],['#e74c3c','#c0392b']]) {
  assert.equal(gradeGradient(base), `linear-gradient(135deg, ${base}, ${end})`);
}
assert.equal(gradeGradient('#000000'), 'linear-gradient(135deg, #000000, #000000)');
assert.equal(gradeGradient('#386BFF'), 'linear-gradient(135deg, #386bff, #2e58d1)');
assert.equal(gradeGradient('#386bff'), gradeGradient('#386BFF'));
assert.equal(gradeGradient('#7f8c8d'), 'linear-gradient(135deg, #7f8c8d, #5a5a5a)');
assert.match(gradeGradient('#ffffff'), /^linear-gradient\(135deg, #ffffff, #[0-9a-f]{6}\)$/);
const brightness = hex => hex.slice(1).match(/../g).map(channel => parseInt(channel,16)/255)
  .map(v => v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
for (let value=0;value<=0xffffff;value+=4093) {
  const color='#'+value.toString(16).padStart(6,'0');
  const end=gradeGradient(color).match(/#[0-9a-f]{6}/g)[1];
  assert.ok(brightness(end)<=brightness(color)+.0001, 'Gradient endpoint must be darker: '+color);
  if (!Object.values(defaultGradeColors).includes(color)) {
    const channels = hex => hex.slice(1).match(/../g).map(channel => parseInt(channel,16));
    channels(color).forEach((channel, index) => assert.ok(Math.abs(channels(end)[index] - channel * .82) <= .5, 'Custom shading must preserve RGB proportions: '+color));
  }
}
const { hexToHsv, hsvToHex } = load('color-picker');
const { normalizeMasterwork, masterworkMatches } = load('masterwork');
assert.equal(normalizeMasterwork('Tier 1Reload Speed Masterwork'), 'reload');
assert.equal(normalizeMasterwork('Projectile Speed'), 'velocity');
assert.equal(masterworkMatches(['Range', 'Handling'], 'Tier 10 Handling'), true);
assert.equal(masterworkMatches(['Reload'], 'Reload Speed'), true);
assert.equal(masterworkMatches(['Range'], ''), false);
assert.equal(masterworkMatches(['Range'], 'Rangefinder'), false);
assert.equal(masterworkMatches([], ''), true);
const mwRules = defaultRules();mwRules['S+'].masterwork = true;
const fullRoll = Array(5).fill('active');
assert.equal(evaluateRules(fullRoll, mwRules, true), 'S+');
assert.equal(evaluateRules(fullRoll, mwRules, false), 'S');
assert.equal(evaluateCustomRoll(Array(5).fill('selectable'), mwRules, false).potentialGrade, 'S');
assert.equal(evaluateCustomRoll(Array(5).fill('selectable'), mwRules, true).potentialGrade, 'S+');
mwRules['S+'].extras = 'mag';mwRules['S+'].origin = false;
assert.ok(!unreachableGrades(mwRules).includes('S'));
const legacy = defaultGradeSettings();legacy.pve.S.extras = 'none';
for (const rule of Object.values(legacy.pve)) delete rule.masterwork;
assert.equal(normalizeGradeSettings(legacy).pve.S.masterwork,false);
assert.equal(normalizeGradeSettings(legacy).pve.S.extras,'none');
for (const [hex, hsv] of [['#ff0000', [0, 100, 100]], ['#00ff00', [120, 100, 100]], ['#0000ff', [240, 100, 100]], ['#ffffff', [0, 0, 100]], ['#000000', [0, 100, 0]]]) {
  assert.deepEqual(hexToHsv(hex), hsv);
  assert.equal(hsvToHex(hsv), hex);
}
for (let color = 0; color <= 0xffffff; color += 4093) {
  const hex = '#' + color.toString(16).padStart(6, '0');
  assert.equal(hsvToHex(hexToHsv(hex)), hex);
}
assert.deepEqual(hexToHsv('#000000', [240, 75, 100]), [240, 75, 0]);
assert.deepEqual(hexToHsv('#ffffff', [240, 75, 100]), [240, 0, 100]);
assert.equal(hsvToHex([360, 100, 100]), '#ff0000');

const rules = defaultRules();
const states = ['active', 'selectable', 'missing'];
for (let n = 0; n < 243; n++) {
  const slots = Array.from({ length: 5 }, (_, i) => states[Math.floor(n / 3 ** i) % 3]);
  assert.equal(evaluateRules(slots, rules), computeGrade(...slots, false), `default equipped ${slots}`);
  assert.equal(evaluateCustomRoll(slots, rules).potentialGrade, computeGrade(...slots, true), `default potential ${slots}`);
}
assert.deepEqual(unreachableGrades(rules), []);
const oldSettings = defaultGradeSettings();
oldSettings.rulesEnabled = true;oldSettings.pve.S.extras = 'none';oldSettings.pvp.D.origin = true;
delete oldSettings.pve.E;delete oldSettings.pvp.E;
const migrated = normalizeGradeSettings(oldSettings);
assert.equal(migrated.pve.S.extras, 'none');
assert.equal(migrated.pvp.D.origin, true);
assert.equal(migrated.pve.E.enabled, false);
assert.equal(migrated.pvp.E.enabled, false);
const optionalE = defaultRules();optionalE.E.enabled = true;
assert.ok(unreachableGrades(optionalE).includes('E'));
optionalE.D.origin = true;
assert.equal(evaluateRules(['active','missing','missing','missing','missing'],optionalE),'E');
assert.equal(evaluateCustomRoll(['selectable','missing','missing','missing','missing'],optionalE).potentialGrade,'E');
assert.equal(evaluateCustomRoll(['active','missing','selectable','missing','missing'],optionalE).potentialGrade,'C');
assert.equal(evaluateRules(Array(5).fill('missing'),optionalE),'F');
assert.equal(normalizeGradeSettings({...defaultGradeSettings(),pve:optionalE}).pve.E.enabled,true);
assert.equal(normalizeGradeSettings({...defaultGradeSettings(),colors:{E:'#123456'}}).colors.E,'#123456');
assert.equal(displayGrade('BE'),'E');
assert.equal(displayGrade('ES+'),'S+');
assert.equal(displayGrade('E'),'E');
assert.equal(computeGrade('active', 'active', 'active', 'active', 'active', false), 'S+');
assert.equal(computeGrade('active', 'active', 'active', 'missing', 'active', false), 'S');
assert.equal(computeGrade('active', 'active', 'missing', 'active', 'active', false), 'A+');
assert.equal(computeGrade('active', 'active', 'missing', 'missing', 'active', false), 'A');

let seed = 48271;
const pick = values => { seed = (seed * 16807) % 2147483647; return values[seed % values.length]; };
for (let profile = 0; profile < 30; profile++) {
  const custom = defaultRules();
  for (const grade of GRADES.filter(g => g !== 'F')) {
    custom[grade] = { traits: pick(['both', 'mixed', 'one', 'available']), extras: pick(['none', 'mag', 'barrel', 'either', 'both']), origin: pick([true, false]), masterwork: pick([true, false]), enabled: pick([true, true, false]) };
  }
  for (let n = 0; n < 243; n++) {
    const slots = Array.from({ length: 5 }, (_, i) => states[Math.floor(n / 3 ** i) % 3]);
    const mwMatched = pick([true,false]);
    const result = evaluateCustomRoll(slots, custom, mwMatched);
    assert.ok(gradeValue(result.potentialGrade) >= gradeValue(result.grade));
    const candidate = [...slots];
    for (const index of result.swaps) { assert.equal(slots[index], 'selectable'); candidate[index] = 'active'; }
    assert.equal(evaluateRules(candidate, custom, mwMatched), result.potentialGrade);
  }
}
for (let i = 1; i < GRADES.length; i++) assert.ok(gradeValue(GRADES[i - 1]) > gradeValue(GRADES[i]));
assert.equal(gradeValue('S-'), 100);
assert.equal(gradeValue('SS+'), 100);
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
assert.equal(normalizeGradeSettings({ ...defaultGradeSettings(), rulesEnabled: true }, { version: 1, colorsEnabled: true, colors: { S: '#00ff00' } }).rulesEnabled, true);
assert.deepEqual(normalizeGradeSettings(defaultGradeSettings(), { version: 1, colorsEnabled: true, colors: { S: '#00ff00' } }).colors, { S: '#00ff00' });
console.log('Passed: 486 default parity cases, 7,290 custom roll/potential cases, exact-grade parsing/order, and preference validation.');

for (const weapon of GRADES) for (const perk of GRADES) {
  const gradient=twoTierGradient(weapon+perk);
  assert.ok(gradient, weapon+perk);
  if(defaultGradeColors[weapon]===defaultGradeColors[perk]) assert.equal(gradient,gradeGradient(defaultGradeColors[perk]));
  else assert.ok(gradient.endsWith(`linear-gradient(90deg, ${defaultGradeColors[weapon]}, ${defaultGradeColors[perk]})`));
}
for(const text of ['S','S+','F➔A','S/S','FA | BS','FA➔S+ | BA','—','SS+➔garbage','FA➔']) assert.equal(twoTierGradient(text),null,text);
assert.equal(twoTierGradient('FA➔S+'),twoTierGradient('FS+'));
assert.equal(twoTierGradient('FA➔FS+'),twoTierGradient('FS+'));
assert.equal(twoTierGradient(' ★ FA ▲ '),twoTierGradient('FA'));
const twoTonePalette=defaultGradeSettings();twoTonePalette.colorsEnabled=true;twoTonePalette.colors={'S+':'#112233',S:'#abcdef',F:'#000000',A:'#ffffff'};
assert.match(twoTierGradient('S+S',twoTonePalette),/90deg, #112233, #abcdef/);
assert.match(twoTierGradient('FA',twoTonePalette),/90deg, #000000, #ffffff/);
twoTonePalette.colorsEnabled=false;assert.equal(twoTierGradient('FA',twoTonePalette),twoTierGradient('FA'));
console.log('Passed: 100 two-tier color pairs, matching-color parity, custom + grades, dual parsing and single/armor/mixed exclusions.');

for(const grade of ['SS+','S+S+','SA➔S+','SF➔SS+','BS | SS+','SS+ | FA']) assert.equal(hasMaxTierGrade(grade),true,grade);
for(const grade of ['SS','SA','AS+','S+','S/S','BS+ | SS','S➔S+','FA➔S+','—']) assert.equal(hasMaxTierGrade(grade),false,grade);
console.log('Passed: SS+-only glow selection, mixed-side eligibility and equipped/potential exclusions.');
