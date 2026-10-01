(async () => {
  const runtime = AegisSearchProbe.discoverDimSearch();
  if (!runtime)
    throw Error('DIM runtime discovery failed');
  const p = { store: runtime.store, searchModule: Object.fromEntries(runtime.selectors.map((selector, index) => [index, selector])) };
  const selectors = Object.values(p.searchModule).filter(v => typeof v === 'function' && v.resultFunc);
  const select = pred => selectors.find(fn => pred(String(fn.resultFunc)));
  p.filtered = select(s => s.includes('.location.hash') && s.includes('.filter('));
  p.valid = select(s => s.endsWith('.valid'));
  p.fibers = () => { const found = [], seen = new Set(); for (const el of document.querySelectorAll('body > div')) {
    const key = Object.keys(el).find(k => k.startsWith('__reactContainer$'));
    const root = key && el[key];
    const q = root ? [root.stateNode?.current || root] : [];
    while (q.length && seen.size < 100000) {
      const f = q.pop();
      if (!f || seen.has(f))
        continue;
      seen.add(f);
      found.push(f);
      if (f.child)
        q.push(f.child);
      if (f.sibling)
        q.push(f.sibling);
    }
  } return found; };
  const wait = () => new Promise(r => setTimeout(r, 300));
  const check = (v, m) => { if (!v)
    throw Error(m); };
  const ids = items => items.map(i => i.id).sort().join(',');
  const query = q => {
    window.__nativeSearchStage = 'Query: ' + q;
    return p.store.dispatch({ type: 'shell/SEARCH_QUERY', payload: { query: q, updateVersion: true } });
  };
  const menu = () => p.fibers().map(f => f.memoizedProps).find(v => Array.isArray(v?.options) && v.options.some(o => o.key === 'lock-item'));
  const actions = () => p.fibers().map(f => f.memoizedProps).find(v => v?.searchActive !== undefined && Array.isArray(v.filteredItems) && v.searchQuery === p.store.getState().shell.searchQuery);
  const waitForQuery = async expected => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (document.querySelector('input[name=filter]').value === expected && p.store.getState().shell.searchQuery === expected) return;
      await wait();
    }
    throw Error('Widget query did not settle: ' + p.store.getState().shell.searchQuery);
  };
  query('(is:weapon OR is:armor) AND aegis:god');
  await waitForQuery('(is:weapon OR is:armor) AND aegis:god');
  const badgeDeadline = Date.now() + 10000;
  while (!document.querySelector('.aegis-search-token-remove[aria-label="Remove is:weapon"]') && Date.now() < badgeDeadline) await wait();
  document.querySelector('.aegis-search-token-remove[aria-label="Remove is:weapon"]').click();
  await waitForQuery('is:armor aegis:god');
  check(p.valid(p.store.getState()), 'Badge removal keeps a valid native query');
  check(document.querySelectorAll('.aegis-inline-search').length === 1, 'Exactly one inline editor is mounted');
  query('is:weapon or is:armor');
  await waitForQuery('is:weapon or is:armor');
  document.querySelector('.aegis-search-widget-btn').click();
  document.querySelector('[data-shortcut="aegis:god"]').click();
  await waitForQuery('(is:weapon or is:armor) aegis:god');
  // Click before DIM's typing debounce commits, preserving the visible draft.
  const draftInput = document.querySelector('input[name=filter]');
  const draftProps = Object.keys(draftInput).find(key => key.startsWith('__reactProps$'));
  draftInput.value = 'aegis:upgrade or is:armor';
  draftInput[draftProps].onChange({ target: draftInput, currentTarget: draftInput, nativeEvent: { isComposing: false }, preventDefault() {}, stopPropagation() {}, persist() {} });
  document.querySelector('.aegis-search-widget-btn').click();
  const filterMenu = document.querySelector('.aegis-search-widget-menu');
  const pin = document.querySelector('.aegis-menu-pin');
  pin.click();
  check(pin.getAttribute('aria-pressed') === 'true', 'Pin exposes its active state');
  document.querySelector('.aegis-grade-btn[data-grade="a"]').click();
  await waitForQuery('(aegis:upgrade or is:armor) aegis:p:>=a');
  await new Promise(resolve => setTimeout(resolve, 1200));
  check(p.store.getState().shell.searchQuery === '(aegis:upgrade or is:armor) aegis:p:>=a', 'Old typing debounce cannot overwrite the appended filter');
  check(!filterMenu.classList.contains('hidden'), 'Pinned menu stays open after selecting a grade');
  document.querySelector('.aegis-grade-btn[data-grade="s"]').click();
  await waitForQuery('(aegis:upgrade or is:armor) aegis:p:>=s');
  document.querySelector('[data-group="target"] [data-value="weapon"]').click();
  document.querySelector('.aegis-grade-btn[data-grade="a"]').click();
  await waitForQuery('(aegis:upgrade or is:armor) aegis:p:>=s aegis:w:>=a');
  const sourceInput = document.querySelector('.aegis-widget-source-input');
  sourceInput.value = 'deep stone crypt';
  sourceInput.dispatchEvent(new Event('input', { bubbles: true }));
  check(p.store.getState().shell.searchQuery === '(aegis:upgrade or is:armor) aegis:p:>=s aegis:w:>=a', 'Source typing does not append partial filters');
  sourceInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await waitForQuery('(aegis:upgrade or is:armor) aegis:p:>=s aegis:w:>=a aegis:"source:deep stone crypt"');
  sourceInput.value = "king's fall";
  sourceInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await waitForQuery('(aegis:upgrade or is:armor) aegis:p:>=s aegis:w:>=a aegis:"source:king\'s fall"');
  document.body.click();
  check(!filterMenu.classList.contains('hidden'), 'Pinned menu stays open on outside clicks');
  document.querySelector('.aegis-menu-clear-btn').click();
  await waitForQuery('');
  check(!filterMenu.classList.contains('hidden'), 'Pinned clear lets you start another search');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check(filterMenu.classList.contains('hidden'), 'Escape closes a pinned menu');
  document.querySelector('.aegis-search-widget-btn').click();
  pin.click();
  document.body.click();
  check(filterMenu.classList.contains('hidden'), 'Unpinned menu closes on outside clicks');
  query('aegis:god');
  await waitForQuery('aegis:god');
  const saveButton = [...document.querySelector('input[name=filter]').parentElement.querySelectorAll('button')]
    .find(button => button.querySelector('.fa-star, .fa-star-o, .fa-star-half-alt') || /save search/i.test(button.title));
  const saveSearchButton = saveButton && { title: saveButton.title, aegisOwned: !!saveButton.closest('.aegis-search-widget'), markup: saveButton.innerHTML };
  const god = p.filtered(p.store.getState());
  const pair = god.filter(i => i.typeName === god[0].typeName).slice(0, 2);
  check(pair.length === 2, 'Need two comparable matches');
  const q = `aegis:god and (id:${pair[0].id} or id:${pair[1].id})`;
  query(q);
  await wait();
  const menuDeadline = Date.now() + 15000;
  while (ids(actions()?.filteredItems || []) !== ids(pair) && Date.now() < menuDeadline)
    await wait();
  check(ids(actions()?.filteredItems || []) === ids(pair), 'Native actions membership: ' + (actions()?.filteredItems.length ?? 'missing') + ' actions, ' + p.filtered(p.store.getState()).length + ' results, valid=' + p.valid(p.store.getState()));
  check(document.querySelector('input[name=filter]').value === q, 'Native query text');
  menu().options.find(o => o.key === 'compare').onSelected();
  await wait();
  check(p.store.getState().compare.session?.query === q, 'Compare saved native query');
  let compareIds = [];
  const compareDeadline = Date.now() + 15000;
  do {
    const rows = p.fibers().map(f => f.memoizedProps?.rows).find(rows => Array.isArray(rows) && rows.length && rows.every(row => row.item?.id));
    compareIds = (rows || []).map(row => row.item.id);
    if (compareIds.length)
      break;
    await wait();
  } while (Date.now() < compareDeadline);
  check(pair.every(item => compareIds.includes(item.id)) && compareIds.every(id => pair.some(item => item.id === id)), 'Compare rendered exact targets: ' + compareIds.length + ' rows for ' + pair.length + ' expected');
  p.store.dispatch({ type: 'compare/END_SESSION' });
  await wait();
  const strip = menu().options.find(o => o.key === 'strip-sockets');
  check(strip && !strip.disabled, 'Strip preview available');
  strip.onSelected();
  await wait();
  const choose = p.fibers().find(f => f.memoizedProps?.query === q && typeof f.memoizedProps.reportSockets === 'function');
  check(choose, 'Strip independent query');
  let close;
  for (let f = choose; f; f = f.return)
    if (typeof f.memoizedProps?.onClose === 'function' && f.memoizedProps.footer) {
      close = f.memoizedProps.onClose;
      break;
    }
  const socketActions = [];
  for (let hook = choose.memoizedState; hook; hook = hook.next) {
    const memo = hook.memoizedState;
    if (Array.isArray(memo) && Array.isArray(memo[0]) && memo[0].some(k => Array.isArray(k?.items) && k.items.some(a => a.item && Number.isInteger(a.socketIndex))))
      socketActions.push(...memo[0].flatMap(k => k.items));
  }
  check(socketActions.length > 0 && socketActions.every(a => pair.some(i => i.id === a.item.id)), 'Strip preview targets');
  // Make a real preview selection, then invalidate while the dialog remains mounted.
  choose.memoizedProps.reportSockets(socketActions.slice(0, 1));
  await wait();
  const responseNode = document.getElementById('aegis-native-search-response');
  const original = JSON.parse(responseNode.textContent);
  responseNode.textContent = JSON.stringify({ ...original, status: 'pending', facts: [] });
  document.dispatchEvent(new Event('aegis-native-search-response'));
  await wait();
  check(!p.valid(p.store.getState()) && p.filtered(p.store.getState()).length === 0, 'Pending mounted consumer invalidates');
  responseNode.textContent = JSON.stringify(original);
  document.dispatchEvent(new Event('aegis-native-search-response'));
  await wait();
  check(close, 'Close preview found');
  close();
  await wait();
  // Pending native keystrokes must survive a ratings refresh.
  query('aegis:god');
  await wait();
  const input = document.querySelector('input[name=filter]');
  const key = Object.keys(input).find(k => k.startsWith('__reactProps$'));
  const draft = 'aegis:god and is:weapon';
  input.value = draft;
  input[key].onChange({ target: input, currentTarget: input, nativeEvent: { isComposing: false }, preventDefault() { }, stopPropagation() { }, persist() { } });
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
  responseNode.textContent = JSON.stringify(original);
  document.dispatchEvent(new Event('aegis-native-search-response'));
  await new Promise(r => setTimeout(r, 650));
  check(input.value === draft && p.store.getState().shell.searchQuery === draft, 'Pending typed query survives');
  const facts = original.facts;
  const observed = [];
  for (const tile of document.querySelectorAll('.sub-bucket [data-aegis-instance-id]')) {
    const badge = tile.querySelector('.aegis-badge');
    const fact = facts.find(f => f.id === tile.dataset.aegisInstanceId);
    if (badge && fact)
      observed.push({ grade: fact.data.result.grade, badge: badge.textContent });
  }
  return { passed: true, checks: ['widget replaces matching targets and combines different targets', 'pin, outside click, Escape, and clear', 'pending edits preserved', 'native actions', 'Compare native query', 'Strip Sockets preview', 'open preview pending transition', 'typed input with Tab and blur'], saveSearchButton, socketPreviewActions: socketActions.length, observed: observed.slice(0, 30), observedCount: observed.length };
})()
