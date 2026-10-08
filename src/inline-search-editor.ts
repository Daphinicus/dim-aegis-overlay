import { t, getCurrentLanguage, LANGUAGE_CHANGE_EVENT } from './i18n';
import { findNativeSearchInput, isNativeSearchInput } from './native-search-input';
import { removeSearchTerm, tokenizeSearch, type SearchToken } from './search-syntax';
import { isNativeSearchTermValid } from './dim-search-adapter';
import { normalizeSearchDisplay, readableSearchTerm, SEARCH_DISPLAY_ATTRIBUTE, type SearchDisplayMode } from './search-display';

type SelectionState = { anchor: number; focus: number };
type Badge = { start: number; end: number; text: string };
type Snapshot = { query: string; selection: SelectionState; badges: Badge[]; committedTerms: Badge[] };
type Segment = { node: Node; token: SearchToken; badge: boolean };

function nativeProps(input: HTMLInputElement): Record<string, any> | undefined {
  const key = Object.keys(input).find(key => key.startsWith('__reactProps$'));
  return key ? (input as unknown as Record<string, any>)[key] : undefined;
}
function supportedInput(input: HTMLInputElement): boolean {
  const props = nativeProps(input);
  return typeof props?.onChange === 'function' && typeof props?.onKeyDown === 'function';
}

