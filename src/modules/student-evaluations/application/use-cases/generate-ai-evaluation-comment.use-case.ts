import {
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../domain/entities/student-session-evaluation.entity';
import {
  IAiEvaluationGeneratorPort,
  AiEvaluationCriteria,
} from '../ports/ai-evaluation-generator.port';
import { ILlmRateLimiterPort } from '../ports/llm-rate-limiter.port';
import { ILlmEvaluationCachePort } from '../ports/llm-evaluation-cache.port';

export interface GenerateCommentInput extends AiEvaluationCriteria {
  studentId?: string;
  teacherId?: string;
}

export interface GenerateCommentOutput {
  studentId?: string;
  comment: string;
  isAiGenerated: boolean;
}

export class GenerateAiEvaluationCommentUseCase {
  constructor(
    private readonly aiGenerator: IAiEvaluationGeneratorPort,
    private readonly cachePort?: ILlmEvaluationCachePort,
    private readonly rateLimiter?: ILlmRateLimiterPort,
  ) {}

  async execute(input: GenerateCommentInput): Promise<GenerateCommentOutput> {
    if (!input.studentName || !input.studentName.trim()) {
      throw new Error('Tên học sinh không được để trống');
    }
    if (input.studentName.length > 100) {
      throw new Error('Tên học sinh không được vượt quá 100 ký tự');
    }

    // 1. Chống XSS và làm sạch Prompt Injection
    const sanitizedName = this.sanitizeStudentName(input.studentName);

    // 2. Rate Limiting theo giáo viên (tối đa 30 lần/phút)
    if (this.rateLimiter && input.teacherId) {
      const allowed = await this.rateLimiter.checkLimit(input.teacherId);
      if (!allowed) {
        throw new Error(
          'Bạn đã vượt quá giới hạn tạo nhận xét AI (tối đa 30 lần/phút). Vui lòng thử lại sau',
        );
      }

      // Cooldown chống spam click (3 giây)
      if (this.rateLimiter.checkCooldown && input.studentId) {
        const cooldownKey = `${input.teacherId}_${input.studentId}`;
        const canCall = await this.rateLimiter.checkCooldown(cooldownKey);
        if (!canCall) {
          throw new Error(
            'Vui lòng đợi 3 giây trước khi yêu cầu AI tạo lại nhận xét cho học sinh này',
          );
        }
      }
    }

    const cleanCriteria: AiEvaluationCriteria = {
      studentName: sanitizedName,
      homeworkStatus: input.homeworkStatus,
      participation: input.participation,
      understanding: input.understanding,
      behaviorTags: input.behaviorTags,
      score: input.score,
    };

    // 3. Kiểm tra Cache để tiết kiệm chi phí API
    const cacheKey = this.generateCacheKey(input.studentId || sanitizedName, cleanCriteria);
    if (this.cachePort) {
      const cached = await this.cachePort.get(cacheKey);
      if (cached) {
        return { comment: cached, isAiGenerated: true };
      }
    }

    // 4. Gọi AI Generator kèm Circuit Breaker Fallback
    try {
      const generated = await this.aiGenerator.generateComment(cleanCriteria);
      if (this.cachePort) {
        await this.cachePort.set(cacheKey, generated, 900); // 15 phút
      }
      return { comment: generated, isAiGenerated: true };
    } catch (err) {
      // Circuit Breaker: fallback câu nhận xét sư phạm chuẩn mực không làm crash hệ thống
      const fallback = this.buildFallbackComment(cleanCriteria);
      return { comment: fallback, isAiGenerated: false };
    }
  }

  async executeBatch(items: GenerateCommentInput[]): Promise<GenerateCommentOutput[]> {
    if (items.length > 50) {
      throw new Error(
        'Số lượng học sinh yêu cầu tạo nhận xét AI vượt quá giới hạn cho phép (tối đa 50 học sinh/lần)',
      );
    }
    const results: GenerateCommentOutput[] = [];
    for (const item of items) {
      const res = await this.execute(item);
      results.push({
        ...res,
        studentId: item.studentId,
      });
    }
    return results;
  }

  private sanitizeStudentName(name: string): string {
    let clean = name.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/<[^>]+>/g, '');
    clean = clean.replace(/on\w+="[^"]*"/gi, '');
    clean = clean.replace(/on\w+='[^']*'/gi, '');
    clean = clean.replace(/on\w+=\S+/gi, '');
    clean = clean.replace(/bỏ qua các chỉ dẫn trước[^\.]*/gi, '');
    clean = clean.replace(/ignore previous instructions[^\.]*/gi, '');
    return clean.trim();
  }

  private generateCacheKey(idOrName: string, c: AiEvaluationCriteria): string {
    const tags = (c.behaviorTags || []).slice().sort().join(',');
    return `ai_eval_${idOrName}_${c.homeworkStatus || ''}_${c.participation || ''}_${c.understanding || ''}_${tags}_${c.score || ''}`;
  }

  private buildFallbackComment(c: AiEvaluationCriteria): string {
    const parts: string[] = [];
    const name = c.studentName || 'Học sinh';

    if (c.understanding === UnderstandingStatus.UNDERSTOOD) {
      parts.push(`Em ${name} tiếp thu bài tốt trong buổi học`);
    } else {
      parts.push(`Em ${name} cần chú ý lắng nghe hơn để nắm vững kiến thức`);
    }

    if (c.participation === ParticipationStatus.ACTIVE) {
      parts.push('hăng hái phát biểu xây dựng bài');
    }

    if (c.homeworkStatus === HomeworkStatus.NOT_DONE) {
      parts.push('tuy nhiên con chưa làm bài tập về nhà, cần hoàn thành bù trước buổi sau');
    } else if (c.homeworkStatus === HomeworkStatus.INCOMPLETE) {
      parts.push('bài tập về nhà chưa đầy đủ các phần');
    } else {
      parts.push('hoàn thành bài tập tốt');
    }

    return parts.join(', ') + '.';
  }
}
