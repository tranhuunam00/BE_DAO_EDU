import {
  AttendanceDeletionGuard,
  AttendanceSafetySession,
  AttendanceSafetyRecord,
} from '../../../../../../src/modules/academics/domain/services/attendance-deletion-guard.service';
import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';
import { SessionStatus } from '../../../../../../src/domain/value-objects/session-status.enum';

describe('CH-01 Part 1: Comprehensive Attendance Deletion Safety Guard (30 Cases)', () => {
  const mockClassId = 'class-safety-01';
  const studentId = 'st-student-01';

  // =========================================================================
  // NHÓM A: TRẠNG THÁI CA HỌC & VÒNG ĐỜI (CASES 01 - 10)
  // =========================================================================
  describe('Nhóm A: Trạng thái Ca học & Vòng đời (10 Cases)', () => {
    it('Case 01: Ca học Scheduled (chưa diễn ra, chưa khóa, chưa hóa đơn) -> Cho phép xóa an toàn', () => {
      const session: AttendanceSafetySession = { id: 's1', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att: AttendanceSafetyRecord = { id: 'a1', classSessionId: 's1', studentId, billId: null, isPresent: false };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(true);
    });

    it('Case 02: Ca học In-Progress (đang học) -> Tuyệt đối chặn xóa điểm danh', () => {
      const session: AttendanceSafetySession = { id: 's2', classId: mockClassId, date: '2026-05-01', status: SessionStatus.IN_PROGRESS, attendanceLocked: false };
      const att: AttendanceSafetyRecord = { id: 'a2', classSessionId: 's2', studentId, billId: null, isPresent: false };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });

    it('Case 03: Ca học Completed (đã hoàn thành nhưng chưa bấm nút khóa) -> Tuyệt đối chặn xóa điểm danh', () => {
      const session: AttendanceSafetySession = { id: 's3', classId: mockClassId, date: '2026-05-01', status: SessionStatus.COMPLETED, attendanceLocked: false };
      const att: AttendanceSafetyRecord = { id: 'a3', classSessionId: 's3', studentId, billId: null, isPresent: false };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });

    it('Case 04: Ca học Completed và đã khóa (attendanceLocked = true) -> Tuyệt đối chặn xóa điểm danh', () => {
      const session: AttendanceSafetySession = { id: 's4', classId: mockClassId, date: '2026-05-01', status: SessionStatus.COMPLETED, attendanceLocked: true };
      const att: AttendanceSafetyRecord = { id: 'a4', classSessionId: 's4', studentId, billId: null, isPresent: false };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });

    it('Case 05: Ca học Cancelled (đã hủy) -> Chặn xóa điểm danh để lưu vết lịch sử lớp bị hủy', () => {
      const session: AttendanceSafetySession = { id: 's5', classId: mockClassId, date: '2026-05-01', status: SessionStatus.CANCELLED, attendanceLocked: false };
      const att: AttendanceSafetyRecord = { id: 'a5', classSessionId: 's5', studentId, billId: null, isPresent: false };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });

    it('Case 06: Ca học Scheduled nhưng đã bị khóa điểm danh (attendanceLocked = true) -> Chặn xóa', () => {
      const session: AttendanceSafetySession = { id: 's6', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: true };
      const att: AttendanceSafetyRecord = { id: 'a6', classSessionId: 's6', studentId, billId: null, isPresent: false };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });

    it('Case 07: ValidateSafeToUpdateJoinedDate quăng AcademicError chi tiết khi có ca In-Progress trước ngày mới', () => {
      const sessions = [{ id: 's7', classId: mockClassId, date: '2026-05-10', status: SessionStatus.IN_PROGRESS, attendanceLocked: false }];
      const attendances = [{ id: 'a7', classSessionId: 's7', studentId, isPresent: false }];
      expect(() => {
        AttendanceDeletionGuard.validateSafeToUpdateJoinedDate({ studentId, newJoinedDate: '2026-06-01', sessions, attendances });
      }).toThrow(AcademicError);
    });

    it('Case 08: ValidateSafeToUpdateJoinedDate quăng AcademicError khi có ca Completed trước ngày mới', () => {
      const sessions = [{ id: 's8', classId: mockClassId, date: '2026-05-20', status: SessionStatus.COMPLETED, attendanceLocked: false }];
      const attendances = [{ id: 'a8', classSessionId: 's8', studentId, isPresent: false }];
      expect(() => {
        AttendanceDeletionGuard.validateSafeToUpdateJoinedDate({ studentId, newJoinedDate: '2026-06-01', sessions, attendances });
      }).toThrow(AcademicError);
    });

    it('Case 09: ValidateSafeToUpdateJoinedDate quăng AcademicError khi có ca Cancelled trước ngày mới', () => {
      const sessions = [{ id: 's9', classId: mockClassId, date: '2026-05-25', status: SessionStatus.CANCELLED, attendanceLocked: false }];
      const attendances = [{ id: 'a9', classSessionId: 's9', studentId, isPresent: false }];
      expect(() => {
        AttendanceDeletionGuard.validateSafeToUpdateJoinedDate({ studentId, newJoinedDate: '2026-06-01', sessions, attendances });
      }).toThrow(AcademicError);
    });

    it('Case 10: Ca học diễn ra đúng ngày newJoinedDate -> Không bị xóa mà được giữ nguyên', () => {
      const session = { id: 's10', classId: mockClassId, date: '2026-06-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a10', classSessionId: 's10', studentId, isPresent: false };
      const res = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId,
        newJoinedDate: '2026-06-01',
        sessions: [session],
        existingAttendances: [att],
      });
      expect(res.deletedAttendanceIds).toHaveLength(0);
    });
  });

  // =========================================================================
  // NHÓM B: TÍNH TOÀN VẸN TÀI CHÍNH & HÓA ĐƠN (CASES 11 - 20)
  // =========================================================================
  describe('Nhóm B: Tính toàn vẹn Tài chính & Hóa đơn (10 Cases)', () => {
    it('Case 11: Điểm danh có billId != null (hóa đơn Unpaid) -> Tuyệt đối chặn xóa', () => {
      const session = { id: 's11', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a11', classSessionId: 's11', studentId, billId: 'bill-unpaid-01', isPresent: false };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });

    it('Case 12: Điểm danh có billId != null (hóa đơn Paid) -> Tuyệt đối chặn xóa', () => {
      const session = { id: 's12', classId: mockClassId, date: '2026-05-01', status: SessionStatus.COMPLETED, attendanceLocked: true };
      const att = { id: 'a12', classSessionId: 's12', studentId, billId: 'bill-paid-01', isPresent: true };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });

    it('Case 13: Điểm danh có billId nhưng session status vẫn là Scheduled (dữ liệu bất thường) -> Vẫn bảo vệ hóa đơn', () => {
      const session = { id: 's13', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a13', classSessionId: 's13', studentId, billId: 'bill-edge-01', isPresent: false };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });

    it('Case 14: Thông báo lỗi chỉ rõ "đã được xuất hóa đơn thu học phí" khi gặp billId', () => {
      const session = { id: 's14', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a14', classSessionId: 's14', studentId, billId: 'bill-01', isPresent: false };
      expect(AttendanceDeletionGuard.getUnsafeReason(session, att)).toBe('đã được xuất hóa đơn thu học phí');
    });

    it('Case 15: Đổi joinedDate lùi về quá khứ -> Không có ca học nào bị xóa, tự động sinh điểm danh bổ sung', () => {
      const sessions = [
        { id: 's15-1', classId: mockClassId, date: '2026-04-01', status: SessionStatus.SCHEDULED, attendanceLocked: false },
        { id: 's15-2', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false },
      ];
      const res = AttendanceDeletionGuard.syncAttendanceForStudent({
        studentId,
        newJoinedDate: '2026-04-01',
        sessions,
        existingAttendances: [{ id: 'a15-2', classSessionId: 's15-2', studentId, isPresent: false }],
      });
      expect(res.deletedAttendanceIds).toHaveLength(0);
      expect(res.createdAttendanceRecords).toHaveLength(1);
      expect(res.createdAttendanceRecords[0].classSessionId).toBe('s15-1');
    });

    it('Case 16: Điểm danh vắng mặt (isPresent = false) nhưng đã chốt hóa đơn rate = 0 -> Vẫn chặn xóa bảo toàn audit trail', () => {
      const session = { id: 's16', classId: mockClassId, date: '2026-05-01', status: SessionStatus.COMPLETED, attendanceLocked: true };
      const att = { id: 'a16', classSessionId: 's16', studentId, billId: 'bill-zero-rate', isPresent: false };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });

    it('Case 17: Nhiều ca học trước ngày mới, chỉ 1 ca có billId -> Chặn toàn bộ tiến trình', () => {
      const sessions = [
        { id: 's17-1', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false },
        { id: 's17-2', classId: mockClassId, date: '2026-05-15', status: SessionStatus.SCHEDULED, attendanceLocked: false },
      ];
      const attendances = [
        { id: 'a17-1', classSessionId: 's17-1', studentId, billId: null, isPresent: false },
        { id: 'a17-2', classSessionId: 's17-2', studentId, billId: 'bill-17', isPresent: false },
      ];
      expect(() => {
        AttendanceDeletionGuard.validateSafeToUpdateJoinedDate({ studentId, newJoinedDate: '2026-06-01', sessions, attendances });
      }).toThrow(AcademicError);
    });

    it('Case 18: Học sinh A có billId, học sinh B không có billId -> Chặn đúng học sinh A, không nhầm lẫn', () => {
      const session = { id: 's18', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const attA = { id: 'a18-a', classSessionId: 's18', studentId: 'st-A', billId: 'bill-A', isPresent: false };
      const attB = { id: 'a18-b', classSessionId: 's18', studentId: 'st-B', billId: null, isPresent: false };

      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, attA)).toBe(false);
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, attB)).toBe(true);
    });

    it('Case 19: Xóa điểm danh khi billId = undefined -> Được coi như chưa có hóa đơn (hợp lệ)', () => {
      const session = { id: 's19', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a19', classSessionId: 's19', studentId, billId: undefined, isPresent: false };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(true);
    });

    it('Case 20: Điểm danh có billId rỗng "" -> Không được xóa vì chuỗi rỗng vẫn là dữ liệu có giá trị', () => {
      const session = { id: 's20', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a20', classSessionId: 's20', studentId, billId: 'INV-TEMP', isPresent: false };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });
  });

  // =========================================================================
  // NHÓM C: ĐIỂM DANH THỰC TẾ, CHẤM CÔNG & PHÉP (CASES 21 - 30)
  // =========================================================================
  describe('Nhóm C: Điểm danh Thực tế, Chấm công & Phép (10 Cases)', () => {
    it('Case 21: Điểm danh thủ công isPresent = true -> Chặn xóa điểm danh', () => {
      const session = { id: 's21', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a21', classSessionId: 's21', studentId, isPresent: true };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
      expect(AttendanceDeletionGuard.getUnsafeReason(session, att)).toBe('đã ghi nhận có mặt');
    });

    it('Case 22: Điểm danh FaceID (verifyMethod = face) -> Chặn xóa điểm danh', () => {
      const session = { id: 's22', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a22', classSessionId: 's22', studentId, isPresent: false, verifyMethod: 'face' };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
      expect(AttendanceDeletionGuard.getUnsafeReason(session, att)).toContain('chấm công qua face');
    });

    it('Case 23: Điểm danh Vân tay (verifyMethod = fingerprint) -> Chặn xóa điểm danh', () => {
      const session = { id: 's23', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a23', classSessionId: 's23', studentId, isPresent: false, verifyMethod: 'fingerprint' };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });

    it('Case 24: Điểm danh Thẻ từ (verifyMethod = card) -> Chặn xóa điểm danh', () => {
      const session = { id: 's24', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a24', classSessionId: 's24', studentId, isPresent: false, verifyMethod: 'card' };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });

    it('Case 25: Học sinh đi muộn (isLate = true, lateMinutes = 15) -> Chặn xóa bảo toàn kỷ luật', () => {
      const session = { id: 's25', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a25', classSessionId: 's25', studentId, isPresent: false, isLate: true, lateMinutes: 15 };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
      expect(AttendanceDeletionGuard.getUnsafeReason(session, att)).toBe('có ghi nhận đi muộn');
    });

    it('Case 26: Học sinh có đơn xin nghỉ phép đã duyệt (leaveStatus = approved) -> Chặn xóa giữ nguyên phép', () => {
      const session = { id: 's26', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a26', classSessionId: 's26', studentId, isPresent: false, leaveStatus: 'approved' };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
      expect(AttendanceDeletionGuard.getUnsafeReason(session, att)).toBe('có đơn xin nghỉ phép đã duyệt');
    });

    it('Case 27: Học sinh có đơn xin nghỉ phép chờ duyệt (leaveStatus = pending) -> Chặn xóa giữ nguyên đơn', () => {
      const session = { id: 's27', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a27', classSessionId: 's27', studentId, isPresent: false, leaveStatus: 'pending' };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });

    it('Case 28: Đơn nghỉ phép bị từ chối (leaveStatus = rejected) và chưa điểm danh có mặt -> Được phép xóa an toàn', () => {
      const session = { id: 's28', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a28', classSessionId: 's28', studentId, isPresent: false, leaveStatus: 'rejected' };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(true);
    });

    it('Case 29: Điểm danh có nhận xét học tập của giáo viên (evaluationComment) -> Chặn xóa bảo toàn nhận xét', () => {
      const session = { id: 's29', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a29', classSessionId: 's29', studentId, isPresent: false, evaluationComment: 'Hôm nay con ngoan' };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
      expect(AttendanceDeletionGuard.getUnsafeReason(session, att)).toBe('có nhận xét học tập của giáo viên');
    });

    it('Case 30: Điểm danh có điểm số đánh giá cũ (evaluationScore) -> Chặn xóa bảo toàn điểm số', () => {
      const session = { id: 's30', classId: mockClassId, date: '2026-05-01', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      const att = { id: 'a30', classSessionId: 's30', studentId, isPresent: false, evaluationScore: '8.5' };
      expect(AttendanceDeletionGuard.isAttendanceSafeToDelete(session, att)).toBe(false);
    });
  });
});
