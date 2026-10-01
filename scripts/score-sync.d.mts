export function scoreRowMetadata(getValue: (row: string[], keys: string[]) => string, row: string[], category: string, rowIndex: number): {
  categoryKey: string; weaponType?: string; weaponSlot?: string; affinity?: string; sourceRowId: string;
};