/** Keep DIM's input and React handlers authoritative behind an inline editor. */
export function attachInlineSearchEditor(input: HTMLInputElement, validTerm = isNativeSearchTermValid, initialMode: SearchDisplayMode = 'exact') {
  if (!isNativeSearchInput(input) || !supportedInput(input)) return Object.assign(() => {}, { setMode(_mode: SearchDisplayMode) {} });
  let mode = initialMode, pendingMode: SearchDisplayMode | undefined;
  const editor = document.createElement('div');
  editor.className = 'aegis-inline-search';
  editor.contentEditable = 'true';
  editor.spellcheck = false;
  editor.setAttribute('role', 'combobox');
  editor.setAttribute('aria-multiline', 'false');
  editor.setAttribute('aria-autocomplete', 'list');
  editor.setAttribute('data-placeholder', input.placeholder);
  editor.setAttribute('aria-label', input.getAttribute('aria-label') || input.placeholder || 'Search');
  const originalTabIndex = input.getAttribute('tabindex');
  const originalHidden = input.getAttribute('aria-hidden');
  const originalMarker = input.getAttribute('data-aegis-native-search');
  // React owns className and replaces it when DIM toggles query validity.
  function nativeVisibility(hidden: boolean) {
    if (hidden) {
      input.setAttribute('data-aegis-native-search', 'true');
      input.tabIndex = -1; input.setAttribute('aria-hidden', 'true');
    } else {
      if (originalMarker === null) input.removeAttribute('data-aegis-native-search'); else input.setAttribute('data-aegis-native-search', originalMarker);
      if (originalTabIndex === null) input.removeAttribute('tabindex'); else input.setAttribute('tabindex', originalTabIndex);
      if (originalHidden === null) input.removeAttribute('aria-hidden'); else input.setAttribute('aria-hidden', originalHidden);
    }
    editor.hidden = hidden === false;
  }
  nativeVisibility(mode !== 'classic');
  input.after(editor);

  const controller = new AbortController(), options = { signal: controller.signal };
  let query = input.value, composing = false, forwarding = false, completing = false, disposed = false;
  let nativeValue = input.value;
  const undo: Snapshot[] = [], redo: Snapshot[] = [];
  let badges: Badge[] = [];
  let committedTerms: Badge[] = [];
  let segments: Segment[] = [];
  const caretTail = document.createTextNode('');
  let scrollFrame = 0;
  let beforeNativeEdit: SelectionState | undefined;
  const props = () => nativeProps(input);
  const read = (node: Node): string => {
    if (node instanceof Element && node.hasAttribute('data-search-remove')) return '';
    if (node instanceof HTMLElement && node.dataset.searchRaw !== undefined) return node.dataset.searchRaw;
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node instanceof HTMLBRElement) return ' ';
    return [...node.childNodes].map(read).join('');
  };
  const offset = (node: Node, at: number): number => {
    const badge = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('.aegis-search-token');
    if (badge && editor.contains(badge)) {
      const start = Number(badge.dataset.start), end = Number(badge.dataset.end);
      if (node === badge && at === badge.childNodes.length) return end;
      return at === 0 ? start : Math.min(end - 1, start + at);
    }
    let total = node.nodeType === Node.TEXT_NODE ? at : [...node.childNodes].slice(0, at).reduce((length, child) => length + read(child).length, 0);
    for (let current: Node | null = node; current && current !== editor; current = current.parentNode) {
      for (let sibling = current.previousSibling; sibling; sibling = sibling.previousSibling) total += read(sibling).length;
    }
    return total;
  };
  const selection = (): SelectionState => {
    if (mode === 'classic') {
      const start = input.selectionStart ?? query.length, end = input.selectionEnd ?? start;
      return input.selectionDirection === 'backward' ? { anchor: end, focus: start } : { anchor: start, focus: end };
    }
    const selected = document.getSelection();
    if (!selected?.anchorNode || !selected.focusNode || !editor.contains(selected.anchorNode) || !editor.contains(selected.focusNode)) {
      return { anchor: query.length, focus: query.length };
    }
    let anchor = offset(selected.anchorNode, selected.anchorOffset);
    let focus = selected.isCollapsed ? anchor : offset(selected.focusNode, selected.focusOffset);
    const collapsed = anchor === focus, forward = anchor <= focus;
    for (const badge of badges) {
      if (anchor > badge.start && anchor < badge.end) anchor = collapsed || !forward ? badge.end : badge.start;
      if (focus > badge.start && focus < badge.end) focus = collapsed || forward ? badge.end : badge.start;
    }
    return { anchor, focus };
  };
  const point = (at: number): [Node, number] => {
    let start = 0, index = 0;
    for (const node of editor.childNodes) {
      const length = read(node).length;
      if (at <= start + length) {
        if (node instanceof HTMLElement && node.dataset.searchRaw !== undefined) return [editor, at === start ? index : index + 1];
        const text = node instanceof Text ? node : node.firstChild;
        return text ? [text, Math.max(0, at - start)] : [editor, index];
      }
      start += length; index++;
    }
    return [editor, editor.childNodes.length];
  };
  function restore(saved: SelectionState) {
    if (mode === 'classic') {
      input.setSelectionRange(Math.min(saved.anchor, saved.focus), Math.max(saved.anchor, saved.focus), saved.anchor > saved.focus ? 'backward' : 'forward');
      return;
    }
    const selected = document.getSelection();
    if (!selected) return;
    const [a, ao] = point(saved.anchor), [f, fo] = point(saved.focus);
    selected.setBaseAndExtent(a, ao, f, fo);
    // Layout reads immediately after editing force a synchronous reflow. Only
    // check scrolling once per frame, and only measure the caret on overflow.
    if (!scrollFrame) scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (disposed || mode === 'classic' || document.activeElement !== editor || editor.scrollWidth <= editor.clientWidth) return;
      const current = document.getSelection();
      if (!current?.rangeCount || !editor.contains(current.focusNode)) return;
      const range = document.createRange();
      range.setStart(current.focusNode!, current.focusOffset); range.collapse(true);
      let caret: { left: number; right: number };
      const after = current.focusNode === editor ? editor.childNodes[current.focusOffset] : undefined;
      const before = current.focusNode === editor ? editor.childNodes[current.focusOffset - 1] : undefined;
      // A collapsed range between immutable badges can have an empty rectangle.
      // Use the adjacent badge edge, including when Home selects the first one.
      if (after instanceof Element) {
        const left = after.getBoundingClientRect().left; caret = { left, right: left };
      } else if (before instanceof Element) {
        const right = before.getBoundingClientRect().right; caret = { left: right, right };
      } else caret = range.getBoundingClientRect();
      const bounds = editor.getBoundingClientRect();
      if (caret.right > bounds.right) editor.scrollLeft += caret.right - bounds.right + 8;
      else if (caret.left < bounds.left) editor.scrollLeft -= bounds.left - caret.left + 8;
    });
  }
  function render(saved?: SelectionState, commit = false) {
    if (mode === 'classic') { if (saved) restore(saved); return; }
    const previous = committedTerms, previousBadges = badges;
    committedTerms = [];
    badges = [];
    const key = (token: SearchToken, badge: boolean) => `${badge ? 'badge' : token.kind}:${token.text}`;
    const available = new Map<string, Segment[]>();
    for (const segment of segments) {
      const id = key(segment.token, segment.badge);
      const matches = available.get(id) || []; matches.push(segment); available.set(id, matches);
    }
    const next = tokenizeSearch(query).map(token => {
      const drafting = saved && saved.focus > token.start && saved.focus <= token.end;
      const committed = commit || (token.end < query.length && !drafting) || previous.some(badge => badge.start === token.start && badge.text === token.text);
      if (token.kind === 'term' && token.complete && committed) committedTerms.push(token);
      const wasBadge = previousBadges.some(badge => badge.start === token.start && badge.text === token.text);
      const badge = token.kind === 'term' && token.complete && !!committed && (wasBadge || validTerm(token.text));
      if (badge) badges.push(token);
      return { token, badge, node: available.get(key(token, badge))?.shift()?.node };
    });
    const used = new Set(next.map(segment => segment.node));
    for (const segment of next) {
      const { token, badge } = segment;
      // Reuse the draft's text node as it grows. Stable badges keep their nodes,
      // buttons, and positions instead of being detached on every character.
      if (!segment.node && !badge) {
        const old = segments.find(old => !old.badge && old.token.kind === token.kind && !used.has(old.node));
        if (old) { segment.node = old.node; used.add(old.node); }
      }
      if (!segment.node) {
        segment.node = token.kind === 'space' ? document.createTextNode(token.text) : document.createElement('span');
        if (segment.node instanceof HTMLElement) {
          const span = segment.node;
          if (badge) {
            const label = document.createElement('span'); label.className = 'aegis-search-token-label'; span.append(label);
          } else span.append(document.createTextNode(token.text));
          span.className = badge ? 'aegis-search-token' : `aegis-search-${token.kind}`;
          if (badge) {
            span.contentEditable = 'false';
            span.dataset.kind = /^aegis:/i.test(token.text) ? 'aegis' : 'dim';
            const remove = document.createElement('button');
            remove.type = 'button'; remove.contentEditable = 'false'; remove.tabIndex = -1;
            remove.className = 'aegis-search-token-remove';
            remove.setAttribute('aria-label', t('searchRemoveTerm', { term: token.text }));
            remove.textContent = '×'; span.append(remove);
          }
        }
      }
      const text = segment.node instanceof Text ? segment.node : segment.node.firstChild;
      // IME and browser editing can split a draft into multiple child nodes.
      // Normalize only that draft; normal typing updates its existing text node.
      if (!badge && segment.node instanceof HTMLElement &&
          (!(text instanceof Text) || segment.node.childNodes.length !== 1)) {
        segment.node.replaceChildren(document.createTextNode(token.text));
      } else if (text instanceof Text && text.data !== token.text) text.data = token.text;
      if (badge && segment.node instanceof HTMLElement) {
        const span = segment.node, remove = span.lastElementChild as HTMLElement;
        if (span.dataset.display !== mode || span.dataset.searchRaw !== token.text || span.dataset.language !== getCurrentLanguage()) {
          span.dataset.language = getCurrentLanguage(); span.dataset.display = mode; span.dataset.searchRaw = token.text; span.title = token.text;
          const presentation = mode === 'readable' ? readableSearchTerm(token.text) : { text: token.text };
          const label = span.querySelector<HTMLElement>('.aegis-search-token-label')!;
          label.replaceChildren();
          const operatorAt = presentation.operator ? presentation.text.indexOf(presentation.operator) : -1;
          if (operatorAt >= 0) {
            const strong = document.createElement('strong'); strong.textContent = presentation.operator!;
            label.append(presentation.text.slice(0, operatorAt), strong, presentation.text.slice(operatorAt + presentation.operator!.length));
          } else label.textContent = presentation.text;
          span.querySelector('.aegis-search-token-icon')?.remove();
          if (presentation.icon) {
            const icon = document.createElement('img'); icon.className = 'aegis-search-token-icon';
            icon.src = presentation.icon; icon.alt = ''; icon.setAttribute('aria-hidden', 'true'); icon.draggable = false;
            icon.addEventListener('error', () => { icon.hidden = true; }, { once: true });
            span.prepend(icon);
          }
        }
        if (span.dataset.start !== String(token.start)) span.dataset.start = String(token.start);
        if (span.dataset.end !== String(token.end)) span.dataset.end = String(token.end);
        remove.setAttribute('aria-label', t('searchRemoveTerm', { term: token.text }));
        remove.title = t('searchRemoveTerm', { term: token.text });
        if (remove.dataset.searchRemove !== String(token.start)) remove.dataset.searchRemove = String(token.start);
      }
    }
    segments = next as Segment[];
    // Native composition may use the empty tail as its insertion point. Its
    // contents are now represented by segments, so do not append them twice.
    if (caretTail.data) caretTail.data = '';
    let cursor = editor.firstChild;
    for (const node of [...segments.map(segment => segment.node), caretTail]) {
      if (node === cursor) cursor = cursor.nextSibling;
      else editor.insertBefore(node, cursor);
    }
    while (cursor) { const next = cursor.nextSibling; cursor.remove(); cursor = next; }
    if (editor.dataset.empty !== String(!query)) editor.dataset.empty = String(!query);
    if (saved) restore(saved);
  }
  function forward(name: string, event: Event, selected = selection()) {
    const handler = props()?.[name];
    if (typeof handler !== 'function') return;
    input.setSelectionRange(Math.min(selected.anchor, selected.focus), Math.max(selected.anchor, selected.focus));
    handler({ target: input, currentTarget: input, nativeEvent: event, type: event.type,
      key: (event as KeyboardEvent).key, code: (event as KeyboardEvent).code,
      altKey: (event as KeyboardEvent).altKey, ctrlKey: (event as KeyboardEvent).ctrlKey,
      shiftKey: (event as KeyboardEvent).shiftKey, metaKey: (event as KeyboardEvent).metaKey,
      relatedTarget: (event as FocusEvent).relatedTarget, defaultPrevented: event.defaultPrevented,
      preventDefault: () => event.preventDefault(), stopPropagation: () => event.stopPropagation(), persist() {} });
  }
  function remember(saved = selection()) {
    undo.push({ query, selection: saved, badges: [...badges], committedTerms: [...committedTerms] });
    if (undo.length > 100) undo.shift();
    redo.length = 0;
  }
  function commitDraft(saved?: SelectionState) {
    if (tokenizeSearch(query).some(token => token.kind === 'term' && token.complete &&
        !badges.some(badge => badge.start === token.start && badge.text === token.text) && validTerm(token.text))) remember();
    render(saved, true);
  }
  function publish(selected: SelectionState) {
    nativeValue = query;
    input.value = query;
    forwarding = true;
    try {
      const event = new InputEvent('input', { bubbles: true, inputType: 'insertText' });
      if (props()?.onChange) forward('onChange', event, selected); else input.dispatchEvent(event);
    } finally { forwarding = false; }
  }
  function change(value: string, saved: SelectionState, record = true, previousSelection?: SelectionState) {
    if (value !== query && record) remember(previousSelection);
    let prefix = 0, suffix = 0;
    while (prefix < query.length && prefix < value.length && query[prefix] === value[prefix]) prefix++;
    while (suffix < query.length - prefix && suffix < value.length - prefix && query[query.length - suffix - 1] === value[value.length - suffix - 1]) suffix++;
    const delta = value.length - query.length;
    const preserve = (terms: Badge[]) => terms.flatMap(badge => badge.end <= prefix ? [badge] : badge.start >= query.length - suffix ? [{ ...badge, start: badge.start + delta, end: badge.end + delta }] : []);
    badges = preserve(badges); committedTerms = preserve(committedTerms);
    query = value; publish(saved); render(saved);
  }
  function insert(text: string) {
    const selected = selection(), start = Math.min(selected.anchor, selected.focus), end = Math.max(selected.anchor, selected.focus);
    text = text.replace(/[\r\n]+/g, ' ');
    if (text && !/^\s/.test(text) && badges.some(badge => badge.end === start)) text = ' ' + text;
    const trailingSeparator = text && !/\s$/.test(text) && badges.some(badge => badge.start === end);
    if (trailingSeparator) text += ' ';
    const next = query.slice(0, start) + text + query.slice(end), at = start + text.length - (trailingSeparator ? 1 : 0);
    change(next, { anchor: at, focus: at }, true, selected);
  }
  function history(back: boolean) {
    const from = back ? undo : redo, to = back ? redo : undo, previous = from.pop();
    if (!previous) return;
    to.push({ query, selection: selection(), badges: [...badges], committedTerms: [...committedTerms] });
    change(previous.query, previous.selection, false);
    badges = previous.badges; committedTerms = previous.committedTerms; render(previous.selection);
  }
  function sync() {
    if (disposed) return;
    if (!supportedInput(input)) { dispose(); return; }
    if (composing || forwarding) return;
    if (input.value !== nativeValue) {
      const focused = document.activeElement === editor;
      remember(mode === 'classic' ? beforeNativeEdit : undefined);
      beforeNativeEdit = undefined; query = input.value; nativeValue = query;
      if (mode === 'classic') { badges = []; committedTerms = []; }
      else render(focused ? { anchor: query.length, focus: query.length } : undefined, true);
    }
    if (mode === 'classic') return;
    // Metadata or Aegis ratings can become ready after the user commits a term.
    // Never turn an already accepted badge back into editable text during refresh.
    if (committedTerms.some(term => !badges.some(badge => badge.start === term.start && badge.text === term.text) && validTerm(term.text))) {
      render(document.activeElement === editor ? selection() : undefined);
    }
    for (const attribute of ['aria-expanded', 'aria-controls', 'aria-activedescendant', 'aria-invalid']) {
      const value = input.getAttribute(attribute);
      if (value !== editor.getAttribute(attribute)) {
        if (value !== null) editor.setAttribute(attribute, value); else editor.removeAttribute(attribute);
      }
    }
  }
  editor.addEventListener('input', () => {
    if (composing) return;
    const value = read(editor), saved = selection();
    change(value, saved);
  }, options);
  editor.addEventListener('compositionstart', () => { composing = true; }, options);
  editor.addEventListener('compositionend', () => {
    composing = false; change(read(editor), selection()); render(selection());
    if (pendingMode) setMode(pendingMode);
  }, options);
  editor.addEventListener('beforeinput', event => {
    if (composing) return;
    if (event.inputType === 'insertText' && event.data !== null) {
      event.preventDefault(); insert(event.data);
    } else if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault(); history(event.inputType === 'historyUndo');
    } else if (event.inputType === 'deleteContentBackward' || event.inputType === 'deleteContentForward') {
      event.preventDefault();
      const saved = selection(); let start = Math.min(saved.anchor, saved.focus), end = Math.max(saved.anchor, saved.focus);
      if (start === end) {
        if (event.inputType === 'deleteContentBackward') start -= [...query.slice(0, start)].pop()?.length || 0;
        else end += [...query.slice(end)][0]?.length || 0;
      }
      for (const badge of badges) {
        if (start < badge.end && end > badge.start) { start = Math.min(start, badge.start); end = Math.max(end, badge.end); }
      }
      // Removing only a separator must not merge a badge into adjacent text.
      if (/^\s+$/.test(query.slice(start, end)) && query[start - 1] && query[end] &&
          !/[\s()]/.test(query[start - 1] + query[end]) &&
          badges.some(badge => badge.end === start || badge.start === end)) {
        const at = event.inputType === 'deleteContentBackward' ? start : end;
        restore({ anchor: at, focus: at }); return;
      }
      const badge = badges.find(badge => badge.start === start && badge.end === end);
      if (badge) {
        const next = removeSearchTerm(query, badge.start), at = Math.min(start, next.length);
        change(next, { anchor: at, focus: at }); return;
      }
      change(query.slice(0, start) + query.slice(end), { anchor: start, focus: start });
    }
  }, options);
  editor.addEventListener('paste', event => {
    event.preventDefault(); insert(event.clipboardData?.getData('text/plain') || '');
  }, options);
  for (const name of ['copy', 'cut'] as const) editor.addEventListener(name, event => {
    const saved = selection();
    event.clipboardData?.setData('text/plain', query.slice(Math.min(saved.anchor, saved.focus), Math.max(saved.anchor, saved.focus)));
    event.preventDefault(); if (name === 'cut') insert('');
  }, options);
  editor.addEventListener('mousedown', event => {
    if ((event.target as Element).closest('[data-search-remove]')) event.preventDefault();
  }, options);
  editor.addEventListener('click', event => {
    const remove = (event.target as Element).closest<HTMLElement>('[data-search-remove]');
    if (!remove) { forward('onClick', event); return; }
    event.preventDefault(); event.stopPropagation();
    const start = Number(remove.dataset.searchRemove), next = removeSearchTerm(query, start), at = Math.min(start, next.length);
    editor.focus(); change(next, { anchor: at, focus: at });
  }, options);
  editor.addEventListener('keydown', event => {
    if (composing || event.isComposing) return;
    if (event.key === 'Tab' && (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)) return;
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const at = event.key === 'Home' ? 0 : query.length;
      restore({ anchor: event.shiftKey ? selection().anchor : at, focus: at });
      return;
    }
    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
      event.preventDefault(); history(event.key.toLowerCase() === 'z' && !event.shiftKey); return;
    }
    if (['Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'Escape'].includes(event.key)) {
      // DIM's Tab completion uses execCommand on its actual input.
      if (event.key === 'Tab') { completing = true; forwarding = true; input.focus(); }
      try { forward('onKeyDown', event); }
      finally {
        if (event.key === 'Tab') { forwarding = false; editor.focus(); completing = false; }
      }
      if (event.key === 'Enter') { event.preventDefault(); commitDraft(selection()); }
      setTimeout(sync, 0);
    }
  }, options);
  editor.addEventListener('focus', event => {
    sync();
    if (!editor.contains(document.getSelection()?.anchorNode || null)) restore({ anchor: query.length, focus: query.length });
    if (!completing) forward('onFocus', event);
  }, options);
  editor.addEventListener('blur', event => { if (!completing && mode !== 'classic') { forward('onBlur', event); commitDraft(); } }, options);
  const redirectFocus = () => {
    if (mode === 'classic' || completing || !editor.isConnected || document.activeElement !== input) return;
    sync(); editor.focus();
    restore({ anchor: input.selectionStart ?? query.length, focus: input.selectionEnd ?? query.length });
  };
  const originalFocusDescriptor = Object.getOwnPropertyDescriptor(input, 'focus');
  const nativeFocus = input.focus.bind(input);
  // Downshift calls input.focus() when suggestions open. Redirect that call
  // directly: background Gecko tabs do not reliably emit a focus event.
  const editorFocus: typeof input.focus = focusOptions => {
    if (mode === 'classic' || completing) { nativeFocus(focusOptions); return; }
    if (document.activeElement === editor) return;
    sync(); editor.focus(focusOptions);
    restore({ anchor: input.selectionStart ?? query.length, focus: input.selectionEnd ?? query.length });
  };
  input.focus = editorFocus;
  input.addEventListener('focus', () => {
    redirectFocus();
    // Gecko can finish focusing DIM's input after a nested focus() returns.
    queueMicrotask(redirectFocus);
  }, options);
  input.addEventListener('input', () => {
    if (forwarding) return;
    if (mode === 'classic') sync(); else setTimeout(sync, 0);
  }, options);
  // Keep one query history across presentation changes while leaving ordinary
  // Classic editing, selection, clipboard, and autocomplete to the native input.
  input.addEventListener('beforeinput', event => {
    if (mode !== 'classic' || composing) return;
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault(); history(event.inputType === 'historyUndo');
    } else beforeNativeEdit = selection();
  }, options);
  input.addEventListener('keydown', event => {
    if (mode !== 'classic' || composing || event.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
      event.preventDefault(); history(event.key.toLowerCase() === 'z' && !event.shiftKey);
    }
  }, options);
  input.addEventListener('compositionstart', () => { if (mode === 'classic') { beforeNativeEdit = selection(); composing = true; } }, options);
  input.addEventListener('compositionend', () => {
    if (mode !== 'classic') return;
    composing = false; sync(); if (pendingMode) setMode(pendingMode);
  }, options);
  // React can update an uncontrolled input's value without a DOM mutation (saved
  // searches, autocomplete, widget filters). Read only; never rewrite unchanged input.
  const timer = setInterval(sync, 100);
  const attributes = new MutationObserver(sync);
  attributes.observe(input, { attributes: true });
  document.addEventListener(LANGUAGE_CHANGE_EVENT, () => {
    if (composing) return;
    render(document.activeElement === editor ? selection() : undefined);
  }, options);
  render(undefined, true); sync();
  function setMode(next: SearchDisplayMode) {
    if (disposed) return;
    if (composing) { pendingMode = next; return; }
    pendingMode = undefined;
    if (mode === next) return;
    sync();
    if (disposed) return;
    const saved = selection(), active = document.activeElement;
    const focused = active === editor || active === input, wasClassic = mode === 'classic';
    mode = next;
    nativeVisibility(mode !== 'classic');
    render(focused ? saved : undefined, wasClassic);
    if (focused) {
      if (mode === 'classic') nativeFocus(); else editor.focus();
      restore(saved);
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    const focused = document.activeElement === editor;
    controller.abort(); clearInterval(timer); cancelAnimationFrame(scrollFrame); attributes.disconnect(); editor.remove();
    if (input.focus === editorFocus) {
      if (originalFocusDescriptor) Object.defineProperty(input, 'focus', originalFocusDescriptor);
      else delete (input as unknown as { focus?: typeof input.focus }).focus;
    }
    nativeVisibility(false);
    if (focused && input.isConnected) input.focus();
  }
  return Object.assign(dispose, { setMode });
}

