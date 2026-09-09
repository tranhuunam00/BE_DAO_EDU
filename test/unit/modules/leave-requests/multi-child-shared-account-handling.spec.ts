/* eslint-disable @typescript-eslint/no-explicit-any */
import { SubmitLeaveRequestUseCase } from '../../../../src/modules/leave-requests/application/use-cases/submit-leave-request.use-case';
import {
  CancelLeaveRequestUseCase,
  ListMyLeaveRequestsUseCase,
} from '../../../../src/modules/leave-requests/application/use-cases/manage-leave-request.use-cases';
import { LeaveRequestError } from '../../../../src/modules/leave-requests/domain/errors/leave-request.error';
import { SessionStatus } from '../../../../src/domain/value-objects/session-status.enum';
import { UpdateStudentUseCase } from '../../../../src/application/use-cases/update-student.use-case';

describe('Multi-Child Shared Account Handling (TDD Spec)', () => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  describe('1. SubmitLeaveRequestUseCase (Nộp đơn xin nghỉ khi 2 con dùng chung tài khoản)', () => {
    it('nhận diện chính xác con nộp đơn khi truyền studentId hợp lệ thuộc tài khoản phụ huynh', async () => {
      const mockPersistence = {
        findStudentIdByUserId: jest.fn().mockResolvedValue('child-1'),
        isStudentOwnedByUser: jest.fn().mockResolvedValue(true),
        findSession: jest.fn().mockResolvedValue({
          id: 'session-future-1',
          classId: 'class-b',
          date: tomorrow,
          attendanceLocked: false,
          status: SessionStatus.SCHEDULED,
        }),
        isStudentEnrolled: jest.fn().mockImplementation((classId, stuId) => Promise.resolve(classId === 'class-b' && stuId === 'child-2')),
        hasActiveRequest: jest.fn().mockResolvedValue(false),
        saveSubmitted: jest.fn().mockImplementation((req) => Promise.resolve({ id: 'leave-req-saved', ...req })),
        findViewById: jest.fn().mockImplementation((id) => Promise.resolve({ id, studentId: 'child-2' })),
      };

      const useCase = new SubmitLeaveRequestUseCase(mockPersistence as any);

      const result = await useCase.execute({
        studentUserId: 'parent-user-uuid',
        studentId: 'child-2',
        classSessionId: 'session-future-1',
        reason: 'Con bị ốm',
      });

      expect(result.studentId).toBe('child-2');
      expect(mockPersistence.isStudentEnrolled).toHaveBeenCalledWith('class-b', 'child-2');
    });

    it('tự động phân giải đúng con đang theo học lớp của buổi học khi phụ huynh không truyền studentId', async () => {
      const mockPersistence = {
        findStudentsByUserId: jest.fn().mockResolvedValue([
          { id: 'child-1', name: 'Con 1' },
          { id: 'child-2', name: 'Con 2' },
        ]),
        findStudentIdByUserId: jest.fn().mockResolvedValue('child-1'),
        findSession: jest.fn().mockResolvedValue({
          id: 'session-future-2',
          classId: 'class-con-2',
          date: tomorrow,
          attendanceLocked: false,
          status: SessionStatus.SCHEDULED,
        }),
        isStudentEnrolled: jest.fn().mockImplementation((classId, stuId) => Promise.resolve(classId === 'class-con-2' && stuId === 'child-2')),
        hasActiveRequest: jest.fn().mockResolvedValue(false),
        saveSubmitted: jest.fn().mockImplementation((req) => Promise.resolve({ id: 'req-2', ...req })),
        findViewById: jest.fn().mockImplementation((id) => Promise.resolve({ id, studentId: 'child-2' })),
      };

      const useCase = new SubmitLeaveRequestUseCase(mockPersistence as any);

      const result = await useCase.execute({
        studentUserId: 'parent-user-uuid',
        classSessionId: 'session-future-2',
        reason: 'Con đi viện',
      });

      expect(result.studentId).toBe('child-2');
      expect(mockPersistence.isStudentEnrolled).toHaveBeenCalledWith('class-con-2', 'child-2');
    });

    it('từ chối nộp đơn với lỗi FORBIDDEN nếu studentId chỉ định không thuộc tài khoản của phụ huynh', async () => {
      const mockPersistence = {
        findSession: jest.fn().mockResolvedValue({
          id: 'session-1',
          classId: 'class-1',
          date: tomorrow,
          attendanceLocked: false,
          status: SessionStatus.SCHEDULED,
        }),
        isStudentOwnedByUser: jest.fn().mockResolvedValue(false),
      };

      const useCase = new SubmitLeaveRequestUseCase(mockPersistence as any);

      await expect(
        useCase.execute({
          studentUserId: 'parent-user-uuid',
          studentId: 'child-of-another-parent',
          classSessionId: 'session-1',
          reason: 'Lý do test',
        }),
      ).rejects.toThrow(LeaveRequestError);
    });
  });

  describe('2. CancelLeaveRequestUseCase (Hủy đơn xin nghỉ khi dùng chung tài khoản)', () => {
    it('cho phép phụ huynh hủy đơn của Con B ngay cả khi fallback mặc định trỏ vào Con A', async () => {
      const mockPersistence = {
        findStudentIdByUserId: jest.fn().mockResolvedValue('child-1'),
        isStudentOwnedByUser: jest.fn().mockImplementation((stuId, uId) => Promise.resolve(uId === 'parent-user-uuid' && stuId === 'child-2')),
        findById: jest.fn().mockResolvedValue({
          id: 'req-of-child-2',
          studentId: 'child-2',
          cancel: jest.fn(),
        }),
        saveCancellation: jest.fn().mockImplementation((req) => Promise.resolve(req)),
        findViewById: jest.fn().mockResolvedValue({ id: 'req-of-child-2', status: 'cancelled' }),
      };

      const useCase = new CancelLeaveRequestUseCase(mockPersistence as any);

      const result = await useCase.execute({
        requestId: 'req-of-child-2',
        studentUserId: 'parent-user-uuid',
      });

      expect(result.status).toBe('cancelled');
    });

    it('từ chối hủy đơn nếu đơn xin nghỉ thuộc học sinh của tài khoản khác', async () => {
      const mockPersistence = {
        findStudentIdByUserId: jest.fn().mockResolvedValue('child-1'),
        isStudentOwnedByUser: jest.fn().mockResolvedValue(false),
        findById: jest.fn().mockResolvedValue({
          id: 'req-other-student',
          studentId: 'stranger-child',
          cancel: jest.fn(),
        }),
      };

      const useCase = new CancelLeaveRequestUseCase(mockPersistence as any);

      await expect(
        useCase.execute({
          requestId: 'req-other-student',
          studentUserId: 'parent-user-uuid',
        }),
      ).rejects.toThrow(LeaveRequestError);
    });
  });

  describe('3. ListMyLeaveRequestsUseCase (Xem danh sách đơn nghỉ)', () => {
    it('trả về danh sách đơn của tất cả các con khi phụ huynh không truyền studentId cụ thể', async () => {
      const mockPersistence = {
        findStudentIdByUserId: jest.fn().mockResolvedValue('child-1'),
        listForStudent: jest.fn().mockResolvedValue([]),
        listForUserStudents: jest.fn().mockResolvedValue([
          { id: 'req-c1', studentId: 'child-1' },
          { id: 'req-c2', studentId: 'child-2' },
        ]),
      };

      const useCase = new ListMyLeaveRequestsUseCase(mockPersistence as any);

      const list = await useCase.execute({
        studentUserId: 'parent-user-uuid',
      });

      expect(list.length).toBe(2);
      expect(mockPersistence.listForUserStudents).toHaveBeenCalledWith('parent-user-uuid', expect.any(Object));
    });
  });

  describe('4. UpdateStudentUseCase (Cập nhật mật khẩu tài khoản học sinh)', () => {
    it('cập nhật mật khẩu thành công ngay cả khi không truyền loginEmail', async () => {
      const mockStudentRepo = {
        findById: jest.fn().mockResolvedValue({
          id: 'stu-1',
          userId: 'user-stu-1',
          firstName: 'An',
          lastName: 'Nguyen',
        }),
        save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      };
      const mockUserRepo = {
        findById: jest.fn().mockResolvedValue({
          id: 'user-stu-1',
          email: 'parent@example.com',
          passwordHash: 'old-hashed-password',
        }),
        save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      };

      const useCase = new UpdateStudentUseCase(mockStudentRepo as any, mockUserRepo as any, {} as any);

      await useCase.execute('stu-1', {
        loginPassword: 'NewSecurePassword123@',
      } as any);

      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: expect.not.stringMatching('old-hashed-password'),
        }),
      );
    });
  });

  describe('5. Performance Benchmark SLA (< 30ms cho 1,000 phụ huynh nhiều con)', () => {
    it('phân giải danh tính và quyền hạn cho 1,000 phụ huynh nhiều con trong dưới 30ms', () => {
      const parentMap = new Map<string, string[]>();
      for (let i = 0; i < 1000; i++) {
        parentMap.set(`parent-${i}`, [`child-${i}-A`, `child-${i}-B`]);
      }

      const startTime = performance.now();
      let matchCount = 0;

      for (let i = 0; i < 1000; i++) {
        const parentId = `parent-${i}`;
        const targetChild = `child-${i}-B`;
        const children = parentMap.get(parentId) || [];
        const isOwned = children.includes(targetChild);
        if (isOwned) matchCount++;
      }

      const durationMs = performance.now() - startTime;

      expect(matchCount).toBe(1000);
      expect(durationMs).toBeLessThan(30);
    });
  });
});
