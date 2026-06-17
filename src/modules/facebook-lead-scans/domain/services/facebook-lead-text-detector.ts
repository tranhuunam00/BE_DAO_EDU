export type FacebookLeadClassification =
  | 'POTENTIAL_PARENT'
  | 'TEACHER_AD'
  | 'COMPETITOR_SALE'
  | 'RECOMMENDATION'
  | 'NEUTRAL'
  | 'SPAM';

export type FacebookLeadLevel = 'HOT' | 'WARM' | 'COLD' | 'NONE';

export interface FacebookLeadScanItem {
  parserVersion?: number;
  kind?: string;
  source?: string;
  groupUrl?: string;
  pageUrl?: string;
  sourceUrl?: string;
  parentFingerprint?: string | null;
  postId?: string;
  commentId?: string | null;
  parentCommentId?: string | null;
  depth?: number;
  treePath?: string;
  contextTexts?: string[];
  replyToAuthor?: string;
  authorName?: string;
  authorUrl?: string;
  text?: string;
  capturedAt?: string;
  lastSeenAt?: string;
  fingerprint?: string;
  missingPostContent?: boolean;
}

export interface FacebookLeadEvidence {
  kind: string;
  text: string;
  sourceUrl: string;
  pageUrl: string;
  postId: string;
  commentId: string;
  depth: number;
  itemLeadScore: number;
  authorName?: string;
  threadPath?: Record<string, unknown>[];
}

export interface FacebookLeadProfile {
  profileKey: string;
  authorName: string;
  authorUrl: string;
  classification: FacebookLeadClassification;
  leadScore: number;
  leadLevel: FacebookLeadLevel;
  promotionScore: number;
  reasons: string[];
  evidence: FacebookLeadEvidence[];
}

export interface FacebookLeadDetectionResult {
  detectorVersion: string;
  generatedAt: string;
  summary: Record<string, number>;
  aiCandidates: FacebookLeadProfile[];
  leadProfiles: FacebookLeadProfile[];
}

const DEMAND_PATTERNS = [
  /\bcan tim\b/,
  /\btim (lop|gia su|thay|co|trung tam)\b/,
  /\bxin (review|gioi thieu|tu van)\b/,
  /\bco (lop|cho hoc|trung tam) nao\b/,
  /\bhoc (o dau|phi|them)\b/,
  /\bcon (minh|em|toi|nha minh)\b/,
  /\bmat goc\b/,
  /\bluyen thi\b/,
  /\bquan tam\b/,
];

const RESPONSE_INTENT_PATTERNS = [
  /\b(cho|minh|em|anh|chi) xin\b/,
  /\bxin (hoc phi|gia|bao gia|dia chi|thong tin|lich hoc)\b/,
  /\b(hoc phi|gia bao nhieu|bao nhieu tien|dia chi|lich hoc)\b/,
  /\btu van (giup|minh|em|cho)\b/,
];

const EDUCATION_PATTERNS = [
  /\b(toan|van|anh|ly|hoa|sinh|tieng anh)\b/,
  /\b(lop|khoi) ?([1-9]|1[0-2])\b/,
  /\b(gia su|hoc them|luyen thi|trung tam|giao vien)\b/,
  /\b(ielts|toeic|cambridge|vao 10|thi dai hoc)\b/,
];

const PROMOTION_PATTERNS = [
  /\b(inbox|ib|nhan tin) (em|co|thay|minh)\b/,
  /\bben (em|minh|co|thay)\b/,
  /\b(co|thay|em|minh) co lop\b/,
  /\b(tham khao) (lop|co|thay|trung tam)\b/,
  /\b(lop|khoa) (co|thay|ben em|ben minh)\b/,
  /\bnhan (day|kem|gia su)\b/,
  /\b(tuyen sinh|chuyen luyen|day kem|hoc thu)\b/,
  /\b(dang ky|khai giang|uu dai|cam ket dau ra|lien he)\b/,
  /\b(sdt|sddt|so dien thoai|zalo|hotline)\b/,
];

const COMPETITOR_PATTERNS = [
  /\btrung tam (ben|cua)? ?(em|minh|chung toi)?\b/,
  /\b(doi ngu giao vien|chuong trinh hoc|hoc vien)\b/,
  /\b(fanpage|website|khai giang|uu dai|tuyen sinh)\b/,
];

