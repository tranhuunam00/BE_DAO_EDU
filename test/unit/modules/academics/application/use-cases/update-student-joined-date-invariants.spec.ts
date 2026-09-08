import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';
import { SessionStatus } from '../../../../../../src/domain/value-objects/session-status.enum';

// =========================================================================
// MOCK DATA TYPES & CONTRACT INTERFACES (TDD SPEC)
// =========================================================================
export interface SessionData {
  id: string;
  classId: string;
  date: string;
  status: SessionStatus;
  attendanceLocked: boolean;
}

export interface AttendanceData {
  id: string;
  classSessionId: string;
  studentId: string;
  billId: string | null;
  isPresent: boolean;
}

export interface ClassStudentData {
  classId: string;
  studentId: string;
  studentName?: string;
  joinedDate: string;
  status: 'Active' | 'Dropped';
}

export interface AttendanceSyncResult {
  deletedAttendanceIds: string[];
  createdAttendanceRecords: Array<{ classSessionId: string; studentId: string; isPresent: boolean }>;
  affectedStudentCount: number;
}

/**
 * Domain Service / Invariant Rule Engine:
 * Quản lý an toàn và bảo vệ toàn vẹn lịch sử điểm danh và tài chính.
 * QUY TẮC CỐT LÕI: TUYỆT ĐỐI CHỈ XÓA ĐIỂM DANH KHI BUỔI HỌC Ở TRẠNG THÁI CHƯA DIỄN RA ('Scheduled'),
 * CHƯA KHÓA ĐIỂM DANH, CHƯA CHỐT HÓA ĐƠN VÀ CHƯA CÓ DỮ LIỆU ĐIỂM DANH CÓ MẶT.
 */
export class AttendanceDeletionGuard {
  /**
   * Kiểm tra xem một bản ghi điểm danh có đủ điều kiện an toàn tuyệt đối để xóa hay không.
   */
  static isAttendanceSafeToDelete(session: SessionData, attendance: AttendanceData): boolean {
    // 1. Phải là buổi học chưa diễn ra (Scheduled)
    if (session.status !== SessionStatus.SCHEDULED) {
      return false;
    }
    // 2. Buổi học chưa bị khóa điểm danh
    if (session.attendanceLocked) {
      return false;
    }
    // 3. Chưa bị chốt hóa đơn thu học phí
    if (attendance.billId !== null && attendance.billId !== undefined) {
      return false;
    }
    // 4. Chưa từng được điểm danh có mặt (tránh xóa nhầm dấu vết máy chấm công hoặc giáo viên đã tích)
    if (attendance.isPresent) {
      return false;
    }
    return true;
  }

