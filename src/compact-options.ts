import { localizeElements } from './i18n';
import { refreshOptionHighlights, showOptionTab } from './options-motion';

document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector<HTMLElement>('.popup-main')!;
  const original = main.querySelector('.settings-card')!;
  const nav = document.createElement('nav');
  nav.className = 'options-tabs';
  nav.setAttribute('role', 'tablist');
  nav.dataset.i18nAriaLabel = 'compactSections';
  const panels = new Map<string, HTMLElement>();
  const scrollPositions = new Map<HTMLElement, number>();
  const tabs: HTMLButtonElement[] = [];
  let activeIndex = -1;
  const preview = document.createElement('section');
  preview.className = 'options-preview';
  preview.setAttribute('aria-labelledby', 'options-preview-title');
  function activate(index: number) {
    if (index === activeIndex) return;
    const previous = activeIndex < 0 ? undefined : panels.get(tabs[activeIndex].dataset.panel!);
    if (previous) scrollPositions.set(previous, previous.scrollTop);
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    const next = panels.get(tabs[index].dataset.panel!)!;
    preview.hidden = index > 1;
    showOptionTab(previous, next, Math.sign(index - activeIndex));
    next.scrollTop = scrollPositions.get(next) ?? 0;
    activeIndex = index;
    refreshOptionHighlights(false);
  }
  for (const name of ['Badges', 'Scoring', 'Details', 'Data']) {
    const panel = document.createElement('section');
    panel.id = `options-${name}`;
    panel.className = 'options-panel';
    panel.hidden = true;
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
  for (const id of ['aegis-badge-scale-slider', 'aegis-tooltip-width-slider']) {
    const slider = document.getElementById(id)!;
    const group = slider.closest('.input-group')!;
    const heading = group.querySelector('div')!;
    const label = heading.querySelector('label')!;
    label.id ||= `${id}-label`;
    slider.setAttribute('aria-labelledby', label.id);
    group.append(label, slider, heading.querySelector('span')!);
    heading.remove();
    group.classList.add('inline-range');
  }
  original.remove();
  const portrait = document.getElementById('interactive-weapon-tile')!.closest('.input-group')!;
  const positionGroup = document.createElement('div');
  positionGroup.className = 'input-group';
  positionGroup.id = 'aegis-badge-position-group';
  positionGroup.append(portrait.querySelector(':scope > label')!, document.getElementById('aegis-badge-position-segmented')!);
  document.getElementById('aegis-badge-style-segmented')!.closest('.input-group')!.after(positionGroup);
  positionGroup.after(document.getElementById('aegis-fade-hover-segmented')!.closest('.input-group')!);
  portrait.querySelector('.portrait-pos-label-row')!.remove();
  portrait.querySelectorAll('.corner-target').forEach(target => target.remove());
  const previewTitle = document.createElement('h2');
  previewTitle.id = 'options-preview-title';
  previewTitle.dataset.i18n = 'compactPreview';
  const previewHeading = document.createElement('div');
  previewHeading.className = 'options-preview-heading';
  previewHeading.append(previewTitle);
  preview.append(previewHeading, portrait);
  const sampleImage = portrait.querySelector<HTMLImageElement>('.mock-weapon-img')!;
  sampleImage.dataset.i18nAlt = 'exampleWeapon';
  const artwork = document.createElement('div');
  artwork.className = 'options-preview-art';
  sampleImage.before(artwork);
  const power = document.createElement('span');
  power.className = 'options-preview-power';
  power.textContent = '550';
  power.setAttribute('aria-hidden', 'true');
  artwork.append(sampleImage);
  artwork.after(power);
  const tile = portrait.querySelector<HTMLElement>('#interactive-weapon-tile')!;
  for (let index = 1; index < 3; index++) {
    const copy = tile.cloneNode(true) as HTMLElement;
    copy.id = `preview-weapon-${index}`;
    copy.querySelector('.aegis-badge')!.removeAttribute('id');
    tile.parentElement!.append(copy);
  }
  for (const sample of portrait.querySelectorAll('.interactive-weapon-tile')) {
    const frame = document.createElement('div');
    frame.className = 'options-preview-item item-drag-container';
    sample.before(frame);
    sample.classList.add('item');
    frame.append(sample);
  }
  const previewStatus = document.createElement('p');
  previewStatus.className = 'options-preview-status';
  previewStatus.dataset.i18n = 'compactPreviewExamples';
  previewHeading.append(previewStatus);
  main.append(preview);
  const labels: Record<string, string> = {
    badgeMode: 'compactFormat', badgeStyle: 'compactStyle', upgradeIndicatorStyle: 'compactUpgrade',
    badgePosition: 'compactPosition', activeRankingSource: 'compactSource', spreadsheetMode: 'compactActivity',
    perkEvaluation: 'compactEvaluate', armorSource: 'compactArmor', badgeTextScale: 'compactTextSize',
    scoringEngine: 'inlineEngine', perksLayout: 'inlineLayout', recPerkOrder: 'inlinePerkOrder',
    hoverCard: 'inlineHover', compactPerksMatrix: 'inlineMatrix', popupSummaryTitle: 'inlineSummary',
    inlineHeaderTitle: 'inlineHeader', autoMaxHeightTitle: 'inlineHeight', tooltipWidthMode: 'inlineWidthMode',
    tooltipWidthSlider: 'inlineWidth', fadeOnHover: 'inlinePeek', displayLanguage: 'inlineLanguage',
    engineAegis: 'inlineAegis', engineLightgg: 'inlineLightgg',
    modePve: 'inlinePve', modePvp: 'inlinePvp', modeBoth: 'sourceBoth',
    badgeColorPerk: 'inlinePerk', badgeColorGradient: 'inlineGradient',
    styleNotch: 'inlineNotch', styleFooter: 'inlineBottom',
    evalEquipped: 'inlineEquipped', evalDual: 'inlineDual', evalPotential: 'inlinePotential',
    armorLowco: 'inlineLowco', armorAegis: 'inlineAegis', layoutSide: 'inlineSide', layoutInline: 'inlineInline',
    orderSheetRank: 'inlineRank'
  };
  for (const [oldKey, key] of Object.entries(labels)) {
    main.querySelectorAll<HTMLElement>(`[data-i18n="${oldKey}"]`).forEach(el => {
      el.dataset.i18n = key;
      el.dataset.i18nTitle = oldKey;
      if (el.matches('button')) el.dataset.i18nAriaLabel = oldKey;
    });
  }
  for (const button of main.querySelectorAll<HTMLButtonElement>('#aegis-upgrade-style-segmented button')) {
    const key = button.dataset.i18n!;
    button.dataset.i18nTitle = key;
    button.dataset.i18nAriaLabel = key;
    delete button.dataset.i18n;
    const preview = document.createElement('span');
    preview.className = 'upgrade-option-preview aegis-style-footer';
    preview.setAttribute('aria-hidden', 'true');
    const icon = document.createElement('span');
    const none = button.dataset.value === 'none';
    icon.className = none ? 'upgrade-option-none' : `aegis-badge-upgrade-arrow aegis-upgrade-${button.dataset.value}`;
    icon.textContent = none ? '' : '▲';
    preview.append(icon);
    button.replaceChildren(preview);
  }
  const corners = document.getElementById('aegis-badge-position-segmented')!;
  for (const [position, arrow] of Object.entries({ 'top-left': '↖', 'top-right': '↗', 'bottom-left': '↙', 'bottom-right': '↘' })) {
    const button = corners.querySelector<HTMLButtonElement>(`button[data-value="${position}"]`)!;
    button.dataset.i18nTitle = button.dataset.i18n;
    button.dataset.i18nAriaLabel = button.dataset.i18n;
    delete button.dataset.i18n;
    button.textContent = arrow;
    corners.append(button);
  }
  document.body.classList.add('compact-options');
  activate(0);
  localizeElements(nav);
});
