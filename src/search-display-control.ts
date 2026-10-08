import { t } from './i18n';
import { normalizeSearchDisplay, SEARCH_DISPLAY_ATTRIBUTE, SEARCH_DISPLAY_MODES, type SearchDisplayMode } from './search-display';

let initialized = false;
let mode: SearchDisplayMode = 'exact';
let revision = 0;
const buttons = new Set<HTMLButtonElement>();
const labels = { classic: 'searchDisplayClassic', exact: 'searchDisplayExact', readable: 'searchDisplayReadable' };

function render() {
  document.documentElement.setAttribute(SEARCH_DISPLAY_ATTRIBUTE, mode);
  const next = SEARCH_DISPLAY_MODES[(SEARCH_DISPLAY_MODES.indexOf(mode) + 1) % SEARCH_DISPLAY_MODES.length];
  for (const button of buttons) {
    button.dataset.mode = mode;
    button.textContent = mode === 'classic' ? 'T' : mode === 'exact' ? '</>' : 'Aa';
    button.title = t('searchDisplaySwitch', { current: t(labels[mode]), next: t(labels[next]) });
    button.setAttribute('aria-label', button.title);
  }
}

/** Keep the preference in extension storage; expose only its enum to the page. */
export function attachSearchDisplayControl(searchBar: HTMLElement): () => void {
  const host = searchBar.parentElement;
  if (!host) return () => {};
  if (!initialized) {
    initialized = true;
    const loadingRevision = revision;
    chrome.storage.local.get(['aegisSearchDisplay'], stored => {
      if (loadingRevision !== revision) return;
      mode = normalizeSearchDisplay(stored.aegisSearchDisplay); render();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.aegisSearchDisplay) return;
      revision++;
      mode = normalizeSearchDisplay(changes.aegisSearchDisplay.newValue); render();
    });
  }
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'aegis-search-display-btn';
  // Pointer activation preserves the query selection. Keyboard activation keeps
  // normal button focus so repeated Enter/Space presses can cycle the modes.
  button.addEventListener('mousedown', event => { if (event.button === 0) event.preventDefault(); });
  button.addEventListener('click', event => {
    event.stopPropagation(); revision++;
    mode = SEARCH_DISPLAY_MODES[(SEARCH_DISPLAY_MODES.indexOf(mode) + 1) % SEARCH_DISPLAY_MODES.length];
    render();
    void chrome.storage.local.set({ aegisSearchDisplay: mode }).catch(console.error);
  });
  // Keep the control outside DIM's bordered field, in the same layout row.
  // Aegis-owned attributes survive React className updates without wrapping or
  // moving React-owned nodes. The row reserves the button's width at all sizes.
  host.querySelectorAll(':scope > .aegis-search-display-btn').forEach(old => old.remove());
  host.setAttribute('data-aegis-search-display-host', 'true');
  searchBar.setAttribute('data-aegis-search-display-bar', 'true');
  buttons.add(button); searchBar.after(button); render();
  return () => {
    buttons.delete(button); button.remove();
    if (!host.querySelector(':scope > .aegis-search-display-btn')) {
      host.removeAttribute('data-aegis-search-display-host');
      searchBar.removeAttribute('data-aegis-search-display-bar');
    }
  };
}
