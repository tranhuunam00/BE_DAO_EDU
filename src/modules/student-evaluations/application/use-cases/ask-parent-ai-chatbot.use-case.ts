import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  PARENT_AI_CHAT_PORT,
  type IParentAiChatPort,
  type ParentChatMessageItem,
  type ParentAiChatResponse,
} from '../ports/parent-ai-chat.port';
import {
  STUDENT_PROFILE_CONTEXT_QUERY_PORT,
  type IStudentProfileContextQueryPort,
} from '../ports/student-profile-context-query.port';
import {
  ILlmRateLimiterPort,
} from '../ports/llm-rate-limiter.port';
import { Role } from '../../../../domain/value-objects/role.enum';

export interface AskParentAiChatbotInput {
  userId: string;
  userRole?: string;
  studentId?: string;
  question: string;
  history?: ParentChatMessageItem[];
}

@Injectable()
export class AskParentAiChatbotUseCase {
  constructor(
    @Inject(PARENT_AI_CHAT_PORT)
    private readonly chatPort: IParentAiChatPort,
    @Inject(STUDENT_PROFILE_CONTEXT_QUERY_PORT)
    private readonly contextQueryPort: IStudentProfileContextQueryPort,
    @Inject(ILlmRateLimiterPort)
    private readonly rateLimiter?: ILlmRateLimiterPort,
  ) {}

  async execute(
    input: AskParentAiChatbotInput,
  ): Promise<ParentAiChatResponse & { studentId: string; studentName: string }> {
    const { userId, userRole, question, history } = input;

    if (!userId) {
      throw new ForbiddenException('Không xác định được danh tính người dùng');
    }

    if (!question || question.trim().length === 0) {
      throw new BadRequestException('Vui lòng nhập nội dung câu hỏi');
    }

    // 1. KIỂM TRA RATE LIMITING & COOLDOWN ĐỂ BẢO VỆ TÀI NGUYÊN LLM
    if (this.rateLimiter) {
      if (this.rateLimiter.checkCooldown) {
        const cooldownOk = await this.rateLimiter.checkCooldown(`parent-chat:${userId}`);
        if (!cooldownOk) {
          throw new HttpException(
            'Bạn đang gửi câu hỏi quá nhanh. Vui lòng đợi 3 giây trước khi gửi tiếp.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      const limitOk = await this.rateLimiter.checkLimit(`parent-chat:${userId}`);
      if (!limitOk) {
        throw new HttpException(
          'Bạn đã vượt quá giới hạn câu hỏi cho phép (tối đa 20 câu / phút). Vui lòng thử lại sau ít phút.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // 2. LÀM SẠCH VÀ CHỐNG XSS / PROMPT INJECTION
    const cleanQuestion = this.sanitizeQuestion(question);

    // 3. XÁC ĐỊNH HỌC SINH MỤC TIÊU & BẢO MẬT CHỐNG IDOR
    let targetStudentId = input.studentId;
    let targetStudentName = '';
    const isAdmin = userRole === Role.ADMIN;

    if (targetStudentId) {
      if (!isAdmin) {
        const isOwned = await this.contextQueryPort.validateParentStudentOwnership(
          userId,
          targetStudentId,
        );
        if (!isOwned) {
          throw new ForbiddenException('Bạn không có quyền truy vấn thông tin học sinh này');
        }
      }
    } else {
      const defaultStudent = await this.contextQueryPort.getDefaultStudentForUser(userId);
      if (!defaultStudent) {
        throw new NotFoundException('Tài khoản của bạn chưa được liên kết với hồ sơ học sinh nào');
      }
      targetStudentId = defaultStudent.studentId;
      targetStudentName = defaultStudent.studentName;
    }

    // 4. LẤY BỐI CẢNH DỮ LIỆU HỌC TẬP THỰC TẾ (GROUNDING CONTEXT)
    const context = await this.contextQueryPort.getStudentProfileContext(targetStudentId, 4);
    if (!targetStudentName) {
      targetStudentName = context.studentName;
    }

    // 5. GỌI MÔ HÌNH AI ĐÃ ĐƯỢC CÁCH LY BỐI CẢNH
    const aiResponse = await this.chatPort.askChatbot(cleanQuestion, context, history);

    return {
      ...aiResponse,
      studentId: targetStudentId,
      studentName: targetStudentName,
    };
  }

  private sanitizeQuestion(raw: string): string {
    // Cắt bớt nếu câu hỏi quá dài (tối đa 400 ký tự)
    let sanitized = raw.trim().slice(0, 400);

    // Chống XSS: Loại bỏ toàn bộ thẻ HTML và sự kiện javascript
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/onerror\s*=/gi, '')
      .replace(/onload\s*=/gi, '');

    // Chống Prompt Injection: Làm sạch các chỉ dẫn override hệ thống
    const maliciousPatterns = [
      /bỏ qua (các|mọi) chỉ dẫn/gi,
      /ignore (all|previous) instructions/gi,
      /in ra (toàn bộ|toan bo) (mật khẩu|database|cơ sở dữ liệu)/gi,
      /act as a (system|hacker|root)/gi,
      /system prompt/gi,
    ];

    for (const pattern of maliciousPatterns) {
      sanitized = sanitized.replace(pattern, '[nội dung không phù hợp]');
    }

    return sanitized.trim();
  }
}
