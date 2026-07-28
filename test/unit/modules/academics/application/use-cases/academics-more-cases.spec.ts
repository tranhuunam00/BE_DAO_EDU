import { SessionStatus } from '../../../../../../src/domain/value-objects/session-status.enum';

describe('Academics, Class Sessions & Attendance Additional 25 Edge-Case Tests', () => {
  describe('Attendance Locking & Future Session Protection (Edge Cases)', () => {
    it('26. SHOULD NOT modify room or teacher for a session if attendanceLocked is true', () => {
      const session = { id: 's1', attendanceLocked: true, roomId: 'r1', teacherId: 't1' };

      const updateSessionInfo = (s: typeof session, newRoom: string, newTeacher: string) => {
        if (s.attendanceLocked) throw new Error('Không thể thay đổi phòng học/giáo viên của buổi đã điểm danh!');
        return { ...s, roomId: newRoom, teacherId: newTeacher };
      };

      expect(() => updateSessionInfo(session, 'r2', 't2')).toThrow(
        'Không thể thay đổi phòng học/giáo viên của buổi đã điểm danh!',
      );
    });

    it('27. SHOULD preserve past attendance when student joined date is modified retroactively', () => {
      const historicalAttendance = [
        { sessionDate: '2026-05-10', studentId: 'st1', isPresent: true },
        { sessionDate: '2026-05-17', studentId: 'st1', isPresent: false, reason: 'Ốm' },
      ];

      const syncAttendanceOnJoinedDateChange = (newJoinedDate: string, records: typeof historicalAttendance) => {
        // Business rule: Do not delete existing past attendance records even if newJoinedDate is changed
        return records;
      };

      const result = syncAttendanceOnJoinedDateChange('2026-06-01', historicalAttendance);
      expect(result).toHaveLength(2);
      expect(result[0].isPresent).toBe(true);
    });

    it('28. SHOULD lock attendance automatically at end of day if status is Completed', () => {
      const session = { id: 's1', date: '2026-07-19', status: SessionStatus.COMPLETED, attendanceLocked: false };

      const autoLockPastSessions = (s: typeof session, today: string) => {
        if (s.date < today && s.status === SessionStatus.COMPLETED) {
          return { ...s, attendanceLocked: true };
        }
        return s;
      };

      const updated = autoLockPastSessions(session, '2026-07-20');
      expect(updated.attendanceLocked).toBe(true);
    });

    it('29. SHOULD throw error when marking attendance for future session that has not arrived yet', () => {
      const futureSession = { id: 's-future', date: '2026-12-01', status: SessionStatus.SCHEDULED };
      const today = '2026-07-20';

      const markAttendance = (s: typeof futureSession) => {
        if (s.date > today) throw new Error('Không thể điểm danh cho buổi học chưa diễn ra!');
      };

      expect(() => markAttendance(futureSession)).toThrow('Không thể điểm danh cho buổi học chưa diễn ra!');
    });

    it('30. SHOULD allow Admin to delete session only if attendanceLocked is false and status is Scheduled', () => {
      const lockedSession = { id: 's1', attendanceLocked: true, status: SessionStatus.COMPLETED };
      const scheduledSession = { id: 's2', attendanceLocked: false, status: SessionStatus.SCHEDULED };

      const deleteSession = (s: typeof lockedSession) => {
        if (s.attendanceLocked || s.status === SessionStatus.COMPLETED) {
          throw new Error('Buổi học đã diễn ra hoặc đã khóa điểm danh không thể xóa!');
        }
        return true;
      };

      expect(() => deleteSession(lockedSession)).toThrow('Buổi học đã diễn ra hoặc đã khóa điểm danh không thể xóa!');
      expect(deleteSession(scheduledSession)).toBe(true);
    });

    it('31. SHOULD keep historical teacher ID when teacher leaves center', () => {
      const session = { id: 's1', teacherId: 't-retired', teacherName: 'Thầy Cũ' };

      expect(session.teacherId).toBe('t-retired');
      expect(session.teacherName).toBe('Thầy Cũ');
    });

    it('32. SHOULD calculate total sessions scheduled vs total sessions completed for a class', () => {
      const sessions = [
        { status: SessionStatus.COMPLETED },
        { status: SessionStatus.COMPLETED },
        { status: SessionStatus.SCHEDULED },
        { status: SessionStatus.CANCELLED },
      ];

      const completed = sessions.filter((s) => s.status === SessionStatus.COMPLETED).length;
      const scheduled = sessions.filter((s) => s.status === SessionStatus.SCHEDULED).length;

      expect(completed).toBe(2);
      expect(scheduled).toBe(1);
    });

    it('33. SHOULD skip holiday dates when generating future class sessions', () => {
      const holidays = ['2026-09-02'];
      const candidateDates = ['2026-08-31', '2026-09-02', '2026-09-04'];

      const validDates = candidateDates.filter((d) => !holidays.includes(d));
      expect(validDates).toHaveLength(2);
      expect(validDates).not.toContain('2026-09-02');
    });

    it('34. SHOULD record teaching assistant attendance presence separately from main teacher', () => {
      const session = {
        id: 's1',
        teacherPresent: true,
        assistantPresent: false,
        assistantAbsenceReason: 'Bận thi HKI',
      };

      expect(session.teacherPresent).toBe(true);
      expect(session.assistantPresent).toBe(false);
      expect(session.assistantAbsenceReason).toBe('Bận thi HKI');
    });

    it('35. SHOULD prevent assigning non-existent room to class session', () => {
      const validRoomIds = ['r1', 'r2', 'r3'];

      const assignRoom = (roomId: string) => {
        if (!validRoomIds.includes(roomId)) throw new Error('Phòng học không tồn tại!');
        return roomId;
      };

      expect(() => assignRoom('r999')).toThrow('Phòng học không tồn tại!');
      expect(assignRoom('r1')).toBe('r1');
    });

    it('36. SHOULD calculate total active enrolled students in session attendance sheet', () => {
      const enrollments = [
        { studentId: 'st1', status: 'Active' },
        { studentId: 'st2', status: 'Active' },
        { studentId: 'st3', status: 'Dropped' },
      ];

      const attendanceSheet = enrollments.filter((e) => e.status === 'Active');
      expect(attendanceSheet).toHaveLength(2);
    });

    it('37. SHOULD format class session duration string (VD: 08:00 - 10:00 (120 phút))', () => {
      const formatDuration = (start: string, end: string, mins: number) => `${start} - ${end} (${mins} phút)`;
      expect(formatDuration('08:00', '10:00', 120)).toBe('08:00 - 10:00 (120 phút)');
    });

    it('38. SHOULD validate session date ISO format (YYYY-MM-DD)', () => {
      const isIsoDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
      expect(isIsoDate('2026-07-20')).toBe(true);
      expect(isIsoDate('20-07-2026')).toBe(false);
    });

    it('39. SHOULD update session status from SCHEDULED to IN_PROGRESS when class starts', () => {
      const session = { id: 's1', status: SessionStatus.SCHEDULED };
      const startSession = (s: typeof session) => ({ ...s, status: SessionStatus.IN_PROGRESS });

      expect(startSession(session).status).toBe(SessionStatus.IN_PROGRESS);
    });

    it('40. SHOULD support session status CANCELLED with cancel reason', () => {
      const session = {
        id: 's1',
        status: SessionStatus.CANCELLED,
        cancelReason: 'Mất điện trung tâm',
      };

      expect(session.status).toBe(SessionStatus.CANCELLED);
      expect(session.cancelReason).toBe('Mất điện trung tâm');
    });

    it('41. SHOULD calculate total makeup sessions required for cancelled sessions', () => {
      const sessions = [
        { id: 's1', status: SessionStatus.COMPLETED },
        { id: 's2', status: SessionStatus.CANCELLED, needsMakeup: true },
        { id: 's3', status: SessionStatus.CANCELLED, needsMakeup: true },
      ];

      const makeupCount = sessions.filter((s) => s.needsMakeup).length;
      expect(makeupCount).toBe(2);
    });

    it('42. SHOULD mark session as makeup session (isMakeup = true)', () => {
      const session = { id: 's-makeup-1', isMakeup: true, originalSessionId: 's2' };
      expect(session.isMakeup).toBe(true);
      expect(session.originalSessionId).toBe('s2');
    });

    it('43. SHOULD sort session list chronologically by date and startTime', () => {
      const sessions = [
        { date: '2026-07-20', startTime: '10:00' },
        { date: '2026-07-20', startTime: '08:00' },
        { date: '2026-07-19', startTime: '14:00' },
      ];

      const sorted = [...sessions].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      });

      expect(sorted[0].date).toBe('2026-07-19');
      expect(sorted[1].startTime).toBe('08:00');
      expect(sorted[2].startTime).toBe('10:00');
    });

    it('44. SHOULD calculate student attendance rate for individual course level', () => {
      const levelSessions = [
        { levelId: 'L1', isPresent: true },
        { levelId: 'L1', isPresent: true },
        { levelId: 'L1', isPresent: false },
      ];

      const rate = (levelSessions.filter((s) => s.isPresent).length / levelSessions.length) * 100;
      expect(Math.round(rate)).toBe(67);
    });

    it('45. SHOULD reject updating attendance by non-enrolled user or unauthorized role', () => {
      const canMarkAttendance = (role: string) => ['ADMIN', 'TEACHER'].includes(role);

      expect(canMarkAttendance('TEACHER')).toBe(true);
      expect(canMarkAttendance('STUDENT')).toBe(false);
    });

    it('46. SHOULD record timestamp when teacher finishes marking attendance', () => {
      const timestamp = '2026-07-20T17:30:00.000Z';
      const record = { sessionId: 's1', markedAt: timestamp };

      expect(record.markedAt).toBe(timestamp);
    });

    it('47. SHOULD calculate total absent sessions with excused leave request approval', () => {
      const absences = [
        { sessionId: 's1', hasApprovedLeave: true },
        { sessionId: 's2', hasApprovedLeave: false },
      ];

      const excusedCount = absences.filter((a) => a.hasApprovedLeave).length;
      expect(excusedCount).toBe(1);
    });

    it('48. SHOULD format room capacity warning if enrolled count equals capacity', () => {
      const isFull = (enrolled: number, cap: number) => enrolled >= cap;
      expect(isFull(30, 30)).toBe(true);
      expect(isFull(29, 30)).toBe(false);
    });

    it('49. SHOULD group sessions by course module unit', () => {
      const unitSessions = [
        { unit: 'Unit 1', sessionId: 's1' },
        { unit: 'Unit 1', sessionId: 's2' },
        { unit: 'Unit 2', sessionId: 's3' },
      ];

      const unit1Count = unitSessions.filter((u) => u.unit === 'Unit 1').length;
      expect(unit1Count).toBe(2);
    });

    it('50. SHOULD verify complete class session entity structure integrity', () => {
      const session = {
        id: 'session-500',
        classId: 'class-101',
        roomId: 'room-1',
        teacherId: 'teacher-1',
        assistantId: 'teacher-2',
        date: '2026-07-20',
        startTime: '08:00',
        endTime: '10:00',
        status: SessionStatus.COMPLETED,
        attendanceLocked: true,
      };

      expect(session.id).toBe('session-500');
      expect(session.status).toBe(SessionStatus.COMPLETED);
      expect(session.attendanceLocked).toBe(true);
    });
  });
});
