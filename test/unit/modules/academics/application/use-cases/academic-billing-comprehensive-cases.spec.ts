/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CalculateStudentTuitionUseCase } from '../../../../../../src/modules/billing/application/use-cases/calculate-student-tuition.use-case';
import { CalculateTeacherWageUseCase } from '../../../../../../src/modules/billing/application/use-cases/calculate-teacher-wage.use-case';
import { ClassController } from '../../../../../../src/presentation/controllers/class.controller';
import { SessionStatus } from '../../../../../../src/domain/value-objects/session-status.enum';
import { StudentAttendanceOrmEntity } from '../../../../../../src/infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';

describe('Comprehensive Academic & Billing System Test Suite', () => {

  // ════════════════════════════════════════════════════════════════════════════
  // 1. TÍNH TIỀN HỌC & THAY ĐỔI TIỀN TRONG LEVEL (Student Tuition & Level Pricing)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Tính tiền học — Điểm danh, Billed Status & Thay đổi giá Level', () => {
    it('1.1 Tính đúng tiền học khi có buổi tham gia, vắng có phép, vắng không phép', async () => {
      const mockPersistence = {
        getTuitionCalculationData: jest.fn().mockResolvedValue({
          sessions: [
            {
              id: 'sess-1',
              date: '2026-06-01',
              classId: 'class-eng-1',
              classCode: 'ENG101',
              className: 'English 101',
              courseLevelId: 'level-a1',
              isPresent: true,
              reason: null,
              isEnrolled: true,
            },
            {
              id: 'sess-2',
              date: '2026-06-05',
              classId: 'class-eng-1',
              classCode: 'ENG101',
              className: 'English 101',
              courseLevelId: 'level-a1',
              isPresent: false,
              reason: null, // Vắng không phép -> Tính tiền
              isEnrolled: true,
            },
            {
              id: 'sess-3',
              date: '2026-06-10',
              classId: 'class-eng-1',
              classCode: 'ENG101',
              className: 'English 101',
              courseLevelId: 'level-a1',
              isPresent: false,
              reason: 'Ốm có xin phép', // Vắng có phép -> Không tính tiền
              isEnrolled: true,
            },
          ],
          pricingList: [
            {
              courseLevelId: 'level-a1',
              pricePerSession: 150000,
              effectiveFrom: '2026-01-01',
              effectiveTo: null,
            },
          ],
          billingItems: [],
        }),
      };

      const useCase = new CalculateStudentTuitionUseCase(mockPersistence as any);
      const { summaries } = await useCase.execute({ studentId: 'student-1' });

      expect(summaries).toHaveLength(1);
      const summary = summaries[0];
      expect(summary.totalSessions).toBe(3);
      expect(summary.presentSessionsCount).toBe(1);
      expect(summary.absentSessionsCount).toBe(2);

      const s1 = summary.sessions.find((s) => s.sessionId === 'sess-1')!;
      const s2 = summary.sessions.find((s) => s.sessionId === 'sess-2')!;
      const s3 = summary.sessions.find((s) => s.sessionId === 'sess-3')!;

      expect(s1.isBilled).toBe(true);
      expect(s1.amount).toBe(150000);

      expect(s2.isBilled).toBe(true);
      expect(s2.amount).toBe(150000);

      expect(s3.isBilled).toBe(false);
      expect(s3.amount).toBe(0);

      // Total tuition: 150k + 150k + 0 = 300k
      expect(summary.totalTuitionAmount).toBe(300000);
    });

    it('1.2 Áp dụng đúng đơn giá Level khi có thay đổi tiền trong level theo khoảng thời gian effectiveFrom / effectiveTo', async () => {
      const mockPersistence = {
        getTuitionCalculationData: jest.fn().mockResolvedValue({
          sessions: [
            {
              id: 'sess-june',
              date: '2026-06-20',
              classId: 'class-math',
              classCode: 'MATH201',
              className: 'Math 201',
              courseLevelId: 'level-m2',
              isPresent: true,
              reason: null,
              isEnrolled: true,
            },
            {
              id: 'sess-july',
              date: '2026-07-05',
              classId: 'class-math',
              classCode: 'MATH201',
              className: 'Math 201',
              courseLevelId: 'level-m2',
              isPresent: true,
              reason: null,
              isEnrolled: true,
            },
          ],
          pricingList: [
            {
              courseLevelId: 'level-m2',
              pricePerSession: 200000,
              effectiveFrom: '2026-01-01',
              effectiveTo: '2026-06-30', // Tháng 6 đơn giá 200k
            },
            {
              courseLevelId: 'level-m2',
              pricePerSession: 250000,
              effectiveFrom: '2026-07-01',
              effectiveTo: null, // Tháng 7 tăng lên 250k
            },
          ],
          billingItems: [],
        }),
      };

      const useCase = new CalculateStudentTuitionUseCase(mockPersistence as any);
      const { summaries } = await useCase.execute({ studentId: 'student-1' });

      const summary = summaries[0];
      const juneSess = summary.sessions.find((s) => s.sessionId === 'sess-june')!;
      const julySess = summary.sessions.find((s) => s.sessionId === 'sess-july')!;

      expect(juneSess.rate).toBe(200000);
      expect(juneSess.amount).toBe(200000);

      expect(julySess.rate).toBe(250000);
      expect(julySess.amount).toBe(250000);

      expect(summary.totalTuitionAmount).toBe(450000);
    });

    it('1.3 Đã được chốt hóa đơn thì giữ nguyên đơn giá billedInfo bất kể thay đổi bảng giá level sau đó', async () => {
      const mockPersistence = {
        getTuitionCalculationData: jest.fn().mockResolvedValue({
          sessions: [
            {
              id: 'sess-billed',
              date: '2026-06-15',
              classId: 'class-math',
              classCode: 'MATH201',
              className: 'Math 201',
              courseLevelId: 'level-m2',
              isPresent: true,
              reason: null,
              isEnrolled: true,
            },
          ],
          pricingList: [
            {
              courseLevelId: 'level-m2',
              pricePerSession: 300000, // Giá mới cập nhật sau
              effectiveFrom: '2026-01-01',
              effectiveTo: null,
            },
          ],
          billingItems: [
            {
              classId: 'class-math',
              studentId: 'student-1',
              month: '2026-06',
              rate: 180000, // Giá ưu đãi đã được ghi trong hóa đơn tháng 6
              paymentStatus: 'Paid',
            },
          ],
        }),
      };

      const useCase = new CalculateStudentTuitionUseCase(mockPersistence as any);
      const { summaries } = await useCase.execute({ studentId: 'student-1' });

      const summary = summaries[0];
      const sess = summary.sessions[0];
      expect(sess.rate).toBe(180000); // Ưu tiên giữ giá billed rate
      expect(sess.amount).toBe(180000);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. TÍNH TIỀN GIÁO VIÊN & TRỢ GIẢNG (Teacher & TA Wage Calculation)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Tính tiền giáo viên — Vai trò Giáo viên chính & Trợ giảng', () => {
    it('2.1 Tính đúng thù lao giáo viên chính và trợ giảng theo bảng giá level', async () => {
      const mockPersistence = {
        getTeacherWageCalculationData: jest.fn().mockResolvedValue({
          sessions: [
            {
              id: 'sess-as-main',
              date: '2026-06-10',
              classId: 'class-1',
              classCode: 'C1',
              className: 'Class 1',
              courseLevelId: 'level-1',
              teacherId: 'teacher-x', // Vai trò Giáo viên chính
              assistantId: 'teacher-y',
            },
            {
              id: 'sess-as-assistant',
              date: '2026-06-12',
              classId: 'class-2',
              classCode: 'C2',
              className: 'Class 2',
              courseLevelId: 'level-1',
              teacherId: 'teacher-z',
              assistantId: 'teacher-x', // Vai trò Trợ giảng
            },
          ],
          pricingList: [
            {
              courseLevelId: 'level-1',
              teacherWagePerSession: 300000,
              taWagePerSession: 150000,
              effectiveFrom: '2026-01-01',
              effectiveTo: null,
            },
          ],
          wageItems: [],
        }),
      };

      const useCase = new CalculateTeacherWageUseCase(mockPersistence as any);
      const { summaries } = await useCase.execute({ teacherId: 'teacher-x' });

      expect(summaries).toHaveLength(2);
      const sum1 = summaries.find((s) => s.classId === 'class-1')!;
      const sum2 = summaries.find((s) => s.classId === 'class-2')!;

      expect(sum1.sessions[0].role).toBe('teacher');
      expect(sum1.sessions[0].rate).toBe(300000);
      expect(sum1.sessions[0].amount).toBe(300000);

      expect(sum2.sessions[0].role).toBe('assistant');
      expect(sum2.sessions[0].rate).toBe(150000);
      expect(sum2.sessions[0].amount).toBe(150000);
    });

    it('2.2 Áp dụng đè lương thỏa thuận riêng (wageItems) cho giáo viên trong tháng', async () => {
      const mockPersistence = {
        getTeacherWageCalculationData: jest.fn().mockResolvedValue({
          sessions: [
            {
              id: 'sess-1',
              date: '2026-06-10',
              classId: 'class-1',
              classCode: 'C1',
              className: 'Class 1',
              courseLevelId: 'level-1',
              teacherId: 'teacher-x',
              assistantId: null,
            },
          ],
          pricingList: [
            {
              courseLevelId: 'level-1',
              teacherWagePerSession: 300000,
              taWagePerSession: 150000,
              effectiveFrom: '2026-01-01',
              effectiveTo: null,
            },
          ],
          wageItems: [
            {
              classId: 'class-1',
              teacherId: 'teacher-x',
              month: '2026-06',
              rate: 400000, // Đã thỏa thuận override 400k/buổi
            },
          ],
        }),
      };

      const useCase = new CalculateTeacherWageUseCase(mockPersistence as any);
      const { summaries } = await useCase.execute({ teacherId: 'teacher-x' });

      const sum = summaries[0];
      expect(sum.sessions[0].rate).toBe(400000);
      expect(sum.sessions[0].amount).toBe(400000);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. THÊM & BỎ HỌC SINH GIỮA KHÓA (Mid-course Join & Drop)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Thêm & Bỏ học sinh giữa khóa (Mid-course Enrollment Handling)', () => {
    it('3.1 Học sinh vào giữa khóa (joinedDate) không bị tính tiền cho các buổi trước ngày joinedDate', async () => {
      const mockPersistence = {
        getTuitionCalculationData: jest.fn().mockResolvedValue({
          sessions: [
            {
              id: 'sess-before-join',
              date: '2026-06-01',
              classId: 'class-1',
              classCode: 'C1',
              className: 'Class 1',
              courseLevelId: 'level-1',
              isPresent: false,
              reason: null,
              isEnrolled: false, // Trước ngày gia nhập -> Chưa tham gia
            },
            {
              id: 'sess-after-join',
              date: '2026-06-20',
              classId: 'class-1',
              classCode: 'C1',
              className: 'Class 1',
              courseLevelId: 'level-1',
              isPresent: true,
              reason: null,
              isEnrolled: true, // Đã gia nhập
            },
          ],
          pricingList: [
            {
              courseLevelId: 'level-1',
              pricePerSession: 200000,
              effectiveFrom: '2026-01-01',
              effectiveTo: null,
            },
          ],
          billingItems: [],
        }),
      };

      const useCase = new CalculateStudentTuitionUseCase(mockPersistence as any);
      const { summaries } = await useCase.execute({ studentId: 'student-mid' });

      const summary = summaries[0];
      const sBefore = summary.sessions.find((s) => s.sessionId === 'sess-before-join')!;
      const sAfter = summary.sessions.find((s) => s.sessionId === 'sess-after-join')!;

      expect(sBefore.isBilled).toBe(false);
      expect(sBefore.amount).toBe(0);

      expect(sAfter.isBilled).toBe(true);
      expect(sAfter.amount).toBe(200000);
      expect(summary.totalTuitionAmount).toBe(200000);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. BẮT BUỘC: KHÔNG CHO SỬA CÁC BUỔI ĐÃ ĐƯỢC TÍNH TIỀN (Protect Billed Sessions)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Quy tắc bắt buộc — Không cho phép chỉnh sửa buổi học / điểm danh đã tính tiền', () => {
    const makeController = (attendanceRecords: any[]) => {
      const repos = {
        sessionRepo: {
          findOneOrFail: jest.fn().mockResolvedValue({
            id: 'sess-billed-1',
            classId: 'class-1',
            status: SessionStatus.COMPLETED,
            attendanceLocked: true,
            date: '2026-06-15',
            startTime: '08:00',
            endTime: '10:00',
          }),
        },
        attendanceRepo: {
          find: jest.fn().mockResolvedValue(attendanceRecords),
          findOne: jest.fn(),
          save: jest.fn(),
        },
        classRepo: { findOneOrFail: jest.fn(), findOne: jest.fn() },
        scheduleRepo: { find: jest.fn() },
        classStudentRepo: { find: jest.fn() },
        courseRepo: { findOne: jest.fn() },
        studentRepo: { findOne: jest.fn() },
        teacherRepo: { findOne: jest.fn() },
        assignmentRepo: { createQueryBuilder: jest.fn() },
        notificationRepo: { create: jest.fn(), save: jest.fn() },
        dataSource: { transaction: jest.fn() },
      };

      const ctrl = new ClassController(
        repos.classRepo as any,
        repos.scheduleRepo as any,
        repos.sessionRepo as any,
        repos.classStudentRepo as any,
        repos.attendanceRepo as any,
        repos.courseRepo as any,
        repos.studentRepo as any,
        repos.teacherRepo as any,
        repos.assignmentRepo as any,
        repos.notificationRepo as any,
        { execute: jest.fn().mockResolvedValue([]) } as any,
        { execute: jest.fn().mockResolvedValue(undefined) } as any,
        { execute: jest.fn().mockResolvedValue(undefined) } as any,
        { execute: jest.fn() } as any,
        { execute: jest.fn().mockResolvedValue(undefined) } as any,
        repos.dataSource as any,
      );

      return { ctrl, repos };
    };

    it('4.1 [overrideAttendance] Ném ra ConflictException khi Admin cố tình ghi đè điểm danh của buổi học đã có billId', async () => {
      const billedAttendance = [
        { id: 'att-1', studentId: 'stud-1', isPresent: true, billId: 'bill-june-001' },
      ];
      const { ctrl } = makeController(billedAttendance);

      await expect(
        ctrl.overrideAttendance('sess-billed-1', {
          attendance: [{ studentId: 'stud-1', isPresent: false }],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('4.2 [saveAttendance] Ném ra ConflictException khi lưu điểm danh cho buổi đã có bản ghi billId', async () => {
      const billedAttendance = [
        { id: 'att-1', studentId: 'stud-1', isPresent: true, billId: 'bill-june-001' },
      ];
      const { ctrl } = makeController(billedAttendance);

      await expect(
        ctrl.saveAttendance({ user: { role: 'ADMIN' } }, 'sess-billed-1', {
          attendance: [{ studentId: 'stud-1', isPresent: false }],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('4.3 [updateSession] Ném ra ConflictException khi chỉnh sửa thông tin buổi học (thời gian, phòng...) đã có bản ghi billId', async () => {
      const billedAttendance = [
        { id: 'att-1', studentId: 'stud-1', isPresent: true, billId: 'bill-june-001' },
      ];
      const { ctrl } = makeController(billedAttendance);

      await expect(
        ctrl.updateSession('sess-billed-1', { startTime: '09:00', endTime: '11:00' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. GEN LẠI BUỔI HỌC (2 trường hợp: từ ngày khai giảng & từ hôm nay)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Sinh lại buổi học — Gen từ Ngày khai giảng vs Gen từ Ngày hôm nay', () => {
    const makeGenController = () => {
      const deleteQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };

      const repos = {
        classRepo: {
          findOneOrFail: jest.fn().mockResolvedValue({
            id: 'class-gen-1',
            status: 'Active',
            startDate: '2026-06-01',
            finishDate: '2026-08-31',
            mainTeacherId: 'teacher-1',
            assistantId: null,
            skipHolidays: false,
          }),
        },
        scheduleRepo: {
          find: jest.fn().mockResolvedValue([
            { weekday: 'Mon', startTime: '08:00', endTime: '10:00', roomId: 'r1' },
          ]),
        },
        sessionRepo: {
          createQueryBuilder: jest.fn(() => ({
            delete: jest.fn().mockReturnValue(deleteQB),
          })),
          find: jest.fn().mockResolvedValue([]),
        },
        classStudentRepo: { find: jest.fn().mockResolvedValue([]) },
        attendanceRepo: { find: jest.fn().mockResolvedValue([]) },
        courseRepo: { findOne: jest.fn() },
        studentRepo: { findOne: jest.fn() },
        teacherRepo: { findOne: jest.fn() },
        assignmentRepo: { createQueryBuilder: jest.fn() },
        notificationRepo: { create: jest.fn(), save: jest.fn() },
        dataSource: {
          transaction: jest.fn(async (cb: any) => cb({ save: jest.fn(), create: jest.fn() })),
        },
      };

      const ctrl = new ClassController(
        repos.classRepo as any,
        repos.scheduleRepo as any,
        repos.sessionRepo as any,
        repos.classStudentRepo as any,
        repos.attendanceRepo as any,
        repos.courseRepo as any,
        repos.studentRepo as any,
        repos.teacherRepo as any,
        repos.assignmentRepo as any,
        repos.notificationRepo as any,
        { execute: jest.fn().mockResolvedValue([]) } as any,
        { execute: jest.fn().mockResolvedValue(undefined) } as any,
        { execute: jest.fn().mockResolvedValue(undefined) } as any,
        { execute: jest.fn() } as any,
        { execute: jest.fn().mockResolvedValue(undefined) } as any,
        repos.dataSource as any,
      );

      return { ctrl, repos, deleteQB };
    };

    it('5.1 TH1: fromStartDate = true (Ấn gen từ Ngày Khai Giảng) -> Xóa và sinh lại từ ngày class.startDate', async () => {
      const { ctrl, deleteQB } = makeGenController();
      const generateSpy = jest.spyOn(ctrl as any, 'generateSessions').mockResolvedValue(undefined);

      await ctrl.generateSessionsEndpoint('class-gen-1', 'true');

      // Verify delete criteria used class.startDate ('2026-06-01')
      expect(deleteQB.andWhere).toHaveBeenCalledWith(
        'date >= :deleteFrom',
        expect.objectContaining({ deleteFrom: '2026-06-01' }),
      );
      expect(generateSpy).toHaveBeenCalledWith('class-gen-1', true);
    });

    it('5.2 TH2: fromStartDate = false (Ấn gen từ Hôm nay) -> Chỉ xóa và sinh lại các buổi chưa diễn ra từ ngày hôm nay', async () => {
      const { ctrl, deleteQB } = makeGenController();
      const generateSpy = jest.spyOn(ctrl as any, 'generateSessions').mockResolvedValue(undefined);

      const todayStr = new Date().toISOString().split('T')[0];

      await ctrl.generateSessionsEndpoint('class-gen-1', 'false');

      // Verify delete criteria used todayStr
      expect(deleteQB.andWhere).toHaveBeenCalledWith(
        'date >= :deleteFrom',
        expect.objectContaining({ deleteFrom: todayStr }),
      );
      expect(generateSpy).toHaveBeenCalledWith('class-gen-1', false);
    });
  });
});
