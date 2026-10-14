import { performance } from 'perf_hooks';
import {
  SqiCalculator,
  SessionEvaluationInput,
} from '../../../../src/modules/student-evaluations/domain/services/sqi-calculator.service';
import {
  StudentSessionEvaluationEntity,
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../../../src/modules/student-evaluations/domain/entities/student-session-evaluation.entity';
import { GetMonthlyStudentReportUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/get-monthly-student-report.use-case';
import { IStudentWeeklyDataQueryPort } from '../../../../src/modules/student-evaluations/application/ports/student-weekly-data-query.port';
import { SaveSessionEvaluationsUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/save-session-evaluations.use-case';
import { IStudentSessionEvaluationRepositoryPort } from '../../../../src/modules/student-evaluations/application/ports/student-session-evaluation-repository.port';

describe('Comprehensive Evaluation Edge Cases & Integration Spec (20+ Cases)', () => {
  // =========================================================================
  // NHÓM 1: CÁC TRƯỜNG HỢP BIÊN ĐIỂM DANH & CHUYÊN CẦN (EDGE CASES ATTENDANCE)
  // =========================================================================
  describe('Nhóm 1: Các trường hợp biên Điểm danh & Chuyên cần (30%)', () => {
    it('Case 1: 100% vắng mặt không phép (absent_unexcused) -> Chuyên cần 0/30, các tiêu chí khác là null', () => {
      const sessions: SessionEvaluationInput[] = Array.from({ length: 4 }, (_, i) => ({
        classSessionId: `sess-${i}`,
        subjectName: 'Toán',
        isPresent: false,
        attendanceStatus: 'absent_unexcused',
      }));

      const res = SqiCalculator.calculate(sessions, null);
      expect(res.breakdown.attendance).toBe(0);
      expect(res.breakdown.narratives?.attendance).toBe('4 buổi vắng không phép');
      expect(res.breakdown.homework).toBeNull();
      expect(res.breakdown.participation).toBeNull();
      expect(res.breakdown.behavior).toBeNull();
      expect(res.sqiScore).toBe(0);
    });

    it('Case 2: 100% vắng mặt có phép (absent_excused) -> Chuyên cần 6/30 (0.2/buổi), BTVN/Năng động null', () => {
      const sessions: SessionEvaluationInput[] = Array.from({ length: 5 }, (_, i) => ({
        classSessionId: `sess-${i}`,
        subjectName: 'Toán',
        isPresent: false,
        attendanceStatus: 'absent_excused',
      }));

      const res = SqiCalculator.calculate(sessions, null);
      // (5 * 0.2 / 5) * 30 = 6 điểm
      expect(res.breakdown.attendance).toBe(6);
      expect(res.breakdown.narratives?.attendance).toBe('5 buổi vắng có phép');
      expect(res.breakdown.homework).toBeNull();
      expect(res.breakdown.narratives?.homework).toBe('Chưa có ghi nhận');
    });

    it('Case 3: 100% đi muộn (late) -> Chuyên cần 22.5/30 (0.75/buổi)', () => {
      const sessions: SessionEvaluationInput[] = Array.from({ length: 4 }, (_, i) => ({
        classSessionId: `sess-${i}`,
        subjectName: 'Tiếng Anh',
        isPresent: true,
        attendanceStatus: 'late',
      }));

      const res = SqiCalculator.calculate(sessions, null);
      // (4 * 0.75 / 4) * 30 = 22.5 điểm
      expect(res.breakdown.attendance).toBe(22.5);
      expect(res.breakdown.narratives?.attendance).toBe('4 buổi đi muộn');
    });

    it('Case 4: 100% đi muộn nhiều (late_much) -> Chuyên cần 12/30 (0.4/buổi)', () => {
      const sessions: SessionEvaluationInput[] = Array.from({ length: 5 }, (_, i) => ({
        classSessionId: `sess-${i}`,
        subjectName: 'Văn',
        isPresent: true,
        attendanceStatus: 'late_much',
      }));

      const res = SqiCalculator.calculate(sessions, null);
      // (5 * 0.4 / 5) * 30 = 12 điểm
      expect(res.breakdown.attendance).toBe(12);
      expect(res.breakdown.narratives?.attendance).toBe('5 buổi đi muộn nhiều');
    });

    it('Case 5: 100% về sớm (early_leave) -> Chuyên cần 22.5/30 (0.75/buổi)', () => {
      const sessions: SessionEvaluationInput[] = Array.from({ length: 4 }, (_, i) => ({
        classSessionId: `sess-${i}`,
        subjectName: 'Toán',
        isPresent: true,
        attendanceStatus: 'early_leave',
      }));

      const res = SqiCalculator.calculate(sessions, null);
      expect(res.breakdown.attendance).toBe(22.5);
      expect(res.breakdown.narratives?.attendance).toBe('4 buổi về sớm');
    });

    it('Case 6: 100% học bù (makeup) -> Chuyên cần 30/30 (1.0/buổi)', () => {
      const sessions: SessionEvaluationInput[] = Array.from({ length: 3 }, (_, i) => ({
        classSessionId: `sess-${i}`,
        subjectName: 'Toán',
        isPresent: true,
        attendanceStatus: 'makeup',
      }));

      const res = SqiCalculator.calculate(sessions, null);
      expect(res.breakdown.attendance).toBe(30);
      expect(res.breakdown.narratives?.attendance).toBe('3 buổi học bù');
    });

    it('Case 7: Duy nhất 1 buổi trong tháng, đi muộn -> Chuyên cần 22.5/30, SQI chuẩn hóa = 75', () => {
      const sessions: SessionEvaluationInput[] = [
        {
          classSessionId: 'sess-single',
          subjectName: 'Toán',
          isPresent: true,
          attendanceStatus: 'late',
        },
      ];

      const res = SqiCalculator.calculate(sessions, null);
      expect(res.breakdown.attendance).toBe(22.5);
      expect(res.sqiScore).toBe(75);
      expect(res.breakdown.homework).toBeNull();
      expect(res.breakdown.participation).toBeNull();
      expect(res.breakdown.behavior).toBeNull();
    });

    it('Case 8: Dữ liệu điểm danh cũ / legacy (attendanceStatus rỗng, chỉ có cờ isPresent & isLate)', () => {
      const sessions: SessionEvaluationInput[] = [
        { classSessionId: 's1', subjectName: 'Toán', isPresent: true, isLate: true },
        { classSessionId: 's2', subjectName: 'Toán', isPresent: true, isLate: false },
        { classSessionId: 's3', subjectName: 'Toán', isPresent: false },
      ];

      const res = SqiCalculator.calculate(sessions, null);
      // (0.75 + 1.0 + 0) / 3 * 30 = 17.5
      expect(res.breakdown.attendance).toBe(17.5);
      expect(res.breakdown.narratives?.attendance).toContain('1 buổi đi muộn');
      expect(res.breakdown.narratives?.attendance).toContain('1 buổi đúng giờ');
      expect(res.breakdown.narratives?.attendance).toContain('1 buổi vắng mặt');
    });

    it('Case 9: Dữ liệu chuỗi hoa/thường lẫn lộn (On_TiMe, LATE, AbSeNt_ExCuSeD) chuẩn hóa an toàn', () => {
      const sessions: SessionEvaluationInput[] = [
        { classSessionId: 's1', subjectName: 'Toán', isPresent: true, attendanceStatus: 'On_TiMe' },
        { classSessionId: 's2', subjectName: 'Toán', isPresent: true, attendanceStatus: 'LATE' },
        { classSessionId: 's3', subjectName: 'Toán', isPresent: false, attendanceStatus: 'AbSeNt_ExCuSeD' },
      ];

      const res = SqiCalculator.calculate(sessions, null);
      // (1.0 + 0.75 + 0.2) / 3 * 30 = 19.5
      expect(res.breakdown.attendance).toBe(19.5);
      expect(res.breakdown.narratives?.attendance).toContain('1 buổi đúng giờ');
      expect(res.breakdown.narratives?.attendance).toContain('1 buổi đi muộn');
      expect(res.breakdown.narratives?.attendance).toContain('1 buổi vắng có phép');
    });
  });

  // =========================================================================
  // NHÓM 2: CÁC TRƯỜNG HỢP BIÊN ĐÁNH GIÁ BÀI TẬP (EDGE CASES HOMEWORK)
  // =========================================================================
  describe('Nhóm 2: Các trường hợp biên Đánh giá bài tập (30%)', () => {
    it('Case 10: Chỉ 1 buổi được chấm BTVN trong 10 buổi học -> Mẫu số chỉ là 1, cấm tự gen 9 buổi còn lại', () => {
      const sessions: SessionEvaluationInput[] = [
        {
          classSessionId: 's1',
          subjectName: 'Toán',
          isPresent: true,
          attendanceStatus: 'on_time',
          homeworkStatus: HomeworkStatus.COMPLETED,
        },
        ...Array.from({ length: 9 }, (_, i) => ({
          classSessionId: `s-${i + 2}`,
          subjectName: 'Toán',
          isPresent: true,
          attendanceStatus: 'on_time',
          homeworkStatus: undefined, // CHƯA CHẤM
        })),
      ];

      const res = SqiCalculator.calculate(sessions, null);
      // 1 buổi hoàn thành / 1 buổi có chấm = 100% * 30 = 30 điểm
      expect(res.breakdown.homework).toBe(30);
      expect(res.breakdown.narratives?.homework).toBe('1 buổi đã làm BTVN');
      expect(res.breakdown.narratives?.homework).not.toContain('10 buổi');
    });

    it('Case 11: Bài tập hỗn hợp tất cả các mức độ: excellent, completed, missing_few, forgot_notebook, coping, incomplete, missing_many, not_done', () => {
      const sessions: SessionEvaluationInput[] = [
        { classSessionId: 's1', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'excellent' },
        { classSessionId: 's2', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'completed' },
        { classSessionId: 's3', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'missing_few' },
        { classSessionId: 's4', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'forgot_notebook' },
        { classSessionId: 's5', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'coping' },
        { classSessionId: 's6', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'incomplete' },
        { classSessionId: 's7', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'missing_many' },
        { classSessionId: 's8', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'not_done' },
      ];

      const res = SqiCalculator.calculate(sessions, null);
      // (1.0 + 1.0 + 0.7 + 0.7 + 0.4 + 0.5 + 0.3 + 0.0) / 8 * 30 = 4.6 / 8 * 30 = 17.25 -> làm tròn 17.3
      expect(res.breakdown.homework).toBe(17.3);
      expect(res.breakdown.narratives?.homework).toContain('1 buổi làm tốt 100%');
      expect(res.breakdown.narratives?.homework).toContain('1 buổi đã làm BTVN');
      expect(res.breakdown.narratives?.homework).toContain('1 buổi quên mang vở');
      expect(res.breakdown.narratives?.homework).toContain('1 buổi chưa làm');
    });

    it('Case 12: Trạng thái no_homework hoặc none -> Không tính vào mẫu số, trả về Chưa có ghi nhận nếu không có buổi nào giao', () => {
      const sessions: SessionEvaluationInput[] = [
        { classSessionId: 's1', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'no_homework' },
        { classSessionId: 's2', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'none' },
      ];

      const res = SqiCalculator.calculate(sessions, null);
      expect(res.breakdown.homework).toBeNull();
      expect(res.breakdown.narratives?.homework).toBe('Chưa có ghi nhận');
    });
  });

  // =========================================================================
  // NHÓM 3: CÁC TRƯỜNG HỢP BIÊN NĂNG ĐỘNG & TƯƠNG TÁC (EDGE CASES PARTICIPATION)
  // =========================================================================
  describe('Nhóm 3: Các trường hợp biên Năng động & Tương tác (20%)', () => {
    it('Case 13: Toàn bộ các buổi có mặt đều chưa chấm Năng động (chuỗi rỗng, null, undefined) -> null và Chưa có ghi nhận', () => {
      const sessions: SessionEvaluationInput[] = [
        { classSessionId: 's1', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', participation: undefined },
        { classSessionId: 's2', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', participation: '' as any },
        { classSessionId: 's3', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', participation: null as any },
      ];

      const res = SqiCalculator.calculate(sessions, null);
      expect(res.breakdown.participation).toBeNull();
      expect(res.breakdown.narratives?.participation).toBe('Chưa có ghi nhận');
    });

    it('Case 14: Tương tác hỗn hợp tất cả các mức độ: active_raise_hand, proactive_ask, answer_well, attentive_quiet, answer_hesitant, cannot_answer', () => {
      const sessions: SessionEvaluationInput[] = [
        { classSessionId: 's1', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', participation: 'active_raise_hand' },
        { classSessionId: 's2', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', participation: 'proactive_ask' },
        { classSessionId: 's3', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', participation: 'answer_well' },
        { classSessionId: 's4', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', participation: 'attentive_quiet' },
        { classSessionId: 's5', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', participation: 'answer_hesitant' },
        { classSessionId: 's6', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', participation: 'cannot_answer' },
      ];

      const res = SqiCalculator.calculate(sessions, null);
      // (1.0 + 1.0 + 0.8 + 0.7 + 0.4 + 0.0) / 6 * 20 = 3.9 / 6 * 20 = 13.0
      expect(res.breakdown.participation).toBe(13);
      expect(res.breakdown.narratives?.participation).toContain('1 buổi chủ động giơ tay');
      expect(res.breakdown.narratives?.participation).toContain('1 buổi chủ động hỏi bài');
      expect(res.breakdown.narratives?.participation).toContain('1 buổi gọi trả lời được');
      expect(res.breakdown.narratives?.participation).toContain('1 buổi chăm chú nhưng ít nói');
    });

    it('Case 15: Chỉ 1 buổi trong 15 buổi được ghi nhận giơ tay -> Mẫu số là 1 (20/20), không được suy diễn 15 buổi chủ động giơ tay', () => {
      const sessions: SessionEvaluationInput[] = [
        { classSessionId: 's1', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', participation: 'active_raise_hand' },
        ...Array.from({ length: 14 }, (_, i) => ({
          classSessionId: `s-${i + 2}`,
          subjectName: 'Toán',
          isPresent: true,
          attendanceStatus: 'on_time',
          participation: undefined,
        })),
      ];

      const res = SqiCalculator.calculate(sessions, null);
      expect(res.breakdown.participation).toBe(20);
      expect(res.breakdown.narratives?.participation).toBe('1 buổi chủ động giơ tay');
    });
  });

  // =========================================================================
  // NHÓM 4: CÁC TRƯỜNG HỢP BIÊN NỘI QUY & NỀ NẾP (EDGE CASES BEHAVIOR)
  // =========================================================================
  describe('Nhóm 4: Các trường hợp biên Nội quy & Nề nếp (20%)', () => {
    it('Case 16: Không có tag và không có behaviorStatus -> null và Chưa có ghi nhận', () => {
      const sessions: SessionEvaluationInput[] = [
        { classSessionId: 's1', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', behaviorTags: [] },
        { classSessionId: 's2', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', behaviorTags: undefined },
      ];

      const res = SqiCalculator.calculate(sessions, null);
      expect(res.breakdown.behavior).toBeNull();
      expect(res.breakdown.narratives?.behavior).toBe('Chưa có ghi nhận');
    });

    it('Case 17: Nội quy hỗn hợp các tag vi phạm và tích cực: disruptive, phone_private, talkative, sleepy, good', () => {
      const sessions: SessionEvaluationInput[] = [
        { classSessionId: 's1', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', behaviorStatus: 'disruptive' },
        { classSessionId: 's2', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', behaviorStatus: 'phone_private' },
        { classSessionId: 's3', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', behaviorStatus: 'talkative' },
        { classSessionId: 's4', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', behaviorStatus: 'sleepy' },
        { classSessionId: 's5', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', behaviorStatus: 'good' },
      ];

      const res = SqiCalculator.calculate(sessions, null);
      // (0.1 + 0.3 + 0.5 + 0.7 + 1.0) / 5 * 20 = 2.6 / 5 * 20 = 10.4
      expect(res.breakdown.behavior).toBe(10.4);
      expect(res.breakdown.narratives?.behavior).toContain('1 buổi đùa trong lớp');
      expect(res.breakdown.narratives?.behavior).toContain('1 buổi dùng điện thoại/việc riêng');
      expect(res.breakdown.narratives?.behavior).toContain('1 buổi hay nói chuyện');
      expect(res.breakdown.narratives?.behavior).toContain('1 buổi buồn ngủ/mệt mỏi');
      expect(res.breakdown.narratives?.behavior).toContain('1 buổi tốt/nghiêm túc');
    });

    it('Case 18: behaviorTags chứa chuỗi lạ hoặc khoảng trắng -> Không bị exception NaN', () => {
      const sessions: SessionEvaluationInput[] = [
        { classSessionId: 's1', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', behaviorTags: ['   ' as any, 'unknown_tag' as any] },
      ];

      const res = SqiCalculator.calculate(sessions, null);
      expect(isNaN(res.breakdown.behavior!)).toBe(false);
      expect(res.breakdown.behavior).toBe(20);
    });
  });

  // =========================================================================
  // NHÓM 5: TÍCH HỢP USE CASE & HỆ THỐNG (INTEGRATION TESTS)
  // =========================================================================
  describe('Nhóm 5: Tích hợp Use Cases và Báo cáo Tháng (Integration)', () => {
    it('Case 19: GetMonthlyStudentReportUseCase tích hợp khi học sinh có 13 buổi (5 đúng giờ, 6 muộn, 2 vắng) và CHƯA CÓ đánh giá', async () => {
      const mockSessions: SessionEvaluationInput[] = [
        ...Array.from({ length: 5 }, (_, i) => ({
          classSessionId: `s-on-${i}`,
          subjectName: 'Toán',
          isPresent: true,
          attendanceStatus: 'on_time',
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          classSessionId: `s-late-${i}`,
          subjectName: 'Toán',
          isPresent: true,
          attendanceStatus: 'late',
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          classSessionId: `s-abs-${i}`,
          subjectName: 'Toán',
          isPresent: false,
          attendanceStatus: 'absent_unexcused',
        })),
      ];

      const mockQueryPort: IStudentWeeklyDataQueryPort = {
        getWeeklySessions: jest.fn().mockResolvedValue(mockSessions),
        getPreviousWeekSqi: jest.fn().mockResolvedValue(null),
        verifyStudentOwnership: jest.fn().mockResolvedValue(true),
        getStudentInfo: jest.fn().mockResolvedValue({ id: 'std-1', name: 'Nguyễn Văn An', code: 'HS-001' }),
        getClassStudents: jest.fn().mockResolvedValue([]),
        verifyTeacherClassAccess: jest.fn().mockResolvedValue(true),
        getClassName: jest.fn().mockResolvedValue('Lớp Toán A'),
      };

      const useCase = new GetMonthlyStudentReportUseCase(mockQueryPort);
      const output = await useCase.execute({
        studentId: 'std-1',
        month: 10,
        year: 2026,
        requestUserId: 'admin-1',
        userRole: 'ADMIN',
      });

      expect(output.hasSessions).toBe(true);
      const report = output.report!;
      expect(report.sqiBreakdown.attendance).toBe(21.9);
      expect(report.sqiBreakdown.homework).toBeNull();
      expect(report.sqiBreakdown.narratives?.homework).toBe('Chưa có ghi nhận');
      expect(report.sqiBreakdown.participation).toBeNull();
      expect(report.sqiBreakdown.narratives?.participation).toBe('Chưa có ghi nhận');
      expect(report.sqiBreakdown.behavior).toBeNull();
      expect(report.sqiBreakdown.narratives?.behavior).toBe('Chưa có ghi nhận');

      // Overview và Strengths không được tự tiện bịa là hoàn thành 100% bài tập
      expect(report.strengths).not.toContain('hoàn thành đủ 100% bài tập về nhà');
    });

    it('Case 20: So sánh Delta giữa 2 tháng khi tháng trước đầy đủ (SQI 85), tháng này chỉ có Chuyên cần (SQI 73)', async () => {
      const prevSessions: SessionEvaluationInput[] = [
        { classSessionId: 'p1', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'completed', participation: 'active', behaviorTags: [BehaviorTag.ATTENTIVE] },
        { classSessionId: 'p2', subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time', homeworkStatus: 'missing_few', participation: 'answer_well', behaviorTags: [BehaviorTag.ATTENTIVE] },
      ];

      const currentSessions: SessionEvaluationInput[] = [
        ...Array.from({ length: 5 }, (_, i) => ({ classSessionId: `c-on-${i}`, subjectName: 'Toán', isPresent: true, attendanceStatus: 'on_time' })),
        ...Array.from({ length: 6 }, (_, i) => ({ classSessionId: `c-late-${i}`, subjectName: 'Toán', isPresent: true, attendanceStatus: 'late' })),
        ...Array.from({ length: 2 }, (_, i) => ({ classSessionId: `c-abs-${i}`, subjectName: 'Toán', isPresent: false, attendanceStatus: 'absent_unexcused' })),
      ];

      const mockQueryPort: IStudentWeeklyDataQueryPort = {
        getWeeklySessions: jest.fn().mockImplementation((_, start) => {
          if (start.includes('2026-09')) return Promise.resolve(prevSessions);
          return Promise.resolve(currentSessions);
        }),
        getPreviousWeekSqi: jest.fn().mockResolvedValue(null),
        verifyStudentOwnership: jest.fn().mockResolvedValue(true),
        getStudentInfo: jest.fn().mockResolvedValue({ id: 'std-1', name: 'Nguyễn Văn An', code: 'HS-001' }),
        getClassStudents: jest.fn().mockResolvedValue([]),
        verifyTeacherClassAccess: jest.fn().mockResolvedValue(true),
        getClassName: jest.fn().mockResolvedValue('Lớp Toán A'),
      };

      const useCase = new GetMonthlyStudentReportUseCase(mockQueryPort);
      const output = await useCase.execute({
        studentId: 'std-1',
        month: 10,
        year: 2026,
        requestUserId: 'admin-1',
        userRole: 'ADMIN',
      });

      const report = output.report!;
      expect(report.sqiScore).toBe(73.1);
      // Delta so với tháng trước phải là số âm và tính đúng hiệu số
      expect(report.sqiDelta).toBeLessThan(0);
    });

    it('Case 21: SaveSessionEvaluationsUseCase tích hợp lưu đánh giá với các trường undefined -> không bị ép gán COMPLETED/ACTIVE', async () => {
      let savedEntities: StudentSessionEvaluationEntity[] = [];
      const mockRepo: IStudentSessionEvaluationRepositoryPort = {
        saveBatch: jest.fn().mockImplementation(async (items) => {
          savedEntities = items;
          return items;
        }),
        findBySessionId: jest.fn().mockResolvedValue([]),
        findBySessionAndStudent: jest.fn().mockResolvedValue(null),
      };

      const useCase = new SaveSessionEvaluationsUseCase(mockRepo);
      const result = await useCase.execute({
        classSessionId: 'sess-1',
        teacherId: 'teacher-1',
        evaluations: [
          {
            studentId: 'std-1',
            // homeworkStatus, participation, understanding BỊ ĐỂ TRỐNG
          },
        ],
      });

      expect(result.savedCount).toBe(1);
      expect(savedEntities[0].homeworkStatus).toBeUndefined();
      expect(savedEntities[0].participation).toBeUndefined();
      expect(savedEntities[0].understanding).toBeUndefined();
    });

    it('Case 22: Performance Benchmark nâng cao: Tính toán SQI cho 5,000 học sinh dataset hỗn hợp phức tạp dưới 100ms', () => {
      const STUDENT_COUNT = 5000;
      const mockDataset = Array.from({ length: STUDENT_COUNT }, (_, i) => ({
        sessions: [
          {
            classSessionId: `s-${i}-1`,
            subjectName: 'Toán',
            isPresent: i % 10 !== 0,
            attendanceStatus: i % 10 === 0 ? 'absent_unexcused' : i % 5 === 0 ? 'late' : 'on_time',
            homeworkStatus: i % 3 === 0 ? HomeworkStatus.COMPLETED : undefined,
            participation: i % 4 === 0 ? ParticipationStatus.ACTIVE : undefined,
            behaviorTags: i % 6 === 0 ? [BehaviorTag.ATTENTIVE] : [],
          },
        ],
      }));

      // Warmup JIT
      SqiCalculator.calculate(mockDataset[0].sessions, null);

      const start = performance.now();
      for (let i = 0; i < STUDENT_COUNT; i++) {
        SqiCalculator.calculate(mockDataset[i].sessions, null);
      }
      const durationMs = performance.now() - start;

      console.log(`[BENCHMARK] Tính toán SQI 5,000 học sinh mất ${durationMs.toFixed(2)}ms (SLA < 100ms)`);
      expect(durationMs).toBeLessThan(100);
    });
  });
});
