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
  weapon: 'Weapon', armor: 'Armor', exotic: 'Exotic', legendary: 'Legendary', rare: 'Rare',
  common: 'Common', uncommon: 'Uncommon', kinetic: 'Kinetic', energy: 'Energy', heavy: 'Heavy',
  primary: 'Primary', special: 'Special', arc: 'Arc', solar: 'Solar', void: 'Void', stasis: 'Stasis',
  strand: 'Strand', prismatic: 'Prismatic', hunter: 'Hunter', titan: 'Titan', warlock: 'Warlock',
  locked: 'Locked', unlocked: 'Unlocked', crafted: 'Crafted', masterwork: 'Masterworked',
  handcannon: 'Hand cannon', autorifle: 'Auto rifle', pulserifle: 'Pulse rifle', scoutrifle: 'Scout rifle',
  sidearm: 'Sidearm', smg: 'Submachine gun', submachinegun: 'Submachine gun', bow: 'Bow',
  shotgun: 'Shotgun', sniperrifle: 'Sniper rifle', fusionrifle: 'Fusion rifle',
  linearfusionrifle: 'Linear fusion rifle', trace: 'Trace rifle', tracerifle: 'Trace rifle',
  grenadelauncher: 'Grenade launcher', rocketlauncher: 'Rocket launcher', machinegun: 'Machine gun',
  sword: 'Sword', glaive: 'Glaive', helmet: 'Helmet', gauntlets: 'Gauntlets', chest: 'Chest armor',
  leg: 'Leg armor', classitem: 'Class item',
};
const aegisLabels: Record<string, string> = {
  god: 'Perk ≥ S', '5/5': 'Perfect roll', perfect: 'Perfect roll', '5of5': 'Perfect roll', godroll: 'Perfect roll',
  omni: 'Omni roll', master: 'Omni roll', allperks: 'Omni roll',
  upgrade: 'Upgrade available', upgradeable: 'Upgrade available', upgradable: 'Upgrade available',
  bis: 'Best in class', bestinclass: 'Best in class', chase: 'Chase list',
  shopping: 'Shopping list', shop: 'Shopping list', 'shopping:high': 'Shopping: high priority',
  'priority:1': 'Shopping: high priority', 'priority:high': 'Shopping: high priority',
  'shopping:ready': 'Shopping: ready', 'shopping:farm': 'Shopping: farm', 'shopping:suboptimal': 'Shopping: farm',
  'shopping:alt': 'Shopping: alternative', 'shopping:alternative': 'Shopping: alternative',
};
const targets: Record<string, string> = {
  p: 'Perk', perk: 'Perk', w: 'Weapon', weapon: 'Weapon', pve: 'PvE perk', pvp: 'PvP perk',
  '2p': 'Armor 2-piece', '2piece': 'Armor 2-piece', '4p': 'Armor 4-piece', '4piece': 'Armor 4-piece',
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
    if (aegisLabels[lower]) return { text: aegisLabels[lower], operator: lower === 'god' ? '≥' : undefined };
    if (/^(s|source):/i.test(value)) return { text: 'Source: ' + value.slice(value.indexOf(':') + 1) };
    let rest = value, label = 'Rating';
    if (/^(a|armor):/i.test(rest)) { label = 'Armor'; rest = rest.slice(rest.indexOf(':') + 1); }
    const target = rest.slice(0, rest.indexOf(':')).toLowerCase();
    if (rest.includes(':') && targets[target]) { label = targets[target]; rest = rest.slice(rest.indexOf(':') + 1); }
    const match = /^(>=|<=|>|<|==|=)?([sabcdef+➔/\-]+)$/i.exec(rest);
    if (match) {
      const operator = operators[match[1]];
      return { text: `${label} ${operator ? operator + ' ' : ''}${match[2].toUpperCase()}`, operator };
    }
  }
  if (key === 'breaker' && Object.hasOwn(breakerIcons, lower)) return {
    text: lower[0].toUpperCase() + lower.slice(1),
    icon: `https://www.bungie.net/common/destiny2_content/icons/DestinyBreakerTypeDefinition_${breakerIcons[lower]}.png`,
  };
  if (key === 'is' && Object.hasOwn(nativeLabels, lower)) return { text: nativeLabels[lower] };
  const named: Record<string, string> = { name: 'Name', notes: 'Notes', source: 'Source', tag: 'Tag' };
  if (Object.hasOwn(named, key) && value) return { text: `${named[key]}: ${value}` };
  if (key === 'power' || key === 'light') {
    const match = /^(>=|<=|>|<|==|=)?(\d+)$/.exec(value);
    if (match) {
      const operator = operators[match[1]];
      return { text: `Power ${operator ? operator + ' ' : ''}${match[2]}`, operator };
    }
  }
  return { text: raw };
}
