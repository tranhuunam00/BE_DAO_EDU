import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  Request,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../../../infrastructure/security/roles.guard';
import { Roles } from '../../../../infrastructure/security/roles.decorator';
import { Role } from '../../../../domain/value-objects/role.enum';
import { AskParentAiChatbotUseCase } from '../../application/use-cases/ask-parent-ai-chatbot.use-case';
import { AskParentAiChatDto } from '../dtos/parent-ai-chat.dto';
import {
  STUDENT_PROFILE_CONTEXT_QUERY_PORT,
  type IStudentProfileContextQueryPort,
} from '../../application/ports/student-profile-context-query.port';

@ApiTags('Parent AI Chatbot (Trợ lý AI Phụ huynh)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('parent-ai')
export class ParentAiChatController {
  constructor(
    private readonly askChatbotUseCase: AskParentAiChatbotUseCase,
    @Inject(STUDENT_PROFILE_CONTEXT_QUERY_PORT)
    private readonly contextQueryPort: IStudentProfileContextQueryPort,
  ) {}

  @Post('chat')
  @Roles(Role.STUDENT, Role.ADMIN)
  @ApiOperation({ summary: 'Hỏi đáp với Trợ lý AI Phụ huynh dựa trên dữ liệu thật của học sinh' })
  async chat(
    @Request() req: any,
    @Body() dto: AskParentAiChatDto,
    @Headers('x-student-id') headerStudentId?: string,
  ) {
    const userId = req.user?.sub;
    const studentId = dto.studentId || headerStudentId;

    return this.askChatbotUseCase.execute({
      userId,
      userRole: req.user?.role,
      studentId,
      question: dto.question,
      history: dto.history,
    });
  }

  @Get('quick-prompts')
  @Roles(Role.STUDENT, Role.ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách câu hỏi gợi ý nhanh chuẩn BRD' })
  getQuickPrompts() {
    return {
      prompts: [
        {
          id: 'weakness',
          title: 'Điểm cần cải thiện',
          question: 'Con tôi đang yếu phần nào?',
          icon: 'help-circle',
        },
        {
          id: 'extra_class',
          title: 'Học thêm',
          question: 'Tôi nên cho con học thêm bao nhiêu?',
          icon: 'clock',
        },
        {
          id: 'risk',
          title: 'Nguy cơ & Mục tiêu',
          question: 'Con tôi có nguy cơ không đạt mục tiêu không?',
          icon: 'alert-triangle',
        },
        {
          id: 'summary',
          title: 'Tổng quan tuần này',
          question: 'Tuần này con học thế nào và phụ huynh cần làm gì?',
          icon: 'sparkles',
        },
      ],
    };
  }

  @Get('student-context')
  @Roles(Role.STUDENT, Role.ADMIN)
  @ApiOperation({ summary: 'Lấy bối cảnh dữ liệu học sinh tóm tắt' })
  async getStudentContext(
    @Request() req: any,
    @Query('studentId') queryStudentId?: string,
    @Headers('x-student-id') headerStudentId?: string,
  ) {
    const userId = req.user?.sub;
    const targetStudentId = queryStudentId || headerStudentId;

    let studentId = targetStudentId;
    if (!studentId) {
      const defaultStudent = await this.contextQueryPort.getDefaultStudentForUser(userId);
      if (!defaultStudent) {
        return { data: null };
      }
      studentId = defaultStudent.studentId;
    }

    const context = await this.contextQueryPort.getStudentProfileContext(studentId, 4);
    return { data: context };
  }
}
