export interface ILlmRateLimiterPort {
  checkLimit(key: string): Promise<boolean>;
  checkCooldown?(key: string): Promise<boolean>;
}

export const ILlmRateLimiterPort = Symbol('ILlmRateLimiterPort');
