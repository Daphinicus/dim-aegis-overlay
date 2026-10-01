// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import fs from 'node:fs';
import { scorePresentation, scoreDetailsHtml } from '../../src/score-presentation';
import { readScoreSettings } from '../../src/score-config';

it('menu persists scores/profile/precision and restores grade controls and source preferences', async () => {
  const html=fs.readFileSync('public/popup.html','utf8');
  document.body.innerHTML=html.match(/<body[^>]*>([\s\S]*)<\/body>/i)![1];
  let store: Record<string, unknown>={lastSeenChangelogVersion:'1.9.0',scoringSource:'aegis',aegisDbMode:'both',aegisMode:'both',aegisTwoTier:true,aegisGradeDisplayMode:'dual'};
  vi.stubGlobal('chrome',{runtime:{getManifest:()=>({version:'1.9.0'}),getURL:(p:string)=>p,sendMessage:vi.fn(),onMessage:{addListener:vi.fn()}},storage:{local:{get:(_keys:unknown,cb:Function)=>cb({...store}),set:(patch:Record<string,unknown>,cb?:Function)=>{store={...store,...patch};cb?.();}},onChanged:{addListener:vi.fn()}},tabs:{create:vi.fn()}});
  await import('../../src/popup');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  const button=(id:string,value:string)=>document.querySelector<HTMLButtonElement>(`#${id} [data-value="${value}"]`)!;
  button('aegis-rating-display-segmented','scores').click();
  expect(store.aegisRatingDisplay).toBe('scores');
  expect(document.getElementById('aegis-score-controls')!.classList.contains('hidden')).toBe(false);
  expect(document.getElementById('aegis-two-tier-segmented')!.parentElement!.classList.contains('hidden')).toBe(true);
  expect(document.getElementById('mock-aegis-badge')!.textContent).toBe('87%92%');
  button('aegis-score-precision-segmented','2').click();
  expect(store.aegisScorePrecision).toBe(2);
  expect(document.getElementById('mock-aegis-badge')!.textContent).toBe('87.23%92.46%');
  button('aegis-score-profile-segmented','omni').click();
  button('aegis-score-comparison-segmented','pvp').click();
  expect(store.aegisScoreProfile).toBe('omni'); expect(store.aegisScoreComparisonActivity).toBe('pvp');
  button('scoring-source-segmented','lightgg').click();
  expect(button('aegis-rating-display-segmented','scores').disabled).toBe(true);
  expect(store.aegisRatingDisplay).toBe('scores');
  button('scoring-source-segmented','aegis').click();
  button('aegis-rating-display-segmented','grades').click();
  expect(document.getElementById('aegis-two-tier-segmented')!.parentElement!.classList.contains('hidden')).toBe(false);
  expect(store.aegisTwoTier).toBe(true);expect(store.aegisGradeDisplayMode).toBe('dual');
  expect(document.getElementById('mock-aegis-badge')!.textContent).toBe('SS+AA');
});
it('split presentation retains activity, uses neutral classes, and distinguishes unrated from zero', () => {
  const settings=readScoreSettings({aegisRatingDisplay:'scores'});
  const scores:any={pve:{best:{value:0,perfectOverall:false},omni:{value:null,reason:'unknown-origin-benchmark'},fullCoverage:false,quality:0,ceiling:100}};
  const presentation=scorePresentation(scores,'both',settings);
  expect(presentation.text).toBe('0% | —');expect(presentation.label).toContain('PvP');
  expect(presentation.html).not.toContain('aegis-badge-s');
  const details=scoreDetailsHtml(scores,'pve',{...settings,aegisScoreProfile:'omni'});
  expect(details).toContain('not yet verified');expect(details).toContain('aegis-copy-score-details');
});
