import { setLanguage, type SupportedLanguage } from './i18n';

export const LANGUAGE_ATTRIBUTE = 'data-aegis-language';
const languages = new Set<string>(['en', 'es', 'ko', 'ja', 'zh-CHS', 'zh-CHT']);
function supported(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && languages.has(value);
}

/** ISOLATED publishes its resolved storage preference through a plain DOM string. */
export function publishLanguage(language: SupportedLanguage): void {
  if (!supported(language)) return;
  if (document.documentElement.getAttribute(LANGUAGE_ATTRIBUTE) !== language) {
    document.documentElement.setAttribute(LANGUAGE_ATTRIBUTE, language);
  }
}

/** MAIN owns its i18n singleton and waits for initial locale before mounting labels. */
export function initLanguageBridge(startEditor: () => () => void): () => void {
  const host = window as Window & { __aegisLanguageBridgeDispose?: () => void };
  host.__aegisLanguageBridgeDispose?.();
  let root: HTMLElement | null = null;
  let stopEditor: (() => void) | undefined;
  let disposed = false;
  const sync = () => {
    if (disposed) return;
    if (root !== document.documentElement) {
      root = document.documentElement;
      observer.disconnect();
      if (root) observer.observe(root, { attributes: true, attributeFilter: [LANGUAGE_ATTRIBUTE] });
      else observer.observe(document, { childList: true, subtree: true });
    }
    const language = root?.getAttribute(LANGUAGE_ATTRIBUTE);
    if (!supported(language)) return;
    setLanguage(language);
    if (!stopEditor) stopEditor = startEditor();
  };
  const observer = new MutationObserver(sync);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    stopEditor?.();
    window.removeEventListener('pagehide', leave);
    if (host.__aegisLanguageBridgeDispose === dispose) delete host.__aegisLanguageBridgeDispose;
  };
  host.__aegisLanguageBridgeDispose = dispose;
  const leave = (event: PageTransitionEvent) => { if (!event.persisted) dispose(); };
  window.addEventListener('pagehide', leave);
  // At document_start the root may not exist yet.
  if (!document.documentElement) observer.observe(document, { childList: true, subtree: true });
  sync();
  return dispose;
}
