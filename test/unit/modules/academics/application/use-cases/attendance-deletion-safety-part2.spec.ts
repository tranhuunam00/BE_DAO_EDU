import {
  AttendanceDeletionGuard,
  AttendanceSafetySession,
  AttendanceSafetyRecord,
  AttendanceSafetyClassStudent,
} from '../../../../../../src/modules/academics/domain/services/attendance-deletion-guard.service';
import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';
import { SessionStatus } from '../../../../../../src/domain/value-objects/session-status.enum';

describe('CH-01 Part 2: Comprehensive Attendance Deletion Safety Guard (20 Cases)', () => {
  const mockClassId = 'class-safety-02';
  const studentId = 'st-student-02';

  // =========================================================================
  // NHÓM D: THAO TÁC LỚP HỌC, RÚT HỌC SINH & CHUYỂN LỚP (CASES 31 - 40)
  // =========================================================================
  describe('Nhóm D: Thao tác Lớp học, Rút học sinh & Chuyển lớp (10 Cases)', () => {
    it('Case 31: Kick học sinh (removeStudent) vào ngày có ca In-Progress -> Giữ nguyên ca hôm nay, chỉ xóa ca tương lai Scheduled', () => {
      const sessions = [
        { id: 's31-today', classId: mockClassId, date: '2026-05-15', status: SessionStatus.IN_PROGRESS, attendanceLocked: false },
        { id: 's31-future', classId: mockClassId, date: '2026-05-20', status: SessionStatus.SCHEDULED, attendanceLocked: false },
      ];
      const attendances = [
        { id: 'a31-today', classSessionId: 's31-today', studentId, isPresent: true },
        { id: 'a31-future', classSessionId: 's31-future', studentId, isPresent: false },
      ];

      const safeIds = AttendanceDeletionGuard.filterSafeFutureAttendanceToDelete(studentId, '2026-05-15', sessions, attendances);
      expect(safeIds).toEqual(['a31-future']);
      expect(safeIds).not.toContain('a31-today');
    });

    it('Case 32: Kick học sinh vào ngày có ca Completed -> Giữ nguyên điểm danh ca Completed', () => {
      const sessions = [
        { id: 's32-done', classId: mockClassId, date: '2026-05-15', status: SessionStatus.COMPLETED, attendanceLocked: false },
        { id: 's32-next', classId: mockClassId, date: '2026-05-22', status: SessionStatus.SCHEDULED, attendanceLocked: false },
      ];
      const attendances = [
        { id: 'a32-done', classSessionId: 's32-done', studentId, isPresent: false },
        { id: 'a32-next', classSessionId: 's32-next', studentId, isPresent: false },
      ];

      const safeIds = AttendanceDeletionGuard.filterSafeFutureAttendanceToDelete(studentId, '2026-05-15', sessions, attendances);
      expect(safeIds).toEqual(['a32-next']);
    });

    it('Case 33: Kick học sinh nhưng trong tương lai có ca đã bị khóa điểm danh -> Không xóa ca bị khóa đó', () => {
      const sessions = [
        { id: 's33-locked-future', classId: mockClassId, date: '2026-05-20', status: SessionStatus.SCHEDULED, attendanceLocked: true },
      ];
      const attendances = [
        { id: 'a33-locked', classSessionId: 's33-locked-future', studentId, isPresent: false },
      ];

      const safeIds = AttendanceDeletionGuard.filterSafeFutureAttendanceToDelete(studentId, '2026-05-15', sessions, attendances);
      expect(safeIds).toHaveLength(0);
    });

    it('Case 34: Cập nhật joinedDate hàng loạt: 29 học sinh an toàn, 1 học sinh đã có bill -> Chặn toàn bộ, báo lỗi', () => {
      const students: AttendanceSafetyClassStudent[] = Array.from({ length: 30 }, (_, i) => ({
        classId: mockClassId,
        studentId: `st-${i}`,
        studentName: `Học sinh ${i}`,
        joinedDate: '2026-05-01',
        status: 'Active',
      }));

      const sessions = [{ id: 's34', classId: mockClassId, date: '2026-05-10', status: SessionStatus.SCHEDULED, attendanceLocked: false }];
      const attendances = students.map((s, idx) => ({
        id: `att-${idx}`,
        classSessionId: 's34',
        studentId: s.studentId,
        billId: idx === 15 ? 'bill-15' : null, // Học sinh 15 có hóa đơn
        isPresent: false,
      }));

      expect(() => {
        AttendanceDeletionGuard.syncAttendanceForAllStudents({
          students,
          newJoinedDate: '2026-06-01',
          sessions,
          existingAttendances: attendances,
        });
      }).toThrow(AcademicError);
    });

    it('Case 35: Cập nhật hàng loạt thành công khi toàn bộ 30 học sinh đều an toàn', () => {
      const students: AttendanceSafetyClassStudent[] = Array.from({ length: 30 }, (_, i) => ({
        classId: mockClassId,
        studentId: `st-safe-${i}`,
        studentName: `Học sinh An Toàn ${i}`,
        joinedDate: '2026-05-01',
        status: 'Active',
      }));

      const sessions = [
        { id: 's35-old', classId: mockClassId, date: '2026-05-10', status: SessionStatus.SCHEDULED, attendanceLocked: false },
        { id: 's35-new', classId: mockClassId, date: '2026-06-10', status: SessionStatus.SCHEDULED, attendanceLocked: false },
      ];
      const attendances = students.map((s, idx) => ({
        id: `att-old-${idx}`,
        classSessionId: 's35-old',
        studentId: s.studentId,
        billId: null,
        isPresent: false,
      }));

      const res = AttendanceDeletionGuard.syncAttendanceForAllStudents({
        students,
        newJoinedDate: '2026-06-01',
        sessions,
        existingAttendances: attendances,
      });

      expect(res.affectedStudentCount).toBe(30);
      expect(res.deletedAttendanceIds).toHaveLength(30);
      expect(res.createdAttendanceRecords).toHaveLength(30); // 30 học sinh được sinh điểm danh cho s35-new
    });

    it('Case 36: Không xóa nhầm điểm danh của học sinh lớp khác khi trùng thời gian', () => {
      const sessions = [{ id: 's36', classId: mockClassId, date: '2026-05-10', status: SessionStatus.SCHEDULED, attendanceLocked: false }];
      const attOfOtherClass = { id: 'a36-other', classSessionId: 's36', studentId: 'student-other-class', isPresent: false };

      const res = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId: 'student-current-class',
        newJoinedDate: '2026-06-01',
        sessions,
        existingAttendances: [attOfOtherClass],
      });

      expect(res.deletedAttendanceIds).not.toContain('a36-other');
    });

    it('Case 37: Học sinh tạm nghỉ (Suspended) quay lại lớp -> Giữ nguyên lịch sử cũ, chỉ tạo ca từ ngày mới', () => {
      const sessions = [
        { id: 's37-past', classId: mockClassId, date: '2026-03-01', status: SessionStatus.COMPLETED, attendanceLocked: true },
        { id: 's37-future', classId: mockClassId, date: '2026-06-01', status: SessionStatus.SCHEDULED, attendanceLocked: false },
      ];
      const attPast = { id: 'a37-past', classSessionId: 's37-past', studentId, billId: 'bill-march', isPresent: true };

      const res = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId,
        newJoinedDate: '2026-06-01',
        sessions,
        existingAttendances: [attPast],
      });

      expect(res.deletedAttendanceIds).toHaveLength(0);
      expect(res.createdAttendanceRecords.map((r) => r.classSessionId)).toEqual(['s37-future']);
    });

    it('Case 38: Học sinh re-enrollment nhiều lần -> Bảo toàn độc lập các ca học từng giai đoạn', () => {
      const sessions = [
        { id: 's38-1', classId: mockClassId, date: '2026-01-10', status: SessionStatus.COMPLETED, attendanceLocked: true },
        { id: 's38-2', classId: mockClassId, date: '2026-05-10', status: SessionStatus.SCHEDULED, attendanceLocked: false },
      ];
      const attendances = [
        { id: 'a38-1', classSessionId: 's38-1', studentId, billId: 'b-old', isPresent: true },
        { id: 'a38-2', classSessionId: 's38-2', studentId, billId: null, isPresent: false },
      ];

      const res = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId,
        newJoinedDate: '2026-05-15',
        sessions,
        existingAttendances: attendances,
      });

      // Chỉ xóa a38-2 (Scheduled, chưa hóa đơn), a38-1 được bảo tồn
      expect(res.deletedAttendanceIds).toEqual(['a38-2']);
      expect(res.deletedAttendanceIds).not.toContain('a38-1');
    });

    it('Case 39: Xóa điểm danh an toàn không làm ảnh hưởng đến các ca học của học sinh khác trong cùng ca', () => {
      const session = { id: 's39', classId: mockClassId, date: '2026-05-10', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att1 = { id: 'a39-1', classSessionId: 's39', studentId: 'st-1', isPresent: false };
      const att2 = { id: 'a39-2', classSessionId: 's39', studentId: 'st-2', isPresent: false };

      const res = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId: 'st-1',
        newJoinedDate: '2026-06-01',
        sessions: [session],
        existingAttendances: [att1, att2],
      });

      expect(res.deletedAttendanceIds).toEqual(['a39-1']);
      expect(res.deletedAttendanceIds).not.toContain('a39-2');
    });

    it('Case 40: Đồng bộ điểm danh không sinh bản ghi thừa nếu ca học có ngày trước newJoinedDate', () => {
      const sessions = [
        { id: 's40-old', classId: mockClassId, date: '2026-05-10', status: SessionStatus.SCHEDULED, attendanceLocked: false },
      ];

      const res = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId,
        newJoinedDate: '2026-06-01',
        sessions,
        existingAttendances: [],
      });

      expect(res.createdAttendanceRecords).toHaveLength(0);
    });
  });

  // =========================================================================
  // NHÓM E: ĐỒNG THỜI & DỮ LIỆU BIÊN (CASES 41 - 48)
  // =========================================================================
  describe('Nhóm E: Đồng thời & Dữ liệu biên (8 Cases)', () => {
    it('Case 41: Boundary: session.date === newJoinedDate (đúng ngày mốc) -> Không xóa, sinh điểm danh nếu chưa có', () => {
      const session = { id: 's41', classId: mockClassId, date: '2026-06-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const res = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId,
        newJoinedDate: '2026-06-01',
        sessions: [session],
        existingAttendances: [],
      });
      expect(res.deletedAttendanceIds).toHaveLength(0);
      expect(res.createdAttendanceRecords).toHaveLength(1);
    });

    it('Case 42: Boundary: session.date === newJoinedDate - 1 ngày -> Thuộc phạm vi quá khứ, được xóa an toàn', () => {
      const session = { id: 's42', classId: mockClassId, date: '2026-05-31', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a42', classSessionId: 's42', studentId, isPresent: false };
      const res = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId,
        newJoinedDate: '2026-06-01',
        sessions: [session],
        existingAttendances: [att],
      });
      expect(res.deletedAttendanceIds).toEqual(['a42']);
    });

    it('Case 43: Boundary: Lớp học chưa có bất kỳ ca học nào (sessions = []) -> Xử lý êm thuận không văng lỗi', () => {
      const res = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId,
        newJoinedDate: '2026-06-01',
        sessions: [],
        existingAttendances: [],
      });
      expect(res.deletedAttendanceIds).toHaveLength(0);
      expect(res.createdAttendanceRecords).toHaveLength(0);
    });

    it('Case 44: Boundary: Học sinh chưa từng có bản ghi điểm danh nào -> Tự tạo điểm danh từ joinedDate', () => {
      const session = { id: 's44', classId: mockClassId, date: '2026-06-15', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const res = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId,
        newJoinedDate: '2026-06-01',
        sessions: [session],
        existingAttendances: [],
      });
      expect(res.createdAttendanceRecords).toHaveLength(1);
    });

    it('Case 45: Boundary: newJoinedDate là ngày tương lai xa (năm 2030) -> Xóa sạch các ca Scheduled chưa khóa trước 2030', () => {
      const session = { id: 's45', classId: mockClassId, date: '2026-06-15', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a45', classSessionId: 's45', studentId, isPresent: false };
      const res = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId,
        newJoinedDate: '2030-01-01',
        sessions: [session],
        existingAttendances: [att],
      });
      expect(res.deletedAttendanceIds).toEqual(['a45']);
      expect(res.createdAttendanceRecords).toHaveLength(0);
    });

    it('Case 46: Boundary: Chuỗi ngày có đuôi giờ ISO ("2026-06-01T00:00:00.000Z") -> Cắt chuẩn 10 ký tự an toàn', () => {
      const session = { id: 's46', classId: mockClassId, date: '2026-06-01T08:00:00.000Z', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const res = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId,
        newJoinedDate: '2026-06-01T00:00:00.000Z',
        sessions: [session],
        existingAttendances: [],
      });
      expect(res.createdAttendanceRecords).toHaveLength(1);
    });

    it('Case 47: Concurrency & Idempotency: Chạy hàm đồng bộ 2 lần liên tiếp với cùng dữ liệu -> Kết quả đồng nhất', () => {
      const session = { id: 's47', classId: mockClassId, date: '2026-06-10', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const res1 = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId,
        newJoinedDate: '2026-06-01',
        sessions: [session],
        existingAttendances: [],
      });

      // Lần 2: Đã có điểm danh vừa tạo ở lần 1
      const res2 = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId,
        newJoinedDate: '2026-06-01',
        sessions: [session],
        existingAttendances: [{ id: 'a47-new', classSessionId: 's47', studentId, isPresent: false }],
      });

      expect(res1.createdAttendanceRecords).toHaveLength(1);
      expect(res2.createdAttendanceRecords).toHaveLength(0); // Không tạo trùng
    });

    it('Case 48: Concurrency: Ca học vừa được giáo viên bấm chốt sang In-Progress ngay trước khi đồng bộ -> Chặn xóa ngay', () => {
      const session = { id: 's48', classId: mockClassId, date: '2026-05-10', status: SessionStatus.IN_PROGRESS, attendanceLocked: false };
      const att = { id: 'a48', classSessionId: 's48', studentId, isPresent: false };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });
  });

  // =========================================================================
  // NHÓM F: PERFORMANCE BENCHMARK SLA VỚI TẬP DỮ LIỆU LỚN (CASES 49 - 50)
  // =========================================================================
  describe('Nhóm F: Performance Benchmark SLA với Big Dataset (2 Cases)', () => {
    it('Case 49: Quét an toàn và đồng bộ cho 1,000 học sinh x 50 ca học (50,000 bản ghi) dưới 30ms', () => {
      const largeSessions: AttendanceSafetySession[] = Array.from({ length: 50 }, (_, i) => ({
        id: `sess-large-${i}`,
        classId: mockClassId,
        date: i < 25 ? `2026-05-${String((i % 28) + 1).padStart(2, '0')}` : `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
        status: i >= 25 && i % 10 === 0 ? SessionStatus.COMPLETED : SessionStatus.SCHEDULED,
        attendanceLocked: false,
      }));

      const largeStudents: AttendanceSafetyClassStudent[] = Array.from({ length: 1000 }, (_, i) => ({
        classId: mockClassId,
        studentId: `student-large-${i}`,
        studentName: `Học sinh Quy Mô Lớn ${i}`,
        joinedDate: '2026-05-01',
        status: 'Active',
      }));

      // Mỗi học sinh có 20 bản ghi điểm danh cũ (1000 x 20 = 20,000 attendances)
      const largeAttendances: AttendanceSafetyRecord[] = [];
      for (const st of largeStudents) {
        for (let j = 0; j < 20; j++) {
          largeAttendances.push({
            id: `att-large-${st.studentId}-${j}`,
            classSessionId: `sess-large-${j}`,
            studentId: st.studentId,
            billId: null,
            isPresent: false,
          });
        }
      }

      const startTime = performance.now();
      // Chạy đồng bộ hàng loạt cho 1,000 học sinh
      const result = AttendanceDeletionGuard.syncAttendanceForAllStudents({
        students: largeStudents,
        newJoinedDate: '2026-06-01',
        sessions: largeSessions,
        existingAttendances: largeAttendances,
      });
      const durationMs = performance.now() - startTime;

      expect(result.affectedStudentCount).toBe(1000);
      expect(result.deletedAttendanceIds.length).toBeGreaterThan(0);
      // SLA Time Limit < 30ms
      expect(durationMs).toBeLessThan(30);
    });

    it('Case 50: Quét lọc điểm danh tương lai (removeStudent) cho 500 ca học dưới 10ms', () => {
      const sessions: AttendanceSafetySession[] = Array.from({ length: 500 }, (_, i) => ({
        id: `sess-f500-${i}`,
        classId: mockClassId,
        date: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
        status: i % 5 === 0 ? SessionStatus.COMPLETED : SessionStatus.SCHEDULED,
        attendanceLocked: i % 7 === 0,
      }));

      const attendances: AttendanceSafetyRecord[] = sessions.map((s, idx) => ({
        id: `att-f500-${idx}`,
        classSessionId: s.id,
        studentId,
        billId: idx % 10 === 0 ? 'bill-500' : null,
        isPresent: idx % 3 === 0,
      }));

      const startTime = performance.now();
      const safeIds = AttendanceDeletionGuard.filterSafeFutureAttendanceToDelete(
        studentId,
        '2026-08-01',
        sessions,
        attendances,
      );
      const durationMs = performance.now() - startTime;

      expect(Array.isArray(safeIds)).toBe(true);
      // SLA Time Limit < 10ms
      expect(durationMs).toBeLessThan(10);
    });
  });
});
