import { normalizeLightggData } from './external-text';
import { scoreRowMetadata } from '../scripts/score-sync.mjs';
import { parseWishlist } from './parser';
import { AegisSheetDatabase, AegisSheetWeapon, AegisArmorSet, AegisShoppingDatabase, AegisShoppingItem } from './types';
import { fetchEvaluationLocale } from './evaluation-i18n';
import { parsePerkRatings, type PerkRatingTab, type PerkRatingsCache } from './perk-ratings';

const DEFAULT_URL =
  'https://raw.githubusercontent.com/charlesxcaliber/DIMAegisWeaponWishlist/main/MrCharlesWishlist_MRB_PPC2.txt';

const SYNC_ALARM_NAME = 'sync-wishlist-alarm';
const LGG_ROLL_APPRAISER_URL = 'https://www.light.gg/god-roll/roll-appraiser/';

/**
 * Fetches the wishlist from the configured URL, parses it, and caches it in local storage.
 *
 * @param url Optional override URL. If omitted, uses the configured URL from storage or the default.
 */
async function fetchAndCacheWishlist(url?: string): Promise<{ success: boolean; count?: number; error?: string }> {
  let targetUrl: string = url || '';

  if (!targetUrl) {
    const storage = await chrome.storage.local.get('wishlistUrl');
    targetUrl = storage.wishlistUrl || DEFAULT_URL;
  }

  // Update status to loading
  await chrome.storage.local.set({
    syncStatus: 'loading',
    syncError: null,
    wishlistUrl: targetUrl,
  });

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    const parsedDb = parseWishlist(text);
    const parsedCount = Object.keys(parsedDb).length;

    // Fetch enhanced-to-normal perk mapping
    let enhancedToNormal: Record<number, number> = {};
    try {
      const mapResponse = await fetch(
        'https://raw.githubusercontent.com/DestinyItemManager/d2-additional-info/master/output/trait-to-enhanced-trait.json'
      );
      if (mapResponse.ok) {
        const normalToEnhanced = (await mapResponse.json()) as Record<string, number>;
        for (const [normalStr, enhanced] of Object.entries(normalToEnhanced)) {
          const normal = parseInt(normalStr, 10);
          if (!isNaN(normal) && enhanced) {
            enhancedToNormal[enhanced] = normal;
          }
        }
      }
    } catch (mapErr) {
      console.error('Failed to fetch enhanced perk mapping:', mapErr);
    }

    await chrome.storage.local.set({
      wishlistData: parsedDb,
      lastUpdated: Date.now(),
      syncStatus: 'success',
      syncError: null,
      parsedCount,
      enhancedToNormal,
    });

    console.log(`Wishlist sync complete. Parsed ${parsedCount} items from: ${targetUrl}`);
    return { success: true, count: parsedCount };
  } catch (err: any) {
    const errMsg = err.message || String(err);
    console.error('Wishlist sync failed:', errMsg);

    await chrome.storage.local.set({
      syncStatus: 'error',
      syncError: errMsg,
    });

    return { success: false, error: errMsg };
  }
}

const SHEET_ID = '1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY';
const PVP_SHEET_ID = '1TVgtTRWNGEPi6OMlTLxXFSKUTi_ycwykhwuw8EW_jJ0';
const ARMOR_SHEET_ID = '14LnzOhmeXzKaSV3OR35pQJkclg6vLC4YmKtlKTctY3o';
const ARMOR_GID = '631213508';

const PVE_DB_CDN_URL =
  'https://raw.githubusercontent.com/Maxeption/dim-aegis-overlay/master/data/pve-database.json';
const PVP_DB_CDN_URL =
  'https://raw.githubusercontent.com/Maxeption/dim-aegis-overlay/master/data/pvp-database.json';

const ALL_TABS = [
  'Autos', 'Bows', 'HCs', 'Pulses', 'Scouts', 'Sidearms', 'SMGs',
  'BGLs', 'Fusions', 'Glaives', 'Shotguns', 'Snipers',
  'Rocket Sidearms', 'Traces', 'HGLs', 'LFRs', 'LMGs', 'Rockets',
  'Swords', 'Other', 'Exotic Weapons',
];

