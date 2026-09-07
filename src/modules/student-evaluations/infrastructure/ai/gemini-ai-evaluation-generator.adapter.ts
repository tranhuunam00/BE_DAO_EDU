import { Injectable, Logger } from '@nestjs/common';
import {
  IAiEvaluationGeneratorPort,
  AiEvaluationCriteria,
} from '../../application/ports/ai-evaluation-generator.port';
import {
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../domain/entities/student-session-evaluation.entity';

@Injectable()
export class GeminiAiEvaluationGeneratorAdapter implements IAiEvaluationGeneratorPort {
  private readonly logger = new Logger(GeminiAiEvaluationGeneratorAdapter.name);

  async generateComment(criteria: AiEvaluationCriteria): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY chưa được cấu hình, kích hoạt Fallback Template');
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const prompt = this.buildPrompt(criteria);

    const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1000,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`Gemini API error (${response.status}): ${errText}`);
      const err: any = new Error(`Gemini API failed with status ${response.status}`);
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!generatedText) {
      throw new Error('Empty response from Gemini API');
    }

    return generatedText;
  }

  private buildPrompt(c: AiEvaluationCriteria): string {
    const tagMap: Record<string, string> = {
      [BehaviorTag.ATTENTIVE]: 'tập trung nghe giảng',
      [BehaviorTag.TALKATIVE]: 'nói chuyện riêng trong giờ',
      [BehaviorTag.PHONE]: 'sử dụng điện thoại trong lớp',
      [BehaviorTag.LATE]: 'đi học muộn',
      [BehaviorTag.DISTRACTED]: 'còn làm việc riêng',
    };

    const behaviorDesc = (c.behaviorTags || [])
      .map((t) => tagMap[t] || t)
      .join(', ') || 'ngoan ngoãn, chú ý';

    return `Bạn là giáo viên sư phạm tận tâm tại trung tâm DAO EDU. Hãy viết một đoạn nhận xét ngắn gọn (2-3 câu, tối đa 80 từ) cho học sinh sau buổi học:
- Tên học sinh: ${c.studentName}
- Tình trạng làm bài tập về nhà: ${c.homeworkStatus || 'hoàn thành'}
- Mức độ tiếp thu bài: ${c.understanding === UnderstandingStatus.UNDERSTOOD ? 'nắm vững nội dung bài học' : 'chưa nắm vững bài, còn lúng túng'}
- Mức độ tương tác: ${c.participation === ParticipationStatus.ACTIVE ? 'hăng hái phát biểu xây dựng bài' : 'còn thụ động, ít phát biểu'}
- Biểu hiện / Thói quen trong lớp: ${behaviorDesc}
${c.score ? `- Điểm đánh giá buổi học: ${c.score}/10` : ''}

QUY TẮC BẮT BUỘC:
1. Văn phong sư phạm chuẩn mực, chân thành, mang tính khích lệ nhưng phản ánh đúng thực tế.
2. NGUYÊN TẮC CHỐNG ẢO GIÁC: Nếu học sinh "chưa làm bài tập" hoặc "chưa nắm vững bài", tuyệt đối KHÔNG được khen là "hoàn thành xuất sắc" hay "tiếp thu rất tốt". Phải chỉ ra điểm con cần cải thiện một cách nhẹ nhàng.
3. Chỉ trả về duy nhất nội dung câu nhận xét, không thêm lời chào, không tiêu đề, không ngoặc kép.`;
  }
}
