import { AcademicError } from '../errors/academic.error';
import { SessionStatus } from '../../../../domain/value-objects/session-status.enum';

export interface AttendanceSafetySession {
  id: string;
  classId: string;
  date: string;
  status: SessionStatus | string;
  attendanceLocked: boolean;
  wageId?: string | null;
  assistantWageId?: string | null;
  billedTeacherWage?: number | null;
  billedAssistantWage?: number | null;
}

export interface AttendanceSafetyRecord {
  id: string;
  classSessionId: string;
  studentId: string;
  billId?: string | null;
  isPresent?: boolean;
  verifyMethod?: string | null;
  attendanceType?: string | null;
  isLate?: boolean;
  lateMinutes?: number;
  leaveStatus?: 'pending' | 'approved' | 'rejected' | null;
  evaluationComment?: string | null;
  evaluationScore?: string | null;
  note?: string | null;
  reason?: string | null;
}

export interface AttendanceSafetyClassStudent {
  classId: string;
  studentId: string;
  studentName?: string;
  joinedDate: string;
  status: 'Active' | 'Dropped' | 'Suspended' | string;
}

export interface SyncAttendanceResult {
  deletedAttendanceIds: string[];
  createdAttendanceRecords: Array<{ classSessionId: string; studentId: string; isPresent: boolean }>;
  affectedStudentCount: number;
}

/**
 * AttendanceDeletionGuard
 * Bộ quy tắc nghiệp vụ bảo vệ toàn vẹn dữ liệu điểm danh và tài chính (Zero-dependency).
 */
export class AttendanceDeletionGuard {
  /**
   * Kiểm tra một bản ghi điểm danh có thỏa mãn 100% điều kiện an toàn để xóa hay không.
   */
  static isAttendanceSafeToDelete(
    session: AttendanceSafetySession,
    attendance: AttendanceSafetyRecord,
  ): boolean {
    // 1. Phải là buổi học chưa diễn ra (Scheduled)
    if (session.status !== SessionStatus.SCHEDULED) {
      return false;
    }

    // 2. Buổi học chưa bị khóa điểm danh
    if (session.attendanceLocked) {
      return false;
    }

    // 3. Chưa bị xuất hóa đơn thu học phí
    if (attendance.billId !== null && attendance.billId !== undefined) {
      return false;
    }

    // 4. Chưa từng được điểm danh có mặt (thủ công hoặc máy)
    if (attendance.isPresent === true) {
      return false;
    }

    // 5. Không có dữ liệu xác thực chấm công máy (Face/Fingerprint/Card/PIN)
    if (attendance.verifyMethod) {
      return false;
    }

    // 6. Không có ghi nhận đi muộn
    if (attendance.isLate === true || (attendance.lateMinutes && attendance.lateMinutes > 0)) {
      return false;
    }

    // 7. Không có đơn xin nghỉ phép hợp lệ đang lưu vết
    if (attendance.leaveStatus === 'approved' || attendance.leaveStatus === 'pending') {
      return false;
    }

    // 8. Không có dữ liệu nhận xét/đánh giá cũ cần bảo tồn
    if (attendance.evaluationComment?.trim() || attendance.evaluationScore?.trim()) {
      return false;
    }

    return true;
  }

  /**
   * Kiểm tra lý do không an toàn của bản ghi để hiển thị thông báo lỗi chi tiết cho người dùng
   */
  static getUnsafeReason(
    session: AttendanceSafetySession,
    attendance: AttendanceSafetyRecord,
  ): string {
    if (attendance.billId) return 'đã được xuất hóa đơn thu học phí';
    if (session.status === SessionStatus.COMPLETED) return 'đã hoàn thành';
    if (session.status === SessionStatus.IN_PROGRESS) return 'đang diễn ra';
    if (session.status === SessionStatus.CANCELLED) return 'đã bị hủy';
    if (session.attendanceLocked) return 'đã khóa điểm danh';
    if (attendance.isPresent) return 'đã ghi nhận có mặt';
    if (attendance.verifyMethod) return `đã ghi nhận chấm công qua ${attendance.verifyMethod}`;
    if (attendance.isLate) return 'có ghi nhận đi muộn';
    if (attendance.leaveStatus === 'approved') return 'có đơn xin nghỉ phép đã duyệt';
    if (attendance.leaveStatus === 'pending') return 'có đơn xin nghỉ phép chờ duyệt';
    if (attendance.evaluationComment?.trim()) return 'có nhận xét học tập của giáo viên';
    return `trạng thái buổi học là ${session.status}`;
  }

