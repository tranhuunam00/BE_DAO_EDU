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

    const formattedTreeText = formatItemsAsTreeText(items);

    const prompt = `
Bạn là một trợ lý AI phân tích bán hàng và tuyển sinh chuyên nghiệp cho trung tâm giáo dục DAO EDU.
Dưới đây là một cuộc hội thoại (hoặc một số cuộc hội thoại) trên Facebook được thu thập theo cấu trúc phân cấp (cây) để hiểu rõ ngữ cảnh.

Nhiệm vụ của bạn là phân tích nội dung bình luận của từng tác giả (tập hợp tất cả bình luận của một người trong các hội thoại được cung cấp) để phân loại họ vào các nhóm phù hợp và đánh giá mức độ tiềm năng thành học viên (lead).

Hãy phân loại các tác giả (profile) thành một trong các nhóm sau:
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

Dưới đây là dữ liệu các cuộc hội thoại:
${formattedTreeText}
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
            leadProfiles: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  authorName: { type: 'STRING' },
                  authorUrl: { type: 'STRING' },
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
                required: ['authorName', 'authorUrl', 'classification', 'leadScore', 'leadLevel', 'reasons']
              }
            }
          },
          required: ['leadProfiles']
        }
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout

    try {
      this.logger.log(`Calling Gemini API for ${items.length} items (Tree Size: ${formattedTreeText.length} chars)...`);
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
        leadProfiles: Array<{
          authorName: string;
          authorUrl: string;
          classification: string;
          leadScore: number;
          leadLevel: string;
          reasons: string[];
        }>;
      };

      const profiles = parsed.leadProfiles || [];
      this.logger.log(`Gemini API responded successfully with ${profiles.length} profiles classified.`);

      // Map back to retrieve evidence items from input items
      const leadProfilesMapped = profiles
        .map((p) => {
          // Match strictly by authorName because profile URLs are not sent to Gemini,
          // which means any authorUrl returned by Gemini is hallucinated/fake.
          const authorItems = items.filter((item) => {
            return normalizeText(p.authorName) === normalizeText(item.authorName);
          });

          // GUARD: If no items match this authorName in the actual input,
          // Gemini hallucinated this person from a name mentioned inside contextTexts
          // (e.g. "Thu Ha Tran dạ c..." — a name quoted inside someone else's reply).
          // Skip these ghost profiles entirely to prevent cross-post contamination.
          if (authorItems.length === 0) {
            this.logger.warn(`[Ghost profile filtered] Gemini returned author "${p.authorName}" but no matching item found in input. Skipping.`);
            return null;
          }

          // Crucial: Use the actual, correct profile URL captured by the scraper extension
          const originalAuthorUrl = authorItems[0]?.authorUrl || '';

          const profileKey = originalAuthorUrl
            ? normalizeProfileUrl(originalAuthorUrl)
            : `name:${normalizeText(p.authorName)}`;

          const evidence = authorItems.map((item) => ({
            kind: item.kind || 'COMMENT',
            text: item.text || '',
            sourceUrl: item.sourceUrl || '',
            pageUrl: item.pageUrl || '',
            postId: item.postId || '',
            commentId: item.commentId || '',
            depth: item.depth || 0,
            itemLeadScore: p.leadScore,
            authorName: item.authorName || '',
          }));

          return {
            profileKey,
            authorName: p.authorName,
            authorUrl: originalAuthorUrl,
            classification: p.classification as any,
            leadScore: p.leadScore,
            leadLevel: p.leadLevel as any,
            promotionScore: p.classification === 'COMPETITOR_SALE' || p.classification === 'TEACHER_AD' ? 70 : 0,
            reasons: p.reasons || [],
            evidence,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

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

function formatItemsAsTreeText(items: FacebookLeadScanItem[]): string {
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

  let text = '';

  function renderNode(item: FacebookLeadScanItem, indent: string) {
    const author = item.authorName || 'Ẩn danh';
    const kindLabel = item.kind === 'POST' ? 'Bài viết gốc' : 'Bình luận';

    // Dùng contextTexts (mảng toàn bộ chuỗi hội thoại: bài viết gốc → comment cha → comment này)
    // để Gemini hiểu đúng ngữ cảnh. Fallback về item.text nếu không có.
    const rawTexts: string[] =
      item.contextTexts && item.contextTexts.length > 0
        ? item.contextTexts
        : [item.text || ''];
    const combinedText = rawTexts
      .map((t) => t.replace(/\n/g, ' ').trim())
      .filter(Boolean)
      .join(' → ');
    const truncatedText =
      combinedText.length > 500 ? combinedText.substring(0, 500) + '...' : combinedText;

    text += `${indent}● Tác giả: ${author}\n`;
    text += `${indent}  Vai trò: ${kindLabel}\n`;
    text += `${indent}  Nội dung (ngữ cảnh): "${truncatedText}"\n`;

    const itemId = item.commentId || item.fingerprint;
    if (itemId && childrenMap.has(itemId)) {
      const children = childrenMap.get(itemId)!;
      for (const child of children) {
        renderNode(child, indent + '  └── ');
      }
    }
  }

  for (const root of roots) {
    renderNode(root, '');
    text += '\n';
  }

  return text;
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
