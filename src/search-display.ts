import { t } from './i18n';
import { parseAegisArgument } from './aegis-search';
import { tokenizeSearch } from './search-syntax';

export const SEARCH_DISPLAY_ATTRIBUTE = 'data-aegis-search-display';
export const SEARCH_DISPLAY_MODES = ['classic', 'exact', 'readable'] as const;
export type SearchDisplayMode = typeof SEARCH_DISPLAY_MODES[number];

export function normalizeSearchDisplay(value: unknown): SearchDisplayMode {
  return value === 'classic' || value === 'readable' ? value : 'exact';
}

export interface SearchTermLabel { text: string; operator?: string; icon?: string }

// These are the same Bungie breaker icons used in Aegis's perk tooltips.
const breakerIcons: Record<string, string> = {
  barrier: '07b9ba0194e85e46b258b04783e93d5d',
  overload: 'da558352b624d799cf50de14d7cb9565',
  unstoppable: '825a438c85404efd6472ff9e97fc7251',
};
const nativeLabels: Record<string, string> = {
  "weapon": 'searchLabelWeapon',
  "armor": 'searchLabelArmor',
  "exotic": 'searchLabelExotic',
  "legendary": 'searchLabelLegendary',
  "rare": 'searchLabelRare',
  "common": 'searchLabelCommon',
  "uncommon": 'searchLabelUncommon',
  "kinetic": 'searchLabelKinetic',
  "energy": 'searchLabelEnergy',
  "heavy": 'searchLabelHeavy',
  "primary": 'searchLabelPrimary',
  "special": 'searchLabelSpecial',
  "arc": 'searchLabelArc',
  "solar": 'searchLabelSolar',
  "void": 'searchLabelVoid',
  "stasis": 'searchLabelStasis',
  "strand": 'searchLabelStrand',
  "prismatic": 'searchLabelPrismatic',
  "hunter": 'searchLabelHunter',
  "titan": 'searchLabelTitan',
  "warlock": 'searchLabelWarlock',
  "locked": 'searchLabelLocked',
  "unlocked": 'searchLabelUnlocked',
  "crafted": 'searchLabelCrafted',
  "masterwork": 'searchLabelMasterwork',
  "handcannon": 'searchLabelHandcannon',
  "autorifle": 'searchLabelAutorifle',
  "pulserifle": 'searchLabelPulserifle',
  "scoutrifle": 'searchLabelScoutrifle',
  "sidearm": 'searchLabelSidearm',
  "smg": 'searchLabelSmg',
  "submachinegun": 'searchLabelSmg',
  "bow": 'searchLabelBow',
  "shotgun": 'searchLabelShotgun',
  "sniperrifle": 'searchLabelSniperrifle',
  "fusionrifle": 'searchLabelFusionrifle',
  "linearfusionrifle": 'searchLabelLinearfusionrifle',
  "trace": 'searchLabelTrace',
  "tracerifle": 'searchLabelTrace',
  "grenadelauncher": 'searchLabelGrenadelauncher',
  "rocketlauncher": 'searchLabelRocketlauncher',
  "machinegun": 'searchLabelMachinegun',
  "sword": 'searchLabelSword',
  "glaive": 'searchLabelGlaive',
  "helmet": 'searchLabelHelmet',
  "gauntlets": 'searchLabelGauntlets',
  "chest": 'searchLabelChest',
  "leg": 'searchLabelLeg',
  "classitem": 'searchLabelClassitem',
};
const aegisLabels: Record<string, string> = {
  "god": 'searchLabelPerk',
  "5/5": 'searchLabelPerfect',
  "perfect": 'searchLabelPerfect',
  "5of5": 'searchLabelPerfect',
  "godroll": 'searchLabelPerfect',
  "omni": 'searchLabelOmni',
  "master": 'searchLabelOmni',
  "allperks": 'searchLabelOmni',
  "upgrade": 'searchLabelUpgrade',
  "upgradeable": 'searchLabelUpgrade',
  "upgradable": 'searchLabelUpgrade',
  "bis": 'searchLabelBis',
  "bestinclass": 'searchLabelBis',
  "chase": 'searchLabelChase',
  "shopping": 'searchLabelShopping',
  "shop": 'searchLabelShopping',
  "shopping:high": 'searchLabelShoppingHigh',
  "priority:1": 'searchLabelShoppingHigh',
  "priority:high": 'searchLabelShoppingHigh',
  "shopping:ready": 'searchLabelShoppingReady',
  "shopping:farm": 'searchLabelShoppingFarm',
  "shopping:suboptimal": 'searchLabelShoppingFarm',
  "shopping:alt": 'searchLabelShoppingAlt',
  "shopping:alternative": 'searchLabelShoppingAlt',
};
const targets: Record<string, string> = {
  "p": 'searchLabelPerk',
  "perk": 'searchLabelPerk',
  "w": 'searchLabelWeapon',
  "weapon": 'searchLabelWeapon',
  "pve": 'searchLabelPve',
  "pvp": 'searchLabelPvp',
  "2p": 'searchLabelPiece2',
  "2piece": 'searchLabelPiece2',
  "4p": 'searchLabelPiece4',
  "4piece": 'searchLabelPiece4',
};
const operators: Record<string, string> = { '>=': '≥', '<=': '≤', '>': '>', '<': '<', '=': '=', '==': '=' };

