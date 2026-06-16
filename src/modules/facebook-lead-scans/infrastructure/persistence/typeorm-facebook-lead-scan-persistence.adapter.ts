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
    const firstItem = input.items[0];
    const groupUrl = stringValue(meta.groupUrl) || firstItem?.groupUrl || '';
    const postUrl =
      stringValue(meta.postUrl) ||
      stringValue(meta.pageUrl) ||
      firstItem?.pageUrl ||
      firstItem?.sourceUrl ||
      '';
    const postId = stringValue(meta.postId) || firstItem?.postId || '';

    let scan = await this.scanRepository.findOne({
      where: { scanSessionId: input.scanSessionId },
    });
    scan ??= this.scanRepository.create({
      scanSessionId: input.scanSessionId,
      source: input.source,
    });

    scan.source = input.source;
    scan.groupUrl = groupUrl;
    scan.postUrl = postUrl;
    scan.postId = postId;
    scan.scannedAt = parseDate(meta.scannedAt);
    scan.exportedAt = parseDate(input.exportedAt);
    scan.itemCount = input.items.length;
    scan.meta = input.meta || null;
    scan.localAnalysis = input.localAnalysis || null;
    scan.detection = input.detection as unknown as Record<string, unknown>;
    scan = await this.scanRepository.save(scan);

    const fingerprints = [
      ...new Set(input.items.map((item) => item.fingerprint).filter(Boolean)),
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
    const newItems = input.items.filter(
      (item) => item.fingerprint && !existingFingerprints.has(item.fingerprint),
    );

    if (newItems.length) {
      await this.itemRepository.save(
        newItems.map((item) => this.toItemEntity(scan.id, item)),
      );
    }

    scan.acceptedItems = newItems.length;
    scan.duplicateItems = input.items.length - newItems.length;
    scan = await this.scanRepository.save(scan);
    return this.toScanRecord(scan);
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
