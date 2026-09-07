export interface ILlmEvaluationCachePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
}

export const ILlmEvaluationCachePort = Symbol('ILlmEvaluationCachePort');
