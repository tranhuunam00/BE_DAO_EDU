import { Injectable } from '@nestjs/common';
import { ILlmEvaluationCachePort } from '../../application/ports/llm-evaluation-cache.port';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

@Injectable()
export class InMemoryLlmEvaluationCacheAdapter implements ILlmEvaluationCachePort {
  private readonly store = new Map<string, CacheEntry>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number = 900): Promise<void> {
    // Tự động dọn dẹp nếu bộ nhớ quá 1,000 mục
    if (this.store.size > 1000) {
      this.evictExpired();
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [k, v] of this.store.entries()) {
      if (now > v.expiresAt) {
        this.store.delete(k);
      }
    }
  }
}
