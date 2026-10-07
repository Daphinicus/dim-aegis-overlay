/** Keyboard behavior for the existing Aegis language control; retains its surface. */
export function initLanguageCombobox(root: HTMLElement, choose: (value: string) => void) {
  const input = root.querySelector<HTMLInputElement>('#language-select-input')!;
  const menu = root.querySelector<HTMLElement>('#aegis-language-menu')!;
  const options = [...root.querySelectorAll<HTMLElement>('.aegis-combobox-option')];
  let active = 0;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-haspopup', 'listbox');
  input.setAttribute('aria-controls', 'aegis-language-options');
  input.setAttribute('aria-expanded', 'false');
  root.querySelector('#aegis-language-options')?.setAttribute('role', 'listbox');
  root.querySelector('#aegis-language-options')?.setAttribute('aria-labelledby', 'aegis-language-label');
  options.forEach((option, index) => { option.id = `aegis-language-option-${index}`; option.setAttribute('role', 'option'); });
  const highlight = () => {
    options.forEach((option, index) => option.classList.toggle('keyboard-active', index === active));
    input.setAttribute('aria-activedescendant', options[active].id);
    options[active].scrollIntoView?.({ block: 'nearest' });
  };
  const close = () => {
    root.classList.remove('active'); menu.classList.add('hidden');
    input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
    options.forEach(option => option.classList.remove('keyboard-active'));
  };
  const open = () => {
    active = Math.max(0, options.findIndex(option => option.classList.contains('selected')));
    root.classList.add('active'); menu.classList.remove('hidden'); input.setAttribute('aria-expanded', 'true'); highlight();
  };
  const select = (option: HTMLElement) => {
    close(); input.focus(); choose(option.dataset.value!);
  };
  root.addEventListener('click', event => {
    const option = (event.target as Element).closest<HTMLElement>('.aegis-combobox-option');
    if (option) select(option); else if (menu.classList.contains('hidden')) open(); else close();
  });
  input.addEventListener('keydown', event => {
    const opened = !menu.classList.contains('hidden');
    if (event.key === 'Tab') { close(); return; }
    if (event.key === 'Escape') { if (opened) { event.preventDefault(); close(); } return; }
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!opened) { open(); return; }
      if (event.key === 'Enter' || event.key === ' ') { select(options[active]); return; }
      active = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
        : (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      highlight();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (!opened) open();
      const next = options.findIndex(option => option.textContent?.trim().replace(/^[^\p{L}]+/u, '').toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
      if (next >= 0) { active = next; highlight(); }
    }
  });
  document.addEventListener('click', event => { if (!root.contains(event.target as Node)) close(); });
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget as Node)) close(); });
}

/** Modal lifecycle for the existing changelog, including automatic first entry. */
export function initChangelogModal(modal: HTMLElement, dismiss: () => void) {
  let previous: HTMLElement | null = null;
  const inert = new Map<HTMLElement, boolean>();
  const dialog = modal.querySelector<HTMLElement>('.changelog-modal-card')!;
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'changelog-title'); dialog.tabIndex = -1;
  const controls = () => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(node => !node.closest('.hidden') && !node.hidden);
  const focus = () => (controls()[0] || dialog).focus();
  const show = () => {
    if (!modal.classList.contains('hidden')) return;
    previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.classList.remove('hidden');
    for (const node of document.body.children) if (node instanceof HTMLElement && node !== modal && node.tagName !== 'SCRIPT') {
      inert.set(node, node.inert); node.inert = true;
    }
    focus();
  };
  const hide = () => {
    if (modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    for (const [node, value] of inert) node.inert = value;
    inert.clear();
    const restore = previous && previous !== document.body && previous.isConnected && !previous.closest('[inert]') ? previous : document.getElementById('open-changelog-btn');
    restore?.focus();
    previous = null; dismiss();
  };
  modal.addEventListener('click', event => { if (event.target === modal) hide(); });
  document.addEventListener('keydown', event => {
    if (modal.classList.contains('hidden')) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hide(); }
    else if (event.key === 'Tab') {
      const list = controls(), first = list[0] || dialog, last = list[list.length - 1] || dialog;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
  }, true);
  document.addEventListener('focusin', event => { if (!modal.classList.contains('hidden') && !dialog.contains(event.target as Node)) focus(); });
  return { show, hide };
}
