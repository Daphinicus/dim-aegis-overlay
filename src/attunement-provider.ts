export interface AttunementRecommendation {
  provider: string; mode: string; grade: string; gradeLabel: string;
  rankLabel: string; variantLabel: string; perksLabel: string; perks: string; analysis: string;
}

/** Share public weapon recommendations without exposing storage or inventory rolls. */
export function installAttunementProvider(resolve: (name: string, hash: number) => AttunementRecommendation[]) {
  document.dispatchEvent(new Event('aegis-attunement-dispose'));
  let alive = true, queued = false;
  function request(event: Event) {
    const tile = event.target;
    if (!(tile instanceof HTMLElement) || !tile.matches('.item[data-dimsum-attunement-weapon]')) return;
    tile.removeAttribute('data-aegis-attunement');
    const raw = tile.getAttribute('data-dimsum-attunement-weapon');
    if (!raw || raw.length > 2000) return;
    try {
      const { name, hash } = JSON.parse(raw);
      if (typeof name !== 'string' || name.length > 300 || !Number.isSafeInteger(hash) || hash <= 0 || hash > 0xffffffff) return;
      tile.setAttribute('data-aegis-attunement', JSON.stringify({ version: 1, rows: resolve(name, hash) }));
    } catch { /* Malformed or obsolete requests retain the native item. */ }
  }
  function refresh() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (alive) document.dispatchEvent(new Event('aegis-attunement-provider'));
    });
  }
  function dispose() {
    alive = false;
    document.removeEventListener('dimsum-attunement-request', request);
    document.removeEventListener('aegis-preview-update', refresh);
    document.removeEventListener('aegis-attunement-dispose', dispose);
    document.querySelectorAll('[data-aegis-attunement]').forEach(tile => tile.removeAttribute('data-aegis-attunement'));
    document.dispatchEvent(new Event('aegis-attunement-provider'));
  }
  document.addEventListener('dimsum-attunement-request', request);
  document.addEventListener('aegis-preview-update', refresh);
  document.addEventListener('aegis-attunement-dispose', dispose);
  refresh();
  return { refresh, dispose };
}

export function attunementGradeLabel(language: string) {
  const labels: Record<string, string> = {
    en: 'Archetype grade', es: 'Grado del arquetipo', ko: '무기 유형 등급', ja: '武器タイプ評価',
    'zh-CHS': '武器类型评级', 'zh-CHT': '武器類型評級',
  };
  return labels[language] || labels.en;
}
