import { AskParentAiChatbotUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/ask-parent-ai-chatbot.use-case';
import {
  IParentAiChatPort,
  ParentAiChatContext,
} from '../../../../src/modules/student-evaluations/application/ports/parent-ai-chat.port';
import {
  IStudentProfileContextQueryPort,
} from '../../../../src/modules/student-evaluations/application/ports/student-profile-context-query.port';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('AskParentAiChatbotUseCase Spec', () => {
  let useCase: AskParentAiChatbotUseCase;
  let mockChatPort: jest.Mocked<IParentAiChatPort>;
  let mockContextPort: jest.Mocked<IStudentProfileContextQueryPort>;

  const mockContext: ParentAiChatContext = {
    studentId: 'student-bao-01',
    studentName: 'Trần Gia Bảo',
    className: 'Toán Nâng Cao 9A',
    currentSqiScore: 88,
    sqiTrend: 'up',
    attendanceRatePercent: 100,
    homeworkCompletionPercent: 95,
    averageScore: 8.8,
    strengths: ['Tiếp thu nhanh', 'Hăng hái phát biểu'],
    weaknesses: ['Thỉnh thoảng nói chuyện riêng'],
    recentSessions: [
      {
        date: '2026-09-04',
        subject: 'Toán Học',
        isPresent: true,
        homeworkStatus: 'Đã làm',
        teacherComment: 'Em Bảo học rất tốt',
      },
    ],
  };

  beforeEach(() => {
    mockChatPort = {
      askChatbot: jest.fn().mockResolvedValue({
        answer: 'Em Bảo đang học rất tiến bộ và hiểu bài nhanh!',
        followUpSuggestions: ['Con tôi đang yếu phần nào?', 'Tôi nên cho con học thêm bao nhiêu?'],
        groundedDataSummary: {
          sqiScore: 88,
          attendanceRate: 100,
          homeworkRate: 95,
          sessionCount: 1,
        },
      }),
    };

    mockContextPort = {
      validateParentStudentOwnership: jest.fn(),
      getDefaultStudentForUser: jest.fn(),
      getStudentProfileContext: jest.fn().mockResolvedValue(mockContext),
    };

    useCase = new AskParentAiChatbotUseCase(mockChatPort, mockContextPort);
  });

  describe('1. Kiểm soát quyền truy cập & Bảo mật IDOR', () => {
    it('1.1. Chặn phụ huynh truy vấn dữ liệu học sinh của người khác (IDOR Protection)', async () => {
      mockContextPort.validateParentStudentOwnership.mockResolvedValue(false);

      await expect(
        useCase.execute({
          userId: 'parent-user-1',
          studentId: 'stranger-student-id',
          question: 'Con tôi học thế nào?',
        }),
      ).rejects.toThrow(
        new ForbiddenException('Bạn không có quyền truy vấn thông tin học sinh này'),
      );

      expect(mockChatPort.askChatbot).not.toHaveBeenCalled();
    });

    it('1.2. Cho phép phụ huynh hỏi khi học sinh đúng là con mình', async () => {
      mockContextPort.validateParentStudentOwnership.mockResolvedValue(true);

      const result = await useCase.execute({
        userId: 'parent-user-1',
        studentId: 'student-bao-01',
        question: 'Con tôi đang yếu phần nào?',
      });

      expect(result.answer).toContain('Em Bảo đang học rất tiến bộ');
      expect(result.studentId).toBe('student-bao-01');
      expect(result.studentName).toBe('Trần Gia Bảo');
      expect(mockContextPort.getStudentProfileContext).toHaveBeenCalledWith('student-bao-01', 4);
    });

    it('1.3. Tự động lấy học sinh đầu tiên nếu phụ huynh không chỉ định studentId', async () => {
      mockContextPort.getDefaultStudentForUser.mockResolvedValue({
        studentId: 'student-bao-01',
        studentName: 'Trần Gia Bảo',
      });

      const result = await useCase.execute({
        userId: 'parent-user-1',
        question: 'Tôi có nên cho con học thêm không?',
      });

      expect(mockContextPort.getDefaultStudentForUser).toHaveBeenCalledWith('parent-user-1');
      expect(result.studentId).toBe('student-bao-01');
      expect(mockChatPort.askChatbot).toHaveBeenCalled();
    });

    it('1.4. Ném NotFoundException nếu tài khoản phụ huynh không liên kết với học sinh nào', async () => {
      mockContextPort.getDefaultStudentForUser.mockResolvedValue(null);

      await expect(
        useCase.execute({
          userId: 'orphan-parent-user',
          question: 'Con tôi học thế nào?',
        }),
      ).rejects.toThrow(
        new NotFoundException('Tài khoản của bạn chưa được liên kết với hồ sơ học sinh nào'),
      );
    });
  });

  describe('2. Kiểm tra tính hợp lệ của đầu vào (Validation & Sanitization)', () => {
    it('2.1. Ném BadRequestException nếu câu hỏi để trống', async () => {
      await expect(
        useCase.execute({
          userId: 'parent-user-1',
          question: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('2.2. Ném ForbiddenException nếu không có userId trong context', async () => {
      await expect(
        useCase.execute({
          userId: '',
          question: 'Con tôi học thế nào?',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('2.3. Cắt ngắn câu hỏi nếu vượt quá 400 ký tự để chống tràn Token Context', async () => {
      mockContextPort.validateParentStudentOwnership.mockResolvedValue(true);
      const longQuestion = 'A'.repeat(500);

      await useCase.execute({
        userId: 'parent-user-1',
        studentId: 'student-bao-01',
        question: longQuestion,
      });

      expect(mockChatPort.askChatbot).toHaveBeenCalledWith(
        'A'.repeat(400),
        mockContext,
        undefined,
      );
    });
  });

  describe('3. Nguyên tắc Anti-Hallucination: Grounding dữ liệu thật', () => {
    it('3.1. Đảm bảo toàn bộ bối cảnh dữ liệu thật (SQI, chuyên cần, bài tập) được truyền cho Chat Port', async () => {
      mockContextPort.validateParentStudentOwnership.mockResolvedValue(true);

      const result = await useCase.execute({
        userId: 'parent-user-1',
        studentId: 'student-bao-01',
        question: 'Con tôi có nguy cơ không đạt mục tiêu không?',
        history: [{ role: 'user', text: 'Chào AI' }],
      });

      expect(mockChatPort.askChatbot).toHaveBeenCalledWith(
        'Con tôi có nguy cơ không đạt mục tiêu không?',
        expect.objectContaining({
          currentSqiScore: 88,
          attendanceRatePercent: 100,
          homeworkCompletionPercent: 95,
          strengths: expect.arrayContaining(['Tiếp thu nhanh']),
        }),
        [{ role: 'user', text: 'Chào AI' }],
      );

      expect(result.groundedDataSummary.sqiScore).toBe(88);
      expect(result.groundedDataSummary.attendanceRate).toBe(100);
      expect(result.followUpSuggestions.length).toBeGreaterThan(0);
    });
  });
});
