import { Logger } from '@nestjs/common';
import { FacebookLeadScanPersistencePort } from '../ports/facebook-lead-scan-persistence.port';
import { FacebookLeadClassifierPort } from '../ports/facebook-lead-classifier.port';
import type {
  FacebookLeadDetectionResult,
  FacebookLeadScanItem,
} from '../../domain/services/facebook-lead-text-detector';

export class ProcessPendingFacebookLeadScansUseCase {
  private readonly logger = new Logger(ProcessPendingFacebookLeadScansUseCase.name);

  constructor(
    private readonly persistence: FacebookLeadScanPersistencePort,
    private readonly classifier: FacebookLeadClassifierPort,
  ) {}

  async execute(): Promise<void> {
    // 1. Recover stale PROCESSING scans (timed out over 10 minutes ago)
    try {
      await this.persistence.recoverStaleProcessingScans(10 * 60 * 1000);
    } catch (err) {
      this.logger.error('Failed to recover stale processing scans', err);
    }

    // 2. Fetch one pending scan session
    let scans;
    try {
      scans = await this.persistence.findPendingScans(1);
    } catch (err) {
      this.logger.error('Failed to fetch pending Facebook scans', err);
      return;
    }

    if (!scans || scans.length === 0) {
      return;
    }

    const scan = scans[0];
    this.logger.log(`Starting AI classification for scan ID: ${scan.id} (Post ID: ${scan.postId || 'unknown'}, ${scan.items.length} comments)`);

    // 3. Lock as PROCESSING immediately
    try {
      await this.persistence.markAsProcessing([scan.id]);
    } catch (err) {
      this.logger.error(`Failed to mark scan ${scan.id} as PROCESSING`, err);
      return;
    }

    try {
      // 4. Divide items into chunks of thread trees (30 comments per chunk for faster response and lower timeout risk)
      const chunks = chunkItemsByTree(scan.items, 30);
      this.logger.log(`Comments partitioned into ${chunks.length} chunks.`);

      const chunkResults: FacebookLeadDetectionResult[] = [];
      
      // 5. Call Gemini API sequentially for each chunk
      for (let i = 0; i < chunks.length; i++) {
        this.logger.log(`Classifying chunk ${i + 1}/${chunks.length} (${chunks[i].length} comments)...`);
        const result = await this.classifier.classify(chunks[i]);
        chunkResults.push(result);
      }

      // 6. Merge detection results
      const finalResult = mergeDetectionResults(chunkResults);

      // 7. Update final success results in DB
      await this.persistence.updateAiAnalysisResult(scan.id, 'COMPLETED', finalResult);
      this.logger.log(`AI classification successfully completed for scan ID: ${scan.id}. Total profiles: ${finalResult.leadProfiles.length}`);

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`AI classification failed for scan ID ${scan.id}: ${errMsg}`);
      
      try {
        await this.persistence.incrementRetryCount(scan.id, errMsg);
      } catch (dbErr) {
        this.logger.error(`Failed to increment retry count for scan ${scan.id}`, dbErr);
      }
    }
  }
}

function chunkItemsByTree(items: FacebookLeadScanItem[], maxChunkSize: number): FacebookLeadScanItem[][] {
  const itemMap = new Map<string, FacebookLeadScanItem>();
  const childrenMap = new Map<string, FacebookLeadScanItem[]>();
  const roots: FacebookLeadScanItem[] = [];

  for (const item of items) {
    const key = item.commentId || item.fingerprint;
    if (key) {
      itemMap.set(key, item);
    }
  }

  for (const item of items) {
    const parentId = item.parentCommentId;
    if (parentId && itemMap.has(parentId)) {
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(item);
    } else {
      roots.push(item);
    }
  }

  function collectDescendants(item: FacebookLeadScanItem): FacebookLeadScanItem[] {
    const descendants: FacebookLeadScanItem[] = [item];
    const itemId = item.commentId || item.fingerprint;
    if (itemId && childrenMap.has(itemId)) {
      const children = childrenMap.get(itemId)!;
      for (const child of children) {
        descendants.push(...collectDescendants(child));
      }
    }
    return descendants;
  }

  const threads: FacebookLeadScanItem[][] = [];
  for (const root of roots) {
    threads.push(collectDescendants(root));
  }

  const chunks: FacebookLeadScanItem[][] = [];
  let currentChunk: FacebookLeadScanItem[] = [];

  for (const thread of threads) {
    if (currentChunk.length + thread.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
    currentChunk.push(...thread);
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function mergeDetectionResults(results: FacebookLeadDetectionResult[]): FacebookLeadDetectionResult {
  if (results.length === 0) {
    return {
      detectorVersion: 'gemini-2.5-flash-v1',
      generatedAt: new Date().toISOString(),
      summary: {},
      aiCandidates: [],
      leadProfiles: [],
    };
  }

  if (results.length === 1) {
    return results[0];
  }

  const profileMap = new Map<string, any>();

  for (const res of results) {
    for (const profile of res.leadProfiles) {
      const key = profile.profileKey;
      if (!profileMap.has(key)) {
        profileMap.set(key, { ...profile, reasons: [...profile.reasons], evidence: [...profile.evidence] });
      } else {
        const existing = profileMap.get(key);
        
        const rank = (c: string) => {
          if (c === 'POTENTIAL_PARENT') return 1;
          if (c === 'RECOMMENDATION') return 2;
          if (c === 'TEACHER_AD') return 3;
          if (c === 'COMPETITOR_SALE') return 4;
          if (c === 'NEUTRAL') return 5;
          return 6;
        };

        if (rank(profile.classification) < rank(existing.classification)) {
          existing.classification = profile.classification;
        }

        existing.leadScore = Math.max(existing.leadScore, profile.leadScore);

        const levelRank = (l: string) => {
          if (l === 'HOT') return 1;
          if (l === 'WARM') return 2;
          if (l === 'COLD') return 3;
          return 4;
        };
        if (levelRank(profile.leadLevel) < levelRank(existing.leadLevel)) {
          existing.leadLevel = profile.leadLevel;
        }

        existing.promotionScore = Math.max(existing.promotionScore, profile.promotionScore);
        existing.reasons = [...new Set([...existing.reasons, ...profile.reasons])];
        existing.evidence = [...existing.evidence, ...profile.evidence];
      }
    }
  }

  const mergedProfiles = [...profileMap.values()];

  const summary: Record<string, number> = {
    totalProfiles: mergedProfiles.length,
    POTENTIAL_PARENT: 0,
    TEACHER_AD: 0,
    COMPETITOR_SALE: 0,
    RECOMMENDATION: 0,
    NEUTRAL: 0,
    SPAM: 0,
    HOT: 0,
    WARM: 0,
    COLD: 0,
  };

  for (const p of mergedProfiles) {
    summary[p.classification] = (summary[p.classification] || 0) + 1;
    if (p.leadLevel !== 'NONE') {
      summary[p.leadLevel] = (summary[p.leadLevel] || 0) + 1;
    }
  }

  return {
    detectorVersion: results[0].detectorVersion,
    generatedAt: new Date().toISOString(),
    summary,
    aiCandidates: mergedProfiles.filter(
      (p) => p.classification === 'POTENTIAL_PARENT' && p.leadScore >= 30
    ),
    leadProfiles: mergedProfiles,
  };
}
