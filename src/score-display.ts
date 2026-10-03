/** Hide only score suffixes; retain percentage text for labels and consumers. */
export function setScorePercentVisibility(show: boolean): void {
  if (show) document.documentElement.removeAttribute('data-aegis-score-percent');
  else document.documentElement.setAttribute('data-aegis-score-percent', 'off');
}
