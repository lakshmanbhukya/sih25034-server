// Simple in-memory cache with TTL
class Cache {
  constructor() {
    this.cache = new Map();
  }

  set(key, value, ttlMinutes = 5) {
    const expiry = Date.now() + (ttlMinutes * 60 * 1000);
    this.cache.set(key, { value, expiry });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

module.exports = new Cache();