function decodeHtml(html: string): string {
  return (html || '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function parseHtmlTable(htmlText: string): string[][] {
  const rowMatches = [...htmlText.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)];
  const rows: string[][] = [];
  for (const r of rowMatches) {
    const cells = [...r[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map(m => decodeHtml(m[1]));
    rows.push(cells);
  }
  return rows;
}

function parseCSV(text: string): string[][] {
  const normalizedText = text.replace(/\r\n|\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQ = false;
  for (let i = 0; i < normalizedText.length; i++) {
    const c = normalizedText[i], nx = normalizedText[i + 1];
    if (inQ) {
      if (c === '"' && nx === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (row.length || field) { row.push(field); rows.push(row); }
  return rows;
}

async function fetchHtmlViewMetadata(sheetId: string): Promise<Record<string, string>> {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, credentials: 'omit' });
    if (!res.ok) return {};
    const text = await res.text();
    const regex = /items\.push\(\s*\{\s*name:\s*"([^"]+)"\s*,\s*pageUrl:\s*"([^"]+)"\s*,\s*gid:\s*"([^"]+)"/g;
    const matches = [...text.matchAll(regex)];
    const tabs: Record<string, string> = {};
    for (const m of matches) {
      const name = m[1].replace(/\\x26/g, '&').replace(/\\'/g, "'").trim();
      const gid = m[3].trim();
      tabs[name] = gid;
    }
    return tabs;
  } catch (err) {
    return {};
  }
}

async function fetchTabRows(sheetId: string, tabName: string, gid?: string): Promise<string[][]> {
  if (gid) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview/sheet?headers=true&gid=${gid}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, credentials: 'omit' });
      if (res.ok) {
        const text = await res.text();
        const rows = parseHtmlTable(text);
        if (rows.length >= 2) return rows;
      }
    } catch (e) {}
  }

  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, credentials: 'omit' });
    if (res.ok) {
      const text = await res.text();
      if (!text.trimStart().startsWith('<')) {
        return parseCSV(text);
      }
    }
  } catch (e) {}

  return [];
}

function normName(s: string): string {
  return (s ?? '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function extractVersionTag(name: string): string {
  const match = name.match(/(brave|pantheon|rotn|legacy|adept|timelost|harrowed|re-issue|reissued)/i);
  return match ? match[1].toLowerCase() : '';
}

function stripEdition(name: string): string {
  return name
    .replace(/\s*\([^)]+\)\s*$/gi, '')
    .replace(/\s+(brave|pantheon|rotn|legacy|adept|timelost|harrowed|re-issue|reissued)\s+version$/gi, '')
    .replace(/\s+(brave|pantheon|rotn|legacy|adept|timelost|harrowed|re-issue|reissued)$/gi, '')
    .trim();
}

