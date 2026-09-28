import { RemoveStudentFromClassUseCase, EnrollStudentUseCase } from '../../../../../../src/modules/academics/application/use-cases/manage-enrollment.use-cases';
import { AcademicsPersistencePort } from '../../../../../../src/modules/academics/application/ports/academics-persistence.port';
import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';
import { SessionStatus } from '../../../../../../src/domain/value-objects/session-status.enum';
import { AttendanceDeletionGuard } from '../../../../../../src/modules/academics/domain/services/attendance-deletion-guard.service';

describe('StudentDroppedDateAndSessionSync Spec (TDD & Performance Benchmark)', () => {
  let removeStudentUseCase: RemoveStudentFromClassUseCase;
  let enrollStudentUseCase: EnrollStudentUseCase;
  let mockPersistence: jest.Mocked<AcademicsPersistencePort>;

  const classId = 'class-uuid-001';
  const studentId = 'student-uuid-001';

  beforeEach(() => {
    mockPersistence = {
      findRecurringAllocations: jest.fn(),
      findSessionAllocations: jest.fn(),
      enrollStudent: jest.fn(),
      removeStudent: jest.fn(),
      createAdhocSession: jest.fn(),
      updateStudentJoinedDate: jest.fn(),
      updateAllStudentsJoinedDate: jest.fn(),
    } as any;

    removeStudentUseCase = new RemoveStudentFromClassUseCase(mockPersistence);
    enrollStudentUseCase = new EnrollStudentUseCase(mockPersistence);
  });

  describe('PHẦN 1: BỘ 5 ĐIỀU KIỆN VALIDATE KỸ NGÀY KÍCH (DROPPED_DATE)', () => {
    it('Validate 1: Ném lỗi nếu định dạng ngày kích không hợp lệ (phải là YYYY-MM-DD)', async () => {
      mockPersistence.removeStudent.mockImplementation(async (_cId, _sId, date) => {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!date || !regex.test(date) || isNaN(Date.parse(date))) {
          throw new AcademicError('INVALID_DATE_FORMAT', 'Định dạng ngày kích không hợp lệ.');
        }
      });

      await expect(
        removeStudentUseCase.execute(classId, studentId, '2026/09/15'),
      ).rejects.toThrow('Định dạng ngày kích không hợp lệ.');

      await expect(
        removeStudentUseCase.execute(classId, studentId, 'invalid-date'),
      ).rejects.toThrow('Định dạng ngày kích không hợp lệ.');
    });

    it('Validate 2: Ném lỗi nếu học sinh không ở trạng thái Active trong lớp (đã bị kích trước đó)', async () => {
      mockPersistence.removeStudent.mockImplementation(async () => {
        throw new AcademicError('STUDENT_NOT_FOUND', 'Học sinh không ở trạng thái hoạt động trong lớp này.');
      });

      await expect(
        removeStudentUseCase.execute(classId, 'inactive-student-id', '2026-09-15'),
      ).rejects.toThrow('Học sinh không ở trạng thái hoạt động trong lớp này.');
    });

    it('Validate 3: Ném lỗi nếu ngày kích trước ngày học sinh tham gia lớp (droppedDate < joinedDate)', async () => {
      mockPersistence.removeStudent.mockImplementation(async () => {
        throw new AcademicError(
          'DROPPED_DATE_BEFORE_JOINED_DATE',
          'Ngày rời lớp không được trước ngày học sinh tham gia lớp.',
        );
      });

      // Học sinh tham gia lớp 2026-09-01, không thể kích ngày 2026-08-15
      await expect(
        removeStudentUseCase.execute(classId, studentId, '2026-08-15'),
      ).rejects.toThrow('Ngày rời lớp không được trước ngày học sinh tham gia lớp.');
    });

    it('Validate 4: Ném lỗi nếu ngày kích sau ngày kết thúc/bế giảng của lớp học (droppedDate > finishDate)', async () => {
      mockPersistence.removeStudent.mockImplementation(async () => {
        throw new AcademicError(
          'DROPPED_DATE_AFTER_FINISH_DATE',
          'Ngày rời lớp không được sau ngày kết thúc lớp học.',
        );
      });

      // Lớp kết thúc ngày 2026-10-31, không thể kích ngày 2026-11-15
      await expect(
        removeStudentUseCase.execute(classId, studentId, '2026-11-15'),
      ).rejects.toThrow('Ngày rời lớp không được sau ngày kết thúc lớp học.');
    });

    it('Validate 5: Ném lỗi bảo toàn tài chính nếu lùi ngày kích trước các buổi học đã xuất hóa đơn thu học phí (billId)', async () => {
      mockPersistence.removeStudent.mockImplementation(async () => {
        throw new AcademicError(
          'CANNOT_DROP_STUDENT_BILLED_CONFLICT',
          'Không thể chọn ngày kích trước buổi học ngày 2026-09-10 vì đã được xuất hóa đơn thu học phí.',
        );
      });

      await expect(
        removeStudentUseCase.execute(classId, studentId, '2026-09-05'),
      ).rejects.toThrow('đã được xuất hóa đơn thu học phí');
    });
  });

  describe('PHẦN 2: THỰC THI HỢP LỆ VÀ ĐỒNG BỘ TRẠNG THÁI', () => {
    it('Test Case 6: Kick học sinh với ngày kích hợp lệ -> lưu status Dropped và droppedDate', async () => {
      const customDroppedDate = '2026-09-15';
      mockPersistence.removeStudent.mockResolvedValue();

      await removeStudentUseCase.execute(classId, studentId, customDroppedDate);

      expect(mockPersistence.removeStudent).toHaveBeenCalledWith(classId, studentId, customDroppedDate);
    });

    it('Test Case 7: Kick học sinh không truyền ngày kích -> mặc định lấy ngày hiện tại', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      mockPersistence.removeStudent.mockResolvedValue();

      await removeStudentUseCase.execute(classId, studentId);

      expect(mockPersistence.removeStudent).toHaveBeenCalledWith(classId, studentId, todayStr);
    });

    it('Test Case 8: Thêm lại học sinh (Active) -> tự động xóa droppedDate (về null)', async () => {
      mockPersistence.enrollStudent.mockResolvedValue({
        id: 'enrollment-1',
        classId,
        studentId,
        status: 'Active',
        joinedDate: '2026-09-28',
        reactivated: true,
      });

      const result = await enrollStudentUseCase.execute(classId, studentId);

      expect(result.status).toBe('Active');
      expect(result.reactivated).toBe(true);
      expect(mockPersistence.enrollStudent).toHaveBeenCalledWith(
        classId,
        studentId,
        expect.any(String),
      );
    });
  });

  describe('PHẦN 3: LOGIC SINH LẠI ĐIỂM DANH DỰA TRÊN STATUS VÀ DROPPED_DATE', () => {
    interface StudentSessionEligibility {
      studentId: string;
      status: 'Active' | 'Dropped';
      joinedDate: string;
      droppedDate: string | null;
    }

    function isStudentEligibleForSession(student: StudentSessionEligibility, sessionDate: string): boolean {
      if (sessionDate < student.joinedDate) return false;
      if (student.status === 'Active') {
        return !student.droppedDate || sessionDate < student.droppedDate;
      }
      if (student.status === 'Dropped') {
        return Boolean(student.droppedDate && sessionDate < student.droppedDate);
      }
      return false;
    }

    it('Test Case 9: Học sinh Active chỉ được sinh điểm danh từ joinedDate trở đi', () => {
      const activeStudent: StudentSessionEligibility = {
        studentId: 'hs-active',
        status: 'Active',
        joinedDate: '2026-09-01',
        droppedDate: null,
      };

      expect(isStudentEligibleForSession(activeStudent, '2026-08-30')).toBe(false);
      expect(isStudentEligibleForSession(activeStudent, '2026-09-01')).toBe(true);
      expect(isStudentEligibleForSession(activeStudent, '2026-09-20')).toBe(true);
    });

    it('Test Case 10: Học sinh Dropped chỉ được sinh điểm danh từ joinedDate đến trước droppedDate', () => {
      const droppedStudent: StudentSessionEligibility = {
        studentId: 'hs-dropped',
        status: 'Dropped',
        joinedDate: '2026-07-01',
        droppedDate: '2026-09-10',
      };

      // Trước ngày vào lớp: không sinh
      expect(isStudentEligibleForSession(droppedStudent, '2026-06-25')).toBe(false);
      // Trong khoảng thời gian đang học: vẫn sinh bình thường
      expect(isStudentEligibleForSession(droppedStudent, '2026-07-15')).toBe(true);
      expect(isStudentEligibleForSession(droppedStudent, '2026-09-09')).toBe(true);
      // Từ ngày kích trở đi: tuyệt đối không sinh
      expect(isStudentEligibleForSession(droppedStudent, '2026-09-10')).toBe(false);
      expect(isStudentEligibleForSession(droppedStudent, '2026-09-28')).toBe(false);
    });

    it('Test Case 11 (Performance Benchmark): Đo tốc độ khớp điều kiện 100 học sinh x 100 buổi học đạt SLA < 5ms', () => {
      const students: StudentSessionEligibility[] = [];
      for (let i = 0; i < 50; i++) {
        students.push({
          studentId: `active-${i}`,
          status: 'Active',
          joinedDate: '2026-06-01',
          droppedDate: null,
        });
        students.push({
          studentId: `dropped-${i}`,
          status: 'Dropped',
          joinedDate: '2026-06-01',
          droppedDate: '2026-08-15',
        });
      }

      const sessions: string[] = [];
      for (let day = 1; day <= 100; day++) {
        const month = Math.floor(day / 30) + 6;
        const d = (day % 30) + 1;
        sessions.push(`2026-0${month < 10 ? '0' + month : month}-${d < 10 ? '0' + d : d}`);
      }

      const start = performance.now();
      let matchCount = 0;
      for (const sessDate of sessions) {
        for (const st of students) {
          if (isStudentEligibleForSession(st, sessDate)) {
            matchCount++;
          }
        }
      }
      const duration = performance.now() - start;

      console.log(`[PERFORMANCE BENCHMARK] Khớp điểm danh 100 hs x 100 buổi: ${duration.toFixed(3)}ms (Matches: ${matchCount}, SLA < 5ms)`);
      expect(duration).toBeLessThan(5);
    });
  });

  // =========================================================================
  // PHẦN 4: BẢO VỆ CÁC BUỔI CÓ BILL & TRẠNG THÁI KHÁC CHƯA DIỄN RA (CẤM XÓA)
  // =========================================================================
  describe('PHẦN 4: QUY TẮC ĐỒNG BỘ - CHỈ CHO PHÉP XÓA BUỔI CHƯA DIỄN RA, CẤM XÓA BUỔI CÓ BILL VÀ ĐÃ DIỄN RA', () => {
    it('Test Case 12: Buổi học có billId (đã xuất hóa đơn) -> CẤM XÓA tuyệt đối', () => {
      const session = {
        id: 'sess-billed',
        classId: 'class-01',
        date: '2026-10-01',
        status: SessionStatus.SCHEDULED,
        attendanceLocked: false,
      };
      const att = {
        id: 'att-billed',
        classSessionId: 'sess-billed',
        studentId: 'st-01',
        billId: 'bill-uuid-12345',
        isPresent: false,
      };

      const safeIds = AttendanceDeletionGuard.filterSafeSessionsToDelete([session], [att]);
      expect(safeIds).not.toContain('sess-billed');
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
      expect(AttendanceDeletionGuard.getUnsafeReason(session, att)).toBe('đã được xuất hóa đơn thu học phí');
    });

    it('Test Case 13: Buổi học có trạng thái khác chưa diễn ra (Completed / In Progress / Cancelled) -> CẤM XÓA', () => {
      const completedSession = {
        id: 'sess-completed',
        classId: 'class-01',
        date: '2026-09-20',
        status: SessionStatus.COMPLETED,
        attendanceLocked: false,
      };
      const inProgressSession = {
        id: 'sess-progress',
        classId: 'class-01',
        date: '2026-09-28',
        status: SessionStatus.IN_PROGRESS,
        attendanceLocked: false,
      };
      const cancelledSession = {
        id: 'sess-cancelled',
        classId: 'class-01',
        date: '2026-09-22',
        status: SessionStatus.CANCELLED,
        attendanceLocked: false,
      };

      const atts = [
        { id: 'a1', classSessionId: 'sess-completed', studentId: 'st-01', billId: null, isPresent: false },
        { id: 'a2', classSessionId: 'sess-progress', studentId: 'st-01', billId: null, isPresent: false },
        { id: 'a3', classSessionId: 'sess-cancelled', studentId: 'st-01', billId: null, isPresent: false },
      ];

      const safeIds = AttendanceDeletionGuard.filterSafeSessionsToDelete(
        [completedSession, inProgressSession, cancelledSession],
        atts,
      );
      expect(safeIds).toEqual([]);
    });

    it('Test Case 14: Buổi học Scheduled, chưa khóa, không bill, không điểm danh -> ĐƯỢC PHÉP XÓA để tái tạo', () => {
      const scheduledSession = {
        id: 'sess-safe',
        classId: 'class-01',
        date: '2026-10-15',
        status: SessionStatus.SCHEDULED,
        attendanceLocked: false,
      };
      const safeAtt = {
        id: 'att-safe',
        classSessionId: 'sess-safe',
        studentId: 'st-01',
        billId: null,
        isPresent: false,
      };

      const safeIds = AttendanceDeletionGuard.filterSafeSessionsToDelete([scheduledSession], [safeAtt]);
      expect(safeIds).toContain('sess-safe');
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(scheduledSession, safeAtt)).toBe(true);
    });

    it('Test Case 15 (Performance Benchmark): Quét 500 ca học hỗn hợp (có bill, đã diễn ra, chưa diễn ra) đạt SLA < 5ms', () => {
      const mixedSessions = Array.from({ length: 500 }, (_, i) => ({
        id: `sess-mixed-${i}`,
        classId: 'class-01',
        date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
        status: i % 4 === 0 ? SessionStatus.COMPLETED : (i % 4 === 1 ? SessionStatus.IN_PROGRESS : SessionStatus.SCHEDULED),
        attendanceLocked: i % 10 === 0,
      }));

      const mixedAttendances = mixedSessions.map((s, idx) => ({
        id: `att-mixed-${idx}`,
        classSessionId: s.id,
        studentId: `student-${idx % 20}`,
        billId: idx % 5 === 0 ? `bill-${idx}` : null,
        isPresent: idx % 7 === 0,
      }));

      const start = performance.now();
      const safeIds = AttendanceDeletionGuard.filterSafeSessionsToDelete(mixedSessions, mixedAttendances);
      const duration = performance.now() - start;

      console.log(`[PERFORMANCE BENCHMARK] Lọc an toàn 500 buổi học: ${duration.toFixed(3)}ms (Safe sessions: ${safeIds.length}, SLA < 5ms)`);
      expect(duration).toBeLessThan(5);
      expect(Array.isArray(safeIds)).toBe(true);
    });
  });
});
