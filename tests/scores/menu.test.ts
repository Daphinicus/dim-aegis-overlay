// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import fs from 'node:fs';
import { scorePresentation, scoreDetailsHtml } from '../../src/score-presentation';
import { scoreColor, scoreValueHtml } from '../../src/score-format';
import { readScoreSettings } from '../../src/score-config';

it('menu persists scores/profile/precision and restores grade controls and source preferences', async () => {
  const html=fs.readFileSync('public/popup.html','utf8');
  document.body.innerHTML=html.match(/<body[^>]*>([\s\S]*)<\/body>/i)![1];
  let store: Record<string, unknown>={lastSeenChangelogVersion:'1.9.0',scoringSource:'aegis',aegisDbMode:'both',aegisMode:'both',aegisTwoTier:true,aegisGradeDisplayMode:'dual'};
  vi.stubGlobal('chrome',{runtime:{getManifest:()=>({version:'1.9.0'}),getURL:(p:string)=>p,sendMessage:vi.fn(),onMessage:{addListener:vi.fn()}},storage:{local:{get:(_keys:unknown,cb:Function)=>cb({...store}),set:(patch:Record<string,unknown>,cb?:Function)=>{store={...store,...patch};cb?.();}},onChanged:{addListener:vi.fn()}},tabs:{create:vi.fn()}});
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
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
  expect(document.getElementById('mock-aegis-badge')!.textContent).toBe('✦ BS+');
});
it('split presentation retains activity, colors each activity, and distinguishes unrated from zero', () => {
  const settings=readScoreSettings({aegisRatingDisplay:'scores'});
  const scores:any={pve:{best:{value:0,perfectOverall:false},omni:{value:null,reason:'unknown-origin-benchmark'},fullCoverage:false,quality:0,ceiling:100}};
  const presentation=scorePresentation(scores,'both',settings);
  expect(presentation.text).toBe('0% | —');expect(presentation.label).toContain('PvP');
  expect(presentation.html).not.toContain('aegis-badge-s');
  expect(presentation.parts.map(p => p.color)).toEqual(['hsl(0, 75%, 65%)', 'rgba(218, 232, 242, 0.4)']);
  expect(presentation.html).toContain('aegis-score-unavailable');
  const badge = document.createElement('div'); badge.innerHTML = presentation.html;
  expect(badge.textContent).toBe('0%—');
  expect(badge.querySelectorAll('.aegis-score-percent')).toHaveLength(1);
  expect(badge.querySelector('.aegis-score-unavailable .aegis-score-percent')).toBeNull();
  const details=scoreDetailsHtml(scores,'pve',{...settings,aegisScoreProfile:'omni'});
  expect(details).toContain('not yet verified');expect(details).toContain('aegis-copy-score-details');
});

it('uses raw scores for the color scale while reserving fading for unavailable values', () => {
  const score = (value: number | null) => ({ value, perfectOverall: value === 100 });
  expect([0, 50, 100].map(value => scoreColor(score(value)))).toEqual([
    'hsl(0, 75%, 65%)', 'hsl(60, 75%, 65%)', 'hsl(120, 75%, 65%)',
  ]);
  const color = scoreColor(score(89.999));
  for (const precision of [0, 1, 2] as const) {
    expect(scoreValueHtml(score(89.999), precision)).toContain(color);
    expect(scoreValueHtml(score(0), precision)).not.toContain('unavailable');
  }
  for (const value of [null, NaN, Infinity]) {
    expect(scoreColor(score(value))).toBe('rgba(218, 232, 242, 0.4)');
    expect(scoreValueHtml(score(value))).toContain('aegis-score-unavailable');
  }
});
