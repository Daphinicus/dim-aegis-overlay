import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateBuild, validatePackage } from './package-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const receipt = await validateBuild(root, dist);
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const scratch = path.join(root, 'scratch');
fs.mkdirSync(scratch, { recursive: true });
const stage = fs.mkdtempSync(path.join(scratch, 'package-'));

function zip(directory, output, files) {
  if (fs.existsSync(output)) fs.unlinkSync(output);
  // Preserve nested asset paths on both platforms. Pass arguments without a shell.
  if (process.platform === 'win32') execFileSync('tar', ['-a', '-cf', output, ...files], { cwd: directory, stdio: 'inherit' });
  else execFileSync('zip', ['-q', '-r', output, ...files], { cwd: directory, stdio: 'inherit' });
}

try {
  // Extracted source archives have no .git directory. They can rebuild both
  // browser packages; only Git checkouts generate another source archive.
  let sourceFiles = null;
  if (fs.existsSync(path.join(root, '.git'))) {
    const gitArgs = ['-c', `safe.directory=${root}`];
    sourceFiles = execFileSync('git', [...gitArgs, 'ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0')
      .filter(file => file && !/^(scratch|dist|node_modules|\.git|\.agents|\.codex)\//.test(file) && !file.endsWith('.local'));
    const untracked = execFileSync('git', [...gitArgs, 'ls-files', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0');
    if (untracked.some(file => /^(src|public|scripts|tests|docs|data|tools)\//.test(file)))
      throw new Error('Stage new source, data and test files before packaging the source archive.');
  }
  fs.cpSync(dist, stage, { recursive: true });
  const chromium = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
  const firefox = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.firefox.json'), 'utf8'));
  if (chromium.version !== version || firefox.version !== version) throw new Error('Package and manifest versions must match.');
  delete chromium.background.scripts;
  delete chromium.browser_specific_settings;
  fs.unlinkSync(path.join(stage, 'manifest.firefox.json'));
  for (const [browser, manifest] of [['chromium', chromium], ['firefox', firefox]]) {
    fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await validatePackage(stage, receipt.required);
    const name = `dim-aegis-overlay-v${version}-${browser}.zip`;
    zip(stage, path.join(root, name), fs.readdirSync(stage));
    console.log(`Packaged ${name}`);
  }
  if (sourceFiles) {
    zip(root, path.join(root, 'dim-aegis-overlay-src.zip'), sourceFiles);
    console.log('Packaged dim-aegis-overlay-src.zip');
  } else console.log('No .git checkout: browser packages built; source ZIP omitted.');
} finally {
  // Verify the absolute target before recursively removing our temporary staging directory.
  if (path.dirname(stage) === scratch && path.basename(stage).startsWith('package-')) {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}
