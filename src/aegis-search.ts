import { parseScorePredicate, matchesScorePredicate } from './score-search';
import type { ScoreEvaluations, ScoreProfile } from './score-types';
import { gradeValue as getGradeValue } from './grading';
import { rollGradeDisplay } from './grade-colors';
import type { WeaponEvaluationPayload, ScoringResult, AegisSheetWeapon } from './types';

export interface SearchContext { mode: 'pve' | 'pvp' | 'both'; chase: boolean; source?: string; scoreProfile?: ScoreProfile; kind?: 'weapon' | 'armor' }
type SearchSheet = Pick<AegisSheetWeapon, 'tier' | 'source'>;
type SearchShopping = { priority: string };
export interface AegisSearchData {
  scoreEvaluations?: ScoreEvaluations;
  result: Pick<ScoringResult, 'grade' | 'pveGrade' | 'pvpGrade' | 'isPerfect5of5' | 'isOmniRoll' | 'upgradeAvailable'>;
  sheetWeapon?: SearchSheet | null;
  sheetWeaponPvE?: SearchSheet | null;
  sheetWeaponPvP?: SearchSheet | null;
  shoppingItem?: SearchShopping | null;
  shoppingItemPvE?: SearchShopping | null;
  shoppingItemPvP?: SearchShopping | null;
  shoppingAlt?: unknown;
  shoppingAltPvE?: unknown;
  shoppingAltPvP?: unknown;
  isBestInClass?: boolean;
  isBestInClassPvE?: boolean;
  isBestInClassPvP?: boolean;
}

