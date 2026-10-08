const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const ts = require('typescript');
const { JSDOM } = require('jsdom');
const baseline = process.env.AEGIS_LOCALE_BASELINE === '1';
const integrated = path.resolve('../../..', 'integration-aegis/work/aegis');
const read = file => baseline ? cp.execFileSync('git', ['show', '1d07f27d09fb8565ef988e05d9d31536b2d3407e:' + file], { cwd: integrated, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 }) : fs.readFileSync(file, 'utf8');
// Independent VM module caches model separately bundled MAIN and ISOLATED code.
// Only DOM nodes/events are shared; neither world receives the other's i18n exports.
function world(dom) {
  const window = { document: dom.window.document, navigator: dom.window.navigator,
    addEventListener: dom.window.addEventListener.bind(dom.window), removeEventListener: dom.window.removeEventListener.bind(dom.window) };
  const globals = { window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, console,
    queueMicrotask, setTimeout: dom.window.setTimeout.bind(dom.window), clearTimeout: dom.window.clearTimeout.bind(dom.window),
    setInterval: dom.window.setInterval.bind(dom.window), clearInterval: dom.window.clearInterval.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window) };
  for (const name of ['Element', 'HTMLElement', 'HTMLInputElement', 'HTMLBRElement', 'Node', 'Text', 'Event', 'InputEvent', 'KeyboardEvent', 'MutationObserver', 'AbortController', 'DOMParser']) globals[name] = dom.window[name];
  const context = vm.createContext(globals), cache = new Map();
  function load(file) {
    file = path.normalize(file); if (!path.extname(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    // The native DIM validity provider is fixture data, never an i18n replacement.
    if (file === path.normalize('src/dim-search-adapter.ts')) return { isNativeSearchTermValid: () => true };
    if (file.endsWith('.json')) return JSON.parse(read(file.replaceAll('\\', '/')));
    const module = { exports: {} }; cache.set(file, module);
    const output = ts.transpileModule(read(file.replaceAll('\\', '/')), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const run = new vm.Script('(function(require,module,exports){' + output + '\n})', { filename: file }).runInContext(context);
    run(dep => dep.startsWith('.') ? load(path.join(path.dirname(file), dep)) : require(dep), module, module.exports);
    return module.exports;
  }
  return { load, window, context, run: text => new vm.Script(text).runInContext(context) };
}
const languages = ['en', 'es', 'ko', 'ja', 'zh-CHS', 'zh-CHT'];
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
(async () => {
  const dom = new JSDOM('<html data-aegis-search-display="readable"><body><div><input name="filter"><div class="aegis-search-widget"></div></div></body></html>', { url: 'https://example.test', pretendToBeVisual: true });
  const input = dom.window.document.querySelector('input'), raw = 'is:weapon  aegis:shopping ';
  const writes = []; input.value = raw; input.__reactProps$fixture = { onChange: event => writes.push(event.target.value), onKeyDown() {} };
  const main = world(dom), isolated = world(dom);
  try {
    const mainI18n = main.load('src/i18n.ts'), isolatedI18n = isolated.load('src/i18n.ts');
    assert.notEqual(mainI18n, isolatedI18n, 'Independent i18n module exports');
    const content = read('src/content.ts'), entry = read('src/main-world-content.ts');
    const initial = content.match(/^\s*((?:publishLanguage\()?initLanguage\(res\.aegisLanguage\)\)?);/m)?.[1];
    const live = content.match(/^\s*((?:publishLanguage\()?initLanguage\(changes\.aegisLanguage\.newValue\)\)?);/m)?.[1];
    assert(initial && live, 'Execute actual storage initial/live locale call sites');
    const boot = entry.match(/\n(initLanguageBridge\(initInlineSearchEditor\)|initInlineSearchEditor\(\));\s*$/)?.[1];
    assert(boot, 'Execute actual MAIN editor startup call site');
    main.context.initInlineSearchEditor = main.load('src/inline-search-editor.ts').initInlineSearchEditor;
    isolated.context.initLanguage = isolatedI18n.initLanguage;
    if (!baseline) {
      main.context.initLanguageBridge = main.load('src/language-bridge.ts').initLanguageBridge;
      isolated.context.publishLanguage = isolated.load('src/language-bridge.ts').publishLanguage;
    }
    main.run(boot); isolated.context.res = { aegisLanguage: 'es' }; isolated.run(initial); await tick();
    console.log('Initial independent languages: ISOLATED=' + isolatedI18n.getCurrentLanguage() + ', MAIN=' + mainI18n.getCurrentLanguage());
    assert.equal(mainI18n.getCurrentLanguage(), 'es', 'Initial storage preference reaches independent MAIN singleton');
    let editor = dom.window.document.querySelector('.aegis-inline-search'); assert(editor);
    editor.focus(); dom.window.document.getSelection().setBaseAndExtent(editor, 0, editor, 0);
    const selection = () => { const s = dom.window.document.getSelection(); return [s.anchorNode, s.anchorOffset, s.focusNode, s.focusOffset]; };
    for (const language of languages) {
      const before = selection(); isolated.context.changes = { aegisLanguage: { newValue: language } }; isolated.run(live); await tick();
      assert.equal(mainI18n.getCurrentLanguage(), language); assert.equal(input.value, raw);
      assert.deepEqual([...editor.querySelectorAll('.aegis-search-token-label')].map(n => n.textContent), [isolatedI18n.t('searchLabelWeapon'), isolatedI18n.t('searchLabelShopping')]);
      assert.deepEqual([...editor.querySelectorAll('[data-search-remove]')].map(n => n.getAttribute('aria-label')), ['is:weapon', 'aegis:shopping'].map(term => isolatedI18n.t('searchRemoveTerm', { term })));
      assert.deepEqual(selection(), before, 'Locale refresh preserves selection');
    }
    assert.deepEqual(writes, [], 'Locale refresh never changes native query or creates history');
    // Ignore malformed wire strings and cross-world object details entirely.
    for (const invalid of ['', 'auto', 'xx', 'EN', '<img>', '{"language":"es"}']) { dom.window.document.documentElement.setAttribute('data-aegis-language', invalid); await tick(); assert.equal(mainI18n.getCurrentLanguage(), 'zh-CHT'); }
    dom.window.document.dispatchEvent(new dom.window.CustomEvent('aegis-language-change', { detail: { language: 'es' } }));
    assert.equal(mainI18n.getCurrentLanguage(), 'zh-CHT');
    // Composition settles to the latest locale without replacing its active DOM.
    editor.dispatchEvent(new dom.window.CompositionEvent('compositionstart', { bubbles: true }));
    isolated.context.changes = { aegisLanguage: { newValue: 'ja' } }; isolated.run(live); await tick();
    assert.equal(editor.querySelector('[data-language]').dataset.language, 'zh-CHT');
    editor.dispatchEvent(new dom.window.CompositionEvent('compositionend', { bubbles: true }));
    assert.equal(editor.querySelector('[data-language]').dataset.language, 'ja'); assert.equal(input.value, raw); assert.deepEqual(writes, [raw], 'Composition completes through its existing native notification');
    editor.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    editor.dispatchEvent(new dom.window.InputEvent('beforeinput', { inputType: 'insertText', data: 'notes:temporary', bubbles: true, cancelable: true }));
    const edited = input.value; assert.notEqual(edited, raw);
    isolated.context.changes = { aegisLanguage: { newValue: 'es' } }; isolated.run(live); await tick();
    editor.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })); assert.equal(input.value, raw, 'History survives live locale change');
    editor.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })); assert.equal(input.value, edited, 'Redo survives live locale change');
    // Reinjection releases the old editor and starts the new bundle in current locale.
    main.run(boot); await tick(); const replacement = dom.window.document.querySelector('.aegis-inline-search'); assert.notEqual(replacement, editor); assert.equal(dom.window.document.querySelectorAll('.aegis-inline-search').length, 1); assert.equal(replacement.querySelector('[data-language]').dataset.language, 'es');
    dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide', { persisted: true })); assert.equal(dom.window.document.querySelector('.aegis-inline-search'), replacement, 'BFCache preserves editor and bridge');
    dom.window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow', { persisted: true }));
    isolated.context.changes = { aegisLanguage: { newValue: 'ja' } }; isolated.run(live); await tick(); assert.equal(mainI18n.getCurrentLanguage(), 'ja'); assert.equal(replacement.querySelector('[data-language]').dataset.language, 'ja', 'Live locale delivery resumes after BFCache'); assert.equal(input.value, edited);
    dom.window.dispatchEvent(new dom.window.Event('pagehide')); assert.equal(dom.window.document.querySelector('.aegis-inline-search'), null);
    isolated.context.changes = { aegisLanguage: { newValue: 'ko' } }; isolated.run(live); await tick(); assert.equal(mainI18n.getCurrentLanguage(), 'ja', 'Disposed observer ignores pending handoff');
    // A document_start consumer waits for root and validated initial publication.
    const pendingDom = new JSDOM('', { url: 'https://example.test', pretendToBeVisual: true }); pendingDom.window.document.documentElement.remove(); const pending = world(pendingDom); let starts = 0, stops = 0;
    const dispose = pending.load('src/language-bridge.ts').initLanguageBridge(() => { starts++; return () => stops++; });
    const root = pendingDom.window.document.createElement('html'); pendingDom.window.document.append(root); await tick(); assert.equal(starts, 0);
    root.setAttribute('data-aegis-language', 'ko'); await tick(); assert.equal(starts, 1); assert.equal(pending.load('src/i18n.ts').getCurrentLanguage(), 'ko'); dispose(); assert.equal(stops, 1); pendingDom.window.close();
    console.log('PASS A13: separate MAIN/ISOLATED module worlds, actual startup/storage call sites, initial/live six-language labels/removal, raw query/selection/history/composition, malformed handoff, reinjection/disposal, BFCache restoration, document_start readiness.');
  } finally { main.window.__aegisLanguageBridgeDispose?.(); main.window.__aegisInlineSearchDispose?.(); dom.window.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