  /**
   * Xác thực điều kiện an toàn khi cập nhật ngày vào lớp (joinedDate).
   * Chặn ngay lập tức nếu tồn tại buổi học trước ngày mới có trạng thái khác 'Scheduled' hoặc đã có dữ liệu.
   */
  static validateSafeToUpdateJoinedDate(params: {
    studentId: string;
    studentName?: string;
    newJoinedDate: string;
    sessions: SessionData[];
    attendances: AttendanceData[];
  }): void {
    const { studentId, studentName, newJoinedDate, sessions, attendances } = params;
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));

    const conflictingRecords: Array<{ session: SessionData; att: AttendanceData; reason: string }> = [];

    for (const att of attendances) {
      if (att.studentId !== studentId) continue;
      const session = sessionMap.get(att.classSessionId);
      if (!session) continue;

      if (session.date < newJoinedDate) {
        // Nếu không an toàn để xóa -> Xung đột vi phạm
        if (!this.isAttendanceSafeToDelete(session, att)) {
          let reason = '';
          if (att.billId) reason = 'đã được xuất hóa đơn thu học phí';
          else if (session.status === SessionStatus.COMPLETED) reason = 'đã hoàn thành';
          else if (session.status === SessionStatus.IN_PROGRESS) reason = 'đang diễn ra';
          else if (session.attendanceLocked) reason = 'đã khóa điểm danh';
          else if (att.isPresent) reason = 'đã được ghi nhận có mặt';
          else reason = `trạng thái buổi học là ${session.status}`;

          conflictingRecords.push({ session, att, reason });
        }
      }
    }

    if (conflictingRecords.length > 0) {
      const studentLabel = studentName ? `của học sinh ${studentName}` : `(ID: ${studentId})`;
      const reasonsSummary = Array.from(new Set(conflictingRecords.map((c) => c.reason))).join(', ');

      throw new AcademicError(
        'CANNOT_MODIFY_JOINED_DATE_PROTECTED',
        `Không thể thay đổi ngày vào lớp ${studentLabel} thành ${newJoinedDate} vì tồn tại ${conflictingRecords.length} buổi học trước ngày này (${reasonsSummary}). Tuyệt đối không được xóa điểm danh của các buổi học đã/đang diễn ra hoặc đã chốt tài chính.`,
      );
    }
  }

  /**
   * Đồng bộ an toàn điểm danh khi đổi joinedDate cho 1 học sinh.
   */
  static syncAttendanceForStudent(params: {
    studentId: string;
    newJoinedDate: string;
    sessions: SessionData[];
    existingAttendances: AttendanceData[];
  }): AttendanceSyncResult {
    const { studentId, newJoinedDate, sessions, existingAttendances } = params;
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    const existingAttMap = new Map(
      existingAttendances
        .filter((a) => a.studentId === studentId)
        .map((a) => [a.classSessionId, a]),
    );

    const deletedAttendanceIds: string[] = [];
    const createdAttendanceRecords: Array<{ classSessionId: string; studentId: string; isPresent: boolean }> = [];

    // 1. Chỉ xóa các bản ghi điểm danh trước newJoinedDate NẾU thỏa mãn điều kiện an toàn
    for (const att of existingAttendances) {
      if (att.studentId !== studentId) continue;
      const session = sessionMap.get(att.classSessionId);
      if (session && session.date < newJoinedDate) {
        if (this.isAttendanceSafeToDelete(session, att)) {
          deletedAttendanceIds.push(att.id);
        }
      }
    }

    // 2. Tạo mới điểm danh cho các buổi học từ newJoinedDate trở đi nếu chưa có
    for (const session of sessions) {
      if (session.date >= newJoinedDate) {
        if (!existingAttMap.has(session.id)) {
          createdAttendanceRecords.push({
            classSessionId: session.id,
            studentId,
            isPresent: false,
          });
        }
      }
    }

    return {
      deletedAttendanceIds,
      createdAttendanceRecords,
      affectedStudentCount: 1,
    };
  }

  /**
   * Đồng bộ an toàn khi kick học sinh khỏi lớp (removeStudent).
   * Chỉ xóa các buổi tương lai CHƯA DIỄN RA ('Scheduled') và chưa điểm danh/chưa hóa đơn.
   */
  static filterSafeFutureAttendanceToDelete(
    studentId: string,
    effectiveDate: string,
    sessions: SessionData[],
    attendances: AttendanceData[],
  ): string[] {
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    const idsToDelete: string[] = [];

    for (const att of attendances) {
      if (att.studentId !== studentId) continue;
      const session = sessionMap.get(att.classSessionId);
      if (!session) continue;

      if (session.date >= effectiveDate) {
        if (this.isAttendanceSafeToDelete(session, att)) {
          idsToDelete.push(att.id);
        }
      }
    }

    return idsToDelete;
  }
}

