import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export async function inventory(directory, prefix = '') {
  const files = {};
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Package symlink is unsupported: ${relative}`);
    if (entry.isDirectory()) Object.assign(files, await inventory(path.join(directory, entry.name), relative + '/'));
    else if (entry.isFile()) {
      const bytes = await fs.readFile(path.join(directory, entry.name));
      if (!bytes.length) throw new Error(`Empty package/input asset: ${relative}`);
      files[relative] = createHash('sha256').update(bytes).digest('hex');
    }
  }
  return files;
}

export function requireAsset(files, asset, context = 'package') {
  if (typeof asset !== 'string' || !asset || asset.startsWith('/') || asset.includes('\\') || asset.split('/').includes('..'))
    throw new Error(`${context}: unsafe asset path ${asset}`);
  if (asset.includes('*')) {
    const regex = new RegExp('^' + asset.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
    if (!Object.keys(files).some(file => regex.test(file))) throw new Error(`${context}: missing asset pattern ${asset}`);
  } else if (!Object.hasOwn(files, asset)) throw new Error(`${context}: missing asset ${asset}`);
}

function localAsset(value, file) {
  if (!value || value.startsWith('#') || /^(?:data:|https?:|\/\/)/i.test(value)) return null;
  value = value.replace(/^chrome-extension:\/\/__MSG_@@extension_id__\//, '/');
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) throw new Error(`${file}: unexpected machine/extension URL ${value}`);
  const pathname = value.split(/[?#]/, 1)[0];
  return path.posix.normalize(pathname.startsWith('/') ? pathname.slice(1) : path.posix.join(path.posix.dirname(file), pathname));
}

export async function validatePackage(directory, extraRequired = []) {
  const files = await inventory(directory);
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const required = [
    ...Object.values(manifest.icons || {}), ...Object.values(manifest.action?.default_icon || {}),
    manifest.action?.default_popup, manifest.options_page, manifest.options_ui?.page,
    manifest.background?.service_worker, ...(manifest.background?.scripts || []),
    ...(manifest.content_scripts || []).flatMap(script => [...(script.js || []), ...(script.css || [])]),
    ...(manifest.web_accessible_resources || []).flatMap(entry => typeof entry === 'string' ? [entry] : entry.resources),
    ...extraRequired,
  ].filter(Boolean);
  for (const asset of required) requireAsset(files, asset, 'manifest/runtime');
  for (const file of Object.keys(files).filter(file => /\.(?:css|html|js)$/.test(file))) {
    const text = await fs.readFile(path.join(directory, file), 'utf8');
    const references = file.endsWith('.css') ? [...text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s'"()]+))\s*\)/g)].map(m=>m[1]??m[2]??m[3])
      : file.endsWith('.html') ? [...text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)].map(m=>m[1])
      : [...text.matchAll(/\.getURL\(\s*(["'])([^"'\r\n]+)\1\s*\)/g)].map(m=>m[2]);
    for (const value of references) {
      const asset = localAsset(value, file);
      if (asset) requireAsset(files, asset, file);
    }
  }
  return { manifest, files };
}

export async function inputHash(root) {
  const files = {};
  for (const directory of ['src','public','scripts','data','tests','docs','tools','font-preview','.github']) {
    try { Object.assign(files, await inventory(path.join(root, directory), directory + '/')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const name of ['package.json','package-lock.json','tsconfig.json']) {
    const bytes = await fs.readFile(path.join(root, name));
    files[name] = createHash('sha256').update(bytes).digest('hex');
  }
  for (const name of ['README.md','AGENTS.md','.gitignore']) {
    try { files[name] = createHash('sha256').update(await fs.readFile(path.join(root, name))).digest('hex'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return createHash('sha256').update(JSON.stringify(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)))).digest('hex');
}

export async function recordBuild(root, directory, required = []) {
  const { files } = await validatePackage(directory, required);
  delete files['package-build.json'];
  let sourceCommit = null;
  let sourceDirty = null;
  let isCheckout = false;
  try {
    await fs.stat(path.join(root, '.git'));
    isCheckout = true;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (isCheckout) {
    const git = (...args) => execFileSync('git', ['-c', `safe.directory=${root}`, ...args], {cwd:root,encoding:'utf8'});
    sourceCommit = git('rev-parse','HEAD').trim();
    const inputs = ['src','public','scripts','data','tests','docs','tools','font-preview','.github','README.md','AGENTS.md','.gitignore','package.json','package-lock.json','tsconfig.json'];
    sourceDirty = Boolean(git('diff','--name-only','HEAD','--',...inputs).trim()
      || git('ls-files','--others','--exclude-standard','--',...inputs).trim());
  }
  const receipt = { schema:1, sourceCommit, sourceDirty, inputHash:await inputHash(root), required, files };
  await fs.writeFile(path.join(directory, 'package-build.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

export async function validateBuild(root, directory) {
  let receipt;
  try { receipt = JSON.parse(await fs.readFile(path.join(directory, 'package-build.json'), 'utf8')); }
  catch { throw new Error('No verified build receipt. Rebuild before packaging.'); }
  if (receipt.sourceCommit) {
    const currentCommit = execFileSync('git', ['-c', `safe.directory=${root}`, 'rev-parse','HEAD'], {cwd:root,encoding:'utf8'}).trim();
    if (receipt.sourceCommit !== currentCommit) throw new Error('Source commit changed. Rebuild before packaging.');
    if (receipt.sourceDirty !== false) throw new Error('Build includes uncommitted project inputs. Commit and rebuild before packaging.');
  }
  if (receipt.inputHash !== await inputHash(root)) throw new Error('Build inputs changed. Rebuild before packaging.');
  const { files } = await validatePackage(directory, receipt.required);
  for (const [file, hash] of Object.entries(receipt.files)) {
    if (files[file] !== hash) throw new Error(`Built payload changed: ${file}. Rebuild before packaging.`);
  }
  if (Object.keys(files).some(file => file !== 'package-build.json' && !Object.hasOwn(receipt.files, file)))
    throw new Error('Unexpected built payload. Rebuild before packaging.');
  return receipt;
}
