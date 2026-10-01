/** Bounded, page-session evaluations shared by state indexing and tile rendering. */
export function createEvaluationCache<T>(limit = 4096) {
  const entries = new Map<string, { signature: string; value: T }>();
  let hits = 0, misses = 0;
  return {
    get(key: string, signature: string, evaluate: () => T): T {
      const cached = entries.get(key);
      if (cached?.signature === signature) {
        hits++;
        entries.delete(key); entries.set(key, cached);
        return cached.value;
      }
      misses++;
      const value = evaluate();
      entries.delete(key);
      if (entries.size >= limit) entries.delete(entries.keys().next().value!);
      entries.set(key, { signature, value });
      return value;
    },
    clear() { entries.clear(); },
    stats: () => ({ entries: entries.size, hits, misses }),
  };
}