// =========================================================================
// TDD SPECIFICATION: TEST CASES & BENCHMARK
// =========================================================================
describe('CH-01: Comprehensive Attendance Deletion Safety Guard Spec', () => {
  const mockClassId = 'class-101';

  const mockSessions: SessionData[] = [
    { id: 'sess-scheduled-past', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false },
    { id: 'sess-in-progress', classId: mockClassId, date: '2026-05-10', status: SessionStatus.IN_PROGRESS, attendanceLocked: false },
    { id: 'sess-completed-unlocked', classId: mockClassId, date: '2026-05-20', status: SessionStatus.COMPLETED, attendanceLocked: false },
    { id: 'sess-completed-locked', classId: mockClassId, date: '2026-05-25', status: SessionStatus.COMPLETED, attendanceLocked: true },
    { id: 'sess-cancelled', classId: mockClassId, date: '2026-05-28', status: SessionStatus.CANCELLED, attendanceLocked: false },
    { id: 'sess-future-scheduled', classId: mockClassId, date: '2026-06-10', status: SessionStatus.SCHEDULED, attendanceLocked: false },
  ];

  // -----------------------------------------------------------------------
  // NHÓM TEST 1: CHẶN XÓA CÁC BUỔI CÓ TRẠNG THÁI KHÁC 'SCHEDULED'
  // -----------------------------------------------------------------------
  describe('1. Block Attendance Deletion for Non-Scheduled Sessions', () => {
    it('1.1. CHẶN XÓA khi buổi học đang diễn ra (In-Progress)', () => {
      const studentId = 'st-1';
      const attendances: AttendanceData[] = [
        { id: 'att-in-progress', classSessionId: 'sess-in-progress', studentId, billId: null, isPresent: false },
      ];

      expect(() => {
        AttendanceDeletionGuard.validateSafeToUpdateJoinedDate({
          studentId,
          studentName: 'Học sinh InProgress',
          newJoinedDate: '2026-06-01',
          sessions: mockSessions,
          attendances,
        });
      }).toThrow(AcademicError);
    });

    it('1.2. CHẶN XÓA khi buổi học đã hoàn thành (Completed) dù giáo viên CHƯA KHÓA điểm danh', () => {
      const studentId = 'st-2';
      const attendances: AttendanceData[] = [
        { id: 'att-completed', classSessionId: 'sess-completed-unlocked', studentId, billId: null, isPresent: false },
      ];

      expect(() => {
        AttendanceDeletionGuard.validateSafeToUpdateJoinedDate({
          studentId,
          studentName: 'Học sinh Completed',
          newJoinedDate: '2026-06-01',
          sessions: mockSessions,
          attendances,
        });
      }).toThrow(AcademicError);
    });

    it('1.3. CHẶN XÓA khi buổi học có trạng thái Đã hủy (Cancelled)', () => {
      const studentId = 'st-3';
      const attendances: AttendanceData[] = [
        { id: 'att-cancelled', classSessionId: 'sess-cancelled', studentId, billId: null, isPresent: false },
      ];

      expect(() => {
        AttendanceDeletionGuard.validateSafeToUpdateJoinedDate({
          studentId,
          studentName: 'Học sinh Cancelled',
          newJoinedDate: '2026-06-01',
          sessions: mockSessions,
          attendances,
        });
      }).toThrow(AcademicError);
    });

    it('1.4. CHẶN XÓA khi học sinh đã được tích CÓ MẶT (isPresent = true) dù buổi học là Scheduled', () => {
      const studentId = 'st-4';
      const attendances: AttendanceData[] = [
        { id: 'att-present', classSessionId: 'sess-scheduled-past', studentId, billId: null, isPresent: true },
      ];

      expect(() => {
        AttendanceDeletionGuard.validateSafeToUpdateJoinedDate({
          studentId,
          studentName: 'Học sinh Present',
          newJoinedDate: '2026-06-01',
          sessions: mockSessions,
          attendances,
        });
      }).toThrow(AcademicError);
    });

    it('1.5. CHẶN XÓA khi bản ghi điểm danh ĐÃ XUẤT HÓA ĐƠN (billId != null)', () => {
      const studentId = 'st-5';
      const attendances: AttendanceData[] = [
        { id: 'att-billed', classSessionId: 'sess-scheduled-past', studentId, billId: 'bill-uuid-1', isPresent: false },
      ];

      expect(() => {
        AttendanceDeletionGuard.validateSafeToUpdateJoinedDate({
          studentId,
          studentName: 'Học sinh Billed',
          newJoinedDate: '2026-06-01',
          sessions: mockSessions,
          attendances,
        });
      }).toThrow(AcademicError);
    });
  });

  // -----------------------------------------------------------------------
  // NHÓM TEST 2: ĐỒNG BỘ AN TOÀN KHI THỎA MÃN ĐẦY ĐỦ ĐIỀU KIỆN
  // -----------------------------------------------------------------------
  describe('2. Safe Attendance Deletion and Synchronization', () => {
    it('2.1. CHỈ XÓA các buổi Scheduled, chưa khóa, chưa có billId và chưa điểm danh có mặt', () => {
      const studentId = 'st-safe';
      const attendances: AttendanceData[] = [
        { id: 'att-scheduled-safe', classSessionId: 'sess-scheduled-past', studentId, billId: null, isPresent: false },
      ];

      expect(() => {
        AttendanceDeletionGuard.validateSafeToUpdateJoinedDate({
          studentId,
          studentName: 'Học sinh Safe',
          newJoinedDate: '2026-06-01',
          sessions: mockSessions,
          attendances,
        });
      }).not.toThrow();

      const result = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId,
        newJoinedDate: '2026-06-01',
        sessions: mockSessions,
        existingAttendances: attendances,
      });

      expect(result.deletedAttendanceIds).toEqual(['att-scheduled-safe']);
      expect(result.createdAttendanceRecords.map((r) => r.classSessionId)).toEqual(['sess-future-scheduled']);
    });

    it('2.2. Khi kick học sinh (removeStudent): Không xóa các buổi học hôm nay nếu buổi đó đã In-Progress hoặc Completed', () => {
      const studentId = 'st-kick';
      const attendances: AttendanceData[] = [
        { id: 'att-in-progress', classSessionId: 'sess-in-progress', studentId, billId: null, isPresent: true },
        { id: 'att-future', classSessionId: 'sess-future-scheduled', studentId, billId: null, isPresent: false },
      ];

      // Kick học sinh từ ngày 2026-05-10 (ngày có buổi sess-in-progress)
      const safeToDeleteIds = AttendanceDeletionGuard.filterSafeFutureAttendanceToDelete(
        studentId,
        '2026-05-10',
        mockSessions,
        attendances,
      );

      // sess-in-progress có isPresent = true và status In-Progress => KHÔNG ĐƯỢC XÓA
      // Chỉ được xóa sess-future-scheduled (Scheduled, isPresent = false)
      expect(safeToDeleteIds).toEqual(['att-future']);
      expect(safeToDeleteIds).not.toContain('att-in-progress');
    });
  });

  // -----------------------------------------------------------------------
  // NHÓM TEST 3: PERFORMANCE BENCHMARK (SLA < 50ms)
  // -----------------------------------------------------------------------
  describe('3. Performance Benchmark (SLA Limit < 50ms)', () => {
    it('3.1. Quét kiểm tra an toàn và đồng bộ cho 100 học sinh x 100 ca học dưới 50ms', () => {
      const largeSessions: SessionData[] = Array.from({ length: 100 }, (_, i) => ({
        id: `sess-perf-${i}`,
        classId: mockClassId,
        date: i < 50 ? `2026-05-${String((i % 28) + 1).padStart(2, '0')}` : `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
        status: i % 10 === 0 ? SessionStatus.COMPLETED : SessionStatus.SCHEDULED,
        attendanceLocked: false,
      }));

      const largeStudents: ClassStudentData[] = Array.from({ length: 100 }, (_, i) => ({
        classId: mockClassId,
        studentId: `student-perf-${i}`,
        studentName: `Học sinh Perf ${i}`,
        joinedDate: '2026-05-01',
        status: 'Active',
      }));

      const largeAttendances: AttendanceData[] = [];
      for (const st of largeStudents) {
        for (let j = 0; j < 20; j++) {
          largeAttendances.push({
            id: `att-perf-${st.studentId}-${j}`,
            classSessionId: `sess-perf-${j}`,
            studentId: st.studentId,
            billId: null,
            isPresent: false,
          });
        }
      }

      const startTime = performance.now();
      for (const st of largeStudents) {
        AttendanceDeletionGuard.syncAttendanceForStudent({
          studentId: st.studentId,
          newJoinedDate: '2026-06-01',
          sessions: largeSessions,
          existingAttendances: largeAttendances,
        });
      }
      const durationMs = performance.now() - startTime;

      expect(durationMs).toBeLessThan(50);
    });
  });
});