const RECOMMENDATION_PATTERNS = [
  /\b(thay|co|trung tam) .{0,40} (day|hoc) (tot|ok|on)\b/,
  /\bminh (gioi thieu|recommend)\b/,
  /\bban thu (lien he|hoi)\b/,
];

interface ProfileGroup {
  profileKey: string;
  authorName: string;
  authorUrl: string;
  items: FacebookLeadScanItem[];
}

interface ItemAnalysis {
  item: FacebookLeadScanItem;
  leadScore: number;
  promotionScore: number;
  recommendationScore: number;
  ownDemandHits: number;
  responseIntentHits: number;
  educationHits: number;
  ownEducationHits: number;
  contextEducationHits: number;
  promotionHits: number;
  competitorHits: number;
  recommendationHits: number;
}

export class FacebookLeadTextDetector {
  analyze(items: FacebookLeadScanItem[]): FacebookLeadDetectionResult {
    const groups = new Map<string, ProfileGroup>();

    for (const item of items) {
      if (!item.text || !item.authorName) continue;
      const key =
        normalizeProfileUrl(item.authorUrl) ||
        `name:${normalizeText(item.authorName)}`;
      const group = groups.get(key) || {
        profileKey: key,
        authorName: item.authorName,
        authorUrl: item.authorUrl || '',
        items: [],
      };
      group.items.push(item);
      if (!group.authorUrl && item.authorUrl) group.authorUrl = item.authorUrl;
      groups.set(key, group);
    }

    const leadProfiles = [...groups.values()]
      .map((group) => this.classifyProfile(group, items))
      .sort((a, b) => b.leadScore - a.leadScore);

    const summary: Record<string, number> = {
      totalProfiles: 0,
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

    for (const profile of leadProfiles) {
      summary.totalProfiles += 1;
      summary[profile.classification] += 1;
      if (profile.leadLevel !== 'NONE') summary[profile.leadLevel] += 1;
    }

    return {
      detectorVersion: 'backend-text-v1',
      generatedAt: new Date().toISOString(),
      summary,
      aiCandidates: leadProfiles.filter(
        (profile) =>
          profile.classification === 'POTENTIAL_PARENT' &&
          profile.leadScore >= 30,
      ),
      leadProfiles,
    };
  }

  private classifyProfile(group: ProfileGroup, allItems: FacebookLeadScanItem[]): FacebookLeadProfile {
    const analyses = group.items.map((item) => this.analyzeItem(item));
    const ownTexts = group.items.map((item) => normalizeText(item.text));
    const uniqueTexts = [...new Set(ownTexts)];
    const duplicateRatio =
      ownTexts.length > 1 ? 1 - uniqueTexts.length / ownTexts.length : 0;
    const combinedText = uniqueTexts.join(' ');
    const phoneCount = (
      combinedText.match(/(?:\+?84|0)(?:\d[\s.-]?){8,10}\b/g) || []
    ).length;
    const linkCount = (combinedText.match(/https?:\/\/|www\.|facebook\.com/g) || [])
      .length;
    const uniquePosts = new Set(
      group.items.map((item) => item.pageUrl || item.sourceUrl).filter(Boolean),
    ).size;

    const promotionHits = sumMetric(analyses, 'promotionHits');
    const competitorHits = sumMetric(analyses, 'competitorHits');
    const demandHits = sumMetric(analyses, 'ownDemandHits');
    const responseIntentHits = sumMetric(analyses, 'responseIntentHits');
    const educationHits = sumMetric(analyses, 'educationHits');
    const ownEducationHits = sumMetric(analyses, 'ownEducationHits');
    const contextEducationHits = sumMetric(analyses, 'contextEducationHits');
    const recommendationHits = sumMetric(analyses, 'recommendationHits');
    const bestLeadEvidence = maxByScore(analyses, 'leadScore');
    const bestPromotionEvidence = maxByScore(analyses, 'promotionScore');
    const repeatedAcrossPosts = uniquePosts >= 3 && duplicateRatio >= 0.35;

    const promotionScore = clamp(
      Number(bestPromotionEvidence?.promotionScore || 0) +
        Math.min(promotionHits, 3) * 8 +
        Math.min(competitorHits, 2) * 10 +
        Math.min(phoneCount, 2) * 15 +
        Math.min(linkCount, 2) * 15 +
        (repeatedAcrossPosts ? 40 : 0),
      0,
      100,
    );
    const leadScore = clamp(
      Number(bestLeadEvidence?.leadScore || 0) - promotionScore * 0.65,
      0,
      100,
    );

    let classification: FacebookLeadClassification = 'NEUTRAL';
    const reasons: string[] = [];
    if (repeatedAcrossPosts && promotionScore >= 55) {
      classification = 'COMPETITOR_SALE';
      reasons.push('Noi dung quang cao lap lai tren nhieu bai');
    } else if (
      promotionScore >= 55 &&
      (competitorHits >= 2 ||
        (competitorHits >= 1 &&
          (phoneCount > 0 || linkCount > 0 || uniquePosts >= 2)))
    ) {
      classification = 'COMPETITOR_SALE';
      reasons.push('Co dau hieu trung tam hoac don vi sale');
    } else if (promotionHits >= 1 && promotionScore >= 18) {
      classification = 'TEACHER_AD';
      reasons.push('Co loi moi hoc, nhan day hoac de lai lien he');
    } else if (
      demandHits + responseIntentHits > 0 &&
      educationHits > 0 &&
      leadScore >= 30
    ) {
      classification = 'POTENTIAL_PARENT';
      reasons.push('Co nhu cau hoc tap trong chinh noi dung nguoi dung');
    } else if (recommendationHits >= 1) {
      classification = 'RECOMMENDATION';
      reasons.push('Dang gioi thieu giao vien hoac trung tam');
    } else if (
      group.items.length >= 5 &&
      (duplicateRatio >= 0.7 || combinedText.length < 30)
    ) {
      classification = 'SPAM';
      reasons.push('Noi dung ngan hoac lap lai nhieu lan');
    }

    if (ownEducationHits) reasons.push('Tu nhac toi mon/lop/viec hoc');
    else if (contextEducationHits) reasons.push('Ngu canh cha la giao duc');
    if (uniquePosts >= 3) reasons.push(`Xuat hien trong ${uniquePosts} bai`);
    if (phoneCount) reasons.push('Co so dien thoai');

    return {
      profileKey: group.profileKey,
      authorName: group.authorName,
      authorUrl: group.authorUrl,
      classification,
      leadScore: Math.round(leadScore),
      leadLevel: getLeadLevel(leadScore, classification),
      promotionScore: Math.round(promotionScore),
      reasons,
      evidence: analyses
        .sort((a, b) => b.leadScore - a.leadScore)
        .slice(0, 5)
        .map((analysis) => toEvidence(analysis, allItems)),
    };
  }

  private analyzeItem(item: FacebookLeadScanItem): ItemAnalysis {
    const ownText = normalizeText(item.text);
    const parentContextText = getParentContextText(item);
    const fullContextText = [parentContextText, ownText]
      .filter(Boolean)
      .join(' ');
    const ownDemandHits = countMatches(ownText, DEMAND_PATTERNS);
    const responseIntentHits = countMatches(ownText, RESPONSE_INTENT_PATTERNS);
    const ownEducationHits = countMatches(ownText, EDUCATION_PATTERNS);
    const contextEducationHits = countMatches(
      parentContextText,
      EDUCATION_PATTERNS,
    );
    const educationHits = countMatches(fullContextText, EDUCATION_PATTERNS);
    const promotionHits = countMatches(ownText, PROMOTION_PATTERNS);
    const competitorHits = countMatches(ownText, COMPETITOR_PATTERNS);
    const recommendationHits = countMatches(ownText, RECOMMENDATION_PATTERNS);
    const phoneCount = (
      ownText.match(/(?:\+?84|0)(?:\d[\s.-]?){8,10}\b/g) || []
    ).length;
    const linkCount = (ownText.match(/https?:\/\/|www\.|facebook\.com/g) || [])
      .length;
    const hasLeadIntent = ownDemandHits + responseIntentHits > 0;
    const isQuestion =
      /\b(ai biet|co ai|o dau|bao nhieu|khong|k a|ko|khong a)\b/.test(
        ownText,
      ) || /\?$/.test(ownText);
    const levelWeight = getLevelWeight(item);
    const leadBase =
      hasLeadIntent && educationHits
        ? ownDemandHits * 32 +
          responseIntentHits * 24 +
          ownEducationHits * 16 +
          contextEducationHits * 9 +
          (item.kind === 'POST' ? 12 : 0) +
          (isQuestion ? 8 : 0)
        : 0;
    const promotionScore = clamp(
      promotionHits * 24 +
        competitorHits * 26 +
        Math.min(phoneCount, 2) * 18 +
        Math.min(linkCount, 2) * 16,
      0,
      100,
    );

    return {
      item,
      leadScore: clamp(leadBase * levelWeight - promotionScore * 0.8, 0, 100),
      promotionScore,
      recommendationScore: clamp(recommendationHits * 24, 0, 100),
      ownDemandHits,
      responseIntentHits,
      educationHits,
      ownEducationHits,
      contextEducationHits,
      promotionHits,
      competitorHits,
      recommendationHits,
    };
  }
}

function getParentContextText(item: FacebookLeadScanItem): string {
  if (!Array.isArray(item.contextTexts) || item.contextTexts.length <= 1) {
    return '';
  }
  const ownText = normalizeText(item.text);
  return item.contextTexts
    .map(normalizeText)
    .filter((text) => text && text !== ownText)
    .join(' ');
}

function getLevelWeight(item: FacebookLeadScanItem): number {
  if (item.kind === 'POST') return 1.15;
  const depth = Number(item.depth || 1);
  if (depth <= 1) return 1;
  if (depth === 2) return 0.85;
  return 0.7;
}

function getLeadLevel(
  score: number,
  classification: FacebookLeadClassification,
): FacebookLeadLevel {
  if (classification !== 'POTENTIAL_PARENT') return 'NONE';
  if (score >= 75) return 'HOT';
  if (score >= 50) return 'WARM';
  if (score >= 30) return 'COLD';
  return 'NONE';
}

function toEvidence(analysis: ItemAnalysis, allItems: FacebookLeadScanItem[]): FacebookLeadEvidence {
  return {
    kind: String(analysis.item.kind || ''),
    text: String(analysis.item.text || ''),
    sourceUrl: String(analysis.item.sourceUrl || ''),
    pageUrl: String(analysis.item.pageUrl || ''),
    postId: String(analysis.item.postId || ''),
    commentId: String(analysis.item.commentId || ''),
    depth: Number(analysis.item.depth || 0),
    itemLeadScore: Math.round(analysis.leadScore),
    authorName: String(analysis.item.authorName || ''),
    threadPath: getCommentThreadPath(analysis.item, allItems),
  };
}

function sumMetric(items: ItemAnalysis[], key: keyof ItemAnalysis): number {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function maxByScore(
  items: ItemAnalysis[],
  key: keyof ItemAnalysis,
): ItemAnalysis | null {
  return (
    [...items].sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))[0] ||
    null
  );
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce(
    (total, pattern) => total + (pattern.test(text) ? 1 : 0),
    0,
  );
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ä‘/g, 'd')
    .replace(/Ä/g, 'D')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s:+./-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeProfileUrl(value: unknown): string {
  if (!value) return '';
  try {
    const url = new URL(String(value));
    for (const key of ['__cft__', '__tn__', 'mibextid', 'ref']) {
      url.searchParams.delete(key);
    }
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function getCommentThreadPath(item: FacebookLeadScanItem, allItems: FacebookLeadScanItem[]): any[] {
  const path: FacebookLeadScanItem[] = [];
  let current: FacebookLeadScanItem | undefined = item;
  
  const itemMap = new Map<string, FacebookLeadScanItem>();
  for (const x of allItems) {
    const key = x.commentId || x.fingerprint;
    if (key) {
      itemMap.set(key, x);
    }
  }

  const visited = new Set<string>();

  while (current) {
    path.unshift(current);
    const key = current.commentId || current.fingerprint;
    if (key) {
      if (visited.has(key)) {
        break; // break cycle
      }
      visited.add(key);
    }

    const parentId = current.parentCommentId || current.parentFingerprint;
    if (parentId && itemMap.has(parentId)) {
      current = itemMap.get(parentId);
    } else {
      current = undefined;
    }
  }

  // Prepend the POST item if found and not already in the path
  const postItem = allItems.find(x => x.kind === 'POST' && x.postId === item.postId);
  if (postItem && !path.includes(postItem)) {
    path.unshift(postItem);
  }

  // Map to simple JSON structure to store in DB
  return path.map(x => ({
    kind: x.kind || 'COMMENT',
    text: x.text || '',
    depth: x.depth || 0,
    authorName: x.authorName || 'Ẩn danh',
    authorUrl: x.authorUrl || '',
    commentId: x.commentId || '',
    sourceUrl: x.sourceUrl || '',
  }));
}