async function fetchSpreadsheetDatabase(sheetId: string, tabs: string[]): Promise<AegisSheetDatabase> {
  const weapons: Record<string, AegisSheetWeapon> = {};
  const variants: Record<string, AegisSheetWeapon[]> = {};
  const categories: Record<string, AegisSheetWeapon[]> = {};

  const discoveredTabs = await fetchHtmlViewMetadata(sheetId);
  const completedTabs = new Set<string>();

  const expectedTabs = Object.keys(discoveredTabs).length ? tabs.filter(tab => discoveredTabs[tab]) : tabs;
  const promises = expectedTabs.map(async (tab) => {
    try {
      const gid = discoveredTabs[tab];
      const rows = await fetchTabRows(sheetId, tab, gid);
      if (rows.length < 2) return;

      let headerRowIndex = 0;
      for (let r = 0; r < Math.min(rows.length, 3); r++) {
        if (rows[r].some(c => c.trim().toLowerCase() === 'name')) {
          headerRowIndex = r;
          break;
        }
      }

      const header = rows[headerRowIndex];
      if (!header.some(cell => cell.trim().toLowerCase() === 'name')) return;
      completedTabs.add(tab);
      const idx: Record<string, number> = {};
      header.forEach((col, i) => {
        idx[col.trim()] = i;
      });

      const getVal = (row: string[], keys: string[]) => {
        for (const k of keys) {
          const i = idx[k];
          if (i !== undefined) {
            return (row[i] ?? '').trim();
          }
        }
        return '';
      };

      const categoryWeapons: AegisSheetWeapon[] = [];

      for (let r = headerRowIndex + 1; r < rows.length; r++) {
        const row = rows[r];
        const nameVal = getVal(row, ['Name']);
        if (!nameVal || nameVal.toLowerCase() === 'name') continue;

        const weaponName = nameVal.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const normalized = normName(weaponName);
        const baseNormalized = normName(stripEdition(weaponName));
        const versionTag = extractVersionTag(weaponName);

        const usageVal = getVal(row, ['Usage', 'ANALYSIS Notes', 'Notes', 'Role / Notes']);
        const descVal = getVal(row, ['Description']);

        const roamSymbol = getVal(row, ['ANALYSIS Roam', 'Roam']);
        const dpsSymbol = getVal(row, ['DPS']);
        const challSymbol = getVal(row, ['Chall', 'Challenge']);
        const speedSymbol = getVal(row, ['Speed', 'Speedrun']);

        const trialsSymbol = getVal(row, ['ANALYSIS Trials', 'Trials']);
        const compSymbol = getVal(row, ['Comp', 'Competitive']);
        const quickplaySymbol = getVal(row, ['Quickplay', '6v6']);
        const vsDrSymbol = getVal(row, ['vs DR', 'vsDR']);
        const duelSymbol = getVal(row, ['Duel', 'Dueling']);

        const tagsVal = getVal(row, ['Tags']);
        const stunVal = getVal(row, ['Stun']);

        const hasViability = roamSymbol || dpsSymbol || challSymbol || speedSymbol || trialsSymbol || compSymbol || quickplaySymbol || vsDrSymbol || duelSymbol || tagsVal || stunVal;

        const weaponData: AegisSheetWeapon = {
          name: weaponName,
          ...scoreRowMetadata(getVal, row, tab, r),
          energy: getVal(row, ['Energy', 'INFO Energy', 'Slot', 'Affinity', 'Type']),
          frame: getVal(row, ['Frame', 'Tags']),
          barrel: getVal(row, ['PERKS Barrel', 'Barrel']),
          mag: getVal(row, ['Mag', 'PERKS Mag', 'Magazine']),
          perk1: getVal(row, ['Perk 1', 'PERKS Perk 1', 'Column 1']),
          perk2: getVal(row, ['Perk 2', 'PERKS Perk 2', 'Column 2']),
          origin: getVal(row, ['Origin Trait', 'Origin', 'Stun']),
          source: getVal(row, ['Source', 'Where to get']),
          notes: usageVal || (descVal !== usageVal ? '' : descVal),
          description: descVal && descVal !== usageVal ? descVal : undefined,
          rank: getVal(row, ['Rank', 'WEAPON #', '#']),
          tier: getVal(row, ['Tier']),
          versionTag: versionTag || undefined,
          mw: getVal(row, ['MW', 'PERKS MW']),
          stun: stunVal || undefined,
          exoticViability: hasViability ? {
            roam: roamSymbol || undefined,
            dps: dpsSymbol || undefined,
            chall: challSymbol || undefined,
            speed: speedSymbol || undefined,
            trials: trialsSymbol || undefined,
            comp: compSymbol || undefined,
            quickplay: quickplaySymbol || undefined,
            vsDr: vsDrSymbol || undefined,
            duel: duelSymbol || undefined,
            tags: tagsVal || undefined,
            stun: stunVal || undefined,
          } : undefined,
        };

        weapons[normalized] = weaponData;
        
        if (!variants[baseNormalized]) {
          variants[baseNormalized] = [];
        }
        if (!variants[baseNormalized].some((v: AegisSheetWeapon) => v.sourceRowId && weaponData.sourceRowId
          ? v.sourceRowId === weaponData.sourceRowId
          : [v.categoryKey, v.name, v.versionTag, v.frame].join('|') === [weaponData.categoryKey, weaponData.name, weaponData.versionTag, weaponData.frame].join('|'))) {
          variants[baseNormalized].push(weaponData);
        }

        if (!weapons[baseNormalized]) {
          weapons[baseNormalized] = weaponData;
        }

        categoryWeapons.push(weaponData);
      }

      categoryWeapons.sort((a, b) => {
        const rA = parseInt(a.rank, 10);
        const rB = parseInt(b.rank, 10);
        return (isNaN(rA) ? 999 : rA) - (isNaN(rB) ? 999 : rB);
      });

      categories[tab] = categoryWeapons;
    } catch (tabErr: any) {
      console.warn(`[Aegis] Skipping tab "${tab}": ${tabErr.message}`);
    }
  });

  await Promise.all(promises);
  if (completedTabs.size !== expectedTabs.length || Object.keys(weapons).length === 0) {
    throw new Error(`Incomplete spreadsheet: ${completedTabs.size}/${expectedTabs.length} tabs`);
  }

  // Fetch LowCo armor sets sheet
  const armorUrl = `https://docs.google.com/spreadsheets/d/${ARMOR_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${ARMOR_GID}`;
  const armor: Record<string, AegisArmorSet> = {};
  try {
    const armorRes = await fetch(armorUrl, { credentials: 'omit' });
    if (armorRes.ok) {
      const armorCsvText = await armorRes.text();
      if (!armorCsvText.trimStart().startsWith('<')) {
        const armorRows = parseCSV(armorCsvText);
        if (armorRows.length >= 3) {
          for (let r = 2; r < armorRows.length; r++) {
            const row = armorRows[r];
            let offset = 0;
            if (/^\d+$/.test((row[0] || '').trim()) && row.length >= 12) {
              offset = 1;
            }
            const setName = (row[offset + 0] ?? '').trim();
            if (!setName || setName === 'Set Name' || setName === 'Set Pick List' || setName.toLowerCase().includes('notes:')) {
              continue;
            }
            if ((row[offset + 1] ?? '').trim() === 'Name') continue;

            const armorData: AegisArmorSet = {
              setName,
              piece2Name: (row[offset + 1] ?? '').trim(),
              piece2Desc: (row[offset + 2] ?? '').trim(),
              piece2Numbers: (row[offset + 3] ?? '').trim(),
              piece2Rating: (row[offset + 4] ?? '').trim(),
              piece4Name: (row[offset + 5] ?? '').trim(),
              piece4Desc: (row[offset + 6] ?? '').trim(),
              piece4Numbers: (row[offset + 7] ?? '').trim(),
              piece4Rating: (row[offset + 8] ?? '').trim(),
              source: (row[offset + 9] ?? '').trim(),
              sourceType: (row[offset + 10] ?? '').trim(),
            };

            armor[setName.toLowerCase().trim()] = armorData;
          }
        }
      }
    }
  } catch (armorErr) {}

  // Fetch Set Bonuses tab from the spreadsheet
  const aegisArmorUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Set Bonuses')}`;
  const armorAegis: Record<string, AegisArmorSet> = {};
  try {
    const aegisArmorRes = await fetch(aegisArmorUrl, { credentials: 'omit' });
    if (aegisArmorRes.ok) {
      const csvText = await aegisArmorRes.text();
      const rows = parseCSV(csvText);
      if (rows.length >= 2) {
        let setHeaderIdx = 0;
        for (let r = 0; r < Math.min(rows.length, 5); r++) {
          if (rows[r].some(c => {
            const low = c.toLowerCase().trim();
            return low === 'set name' || low === 'set';
          })) {
            setHeaderIdx = r;
            break;
          }
        }
        const sHeader = rows[setHeaderIdx].map(h => h.trim().toLowerCase());
        const sNameIdx = sHeader.findIndex(h => h === 'set' || h === 'set name' || h.includes('set'));
        const sBonusIdx = sHeader.findIndex(h => h === 'bonus' || h === 'bonus name' || h.includes('bonus'));
        const sPcsIdx = sHeader.findIndex(h => h === 'pcs' || h.includes('pcs'));
        const sDescIdx = sHeader.findIndex(h => h === 'description' || h.includes('description'));
        const sTrigIdx = sHeader.findIndex(h => h === 'trigger' || h.includes('trigger'));
        const sEffIdx = sHeader.findIndex(h => h === 'effect' || h.includes('effect'));
        const sTierIdx = sHeader.findIndex(h => h === 'tier' || h.includes('tier'));

        for (let r = setHeaderIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          const rawSetName = sNameIdx >= 0 ? (row[sNameIdx] || '').trim() : '';
          if (!rawSetName || rawSetName.toLowerCase() === 'set' || rawSetName.toLowerCase() === 'set name') continue;
          
          const parts = rawSetName.split('\n');
          const setName = parts[0].replace(/\s+(2|4)\s*pcs\.?$/i, '').trim();
          const source = parts[1] ? parts[1].trim() : '';
          const pcs = sPcsIdx >= 0 ? (row[sPcsIdx] || '').trim() : '';
          const bonusName = sBonusIdx >= 0 ? (row[sBonusIdx] || '').trim() : '';
          const trigger = sTrigIdx >= 0 ? (row[sTrigIdx] || '').trim() : '';
          const effect = sEffIdx >= 0 ? (row[sEffIdx] || '').trim() : '';
          const desc = sDescIdx >= 0 ? (row[sDescIdx] || '').trim() : '';
          const tier = sTierIdx >= 0 ? (row[sTierIdx] || '').trim() : '';

          const normalized = setName.toLowerCase().trim();
          if (!armorAegis[normalized]) {
            armorAegis[normalized] = {
              setName,
              piece2Name: 'None',
              piece2Desc: 'No 2-piece set bonus listed.',
              piece2Numbers: '',
              piece2Rating: 'F',
              piece4Name: 'None',
              piece4Desc: 'No 4-piece set bonus listed.',
              piece4Numbers: '',
              piece4Rating: 'F',
              source: source,
              sourceType: 'Activity',
            };
          }

          const setObj = armorAegis[normalized];
          if (source && !setObj.source) setObj.source = source;
          if (pcs === '2') {
            setObj.piece2Name = bonusName;
            setObj.piece2Desc = desc;
            setObj.piece2Numbers = `Trigger: ${trigger} | Effect: ${effect}`;
            setObj.piece2Rating = tier;
          } else if (pcs === '4') {
            setObj.piece4Name = bonusName;
            setObj.piece4Desc = desc;
            setObj.piece4Numbers = `Trigger: ${trigger} | Effect: ${effect}`;
            setObj.piece4Rating = tier;
          }
        }
      }
    }
  } catch (err) {}

  for (const [key, aegisData] of Object.entries(armorAegis)) {
    const lowcoData = armor[key];
    if (lowcoData) {
      if (lowcoData.source) aegisData.source = lowcoData.source;
      if (lowcoData.sourceType) aegisData.sourceType = lowcoData.sourceType;
    }
  }

  return { scoreSchemaVersion: 1, weapons, variants, categories, armor, armorAegis };
}

