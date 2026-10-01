/** Shared score metadata for the background sync and snapshot generator. */
export function scoreRowMetadata(getValue, row, category, rowIndex) {
  return {
    categoryKey: getValue(row, ['Type']) || category,
    weaponType: getValue(row, ['Type']) || undefined,
    weaponSlot: getValue(row, ['Slot']) || undefined,
    affinity: getValue(row, ['Affinity']) || undefined,
    sourceRowId: `${category}:${rowIndex}`
  };
}
