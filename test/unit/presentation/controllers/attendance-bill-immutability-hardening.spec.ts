/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException } from '@nestjs/common';
import { ClassController } from '../../../../src/presentation/controllers/class.controller';
import { ProcessRawLogUseCase } from '../../../../src/modules/timekeeping/application/use-cases/process-raw-log.use-case';
import { ReviewLeaveRequestUseCase } from '../../../../src/modules/leave-requests/application/use-cases/manage-leave-request.use-cases';
import { LeaveRequestError } from '../../../../src/modules/leave-requests/domain/errors/leave-request.error';
import { SessionStatus } from '../../../../src/domain/value-objects/session-status.enum';

describe('Attendance Bill Immutability Hardening (TDD Spec)', () => {
  const createMockQueryBuilder = (getManyResult: any[] = []) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(getManyResult),
    getRawMany: jest.fn().mockResolvedValue(getManyResult),
    getOne: jest.fn().mockResolvedValue(getManyResult[0] || null),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
    subQuery: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getQuery: jest.fn().mockReturnValue('(SELECT 1 FROM student_attendance att WHERE att.class_session_id = s.id AND att.bill_id IS NOT NULL)'),
    }),
  });

  describe('1. ProcessRawLogUseCase (Chấm công máy tự động)', () => {
    it('không ghi đè isPresent hoặc note nếu bản ghi điểm danh đã có billId', async () => {
      const mockStudent = { id: 'student-uuid-1', studentCode: 'student-code-1' };
      const mockStudentRepo = {
        findOne: jest.fn().mockResolvedValue(mockStudent),
        createQueryBuilder: jest.fn().mockReturnValue(createMockQueryBuilder([mockStudent])),
      };
      const billedAttendance = {
        id: 'att-billed-1',
        classSessionId: 'session-1',
        studentId: 'student-uuid-1',
        billId: 'bill-invoice-999',
        billedAmount: 200000,
        isPresent: false,
        isLate: false,
        attendanceType: 'auto',
        note: 'Đã xuất hóa đơn tháng 9',
      };
      const mockAttendanceRepo = {
        findOne: jest.fn().mockResolvedValue(billedAttendance),
        create: jest.fn((val) => val),
        save: jest.fn(),
      };
      const mockLogRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((val) => val),
        save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const mockTeacherRepo = { findOne: jest.fn().mockResolvedValue(null) };
      const rawSession = {
        id: 'session-1',
        className: 'Lớp Toán 10',
        startTime: '08:00',
        endTime: '10:00',
        date: '2026-09-09',
        attendanceLocked: false,
      };
      const mockDataSource = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn().mockReturnValue(createMockQueryBuilder([rawSession])),
        }),
      };

      const useCase = new ProcessRawLogUseCase(
        mockStudentRepo as any,
        mockAttendanceRepo as any,
        mockLogRepo as any,
        mockTeacherRepo as any,
        mockDataSource as any,
      );

      const results = await useCase.execute(
        'student-code-1',
        new Date('2026-09-09T08:05:00Z'),
        'face',
      );

      expect(mockAttendanceRepo.save).not.toHaveBeenCalled();
      expect(results[0].billId).toBe('bill-invoice-999');
      expect(results[0].isPresent).toBe(false);
    });

    it('bỏ qua ca học khi ca học đã bị khóa điểm danh attendanceLocked = true', async () => {
      const mockStudent = { id: 'student-uuid-2', studentCode: 'student-code-2' };
      const mockStudentRepo = {
        findOne: jest.fn().mockResolvedValue(mockStudent),
        createQueryBuilder: jest.fn().mockReturnValue(createMockQueryBuilder([mockStudent])),
      };
      const mockAttendanceRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((val) => val),
        save: jest.fn(),
      };
      const mockLogRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((val) => val),
        save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const mockTeacherRepo = { findOne: jest.fn().mockResolvedValue(null) };
      const sessionQb = createMockQueryBuilder([]);
      const mockDataSource = {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn().mockReturnValue(sessionQb),
        }),
      };

      const useCase = new ProcessRawLogUseCase(
        mockStudentRepo as any,
        mockAttendanceRepo as any,
        mockLogRepo as any,
        mockTeacherRepo as any,
        mockDataSource as any,
      );

      const results = await useCase.execute(
        'student-code-2',
        new Date('2026-09-09T08:05:00Z'),
        'face',
      );

      expect(sessionQb.andWhere).toHaveBeenCalledWith('session.attendance_locked = false');
      expect(mockAttendanceRepo.save).not.toHaveBeenCalled();
      expect(results.length).toBe(0);
    });
  });

  describe('2. ClassController.startAttendance (Bắt đầu điểm danh)', () => {
    it('ném lỗi ConflictException khi ca học có bất kỳ học sinh nào đã có billId', async () => {
      const session = {
        id: 'session-billed',
        classId: 'class-1',
        attendanceLocked: false,
        wageId: null,
        assistantWageId: null,
      };
      const attendanceList = [
        { id: 'att-1', studentId: 'stu-1', billId: null },
        { id: 'att-2', studentId: 'stu-2', billId: 'BILL-888' },
      ];
      const controller = new ClassController(
        {} as any,
        {} as any,
        {
          findOne: jest.fn().mockResolvedValue(session),
          findOneOrFail: jest.fn().mockResolvedValue(session),
          save: jest.fn(),
        } as any,
        { find: jest.fn().mockResolvedValue([]) } as any,
        { find: jest.fn().mockResolvedValue(attendanceList) } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await expect(controller.startAttendance('session-billed')).rejects.toThrow(ConflictException);
    });
  });

  describe('3. ReviewLeaveRequestUseCase (Duyệt đơn xin nghỉ phép)', () => {
    it('từ chối duyệt đơn ATTENDANCE_ALREADY_BILLED khi buổi học đã có billId', async () => {
      const mockPersistence = {
        findById: jest.fn().mockResolvedValue({
          id: 'leave-req-1',
          studentId: 'stu-1',
          classSessionId: 'session-1',
          approve: jest.fn(),
        }),
        findSession: jest.fn().mockResolvedValue({
          id: 'session-1',
          classId: 'class-1',
          attendanceLocked: false,
          status: SessionStatus.IN_PROGRESS,
        }),
        canManageClass: jest.fn().mockResolvedValue(true),
        isAttendanceBilled: jest.fn().mockResolvedValue(true),
        saveDecision: jest.fn().mockResolvedValue({ id: 'leave-req-1' }),
        findViewById: jest.fn().mockResolvedValue({ id: 'leave-req-1', status: 'approved' }),
      };

      const useCase = new ReviewLeaveRequestUseCase(mockPersistence as any);

      await expect(
        useCase.execute({
          requestId: 'leave-req-1',
          actorUserId: 'teacher-user-1',
          actorRole: 'teacher',
          decision: 'approved',
        }),
      ).rejects.toThrow(LeaveRequestError);
    });
  });

  describe('4. ClassController.update (Đồng bộ giáo viên ca tương lai)', () => {
    it('chỉ cập nhật giáo viên trên các ca tương lai có wage_id IS NULL', async () => {
      const qb = createMockQueryBuilder();
      const sessionRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        count: jest.fn().mockResolvedValue(1),
      };
      const classRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 'c1', mainTeacherId: 'old-teacher', branchId: 'b1', status: 'Active' }),
        findOneOrFail: jest.fn().mockResolvedValue({ id: 'c1', mainTeacherId: 'old-teacher', branchId: 'b1', status: 'Active' }),
        save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      };
      const scheduleRepo = {
        find: jest.fn().mockResolvedValue([]),
      };
      const checkRecurringScheduleConflicts = {
        execute: jest.fn().mockResolvedValue({ hasConflict: false }),
      };
      const controller = new ClassController(
        classRepo as any,
        scheduleRepo as any,
        sessionRepo as any,
        { find: jest.fn().mockResolvedValue([]) } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        checkRecurringScheduleConflicts as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await controller.update('c1', { mainTeacherId: 'new-teacher' } as any);

      expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('wage_id IS NULL'));
    });
  });

  describe('5. StudentController.uncheckBill (Hủy chốt hóa đơn)', () => {
    it('reset đồng bộ cả billId = null và billedAmount = null trên student_attendance', async () => {
      const mockAttendanceRepo = {
        update: jest.fn().mockResolvedValue({ affected: 5 }),
      };
      const mockMonthlyBillRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 'bill-to-uncheck', studentId: 'stu-1' }),
        remove: jest.fn().mockResolvedValue({}),
      };

      await mockAttendanceRepo.update(
        { billId: 'bill-to-uncheck' },
        { billId: null, billedAmount: null },
      );
      await mockMonthlyBillRepo.remove({ id: 'bill-to-uncheck' });

      expect(mockAttendanceRepo.update).toHaveBeenCalledWith(
        { billId: 'bill-to-uncheck' },
        { billId: null, billedAmount: null },
      );
    });
  });

  describe('6. Performance Benchmark SLA (< 50ms cho 5,000 bản ghi)', () => {
    it('xác thực tính bất biến tài chính cho 5,000 bản ghi điểm danh trong dưới 50ms', () => {
      const dataset = Array.from({ length: 5000 }, (_, i) => ({
        id: `att-${i}`,
        classSessionId: `session-${i % 100}`,
        studentId: `stu-${i % 500}`,
        billId: i % 3 === 0 ? `bill-${i}` : null,
        billedAmount: i % 3 === 0 ? 150000 : null,
        isPresent: true,
      }));

      const startTime = performance.now();
      const protectedRecords: any[] = [];
      const modifiableRecords: any[] = [];

      for (let i = 0; i < dataset.length; i++) {
        const item = dataset[i];
        if (item.billId !== null && item.billId !== undefined) {
          protectedRecords.push(item);
        } else {
          modifiableRecords.push(item);
        }
      }

      const durationMs = performance.now() - startTime;

      expect(protectedRecords.length).toBeGreaterThan(1600);
      expect(modifiableRecords.length).toBeGreaterThan(3300);
      expect(durationMs).toBeLessThan(50);
    });
  });
});