/**
 * Fetches and parses Aegis's "Shopping List" tab containing curated endgame chase weapons & armor.
 */
async function fetchShoppingListDatabase(sheetId: string): Promise<AegisShoppingDatabase> {
  const items: AegisShoppingItem[] = [];
  const byName: Record<string, AegisShoppingItem> = {};
  const alternativesMap: Record<string, { primaryName: string; role: string; priority: string; priorityNum: number }> = {};

  try {
    const discoveredTabs = await fetchHtmlViewMetadata(sheetId);
    const shoppingGid = discoveredTabs['Shopping List'];
    const rows = await fetchTabRows(sheetId, 'Shopping List', shoppingGid);
    if (rows.length >= 2) {
          let headerRowIndex = 0;
          for (let r = 0; r < Math.min(rows.length, 3); r++) {
            if (rows[r].some(c => c.trim().toLowerCase() === 'name' || c.trim().toLowerCase() === 'role')) {
              headerRowIndex = r;
              break;
            }
          }

          const header = rows[headerRowIndex].map(h => h.trim().toLowerCase());
          const roleIdx = header.indexOf('role');
          const nameIdx = header.indexOf('name');
          const sourceIdx = header.indexOf('source');
          const numIdx = header.indexOf('#');
          const priorityIdx = header.indexOf('priority');
          const col1Idx = header.indexOf('column 1');
          const col2Idx = header.indexOf('column 2');
          const altIdx = header.indexOf('alternatives');

          for (let r = headerRowIndex + 1; r < rows.length; r++) {
            const row = rows[r];
            const rawName = (row[nameIdx] || '').replace(/\n+/g, ' ').trim();
            if (!rawName || rawName.toLowerCase() === 'name') continue;

            const role = (row[roleIdx] || '').replace(/\n+/g, ' ').trim();
            const source = (row[sourceIdx] || '').replace(/\n+/g, ' ').trim();
            const priorityNum = parseInt(row[numIdx] || '3', 10) || 3;
            const rawPriority = (row[priorityIdx] || '').toLowerCase().trim();
            const priority: 'high' | 'medium' | 'low' | 'niche' =
              rawPriority === 'high' || rawPriority === 'medium' || rawPriority === 'low' || rawPriority === 'niche'
                ? rawPriority
                : (priorityNum === 1 ? 'high' : priorityNum === 2 ? 'medium' : priorityNum === 3 ? 'low' : 'niche');

            const col1 = (row[col1Idx] || '').trim();
            const col2 = (row[col2Idx] || '').trim();
            const rawAlts = (row[altIdx] || '').trim();
            let alternatives: string[] = [];
            if (rawAlts && rawAlts.toUpperCase() !== 'N/A' && rawAlts !== '-' && rawAlts.toUpperCase() !== 'NA' && rawAlts.toUpperCase() !== 'NONE') {
              alternatives = rawAlts
                .split(/[\/\n\\]+/)
                .map(a => a.trim())
                .filter(a => a && a.toUpperCase() !== 'N/A' && a !== '-' && a.toUpperCase() !== 'NA' && a.toUpperCase() !== 'NONE' && a.toUpperCase() !== 'N' && a.toUpperCase() !== 'A');
            }

            const rLow = role.toLowerCase();
            const sLow = source.toLowerCase();
            const c1Low = col1.toLowerCase();
            const nLow = rawName.toLowerCase();

            const isArmor =
              rLow.includes('dr') ||
              rLow.includes('pcs') ||
              rLow.includes('armor') ||
              rLow.includes('regen') ||
              rLow.includes('augmentation') ||
              c1Low.includes('specialist') ||
              c1Low.includes('powerhouse') ||
              c1Low.includes('gunner') ||
              c1Low.includes('skirmisher') ||
              (sLow.includes('rahool') && (!col2 || col2 === 'N/A' || col2 === '-'));

            const isExotic =
              rLow.includes('exotic') ||
              sLow.includes('rahool') ||
              sLow.includes('monument') ||
              sLow.includes('kiosk') ||
              nLow.includes('exotic');

            const item: AegisShoppingItem = {
              role,
              name: rawName,
              source,
              priorityNum,
              priority,
              column1: col1,
              column2: col2,
              alternatives,
              isArmor,
              isExotic,
            };

            items.push(item);
            byName[normName(rawName)] = item;
            byName[rawName.toLowerCase().trim()] = item;

            for (const alt of alternatives) {
              const altNorm = normName(alt);
              alternativesMap[altNorm] = {
                primaryName: rawName,
                role,
                priority,
                priorityNum,
              };
            }
          }
        }
      } catch (err) {
        console.error('DIM Aegis Overlay: Failed to fetch Shopping List database:', err);
      }

      return { items, byName, alternativesMap };
    }

