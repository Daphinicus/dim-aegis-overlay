// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import { bindScoreDetails, scoreDetailsHtml } from '../../src/score-presentation';
import { readScoreSettings } from '../../src/score-config';
import { matchesAegisArgument, parseAegisArgument } from '../../src/aegis-search';
import { renderStatScoreInBar, renderStatGradeInBar } from '../../src/stat-grade';
import { applyGradeColors } from '../../src/grade-colors';

it('copies score feedback from the cached card clone', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  const card = document.createElement('div');
  card.innerHTML = scoreDetailsHtml(undefined, 'pve', readScoreSettings({}));
  const feedback = { owned: { itemHash: 123 }, evaluations: { pve: { best: { value: 89.999 } } } };
  bindScoreDetails(card, feedback);
  document.body.replaceChildren(card.cloneNode(true));
  document.querySelector<HTMLButtonElement>('.aegis-copy-score-details')!.click();
  await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(JSON.stringify(feedback)));
});

it('keeps percentages neutral when the grade palette refreshes', () => {
  document.body.innerHTML = '<div class="aegis-badge aegis-score">97.23%</div>';
  const badge = document.querySelector<HTMLElement>('.aegis-badge')!;
  applyGradeColors(document.body);
  expect(badge.style.background).toBe('');
  expect(badge.style.color).toBe('');
});

it('uses raw scores in native search and excludes armor from score predicates', () => {
  const data: any = { result: { grade: 'S+' }, scoreEvaluations: { pve: { best: { value: 89.999 }, omni: { value: null }, fullCoverage: false } } };
  for (const query of ['score:>=90', 'pve:score:>89.99', 'pvp:score:<=80', 'score:unrated', 'score:omni']) {
    expect(parseAegisArgument(query).ok).toBe(true);
  }
  expect(matchesAegisArgument('score:>=90', data, { mode: 'pve', chase: false })).toBe(false);
  expect(matchesAegisArgument('pve:score:>89.99', data, { mode: 'pve', chase: false })).toBe(true);
  expect(matchesAegisArgument('score:unrated', data, { mode: 'pve', chase: false, scoreProfile: 'omni' })).toBe(true);
  expect(matchesAegisArgument('score:unrated', data, { mode: 'pve', chase: false, kind: 'armor' })).toBe(false);
});

it('keeps stat-row Scores neutral and restores Letter grading', () => {
  const bar = document.createElement('div');
  renderStatScoreInBar(bar, '94.23%', 'PvE Best selections: 94.23%');
  expect(bar.querySelector('.aegis-stat-grade')?.textContent).toBe('94.23%');
  expect(bar.querySelector('.aegis-stat-grade')?.classList.contains('aegis-score')).toBe(true);
  renderStatGradeInBar(bar, {grade:'S+'}, 'perk');
  expect(bar.querySelector('.aegis-stat-grade')?.textContent).toBe('S+');
  expect(bar.querySelector('.aegis-stat-grade')?.classList.contains('aegis-score')).toBe(false);
});