  /**
   * Xác thực điều kiện an toàn khi cập nhật ngày vào lớp (joinedDate) cho 1 học sinh.
   */
  static validateSafeToUpdateJoinedDate(params: {
    studentId: string;
    studentName?: string;
    newJoinedDate: string;
    sessions: AttendanceSafetySession[];
    attendances: AttendanceSafetyRecord[];
  }): void {
    const { studentId, studentName, newJoinedDate, sessions, attendances } = params;
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    const normalizedNewDate = newJoinedDate.slice(0, 10);

    const conflicts: string[] = [];

    for (const att of attendances) {
      if (att.studentId !== studentId) continue;
      const session = sessionMap.get(att.classSessionId);
      if (!session) continue;

      const sessionDate = session.date.slice(0, 10);
      if (sessionDate < normalizedNewDate) {
        if (!this.isAttendanceSafeToDelete(session, att)) {
          const reason = this.getUnsafeReason(session, att);
          conflicts.push(`buổi ngày ${sessionDate} (${reason})`);
        }
      }
    }

    if (conflicts.length > 0) {
      const studentLabel = studentName ? `của học sinh ${studentName}` : `(ID: ${studentId})`;
      throw new AcademicError(
        'CANNOT_MODIFY_JOINED_DATE_PROTECTED',
        `Không thể thay đổi ngày vào lớp ${studentLabel} thành ${normalizedNewDate} vì có ${conflicts.length} buổi học trước ngày này không được phép xóa: ${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? '...' : ''}.`,
      );
    }
  }