/**
 * Safe fetch wrapper with timeout signal to prevent hanging requests on spotty networks.
 */
async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { cache: 'no-cache', signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches Aegis (PvE) and Finnald (PvP) spreadsheet databases, prioritizing the fast GitHub CDN mirror,
 * with graceful fallback to live spreadsheet extraction if CDN is unavailable.
 */
let perkRatingsSync: Promise<void> | undefined;
function fetchAndCachePerkRatings(force = false): Promise<void> {
  if (perkRatingsSync) return perkRatingsSync;
  perkRatingsSync = (async () => {
    const saved = await chrome.storage.local.get('aegisPerkRatings');
    const cache: PerkRatingsCache = saved.aegisPerkRatings || { tabs: {} };
    const tabs: PerkRatingTab[] = ['Perks', 'Origin Traits'];
    let changed = false;
    await Promise.all(tabs.map(async tab => {
      if (!force && cache.tabs[tab] && Date.now() - cache.tabs[tab]!.updatedAt < 86400000) return;
      try {
        const response = await fetchWithTimeout(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const ratings = parsePerkRatings(parseCSV(await response.text()), tab);
        cache.tabs[tab] = { updatedAt: Date.now(), ratings }; changed = true;
      } catch (error) {
        // Keep the last successful tab, including when only one tab fails.
        console.warn(`Aegis ${tab} ratings sync failed; retaining cache`, error);
      }
    }));
    if (changed) await chrome.storage.local.set({ aegisPerkRatings: cache });
  })().catch(error => console.warn('Aegis perk ratings cache unavailable', error))
    .finally(() => { perkRatingsSync = undefined; });
  return perkRatingsSync;
}

async function fetchAndCacheAegisSheet(): Promise<{ success: boolean; partial?: boolean; error?: string }> {
  await fetchAndCachePerkRatings(true);
  try {
    const validSheet = (value: any): value is AegisSheetDatabase => !!value && typeof value.weapons === 'object' && !Array.isArray(value.weapons)
      && Object.keys(value.weapons).length > 0 && Object.values(value.weapons).every((weapon: any) => typeof weapon?.name === 'string' && weapon.name.trim())
      && !!value.categories && typeof value.categories === 'object' && !Array.isArray(value.categories)
      && Object.values(value.categories).every(category => Array.isArray(category));
    const validShopping = (value: any): value is AegisShoppingDatabase => !!value && Array.isArray(value.items) && value.items.length > 0
      && !!value.byName && typeof value.byName === 'object' && !!value.alternativesMap && typeof value.alternativesMap === 'object'
      && value.items.every((item: any) => typeof item?.name === 'string' && item.name.trim());
    const refresh = async (url: string, sheetId: string, tabs: string[]) => {
      let sheet: AegisSheetDatabase | undefined, shopping: AegisShoppingDatabase | undefined;
      try {
        const response = await fetchWithTimeout(url);
        if (response.ok) {
          const data = await response.json();
          if (validSheet(data)) sheet = data;
          if (validShopping(data?.shopping)) shopping = data.shopping;
        }
      } catch { /* Independently try this channel's direct source. */ }
      if (!sheet) {
        try { const data = await fetchSpreadsheetDatabase(sheetId, tabs); if (validSheet(data)) sheet = data; } catch { /* Retain this channel's last good cache. */ }
      }
      if (!shopping) {
        try { const data = await fetchShoppingListDatabase(sheetId); if (validShopping(data)) shopping = data; } catch { /* Retain shopping independently. */ }
      }
      return { sheet, shopping };
    };
    const [pve, pvp] = await Promise.all([
      refresh(PVE_DB_CDN_URL, SHEET_ID, ALL_TABS),
      refresh(PVP_DB_CDN_URL, PVP_SHEET_ID, [...ALL_TABS, 'Legendary Weapons']),
    ]);
    // Source requests may take seconds; choose aliases and retained data from current preferences.
    const storage = await chrome.storage.local.get(['aegisMode', 'aegisSheetDbPvE', 'aegisSheetDbPvP', 'aegisSheetDb', 'aegisShoppingDbPvE', 'aegisShoppingDbPvP', 'aegisShoppingDb']);
    const updates: Record<string, unknown> = {};
    for (const [mode, result] of [['PvE', pve], ['PvP', pvp]] as const) {
      if (result.sheet) {
        const previous = storage['aegisSheetDb' + mode];
        // Optional armor sources can fail independently of weapon tabs.
        for (const key of ['armor', 'armorAegis'] as const) {
          if ((!result.sheet[key] || !Object.keys(result.sheet[key]!).length) && previous?.[key]) result.sheet[key] = previous[key];
        }
        updates['aegisSheetDb' + mode] = result.sheet;
        updates['aegisSheetLastSync' + mode] = Date.now();
      }
      if (result.shopping) updates['aegisShoppingDb' + mode] = result.shopping;
    }
    const merged = { ...storage, ...updates };
    const active = storage.aegisMode === 'pvp' ? 'PvP' : 'PvE';
    const activeDb = merged['aegisSheetDb' + active];
    const activeShopping = merged['aegisShoppingDb' + active] || merged.aegisShoppingDbPvE || merged.aegisShoppingDbPvP;
    if (activeDb) updates.aegisSheetDb = activeDb;
    if (activeShopping) updates.aegisShoppingDb = activeShopping;
    const failed = [!pve.sheet && 'PvE weapons', !pvp.sheet && 'PvP weapons', !pve.shopping && 'PvE shopping', !pvp.shopping && 'PvP shopping'].filter(Boolean);
    const success = failed.length === 0;
    if (success) updates.aegisSheetLastSync = Date.now();
    const error = success ? null : `Failed to refresh ${failed.join(' and ')}; retained last good caches`;
    updates.aegisSheetSyncStatus = success ? 'success' : pve.sheet || pvp.sheet || pve.shopping || pvp.shopping ? 'partial' : 'error';
    updates.aegisSheetSyncError = error;
    await chrome.storage.local.set(updates);
    return success ? { success: true } : { success: false, partial: !!pve.sheet || !!pvp.sheet || !!pve.shopping || !!pvp.shopping, error: error! };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function syncAllData(url?: string): Promise<{ success: boolean; count?: number; error?: string }> {
  if (url) {
    // For manual wishlist sync, fetch only the wishlist to be instant and bypass slower/rate-limited sheet fetches.
    return await fetchAndCacheWishlist(url);
  }
  const wlRes = await fetchAndCacheWishlist();
  const sheetRes = await fetchAndCacheAegisSheet();
  
  // Asynchronously trigger version check
  checkForExtensionUpdates().catch(() => {});

  return {
    success: wlRes.success && sheetRes.success,
    count: wlRes.count,
    error: wlRes.error || sheetRes.error,
  };
}

// Set up periodic sync alarm (every 24 hours / 1440 minutes)
chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: 24 * 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    console.log('Periodic alarm triggered. Synchronizing wishlist and spreadsheet...');
    syncAllData();
  }
});

// Run sync immediately on installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('DIM Aegis Overlay installed. Performing initial data sync...');
  syncAllData();
  checkForExtensionUpdates().catch(() => {});
});

