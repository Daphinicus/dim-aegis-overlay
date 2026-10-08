// @vitest-environment jsdom
import { it, expect } from 'vitest';
import { readScoreSettings } from '../../src/score-config';
import { setScorePercentVisibility } from '../../src/score-display';
import { scorePresentation } from '../../src/score-presentation';
import { initLanguage, t } from '../../src/i18n';
it('defaults to visible and accepts only an explicit false setting', () => {
  for (const value of [undefined, null, 'false', 0, true]) {
    expect(readScoreSettings({ aegisScoreShowPercent: value }).aegisScoreShowPercent).toBe(true);
  }
  expect(readScoreSettings({ aegisScoreShowPercent: false }).aegisScoreShowPercent).toBe(false);
});
it('retains raw presentation, accessible labels, and unavailable values when hidden', () => {
  const evaluations: any = { pve: { best: { value: 0, perfectOverall: false } } };
  const shown = readScoreSettings({ aegisRatingDisplay: 'scores' });
  const hidden = { ...shown, aegisScoreShowPercent: false };
  const before = scorePresentation(evaluations, 'both', shown);
  setScorePercentVisibility(false);
  expect(document.documentElement.dataset.aegisScorePercent).toBe('off');
  expect(scorePresentation(evaluations, 'both', hidden)).toEqual(before);
  expect(before.text).toBe('0% | —');
  expect(before.label).toContain('0%');
  setScorePercentVisibility(true);
  expect(document.documentElement.hasAttribute('data-aegis-score-percent')).toBe(false);
});
it('translates the menu caption in all supported languages', () => {
  for (const language of ['en', 'es', 'ko', 'ja', 'zh-CHS', 'zh-CHT']) {
    initLanguage(language);
    expect(t('scorePercentSymbols')).not.toBe('scorePercentSymbols');
    if (language !== 'en') expect(t('scorePercentSymbols')).not.toBe('Percent symbols');
  }
  initLanguage('en');
});
