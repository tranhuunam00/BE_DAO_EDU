import { Injectable, Logger } from '@nestjs/common';
import type {
  FacebookLeadDetectionResult,
  FacebookLeadScanItem,
} from '../../domain/services/facebook-lead-text-detector';
import { FacebookLeadClassifierPort } from '../../application/ports/facebook-lead-classifier.port';

@Injectable()
export class GeminiFacebookLeadClassifierAdapter implements FacebookLeadClassifierPort {
  private readonly logger = new Logger(GeminiFacebookLeadClassifierAdapter.name);

  async classify(items: FacebookLeadScanItem[]): Promise<FacebookLeadDetectionResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in .env file');
    }

    if (!items.length) {
      return {
        detectorVersion: 'gemini-2.5-flash-v1',
        generatedAt: new Date().toISOString(),
        summary: {
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
        },
        aiCandidates: [],
        leadProfiles: [],
      };
    }

    const comments = items.filter((x) => x.kind === 'COMMENT');
    if (!comments.length) {
      return {
        detectorVersion: 'gemini-2.5-flash-v1',
        generatedAt: new Date().toISOString(),
        summary: {
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
        },
        aiCandidates: [],
        leadProfiles: [],
      };
    }

    const { postContent, commentsText } = formatItemsAsFlatList(items);

    const prompt = `
Bạn là một trợ lý AI phân tích bán hàng và tuyển sinh chuyên nghiệp cho trung tâm giáo dục cấp 2.
Dưới đây là thông tin Bài viết gốc (Post Content) làm ngữ cảnh nền:
---
[BÀI VIẾT GỐC]
Nội dung: "${postContent}"
---

Nhiệm vụ của bạn là phân tích danh sách các bình luận bên dưới bài viết gốc. Đối với mỗi bình luận, hãy phân loại tác giả và đánh giá mức độ tiềm năng thành học viên (lead) của trung tâm giáo dục cấp 2.

Hãy phân loại các tác giả (profile) theo bình luận thành một trong các nhóm sau:
- POTENTIAL_PARENT: Phụ huynh hoặc học sinh thực sự có nhu cầu tìm lớp học, học thêm, gia sư, luyện thi, tư vấn học tập hoặc xin tài liệu.
- TEACHER_AD: Giáo viên, gia sư, sinh viên tự quảng cáo nhận dạy học hoặc mời chào học viên tham gia lớp/khóa học của họ.
- COMPETITOR_SALE: Nhân viên tư vấn, đại diện tuyển sinh của trung tâm đối thủ khác vào chèo kéo, quảng bá khóa học của họ.
- RECOMMENDATION: Người dùng khác vào giới thiệu, đề xuất giáo viên hoặc trung tâm tốt một cách khách quan.
- NEUTRAL: Các bình luận trung tính, thảo luận ngoài lề, hỏi thăm chung chung không có nhu cầu trực tiếp, tag bạn bè, hoặc bình luận dạo.
- SPAM: Bình luận vô nghĩa, lặp đi lặp lại hoặc quảng cáo các sản phẩm/dịch vụ không liên quan đến giáo dục.

Quy tắc chấm điểm tiềm năng (leadScore từ 0 đến 100):
- Nếu phân loại là POTENTIAL_PARENT: Điểm càng cao khi nhu cầu học tập rõ ràng, cụ thể và gấp gáp (ví dụ: tìm lớp học ngay cho con, để lại số điện thoại/zalo, hỏi xin học phí, địa chỉ học). Điểm thấp hơn nếu chỉ quan tâm hoặc hỏi review cụ thể.
- Nếu không phải POTENTIAL_PARENT: Điểm leadScore bắt buộc phải là 0 hoặc cực kỳ thấp (dưới 10).

Quy tắc xếp hạng tiềm năng (leadLevel):
- HOT: leadScore >= 75 (nhu cầu rất cao, để lại thông tin liên lạc, tìm gấp).
- WARM: leadScore >= 50 (quan tâm học phí, hỏi thăm thông tin lớp học cụ thể).
- COLD: leadScore >= 30 (chỉ hỏi han chung chung hoặc xin tài liệu).
- NONE: leadScore < 30 hoặc không phải POTENTIAL_PARENT.

Hãy viết lý do phân loại (reasons) bằng tiếng Việt ngắn gọn, súc tích, tối đa 3 lý do.

Dưới đây là danh sách bình luận cần phân tích:
${commentsText}
`;

    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            classifiedComments: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  id: { type: 'STRING' },
                  classification: {
                    type: 'STRING',
                    enum: ['POTENTIAL_PARENT', 'TEACHER_AD', 'COMPETITOR_SALE', 'RECOMMENDATION', 'NEUTRAL', 'SPAM']
                  },
                  leadScore: { type: 'INTEGER' },
                  leadLevel: {
                    type: 'STRING',
                    enum: ['HOT', 'WARM', 'COLD', 'NONE']
                  },
                  reasons: {
                    type: 'ARRAY',
                    items: { type: 'STRING' }
                  }
                },
                required: ['id', 'classification', 'leadScore', 'leadLevel', 'reasons']
              }
            }
          },
          required: ['classifiedComments']
        }
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout

    try {
      this.logger.log(`Calling Gemini API for ${comments.length} comments (Prompt list size: ${commentsText.length} chars)...`);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: HTTP ${response.status} - ${errorText}`);
      }

      const resData = await response.json();
      const textResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResponse) {
        throw new Error('Gemini API returned an empty response.');
      }

      const parsed = JSON.parse(textResponse) as {
        classifiedComments: Array<{
          id: string;
          classification: string;
          leadScore: number;
          leadLevel: string;
          reasons: string[];
        }>;
      };

      const classifiedList = parsed.classifiedComments || [];
      this.logger.log(`Gemini API responded successfully with ${classifiedList.length} comments classified.`);

      // Map back to retrieve evidence items from input items
      const itemMap = new Map<string, FacebookLeadScanItem>();
      for (const item of items) {
        const key = item.commentId || item.fingerprint;
        if (key) {
          itemMap.set(key, item);
        }
      }

      const profileGroups = new Map<
        string,
        {
          profileKey: string;
          authorName: string;
          authorUrl: string;
          classification: string;
          leadScore: number;
          leadLevel: string;
          reasons: string[];
          evidence: any[];
        }
      >();

      for (const c of classifiedList) {
        const matchedItem = itemMap.get(c.id);
        if (!matchedItem) {
          this.logger.warn(`[Invalid ID filtered] Gemini returned classification for comment ID "${c.id}" but no matching item was found in the input. Skipping.`);
          continue;
        }

        const originalAuthorUrl = matchedItem.authorUrl || '';
        const profileKey = originalAuthorUrl
          ? normalizeProfileUrl(originalAuthorUrl)
          : `name:${normalizeText(matchedItem.authorName)}`;

        const evidenceItem = {
          kind: matchedItem.kind || 'COMMENT',
          text: matchedItem.text || '',
          sourceUrl: matchedItem.sourceUrl || '',
          pageUrl: matchedItem.pageUrl || '',
          postId: matchedItem.postId || '',
          commentId: matchedItem.commentId || '',
          depth: matchedItem.depth || 0,
          itemLeadScore: c.leadScore,
          authorName: matchedItem.authorName || '',
          threadPath: getCommentThreadPath(matchedItem, items),
        };

        const existingGroup = profileGroups.get(profileKey);
        if (!existingGroup) {
          profileGroups.set(profileKey, {
            profileKey,
            authorName: matchedItem.authorName || 'Ẩn danh',
            authorUrl: originalAuthorUrl,
            classification: c.classification,
            leadScore: c.leadScore,
            leadLevel: c.leadLevel,
            reasons: [...c.reasons],
            evidence: [evidenceItem],
          });
        } else {
          // Priority rankings: POTENTIAL_PARENT > RECOMMENDATION > TEACHER_AD > COMPETITOR_SALE > NEUTRAL > SPAM
          const rank = (cls: string) => {
            if (cls === 'POTENTIAL_PARENT') return 1;
            if (cls === 'RECOMMENDATION') return 2;
            if (cls === 'TEACHER_AD') return 3;
            if (cls === 'COMPETITOR_SALE') return 4;
            if (cls === 'NEUTRAL') return 5;
            return 6;
          };

          if (rank(c.classification) < rank(existingGroup.classification)) {
            existingGroup.classification = c.classification;
          }

          existingGroup.leadScore = Math.max(existingGroup.leadScore, c.leadScore);

          const levelRank = (lvl: string) => {
            if (lvl === 'HOT') return 1;
            if (lvl === 'WARM') return 2;
            if (lvl === 'COLD') return 3;
            return 4;
          };
          if (levelRank(c.leadLevel) < levelRank(existingGroup.leadLevel)) {
            existingGroup.leadLevel = c.leadLevel;
          }

          existingGroup.reasons = [...new Set([...existingGroup.reasons, ...c.reasons])];
          existingGroup.evidence.push(evidenceItem);
        }
      }

      const leadProfilesMapped = Array.from(profileGroups.values()).map((g) => ({
        profileKey: g.profileKey,
        authorName: g.authorName,
        authorUrl: g.authorUrl,
        classification: g.classification as any,
        leadScore: g.leadScore,
        leadLevel: g.leadLevel as any,
        promotionScore: g.classification === 'COMPETITOR_SALE' || g.classification === 'TEACHER_AD' ? 70 : 0,
        reasons: g.reasons || [],
        evidence: g.evidence,
      }));

      // Compute summary
      const summary: Record<string, number> = {
        totalProfiles: leadProfilesMapped.length,
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

      for (const p of leadProfilesMapped) {
        summary[p.classification] = (summary[p.classification] || 0) + 1;
        if (p.leadLevel !== 'NONE') {
          summary[p.leadLevel] = (summary[p.leadLevel] || 0) + 1;
        }
      }

      return {
        detectorVersion: 'gemini-2.5-flash-v1',
        generatedAt: new Date().toISOString(),
        summary,
        aiCandidates: leadProfilesMapped.filter(
          (p) => p.classification === 'POTENTIAL_PARENT' && p.leadScore >= 30
        ),
        leadProfiles: leadProfilesMapped,
      };

    } catch (error) {
      clearTimeout(timeout);
      this.logger.error(`Gemini API classification failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }
}

function formatItemsAsFlatList(items: FacebookLeadScanItem[]): { postContent: string; commentsText: string } {
  const postItem = items.find((x) => x.kind === 'POST');
  const postContent = postItem?.text || '(Không có nội dung bài viết gốc)';

  const comments = items.filter((x) => x.kind === 'COMMENT');
  let commentsText = '';

  for (let i = 0; i < comments.length; i++) {
    const item = comments[i];
    const key = item.commentId || item.fingerprint || `idx-${i}`;
    const author = item.authorName || 'Ẩn danh';

    const contextList = item.contextTexts || [];
    const contextStr =
      contextList.length > 0
        ? contextList
            .map((t) => t.replace(/\n/g, ' ').trim())
            .filter(Boolean)
            .join(' -> ')
        : 'Không có';

    commentsText += `---\n`;
    commentsText += `[Bình luận #${i + 1}]\n`;
    commentsText += `ID: "${key}"\n`;
    commentsText += `Người viết: "${author}"\n`;
    commentsText += `Nội dung: "${(item.text || '').replace(/\n/g, ' ').trim()}"\n`;
    commentsText += `Ngữ cảnh hội thoại trước đó: "${contextStr}"\n\n`;
  }

  return { postContent, commentsText };
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
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
