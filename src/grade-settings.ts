import { GRADES, Grade, GradeRule, GradeSettings, defaultGradeSettings, defaultRules, normalizeGradeSettings, unreachableGrades } from './grading';
import { applyGradeColors, gradeGradient, defaultGradeColors as swatches } from './grade-colors';
import { safeSetInnerHTML } from './dom-utils';
import { Hsv, hexToHsv, hsvToHex } from './color-picker';

const traitLabels: Record<GradeRule['traits'], string> = { both: 'Both equipped', mixed: 'Equipped + selectable', one: 'One equipped', available: 'Equipped or selectable' };
const extraLabels: Record<GradeRule['extras'], string> = { none: 'None', mag: 'Magazine', barrel: 'Barrel', either: 'Either', both: 'Both' };
const defaultGuide: Record<Grade, string> = {
  'S+': 'Traits 1 & 2 + Mag + Barrel + Origin', S: 'Traits 1 & 2 + Magazine matched',
  'A+': 'Traits 1 & 2 + Barrel matched', A: 'Traits 1 & 2 both matched',
  'B+': '1 Trait active + 1 selectable + Mag/Barrel', B: '1 Trait active + 1 selectable Trait',
  C: '1 Trait matched + Magazine or Barrel', D: 'Only 1 Trait matched', E: '1 Trait active/selectable', F: 'Underperforming (no Traits matched)',
};

