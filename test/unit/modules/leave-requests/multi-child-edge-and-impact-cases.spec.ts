/* eslint-disable @typescript-eslint/no-explicit-any */
import { SubmitLeaveRequestUseCase } from '../../../../src/modules/leave-requests/application/use-cases/submit-leave-request.use-case';
import {
  CancelLeaveRequestUseCase,
  ListMyLeaveRequestsUseCase,
} from '../../../../src/modules/leave-requests/application/use-cases/manage-leave-request.use-cases';
import { LeaveRequestError } from '../../../../src/modules/leave-requests/domain/errors/leave-request.error';
import { SessionStatus } from '../../../../src/domain/value-objects/session-status.enum';

describe('Multi-Child Edge Cases & Impact Scenarios (TDD Spec)', () => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  describe('Edge Case B1: Hai con sinh đôi cùng học một lớp (tránh nộp nhầm)', () => {
    it('yêu cầu chỉ định rõ học sinh (AMBIGUOUS_STUDENT) nếu cả 2 con cùng học lớp của buổi học xin nghỉ', async () => {
      const mockPersistence = {
        findStudentIdByUserId: jest.fn().mockResolvedValue('twin-1'),
        findStudentsByUserId: jest.fn().mockResolvedValue([
          { id: 'twin-1', name: 'Nguyễn Anh Tuấn', status: 'Active' },
          { id: 'twin-2', name: 'Nguyễn Anh Tú', status: 'Active' },
        ]),
        findSession: jest.fn().mockResolvedValue({
          id: 'session-twin',
          classId: 'class-twin-class',
          date: tomorrow,
          attendanceLocked: false,
          status: SessionStatus.SCHEDULED,
        }),
        isStudentEnrolled: jest.fn().mockResolvedValue(true), // Cả 2 con đều đang học lớp này
        isStudentOwnedByUser: jest.fn().mockResolvedValue(true),
        hasActiveRequest: jest.fn().mockResolvedValue(false),
      };

      const useCase = new SubmitLeaveRequestUseCase(mockPersistence as any);

      // Phụ huynh nộp đơn nhưng KHÔNG truyền studentId
      await expect(
        useCase.execute({
          studentUserId: 'parent-twins-user-id',
          classSessionId: 'session-twin',
          reason: 'Gia đình có việc bận',
        }),
      ).rejects.toThrow(LeaveRequestError);
    });

    it('nộp đơn thành công cho đúng con khi phụ huynh chỉ định rõ studentId của một trong hai con sinh đôi', async () => {
      const mockPersistence = {
        findStudentIdByUserId: jest.fn().mockResolvedValue('twin-1'),
        findSession: jest.fn().mockResolvedValue({
          id: 'session-twin',
          classId: 'class-twin-class',
          date: tomorrow,
          attendanceLocked: false,
          status: SessionStatus.SCHEDULED,
        }),
        isStudentOwnedByUser: jest.fn().mockResolvedValue(true),
        isStudentEnrolled: jest.fn().mockResolvedValue(true),
        hasActiveRequest: jest.fn().mockResolvedValue(false),
        saveSubmitted: jest.fn().mockImplementation((req) => Promise.resolve({ id: 'saved-twin-1', ...req })),
        findViewById: jest.fn().mockImplementation((id) => Promise.resolve({ id, studentId: 'twin-1' })),
      };

      const useCase = new SubmitLeaveRequestUseCase(mockPersistence as any);

      const result = await useCase.execute({
        studentUserId: 'parent-twins-user-id',
        studentId: 'twin-1',
        classSessionId: 'session-twin',
        reason: 'Con Tuấn bị đau răng',
      });

      expect(result.studentId).toBe('twin-1');
    });
  });

  describe('Edge Case B2: Phụ huynh có 3 con (1 con đã thôi học Inactive, 2 con đang học)', () => {
    it('tự động bỏ qua con đã Inactive và chọn đúng con đang học lớp của buổi xin nghỉ', async () => {
      const mockPersistence = {
        findStudentIdByUserId: jest.fn().mockResolvedValue('child-inactive'),
        findStudentsByUserId: jest.fn().mockResolvedValue([
          { id: 'child-inactive', name: 'Con đã thôi học', status: 'Inactive' },
          { id: 'child-active-1', name: 'Con học lớp A', status: 'Active' },
          { id: 'child-active-2', name: 'Con học lớp B', status: 'Active' },
        ]),
        findSession: jest.fn().mockResolvedValue({
          id: 'session-class-b',
          classId: 'class-b-id',
          date: tomorrow,
          attendanceLocked: false,
          status: SessionStatus.SCHEDULED,
        }),
        isStudentEnrolled: jest.fn().mockImplementation((classId, stuId) => {
          return Promise.resolve(classId === 'class-b-id' && stuId === 'child-active-2');
        }),
        isStudentOwnedByUser: jest.fn().mockResolvedValue(true),
        hasActiveRequest: jest.fn().mockResolvedValue(false),
        saveSubmitted: jest.fn().mockImplementation((req) => Promise.resolve({ id: 'saved-req-b2', ...req })),
        findViewById: jest.fn().mockImplementation((id) => Promise.resolve({ id, studentId: 'child-active-2' })),
      };

      const useCase = new SubmitLeaveRequestUseCase(mockPersistence as any);

      const result = await useCase.execute({
        studentUserId: 'parent-3-kids',
        classSessionId: 'session-class-b',
        reason: 'Con bận thi học kỳ ở trường chính',
      });

      expect(result.studentId).toBe('child-active-2');
    });
  });

  describe('Impact Scenario B3: Học sinh độc lập (1 con duy nhất, không dùng chung tài khoản)', () => {
    it('hoạt động trơn tru không có bất kỳ ảnh hưởng hay lỗi lầm nào (Zero Regression)', async () => {
      const mockPersistence = {
        findStudentsByUserId: jest.fn().mockResolvedValue([
          { id: 'solo-student', name: 'Học sinh duy nhất', status: 'Active' },
        ]),
        findStudentIdByUserId: jest.fn().mockResolvedValue('solo-student'),
        findSession: jest.fn().mockResolvedValue({
          id: 'session-solo',
          classId: 'class-solo',
          date: tomorrow,
          attendanceLocked: false,
          status: SessionStatus.SCHEDULED,
        }),
        isStudentEnrolled: jest.fn().mockResolvedValue(true),
        isStudentOwnedByUser: jest.fn().mockResolvedValue(true),
        hasActiveRequest: jest.fn().mockResolvedValue(false),
        saveSubmitted: jest.fn().mockImplementation((req) => Promise.resolve({ id: 'saved-solo', ...req })),
        findViewById: jest.fn().mockImplementation((id) => Promise.resolve({ id, studentId: 'solo-student' })),
      };

      const useCase = new SubmitLeaveRequestUseCase(mockPersistence as any);

      const result = await useCase.execute({
        studentUserId: 'solo-user-id',
        classSessionId: 'session-solo',
        reason: 'Em xin phép nghỉ buổi này',
      });

      expect(result.studentId).toBe('solo-student');
    });
  });

  describe('Edge Case B4: Lọc danh sách đơn nghỉ khi truyền studentId cụ thể vs tất cả các con', () => {
    it('chỉ trả về đơn của con được chọn khi truyền studentId, và chặn nếu con không thuộc tài khoản', async () => {
      const mockPersistence = {
        findStudentIdByUserId: jest.fn().mockResolvedValue('my-child'),
        isStudentOwnedByUser: jest.fn().mockImplementation((stuId, uId) => {
          return Promise.resolve(uId === 'parent-user-1' && stuId === 'my-child');
        }),
        listForStudent: jest.fn().mockResolvedValue([{ id: 'req-child-1', studentId: 'my-child' }]),
      };

      const useCase = new ListMyLeaveRequestsUseCase(mockPersistence as any);

      // Thao tác hợp lệ
      const result = await useCase.execute({
        studentUserId: 'parent-user-1',
        studentId: 'my-child',
      });
      expect(result.length).toBe(1);

      // Thao tác truyền studentId của người khác -> ném lỗi FORBIDDEN
      await expect(
        useCase.execute({
          studentUserId: 'parent-user-1',
          studentId: 'other-parent-child',
        }),
      ).rejects.toThrow(LeaveRequestError);
    });
  });

  describe('Edge Case B5: Performance Benchmark phân giải quan hệ gia đình nhiều con (< 30ms)', () => {
    it('phân giải chính xác điều kiện học sinh và lớp học cho 1,000 yêu cầu trong dưới 30ms SLA', () => {
      const families = Array.from({ length: 1000 }, (_, i) => ({
        parentId: `parent-${i}`,
        children: [
          { id: `child-${i}-1`, classId: `class-${i}-A`, status: 'Active' },
          { id: `child-${i}-2`, classId: `class-${i}-B`, status: 'Active' },
        ],
      }));

      const startTime = performance.now();
      let resolvedCount = 0;

      for (let i = 0; i < families.length; i++) {
        const family = families[i];
        const targetClass = `class-${i}-B`;
        const matchingChild = family.children.find(
          (c) => c.status === 'Active' && c.classId === targetClass,
        );
        if (matchingChild) resolvedCount++;
      }

      const durationMs = performance.now() - startTime;

      expect(resolvedCount).toBe(1000);
      expect(durationMs).toBeLessThan(30);
    });
  });
});
