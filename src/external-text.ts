/** External strings remain text even when surrounded by trusted tooltip HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
}
export function canonicalLightggGrade(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const grade = value.trim().toUpperCase();
  return /^[SABCDF][+-]?$/.test(grade) ? grade : null;
}
export function normalizeLightggData(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [id, raw] of Object.entries(value)) {
    const grade = canonicalLightggGrade(raw);
    if (/^\d{1,20}$/.test(id) && grade) result[id] = grade;
  }
  return result;
}
