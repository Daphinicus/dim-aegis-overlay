const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const path = require('node:path');
const src = file => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
const transpile = code => ts.transpile(code, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
function fn(file, name) { const parsed = ts.createSourceFile(file, src(file), ts.ScriptTarget.Latest, true); const node = parsed.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name); assert(node, name); return node.getText(parsed); }
function load(file, globals = {}) { const exports = {}; const context = { exports, console, setTimeout, clearTimeout, URL, ...globals }; context.require = id => globals.modules?.[id] || (id.startsWith('./') && fs.existsSync(path.join(__dirname, '../src', id.slice(2) + '.ts')) ? load(id.slice(2) + '.ts', globals).exports : {}); vm.runInNewContext(transpile(src(file)), context); return context; }
const results = [];
async function test(id, callback) {
    try {
        await callback();
        console.log(id + ' PASS');
        results.push(true);
    }
    catch (error) {
        console.error(id + ' FAIL: ' + error.message);
        results.push(false);
    }
}
const empty = { weapons: {}, categories: {} };
const oldPve = { weapons: { old: { name: 'Old' } }, categories: { Autos: [{ name: 'Old' }] } };
const oldPvp = { weapons: { pvp: { name: 'PvP' } }, categories: { Autos: [{ name: 'PvP' }] } };
async function refresh(pve, pvp, shopping = null) {
    const state = { aegisSheetDbPvE: oldPve, aegisSheetDbPvP: oldPvp, aegisSheetDb: oldPve, aegisShoppingDbPvE: { items: [{ name: 'Old shopping' }] }, aegisSheetLastSync: 123 };
    const context = { sheetSync: undefined, sheetFailureMessage: load('sync-feedback.ts').exports.sheetFailureMessage, console, Date, Promise, Object, PVE_DB_CDN_URL: 'pve', PVP_DB_CDN_URL: 'pvp', SHEET_ID: 'pve', PVP_SHEET_ID: 'pvp', ALL_TABS: [], fetchAndCachePerkRatings: async () => { }, fetchWithTimeout: async () => ({ ok: false }), fetchSpreadsheetDatabase: async (id) => id === 'pve' ? pve : pvp, fetchShoppingListDatabase: async () => shopping, chrome: { storage: { local: { get: async () => ({ ...state }), set: async (patch) => Object.assign(state, patch) } } } };
    vm.runInNewContext(transpile(fn('background.ts', 'fetchAndCacheAegisSheet')), context);
    const result = await context.fetchAndCacheAegisSheet();
    return { state, result };
}
(async () => {
    await test('A03 total failure preserves cache/timestamp', async () => { const { state, result } = await refresh(empty, empty); assert.equal(result.success, false); assert.equal(state.aegisSheetDbPvE, oldPve); assert.equal(state.aegisSheetDbPvP, oldPvp); assert.equal(state.aegisSheetLastSync, 123); });
    await test('A03 independent partial refresh', async () => { const fresh = { weapons: { fresh: { name: 'Fresh' } }, categories: { Autos: [] } }; const { state, result } = await refresh(fresh, empty); assert.equal(result.success, false); assert.equal(result.partial, true); assert.equal(state.aegisSheetDbPvE, fresh); assert.equal(state.aegisSheetDbPvP, oldPvp); assert.equal(state.aegisSheetLastSync, 123); assert.equal(state.aegisShoppingDbPvE.items[0].name, 'Old shopping'); });
    await test('A05 complete snapshot ownership without DOM', () => {
        const source = src('content.ts');
        const sf = ts.createSourceFile('content.ts', source, ts.ScriptTarget.Latest, true);
        const declaration = sf.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(sf) === 'nativeSearchEvaluator'));
        let snapshot;
        const vault = new Map();
        const pending = new Map();
        const native = new Map();
        const item = { id: '100000000000000001', hash: 1, name: 'Test', kind: 'weapon', perkHashes: [], activeHashes: [], perksMap: {}, masterwork: '', variantText: 'Test' };
        const data = { result: { grade: 'S+', matchedPerks: [], missingPerks: [] }, normWName: 'test' };
        const context = { explorerUi: null, IS_WINNOWER_HOST: false, initSearchEvaluator: (evaluate, _r, _a, _c, _s, onSnapshot) => { snapshot = { evaluate, onSnapshot }; }, evaluateSearchItem: undefined, searchSettingsReady: true, searchLocaleReady: true, inventorySortItems: new Map(), inventorySortProvider: { publish() { } }, inventoryBadges: { add() { }, status() { } }, nativeScoreData: native, playerVaultInventory: vault, pendingOwnedInventory: pending, nativeOwnedInventory: pending, normName: s => s.toLowerCase().trim(), getEnglishWeaponNameFromHash: () => null, getEnglishPerkNameFromHash: () => null, inventorySortItem: () => ({ hash: 1 }), inventorySortSettings: () => ({}), evaluateWeapon: () => data, evaluateScoreInput: () => ({}), finalizeSearchGrade() { }, compactSearchData: d => d, aegisMode: 'pve', aegisGradeDisplayMode: 'active', aegisTwoTier: false, scoreSettings: {}, chaseList: {}, aegisSheetDb: null, aegisSheetDbPvE: null, aegisSheetDbPvP: null, renderResults() { }, document: { querySelector: () => null } };
        vm.runInNewContext(transpile(fn('content.ts', 'getOpenExplorerPanel') + '\n' + fn('content.ts', 'evaluateSearchItem') + '\n' + declaration.getText(sf)), context);
        const revision = { session: 'one', accountEpoch: 1, inventoryRevision: 1, evaluationRevision: 1 };
        snapshot.onSnapshot('pending', { ...revision, facts: [] }, { ...revision, items: [item] });
        const fact = snapshot.evaluate(item);
        snapshot.onSnapshot('ready', { ...revision, facts: [fact] }, { ...revision, items: [item] });
        assert.equal(vault.get('test')?.length, 1);
        const committed = vault.get('test')[0];
        Object.assign(context, { inventoryEvaluations: new Map(), weaponEvaluations: { clear() { } }, armorEvaluations: { clear() { } }, weaponFallbackCache: new WeakMap(), setupRegistryObserver() { }, setupSearchWidget() { }, processElement() { }, comparePerks: { refresh() { } }, overviewPerks: { refresh() { } } });
        context.document.querySelectorAll = () => [];
        vm.runInNewContext(transpile(fn('content.ts', 'reprocessAllElements')), context);
        context.reprocessAllElements();
        assert.equal(vault.get('test')[0], committed, 'route/settings reprocessing retains complete ownership despite no DOM tiles');
        let domIndex;
        const visit = node => {
            if (ts.isIfStatement(node) && node.expression.getText(sf).includes('result.grade') && node.expression.getText(sf).includes('COMPARE_BUCKET_SELECTOR'))
                domIndex = node.getText(sf);
            ts.forEachChild(node, visit);
        };
        visit(sf);
        assert(domIndex);
        Object.assign(context, { result: { grade: 'F', matchedPerks: [] }, scoresEnabled: () => false, COMPARE_BUCKET_SELECTOR: '.compare', normWName: 'test', weaponName: 'Test', itemHash: 1, scoreEvaluations: undefined, sheetPerks: undefined, equippedMasterwork: '', el: { closest: () => null, getAttribute: () => '100000000000000099' } });
        vm.runInNewContext(transpile(domIndex), context);
        assert.equal(vault.get('test').length, 1, 'DOM fallback cannot add stale items to a complete native snapshot');
        const readyAgain = { ...revision, inventoryRevision: 2 };
        snapshot.onSnapshot('pending', { ...readyAgain, facts: [] }, { ...readyAgain, items: [] });
        snapshot.onSnapshot('ready', { ...readyAgain, facts: [] }, { ...readyAgain, items: [] });
        assert.equal(vault.size, 0, 'removed instance leaves authoritative inventory');
        snapshot.onSnapshot('pending', { ...revision, facts: [] }, { ...revision, items: [item] });
        const restored = snapshot.evaluate(item);
        snapshot.onSnapshot('ready', { ...revision, facts: [restored] }, { ...revision, items: [item] });
        assert.equal(vault.get('test')?.length, 1, 'replacement/undo revision restores complete item ownership');
        snapshot.onSnapshot('pending', { ...revision, accountEpoch: 2, facts: [] }, { ...revision, items: [] });
        snapshot.onSnapshot('ready', { ...revision, accountEpoch: 2, facts: [] }, { ...revision, items: [] });
        assert.equal(vault.size, 0);
        snapshot.onSnapshot('unavailable');
        assert.equal(native.size, 0);
        assert.equal(pending.size, 0);
    });
    await test('A09 cached armor carries presentation', () => { const source = fn('content.ts', 'evaluateSearchItem'); const native = new Map(); const context = { nativeScoreData: native, evaluateArmorItem: () => ({ sheetArmor: { piece2Rating: 'A', piece4Rating: 'S' }, result: { grade: 'A/S' } }), inventorySortItems: new Map(), inventorySortItem: () => ({}), inventorySortSettings: () => ({}), inventoryBadges: { add() { } }, compactSearchData: d => d, normName: s => s.toLowerCase(), aegisMode: 'pve', scoreSettings: {}, chaseList: {}, aegisSheetDb: null, aegisSheetDbPvE: null, aegisSheetDbPvP: null, pendingOwnedInventory: new Map(), nativeOwnedInventory: new Map(), getGradeValue: g => g === 'S' ? 100 : 85, getEnglishWeaponNameFromHash: () => null, getEnglishPerkNameFromHash: () => null }; vm.runInNewContext(transpile(source), context); context.evaluateSearchItem({ id: '42', hash: 1, name: 'Armor', kind: 'armor', perksMap: {} }); assert.equal(native.get('42')?.kind, 'armor'); assert.equal(native.get('42')?.sheetArmor.piece2Rating, 'A'); });
    await test('A08 concurrent grade batches retain both', async () => {
        let state = {};
        const reads = [];
        const writes = [];
        const listeners = {};
        let messages = 0;
        const local = { get: (key, callback) => {
                if (callback)
                    reads.push(() => callback({ lightggData: { ...state } }));
                else
                    return Promise.resolve({ lightggData: { ...state } });
            }, set: (patch, callback) => new Promise(resolve => { writes.push(() => { state = patch.lightggData || state; callback?.(); resolve(); }); }) };
        const background = load('background.ts', { chrome: { storage: { local, onChanged: { addListener() { } } }, runtime: { onMessage: { addListener(f) { listeners.message = f; } }, onInstalled: { addListener() { } }, onStartup: { addListener() { } }, getManifest: () => ({ version: '1' }) }, alarms: { onAlarm: { addListener() { } }, create() { } }, tabs: {} }, fetch: async () => ({ ok: false }) });
        const content = load('lightgg-content.ts', { document: { readyState: 'loading', addEventListener() { }, getElementsByTagName: () => [] }, chrome: { storage: { local }, runtime: { sendMessage: (message, callback) => { messages++; listeners.message(message, { url: 'https://www.light.gg/god-roll/roll-appraiser/' }, callback); } } }, setTimeout: () => 0, setInterval: () => 0 });
        content.saveGrades({ '100000000000000001': 'A' }, 'one');
        const secondTab = load('lightgg-content.ts', { document: content.document, chrome: content.chrome, setTimeout: () => 0, setInterval: () => 0 });
        secondTab.saveGrades({ '100000000000000002': 'S+' }, 'two');
        for (let i = 0; i < 12; i++) {
            reads.splice(0).forEach(f => f());
            writes.splice(0).forEach(f => f());
            await new Promise(r => setImmediate(r));
        }
        assert.equal(state['100000000000000001'], 'A');
        assert.equal(state['100000000000000002'], 'S+');
    });
    await test('A10 external notes and grades are inert text', () => {
        const dom = new JSDOM('<body></body>');
        const globals = { document: dom.window.document, window: dom.window, DOMParser: dom.window.DOMParser, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, requestAnimationFrame: () => 0 };
        const context = { ...globals, exports: {}, escapeHtml: load('external-text.ts').exports.escapeHtml };

        const tooltipSource = ts.createSourceFile('tooltip.ts', src('tooltip.ts'), ts.ScriptTarget.Latest, true);
        const patterns = tooltipSource.statements.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => /(?:_TERMS|_PATTERN)$/.test(declaration.name.getText(tooltipSource)))).map(node => node.getText(tooltipSource)).join('\n');
        vm.runInNewContext(transpile(patterns + '\n' + fn('tooltip.ts', 'highlightKeyTerms') + '\n' + fn('tooltip.ts', 'formatFormattedNotes')), context);

        const notes = '<a style="position:fixed" href="https://attacker.invalid">Click</a><img src="https://attacker.invalid/track">';
        const html = context.exports.formatFormattedNotes(notes);
        const host = dom.window.document.createElement('div');
        host.innerHTML = html;
        assert.equal(host.querySelectorAll('a,img').length, 0);
        assert(host.textContent.includes('<a'));
        host.innerHTML = context.exports.formatFormattedNotes("You're getting 25% damage & solar benefits");
        assert.equal(host.textContent, "You're getting 25% damage & solar benefits");
        assert(host.querySelector('span'), 'trusted numeric/keyword highlight markup remains');
        const main = load('lightgg-main-world.ts', { window: { location: { href: 'https://www.light.gg/' }, fetch: async () => ({}) }, document: { dispatchEvent() { } }, CustomEvent: class {
            }, XMLHttpRequest: class {
                open() { }
                send() { }
            } });
        assert.equal(main.extractGradesFromJson({ '100000000000000001': notes }), null);
    });
    await test('A14 controlled 250ms clone delay does not block original response', async () => {
        let release;
        let emitted = 0;
        const response = { clone: () => ({ text: () => new Promise(resolve => release = resolve) }) };
        const context = load('lightgg-main-world.ts', { window: { location: { href: 'https://www.light.gg/' }, fetch: async () => response }, document: { dispatchEvent() { emitted++; } }, CustomEvent: class {
            }, XMLHttpRequest: class {
                open() { }
                send() { }
            } });
        const started = performance.now();
        const request = context.window.fetch('https://www.light.gg/api/instance');
        const race = await Promise.race([request.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 50))]);
        setTimeout(() => release('{"items":[{"instanceId":"100000000000000001","grade":"S+"}]}'), 250);
        assert.equal(race, true);
        assert.equal(await request, response);
        const nativeElapsed = performance.now() - started;
        assert(nativeElapsed < 100);
        console.log('A14 measured original response: ' + nativeElapsed.toFixed(2) + ' ms; controlled cloned body delay: 250 ms');
        await new Promise(resolve => setTimeout(resolve, 280));
        assert.equal(emitted, 1);
    });
    await test('A04 duplicate same-name edition rows preserved in refresh and generator', async () => {
        const { scoreRowMetadata } = await import('../scripts/score-sync.mjs');
        const rows = [['Name', 'Frame', 'Tier'], ['Same Name', 'Adaptive Frame', 'S'], ['Same Name', 'Rapid-Fire Frame', 'A']];
        const context = { exports: {}, console, scoreRowMetadata, fetchHtmlViewMetadata: async () => ({ Autos: '1' }), fetchTabRows: async () => rows, fetch: async () => ({ ok: false }), ARMOR_SHEET_ID: 'armor', ARMOR_GID: '1' };
        vm.runInNewContext(transpile(['normName', 'stripEdition', 'extractVersionTag', 'fetchSpreadsheetDatabase'].map(n => fn('background.ts', n)).join('\n')), context);
        const db = await context.fetchSpreadsheetDatabase('pve', ['Autos']);
        assert.equal(db.variants['same name'].length, 2);
        vm.runInNewContext(fn('../scripts/sync-sheets-cron.mjs', 'parseWeaponRows'), context);
        const variants = {}, weapons = {}, categories = {};
        context.parseWeaponRows(rows, 'Autos', weapons, variants, categories);
        assert.equal(variants['same name'].length, 2);
    });
    await test('A03 malformed channels rejected and full successful refresh commits timestamps', async () => {
        const fresh = { weapons: { fresh: { name: 'Fresh' } }, categories: { Autos: [] } };
        const shopping = { items: [{ name: 'Fresh shopping' }], byName: {}, alternativesMap: {} };
        const complete = await refresh(fresh, fresh, shopping);
        assert.equal(complete.result.success, true);
        assert(complete.state.aegisSheetLastSync > 123);
        const malformed = await refresh({ weapons: { broken: 'invalid' }, categories: {} }, empty, shopping);
        assert.equal(malformed.result.success, false);
        assert.equal(malformed.state.aegisSheetDbPvE, oldPve);
        assert.equal(malformed.state.aegisShoppingDbPvE, shopping);
    });
    await test('A09 restored armor badge and provider publish A/S before annotation', () => {
        const dom = new JSDOM('<main role="main"><div class="store-row"><div class="item-drag-container"><div class="item" id="42"></div></div></div></main>');
        const globals = { document: dom.window.document, window: dom.window, HTMLElement: dom.window.HTMLElement, MutationObserver: dom.window.MutationObserver, modules: { './stat-grade': { STAT_BAR_SELECTOR: '[data-aegis-stat-bar]', INVENTORY_BADGE_SELECTOR: '.aegis-badge' }, './compare-selectors': { COMPARE_BUCKET_SELECTOR: '.compare' } } };
        const badgeContext = { exports: {}, document: dom.window.document, CSS: { supports: () => true }, Element: dom.window.Element, IS_WINNOWER_HOST: false, scoresEnabled: () => true, scorePresentation: () => ({ html: '<span>–</span>', label: 'Unrated' }), badgeTemplates: new Map(), aegisMode: 'pve', scoreSettings: {}, aegisShowPerfectStar: true, aegisShowOmniStar: true, aegisBadgePosition: 'bottom-left', aegisBadgeStyle: 'classic', aegisFadeHover: false, aegisUpgradeStyle: 'none', getGradeValue: g => g === 'S' ? 100 : 85, rollBadgeSymbol: () => '', safeSetInnerHTML: (el, html) => { el.innerHTML = html; }, weaponDataMap: new WeakMap(), nativeScoreData: new Map(), inventoryGradeAppearance: text => ({ color: text === 'A/S' ? 'gold' : 'red', gradient: null }) };
        vm.runInNewContext(transpile(fn('content.ts', 'getBadgeTemplate') + '\n' + fn('content.ts', 'publishInventoryGrade')), badgeContext);
        const cache = load('inventory-badges.ts', globals).exports.createInventoryBadges((tile, badge) => {
            const template = badgeContext.getBadgeTemplate(badge.result, 'classic', badge.presentation);
            assert.equal(template.textContent, 'A/S');
            assert.equal(template.classList.contains('aegis-score'), false);
            badgeContext.publishInventoryGrade(tile, badge.result, badge.presentation);
        });
        cache.status('pending');
        cache.add({ id: '42', hash: 1, kind: 'armor' }, { grade: 'A/S' }, { sheetArmor: { piece2Rating: 'A', piece4Rating: 'S' } });
        cache.status('ready');
        const published = JSON.parse(dom.window.document.getElementById('42').getAttribute('data-aegis-inventory-grade'));
        assert.equal(published.labels[0].text, 'A/S');
        cache.dispose();
        dom.window.close();
    });
    await test('A10 direct tooltip keeps trusted structure while external notes/grades stay text', () => {
        const dom = new JSDOM('<body><div id="host"></div></body>');
        const host = dom.window.document.getElementById('host');
        const context = { exports: {}, document: dom.window.document, escapeHtml: load('external-text.ts').exports.escapeHtml, renderShoppingBannerHtml: () => '', t: key => key, renderLocalizedName: (_type, name) => name, safeSetInnerHTML: (el, html) => { el.innerHTML = html; } };
        vm.runInNewContext(transpile(fn('tooltip.ts', 'showTooltip')), context);
        const hostile = '<a style="position:fixed" href="https://attacker.invalid">Click</a><img src="https://attacker.invalid/track">';
        context.exports.showTooltip(host, { grade: hostile, notes: hostile, wishlistNotes: hostile, wishlistPerks: [], matchedPerks: [], missingPerks: [] }, 'Weapon', {}, [], true, null, undefined, false, null, {}, null, null, 'pve', 'sheet', null, null, { contentHost: host });
        assert.equal(host.querySelectorAll('a,img').length, 0);
        assert.equal(host.querySelector('.aegis-tooltip-grade').textContent, hostile);
        assert.equal(host.querySelector('.aegis-tooltip-notes-text').textContent, hostile);
        assert(host.querySelector('.aegis-tooltip-header'));
        assert(host.querySelector('.aegis-tooltip-perks-grid'));
        dom.window.close();
        const normalize = load('external-text.ts').exports.normalizeLightggData;
        const grades = normalize({ '100000000000000001': ' s+ ', '100000000000000002': hostile, 'bad': 'A', '100000000000000003': 'Best A' });
        assert.deepEqual(JSON.parse(JSON.stringify(grades)), { '100000000000000001': 'S+' });
    });
    await test('A14 clone rejection and foreign hosts leave native fetch intact', async () => {
        let inspected = 0;
        const response = { clone: () => { inspected++; return { text: () => Promise.reject(new Error('controlled body failure')) }; } };
        const context = load('lightgg-main-world.ts', { window: { location: { href: 'https://www.light.gg/' }, fetch: async () => response }, document: { dispatchEvent() { throw new Error('invalid grades emitted'); } }, CustomEvent: class {
            }, XMLHttpRequest: class {
                open() { }
                send() { }
            } });
        assert.equal(await context.window.fetch('https://www.light.gg/api/test'), response);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(await context.window.fetch('https://light.gg.attacker.invalid/api/test'), response);
        assert.equal(inspected, 1);
    });
    await test('A05 actual search lifecycle rejects stale account snapshot and disposal', async () => {
        const dom = new JSDOM('<html><body></body></html>');
        const globals = { document: dom.window.document, window: dom.window, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, MessageChannel };
        const bridge = load('search-bridge.ts', globals).exports;
        const ready = [];
        const snapshots = [];
        const evaluator = bridge.initSearchEvaluator(item => ({ id: item.id, hash: item.hash, data: {}, context: {} }), () => true, () => ({}), () => ({}), () => { }, (status, response, request) => {
            snapshots.push(status);
            if (status === 'ready')
                ready.push({ response, request });
        });
        const revision = { session: 'native', accountEpoch: 1, inventoryRevision: 1, evaluationRevision: 1 };
        const make = (id) => ({ id: String(id), hash: id, ready: true });
        bridge.publishSearchMessage(bridge.SEARCH_REQUEST, { ...revision, inventoryReady: true, items: Array.from({ length: 51 }, (_, i) => make(i + 1)) });
        bridge.publishSearchMessage(bridge.SEARCH_REQUEST, { ...revision, accountEpoch: 2, inventoryReady: true, items: [make(100)] });
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(ready.length, 1);
        assert.equal(ready[0].request.accountEpoch, 2);
        assert.equal(ready[0].response.facts[0].id, '100');
        bridge.publishSearchMessage(bridge.SEARCH_REQUEST, { ...revision, accountEpoch: 3, inventoryReady: true, items: Array.from({ length: 51 }, (_, i) => make(i + 1)) });
        evaluator.dispose();
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(ready.length, 1);
        assert.equal(snapshots.at(-1), 'unavailable');
        dom.window.close();
    });

    await test('A05 follow-up open Shopping audit rerenders complete and cleared ownership', () => {
        const sf = ts.createSourceFile('content.ts', src('content.ts'), ts.ScriptTarget.Latest, true);
        const declaration = sf.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(value => value.name.getText(sf) === 'nativeSearchEvaluator'));
        let snapshot;
        const auditDom = new JSDOM('<div class="aegis-explorer-panel open"></div>');
        const auditPanel = auditDom.window.document.querySelector('.aegis-explorer-panel');
        const rendered = [];
        const owned = new Map();
        const vault = new Map();
        const context = { explorerUi: { panel: auditPanel }, IS_WINNOWER_HOST: false, initSearchEvaluator: (_evaluate, _ready, _available, _cache, _status, onSnapshot) => { snapshot = onSnapshot; }, evaluateSearchItem: () => ({}), nativeOwnedInventory: owned, nativeScoreData: new Map(), playerVaultInventory: vault, inventorySortItems: new Map(), inventorySortProvider: { publish() {} }, normName: value => value.toLowerCase().trim(), getEnglishWeaponNameFromHash: () => null, getEnglishPerkNameFromHash: () => null, document: auditDom.window.document, renderResults: () => rendered.push(vault.get('test')?.length || 0) };
        vm.runInNewContext(transpile(fn('content.ts', 'getOpenExplorerPanel') + '\n' + declaration.getText(sf)), context);
        snapshot('pending', { facts: [] }, { items: [] });
        assert.deepEqual(rendered, [0], 'pending account state immediately clears visible old Shopping counts');
        owned.set('1', { name: 'Test', grade: 'S+', hash: 1, instanceId: '1', data: {} });
        snapshot('ready', { facts: [{ id: '1', hash: 1 }] }, { items: [{ id: '1', hash: 1, name: 'Test' }] });
        assert.equal(vault.get('test').length, 1);
        assert.deepEqual(rendered, [0, 1], 'complete READY snapshot repaints the already open audit without tile mounting');
        snapshot('unavailable');
        assert.deepEqual(rendered, [0, 1, 0], 'disposal/unavailability repaints cleared ownership');
        auditPanel.classList.remove('open');
        snapshot('pending');
        assert.deepEqual(rendered, [0, 1, 0], 'hidden audit does not incur rendering');
        auditDom.window.close();
    });
    await test('A03 follow-up slow refresh uses mode saved at commit for active aliases', async () => {
        let release;
        let began;
        const barrier = new Promise(resolve => release = resolve);
        const started = new Promise(resolve => began = resolve);
        const pveShopping = { items: [{ name: 'PvE shopping' }], byName: {}, alternativesMap: {} };
        const pvpShopping = { items: [{ name: 'PvP shopping' }], byName: {}, alternativesMap: {} };
        const pve = { weapons: { pve: { name: 'PvE weapon' } }, categories: {}, shopping: pveShopping };
        const pvp = { weapons: { pvp: { name: 'PvP weapon' } }, categories: {}, shopping: pvpShopping };
        const state = { aegisMode: 'pve', aegisSheetDbPvE: oldPve, aegisSheetDbPvP: oldPvp, aegisSheetDb: oldPve };
        const context = { sheetSync: undefined, sheetFailureMessage: load('sync-feedback.ts').exports.sheetFailureMessage, console, Date, Promise, Object, PVE_DB_CDN_URL: 'pve', PVP_DB_CDN_URL: 'pvp', SHEET_ID: 'pve', PVP_SHEET_ID: 'pvp', ALL_TABS: [], fetchAndCachePerkRatings: async () => {}, fetchWithTimeout: async url => { began(); await barrier; return { ok: true, json: async () => url === 'pve' ? pve : pvp }; }, fetchSpreadsheetDatabase: async () => { throw Error('Unexpected direct fallback'); }, fetchShoppingListDatabase: async () => { throw Error('Unexpected shopping fallback'); }, chrome: { storage: { local: { get: async () => ({ ...state }), set: async patch => Object.assign(state, patch) } } } };
        vm.runInNewContext(transpile(fn('background.ts', 'fetchAndCacheAegisSheet')), context);
        const refresh = context.fetchAndCacheAegisSheet();
        await started;
        state.aegisMode = 'pvp';
        release();
        const result = await refresh;
        assert.equal(result.success, true);
        assert.equal(state.aegisMode, 'pvp');
        assert.equal(state.aegisSheetDb, pvp, 'latest PvP mode selects the PvP weapon alias');
        assert.equal(state.aegisShoppingDb, pvpShopping, 'latest PvP mode selects the PvP shopping alias');
    });
    if (results.some(result => !result))
        process.exitCode = 1;
})();
