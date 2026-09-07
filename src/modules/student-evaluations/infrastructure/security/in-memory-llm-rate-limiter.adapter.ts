import { Injectable } from '@nestjs/common';
import { ILlmRateLimiterPort } from '../../application/ports/llm-rate-limiter.port';

@Injectable()
export class InMemoryLlmRateLimiterAdapter implements ILlmRateLimiterPort {
  private readonly callHistory = new Map<string, number[]>();
  private readonly cooldowns = new Map<string, number>();

  async checkLimit(teacherId: string): Promise<boolean> {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxCallsPerMinute = Number(process.env.LLM_RATE_LIMIT_PER_MINUTE) || 30;

    const timestamps = (this.callHistory.get(teacherId) || []).filter(
      (ts) => now - ts < windowMs,
    );

    if (timestamps.length >= maxCallsPerMinute) {
      return false;
    }

    timestamps.push(now);
    this.callHistory.set(teacherId, timestamps);
    return true;
  }

  async checkCooldown(key: string): Promise<boolean> {
    const now = Date.now();
    const cooldownMs = (Number(process.env.LLM_COOLDOWN_SECONDS) || 3) * 1000;
    const lastCalled = this.cooldowns.get(key);

    if (lastCalled && now - lastCalled < cooldownMs) {
      return false;
    }

    this.cooldowns.set(key, now);
    return true;
  }
}
