import { GRADES, Grade, GradeRule, GradeSettings, Slots, defaultGradeSettings, defaultRules, normalizeGradeSettings, evaluateCustomRoll, computeGrade, unreachableGrades } from './grading';
import { applyGradeColors, gradeGradient } from './grade-colors';
import { safeSetInnerHTML } from './dom-utils';
import { Hsv, hexToHsv, hsvToHex } from './color-picker';

const swatches: Record<Grade, string> = { 'S+': '#ffd700', S: '#ffd700', 'A+': '#da70d6', A: '#da70d6', 'B+': '#00f2fe', B: '#00f2fe', C: '#bdc3c7', D: '#e67e22', E: '#7f8c8d', F: '#e74c3c' };
const traitLabels: Record<GradeRule['traits'], string> = { both: 'Both main traits equipped', mixed: 'One equipped + other selectable', one: 'One main trait equipped', available: 'One equipped or one selectable' };
const extraLabels: Record<GradeRule['extras'], string> = { none: 'No requirement', mag: 'Magazine equipped', barrel: 'Barrel equipped', either: 'Barrel or magazine equipped', both: 'Barrel and magazine equipped' };
const slotLabels = ['Main trait 1', 'Main trait 2', 'Magazine', 'Barrel', 'Origin trait'];
const defaultGuide: Record<Grade, string> = {
  'S+': 'Traits 1 & 2 + Mag + Barrel + Origin', S: 'Traits 1 & 2 + Magazine matched',
  'A+': 'Traits 1 & 2 + Barrel matched', A: 'Traits 1 & 2 both matched',
  'B+': '1 Trait active + 1 selectable + Mag/Barrel', B: '1 Trait active + 1 selectable Trait',
  C: '1 Trait matched + Magazine or Barrel', D: 'Only 1 Trait matched', E: '1 Trait active/selectable', F: 'Underperforming (no Traits matched)',
};