// Check/sync on startup if cache is missing or expired (older than 24 hours)
chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get(['lastUpdated', 'wishlistData', 'aegisSheetDb']);
  const dayInMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (!data.wishlistData || !data.aegisSheetDb || !data.lastUpdated || now - data.lastUpdated > dayInMs) {
    console.log('Cache missing or expired. Performing startup sync...');
    syncAllData();
  }
  checkForExtensionUpdates().catch(() => {});
});

/**
 * Opens the Light.gg Roll Appraiser in a hidden (inactive) tab.
 * Waits for the content script to signal completion via chrome.storage,
 * then closes the tab automatically.
 *
 * The content script writes { lightggSyncStatus: 'done' } when grades
 * are collected (either via API intercept or DOM scraping).
 */
async function syncLightGGInBackground(): Promise<{ success: boolean; count?: number; error?: string }> {
  // Mark as syncing
  await chrome.storage.local.set({ lightggSyncStatus: 'syncing', lightggSyncError: null });

  return new Promise((resolve) => {
    let tabId: number | null = null;
    let storageListener: ((changes: Record<string, chrome.storage.StorageChange>, area: string) => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function cleanup(success: boolean, count?: number, error?: string) {
      if (timeoutId) clearTimeout(timeoutId);
      if (storageListener) chrome.storage.onChanged.removeListener(storageListener);
      if (tabId !== null) {
        chrome.tabs.remove(tabId).catch(() => {}); // Close the hidden tab
        tabId = null;
      }
      const status = success ? 'done' : 'error';
      chrome.storage.local.set({ lightggSyncStatus: status, lightggSyncError: error || null });
      resolve({ success, count, error });
    }

    // Watch for the content script to write { lightggSyncStatus: 'done' }
    storageListener = (changes, area) => {
      if (area !== 'local') return;
      if (changes.lightggSyncStatus && changes.lightggSyncStatus.newValue === 'done') {
        chrome.storage.local.get('lightggData', (res) => {
          const count = Object.keys(res.lightggData || {}).length;
          console.log(`[DIM Aegis Overlay] Light.gg background sync complete. ${count} weapons graded.`);
          cleanup(true, count);
        });
      }
    };
    chrome.storage.onChanged.addListener(storageListener);

    // Safety timeout: close tab after 45 seconds regardless
    timeoutId = setTimeout(() => {
      console.warn('[DIM Aegis Overlay] Light.gg background sync timed out.');
      cleanup(false, undefined, 'Sync timed out after 45 seconds. Light.gg may require you to be logged in.');
    }, 45000);

    // Open the Roll Appraiser in a background tab (not active, not focused)
    chrome.tabs.create({ url: LGG_ROLL_APPRAISER_URL, active: false }, (tab) => {
      if (chrome.runtime.lastError || !tab.id) {
        cleanup(false, undefined, chrome.runtime.lastError?.message || 'Failed to open tab');
        return;
      }
      tabId = tab.id;
      console.log(`[DIM Aegis Overlay] Opened hidden Light.gg tab (id=${tabId}) for background sync.`);
    });
  });
}

// Helper to handle auto-resync when DIM is launched
async function handleDimLaunched() {
  void fetchAndCachePerkRatings();
  const data = await chrome.storage.local.get(['lastUpdated']);
  const dayInMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (!data.lastUpdated || now - data.lastUpdated > dayInMs) {
    console.log('DIM launched and database cache is expired. Triggering background auto-resync...');
    const res = await syncAllData();
    if (res.success) {
      notifyDimTabsOfUpdate(res.count || 0);
    }
  }
}

function notifyDimTabsOfUpdate(updatedCount: number) {
  chrome.tabs.query({ url: '*://*.destinyitemmanager.com/*' }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'showToast',
          message: `Spreadsheets synced automatically (${updatedCount} weapons cached)`
        }).catch(() => {});
      }
    }
  });
}