/** Keep notes, icons, and full sheet rows out of the cross-world search index. */
export function compactSearchData(data: WeaponEvaluationPayload): AegisSearchData {
  const { grade, pveGrade, pvpGrade, isPerfect5of5, isOmniRoll, upgradeAvailable } = data.result;
  const sheet = (value: SearchSheet | null | undefined) => value ? { tier: value.tier, source: value.source } : null;
  const shopping = (value: SearchShopping | null | undefined) => value ? { priority: value.priority } : null;
  return {
    scoreEvaluations: data.scoreEvaluations,
    result: { grade, pveGrade, pvpGrade, isPerfect5of5, isOmniRoll, upgradeAvailable },
    sheetWeapon: sheet(data.sheetWeapon), sheetWeaponPvE: sheet(data.sheetWeaponPvE), sheetWeaponPvP: sheet(data.sheetWeaponPvP),
    shoppingItem: shopping(data.shoppingItem), shoppingItemPvE: shopping(data.shoppingItemPvE), shoppingItemPvP: shopping(data.shoppingItemPvP),
    shoppingAlt: !!data.shoppingAlt, shoppingAltPvE: !!data.shoppingAltPvE, shoppingAltPvP: !!data.shoppingAltPvP,
    isBestInClass: data.isBestInClass, isBestInClassPvE: data.isBestInClassPvE, isBestInClassPvP: data.isBestInClassPvP,
  };
}
export type AegisArgument = { ok: true; value: string } | { ok: false };
export interface SearchAvailability { ratings: boolean; shopping: boolean; source: boolean; armor: boolean; chase: boolean }
export function isAegisArgumentAvailable(value: string, available: SearchAvailability): boolean {
  if (value === 'chase') return available.chase;
  if (/^(?:shopping|shop|priority)(?::|$)/.test(value)) {
    return available.shopping && (!/^shopping:(?:ready|farm|suboptimal)$/.test(value) || available.ratings);
  }
  if (/^(?:s|source):/.test(value)) return available.source;
  if (/^(?:a|armor|2p|2piece|4p|4piece):/.test(value) || (value.includes('/') && value !== '5/5')) return available.armor;
  return available.ratings;
}
const aliases = new Set('5/5 perfect 5of5 godroll omni master allperks upgradeable upgradable upgrade god bis bestinclass chase shopping shop shopping:high priority:1 priority:high shopping:ready shopping:farm shopping:suboptimal shopping:alt shopping:alternative'.split(' '));
const rank = '(?:[sabcdef][+-]?){1,2}(?:➔[sabcdef][+-]?)?';
const gradeQuery = new RegExp('^(?:[><]=?|==?)?' + rank + '$');
export function parseAegisArgument(argument: string): AegisArgument {
  const value = argument.toLowerCase().trim();
  if (parseScorePredicate(value)) return { ok: true, value };
  if (aliases.has(value)) return { ok: true, value };
  if (/^(?:s|source):\S.*$/.test(value)) return { ok: true, value };
  const grade = value.replace(/^(?:a|armor):/, '').replace(/^(?:p|perk|w|weapon|pve|pvp|2p|2piece|4p|4piece):/, '');
  if (gradeQuery.test(grade) || new RegExp('^' + rank + '/' + rank + '$').test(grade)) return { ok: true, value };
  return { ok: false };
}
export function aegisQuery(argument: string): string {
  return 'aegis:' + (/\s|["\\]/.test(argument) ? JSON.stringify(argument) : argument);
}

export function compareGrades(itemGrade: string, queryStr: string): boolean {
  let normalizedGrade = itemGrade.toLowerCase().trim();

  // If it's a dual grade string like "f➔s+" or "bf➔s+", check if either equipped or potential grade matches
  if (normalizedGrade.includes('➔')) {
    const parts = normalizedGrade.split('➔');
    const equippedPart = parts[0];
    const potentialPart = parts[1];
    return compareGrades(equippedPart, queryStr) || compareGrades(potentialPart, queryStr);
  }

  // Empty or unavailable values are not ratings and must never compare as zero.
  if (!/^(?:[sabcdef][+-]?){1,2}$/.test(normalizedGrade)) return false;
  const isArmor = normalizedGrade.includes('/');
  const isTwoTier = !isArmor && (normalizedGrade.length > 2 || (normalizedGrade.length === 2 && !normalizedGrade.endsWith('+') && !normalizedGrade.endsWith('-')));
  const rollGradePart = isTwoTier ? normalizedGrade.substring(1) : normalizedGrade;
  const archTierPart = isTwoTier ? normalizedGrade.charAt(0) : '';

  const match = queryStr.match(/^([><]=?|==?)(.+)$/);

  if (match) {
    const op = match[1];
    const targetRank = match[2].trim().toLowerCase();
    const valItem = getGradeValue(rollGradePart) || getGradeValue(normalizedGrade);
    const valTarget = getGradeValue(targetRank);

    if (op === '>=') return valItem >= valTarget;
    if (op === '>') return valItem > valTarget;
    if (op === '<=') return valItem <= valTarget;
    if (op === '<') return valItem < valTarget;
    if (op === '=' || op === '==') {
      return normalizedGrade === targetRank || rollGradePart === targetRank || (isTwoTier && archTierPart === targetRank);
    }
  }

  const qLow = queryStr.toLowerCase().trim();
  return normalizedGrade === qLow || rollGradePart === qLow || (isTwoTier && archTierPart === qLow) || normalizedGrade.startsWith(qLow);
}

export function finalizeSearchGrade(result: ScoringResult, sheetWeapon: AegisSheetWeapon | null | undefined, mode: SearchContext['mode'], displayMode: 'equipped' | 'dual' | 'potential', twoTier: boolean): void {
  if (result.grade && mode !== 'both') {
    const isExotic = sheetWeapon && (sheetWeapon.exoticViability || sheetWeapon.source === 'Exotic');
    if (isExotic && sheetWeapon && sheetWeapon.tier) {
      result.grade = sheetWeapon.tier.trim();
    } else {
      const activeGrade = result.grade;
      const potentialGrade = result.potentialGrade;
      const hasHigherPotential = potentialGrade && potentialGrade !== activeGrade && getGradeValue(potentialGrade) > getGradeValue(activeGrade);

      if (hasHigherPotential) {
        result.upgradeAvailable = true;
      }

      let displayRollGrade = activeGrade;
      if (hasHigherPotential && displayMode === 'dual') {
        displayRollGrade = `${activeGrade}➔${potentialGrade}`;
      } else if (hasHigherPotential && displayMode === 'potential') {
        displayRollGrade = potentialGrade;
      }

      if (twoTier && sheetWeapon && sheetWeapon.tier && displayRollGrade) {
        result.grade = `${sheetWeapon.tier.trim()}${displayRollGrade}`;
      } else {
        result.grade = displayRollGrade;
      }
    }
  }

}

export function matchesAegisArgument(targetQuery: string, data: AegisSearchData, context: SearchContext): boolean {
  const score = parseScorePredicate(targetQuery);
  if (score && context.kind === 'armor') return false;
  if (score) return matchesScorePredicate(score, data.scoreEvaluations, context.mode, context.scoreProfile || 'best');
  const result = data?.result;
  const grade = result?.grade?.toLowerCase() || '';
  // A loaded but unrated item is not a zero-valued rating. In particular, it
  // must not enter a bulk action through a comparison such as "p:<a".
  if (!grade && !/^(?:(?:s|source):|(?:shopping|shop|priority)(?::|$)|chase$|bis$|bestinclass$)/.test(targetQuery)) return false;
  let isMatch = false;
  const isArmor = grade.includes('/');

  const shoppingItem = context.mode === 'pvp'
    ? data?.shoppingItemPvP
    : (context.mode === 'both'
        ? (data?.shoppingItemPvE || data?.shoppingItemPvP || data?.shoppingItem)
        : (data?.shoppingItemPvE || data?.shoppingItem));
  const shoppingAlt = context.mode === 'pvp'
    ? data?.shoppingAltPvP
    : (context.mode === 'both'
        ? (data?.shoppingAltPvE || data?.shoppingAltPvP || data?.shoppingAlt)
        : (data?.shoppingAltPvE || data?.shoppingAlt));
  const sheetW = context.mode === 'pvp'
    ? (data?.sheetWeaponPvP || data?.sheetWeapon)
    : (context.mode === 'both'
        ? (data?.sheetWeaponPvE || data?.sheetWeaponPvP || data?.sheetWeapon)
        : (data?.sheetWeaponPvE || data?.sheetWeapon));
  const isBestInClass = !!(context.mode === 'pvp'
    ? data?.isBestInClassPvP
    : (context.mode === 'both'
        ? (data?.isBestInClassPvE || data?.isBestInClassPvP || data?.isBestInClass)
        : (data?.isBestInClassPvE || data?.isBestInClass)));

  if (isArmor) {
    let cleanQuery = targetQuery;
    if (targetQuery.startsWith('a:') || targetQuery.startsWith('armor:')) {
      cleanQuery = targetQuery.startsWith('a:') ? targetQuery.substring(2) : targetQuery.substring(6);
    }

    const parts = grade.split('/');
    const rating2 = parts[0];
    const rating4 = parts[1];

    if (cleanQuery.startsWith('2p:') || cleanQuery.startsWith('2piece:')) {
      const targetRank = cleanQuery.startsWith('2p:') ? cleanQuery.substring(3) : cleanQuery.substring(7);
      isMatch = compareGrades(rating2, targetRank);
    } else if (cleanQuery.startsWith('4p:') || cleanQuery.startsWith('4piece:')) {
      const targetRank = cleanQuery.startsWith('4p:') ? cleanQuery.substring(3) : cleanQuery.substring(7);
      isMatch = compareGrades(rating4, targetRank);
    } else if (cleanQuery.includes('/')) {
      isMatch = (grade === cleanQuery);
    } else {
      isMatch = compareGrades(rating2, cleanQuery) || compareGrades(rating4, cleanQuery);
    }
  } else {
    if (targetQuery.startsWith('a:') || targetQuery.startsWith('armor:')) {
      isMatch = false;
    } else {
      const isSplit = grade.includes('|');
      const pvePart = rollGradeDisplay(result?.pveGrade || (isSplit ? grade.split('|')[0] : context.mode === 'pve' ? grade : ''));
      const pvpPart = rollGradeDisplay(result?.pvpGrade || (isSplit ? grade.split('|')[1] : context.mode === 'pvp' ? grade : ''));

      const weaponRank = sheetW?.tier || '';
      const perkRank = isSplit ? '' : rollGradeDisplay(grade);

      if (targetQuery === '5/5' || targetQuery === 'perfect' || targetQuery === '5of5' || targetQuery === 'godroll') {
        isMatch = !!result?.isPerfect5of5;
      } else if (targetQuery === 'omni' || targetQuery === 'master' || targetQuery === 'allperks') {
        isMatch = !!result?.isOmniRoll;
      } else if (targetQuery === 'upgradeable' || targetQuery === 'upgradable' || targetQuery === 'upgrade') {
        isMatch = !!result?.upgradeAvailable;
      } else if (targetQuery === 'god') {
        isMatch = isSplit
          ? (compareGrades(pvePart, '>=s') || compareGrades(pvpPart, '>=s'))
          : compareGrades(perkRank, '>=s');
      } else if (targetQuery === 'bis' || targetQuery === 'bestinclass') {
        isMatch = isBestInClass;
      } else if (targetQuery === 'chase') {
        isMatch = context.chase;
      } else if (targetQuery.startsWith('pve:')) {
        const q = targetQuery.substring(4);
        isMatch = compareGrades(pvePart, q);
      } else if (targetQuery.startsWith('pvp:')) {
        const q = targetQuery.substring(4);
        isMatch = compareGrades(pvpPart, q);
      } else if (targetQuery === 'shopping' || targetQuery === 'shop') {
        isMatch = !!shoppingItem;
      } else if (targetQuery === 'shopping:high' || targetQuery === 'priority:1' || targetQuery === 'priority:high') {
        isMatch = shoppingItem?.priority === 'high';
      } else if (targetQuery === 'shopping:ready') {
        isMatch = !!shoppingItem && (isSplit ? (compareGrades(pvePart, '>=a') || compareGrades(pvpPart, '>=a')) : compareGrades(perkRank, '>=a'));
      } else if (targetQuery === 'shopping:farm' || targetQuery === 'shopping:suboptimal') {
        isMatch = !!shoppingItem && !(isSplit ? (compareGrades(pvePart, '>=a') || compareGrades(pvpPart, '>=a')) : compareGrades(perkRank, '>=a'));
      } else if (targetQuery === 'shopping:alt' || targetQuery === 'shopping:alternative') {
        isMatch = !!shoppingAlt;
      } else if (targetQuery.startsWith('s:') || targetQuery.startsWith('source:')) {
        const targetSource = targetQuery.startsWith('s:') ? targetQuery.substring(2) : targetQuery.substring(7);
        const itemSource = sheetW?.source || context.source || '';
        isMatch = itemSource.toLowerCase().includes(targetSource.toLowerCase());
      } else if (targetQuery.startsWith('w:') || targetQuery.startsWith('weapon:')) {
        const targetRank = targetQuery.startsWith('w:') ? targetQuery.substring(2) : targetQuery.substring(7);
        isMatch = compareGrades(weaponRank, targetRank);
      } else if (targetQuery.startsWith('p:') || targetQuery.startsWith('perk:')) {
        const targetRank = targetQuery.startsWith('p:') ? targetQuery.substring(2) : targetQuery.substring(5);
        isMatch = isSplit
          ? (compareGrades(pvePart, targetRank) || compareGrades(pvpPart, targetRank))
          : compareGrades(perkRank, targetRank);
      } else {
        isMatch = isSplit
          ? (compareGrades(pvePart, targetQuery) || compareGrades(pvpPart, targetQuery))
          : (compareGrades(grade, targetQuery) || compareGrades(weaponRank, targetQuery) || compareGrades(perkRank, targetQuery));
      }
    }
  }

  return isMatch;
}
