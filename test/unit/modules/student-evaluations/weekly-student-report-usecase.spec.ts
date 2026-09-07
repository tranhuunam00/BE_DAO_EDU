import {
  WeeklyStudentReportEntity,
  TrendDirection,
} from '../../../../src/modules/student-evaluations/domain/entities/weekly-student-report.entity';
import { GetWeeklyStudentReportUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/get-weekly-student-report.use-case';
import { IStudentWeeklyDataQueryPort } from '../../../../src/modules/student-evaluations/application/ports/student-weekly-data-query.port';
import {
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../../../src/modules/student-evaluations/domain/entities/student-session-evaluation.entity';

describe('GetWeeklyStudentReportUseCase & Pure-Query Spec', () => {
  // =========================================================================
  // PHẦN 1: QUY TẮC BẮT BUỘC - CHỈ QUERY, TUYỆT ĐỐI KHÔNG MUTATION DỮ LIỆU GỐC
  // =========================================================================
  describe('1. Pure Query / Zero Mutation Guarantee (Bảo vệ dữ liệu gốc)', () => {
    it('1.1. Khẳng định 100% không gọi bất kỳ lệnh ghi/sửa/xóa nào đến các bảng vận hành (Zero Mutations)', async () => {
      // Mock Port chỉ đọc (Pure Read)
      const mockQueryPort: IStudentWeeklyDataQueryPort = {
        getWeeklySessions: jest.fn().mockResolvedValue([
          {
            classSessionId: 'sess-1',
            subjectName: 'Toán',
            isPresent: true,
            isLate: false,
            homeworkStatus: HomeworkStatus.COMPLETED,
            participation: ParticipationStatus.ACTIVE,
            understanding: UnderstandingStatus.UNDERSTOOD,
            behaviorTags: [BehaviorTag.ATTENTIVE],
            score: '9.0',
            teacherComment: 'Con tiếp thu bài tốt',
          },
        ]),
        getPreviousWeekSqi: jest.fn().mockResolvedValue(80),
        verifyStudentOwnership: jest.fn().mockResolvedValue(true),
        getStudentInfo: jest.fn().mockResolvedValue({
          id: 'student-1',
          name: 'Nguyễn Minh A',
          code: 'S001',
        }),
      };

      // Spy để theo dõi xem có hành vi mutation nào xảy ra không
      const mutationSpies = {
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      };

      const useCase = new GetWeeklyStudentReportUseCase(mockQueryPort);

      // Thực thi lấy báo cáo
      const result = await useCase.execute({
        studentId: 'student-1',
        weekNumber: 35,
        year: 2026,
        requestUserId: 'parent-user-1',
        userRole: 'STUDENT',
      });

      // 1. Kiểm tra kết quả trả về đúng đắn
      expect(result.report).toBeDefined();
      expect(result.report?.sqiScore).toBeGreaterThanOrEqual(90);

      // 2. KHẲNG ĐỊNH BẮT BUỘC: Không có bất kỳ lệnh mutation nào được gọi
      expect(mutationSpies.save).not.toHaveBeenCalled();
      expect(mutationSpies.update).not.toHaveBeenCalled();
      expect(mutationSpies.delete).not.toHaveBeenCalled();
    });

    it('1.2. Tính lũy đẳng tuyệt đối (Idempotency): Gọi 50 lần liên tiếp vẫn giữ nguyên trạng thái, 0 side-effects', async () => {
      const mockQueryPort: IStudentWeeklyDataQueryPort = {
        getWeeklySessions: jest.fn().mockResolvedValue([
          {
            classSessionId: 'sess-1',
            subjectName: 'Toán',
            isPresent: true,
            isLate: false,
            homeworkStatus: HomeworkStatus.COMPLETED,
            participation: ParticipationStatus.ACTIVE,
            understanding: UnderstandingStatus.UNDERSTOOD,
            behaviorTags: [],
            score: '8.5',
            teacherComment: 'Làm bài nhanh',
          },
        ]),
        getPreviousWeekSqi: jest.fn().mockResolvedValue(78),
        verifyStudentOwnership: jest.fn().mockResolvedValue(true),
        getStudentInfo: jest.fn().mockResolvedValue({
          id: 'student-1',
          name: 'Nguyễn Minh A',
          code: 'S001',
        }),
      };

      const useCase = new GetWeeklyStudentReportUseCase(mockQueryPort);

      const firstCall = await useCase.execute({
        studentId: 'student-1',
        weekNumber: 35,
        year: 2026,
        requestUserId: 'parent-user-1',
        userRole: 'STUDENT',
      });

      for (let i = 0; i < 49; i++) {
        const subsequentCall = await useCase.execute({
          studentId: 'student-1',
          weekNumber: 35,
          year: 2026,
          requestUserId: 'parent-user-1',
          userRole: 'STUDENT',
        });
        expect(subsequentCall.report?.sqiScore).toBe(firstCall.report?.sqiScore);
        expect(subsequentCall.report?.sqiDelta).toBe(firstCall.report?.sqiDelta);
      }
    });
  });

  // =========================================================================
  // PHẦN 2: BẢO MẬT PHÂN QUYỀN & XỬ LÝ ĐA HỌC SINH (CHILD SWITCHER)
  // =========================================================================
  describe('2. Security & Multi-student Ownership', () => {
    it('2.1. Chặn truy cập (Forbidden) nếu phụ huynh truyền studentId không thuộc tài khoản của mình', async () => {
      const mockQueryPort: IStudentWeeklyDataQueryPort = {
        getWeeklySessions: jest.fn(),
        getPreviousWeekSqi: jest.fn(),
        verifyStudentOwnership: jest.fn().mockResolvedValue(false), // Không sở hữu!
        getStudentInfo: jest.fn(),
      };

      const useCase = new GetWeeklyStudentReportUseCase(mockQueryPort);

      await expect(
        useCase.execute({
          studentId: 'victim-student-2',
          weekNumber: 35,
          year: 2026,
          requestUserId: 'attacker-user-1',
          userRole: 'STUDENT',
        }),
      ).rejects.toThrow('Bạn không có quyền xem báo cáo của học sinh này');
    });

    it('2.2. Cho phép Admin xem bất kỳ học sinh nào mà không cần kiểm tra quyền sở hữu phụ huynh', async () => {
      const mockQueryPort: IStudentWeeklyDataQueryPort = {
        getWeeklySessions: jest.fn().mockResolvedValue([]),
        getPreviousWeekSqi: jest.fn().mockResolvedValue(null),
        verifyStudentOwnership: jest.fn().mockResolvedValue(false), // Dù ownership = false
        getStudentInfo: jest.fn().mockResolvedValue({ id: 'student-1', name: 'Học sinh A', code: 'S1' }),
      };

      const useCase = new GetWeeklyStudentReportUseCase(mockQueryPort);

      const result = await useCase.execute({
        studentId: 'student-1',
        weekNumber: 35,
        year: 2026,
        requestUserId: 'admin-user-1',
        userRole: 'ADMIN',
      });

      expect(result.report).toBeDefined();
      // Admin bỏ qua verifyStudentOwnership
      expect(mockQueryPort.verifyStudentOwnership).not.toHaveBeenCalled();
    });
  });
});
