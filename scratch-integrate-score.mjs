import fs from 'node:fs';
function edit(file,fn){const before=fs.readFileSync(file,'utf8');fs.writeFileSync(file,fn(before.replaceAll('\r\n','\n')));}
edit('src/content.ts',s=>{
 s=s.replace("import { parseScorePredicate, matchesScorePredicate } from './score-search';\n",'');
 s=s.replace("let scoreSettings: ScoreSettings", "const nativeScoreData = new Map<string, Pick<WeaponEvaluationPayload, 'scoreOwned' | 'scoreEvaluations'>>();\nlet scoreSettings: ScoreSettings");
 s=s.replace('if (badge.result.grade) injectBadge','if (badge.result.grade || scoresEnabled()) injectBadge');
 s=s.replace("    data = { ...evaluation, name: item.name, perksMap: {}, result };",`    const scores = evaluateScoreInput(item.name, item.hash, item.id, item.scoreOwned);
    nativeScoreData.set(item.id, scores);
    data = { ...evaluation, ...scores, name: item.name, perksMap: {}, result };`);
 s=s.replace('context: { mode: aegisMode, chase:', 'context: { mode: aegisMode, scoreProfile: scoreSettings.aegisScoreProfile, chase:');
 s=s.replace('function getBadgeTemplate(result: ScoringResult, styleKey: string): HTMLDivElement {',`function getBadgeTemplate(result: ScoringResult, styleKey: string, scoreData?: Pick<WeaponEvaluationPayload, 'scoreEvaluations' | 'sheetArmor'>): HTMLDivElement {
  const scoreDisplay = scoresEnabled() && !scoreData?.sheetArmor ? scorePresentation(scoreData?.scoreEvaluations, aegisMode, scoreSettings) : undefined;`);
 s=s.replace('    result.grade, result.isOmniRoll,', '    scoreDisplay?.html, scoreDisplay?.label, result.grade, result.isOmniRoll,');
 const start=s.indexOf('  const scoreData = weaponDataMap.get(el);\n  if (scoresEnabled()',s.indexOf('function getBadgeTemplate'));
 const end=s.indexOf("  badge.removeAttribute('aria-label');",start);
 s=s.slice(0,start)+`  if (scoreDisplay) {
    const posKey = aegisBadgePosition.replace('bottom-left', 'bl').replace('top-left', 'tl').replace('top-right', 'tr').replace('bottom-right', 'br');
    badge.classList.add('aegis-score', 'aegis-badge-wide', \`aegis-pos-\${posKey}\`, \`aegis-style-\${styleKey}\`);
    if (aegisFadeHover && styleKey !== 'footer') badge.classList.add('aegis-hover-fade');
    if (aegisMode === 'both') badge.classList.add('aegis-badge-split');
    badge.setAttribute('aria-label', scoreDisplay.label);
    badge.title = scoreDisplay.label;
    safeSetInnerHTML(badge, scoreDisplay.html);
    if (badgeTemplates.size >= 128) badgeTemplates.delete(badgeTemplates.keys().next().value!);
    badgeTemplates.set(key, badge);
    return badge;
  }
`+s.slice(end);
 s=s.replace("const template = getBadgeTemplate(result, 'classic');", "const scoreData = weaponDataMap.get(container) || nativeScoreData.get(container.getAttribute('data-aegis-instance-id') || container.id.replace('item-', ''));\n  const template = getBadgeTemplate(result, 'classic', scoreData);");
 s=s.replace("...inventoryGradeAppearance(text || '')", "...(template.classList.contains('aegis-score') ? { color: '#dae8f2', background: '#263442' } : inventoryGradeAppearance(text || ''))");
 s=s.replace('upgrade: result.upgradeAvailable === true', "upgrade: !template.classList.contains('aegis-score') && result.upgradeAvailable === true");
 s=s.replace("applyGradeGlow(badgeTarget, result.grade || '');", "applyGradeGlow(badgeTarget, scoresEnabled() ? '' : result.grade || '');");
 s=s.replace("if (aegisBadgeStyle === 'stat' && !IS_WINNOWER_HOST", "if (!scoresEnabled() && aegisBadgeStyle === 'stat' && !IS_WINNOWER_HOST");
 s=s.replace('const template = getBadgeTemplate(result, styleKey);', "const scoreData = weaponDataMap.get(el) || nativeScoreData.get(el.getAttribute('data-aegis-instance-id') || el.id.replace('item-', ''));\n  const template = getBadgeTemplate(result, styleKey, scoreData);");
 s=s.replace("  applyGradeColors(badge);\n  applyBadgePresentation", "  if (!badge.classList.contains('aegis-score')) applyGradeColors(badge);\n  applyBadgePresentation");
 s=s.replace("badge.title = result.customGrading ? t('customPerkGrading') : '';", "badge.title = template.title || (result.customGrading ? t('customPerkGrading') : '');\n  if (template.hasAttribute('aria-label')) badge.setAttribute('aria-label', template.getAttribute('aria-label')!);\n  else badge.removeAttribute('aria-label');");
 s=s.replace("cached?.perkHashes || perkHashesStr\n", "cached?.perkHashes || (perkHashesStr || '')\n");
 s=s.replace("  'data-aegis-item-exotic',\n", "  'data-aegis-score-owned',\n  'data-aegis-item-exotic',\n");
 s=s.replace("const scoringKeys = ['wishlistData'", "const scoringKeys = [...SCORE_SETTING_KEYS, 'wishlistData'");
 const pos=s.indexOf('function scoreFeedback');
 s=s.slice(0,pos)+`function evaluateScoreInput(name: string, hash: number, id: string, raw?: string) {
  const scoreOwned = parseOwnedSnapshot(raw || null, hash, value => canonicalScoreHash(value, enhancedToNormalMap), id || undefined);
  const scoreEvaluations: ScoreEvaluations = scoringSource === 'aegis' && aegisDbMode !== 'wishlist' ? {
    pve: evaluateOwnedActivity(aegisSheetDbPvE, 'pve', name, scoreOwned),
    pvp: evaluateOwnedActivity(aegisSheetDbPvP, 'pvp', name, scoreOwned),
  } : {};
  return { scoreOwned, scoreEvaluations };
}

`+s.slice(pos);
 return s;
});
edit('src/dim-item-input.ts',s=>s.replace("import { masterworkStatName }", "import { extractRawOwnedSnapshot } from './score-owned';\nimport { masterworkStatName }").replace('masterwork: string; variantText:', 'scoreOwned?: string; masterwork: string; variantText:').replace('masterwork: readDimMasterwork(item),', "scoreOwned: kind === 'weapon' ? JSON.stringify(extractRawOwnedSnapshot(item)) : undefined,\n    masterwork: readDimMasterwork(item),"));
edit('src/aegis-search.ts',s=>s.replace("import { gradeValue", "import { parseScorePredicate, matchesScorePredicate } from './score-search';\nimport type { ScoreEvaluations, ScoreProfile } from './score-types';\nimport { gradeValue").replace('chase: boolean; source?: string', 'chase: boolean; source?: string; scoreProfile?: ScoreProfile').replace('export interface AegisSearchData {', 'export interface AegisSearchData {\n  scoreEvaluations?: ScoreEvaluations;').replace('    result: { grade,', '    scoreEvaluations: data.scoreEvaluations,\n    result: { grade,').replace('  if (aliases.has(value))', '  if (parseScorePredicate(value)) return { ok: true, value };\n  if (aliases.has(value))').replace('  const result = data?.result;', "  const score = parseScorePredicate(targetQuery);\n  if (score) return matchesScorePredicate(score, data.scoreEvaluations, context.mode, context.scoreProfile || 'best');\n  const result = data?.result;"));
edit('src/main-world-content.ts',s=>s.replace('masterworkStatName(mw?.stats),', 'item.crafted, item.sockets?.fromDefinitions, masterworkStatName(mw?.stats),').replace('inputs.push(!!socket, socket?.plugOptions?.length);', 'inputs.push(!!socket, socket?.socketIndex, socket?.hasRandomizedPlugItems, !!socket?.plugSet?.craftingData, socket?.reusablePlugItems?.length, ...(socket?.reusablePlugItems || []).map((plug: any) => plug.plugItemHash), socket?.plugOptions?.length);\n    addPlug(socket?.actuallyPlugged?.plugDef);'));
edit('src/popup.ts',s=>s.replace("import { formatScore } from './score-format';\n",''));
edit('src/options-preview.ts',s=>{
 s="import { readScoreSettings } from './score-config';\nimport { formatScore } from './score-format';\nimport type { ScoreSettings } from './score-types';\n"+s;
 s=s.replace('interface PreviewSettings {','interface PreviewSettings extends Partial<ScoreSettings> {\n  scoringSource?: string;\n  aegisDbMode?: string;');
 s=s.replace("  const style = settings.aegisBadgeStyle || 'classic';", "  const useScores = settings.aegisRatingDisplay === 'scores' && settings.scoringSource !== 'lightgg' && settings.aegisDbMode !== 'wishlist';\n  const style = useScores && settings.aegisBadgeStyle === 'stat' ? 'classic' : settings.aegisBadgeStyle || 'classic';");
 s=s.replace("  const label = document.createElement('span');",`  if (useScores) {
    const scoreSettings = readScoreSettings(settings);
    const pve = formatScore({value: 87.234, perfectOverall: false}, scoreSettings.aegisScorePrecision);
    const pvp = formatScore({value: 92.456, perfectOverall: false}, scoreSettings.aegisScorePrecision);
    badge.classList.remove('aegis-badge-s');
    badge.classList.add('aegis-score');
    if (settings.aegisMode === 'both') {
      badge.classList.add('aegis-badge-split');
      badge.innerHTML = \`<span class="aegis-split-half aegis-split-left aegis-score">\${pve}</span><span class="aegis-split-half aegis-split-right aegis-score">\${pvp}</span>\`;
    } else badge.textContent = settings.aegisMode === 'pvp' ? pvp : pve;
    const visibility = normalizeBadgeVisibility(settings.aegisBadgeVisibility).weapon;
    applyBadgePresentation(badge, visibility);
    badge.classList.toggle('aegis-badge-hidden', visibility === 'off');
    applyGradeGlow(tile, '');
    return;
  }

  const label = document.createElement('span');`);
 return s;
});