// One service-worker owner serializes all tabs' grade merges; no caller sends a stale cache snapshot.
let lightggWriteQueue: Promise<unknown> = Promise.resolve();
function mergeLightggGrades(raw: unknown): Promise<number> {
  const grades = normalizeLightggData(raw);
  const operation = lightggWriteQueue.then(async () => {
    const stored = await chrome.storage.local.get('lightggData');
    const existing = normalizeLightggData(stored.lightggData);
    const merged = { ...existing, ...grades };
    await chrome.storage.local.set({ lightggData: merged, lightggLastSync: Date.now() });
    return Object.keys(merged).length;
  });
  lightggWriteQueue = operation.catch(() => {});
  return operation;
}

// Listen for messages from settings popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'saveLightggGrades') {
    if (!/^https:\/\/(?:www\.)?light\.gg\//i.test(_sender.url || '')) return false;
    mergeLightggGrades(message.grades).then(count => sendResponse({ success: true, count }))
      .catch(error => sendResponse({ success: false, error: String(error) }));
    return true;
  }
  if (message.action === 'dimLaunched') {
    handleDimLaunched().catch(console.error);
    return false;
  }

  if (message.action === 'syncNow') {
    syncAllData(message.url)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async sendResponse
  }

  if (message.action === 'syncLightGG') {
    syncLightGGInBackground()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async sendResponse
  }

  if (message.action === 'syncSpreadsheets') {
    fetchAndCacheAegisSheet()
      .then((res) => sendResponse(res))
      .catch((err: unknown) => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendResponse({ success: false, error: errorMsg });
      });
    return true;
  }

  if (message.action === 'getEvaluationLocale') {
    const locale = typeof message.locale === 'string' ? message.locale : 'en';
    const force = message.force === true;
    fetchEvaluationLocale(locale, force)
      .then((bundle) => sendResponse({ success: true, bundle }))
      .catch((err: unknown) => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendResponse({ success: false, error: errorMsg });
      });
    return true;
  }

  if (message.action === 'checkUpdates') {
    checkForExtensionUpdates()
      .then(() => {
        chrome.storage.local.get(['updateAvailableVersion'], (res) => {
          const currentVersion = chrome.runtime.getManifest().version;
          if (res.updateAvailableVersion && isNewerVersion(res.updateAvailableVersion, currentVersion)) {
            sendResponse({ success: true, updateAvailable: true, version: res.updateAvailableVersion });
          } else {
            sendResponse({ success: true, updateAvailable: false, version: currentVersion });
          }
        });
      })
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  return false;
});