export function initGradeSettings() {
  const root = document.getElementById('aegis-grade-settings');
  if (!root) return;
  document.querySelector('.popup-header')?.append(root);
  const el = root;
  let saved = defaultGradeSettings();
  let draft = defaultGradeSettings();
  let selected: Grade = 'S';
  let context: 'pve' | 'pvp' = 'pve';
  let ruleWrites = 0;
  let colorWrites = 0;
  let hsv: Hsv = [0, 100, 100];
  const get = <T extends HTMLElement>(selector: string) => el.querySelector<T>(selector)!;
  const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  safeSetInnerHTML(el, `
<dialog id="grade-colors-modal" class="grade-modal" aria-labelledby="grade-colors-modal-title"><div class="grade-editor-card"><div class="grade-editor-header"><h2 id="grade-colors-modal-title" class="grade-editor-title">Customize Grade Colors</h2><button type="button" class="changelog-close-x" data-close aria-label="Close Grade colors">&times;</button></div><div class="grade-editor-body">
      <p class="description" data-color-status role="status"></p>
      <div class="grade-pills" role="group" aria-label="Grade to edit">${GRADES.map(g => `<button type="button" class="aegis-badge-${g[0].toLowerCase()}" data-grade="${g}" data-aegis-grade="${g}" aria-pressed="false">${g}</button>`).join('')}</div>
      <div class="grade-color-fields">
        <div class="grade-color-preview" data-color role="img" aria-label="Selected grade color"></div>
        <input type="text" data-hex maxlength="7" spellcheck="false" aria-label="Selected grade hex color">
      </div>
      <div class="grade-color-sliders">${['Hue', 'Saturation', 'Brightness'].map((label, index) => `<div class="grade-color-slider"><input type="range" data-hsv="${index}" min="0" max="${index === 0 ? 360 : 100}" step="1" aria-label="${label}"><span data-hsv-value="${index}" aria-hidden="true"></span></div>`).join('')}</div>
      <div class="grade-actions grade-color-actions"><button type="button" class="btn btn-secondary" data-reset-color>Reset selected</button><button type="button" class="btn btn-secondary" data-reset-colors>Reset all</button></div>
</div></div></dialog><dialog id="grade-rules-modal" class="grade-modal" aria-labelledby="grade-rules-modal-title"><div class="grade-editor-card"><div class="grade-editor-header"><h2 id="grade-rules-modal-title" class="grade-editor-title">Customize Grading Criteria</h2><button type="button" class="changelog-close-x" data-close aria-label="Close Grading criteria">&times;</button></div><div class="grade-editor-body"><div class="grade-profile-row">
        <label class="grade-check"><input type="checkbox" data-setting="separatePvp"> Separate PvP</label>
        <select data-context aria-label="Profile to edit"><option value="pve">PvE</option><option value="pvp">PvP</option></select>
      </div>
      <div class="grade-pills" role="group" aria-label="Grade to edit">${GRADES.map(g => `<button type="button" class="aegis-badge-${g[0].toLowerCase()}" data-grade="${g}" data-aegis-grade="${g}" aria-pressed="false">${g}</button>`).join('')}</div>
      <div class="grade-rule-fields" data-rule-fields>
        <label class="grade-rule-select" title="Match recommended main traits">Main traits <select data-rule="traits">${options(traitLabels)}</select></label>
        <label class="grade-rule-select" title="Match the recommended barrel and magazine">Barrel / mag <select data-rule="extras">${options(extraLabels)}</select></label>
        <div class="grade-rule-checks">
          <label class="grade-check" title="Include this grade in scoring and the overview"><input type="checkbox" data-rule="enabled"> Enabled</label>
          <label class="grade-check" title="Recommended origin trait equipped"><input type="checkbox" data-rule="origin"> Origin</label>
          <label class="grade-check" title="Recommended masterwork matched; ignored when none is recommended"><input type="checkbox" data-rule="masterwork"> MW</label>
        </div>
      </div>
      <p class="description" data-fallback>F is the fallback when no grade matches.</p>
      <p class="grade-warning" data-warning role="status" title="Higher matching grades take priority"></p>
      <div class="grade-actions grade-color-actions"><button type="button" class="btn btn-secondary" data-reset-rule title="Reset this grade in the selected profile">Reset selected</button><button type="button" class="btn btn-secondary" data-reset-rules title="Reset all criteria, including both PvE and PvP">Reset all</button></div>
      <p class="description" data-status role="status"></p>
</div></div></dialog>
  `);

  for (const [buttonId, dialogId] of [['open-grade-colors-btn', 'grade-colors-modal'], ['open-grade-rules-btn', 'grade-rules-modal']]) {
    const dialog = get<HTMLDialogElement>(`#${dialogId}`);
    const button = document.getElementById(buttonId);
    button?.setAttribute('aria-expanded', 'false');
    button?.addEventListener('click', () => {
      if (dialog.open) { dialog.close(); return; }
      el.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(other => other.close());
      dialog.show();
      button.setAttribute('aria-expanded', 'true');
    });
    const close = () => { dialog.close(); button?.focus({ preventScroll: true }); };
    dialog.querySelector('[data-close]')!.addEventListener('click', close);
    dialog.addEventListener('close', () => button?.setAttribute('aria-expanded', String(dialog.open)));
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
  }
  document.addEventListener('pointerdown', event => {
    const target = event.target;
    if (!(target instanceof Element) || el.contains(target) || target.closest('#open-grade-colors-btn, #open-grade-rules-btn')) return;
    el.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(dialog => dialog.close());
  });

  function renderGuide() {
    const guide = document.getElementById('grade-scoring-guide');
    if (!guide) return;
    const defaults = defaultRules();
    const profiles = saved.rulesEnabled && saved.separatePvp ? [['PvE', saved.pve], ['PvP', saved.pvp]] as const
      : [['', saved.rulesEnabled ? saved.pve : defaults]] as const;
    safeSetInnerHTML(guide, profiles.map(([label, rules]) => {
      const unreachable = unreachableGrades(rules);
      const standard = JSON.stringify(rules) === JSON.stringify(defaults);
      return `${label ? `<p class="tooltip-desc">${label}</p>` : ''}<div class="tooltip-grid">${GRADES.filter(grade => grade === 'F' || rules[grade].enabled).map(grade => {
        const rule = grade === 'F' ? null : rules[grade];
        let description = standard ? defaultGuide[grade] : 'No enabled grade matched';
        if (!standard && rule && grade !== 'F') {
          const traits = { both: 'Traits 1 & 2', mixed: '1 Trait active + 1 selectable', one: '1 Trait matched', available: '1 Trait active/selectable' };
          const extras = { none: '', mag: 'Mag', barrel: 'Barrel', either: 'Mag/Barrel', both: 'Mag + Barrel' };
          description = JSON.stringify(rule) === JSON.stringify(defaults[grade]) ? defaultGuide[grade]
            : [traits[rule.traits], extras[rule.extras], rule.origin ? 'Origin' : '', rule.masterwork ? 'MW' : ''].filter(Boolean).join(' + ');
        }
        return `<span class="grade-pill grade-${grade[0].toLowerCase()}-pill" data-aegis-grade="${grade}">${grade}</span><span${unreachable.includes(grade) ? ' title="Unreachable: higher grades always match first"' : ''}>${description}</span>`;
      }).join('')}</div>`;
    }).join('') + (profiles.every(([, rules]) => (['S+', 'S', 'A+', 'A'] as const).every(grade => !rules[grade].enabled || rules[grade].traits === 'both'))
      ? '<span class="tooltip-note">*Main Traits 1 & 2 must match to score A or higher.</span>' : ''));
    applyGuideColors();
  }

  function applyGuideColors() {
    const guide = document.querySelector<HTMLElement>('.aegis-help-tooltip');
    if (guide) applyGradeColors(guide, saved);
  }

  function profile() { return draft[context === 'pvp' && draft.separatePvp ? 'pvp' : 'pve']; }
  function editableSettings(settings: GradeSettings) {
    return { ...structuredClone(settings), colors: settings.colorsEnabled ? { ...settings.colors } : {},
      ...(!settings.rulesEnabled ? { separatePvp: false, pve: defaultRules(), pvp: defaultRules() } : {}) };
  }
  function saveRules() {
    ruleWrites++;
    get('[data-status]').textContent = '';
    chrome.storage.local.set({ aegisGradeSettings: normalizeGradeSettings(draft) }, () => {
      ruleWrites--;
      const error = chrome.runtime.lastError;
      if (error) get('[data-status]').textContent = `Could not save rules: ${error.message}. Change a rule to retry.`;
    });
  }
  function saveColors() {
    const palette = { version: 1, colorsEnabled: draft.colorsEnabled, colors: { ...draft.colors } };
    colorWrites++;
    get('[data-color-status]').textContent = '';
    chrome.storage.local.set({ aegisGradeColors: palette }, () => {
      colorWrites--;
      const error = chrome.runtime.lastError;
      if (error) get('[data-color-status]').textContent = `Could not save colors: ${error.message}. Adjust a color to retry.`;
    });
  }
  function renderColor(color: string) {
    for (const grade of GRADES) {
      if (draft.colors[grade]?.toLowerCase() === swatches[grade]) delete draft.colors[grade];
    }
    draft.colorsEnabled = Object.keys(draft.colors).length > 0;
    el.querySelectorAll<HTMLButtonElement>('#grade-colors-modal [data-grade]').forEach(button => {
      const grade = button.dataset.grade as Grade;
      const custom = !!draft.colors[grade];
      button.toggleAttribute('data-custom-color', custom);
      button.title = custom ? 'Custom color' : 'Default color';
      button.setAttribute('aria-label', `${grade}: ${button.title}`);
    });
    get<HTMLButtonElement>('[data-reset-color]').disabled = !draft.colors[selected];
    get<HTMLButtonElement>('[data-reset-colors]').disabled = !draft.colorsEnabled;
    get('[data-color]').style.background = gradeGradient(color);
    get('[data-color]').setAttribute('aria-label', `${selected} color ${color.toUpperCase()}`);
    el.querySelectorAll<HTMLInputElement>('[data-hsv]').forEach(input => {
      const index = Number(input.dataset.hsv);
      input.value = String(hsv[index]);
      input.setAttribute('aria-valuetext', `${Math.round(hsv[index])}${index === 0 ? ' degrees' : ' percent'}`);
      get(`[data-hsv-value="${index}"]`).textContent = `${Math.round(hsv[index])}${index === 0 ? '°' : '%'}`;
    });
    get('[data-hsv="1"]').style.background = `linear-gradient(to right, ${hsvToHex([hsv[0], 0, hsv[2]])}, ${hsvToHex([hsv[0], 100, hsv[2]])})`;
    get('[data-hsv="2"]').style.background = `linear-gradient(to right, #000000, ${hsvToHex([hsv[0], hsv[1], 100])})`;
  }
  function render() {
    draft.rulesEnabled = draft.separatePvp || JSON.stringify(draft.pve) !== JSON.stringify(defaultRules());
    get<HTMLInputElement>('[data-setting="separatePvp"]').checked = draft.separatePvp;
    el.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.grade === selected)); });
    const color = draft.colors[selected] || swatches[selected];
    hsv = hexToHsv(color, hsv);
    renderColor(color);
    get<HTMLInputElement>('[data-hex]').value = color.toUpperCase();
    get<HTMLInputElement>('[data-hex]').setCustomValidity('');
    get('[data-context]').hidden = !draft.separatePvp;
    get<HTMLSelectElement>('[data-context]').value = context;
    get('[data-rule-fields]').hidden = selected === 'F';
    get('[data-fallback]').hidden = selected !== 'F';
    el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-rule]').forEach(input => {
      if (selected === 'F') return;
      const value = profile()[selected][input.dataset.rule as keyof GradeRule];
      if (input instanceof HTMLInputElement) input.checked = value as boolean;
      else input.value = value as string;
    });
    const defaults = defaultRules();
    const isCustom = (grade: Grade) => grade !== 'F' && JSON.stringify(profile()[grade]) !== JSON.stringify(defaults[grade]);
    el.querySelectorAll<HTMLButtonElement>('#grade-rules-modal [data-grade]').forEach(button => {
      const grade = button.dataset.grade as Grade;
      const custom = isCustom(grade);
      button.toggleAttribute('data-custom-rule', custom);
      button.title = grade === 'F' ? 'Fallback grade' : custom ? 'Custom criteria' : 'Default criteria';
      button.setAttribute('aria-label', `${grade}: ${button.title}`);
    });
    get<HTMLButtonElement>('[data-reset-rule]').disabled = !isCustom(selected);
    get<HTMLButtonElement>('[data-reset-rules]').disabled = !draft.separatePvp &&
      JSON.stringify(draft.pve) === JSON.stringify(defaults) && JSON.stringify(draft.pvp) === JSON.stringify(defaults);
    const unreachable = draft.rulesEnabled ? unreachableGrades(profile()) : [];
    get('[data-warning]').textContent = unreachable.length ? `Unreachable: ${unreachable.join(', ')}.` : '';
    applyGradeColors(el, draft);
  }
  get<HTMLInputElement>('[data-setting="separatePvp"]').addEventListener('change', event => {
    draft.separatePvp = (event.target as HTMLInputElement).checked;
    if (!draft.separatePvp) context = 'pve';
    render(); saveRules();
  });
  el.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach(button => button.addEventListener('click', () => { selected = button.dataset.grade as Grade; render(); }));
  get<HTMLSelectElement>('[data-context]').addEventListener('change', event => { context = (event.target as HTMLSelectElement).value as 'pve' | 'pvp'; render(); });
  el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-rule]').forEach(input => input.addEventListener('change', () => {
    if (selected === 'F') return;
    const r = profile()[selected];
    if (input instanceof HTMLInputElement) r[input.dataset.rule as 'origin' | 'masterwork' | 'enabled'] = input.checked;
    else if (input.dataset.rule === 'traits') r.traits = input.value as GradeRule['traits'];
    else r.extras = input.value as GradeRule['extras'];
    render(); saveRules();
  }));
  el.querySelectorAll<HTMLInputElement>('[data-hsv]').forEach(input => input.addEventListener('input', () => {
    hsv[Number(input.dataset.hsv)] = Number(input.value);
    const color = hsvToHex(hsv);
    draft.colors[selected] = color;
    get<HTMLInputElement>('[data-hex]').value = color.toUpperCase();
    get<HTMLInputElement>('[data-hex]').setCustomValidity('');
    renderColor(color); applyGradeColors(el, draft); saveColors();
  }));
  get<HTMLInputElement>('[data-hex]').addEventListener('input', event => {
    const input = event.target as HTMLInputElement;
    const valid = /^#[0-9a-f]{6}$/i.test(input.value);
    input.setCustomValidity(valid ? '' : 'Enter a six-digit hex color, such as #FFD700.');
    if (valid) { draft.colors[selected] = input.value.toLowerCase(); hsv = hexToHsv(input.value, hsv); renderColor(input.value); applyGradeColors(el, draft); saveColors(); }
    else get('[data-color-status]').textContent = 'Enter a six-digit hex color. DIM keeps the last valid color.';
  });
  get('[data-reset-color]').addEventListener('click', () => { delete draft.colors[selected]; render(); saveColors(); });
  get('[data-reset-colors]').addEventListener('click', () => { draft.colors = {}; render(); saveColors(); });
  get('[data-reset-rule]').addEventListener('click', () => {
    if (selected === 'F') return;
    profile()[selected] = defaultRules()[selected];
    render(); saveRules();
  });
  get('[data-reset-rules]').addEventListener('click', () => {
    draft.pve = defaultRules(); draft.pvp = defaultRules(); draft.separatePvp = false; context = 'pve';
    render(); saveRules();
  });
  chrome.storage.local.get(['aegisGradeSettings', 'aegisGradeColors'], res => { saved = normalizeGradeSettings(res.aegisGradeSettings, res.aegisGradeColors); draft = editableSettings(saved); render(); renderGuide(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.aegisGradeSettings) {
      saved = { ...normalizeGradeSettings(changes.aegisGradeSettings.newValue), colors: saved.colors, colorsEnabled: saved.colorsEnabled };
      renderGuide();
      if (!ruleWrites) { draft = { ...editableSettings(saved), colors: draft.colors, colorsEnabled: draft.colorsEnabled }; render(); }
    }
    if (changes.aegisGradeColors) {
      saved = normalizeGradeSettings(saved, changes.aegisGradeColors.newValue ?? { version: 1 });
      applyGuideColors();
      if (!colorWrites && (draft.colorsEnabled !== saved.colorsEnabled || JSON.stringify(draft.colors) !== JSON.stringify(saved.colors))) {
        draft.colors = saved.colorsEnabled ? { ...saved.colors } : {}; render();
      }
    }
  });
}