function unquote(value: string): string {
  return /^(["']).*\1$/s.test(value) ? value.slice(1, -1).replace(/\\(["'\\])/g, '$1') : value;
}

/** Presentation only. Unknown forms retain their exact syntax, without guessing. */
export function readableSearchTerm(raw: string): SearchTermLabel {
  const tokens = tokenizeSearch(raw);
  if (tokens.length !== 1 || tokens[0].kind !== 'term' || !tokens[0].complete) return { text: raw };
  const separator = raw.indexOf(':');
  if (separator < 0) return { text: raw };
  const key = raw.slice(0, separator).toLowerCase();
  const value = unquote(raw.slice(separator + 1)), lower = value.toLowerCase();
  if (key === 'aegis' && parseAegisArgument(value).ok) {
    if (aegisLabels[lower]) return { text: lower === 'god' ? `${t(aegisLabels[lower])} ≥ S` : t(aegisLabels[lower]), operator: lower === 'god' ? '≥' : undefined };
    if (/^(s|source):/i.test(value)) return { text: t('searchLabelSource') + ': ' + value.slice(value.indexOf(':') + 1) };
    let rest = value, label = t('searchLabelRating');
    if (/^(a|armor):/i.test(rest)) { label = t('searchLabelArmor'); rest = rest.slice(rest.indexOf(':') + 1); }
    const target = rest.slice(0, rest.indexOf(':')).toLowerCase();
    if (rest.includes(':') && targets[target]) { label = t(targets[target]); rest = rest.slice(rest.indexOf(':') + 1); }
    const match = /^(>=|<=|>|<|==|=)?([sabcdef+➔/\-]+)$/i.exec(rest);
    if (match) {
      const operator = operators[match[1]];
      return { text: `${label} ${operator ? operator + ' ' : ''}${match[2].toUpperCase()}`, operator };
    }
  }
  if (key === 'breaker' && Object.hasOwn(breakerIcons, lower)) return {
    text: t('searchLabel' + lower[0].toUpperCase() + lower.slice(1)),
    icon: `https://www.bungie.net/common/destiny2_content/icons/DestinyBreakerTypeDefinition_${breakerIcons[lower]}.png`,
  };
  if (key === 'is' && Object.hasOwn(nativeLabels, lower)) return { text: t(nativeLabels[lower]) };
  const named: Record<string, string> = { name: 'searchLabelName', notes: 'searchLabelNotes', source: 'searchLabelSource', tag: 'searchLabelTag' };
  if (Object.hasOwn(named, key) && value) return { text: `${t(named[key])}: ${value}` };
  if (key === 'power' || key === 'light') {
    const match = /^(>=|<=|>|<|==|=)?(\d+)$/.exec(value);
    if (match) {
      const operator = operators[match[1]];
      return { text: `${t('searchLabelPower')} ${operator ? operator + ' ' : ''}${match[2]}`, operator };
    }
  }
  return { text: raw };
}