export function initGradeSettings() {
  const root = document.getElementById('aegis-grade-settings');
  if (!root) return;
  const el = root;
  let saved = defaultGradeSettings();
  let draft = defaultGradeSettings();
  let selected: Grade = 'S';
  let context: 'pve' | 'pvp' = 'pve';
  let dirty = false;
  let saving = false;
  let colorWrites = 0;
  let hsv: Hsv = [0, 100, 100];
  let masterworkMatched = true;
  const slots: Slots = ['active', 'active', 'active', 'missing', 'active'];
  const get = <T extends HTMLElement>(selector: string) => el.querySelector<T>(selector)!;
  const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  safeSetInnerHTML(el, `
<dialog id="grade-colors-modal" class="grade-modal" aria-labelledby="grade-colors-modal-title"><div class="changelog-modal-card"><div class="changelog-modal-header"><h2 id="grade-colors-modal-title" class="changelog-title">Grade colors</h2><button type="button" class="changelog-close-x" data-close aria-label="Close Grade colors">&times;</button></div><div class="changelog-modal-body">
      <p class="description" data-color-status role="status"></p>
      <div class="grade-pills" role="group" aria-label="Grade to edit">${GRADES.map(g => `<button type="button" class="aegis-badge-${g[0].toLowerCase()}" data-grade="${g}" data-aegis-grade="${g}" aria-pressed="false">${g}</button>`).join('')}</div>
      <div class="grade-color-fields">
        <div class="grade-color-preview" data-color role="img" aria-label="Selected grade color"></div>
        <input type="text" data-hex maxlength="7" spellcheck="false" aria-label="Selected grade hex color">
      </div>
      <div class="grade-color-sliders">${['Hue', 'Saturation', 'Brightness'].map((label, index) => `<input type="range" data-hsv="${index}" min="0" max="${index === 0 ? 360 : 100}" step="1" aria-label="${label}">`).join('')}</div>
      <div class="grade-actions grade-color-actions"><button type="button" class="btn btn-secondary" data-reset-color>Reset selected</button><button type="button" class="btn btn-secondary" data-reset-colors>Reset all</button></div>
</div></div></dialog><dialog id="grade-rules-modal" class="grade-modal" aria-labelledby="grade-rules-modal-title"><div class="changelog-modal-card"><div class="changelog-modal-header"><h2 id="grade-rules-modal-title" class="changelog-title">Grading criteria</h2><button type="button" class="changelog-close-x" data-close aria-label="Close Grading criteria">&times;</button></div><div class="changelog-modal-body"><p class="description">Keep Aegis/Finnald recommendations and choose how perk matches translate into grades. Weapon tiers, exotic viability, wishlist and Light.gg grades keep their original rules.</p><div class="grade-pills" role="group" aria-label="Grade to edit">${GRADES.map(g => `<button type="button" class="aegis-badge-${g[0].toLowerCase()}" data-grade="${g}" data-aegis-grade="${g}" aria-pressed="false">${g}</button>`).join('')}</div>      <div class="grade-rule-section">
        <label class="grade-check"><input type="checkbox" data-setting="separatePvp"> Use different rules for PvP</label>
        <label data-context-label>Rules to edit <select data-context><option value="pve">PvE</option><option value="pvp">PvP</option></select></label>
        <h3 data-rule-title></h3>
        <p class="description" data-optional-grade>E is a weapon tier by default. Enable it below for perk grading.</p>
        <div class="grade-fields" data-rule-fields>
          <label>Main traits <select data-rule="traits">${options(traitLabels)}</select></label>
          <label>Barrel / magazine <select data-rule="extras">${options(extraLabels)}</select></label>
          <label class="grade-check"><input type="checkbox" data-rule="origin"> Origin trait equipped</label>
          <label class="grade-check" title="Ignored when no masterwork is recommended"><input type="checkbox" data-rule="masterwork"> Recommended masterwork matched</label>
          <label class="grade-check"><input type="checkbox" data-rule="enabled"> Enable this grade</label>
        </div>
        <p class="description" data-fallback>F is the fallback when no enabled rule matches.</p>
        <p class="description">All requirements refer to recommended perks. Highest matching grade wins. Slots without a recommendation count as satisfied.</p>
        <button type="button" class="btn btn-secondary" data-reset-rules>Reset rules for this profile</button>
        <p class="grade-warning" data-warning role="status"></p>
      </div>
      <details class="grade-example" open>
        <summary>Try an example roll</summary>
        <div class="grade-fields">${slotLabels.map((label, index) => `<label>${label}<select data-slot="${index}"><option value="active">Equipped</option><option value="selectable">Selectable</option><option value="missing">Missing</option></select></label>`).join('')}</div>
        <label class="grade-check"><input type="checkbox" data-masterwork-match checked> Recommended MW matched</label>
        <div class="grade-results" aria-live="polite">
          <span>Default <span class="aegis-popup-grade-badge" data-result="default"></span></span>
          <span>Your rules <span class="aegis-popup-grade-badge" data-result="current"></span></span>
          <span>After swaps <span class="aegis-popup-grade-badge" data-result="potential"></span></span>
          <p class="description" data-reason></p>
        </div>
      </details>
      <div class="grade-actions"><button type="button" class="btn btn-primary" data-apply>Apply grading rules</button><button type="button" class="btn btn-secondary" data-cancel>Cancel rule changes</button></div>
      <p class="description" data-status role="status"></p>
</div></div></dialog>
  `);

  for (const [buttonId, dialogId] of [['open-grade-colors-btn', 'grade-colors-modal'], ['open-grade-rules-btn', 'grade-rules-modal']]) {
    const dialog = get<HTMLDialogElement>(`#${dialogId}`);
    document.getElementById(buttonId)?.addEventListener('click', () => { if (!dialog.open) dialog.showModal(); });
    dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button, input, select, summary')].filter(control => !control.matches(':disabled') && control.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
  }

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
  function setDirty() {
    const rules = (settings: GradeSettings) => JSON.stringify([settings.separatePvp, settings.pve, settings.separatePvp ? settings.pvp : null]);
    dirty = rules(draft) !== rules(editableSettings(saved));
    get<HTMLButtonElement>('[data-apply]').disabled = saving || !dirty;
    get<HTMLButtonElement>('[data-cancel]').disabled = saving || !dirty;
    get('[data-status]').textContent = dirty ? 'Unsaved grading rules. Apply to update DIM.' : '';
  }
  function saveColors() {
    const palette = { version: 1, colorsEnabled: draft.colorsEnabled, colors: { ...draft.colors } };
    colorWrites++;
    get('[data-color-status]').textContent = 'Saving colors…';
    chrome.storage.local.set({ aegisGradeColors: palette }, () => {
      colorWrites--;
      const error = chrome.runtime.lastError;
      if (error) get('[data-color-status]').textContent = `Could not save colors: ${error.message}. Adjust a color to retry.`;
      else if (!colorWrites) get('[data-color-status]').textContent = 'Colors saved. DIM updates automatically.';
    });
  }
  function preview() {
    const defaultGrade = computeGrade(...slots, false);
    const custom = draft.rulesEnabled ? evaluateCustomRoll(slots, profile(), masterworkMatched) : { grade: defaultGrade, potentialGrade: computeGrade(...slots, true) };
    for (const [key, grade] of Object.entries({ default: defaultGrade, current: custom.grade, potential: custom.potentialGrade })) {
      const badge = get(`[data-result="${key}"]`);
      badge.className = `aegis-popup-grade-badge aegis-badge-${grade[0].toLowerCase()}`;
      badge.textContent = grade;
    }
    const grade = custom.grade;
    const r = draft.rulesEnabled && grade !== 'F' ? profile()[grade] : null;
    get('[data-reason]').textContent = !draft.rulesEnabled ? 'Original grading rules.' : r
      ? `${grade}: ${traitLabels[r.traits]}; ${extraLabels[r.extras].toLowerCase()}${r.origin ? '; origin trait equipped' : ''}${r.masterwork ? '; MW matched' : ''}.`
      : 'No enabled rule matched.';
    applyGradeColors(el, draft);
  }
  function renderColor(color: string) {
    draft.colorsEnabled = Object.keys(draft.colors).length > 0;
    get('[data-color]').style.background = gradeGradient(color);
    get('[data-color]').setAttribute('aria-label', `${selected} color ${color.toUpperCase()}`);
    el.querySelectorAll<HTMLInputElement>('[data-hsv]').forEach(input => {
      const index = Number(input.dataset.hsv);
      input.value = String(hsv[index]);
      input.setAttribute('aria-valuetext', `${Math.round(hsv[index])}${index === 0 ? ' degrees' : ' percent'}`);
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
    get('[data-context-label]').hidden = !draft.separatePvp;
    get<HTMLSelectElement>('[data-context]').value = context;
    get('[data-rule-title]').textContent = `${selected} requirements · ${draft.separatePvp ? context.toUpperCase() : 'PvE + PvP'}`;
    get('[data-optional-grade]').hidden = selected !== 'E';
    get('[data-rule-fields]').hidden = selected === 'F';
    get('[data-fallback]').hidden = selected !== 'F';
    el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-rule]').forEach(input => {
      if (selected === 'F') return;
      const value = profile()[selected][input.dataset.rule as keyof GradeRule];
      if (input instanceof HTMLInputElement) input.checked = value as boolean;
      else input.value = value as string;
    });
    const unreachable = draft.rulesEnabled ? unreachableGrades(profile()) : [];
    get('[data-warning]').textContent = unreachable.length ? `Unreachable grades: ${unreachable.join(', ')}. Higher rules always win first.` : '';
    el.querySelectorAll<HTMLSelectElement>('[data-slot]').forEach(select => { select.value = slots[Number(select.dataset.slot)]; });
    preview(); setDirty();
  }
  get<HTMLInputElement>('[data-setting="separatePvp"]').addEventListener('change', event => {
    draft.separatePvp = (event.target as HTMLInputElement).checked;
    if (!draft.separatePvp) context = 'pve';
    render();
  });
  el.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach(button => button.addEventListener('click', () => { selected = button.dataset.grade as Grade; render(); }));
  get<HTMLSelectElement>('[data-context]').addEventListener('change', event => { context = (event.target as HTMLSelectElement).value as 'pve' | 'pvp'; render(); });
  el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-rule]').forEach(input => input.addEventListener('change', () => {
    if (selected === 'F') return;
    const r = profile()[selected];
    if (input instanceof HTMLInputElement) r[input.dataset.rule as 'origin' | 'masterwork' | 'enabled'] = input.checked;
    else if (input.dataset.rule === 'traits') r.traits = input.value as GradeRule['traits'];
    else r.extras = input.value as GradeRule['extras'];
    render();
  }));
  el.querySelectorAll<HTMLInputElement>('[data-hsv]').forEach(input => input.addEventListener('input', () => {
    hsv[Number(input.dataset.hsv)] = Number(input.value);
    const color = hsvToHex(hsv);
    draft.colors[selected] = color;
    get<HTMLInputElement>('[data-hex]').value = color.toUpperCase();
    get<HTMLInputElement>('[data-hex]').setCustomValidity('');
    renderColor(color); preview(); saveColors();
  }));
  get<HTMLInputElement>('[data-hex]').addEventListener('input', event => {
    const input = event.target as HTMLInputElement;
    const valid = /^#[0-9a-f]{6}$/i.test(input.value);
    input.setCustomValidity(valid ? '' : 'Enter a six-digit hex color, such as #FFD700.');
    if (valid) { draft.colors[selected] = input.value.toLowerCase(); hsv = hexToHsv(input.value, hsv); renderColor(input.value); preview(); saveColors(); }
    else get('[data-color-status]').textContent = 'Enter a six-digit hex color. DIM keeps the last valid color.';
  });
  get('[data-reset-color]').addEventListener('click', () => { delete draft.colors[selected]; render(); saveColors(); });
  get('[data-reset-colors]').addEventListener('click', () => { draft.colors = {}; render(); saveColors(); });
  get('[data-reset-rules]').addEventListener('click', () => { draft[context === 'pvp' && draft.separatePvp ? 'pvp' : 'pve'] = defaultRules(); render(); });
  el.querySelectorAll<HTMLSelectElement>('[data-slot]').forEach(select => select.addEventListener('change', () => { slots[Number(select.dataset.slot)] = select.value as Slots[number]; preview(); }));
  get<HTMLInputElement>('[data-masterwork-match]').addEventListener('change', event => { masterworkMatched = (event.target as HTMLInputElement).checked; preview(); });
  get('[data-cancel]').addEventListener('click', () => { draft = { ...editableSettings(saved), colors: draft.colors, colorsEnabled: draft.colorsEnabled }; render(); });
  get('[data-apply]').addEventListener('click', () => {
    if (saving) return;
    saving = true;
    const submitted = normalizeGradeSettings(draft);
    setDirty();
    chrome.storage.local.set({ aegisGradeSettings: submitted }, () => {
      saving = false;
      const error = chrome.runtime.lastError;
      if (error) { setDirty(); get('[data-status]').textContent = `Could not save: ${error.message}`; return; }
      saved = { ...submitted, colors: saved.colors, colorsEnabled: saved.colorsEnabled };
      renderGuide();
      setDirty();
      if (!dirty) get('[data-status]').textContent = 'Applied. DIM updates automatically.';
    });
  });
  chrome.storage.local.get(['aegisGradeSettings', 'aegisGradeColors'], res => { saved = normalizeGradeSettings(res.aegisGradeSettings, res.aegisGradeColors); draft = editableSettings(saved); render(); renderGuide(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.aegisGradeSettings) {
      saved = { ...normalizeGradeSettings(changes.aegisGradeSettings.newValue), colors: saved.colors, colorsEnabled: saved.colorsEnabled };
      renderGuide();
      if (!dirty) { draft = { ...editableSettings(saved), colors: draft.colors, colorsEnabled: draft.colorsEnabled }; render(); }
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