  /**
   * Đồng bộ điểm danh cho 1 học sinh khi ngày vào lớp đã hợp lệ (Tối ưu tốc độ cao).
   */
  static syncAttendanceForStudent(params: {
    studentId: string;
    newJoinedDate: string;
    sessions: AttendanceSafetySession[];
    existingAttendances: AttendanceSafetyRecord[];
  }): SyncAttendanceResult {
    const { studentId, newJoinedDate, sessions, existingAttendances } = params;
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    const normalizedNewDate = newJoinedDate.slice(0, 10);

    const studentAtts: AttendanceSafetyRecord[] = [];
    const existingSessionIds = new Set<string>();

    for (const a of existingAttendances) {
      if (a.studentId === studentId) {
        studentAtts.push(a);
        existingSessionIds.add(a.classSessionId);
      }
    }

    const deletedAttendanceIds: string[] = [];
    const createdAttendanceRecords: Array<{
      classSessionId: string;
      studentId: string;
      isPresent: boolean;
    }> = [];

    // 1. Chỉ xóa các bản ghi điểm danh trước newJoinedDate NẾU an toàn tuyệt đối
    for (const att of studentAtts) {
      const session = sessionMap.get(att.classSessionId);
      if (session) {
        const sessionDate = session.date.slice(0, 10);
        if (sessionDate < normalizedNewDate && this.isAttendanceSafeToDelete(session, att)) {
          deletedAttendanceIds.push(att.id);
        }
      }
    }

    // 2. Tạo mới điểm danh cho các buổi học từ newJoinedDate trở đi nếu chưa có
    for (const session of sessions) {
      const sessionDate = session.date.slice(0, 10);
      if (sessionDate >= normalizedNewDate) {
        if (!existingSessionIds.has(session.id)) {
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
   * Đồng bộ hàng loạt cho toàn bộ học sinh trong lớp (Tối ưu siêu tốc độ O(N + M)).
   */
  static syncAttendanceForAllStudents(params: {
    students: AttendanceSafetyClassStudent[];
    newJoinedDate: string;
    sessions: AttendanceSafetySession[];
    existingAttendances: AttendanceSafetyRecord[];
  }): SyncAttendanceResult {
    const { students, newJoinedDate, sessions, existingAttendances } = params;
    const normalizedNewDate = newJoinedDate.slice(0, 10);

    // 1. Tiền xử lý session cache (chỉ duyệt 1 lần)
    interface CachedSession {
      session: AttendanceSafetySession;
      isBeforeNewDate: boolean;
    }
    const sessionCache = new Map<string, CachedSession>();
    const sessionsAfterNewDate: AttendanceSafetySession[] = [];

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const sDate = s.date.slice(0, 10);
      const isBefore = sDate < normalizedNewDate;
      sessionCache.set(s.id, { session: s, isBeforeNewDate: isBefore });
      if (!isBefore) {
        sessionsAfterNewDate.push(s);
      }
    }

    // 2. Tiền xử lý điểm danh theo từng học sinh trong 1 pass duy nhất O(M)
    interface StudentAttData {
      deletedIds: string[];
      conflicts: string[];
      existingSessionIds: Set<string>;
    }
    const studentDataMap = new Map<string, StudentAttData>();

    for (let i = 0; i < existingAttendances.length; i++) {
      const att = existingAttendances[i];
      let data = studentDataMap.get(att.studentId);
      if (!data) {
        data = {
          deletedIds: [],
          conflicts: [],
          existingSessionIds: new Set<string>(),
        };
        studentDataMap.set(att.studentId, data);
      }
      data.existingSessionIds.add(att.classSessionId);

      const cached = sessionCache.get(att.classSessionId);
      if (cached && cached.isBeforeNewDate) {
        if (this.isAttendanceSafeToDelete(cached.session, att)) {
          data.deletedIds.push(att.id);
        } else {
          const reason = this.getUnsafeReason(cached.session, att);
          data.conflicts.push(`buổi ngày ${cached.session.date.slice(0, 10)} (${reason})`);
        }
      }
    }

    // 3. Fail-fast kiểm tra và tổng hợp kết quả O(N)
    const allDeletedIds: string[] = [];
    const allCreatedRecords: Array<{
      classSessionId: string;
      studentId: string;
      isPresent: boolean;
    }> = [];

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const studentId = student.studentId;
      const data = studentDataMap.get(studentId);

      if (data && data.conflicts.length > 0) {
        const studentLabel = student.studentName
          ? `của học sinh ${student.studentName}`
          : `(ID: ${studentId})`;
        throw new AcademicError(
          'CANNOT_MODIFY_JOINED_DATE_PROTECTED',
          `Không thể thay đổi ngày vào lớp ${studentLabel} thành ${normalizedNewDate} vì có ${data.conflicts.length} buổi học trước ngày này không được phép xóa: ${data.conflicts.slice(0, 3).join(', ')}${data.conflicts.length > 3 ? '...' : ''}.`,
        );
      }

      if (data && data.deletedIds.length > 0) {
        for (let d = 0; d < data.deletedIds.length; d++) {
          allDeletedIds.push(data.deletedIds[d]);
        }
      }

      const existingSessions = data?.existingSessionIds;
      for (let s = 0; s < sessionsAfterNewDate.length; s++) {
        const sess = sessionsAfterNewDate[s];
        if (!existingSessions || !existingSessions.has(sess.id)) {
          allCreatedRecords.push({
            classSessionId: sess.id,
            studentId,
            isPresent: false,
          });
        }
      }
    }

    return {
      deletedAttendanceIds: allDeletedIds,
      createdAttendanceRecords: allCreatedRecords,
      affectedStudentCount: students.length,
    };
  }

  /**
   * Lọc danh sách điểm danh tương lai an toàn để xóa khi kick học sinh khỏi lớp (removeStudent).
   */
  static filterSafeFutureAttendanceToDelete(
    studentId: string,
    effectiveDate: string,
    sessions: AttendanceSafetySession[],
    attendances: AttendanceSafetyRecord[],
  ): string[] {
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    const normalizedEffectiveDate = effectiveDate.slice(0, 10);
    const idsToDelete: string[] = [];

    for (const att of attendances) {
      if (att.studentId !== studentId) continue;
      const session = sessionMap.get(att.classSessionId);
      if (!session) continue;

      const sessionDate = session.date.slice(0, 10);
      if (sessionDate >= normalizedEffectiveDate) {
        if (this.isAttendanceSafeToDelete(session, att)) {
          idsToDelete.push(att.id);
        }
      }
    }

    return idsToDelete;
  }

  /**
   * Xác thực điều kiện an toàn khi xóa 1 buổi học (deleteSession).
   */
  static validateSafeToDeleteSession(
    session: AttendanceSafetySession,
    attendances: AttendanceSafetyRecord[],
  ): void {
    if (session.status !== SessionStatus.SCHEDULED) {
      throw new AcademicError(
        'CANNOT_DELETE_SESSION_PROTECTED',
        `Không thể xóa buổi học ở trạng thái "${session.status}". Chỉ cho phép xóa các buổi học chưa diễn ra (Scheduled).`,
      );
    }

    if (session.attendanceLocked) {
      throw new AcademicError(
        'ATTENDANCE_LOCKED',
        'Không thể xóa buổi học vì buổi học đã bị khóa điểm danh.',
      );
    }

    const hasTeacherWage = Boolean(
      session.wageId ||
      (session.billedTeacherWage !== undefined && session.billedTeacherWage !== null && Number(session.billedTeacherWage) > 0),
    );
    const hasAssistantWage = Boolean(
      session.assistantWageId ||
      (session.billedAssistantWage !== undefined && session.billedAssistantWage !== null && Number(session.billedAssistantWage) > 0),
    );

    if (hasTeacherWage || hasAssistantWage) {
      throw new AcademicError(
        'CANNOT_DELETE_SESSION_PROTECTED',
        'Không thể xóa buổi học vì buổi học đã được tính thù lao giáo viên/trợ giảng.',
      );
    }

    const billedAttendances = attendances.filter((a) => a.billId != null);
    if (billedAttendances.length > 0) {
      throw new AcademicError(
        'ATTENDANCE_ALREADY_BILLED',
        `Không thể xóa buổi học vì có ${billedAttendances.length} bản ghi điểm danh đã được chốt hóa đơn thu học phí.`,
      );
    }

    const activeAttendances = attendances.filter(
      (a) =>
        a.isPresent === true ||
        Boolean(a.verifyMethod) ||
        a.isLate === true ||
        Boolean(a.lateMinutes && a.lateMinutes > 0) ||
        a.leaveStatus === 'approved' ||
        a.leaveStatus === 'pending' ||
        Boolean(a.evaluationComment?.trim()) ||
        Boolean(a.evaluationScore?.trim()),
    );
    if (activeAttendances.length > 0) {
      throw new AcademicError(
        'ATTENDANCE_ATTENDED_CONFLICT',
        `Không thể xóa buổi học vì có ${activeAttendances.length} học sinh đã phát sinh dữ liệu điểm danh (có mặt, chấm công, đi muộn, đơn phép hoặc nhận xét).`,
      );
    }
  }

  /**
   * Lọc danh sách ID các buổi học tương lai thực sự an toàn để xóa khi tái tạo lịch (regenerateFutureSessions).
   */
  static filterSafeSessionsToDelete(
    sessions: AttendanceSafetySession[],
    attendances: AttendanceSafetyRecord[],
  ): string[] {
    const unsafeSessionIds = new Set<string>();

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const hasTeacherWage = Boolean(
        session.wageId ||
        (session.billedTeacherWage !== undefined && session.billedTeacherWage !== null && Number(session.billedTeacherWage) > 0),
      );
      const hasAssistantWage = Boolean(
        session.assistantWageId ||
        (session.billedAssistantWage !== undefined && session.billedAssistantWage !== null && Number(session.billedAssistantWage) > 0),
      );
      if (
        session.status !== SessionStatus.SCHEDULED ||
        session.attendanceLocked ||
        hasTeacherWage ||
        hasAssistantWage
      ) {
        unsafeSessionIds.add(session.id);
      }
    }

    for (let i = 0; i < attendances.length; i++) {
      const att = attendances[i];
      if (unsafeSessionIds.has(att.classSessionId)) continue;
      if (
        (att.billId !== null && att.billId !== undefined) ||
        att.isPresent === true ||
        Boolean(att.verifyMethod) ||
        att.isLate === true ||
        (att.lateMinutes !== undefined && att.lateMinutes !== null && att.lateMinutes > 0) ||
        att.leaveStatus === 'approved' ||
        att.leaveStatus === 'pending' ||
        (att.evaluationComment !== undefined && att.evaluationComment !== null && att.evaluationComment !== '') ||
        (att.evaluationScore !== undefined && att.evaluationScore !== null && att.evaluationScore !== '')
      ) {
        unsafeSessionIds.add(att.classSessionId);
      }
    }

    const safeSessionIds: string[] = [];
    for (const session of sessions) {
      if (!unsafeSessionIds.has(session.id)) {
        safeSessionIds.push(session.id);
      }
    }

    return safeSessionIds;
  }
}
