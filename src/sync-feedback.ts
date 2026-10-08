export type SheetSyncStatus = 'loading' | 'success' | 'partial' | 'error';

/** Name only caches that actually contain data; never promise a fresh user a fallback. */
export function sheetFailureMessage(failed: unknown[], caches: Record<string, any>): string {
  const available = [caches.aegisSheetDb, caches.aegisSheetDbPvE, caches.aegisSheetDbPvP].some(db => db?.weapons && Object.keys(db.weapons).length)
    || [caches.aegisShoppingDb, caches.aegisShoppingDbPvE, caches.aegisShoppingDbPvP].some(db => Array.isArray(db?.items) && db.items.length);
  return 'Failed to refresh ' + failed.join(' and ') + (available
    ? '; available cached data retained. Retry when connected.'
    : '; no cached spreadsheet data is available. Retry when connected.');
}

export function sheetSyncFeedback(data: { aegisSheetSyncStatus?: SheetSyncStatus; aegisSheetSyncError?: string | null; aegisSheetLastSync?: number }) {
  const status = data.aegisSheetSyncStatus || (data.aegisSheetLastSync ? 'success' : 'idle');
  const key = status === 'loading' ? 'resyncing' : status === 'success' ? 'resyncSuccess'
    : status === 'partial' ? 'syncPartial' : status === 'error' ? 'resyncFailed' : 'syncNotYet';
  return { status, key, error: data.aegisSheetSyncError || '', loading: status === 'loading' };
}
