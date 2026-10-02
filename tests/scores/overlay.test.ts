// @vitest-environment jsdom
import { afterEach, it, expect, vi } from 'vitest';
import pve from '../../data/pve-database.json';
import { buildScoreSourceIndex } from '../../src/score-source';
import { getWeaponHashFromEnglish } from '../../src/hash-translator';
import { MASTERWORK_STAT_IDS } from '../../src/score-owned';
import { SCORE_SLOTS } from '../../src/score-config';
import type { AegisSheetDatabase } from '../../src/types';

const observers: MutationObserver[] = [];
const NativeMutationObserver = MutationObserver;
vi.stubGlobal('MutationObserver', class extends NativeMutationObserver {
  constructor(callback: MutationCallback) { super(callback); observers.push(this); }
});
afterEach(() => { observers.forEach(observer => observer.disconnect()); });

it('renders cached scores and reacts to settings, masterwork, source, and decimal search changes', async () => {
  const source=buildScoreSourceIndex(pve as AegisSheetDatabase,'pve').get('no hesitation')!;
  const itemHash=getWeaponHashFromEnglish('No Hesitation')!;
  const masterwork=source.slots.masterwork;
  const stat=masterwork.state==='ranked'?masterwork.recommendations[0].split(':')[1]:'';
  const statHash=Number(Object.keys(MASTERWORK_STAT_IDS).find(hash=>MASTERWORK_STAT_IDS[Number(hash)]===stat));
  const raw:any={schemaVersion:1,itemHash,instanceId:'12345',slots:{},masterwork:{state:'known',statHash}};
  for (const slot of SCORE_SLOTS.filter(s=>s!=='masterwork')) {
    const rec=source.slots[slot];
    raw.slots[slot]={state:'known',availableHashes:rec.state==='ranked'?[Number(rec.recommendations[0].split(':')[1])]:[]};
  }
  const hashes=Object.values(raw.slots).flatMap((v:any)=>v.availableHashes);
  document.body.innerHTML='<div><input name="filter" /></div><div class="item" id="item-12345"></div>';
  const tile=document.getElementById('item-12345')!;
  for(const [key,value] of Object.entries({'item-hash':String(itemHash),'instance-id':'12345','item-name':'No Hesitation','perk-hashes':hashes.join(','),'active-perk-hashes':hashes.join(','),'score-owned':JSON.stringify(raw)})) tile.setAttribute('data-aegis-'+key,value);
  let store:any={scoringSource:'aegis',aegisDbMode:'spreadsheet',aegisMode:'both',aegisRatingDisplay:'scores',aegisSheetDb:pve,aegisSheetDbPvE:pve,aegisWelcomeDismissed:true,aegisLanguage:'en'};
  const storageChanged:Function[]=[];
  vi.stubGlobal('chrome',{runtime:{getURL:(p:string)=>p,sendMessage:()=>Promise.resolve(),onMessage:{addListener:vi.fn()}},storage:{local:{get:(_keys:unknown,cb?:Function)=>{if (cb) queueMicrotask(()=>cb(store));return Promise.resolve(store);},set:()=>Promise.resolve()},onChanged:{addListener:(fn:Function)=>storageChanged.push(fn)}}});
  vi.spyOn(console,'debug').mockImplementation(()=>{});
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  const {weaponDataMap}=await import('../../src/content');
  const change=(patch:any)=>{const changes:any={};for(const [key,newValue]of Object.entries(patch))changes[key]={oldValue:store[key],newValue};store={...store,...patch};storageChanged.forEach(listener=>listener(changes,'local'));};
  await vi.waitFor(()=>expect(tile.querySelector('.aegis-badge')?.textContent).toBe('100%—'));
  expect(tile.classList.contains('aegis-gold-glow')).toBe(false);
  expect(tile.getAttribute('data-aegis-score-pve')).toBe('100');
  const cached=weaponDataMap.get(tile)!.scoreEvaluations!.pve;
  change({aegisScorePrecision:2});
  await vi.waitFor(() => expect(tile.querySelector('.aegis-badge')?.textContent).toBe('100.00%—'));
  expect(weaponDataMap.get(tile)!.scoreEvaluations!.pve).toBe(cached);
  raw.masterwork.statHash=4188031367;
  tile.setAttribute('data-aegis-score-owned',JSON.stringify(raw));
  await vi.waitFor(()=>expect(tile.querySelector('.aegis-badge')?.textContent).toBe('94.00%—'));
  const { matchesAegisArgument } = await import('../../src/aegis-search');
  const data = weaponDataMap.get(tile)!;
  expect(matchesAegisArgument('pve:score:>=94.01', data, {mode:'both',chase:false})).toBe(false);
  expect(matchesAegisArgument('pve:score:>=93.99', data, {mode:'both',chase:false})).toBe(true);
  raw.masterwork={state:'none'};
  tile.setAttribute('data-aegis-score-owned',JSON.stringify(raw));
  await vi.waitFor(()=>expect(tile.querySelector('.aegis-badge')?.textContent).toBe('94.00%—'));
  expect(weaponDataMap.get(tile)!.scoreEvaluations!.pve!.slots.find(slot=>slot.slot==='masterwork')?.quality).toBe(0);
  raw.masterwork={state:'unknown',reason:'unknown-owned-masterwork'};
  tile.setAttribute('data-aegis-score-owned',JSON.stringify(raw));
  await vi.waitFor(()=>expect(tile.querySelector('.aegis-badge')?.textContent).toBe('——'));
  expect(tile.getAttribute('data-aegis-score-pve-status')).toBe('unrated');
  raw.masterwork={state:'known',statHash};
  tile.setAttribute('data-aegis-score-owned',JSON.stringify(raw));
  await vi.waitFor(()=>expect(tile.querySelector('.aegis-badge')?.textContent).toBe('100.00%—'));
  change({aegisSheetDbPvE:null});
  await vi.waitFor(() => expect(tile.querySelector('.aegis-badge')?.textContent).toBe('——'));
  expect(tile.hasAttribute('data-aegis-score-pve')).toBe(false);
  expect(tile.getAttribute('data-aegis-score-pve-status')).toBe('unrated');
  change({aegisRatingDisplay:'grades',aegisSheetDbPvE:pve});
  await vi.waitFor(() => expect(tile.querySelector('.aegis-badge')?.classList.contains('aegis-score')).toBe(false));
});
