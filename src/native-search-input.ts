const SEARCH_INPUT = 'input[name="filter"], input[placeholder*="filter" i], input[type="search"]';
const OWNED_SEARCH = '#dimsum-shaders-dialog, .dimsum-owned-controls, .aegis-explorer-panel, .aegis-chase-panel, .aegis-search-widget-menu';

/** Extension search fields must never become DIM inventory search anchors. */
export function isNativeSearchInput(input: HTMLInputElement): boolean {
  return input.matches(SEARCH_INPUT) && !input.closest(OWNED_SEARCH);
}

export function findNativeSearchInput(root: ParentNode = document): HTMLInputElement | null {
  return Array.from(root.querySelectorAll<HTMLInputElement>(SEARCH_INPUT)).find(isNativeSearchInput) ?? null;
}
