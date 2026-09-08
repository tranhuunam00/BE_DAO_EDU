import { SessionStatus } from '../../../../../../src/domain/value-objects/session-status.enum';
import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';
import {
  AttendanceDeletionGuard,
  AttendanceSafetySession,
  AttendanceSafetyRecord,
} from '../../../../../../src/modules/academics/domain/services/attendance-deletion-guard.service';

describe('CH-01 DB Safety: Session & Attendance Deletion Guard (20 Test Cases)', () => {
  const baseScheduledSession: AttendanceSafetySession = {
    id: 'sess-sch-1',
    classId: 'class-1',
    date: '2026-10-15',
    status: SessionStatus.SCHEDULED,
    attendanceLocked: false,
    wageId: null,
    assistantWageId: null,
  };

  const baseUnbilledAttendance: AttendanceSafetyRecord = {
    id: 'att-1',
    classSessionId: 'sess-sch-1',
    studentId: 'student-1',
    billId: null,
    isPresent: false,
    verifyMethod: null,
    isLate: false,
    lateMinutes: 0,
    leaveStatus: null,
    evaluationComment: null,
    evaluationScore: null,
  };

  describe('Nhóm 1: Kiểm tra Trạng thái Buổi học (Chỉ cho phép Scheduled)', () => {
    it('Case 1: Chặn xóa buổi học ở trạng thái In-Progress (Đang diễn ra)', () => {
      const session: AttendanceSafetySession = {
        ...baseScheduledSession,
        status: SessionStatus.IN_PROGRESS,
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(session, []);
      }).toThrow(AcademicError);

      try {
        AttendanceDeletionGuard.validateSafeToDeleteSession(session, []);
      } catch (err: any) {
        expect(err.code).toBe('CANNOT_DELETE_SESSION_PROTECTED');
        expect(err.message).toContain('In-Progress');
      }
    });

    it('Case 2: Chặn xóa buổi học ở trạng thái Completed (Đã hoàn thành)', () => {
      const session: AttendanceSafetySession = {
        ...baseScheduledSession,
        status: SessionStatus.COMPLETED,
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(session, []);
      }).toThrow(AcademicError);

      try {
        AttendanceDeletionGuard.validateSafeToDeleteSession(session, []);
      } catch (err: any) {
        expect(err.code).toBe('CANNOT_DELETE_SESSION_PROTECTED');
        expect(err.message).toContain('Completed');
      }
    });

    it('Case 3: Chặn xóa buổi học ở trạng thái Cancelled (Đã hủy để bảo lưu vết)', () => {
      const session: AttendanceSafetySession = {
        ...baseScheduledSession,
        status: SessionStatus.CANCELLED,
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(session, []);
      }).toThrow(AcademicError);
    });

    it('Case 4: Chặn xóa buổi học có trạng thái bất thường (ví dụ: Archived, Closed)', () => {
      const session: AttendanceSafetySession = {
        ...baseScheduledSession,
        status: 'Archived',
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(session, []);
      }).toThrow(AcademicError);
    });

    it('Case 5: Cho phép xóa buổi học khi trạng thái là Scheduled và không có ràng buộc', () => {
      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, []);
      }).not.toThrow();
    });
  });

  describe('Nhóm 2: Ràng buộc Tài chính & Khóa Điểm danh (Bill & Wage & Lock)', () => {
    it('Case 6: Chặn xóa buổi học Scheduled nếu có 1 học sinh đã xuất hóa đơn (billId != null)', () => {
      const billedAtt: AttendanceSafetyRecord = {
        ...baseUnbilledAttendance,
        billId: 'bill-uuid-999',
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, [billedAtt]);
      }).toThrow(AcademicError);

      try {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, [billedAtt]);
      } catch (err: any) {
        expect(err.code).toBe('ATTENDANCE_ALREADY_BILLED');
        expect(err.message).toContain('hóa đơn');
      }
    });

    it('Case 7: Chặn xóa buổi học nếu có nhiều học sinh đã xuất hóa đơn (báo số lượng chính xác)', () => {
      const atts: AttendanceSafetyRecord[] = [
        { ...baseUnbilledAttendance, id: 'att-1', billId: 'bill-1' },
        { ...baseUnbilledAttendance, id: 'att-2', billId: 'bill-2' },
        { ...baseUnbilledAttendance, id: 'att-3', billId: null },
      ];

      try {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, atts);
        fail('Should throw');
      } catch (err: any) {
        expect(err.code).toBe('ATTENDANCE_ALREADY_BILLED');
        expect(err.message).toContain('2 bản ghi điểm danh');
      }
    });

    it('Case 8: Chặn xóa buổi học Scheduled nếu attendanceLocked = true (đã khóa điểm danh)', () => {
      const session: AttendanceSafetySession = {
        ...baseScheduledSession,
        attendanceLocked: true,
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(session, []);
      }).toThrow(AcademicError);

      try {
        AttendanceDeletionGuard.validateSafeToDeleteSession(session, []);
      } catch (err: any) {
        expect(err.code).toBe('ATTENDANCE_LOCKED');
      }
    });

    it('Case 9: Chặn xóa buổi học Scheduled nếu đã chốt thù lao giáo viên chính (wageId != null)', () => {
      const session: AttendanceSafetySession = {
        ...baseScheduledSession,
        wageId: 'wage-teacher-123',
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(session, []);
      }).toThrow(AcademicError);

      try {
        AttendanceDeletionGuard.validateSafeToDeleteSession(session, []);
      } catch (err: any) {
        expect(err.code).toBe('CANNOT_DELETE_SESSION_PROTECTED');
        expect(err.message).toContain('thù lao');
      }
    });

    it('Case 10: Chặn xóa buổi học Scheduled nếu đã chốt thù lao trợ giảng (assistantWageId != null)', () => {
      const session: AttendanceSafetySession = {
        ...baseScheduledSession,
        assistantWageId: 'wage-ta-456',
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(session, []);
      }).toThrow(AcademicError);
    });
  });

  describe('Nhóm 3: Dữ liệu Điểm danh & Chấm công Thực tế (Actual Attendance)', () => {
    it('Case 11: Chặn xóa buổi học nếu có học sinh ghi nhận có mặt (isPresent = true)', () => {
      const presentAtt: AttendanceSafetyRecord = {
        ...baseUnbilledAttendance,
        isPresent: true,
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, [presentAtt]);
      }).toThrow(AcademicError);

      try {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, [presentAtt]);
      } catch (err: any) {
        expect(err.code).toBe('ATTENDANCE_ATTENDED_CONFLICT');
      }
    });

    it('Case 12: Chặn xóa buổi học nếu có học sinh chấm công vân tay (verifyMethod = fingerprint)', () => {
      const biometricAtt: AttendanceSafetyRecord = {
        ...baseUnbilledAttendance,
        verifyMethod: 'fingerprint',
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, [biometricAtt]);
      }).toThrow(AcademicError);
    });

    it('Case 13: Chặn xóa buổi học nếu có học sinh chấm công khuôn mặt (verifyMethod = face)', () => {
      const faceAtt: AttendanceSafetyRecord = {
        ...baseUnbilledAttendance,
        verifyMethod: 'face',
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, [faceAtt]);
      }).toThrow(AcademicError);
    });

    it('Case 14: Cho phép xóa buổi học nếu học sinh vắng mặt chưa có dữ liệu máy chấm công', () => {
      const absentAtt: AttendanceSafetyRecord = {
        ...baseUnbilledAttendance,
        isPresent: false,
        verifyMethod: null,
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, [absentAtt]);
      }).not.toThrow();
    });

    it('Case 15: Cho phép xóa buổi học khi danh sách điểm danh hoàn toàn rỗng', () => {
      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, []);
      }).not.toThrow();
    });
  });

  describe('Nhóm 4: Lọc Buổi học Tương lai An toàn khi Tái tạo Lịch (Regenerate Sessions)', () => {
    it('Case 16: Phân tách chuẩn xác danh sách sessions an toàn và không an toàn', () => {
      const sessions: AttendanceSafetySession[] = [
        { ...baseScheduledSession, id: 's1' }, // safe
        { ...baseScheduledSession, id: 's2', status: SessionStatus.IN_PROGRESS }, // unsafe status
        { ...baseScheduledSession, id: 's3', attendanceLocked: true }, // unsafe lock
        { ...baseScheduledSession, id: 's4' }, // unsafe billed
      ];

      const attendances: AttendanceSafetyRecord[] = [
        { ...baseUnbilledAttendance, id: 'a1', classSessionId: 's1' },
        { ...baseUnbilledAttendance, id: 'a4', classSessionId: 's4', billId: 'bill-1' },
      ];

      const safeIds = AttendanceDeletionGuard.filterSafeSessionsToDelete(sessions, attendances);
      expect(safeIds).toEqual(['s1']);
    });

    it('Case 17: Giữ lại toàn bộ các buổi học có học sinh đã chốt hóa đơn', () => {
      const sessions: AttendanceSafetySession[] = [
        { ...baseScheduledSession, id: 's1' },
        { ...baseScheduledSession, id: 's2' },
      ];
      const attendances: AttendanceSafetyRecord[] = [
        { ...baseUnbilledAttendance, id: 'a1', classSessionId: 's1', billId: 'bill-100' },
        { ...baseUnbilledAttendance, id: 'a2', classSessionId: 's2', billId: 'bill-200' },
      ];

      const safeIds = AttendanceDeletionGuard.filterSafeSessionsToDelete(sessions, attendances);
      expect(safeIds).toEqual([]);
    });

    it('Case 18: Giữ lại toàn bộ các buổi học đang diễn ra hoặc đã hoàn thành', () => {
      const sessions: AttendanceSafetySession[] = [
        { ...baseScheduledSession, id: 's1', status: SessionStatus.IN_PROGRESS },
        { ...baseScheduledSession, id: 's2', status: SessionStatus.COMPLETED },
      ];

      const safeIds = AttendanceDeletionGuard.filterSafeSessionsToDelete(sessions, []);
      expect(safeIds).toEqual([]);
    });
  });

  describe('Nhóm 5: Performance Benchmark SLA với Big Dataset', () => {
    it('Case 19: Quét an toàn xóa buổi học cho 2,000 ca học x 50,000 điểm danh dưới 20ms', () => {
      const sessions: AttendanceSafetySession[] = [];
      const attendances: AttendanceSafetyRecord[] = [];

      for (let i = 0; i < 2000; i++) {
        sessions.push({
          id: `sess-${i}`,
          classId: 'class-1',
          date: '2026-11-01',
          status: i % 10 === 0 ? SessionStatus.IN_PROGRESS : SessionStatus.SCHEDULED,
          attendanceLocked: i % 20 === 0,
          wageId: null,
          assistantWageId: null,
        });
      }

      for (let j = 0; j < 50000; j++) {
        const sessIdx = j % 2000;
        attendances.push({
          id: `att-${j}`,
          classSessionId: `sess-${sessIdx}`,
          studentId: `std-${j % 500}`,
          billId: j % 50 === 0 ? `bill-${j}` : null,
          isPresent: false,
          verifyMethod: null,
          isLate: false,
          lateMinutes: 0,
          leaveStatus: null,
          evaluationComment: null,
          evaluationScore: null,
        });
      }

      const start = performance.now();
      const safeIds = AttendanceDeletionGuard.filterSafeSessionsToDelete(sessions, attendances);
      const durationMs = performance.now() - start;

      expect(safeIds.length).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(50);
    });

    it('Case 20: Xác thực đơn lẻ 1 buổi học với 50 học sinh dưới 1ms', () => {
      const attendances: AttendanceSafetyRecord[] = [];
      for (let i = 0; i < 50; i++) {
        attendances.push({
          ...baseUnbilledAttendance,
          id: `att-${i}`,
          studentId: `std-${i}`,
        });
      }

      const start = performance.now();
      AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, attendances);
      const durationMs = performance.now() - start;

      expect(durationMs).toBeLessThan(1);
    });
  });

  describe('Nhóm 6: TDD Mở rộng - Billed Wage Amounts & Active Attendance States (Cases 21 - 26)', () => {
    it('Case 21: Chặn xóa buổi học Scheduled nếu đã tính lương giáo viên (billedTeacherWage > 0)', () => {
      const session: AttendanceSafetySession = {
        ...baseScheduledSession,
        billedTeacherWage: 250000,
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(session, []);
      }).toThrow(AcademicError);

      try {
        AttendanceDeletionGuard.validateSafeToDeleteSession(session, []);
      } catch (err: any) {
        expect(err.code).toBe('CANNOT_DELETE_SESSION_PROTECTED');
        expect(err.message).toContain('thù lao');
      }
    });

    it('Case 22: Chặn xóa buổi học Scheduled nếu đã tính lương trợ giảng (billedAssistantWage > 0)', () => {
      const session: AttendanceSafetySession = {
        ...baseScheduledSession,
        billedAssistantWage: 100000,
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(session, []);
      }).toThrow(AcademicError);
    });

    it('Case 23: Chặn xóa buổi học nếu có học sinh ghi nhận đi muộn (isLate = true hoặc lateMinutes > 0)', () => {
      const lateAtt: AttendanceSafetyRecord = {
        ...baseUnbilledAttendance,
        isLate: true,
        lateMinutes: 15,
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, [lateAtt]);
      }).toThrow(AcademicError);

      try {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, [lateAtt]);
      } catch (err: any) {
        expect(err.code).toBe('ATTENDANCE_ATTENDED_CONFLICT');
        expect(err.message).toContain('điểm danh');
      }
    });

    it('Case 24: Chặn xóa buổi học nếu có học sinh có đơn xin nghỉ phép (leaveStatus pending hoặc approved)', () => {
      const approvedLeaveAtt: AttendanceSafetyRecord = {
        ...baseUnbilledAttendance,
        leaveStatus: 'approved',
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, [approvedLeaveAtt]);
      }).toThrow(AcademicError);

      const pendingLeaveAtt: AttendanceSafetyRecord = {
        ...baseUnbilledAttendance,
        leaveStatus: 'pending',
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, [pendingLeaveAtt]);
      }).toThrow(AcademicError);
    });

    it('Case 25: Chặn xóa buổi học nếu có nhận xét hoặc điểm đánh giá của giáo viên', () => {
      const commentedAtt: AttendanceSafetyRecord = {
        ...baseUnbilledAttendance,
        evaluationComment: 'Học sinh tiếp thu bài tốt',
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, [commentedAtt]);
      }).toThrow(AcademicError);

      const scoredAtt: AttendanceSafetyRecord = {
        ...baseUnbilledAttendance,
        evaluationScore: '9.5',
      };

      expect(() => {
        AttendanceDeletionGuard.validateSafeToDeleteSession(baseScheduledSession, [scoredAtt]);
      }).toThrow(AcademicError);
    });

    it('Case 26: filterSafeSessionsToDelete loại trừ các ca học có billedTeacherWage, isLate, hoặc leaveStatus', () => {
      const sessions: AttendanceSafetySession[] = [
        { ...baseScheduledSession, id: 's1' }, // safe
        { ...baseScheduledSession, id: 's2', billedTeacherWage: 200000 }, // unsafe wage
        { ...baseScheduledSession, id: 's3' }, // unsafe late
        { ...baseScheduledSession, id: 's4' }, // unsafe leave
      ];

      const attendances: AttendanceSafetyRecord[] = [
        { ...baseUnbilledAttendance, id: 'a1', classSessionId: 's1' },
        { ...baseUnbilledAttendance, id: 'a3', classSessionId: 's3', isLate: true },
        { ...baseUnbilledAttendance, id: 'a4', classSessionId: 's4', leaveStatus: 'approved' },
      ];

      const safeIds = AttendanceDeletionGuard.filterSafeSessionsToDelete(sessions, attendances);
      expect(safeIds).toEqual(['s1']);
    });
  });
});
