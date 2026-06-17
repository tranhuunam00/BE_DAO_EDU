import type {
  FacebookLeadDetectionResult,
  FacebookLeadScanItem,
} from '../../domain/services/facebook-lead-text-detector';

export abstract class FacebookLeadClassifierPort {
  abstract classify(items: FacebookLeadScanItem[]): Promise<FacebookLeadDetectionResult>;
}
