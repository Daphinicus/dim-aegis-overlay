import { GRADES, Grade, GradeRule, Slots, defaultGradeSettings, defaultRules, normalizeGradeSettings, evaluateCustomRoll, computeGrade, unreachableGrades } from './grading';
import { applyGradeColors } from './grade-colors';
import { safeSetInnerHTML } from './dom-utils';

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
  const slots: Slots = ['active', 'active', 'active', 'missing', 'active'];
  const get = <T extends HTMLElement>(selector: string) => el.querySelector<T>(selector)!;
  const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  safeSetInnerHTML(el, `
    <details>
      <summary>Grade colors and custom rules</summary>
      <p class="description">Personalize perk-roll grades while keeping Aegis/Finnald recommendations. Weapon tiers, exotic viability, wishlist grades and Light.gg grades keep their original rules.</p>
      <label class="grade-check"><input type="checkbox" data-setting="colorsEnabled"> Use custom grade colors</label>
      <label class="grade-check"><input type="checkbox" data-setting="rulesEnabled"> Use custom perk grading</label>
      <div class="grade-pills" role="group" aria-label="Grade to edit">${GRADES.map(g => `<button type="button" data-grade="${g}" aria-pressed="false">${g}</button>`).join('')}</div>
      <div class="grade-fields">
        <label>Badge color <input type="color" data-color aria-label="Selected grade color"></label>
        <label>Hex color <input type="text" data-hex maxlength="7" spellcheck="false" aria-label="Selected grade hex color"></label>
      </div>
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
      <div class="grade-actions"><button type="button" class="btn btn-primary" data-apply>Apply changes</button><button type="button" class="btn btn-secondary" data-cancel>Cancel changes</button></div>
      <p class="description" data-status role="status"></p>
    </details>
  `);

  function profile() { return draft[context === 'pvp' && draft.separatePvp ? 'pvp' : 'pve']; }
  function setDirty() {
    dirty = JSON.stringify(draft) !== JSON.stringify(saved);
    get<HTMLButtonElement>('[data-apply]').disabled = saving || !dirty;
    get<HTMLButtonElement>('[data-cancel]').disabled = saving || !dirty;
    get('[data-status]').textContent = dirty ? 'Unsaved changes. Apply once to update DIM.' : '';
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
  function render() {
    el.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input => { input.checked = draft[input.dataset.setting as 'colorsEnabled' | 'rulesEnabled' | 'separatePvp']; });
    el.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.grade === selected)); });
    const color = draft.colors[selected] || swatches[selected];
    get<HTMLInputElement>('[data-color]').value = color;
    get<HTMLInputElement>('[data-hex]').value = color.toUpperCase();
    get<HTMLInputElement>('[data-hex]').setCustomValidity('');
    get<HTMLInputElement>('[data-color]').disabled = !draft.colorsEnabled;
    get<HTMLInputElement>('[data-hex]').disabled = !draft.colorsEnabled;
    get('[data-color-state]').textContent = draft.colors[selected] ? 'Custom solid color; text contrast is automatic.' : 'Original gradient. Choose a color to override it.';
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
  get<HTMLInputElement>('[data-color]').addEventListener('input', event => { draft.colors[selected] = (event.target as HTMLInputElement).value; render(); });
  get<HTMLInputElement>('[data-hex]').addEventListener('input', event => {
    const input = event.target as HTMLInputElement;
    const valid = /^#[0-9a-f]{6}$/i.test(input.value);
    input.setCustomValidity(valid ? '' : 'Enter a six-digit hex color, such as #FFD700.');
    if (valid) { draft.colors[selected] = input.value.toLowerCase(); get<HTMLInputElement>('[data-color]').value = input.value; preview(); setDirty(); }
    else get<HTMLButtonElement>('[data-apply]').disabled = true;
  });
  get('[data-reset-color]').addEventListener('click', () => { delete draft.colors[selected]; render(); });
  get('[data-reset-colors]').addEventListener('click', () => { draft.colors = {}; render(); });
  get('[data-reset-rules]').addEventListener('click', () => { draft[context === 'pvp' && draft.separatePvp ? 'pvp' : 'pve'] = defaultRules(); render(); });
  el.querySelectorAll<HTMLSelectElement>('[data-slot]').forEach(select => select.addEventListener('change', () => { slots[Number(select.dataset.slot)] = select.value as Slots[number]; preview(); }));
  get('[data-cancel]').addEventListener('click', () => { draft = structuredClone(saved); render(); });
  get('[data-apply]').addEventListener('click', () => {
    if (saving || !get<HTMLInputElement>('[data-hex]').reportValidity()) return;
    saving = true;
    const submitted = normalizeGradeSettings(draft);
    setDirty();
    chrome.storage.local.set({ aegisGradeSettings: submitted }, () => {
      saving = false;
      const error = chrome.runtime.lastError;
      if (error) { setDirty(); get('[data-status]').textContent = `Could not save: ${error.message}`; return; }
      saved = submitted;
      setDirty();
      if (!dirty) get('[data-status]').textContent = 'Applied. DIM updates automatically.';
    });
  });
  chrome.storage.local.get(['aegisGradeSettings'], res => { saved = normalizeGradeSettings(res.aegisGradeSettings); draft = structuredClone(saved); render(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.aegisGradeSettings) return;
    saved = normalizeGradeSettings(changes.aegisGradeSettings.newValue);
    if (!dirty) { draft = structuredClone(saved); render(); }
  });
}
