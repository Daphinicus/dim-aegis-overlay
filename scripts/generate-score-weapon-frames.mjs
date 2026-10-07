import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const weapons = JSON.parse(fs.readFileSync(new URL('data/manifest-weapons.json', root), 'utf8'));
// Public hash-specific frame metadata. Never infer an edition from its owned perk quality.
const frames = Object.fromEntries(weapons.filter(w => w.archetype).map(w => [w.hash, w.archetype]));
fs.writeFileSync(new URL('data/score-weapon-frames.json', root), JSON.stringify(frames) + '\n');
console.log(`Indexed ${Object.keys(frames).length} weapon frames from bundled manifest-weapons.json.`);
// Name-only category recovery cannot distinguish editions across weapon families.
const database = JSON.parse(fs.readFileSync(new URL('data/pve-database.json', root), 'utf8'));
const baseName = name => name.toLowerCase().trim().replace(/\s*\([^)]*\)\s*$/, '');
const frameKey = frame => frame.toLowerCase().replace(/\bframe\b/g, '').replace(/[^a-z0-9]/g, '');
const groups = new Map();
for (const [category, rows] of Object.entries(database.categories)) for (const row of rows) {
  const name = baseName(row.name), values = groups.get(name) ?? [];
  values.push({category, frame: frameKey(row.frame)}); groups.set(name, values);
}
const recovery = {};
for (const [name, rows] of groups) {
  if (new Set(rows.map(row => row.category)).size < 2) continue;
  const byFrame = {};
  for (const {category, frame} of rows) {
    if (!frame) continue;
    byFrame[frame] = byFrame[frame] === undefined || byFrame[frame] === category ? category : null;
  }
  recovery[name] = byFrame;
}
fs.writeFileSync(new URL('data/score-weapon-category-frames.json', root), JSON.stringify(recovery) + '\n');
console.log(`Indexed ${Object.keys(recovery).length} cross-category names with verified source frames.`);
