type ActivityMode = 'pve' | 'pvp' | 'both';
interface ActivityModeOptions {
  read: () => { ready: boolean; mode: ActivityMode; supported: boolean };
  connected: () => boolean;
  save: (mode: 'pve' | 'pvp', complete: (failed: boolean) => void) => void;
}

/** Expose only the activity preference; storage and inventory data stay private. */
export function installActivityModeProvider(options: ActivityModeOptions) {
  const requestEvent = 'aegis:activity-mode-request-v1';
  const stateEvent = 'aegis:activity-mode-state-v1';
  const disposeEvent = 'aegis:activity-mode-dispose-v1';
  const attribute = 'data-aegis-activity-mode';
  document.dispatchEvent(new Event(disposeEvent));
  let alive = true, error: 'save' | undefined;
  let pending: { mode: 'pve' | 'pvp'; saved: boolean } | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  function connected() {
    try { return alive && options.connected(); } catch { return false; }
  }
  function refresh() {
    if (!connected()) { dispose(); return; }
    const current = options.read();
    if (pending?.saved && current.mode === pending.mode) { pending = undefined; clearTimeout(timeout); }
    const value = JSON.stringify({ version: 1, ...current, mode: pending?.mode || current.mode, busy: !!pending, ...(error ? { error } : {}) });
    if (document.documentElement.getAttribute(attribute) !== value) {
      document.documentElement.setAttribute(attribute, value);
      document.dispatchEvent(new Event(stateEvent));
    }
  }
  function request(event: Event) {
    if (event.target !== document || !event.cancelable || !connected()) {
      if (!connected()) dispose();
      return;
    }
    const detail = (event as CustomEvent).detail;
    if (typeof detail !== 'string' || detail.length > 160) return;
    let command;
    try { command = JSON.parse(detail); } catch { return; }
    if (!command || !['connect', 'set'].includes(command.type)
      || command.type === 'set' && !['pve', 'pvp'].includes(command.mode)) return;
    event.preventDefault();
    const current = options.read();
    if (command.type !== 'set' || !current.ready || !current.supported || pending) { refresh(); return; }
    error = undefined;
    const operation = { mode: command.mode as 'pve' | 'pvp', saved: false };
    pending = operation; refresh();
    function complete(failed: boolean) {
      if (!alive || pending !== operation) return;
      if (failed) { pending = undefined; error = 'save'; clearTimeout(timeout); }
      else operation.saved = true;
      refresh();
    }
    timeout = setTimeout(() => complete(true), 10000);
    try { options.save(operation.mode, complete); } catch { complete(true); }
  }
  function dispose() {
    if (!alive) return;
    alive = false; pending = undefined; clearTimeout(timeout);
    document.removeEventListener(requestEvent, request);
    document.removeEventListener(disposeEvent, dispose);
    document.documentElement.removeAttribute(attribute);
    document.dispatchEvent(new Event(stateEvent));
  }
  document.addEventListener(requestEvent, request);
  document.addEventListener(disposeEvent, dispose);
  refresh();
  return { refresh, dispose };
}
