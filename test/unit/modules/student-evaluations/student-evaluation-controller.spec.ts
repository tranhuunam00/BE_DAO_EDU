import { StudentEvaluationController } from '../../../../src/modules/student-evaluations/presentation/controllers/student-evaluation.controller';
import { GetSessionEvaluationsUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/get-session-evaluations.use-case';
import { SaveSessionEvaluationsUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/save-session-evaluations.use-case';
import { GenerateAiEvaluationCommentUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/generate-ai-evaluation-comment.use-case';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role } from '../../../../src/domain/value-objects/role.enum';

describe('StudentEvaluationController - RBAC & Permissions Spec', () => {
  let controller: StudentEvaluationController;
  let mockGetUseCase: jest.Mocked<GetSessionEvaluationsUseCase>;
  let mockSaveUseCase: jest.Mocked<SaveSessionEvaluationsUseCase>;
  let mockGenerateUseCase: jest.Mocked<GenerateAiEvaluationCommentUseCase>;
  let mockSessionRepo: any;
  let mockTeacherRepo: any;
  let mockAttendanceRepo: any;

  beforeEach(() => {
    mockGetUseCase = {
      execute: jest.fn().mockResolvedValue([]),
    } as any;

    mockSaveUseCase = {
      execute: jest.fn().mockResolvedValue({ savedCount: 3 }),
    } as any;

    mockGenerateUseCase = {
      execute: jest.fn().mockResolvedValue({ comment: 'Tốt', isAiGenerated: true }),
      executeBatch: jest.fn().mockResolvedValue([]),
    } as any;

    mockSessionRepo = {
      findOne: jest.fn(),
    };

    mockTeacherRepo = {
      findOne: jest.fn(),
    };

    mockAttendanceRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };

    controller = new StudentEvaluationController(
      mockGetUseCase,
      mockSaveUseCase,
      mockGenerateUseCase,
      mockSessionRepo,
      mockTeacherRepo,
      mockAttendanceRepo,
    );
  });

  describe('1. Quyền của Quản trị viên (ADMIN)', () => {
    it('1.1. ADMIN có toàn quyền vào xem và sửa đánh giá của bất kỳ buổi học nào', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'session-101',
        teacherId: 'teacher-other',
        classEntity: { mainTeacherId: 'teacher-other-2' },
      });

      const adminReq = {
        user: { sub: 'admin-user-uuid', role: Role.ADMIN, roles: [Role.ADMIN] },
      };

      const result = await controller.saveEvaluations(adminReq, 'session-101', {
        evaluations: [
          {
            studentId: 'student-1',
            score: '9.0',
            comment: 'Admin cập nhật đánh giá',
            isApproved: true,
          },
        ],
      });

      expect(mockSaveUseCase.execute).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(mockTeacherRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('2. Quyền của Giáo viên (TEACHER)', () => {
    it('2.1. Giáo viên phụ trách buổi học (teacherId) được phép sửa đánh giá', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'session-201',
        teacherId: 'teacher-huy-id',
        classEntity: { mainTeacherId: 'teacher-other' },
      });
      mockTeacherRepo.findOne.mockResolvedValue({
        id: 'teacher-huy-id',
        userId: 'user-teacher-huy',
      });

      const teacherReq = {
        user: { sub: 'user-teacher-huy', role: Role.TEACHER, roles: [Role.TEACHER] },
      };

      const result = await controller.saveEvaluations(teacherReq, 'session-201', {
        evaluations: [
          {
            studentId: 'student-1',
            criteria: { homework: 'done', understanding: 'quick' },
            isApproved: true,
          },
        ],
      });

      expect(mockSaveUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          classSessionId: 'session-201',
          teacherId: 'teacher-huy-id',
        }),
      );
      expect(result.success).toBe(true);
    });

    it('2.2. Giáo viên chính của lớp (mainTeacherId) được phép sửa đánh giá', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'session-202',
        teacherId: 'substitute-teacher',
        classEntity: { mainTeacherId: 'main-teacher-id' },
      });
      mockTeacherRepo.findOne.mockResolvedValue({
        id: 'main-teacher-id',
        userId: 'user-main-teacher',
      });

      const teacherReq = {
        user: { sub: 'user-main-teacher', role: Role.TEACHER, roles: [Role.TEACHER] },
      };

      const result = await controller.saveEvaluations(teacherReq, 'session-202', {
        evaluations: [],
      });

      expect(result.success).toBe(true);
    });

    it('2.3. Giáo viên KHÔNG phụ trách buổi học bị chặn truy cập (ForbiddenException)', async () => {
      mockSessionRepo.findOne.mockResolvedValue({
        id: 'session-203',
        teacherId: 'teacher-a',
        classEntity: { mainTeacherId: 'teacher-b' },
      });
      mockTeacherRepo.findOne.mockResolvedValue({
        id: 'teacher-c-stranger',
        userId: 'user-c',
      });

      const strangerReq = {
        user: { sub: 'user-c', role: Role.TEACHER, roles: [Role.TEACHER] },
      };

      await expect(
        controller.saveEvaluations(strangerReq, 'session-203', { evaluations: [] }),
      ).rejects.toThrow(
        new ForbiddenException('Bạn không phải giáo viên được phân công giảng dạy cho buổi học này'),
      );
      expect(mockSaveUseCase.execute).not.toHaveBeenCalled();
    });

    it('2.4. Giáo viên không tìm thấy hồ sơ Teacher trong hệ thống bị chặn', async () => {
      mockSessionRepo.findOne.mockResolvedValue({ id: 'session-204' });
      mockTeacherRepo.findOne.mockResolvedValue(null);

      const teacherReq = {
        user: { sub: 'ghost-user', role: Role.TEACHER, roles: [Role.TEACHER] },
      };

      await expect(
        controller.saveEvaluations(teacherReq, 'session-204', { evaluations: [] }),
      ).rejects.toThrow(
        new ForbiddenException('Không tìm thấy thông tin giáo viên của bạn'),
      );
    });
  });

  describe('3. Xử lý trường hợp Buổi học không tồn tại', () => {
    it('3.1. Ném NotFoundException khi sessionId không hợp lệ', async () => {
      mockSessionRepo.findOne.mockResolvedValue(null);
      const req = { user: { sub: 'any-user', role: Role.ADMIN, roles: [Role.ADMIN] } };

      await expect(
        controller.saveEvaluations(req, 'non-existent-session', { evaluations: [] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. Ánh xạ và Bảo toàn 4 tiêu chí đánh giá (Criteria Mapping & Preservation)', () => {
    it('4.1. GET /evaluations ánh xạ đầy đủ 4 tiêu chí từ Domain Entity sang object criteria', async () => {
      mockSessionRepo.findOne.mockResolvedValue({ id: 'session-301' });
      mockGetUseCase.execute.mockResolvedValue([
        {
          id: 'eval-1',
          classSessionId: 'session-301',
          studentId: 'student-301',
          teacherId: 'teacher-1',
          homeworkStatus: 'completed',
          participation: 'active',
          understanding: 'understood',
          behaviorTags: ['attentive'],
          score: '9.5',
          comment: 'Học sinh hiểu bài nhanh',
          isAiGenerated: false,
          isApproved: true,
          approvedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);

      const req = { user: { sub: 'admin-user', role: Role.ADMIN, roles: [Role.ADMIN] } };
      const res = await controller.getEvaluations(req, 'session-301');

      expect(res).toHaveLength(1);
      expect(res[0].criteria).toEqual({
        homework: 'done',
        participation: 'active',
        understanding: 'quick',
        behavior: 'good',
      });
      expect(res[0].comment).toBe('Học sinh hiểu bài nhanh');
    });

    it('4.2. POST /evaluations nhận criteria object và truyền đúng enum vào saveUseCase', async () => {
      mockSessionRepo.findOne.mockResolvedValue({ id: 'session-302' });
      const req = { user: { sub: 'admin-user', role: Role.ADMIN, roles: [Role.ADMIN] } };

      await controller.saveEvaluations(req, 'session-302', {
        evaluations: [
          {
            studentId: 'student-302',
            criteria: {
              homework: 'missing',
              participation: 'passive',
              understanding: 'slow',
              behavior: 'unfocused',
            },
            comment: 'Cần chú ý hơn',
          } as any,
        ],
      });

      expect(mockSaveUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          classSessionId: 'session-302',
          evaluations: [
            expect.objectContaining({
              studentId: 'student-302',
              homeworkStatus: 'not_done',
              participation: 'passive',
              understanding: 'not_understood',
              behaviorTags: ['distracted'],
              comment: 'Cần chú ý hơn',
            }),
          ],
        }),
      );
    });
  });
});