export function initInlineSearchEditor(): () => void {
  const host = window as Window & { __aegisInlineSearchDispose?: () => void };
  host.__aegisInlineSearchDispose?.();
  let input: HTMLInputElement | null = null, stop: ReturnType<typeof attachInlineSearchEditor> | undefined;
  const mount = () => {
    const mode = normalizeSearchDisplay(document.documentElement.getAttribute(SEARCH_DISPLAY_ATTRIBUTE));
    if (input?.isConnected && isNativeSearchInput(input) && input.nextElementSibling?.classList.contains('aegis-inline-search')) { stop?.setMode(mode); return; }
    stop?.(); stop = undefined;
    const wrapper = document.querySelector('.aegis-search-widget')?.parentElement;
    input = wrapper ? findNativeSearchInput(wrapper) : null;
    if (input && supportedInput(input)) stop = attachInlineSearchEditor(input, isNativeSearchTermValid, mode);
  };
  const observer = new MutationObserver(mount);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: [SEARCH_DISPLAY_ATTRIBUTE] });
  mount();
  const dispose = () => {
    observer.disconnect(); stop?.();
    if (host.__aegisInlineSearchDispose === dispose) delete host.__aegisInlineSearchDispose;
  };
  host.__aegisInlineSearchDispose = dispose;
  return dispose;
}
