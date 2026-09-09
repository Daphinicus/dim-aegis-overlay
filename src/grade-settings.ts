import { GRADES, Grade, GradeRule, Slots, defaultGradeSettings, defaultRules, normalizeGradeSettings, evaluateCustomRoll, computeGrade, unreachableGrades } from './grading';
import { applyGradeColors } from './grade-colors';
import { safeSetInnerHTML } from './dom-utils';
import { Hsv, hexToHsv, hsvToHex } from './color-picker';

const swatches: Record<Grade, string> = { 'S+': '#ffd700', S: '#ffd700', 'A+': '#da70d6', A: '#da70d6', 'B+': '#00f2fe', B: '#00f2fe', C: '#bdc3c7', D: '#e67e22', F: '#e74c3c' };
const traitLabels: Record<GradeRule['traits'], string> = { both: 'Both main traits equipped', mixed: 'One equipped + other selectable', one: 'One main trait equipped', available: 'One equipped or one selectable' };
const extraLabels: Record<GradeRule['extras'], string> = { none: 'No requirement', mag: 'Magazine equipped', barrel: 'Barrel equipped', either: 'Barrel or magazine equipped', both: 'Barrel and magazine equipped' };
const slotLabels = ['Main trait 1', 'Main trait 2', 'Magazine', 'Barrel', 'Origin trait'];

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
  const slots: Slots = ['active', 'active', 'active', 'missing', 'active'];
  const get = <T extends HTMLElement>(selector: string) => el.querySelector<T>(selector)!;
  const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  safeSetInnerHTML(el, `
    <details>
      <summary>Grade colors and custom rules</summary>
      <p class="description">Personalize perk-roll grades while keeping Aegis/Finnald recommendations. Weapon tiers, exotic viability, wishlist grades and Light.gg grades keep their original rules.</p>
      <label class="grade-check"><input type="checkbox" data-setting="colorsEnabled"> Use custom grade colors</label>
      <p class="description">Colors save automatically and update DIM as you edit.</p>
      <p class="description" data-color-status role="status"></p>
      <label class="grade-check"><input type="checkbox" data-setting="rulesEnabled"> Use custom perk grading</label>
      <div class="grade-pills" role="group" aria-label="Grade to edit">${GRADES.map(g => `<button type="button" data-grade="${g}" aria-pressed="false">${g}</button>`).join('')}</div>
      <div class="grade-fields">
        <div class="grade-color-preview" data-color role="img" aria-label="Selected grade color"></div>
        <label>Hex color <input type="text" data-hex maxlength="7" spellcheck="false" aria-label="Selected grade hex color"></label>
      </div>
      <div class="grade-color-sliders">${['Hue', 'Saturation', 'Brightness'].map((label, index) => `<label>${label}<input type="range" data-hsv="${index}" min="0" max="${index === 0 ? 360 : 100}" step="1" aria-label="${label}"></label>`).join('')}</div>
      <div class="grade-actions"><button type="button" class="btn btn-secondary" data-reset-color>Reset this color</button><button type="button" class="btn btn-secondary" data-reset-colors>Reset all colors</button></div>
      <p class="description" data-color-state></p>
      <div class="grade-rule-section">
        <label class="grade-check"><input type="checkbox" data-setting="separatePvp"> Use different rules for PvP</label>
        <label data-context-label>Rules to edit <select data-context><option value="pve">PvE</option><option value="pvp">PvP</option></select></label>
        <h3 data-rule-title></h3>
        <div class="grade-fields" data-rule-fields>
          <label>Main traits <select data-rule="traits">${options(traitLabels)}</select></label>
          <label>Barrel / magazine <select data-rule="extras">${options(extraLabels)}</select></label>
          <label class="grade-check"><input type="checkbox" data-rule="origin"> Origin trait equipped</label>
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
        <div class="grade-results" aria-live="polite">
          <span>Default <span class="aegis-popup-grade-badge" data-result="default"></span></span>
          <span>Your rules <span class="aegis-popup-grade-badge" data-result="current"></span></span>
          <span>After swaps <span class="aegis-popup-grade-badge" data-result="potential"></span></span>
          <p class="description" data-reason></p>
        </div>
      </details>
      <div class="grade-actions"><button type="button" class="btn btn-primary" data-apply>Apply grading rules</button><button type="button" class="btn btn-secondary" data-cancel>Cancel rule changes</button></div>
      <p class="description" data-status role="status"></p>
    </details>
  `);

  function profile() { return draft[context === 'pvp' && draft.separatePvp ? 'pvp' : 'pve']; }
  function setDirty() {
    dirty = JSON.stringify({ ...draft, colors: {}, colorsEnabled: false }) !== JSON.stringify({ ...saved, colors: {}, colorsEnabled: false });
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
    const custom = draft.rulesEnabled ? evaluateCustomRoll(slots, profile()) : { grade: defaultGrade, potentialGrade: computeGrade(...slots, true) };
    for (const [key, grade] of Object.entries({ default: defaultGrade, current: custom.grade, potential: custom.potentialGrade })) {
      const badge = get(`[data-result="${key}"]`);
      badge.className = `aegis-popup-grade-badge aegis-badge-${grade[0].toLowerCase()}`;
      badge.textContent = grade;
    }
    const grade = custom.grade;
    const r = draft.rulesEnabled && grade !== 'F' ? profile()[grade] : null;
    get('[data-reason]').textContent = !draft.rulesEnabled ? 'Original grading rules.' : r
      ? `${grade}: ${traitLabels[r.traits]}; ${extraLabels[r.extras].toLowerCase()}${r.origin ? '; origin trait equipped' : ''}.`
      : 'No enabled rule matched.';
    applyGradeColors(el, draft);
  }
  function renderColor(color: string) {
    get('[data-color]').style.background = color;
    get('[data-color]').setAttribute('aria-label', `${selected} color ${color.toUpperCase()}`);
    el.querySelectorAll<HTMLInputElement>('[data-hsv]').forEach(input => {
      const index = Number(input.dataset.hsv);
      input.value = String(hsv[index]);
      input.disabled = !draft.colorsEnabled;
      input.setAttribute('aria-valuetext', `${Math.round(hsv[index])}${index === 0 ? ' degrees' : ' percent'}`);
    });
    get('[data-hsv="1"]').style.background = `linear-gradient(to right, ${hsvToHex([hsv[0], 0, hsv[2]])}, ${hsvToHex([hsv[0], 100, hsv[2]])})`;
    get('[data-hsv="2"]').style.background = `linear-gradient(to right, #000000, ${hsvToHex([hsv[0], hsv[1], 100])})`;
    get('[data-color-state]').textContent = draft.colors[selected] ? 'Custom solid color; white text with shadow.' : 'Original gradient. Choose a color to override it.';
  }
  function render() {
    el.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input => { input.checked = draft[input.dataset.setting as 'colorsEnabled' | 'rulesEnabled' | 'separatePvp']; });
    el.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.grade === selected)); });
    const color = draft.colors[selected] || swatches[selected];
    hsv = hexToHsv(color, hsv);
    renderColor(color);
    get<HTMLInputElement>('[data-hex]').value = color.toUpperCase();
    get<HTMLInputElement>('[data-hex]').setCustomValidity('');
    get<HTMLInputElement>('[data-hex]').disabled = !draft.colorsEnabled;
    get('[data-context-label]').hidden = !draft.separatePvp;
    get<HTMLSelectElement>('[data-context]').value = context;
    get('[data-rule-title]').textContent = `${selected} requirements · ${draft.separatePvp ? context.toUpperCase() : 'PvE + PvP'}`;
    get('[data-rule-fields]').hidden = selected === 'F';
    get('[data-fallback]').hidden = selected !== 'F';
    el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-rule]').forEach(input => {
      input.disabled = !draft.rulesEnabled;
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
  el.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input => input.addEventListener('change', () => {
    const key = input.dataset.setting as 'colorsEnabled' | 'rulesEnabled' | 'separatePvp';
    draft[key] = input.checked;
    if (key === 'separatePvp' && !input.checked) context = 'pve';
    render();
    if (key === 'colorsEnabled') saveColors();
  }));
  el.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach(button => button.addEventListener('click', () => { selected = button.dataset.grade as Grade; render(); }));
  get<HTMLSelectElement>('[data-context]').addEventListener('change', event => { context = (event.target as HTMLSelectElement).value as 'pve' | 'pvp'; render(); });
  el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-rule]').forEach(input => input.addEventListener('change', () => {
    if (selected === 'F') return;
    const r = profile()[selected];
    if (input instanceof HTMLInputElement) r[input.dataset.rule as 'origin' | 'enabled'] = input.checked;
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
  get('[data-cancel]').addEventListener('click', () => { draft = { ...structuredClone(saved), colors: draft.colors, colorsEnabled: draft.colorsEnabled }; render(); });
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
      setDirty();
      if (!dirty) get('[data-status]').textContent = 'Applied. DIM updates automatically.';
    });
  });
  chrome.storage.local.get(['aegisGradeSettings', 'aegisGradeColors'], res => { saved = normalizeGradeSettings(res.aegisGradeSettings, res.aegisGradeColors); draft = structuredClone(saved); render(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.aegisGradeSettings) {
      saved = { ...normalizeGradeSettings(changes.aegisGradeSettings.newValue), colors: saved.colors, colorsEnabled: saved.colorsEnabled };
      if (!dirty) { draft = { ...structuredClone(saved), colors: draft.colors, colorsEnabled: draft.colorsEnabled }; render(); }
    }
    if (changes.aegisGradeColors) {
      saved = normalizeGradeSettings(saved, changes.aegisGradeColors.newValue ?? { version: 1 });
      if (!colorWrites && (draft.colorsEnabled !== saved.colorsEnabled || JSON.stringify(draft.colors) !== JSON.stringify(saved.colors))) {
        draft.colors = { ...saved.colors }; draft.colorsEnabled = saved.colorsEnabled; render();
      }
    }
  });
}
