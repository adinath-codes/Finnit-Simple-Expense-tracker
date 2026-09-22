/** Tiny process-local LRU for deterministic derived UI data. */
export class LruCache<T> {
  private readonly values = new Map<string, T>();

  constructor(private readonly limit: number) {}

  get(key: string) {
    const value = this.values.get(key);
    if (value === undefined) return undefined;
    this.values.delete(key);
    this.values.set(key, value);
    return value;
  }

  set(key: string, value: T) {
    this.values.delete(key);
    this.values.set(key, value);
    while (this.values.size > this.limit) {
      const oldest = this.values.keys().next().value;
      if (oldest === undefined) break;
      this.values.delete(oldest);
    }
    return value;
  }

  clear() {
    this.values.clear();
  }
}
