import { localizeElements } from './i18n';
import { refreshOptionHighlights } from './options-motion';

document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector<HTMLElement>('.popup-main')!;
  const original = main.querySelector('.settings-card')!;
  const nav = document.createElement('nav');
  nav.className = 'options-tabs';
  nav.setAttribute('role', 'tablist');
  nav.dataset.i18nAriaLabel = 'compactSections';
  const panels = new Map<string, HTMLElement>();
  const tabs: HTMLButtonElement[] = [];
  function activate(index: number) {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels.get(tab.dataset.panel!)!.hidden = i !== index;
    });
    refreshOptionHighlights(false);
  }
  for (const name of ['Badges', 'Scoring', 'Details', 'Data']) {
    const panel = document.createElement('section');
    panel.id = `options-${name}`;
    panel.className = 'options-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-${name}`);
    const tab = document.createElement('button');
    tab.id = `tab-${name}`;
    tab.type = 'button';
    tab.dataset.panel = name;
    tab.dataset.i18n = `compact${name}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    tab.addEventListener('click', () => activate(tabs.indexOf(tab)));
    tab.addEventListener('keydown', event => {
      const current = tabs.indexOf(tab);
      const index = event.key === 'ArrowRight' ? (current + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (current + tabs.length - 1) % tabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
      if (index < 0) return;
      event.preventDefault();
      activate(index);
      tabs[index].focus();
    });
    tabs.push(tab);
    nav.append(tab);
    panels.set(name, panel);
  }
  main.prepend(nav);
  nav.after(...panels.values());
  function move(panel: string, ids: string[]) {
    for (const id of ids) {
      const control = document.getElementById(id)!;
      panels.get(panel)!.append(control.closest('.input-group') ?? control);
    }
  }
  move('Badges', ['aegis-two-tier-segmented', 'aegis-two-tier-options', 'aegis-badge-style-segmented', 'aegis-upgrade-style-group', 'aegis-badge-scale-slider', 'interactive-weapon-tile', 'aegis-fade-hover-segmented']);
  move('Scoring', ['scoring-source-segmented', 'aegis-db-segmented', 'aegis-mode-segmented', 'aegis-grade-display-segmented', 'aegis-armor-source-segmented']);
  move('Details', ['aegis-layout-segmented', 'aegis-perk-order-segmented', 'aegis-hover-enabled-segmented', 'aegis-matrix-segmented', 'aegis-popup-summary-segmented', 'aegis-inline-header-segmented', 'aegis-auto-max-height-segmented', 'aegis-tooltip-width-mode-segmented', 'aegis-tooltip-width-slider-group']);
  move('Data', ['aegis-language-dropdown']);
  const data = panels.get('Data')!;
  data.append(main.querySelector('.top-actions-row')!);
  for (const card of main.querySelectorAll(':scope > .settings-card, :scope > .status-card, :scope > .info-card')) {
    if (card !== original) data.append(card);
  }
  data.append(document.querySelector('.popup-footer')!);
  const scale = document.getElementById('aegis-badge-scale-slider')!.closest('.input-group')!;
  const position = document.getElementById('interactive-weapon-tile')!.closest('.input-group')!;
  const preview = document.createElement('div');
  preview.className = 'options-preview-row';
  scale.before(preview);
  preview.append(position, scale);
  original.remove();
  const labels: Record<string, string> = {
    badgeMode: 'compactFormat', badgeStyle: 'compactStyle', upgradeIndicatorStyle: 'compactUpgrade',
    badgePosition: 'compactPosition', activeRankingSource: 'compactSource', spreadsheetMode: 'compactActivity',
    perkEvaluation: 'compactEvaluate', armorSource: 'compactArmor', badgeTextScale: 'compactTextSize'
  };
  for (const [oldKey, key] of Object.entries(labels)) {
    main.querySelectorAll<HTMLElement>(`[data-i18n="${oldKey}"]`).forEach(el => { el.dataset.i18n = key; });
  }
  document.body.classList.add('compact-options');
  activate(0);
  localizeElements(nav);
});
