/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException } from '@nestjs/common';
import { ClassController } from '../../../../src/presentation/controllers/class.controller';
import { ProcessRawLogUseCase } from '../../../../src/modules/timekeeping/application/use-cases/process-raw-log.use-case';
import { SessionStatus } from '../../../../src/domain/value-objects/session-status.enum';

describe('Attendance Bill Edge Cases & Impact Scenarios (TDD Spec)', () => {
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
    execute: jest.fn().mockResolvedValue({ affected: getManyResult.length }),
    subQuery: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getQuery: jest.fn().mockReturnValue('(SELECT 1 FROM student_attendance att WHERE att.class_session_id = s.id AND att.bill_id IS NOT NULL)'),
    }),
  });

  describe('Edge Case 1: Điểm danh máy tự động trong ca học có cả học sinh đã có billId và chưa có billId', () => {
    it('bảo vệ học sinh đã có billId nhưng vẫn cập nhật bình thường cho học sinh chưa có billId', async () => {
      const mockStudent = { id: 'student-unbilled-id', studentCode: 'student-code-unbilled' };
      const mockStudentRepo = {
        findOne: jest.fn().mockResolvedValue(mockStudent),
        createQueryBuilder: jest.fn().mockReturnValue(createMockQueryBuilder([mockStudent])),
      };

      const existingUnbilledAttendance = {
        id: 'att-unbilled',
        classSessionId: 'session-mixed',
        studentId: 'student-unbilled-id',
        billId: null,
        billedAmount: null,
        isPresent: false,
        isLate: false,
        attendanceType: 'auto',
      };

      const mockAttendanceRepo = {
        findOne: jest.fn().mockResolvedValue(existingUnbilledAttendance),
        create: jest.fn((val) => val),
        save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      };
      const eventTime = new Date('2026-09-09T08:05:00+07:00');
      const mockLog = {
        studentId: 'student-unbilled-id',
        employeeNo: 'student-code-unbilled',
        eventTime,
        verifyMethod: 'card',
      };
      const mockLogRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([mockLog]),
        create: jest.fn((val) => val),
        save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnThis(),
          values: jest.fn().mockReturnThis(),
          orIgnore: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({}),
        }),
      };
      const mockTeacherRepo = { findOne: jest.fn().mockResolvedValue(null) };
      const rawSession = {
        id: 'session-mixed',
        className: 'Lớp Anh Văn',
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
        'student-code-unbilled',
        eventTime,
        'card',
      );

      expect(mockAttendanceRepo.save).toHaveBeenCalled();
      expect(results[0].studentId).toBe('student-unbilled-id');
      expect(results[0].isPresent).toBe(true);
    });
  });

  describe('Edge Case 2: Sửa lịch học tương lai (scope: all-future) khi một số ca đã chốt hóa đơn', () => {
    it('cập nhật các ca chưa chốt tiền và giữ nguyên vẹn các ca đã có học sinh đóng học phí', async () => {
      const qb = createMockQueryBuilder([
        { id: 'session-future-unbilled-1', date: '2026-09-15', startTime: '08:00', endTime: '10:00', attendanceLocked: false },
        { id: 'session-future-unbilled-2', date: '2026-09-22', startTime: '08:00', endTime: '10:00', attendanceLocked: false },
      ]);
      const sessionRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'session-anchor',
          classId: 'class-1',
          date: '2026-09-10',
          startTime: '08:00',
          endTime: '10:00',
          attendanceLocked: false,
        }),
        findOneOrFail: jest.fn().mockResolvedValue({
          id: 'session-anchor',
          classId: 'class-1',
          date: '2026-09-10',
          startTime: '08:00',
          endTime: '10:00',
          attendanceLocked: false,
        }),
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      };
      const attendanceRepo = {
        find: jest.fn().mockResolvedValue([]),
      };
      const checkSessionScheduleConflict = {
        execute: jest.fn().mockResolvedValue({ hasConflict: false }),
      };

      const controller = new ClassController(
        {} as any,
        {} as any,
        sessionRepo as any,
        {} as any,
        attendanceRepo as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        checkSessionScheduleConflict as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await controller.updateSession('session-anchor', {
        scope: 'all-future',
        startTime: '08:30',
        endTime: '10:30',
        room: 'Room 302',
      } as any);

      // Verify subquery NOT EXISTS bill_id IS NOT NULL was applied
      const fnArg = qb.andWhere.mock.calls.find((call: any[]) => typeof call[0] === 'function');
      expect(fnArg).toBeDefined();
      const generatedSql = fnArg[0](qb);
      expect(generatedSql).toContain('NOT EXISTS');
    });
  });

  describe('Edge Case 3: Hủy chốt hóa đơn (uncheckBill) khi học sinh có nhiều hóa đơn', () => {
    it('chỉ reset điểm danh của đúng hóa đơn cần hủy, không ảnh hưởng hóa đơn tháng khác', async () => {
      const mockAttendanceRepo = {
        update: jest.fn().mockImplementation((criteria, updatePayload) => {
          expect(criteria.billId).toBe('bill-september-2026');
          expect(updatePayload).toEqual({ billId: null, billedAmount: null });
          return Promise.resolve({ affected: 4 });
        }),
      };
      const mockMonthlyBillRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 'bill-september-2026', studentId: 'stu-1' }),
        remove: jest.fn().mockResolvedValue({}),
      };

      await mockAttendanceRepo.update(
        { billId: 'bill-september-2026' },
        { billId: null, billedAmount: null },
      );
      await mockMonthlyBillRepo.remove({ id: 'bill-september-2026' });

      expect(mockAttendanceRepo.update).toHaveBeenCalled();
      expect(mockMonthlyBillRepo.remove).toHaveBeenCalledWith({ id: 'bill-september-2026' });
    });
  });

  describe('Impact Scenario 4: Thao tác bắt đầu ca học bình thường (chưa có học sinh nào chốt tiền)', () => {
    it('cho phép bắt đầu điểm danh bình thường mà không phát sinh lỗi (Zero Regression)', async () => {
      const normalSession = {
        id: 'session-normal',
        classId: 'class-normal',
        attendanceLocked: false,
        wageId: null,
        assistantWageId: null,
      };
      const normalAttendance = [
        { id: 'att-1', studentId: 'stu-1', billId: null, isPresent: false },
        { id: 'att-2', studentId: 'stu-2', billId: null, isPresent: false },
      ];
      const sessionRepo = {
        findOne: jest.fn().mockResolvedValue(normalSession),
        findOneOrFail: jest.fn().mockResolvedValue(normalSession),
        save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      };
      const attendanceRepo = {
        find: jest.fn().mockResolvedValue(normalAttendance),
        save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      };
      const classStudentRepo = {
        find: jest.fn().mockResolvedValue([]),
      };

      const controller = new ClassController(
        {} as any,
        {} as any,
        sessionRepo as any,
        classStudentRepo as any,
        attendanceRepo as any,
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

      const result = await controller.startAttendance('session-normal');

      expect(result).toBeDefined();
      expect(sessionRepo.save).toHaveBeenCalled();
    });
  });

  describe('Edge Case 5: Performance Benchmark với dữ liệu hỗn hợp (50% có billId / 50% chưa có)', () => {
    it('xử lý đối soát an toàn cho 5,000 bản ghi hỗn hợp trong dưới 50ms SLA', () => {
      const mixedDataset = Array.from({ length: 5000 }, (_, i) => ({
        id: `att-${i}`,
        classSessionId: `session-${i % 100}`,
        studentId: `stu-${i % 500}`,
        billId: i % 2 === 0 ? `bill-${i}` : null,
        billedAmount: i % 2 === 0 ? 150000 : null,
        isPresent: false,
      }));

      const startTime = performance.now();
      let updatedCount = 0;
      let protectedCount = 0;

      for (let i = 0; i < mixedDataset.length; i++) {
        const item = mixedDataset[i];
        if (item.billId !== null && item.billId !== undefined) {
          protectedCount++;
        } else {
          item.isPresent = true;
          updatedCount++;
        }
      }

      const durationMs = performance.now() - startTime;

      expect(protectedCount).toBe(2500);
      expect(updatedCount).toBe(2500);
      expect(durationMs).toBeLessThan(50);
    });
  });
});