/**
 * Compares two semantic version strings. Returns true if latest > current.
 */
function isNewerVersion(latest: string, current: string): boolean {
  const l = latest.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const latestNum = isNaN(l[i]) ? 0 : l[i];
    const currentNum = isNaN(c[i]) ? 0 : c[i];
    if (latestNum > currentNum) return true;
    if (latestNum < currentNum) return false;
  }
  return false;
}

/**
 * Checks GitHub repository for updates and flags storage if a new version is available.
 */
async function checkForExtensionUpdates() {
  console.log('DIM Aegis Overlay: Checking for updates on GitHub...');
  const repoUrl = 'https://raw.githubusercontent.com/Maxeption/dim-aegis-overlay/master/package.json';
  try {
    const response = await fetch(repoUrl);
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    const latestVersion = data.version;
    const currentVersion = chrome.runtime.getManifest().version;

    if (isNewerVersion(latestVersion, currentVersion)) {
      const storage = await chrome.storage.local.get(['updateAvailableVersion']);
      if (storage.updateAvailableVersion !== latestVersion) {
        await chrome.storage.local.set({
          updateAvailableVersion: latestVersion,
          updateBannerDismissed: false
        });
        console.log(`DIM Aegis Overlay: New version v${latestVersion} available!`);
      }
    } else {
      await chrome.storage.local.remove(['updateAvailableVersion', 'updateBannerDismissed']);
      console.log('DIM Aegis Overlay: Extension is up to date.');
    }
  } catch (err) {
    console.error('DIM Aegis Overlay: Failed to check for extension updates:', err);
  }
}

