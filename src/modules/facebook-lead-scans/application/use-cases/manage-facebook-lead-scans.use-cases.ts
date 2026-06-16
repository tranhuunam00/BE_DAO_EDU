import { randomUUID } from 'crypto';
import {
  FacebookLeadTextDetector,
  type FacebookLeadScanItem,
} from '../../domain/services/facebook-lead-text-detector';
import { FacebookLeadScanPersistencePort } from '../ports/facebook-lead-scan-persistence.port';

export class SubmitFacebookLeadScanUseCase {
  private readonly detector = new FacebookLeadTextDetector();

  constructor(private readonly persistence: FacebookLeadScanPersistencePort) {}

  execute(input: {
    source?: string;
    scanSessionId?: string;
    exportedAt?: string;
    meta?: Record<string, unknown>;
    localAnalysis?: Record<string, unknown>;
    items: FacebookLeadScanItem[];
  }) {
    const items = dedupeItems(input.items || []);
    if (!items.length) throw new Error('FACEBOOK_LEAD_SCAN_EMPTY');

    const detection = this.detector.analyze(items);
    return this.persistence.save({
      source: input.source || 'DAO_EDU_FACEBOOK_EXTENSION',
      scanSessionId: input.scanSessionId || randomUUID(),
      exportedAt: input.exportedAt,
      meta: input.meta,
      localAnalysis: input.localAnalysis,
      items,
      detection,
    });
  }
}

export class ListFacebookLeadScansUseCase {
  constructor(private readonly persistence: FacebookLeadScanPersistencePort) {}

  execute(input: { page?: number; limit?: number; groupUrl?: string }) {
    return this.persistence.list({
      page: Math.max(1, input.page ?? 1),
      limit: Math.min(100, Math.max(1, input.limit ?? 20)),
      groupUrl: input.groupUrl,
    });
  }
}

export class GetFacebookLeadScanUseCase {
  constructor(private readonly persistence: FacebookLeadScanPersistencePort) {}

  async execute(id: string) {
    const scan = await this.persistence.findById(id);
    if (!scan) throw new Error('FACEBOOK_LEAD_SCAN_NOT_FOUND');
    return scan;
  }
}

function dedupeItems(items: FacebookLeadScanItem[]): FacebookLeadScanItem[] {
  const map = new Map<string, FacebookLeadScanItem>();
  for (const item of items) {
    const key = item.fingerprint || [
      item.kind,
      item.sourceUrl,
      item.authorUrl || item.authorName,
      item.text,
    ].join('|');
    if (!key) continue;
    map.set(key, item);
  }
  return [...map.values()];
}
