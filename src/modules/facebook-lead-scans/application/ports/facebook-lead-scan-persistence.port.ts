import type {
  FacebookLeadDetectionResult,
  FacebookLeadScanItem,
} from '../../domain/services/facebook-lead-text-detector';

export interface SaveFacebookLeadScanInput {
  source: string;
  scanSessionId: string;
  exportedAt?: string;
  meta?: Record<string, unknown>;
  localAnalysis?: Record<string, unknown>;
  items: FacebookLeadScanItem[];
  detection: FacebookLeadDetectionResult;
}

export interface FacebookLeadScanRecord {
  id: string;
  scanSessionId: string;
  source: string;
  groupUrl: string;
  postUrl: string;
  postId: string;
  scannedAt: Date | null;
  exportedAt: Date | null;
  itemCount: number;
  acceptedItems: number;
  duplicateItems: number;
  meta: Record<string, unknown> | null;
  localAnalysis: Record<string, unknown> | null;
  detection: FacebookLeadDetectionResult;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacebookLeadScanDetail extends FacebookLeadScanRecord {
  items: FacebookLeadScanItem[];
}

export interface FacebookLeadScanListResult {
  items: FacebookLeadScanRecord[];
  total: number;
}

export abstract class FacebookLeadScanPersistencePort {
  abstract save(input: SaveFacebookLeadScanInput): Promise<FacebookLeadScanRecord>;

  abstract list(input: {
    page: number;
    limit: number;
    groupUrl?: string;
  }): Promise<FacebookLeadScanListResult>;

  abstract findById(id: string): Promise<FacebookLeadScanDetail | null>;
  abstract getScannedPostIds(groupUrl: string): Promise<string[]>;
}
