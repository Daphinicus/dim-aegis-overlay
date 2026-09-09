export function normalizeMasterwork(value: string): string {
  const name = value.toLowerCase().replace(/\btier\s*\d+\s*/g, '').replace(/\b(?:mw|masterwork(?:ed|s)?)\b\s*:?/g, '').trim().replace(/\s+/g, ' ');
  return ({ 'reload speed': 'reload', 'projectile speed': 'velocity' } as Record<string, string>)[name] || name;
}

export function masterworkMatches(recommendations: string[], equipped: string): boolean {
  if (!recommendations.length) return true;
  const actual = normalizeMasterwork(equipped);
  return !!actual && recommendations.some(recommended => normalizeMasterwork(recommended) === actual);
}
