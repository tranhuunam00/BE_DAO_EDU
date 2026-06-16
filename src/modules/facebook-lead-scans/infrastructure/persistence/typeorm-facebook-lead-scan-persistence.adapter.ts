import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { FacebookLeadItemOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/facebook-lead-item.orm-entity';
import { FacebookLeadScanOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/facebook-lead-scan.orm-entity';
import type {
  FacebookLeadDetectionResult,
  FacebookLeadScanItem,
} from '../../domain/services/facebook-lead-text-detector';
import {
  FacebookLeadScanDetail,
  FacebookLeadScanListResult,
  FacebookLeadScanPersistencePort,
  FacebookLeadScanRecord,
  SaveFacebookLeadScanInput,
} from '../../application/ports/facebook-lead-scan-persistence.port';

@Injectable()
export class TypeOrmFacebookLeadScanPersistenceAdapter
  implements FacebookLeadScanPersistencePort
{
  constructor(
    @InjectRepository(FacebookLeadScanOrmEntity)
    private readonly scanRepository: Repository<FacebookLeadScanOrmEntity>,
    @InjectRepository(FacebookLeadItemOrmEntity)
    private readonly itemRepository: Repository<FacebookLeadItemOrmEntity>,
  ) {}

  async save(
    input: SaveFacebookLeadScanInput,
  ): Promise<FacebookLeadScanRecord> {
    const meta = input.meta || {};
    
    if (!input.items || !input.items.length) {
      throw new Error('FACEBOOK_LEAD_SCAN_EMPTY');
    }

    // Group items by post_id
    const itemsByPost = new Map<string, FacebookLeadScanItem[]>();
    for (const item of input.items) {
      const pId = item.postId || 'unknown';
      if (!itemsByPost.has(pId)) {
        itemsByPost.set(pId, []);
      }
      itemsByPost.get(pId)!.push(item);
    }

    let firstScanRecord: FacebookLeadScanRecord | null = null;
    let index = 0;

    for (const [pId, postItems] of itemsByPost.entries()) {
      const firstItem = postItems[0];
      const groupUrl = stringValue(meta.groupUrl) || firstItem?.groupUrl || '';
      
      // If we have meta.postUrl but are processing multiple posts, use the item's pageUrl
      const postUrl = (itemsByPost.size === 1 && stringValue(meta.postUrl))
        ? stringValue(meta.postUrl)
        : (firstItem?.pageUrl || firstItem?.sourceUrl || '');
      
      const postId = pId === 'unknown' ? '' : pId;
      
      // Use unique scanSessionId per post to avoid duplicate key constraint if it is a split session
      const scanSessionId = itemsByPost.size === 1
        ? input.scanSessionId
        : `${input.scanSessionId}_${index}`;
      
      index++;

      let scan = await this.scanRepository.findOne({
        where: { scanSessionId },
      });
      if (!scan) {
        scan = this.scanRepository.create({
          scanSessionId,
          source: input.source,
        });
      }

      scan.source = input.source;
      scan.groupUrl = groupUrl;
      scan.postUrl = postUrl;
      scan.postId = postId;
      scan.scannedAt = parseDate(meta.scannedAt);
      scan.exportedAt = parseDate(input.exportedAt);
      scan.itemCount = postItems.length;
      scan.meta = { ...meta, postId, postUrl, groupUrl };
      scan.localAnalysis = input.localAnalysis || null;
      scan.detection = input.detection as unknown as Record<string, unknown>;
      scan = await this.scanRepository.save(scan);
      const scanId = scan.id;

      const fingerprints = [
        ...new Set(postItems.map((item) => item.fingerprint).filter(Boolean)),
      ];
      const existing = fingerprints.length
        ? await this.itemRepository.find({
            where: { fingerprint: In(fingerprints) },
            select: { fingerprint: true },
          })
        : [];
      const existingFingerprints = new Set(
        existing.map((item) => item.fingerprint),
      );
      const newItems = postItems.filter(
        (item) => item.fingerprint && !existingFingerprints.has(item.fingerprint),
      );

      if (newItems.length) {
        await this.itemRepository.save(
          newItems.map((item) => this.toItemEntity(scanId, item)),
        );
      }

      scan.acceptedItems = newItems.length;
      scan.duplicateItems = postItems.length - newItems.length;
      scan = await this.scanRepository.save(scan);
      
      const record = this.toScanRecord(scan);
      if (!firstScanRecord) {
        firstScanRecord = record;
      }
    }

    return firstScanRecord || this.toScanRecord(null as any);
  }

  async list(input: {
    page: number;
    limit: number;
    groupUrl?: string;
  }): Promise<FacebookLeadScanListResult> {
    const where: FindOptionsWhere<FacebookLeadScanOrmEntity> = {};
    if (input.groupUrl) where.groupUrl = input.groupUrl;

    const [items, total] = await this.scanRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    });
    return { items: items.map((item) => this.toScanRecord(item)), total };
  }

  async findById(id: string): Promise<FacebookLeadScanDetail | null> {
    const scan = await this.scanRepository.findOne({
      where: { id },
      relations: { items: true },
      order: { items: { capturedAt: 'ASC' } },
    });
    if (!scan) return null;
    return {
      ...this.toScanRecord(scan),
      items: (scan.items || []).map((item) => this.toScanItem(item)),
    };
  }

  async getScannedPostIds(groupUrl: string): Promise<string[]> {
    const rows = await this.scanRepository
      .createQueryBuilder('scan')
      .select('DISTINCT scan.postId', 'postId')
      .where('scan.groupUrl = :groupUrl', { groupUrl })
      .andWhere('scan.postId != :empty', { empty: '' })
      .getRawMany();
    return rows.map((r) => r.postId);
  }

  private toItemEntity(
    scanId: string,
    item: FacebookLeadScanItem,
  ): FacebookLeadItemOrmEntity {
    return this.itemRepository.create({
      scanId,
      fingerprint: item.fingerprint || '',
      parserVersion: numberOrNull((item as { parserVersion?: number }).parserVersion),
      kind: item.kind || '',
      source: stringValue((item as { source?: string }).source),
      groupUrl: stringValue((item as { groupUrl?: string }).groupUrl),
      pageUrl: item.pageUrl || '',
      sourceUrl: item.sourceUrl || '',
      parentFingerprint: nullableString(
        (item as { parentFingerprint?: string | null }).parentFingerprint,
      ),
      postId: item.postId || '',
      commentId: nullableString(item.commentId),
      parentCommentId: nullableString(
        (item as { parentCommentId?: string | null }).parentCommentId,
      ),
      depth: Number(item.depth || 0),
      treePath: stringValue((item as { treePath?: string }).treePath),
      contextTexts: Array.isArray(item.contextTexts) ? item.contextTexts : [],
      replyToAuthor: stringValue(
        (item as { replyToAuthor?: string }).replyToAuthor,
      ),
      authorName: item.authorName || '',
      authorUrl: item.authorUrl || '',
      text: item.text || '',
      capturedAt: parseDate((item as { capturedAt?: string }).capturedAt),
      lastSeenAt: parseDate(item.lastSeenAt),
      raw: item as unknown as Record<string, unknown>,
    });
  }

  private toScanRecord(scan: FacebookLeadScanOrmEntity): FacebookLeadScanRecord {
    return {
      id: scan.id,
      scanSessionId: scan.scanSessionId,
      source: scan.source,
      groupUrl: scan.groupUrl,
      postUrl: scan.postUrl,
      postId: scan.postId,
      scannedAt: scan.scannedAt,
      exportedAt: scan.exportedAt,
      itemCount: scan.itemCount,
      acceptedItems: scan.acceptedItems,
      duplicateItems: scan.duplicateItems,
      meta: scan.meta,
      localAnalysis: scan.localAnalysis,
      detection: scan.detection as unknown as FacebookLeadDetectionResult,
      createdAt: scan.createdAt,
      updatedAt: scan.updatedAt,
    };
  }

  private toScanItem(item: FacebookLeadItemOrmEntity): FacebookLeadScanItem {
    return {
      kind: item.kind,
      sourceUrl: item.sourceUrl,
      pageUrl: item.pageUrl,
      postId: item.postId,
      commentId: item.commentId || '',
      depth: item.depth,
      contextTexts: item.contextTexts,
      authorName: item.authorName,
      authorUrl: item.authorUrl,
      text: item.text,
      fingerprint: item.fingerprint,
      lastSeenAt: item.lastSeenAt?.toISOString(),
    };
  }
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}


