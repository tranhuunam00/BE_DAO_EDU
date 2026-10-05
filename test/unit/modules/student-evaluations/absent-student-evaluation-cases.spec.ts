import { TypeOrmStudentWeeklyDataQueryAdapter } from '../../../../src/modules/student-evaluations/infrastructure/persistence/typeorm-student-weekly-data-query.adapter';
import { GenerateAiEvaluationCommentUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/generate-ai-evaluation-comment.use-case';
import { IAiEvaluationGeneratorPort } from '../../../../src/modules/student-evaluations/application/ports/ai-evaluation-generator.port';
import { HomeworkStatus, ParticipationStatus, BehaviorTag } from '../../../../src/modules/student-evaluations/domain/entities/student-session-evaluation.entity';
import { GetMonthlyStudentReportUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/get-monthly-student-report.use-case';
import { SqiCalculator } from '../../../../src/modules/student-evaluations/domain/services/sqi-calculator.service';

describe('Absent Student Evaluation & Anti-Hallucination Spec (Kiểm thử toàn diện case học sinh nghỉ học)', () => {
  describe('1. TypeOrmStudentWeeklyDataQueryAdapter - Làm sạch dữ liệu đánh giá khi học sinh vắng mặt', () => {
    let adapter: TypeOrmStudentWeeklyDataQueryAdapter;
    let mockStudentRepo: any;
    let mockSessionRepo: any;
    let mockAttendanceRepo: any;
    let mockEvalRepo: any;
    let mockClassStudentRepo: any;
    let mockClassRepo: any;
    let mockTeacherRepo: any;

    beforeEach(() => {
      mockStudentRepo = { findOne: jest.fn() };
      mockClassStudentRepo = {
        find: jest.fn().mockResolvedValue([{ classId: 'class-toan-7', studentId: 'student-01', status: 'Active' }]),
      };
      mockClassRepo = {};
      mockTeacherRepo = {};
      mockAttendanceRepo = { find: jest.fn() };
      mockEvalRepo = { find: jest.fn() };
      mockSessionRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          addOrderBy: jest.fn().mockReturnThis(),
          getMany: jest.fn(),
        }),
      };

      adapter = new TypeOrmStudentWeeklyDataQueryAdapter(
        mockStudentRepo,
        mockSessionRepo,
        mockAttendanceRepo,
        mockEvalRepo,
        mockClassStudentRepo,
        mockClassRepo,
        mockTeacherRepo,
      );
    });

    it('1.1. Khi học sinh nghỉ học (isPresent = false), participation và homeworkStatus bắt buộc phải là undefined', async () => {
      // Giả lập 2 buổi: Buổi 1 (18/09) đi học bình thường, Buổi 2 (20/09) học sinh vắng nhưng có bản ghi eval lỡ lưu "yes"
      mockSessionRepo.createQueryBuilder().getMany.mockResolvedValue([
        { id: 'sess-18', date: '2026-09-18', status: 'Completed', classEntity: { className: 'Toán 7' } },
        { id: 'sess-20', date: '2026-09-20', status: 'Completed', classEntity: { className: 'Toán 7' } },
      ]);

      mockAttendanceRepo.find.mockResolvedValue([
        { classSessionId: 'sess-18', studentId: 'student-01', isPresent: true, status: 'on_time' },
        { classSessionId: 'sess-20', studentId: 'student-01', isPresent: false, status: 'absent_unexcused' },
      ]);

      // Bản ghi eval trong DB vô tình lưu có phát biểu và có BTVN cho buổi sess-20
      mockEvalRepo.find.mockResolvedValue([
        {
          classSessionId: 'sess-18',
          studentId: 'student-01',
          homeworkStatus: HomeworkStatus.COMPLETED,
          participation: ParticipationStatus.ACTIVE,
          score: '8.5',
        },
        {
          classSessionId: 'sess-20',
          studentId: 'student-01',
          homeworkStatus: HomeworkStatus.COMPLETED,
          participation: ParticipationStatus.ACTIVE,
          score: '9.0',
        },
      ]);

      const results = await adapter.getWeeklySessions('student-01', '2026-09-01', '2026-09-30');

      expect(results).toHaveLength(2);

      // Buổi 1: có mặt, giữ nguyên đánh giá
      expect(results[0].isPresent).toBe(true);
      expect(results[0].homeworkStatus).toBe(HomeworkStatus.COMPLETED);
      expect(results[0].participation).toBe(ParticipationStatus.ACTIVE);
      expect(results[0].score).toBe('8.5');

      // Buổi 2: VẮNG MẶT -> dữ liệu đánh giá lớp học bị làm sạch triệt để
      expect(results[1].isPresent).toBe(false);
      expect(results[1].homeworkStatus).toBeUndefined();
      expect(results[1].participation).toBeUndefined();
      expect(results[1].understanding).toBeUndefined();
      expect(results[1].behaviorTags).toEqual([]);
      expect(results[1].score).toBeNull();
    });

    it('1.2. Học sinh vắng có phép (absent_excused) cũng được bảo vệ tương tự', async () => {
      mockSessionRepo.createQueryBuilder().getMany.mockResolvedValue([
        { id: 'sess-20', date: '2026-09-20', status: 'Completed', classEntity: { className: 'Toán 7' } },
      ]);
      mockAttendanceRepo.find.mockResolvedValue([
        { classSessionId: 'sess-20', studentId: 'student-01', isPresent: false, status: 'absent_excused' },
      ]);
      mockEvalRepo.find.mockResolvedValue([
        { classSessionId: 'sess-20', studentId: 'student-01', participation: ParticipationStatus.ACTIVE },
      ]);

      const results = await adapter.getWeeklySessions('student-01', '2026-09-01', '2026-09-30');
      expect(results).toHaveLength(1);
      expect(results[0].isPresent).toBe(false);
      expect(results[0].participation).toBeUndefined();
      expect(results[0].homeworkStatus).toBeUndefined();
    });
  });

  describe('2. GenerateAiEvaluationCommentUseCase - Sinh nhận xét chuẩn mực cho học sinh vắng mặt', () => {
    let useCase: GenerateAiEvaluationCommentUseCase;
    let mockAiGenerator: jest.Mocked<IAiEvaluationGeneratorPort>;

    beforeEach(() => {
      mockAiGenerator = {
        generateComment: jest.fn(),
      };
      useCase = new GenerateAiEvaluationCommentUseCase(mockAiGenerator);
    });

    it('2.1. Khi học sinh vắng mặt (isPresent = false), gọi AI với tiêu chí vắng mặt và không bị khen phát biểu', async () => {
      mockAiGenerator.generateComment.mockResolvedValue(
        'Học sinh vắng mặt trong buổi học ngày 20/09. Gia đình nhắc con xem lại bài giảng và làm bù bài tập.',
      );

      const result = await useCase.execute({
        studentId: 'st-01',
        studentName: 'Nguyễn Văn A',
        isPresent: false,
        attendanceStatus: 'absent_unexcused',
        homeworkStatus: HomeworkStatus.COMPLETED as any, // Dù vô tình truyền vào
        participation: ParticipationStatus.ACTIVE as any,
      });

      expect(mockAiGenerator.generateComment).toHaveBeenCalledWith(
        expect.objectContaining({
          studentName: 'Nguyễn Văn A',
          isPresent: false,
          homeworkStatus: undefined,
          participation: undefined,
        }),
      );
      expect(result.comment).toContain('vắng mặt');
    });

    it('2.2. Fallback Circuit Breaker trả về nhận xét vắng mặt chuẩn mực khi AI API gặp sự cố', async () => {
      mockAiGenerator.generateComment.mockRejectedValue(new Error('AI API Timeout'));

      const result = await useCase.execute({
        studentId: 'st-01',
        studentName: 'Trần Thị B',
        isPresent: false,
        attendanceStatus: 'absent_excused',
      });

      expect(result.isAiGenerated).toBe(false);
      expect(result.comment).toBe(
        'Em Trần Thị B vắng mặt trong buổi học. Con cần xem lại bài giảng và hoàn thành bài tập bù trước buổi học sau.',
      );
      expect(result.comment).not.toContain('hăng hái phát biểu');
      expect(result.comment).not.toContain('tiếp thu bài tốt');
    });
  });

  describe('3. Báo cáo tổng hợp Tháng / Tuần & Chỉ số SQI khi có buổi nghỉ học', () => {
    it('3.1. SqiCalculator tính toán chính xác số buổi và narrative chuyên cần khi học sinh nghỉ 1 buổi', () => {
      const sessions = [
        { classSessionId: '1', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'completed', participation: 'active' },
        { classSessionId: '2', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'completed', participation: 'active' },
        { classSessionId: '3', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'completed', participation: 'active' },
        { classSessionId: '4', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'completed', participation: 'active' },
        { classSessionId: '5', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'completed', participation: 'active' },
        { classSessionId: '6', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'completed', participation: 'active' },
        // Buổi 7 nghỉ học: participation & homeworkStatus = undefined
        { classSessionId: '7', subjectName: 'Toán', isPresent: false, attendanceStatus: 'absent_unexcused', homeworkStatus: undefined, participation: undefined },
      ];

      const result = SqiCalculator.calculate(sessions as any, null);

      // Chuyên cần: 6/7 buổi đúng giờ (làm tròn 1 chữ số thập phân = 25.7đ)
      expect(result.breakdown.attendance).toBeCloseTo(25.7, 1);
      expect(result.breakdown.narratives?.attendance).toContain('6 buổi đúng giờ');
      expect(result.breakdown.narratives?.attendance).toContain('1 buổi vắng không phép');

      // Điểm BTVN: 6 buổi có mặt làm bài đầy đủ (6/6 = 100% -> 30đ)
      expect(result.breakdown.homework).toBe(30);

      // Điểm phát biểu: 6 buổi chủ động giơ tay (chỉ tính 6 buổi có mặt, KHÔNG bị nhảy lên 7 buổi)
      expect(result.breakdown.narratives?.participation).toBe('6 buổi chủ động giơ tay');
      expect(result.breakdown.participation).toBe(20);
    });

    it('3.2. GetMonthlyStudentReportUseCase nhận diện số buổi vắng trong phần cải thiện và không khen buổi vắng', async () => {
      const mockQueryPort: any = {
        verifyStudentOwnership: jest.fn().mockResolvedValue(true),
        getStudentInfo: jest.fn().mockResolvedValue({ name: 'Lê Hoàng Nam', code: 'HS001' }),
        getWeeklySessions: jest.fn().mockResolvedValue([
          { classSessionId: '1', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'completed', participation: 'active', understanding: 'understood' },
          { classSessionId: '2', subjectName: 'Toán', isPresent: false, attendanceStatus: 'absent_unexcused', homeworkStatus: undefined, participation: undefined, understanding: undefined },
        ]),
      };

      const useCase = new GetMonthlyStudentReportUseCase(mockQueryPort);
      const res = await useCase.execute({
        studentId: 'st-01',
        month: 9,
        year: 2026,
        requestUserId: 'admin-01',
        userRole: 'ADMIN',
      });

      expect(res.report).toBeDefined();
      expect(res.report?.improvements).toContain('vắng 1 buổi học');
    });
  });
});
