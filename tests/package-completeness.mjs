import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { inventory, requireAsset, validatePackage, recordBuild, validateBuild } from '../scripts/package-assets.mjs';

async function fixture(run) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'extension-package-contract-'));
  try {
    for (const directory of ['src','public','scripts','data','dist']) await fs.mkdir(path.join(base,directory));
    for (const name of ['package.json','package-lock.json','tsconfig.json']) await fs.writeFile(path.join(base,name),'{}');
    await fs.writeFile(path.join(base,'src/main.js'),'// source\n');
    await fs.writeFile(path.join(base,'dist/main.js'),'// bundle\n');
    await fs.writeFile(path.join(base,'dist/manifest.json'),JSON.stringify({manifest_version:3,content_scripts:[{js:['main.js']}]}));
    await run(base, path.join(base,'dist'));
  } finally {
    if (path.dirname(base)!==os.tmpdir() || !path.basename(base).startsWith('extension-package-contract-')) throw new Error('Unsafe fixture cleanup');
    await fs.rm(base,{recursive:true,force:true});
  }
}

test('required manifest assets cannot disappear',()=>fixture(async (root,dist)=>{
  await fs.unlink(path.join(dist,'main.js'));
  await assert.rejects(validatePackage(dist),/missing asset main.js/);
}));
test('wildcard resources must match actual files',()=>{
  assert.throws(()=>requireAsset({'data/a.json':'hash'},'fonts/*.otf'),/missing asset pattern/);
  requireAsset({'data/a.json':'hash'},'data/*.json');
  assert.throws(()=>requireAsset({'data/a-json':'hash'},'data/*.json'),/missing asset pattern/);
});
test('traversal and machine-local asset URLs fail',()=>fixture(async (root,dist)=>{
  assert.throws(()=>requireAsset({},'../personal.json'),/unsafe asset/);
  await fs.writeFile(path.join(dist,'theme.css'),'a{background:url("file:///C:/private/font.otf")}');
  await assert.rejects(validatePackage(dist),/unexpected machine/);
}));
test('CSS font URLs and popup script/style paths are validated',()=>fixture(async (root,dist)=>{
  await fs.writeFile(path.join(dist,'theme.css'),'@font-face{src:url("fonts/licensed.otf")}');
  await assert.rejects(validatePackage(dist),/missing asset fonts\/licensed.otf/);
  await fs.mkdir(path.join(dist,'fonts'));
  await fs.writeFile(path.join(dist,'fonts/licensed.otf'),'font bytes');
  await fs.writeFile(path.join(dist,'popup.html'),'<script src="popup.js"></script>');
  await assert.rejects(validatePackage(dist),/missing asset popup.js/);
  await fs.writeFile(path.join(dist,'popup.js'),'// popup');
  await validatePackage(dist);
}));
test('Chrome rewritten CSS still requires bundled fonts',()=>fixture(async(root,dist)=>{
  await fs.writeFile(path.join(dist,'theme.css'),'@font-face{src:url("chrome-extension://__MSG_@@extension_id__/fonts/a.otf")}');
  await assert.rejects(validatePackage(dist),/missing asset fonts\/a.otf/);
}));
test('literal runtime URLs are part of the package graph',()=>fixture(async(root,dist)=>{
  await fs.writeFile(path.join(dist,'main.js'),"chrome.runtime.getURL('data/required.json')");
  await assert.rejects(validatePackage(dist),/missing asset data\/required.json/);
}));
test('dynamic asset inventories must be explicitly present',()=>fixture(async(root,dist)=>{
  await assert.rejects(validatePackage(dist,['weapons/known.frame']),/missing asset weapons\/known.frame/);
}));
test('empty assets fail completeness checks',()=>fixture(async(root,dist)=>{
  await fs.writeFile(path.join(dist,'empty.json'),'');
  await assert.rejects(inventory(dist),/Empty package/);
}));
test('same-version stale build inputs are rejected',()=>fixture(async(root,dist)=>{
  await recordBuild(root,dist);
  await validateBuild(root,dist);
  await fs.writeFile(path.join(root,'src/main.js'),'// newer source');
  await assert.rejects(validateBuild(root,dist),/Build inputs changed/);
}));
test('altered or unexpected built payloads are rejected',()=>fixture(async(root,dist)=>{
  await recordBuild(root,dist);
  await fs.writeFile(path.join(dist,'main.js'),'// stale bundle');
  await assert.rejects(validateBuild(root,dist),/Built payload changed/);
  await recordBuild(root,dist);
  await fs.writeFile(path.join(dist,'personal.json'),'{}');
  await assert.rejects(validateBuild(root,dist),/Unexpected built payload/);
}));
test('packaging requires a completed build receipt',()=>fixture(async(root,dist)=>{
  await assert.rejects(validateBuild(root,dist),/No verified build receipt/);
}));
test('broken Git checkouts cannot bypass provenance as source archives',()=>fixture(async(root,dist)=>{
  await fs.writeFile(path.join(root,'.git'),'gitdir: missing-fixture-git\n');
  await assert.rejects(recordBuild(root,dist),/not a git repository|Command failed/);
}));
test('Git-only checkpoint changes and dirty source cannot mislabel a package',()=>fixture(async(root,dist)=>{
  const git = (...args) => execFileSync('git', ['-c', `safe.directory=${root}`, '-c','user.name=Package Contract', '-c','user.email=package-contract@example.invalid', ...args], {cwd:root,encoding:'utf8'});
  git('init','--quiet');
  await fs.writeFile(path.join(root,'.gitignore'),'dist/\n');
  git('add','.'); git('commit','--quiet','-m','Fixture checkpoint');
  await recordBuild(root,dist); await validateBuild(root,dist);
  git('commit','--quiet','--allow-empty','-m','New checkpoint');
  await assert.rejects(validateBuild(root,dist),/Source commit changed/);
  await fs.writeFile(path.join(root,'src/main.js'),'// dirty source');
  await recordBuild(root,dist);
  await assert.rejects(validateBuild(root,dist),/uncommitted project inputs/);
}));
