/**
 * The records store talks to localStorage. Rather than pull in a full DOM, give
 * the tests a real in-memory implementation — the store's own guards against
 * unavailable storage are then exercised by deleting it, not by faking throws.
 */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
}

globalThis.localStorage = new MemoryStorage();
