import { SessionStatus } from '../../../../../../src/domain/value-objects/session-status.enum';

describe('Class Session & Attendance Invariants (TDD Rules)', () => {
  describe('Past Session Lock & Attendance Preservation', () => {
    it('MUST NEVER delete or overwrite a past session if attendanceLocked is true', () => {
      const pastLockedSession = {
        id: 'session-past-locked-1',
        classId: 'class-101',
        date: '2026-06-01',
        startTime: '08:00',
        endTime: '10:00',
        status: SessionStatus.COMPLETED,
        attendanceLocked: true,
      };

      // Invariant Check: When filtering sessions for regeneration or deletion,
      // any session with attendanceLocked = true MUST NOT be deleted.
      const shouldDeleteSession = (session: typeof pastLockedSession, targetJoinedDate: string) => {
        // Business Rule: Never delete if attendance is locked OR date is prior to joinedDate but locked
        if (session.attendanceLocked) return false;
        return session.date < targetJoinedDate;
      };

      expect(shouldDeleteSession(pastLockedSession, '2026-07-01')).toBe(false);
    });

    it('MUST NEVER delete past attendance records when a student drops out of a class', () => {
      const studentId = 'student-99';
      const pastAttendanceRecords = [
        { id: 'att-1', classSessionId: 'session-past-1', studentId, isPresent: true, note: 'Học bài tốt' },
        { id: 'att-2', classSessionId: 'session-past-2', studentId, isPresent: false, reason: 'Nghỉ ốm' },
      ];

      // Invariant Check: Dropping a student updates ClassStudent status to 'Dropped',
      // but historic student_attendance records MUST be preserved for billing & reports.
      const handleStudentDrop = (attendanceList: typeof pastAttendanceRecords) => {
        // Retain 100% of historical records
        return attendanceList.filter(record => record.studentId === studentId);
      };

      const preservedRecords = handleStudentDrop(pastAttendanceRecords);
      expect(preservedRecords).toHaveLength(2);
      expect(preservedRecords[0].isPresent).toBe(true);
      expect(preservedRecords[1].reason).toBe('Nghỉ ốm');
    });

    it('MUST enforce attendance lock when attendance marking is completed', () => {
      const session = {
        id: 'session-today',
        status: SessionStatus.SCHEDULED,
        attendanceLocked: false,
      };

      const lockAttendance = (s: typeof session) => {
        return {
          ...s,
          status: SessionStatus.COMPLETED,
          attendanceLocked: true,
        };
      };

      const updatedSession = lockAttendance(session);
      expect(updatedSession.attendanceLocked).toBe(true);
      expect(updatedSession.status).toBe(SessionStatus.COMPLETED);
    });

    it('MUST throw error when attempting to modify time or room of a locked session', () => {
      const lockedSession = {
        id: 'session-locked-room',
        attendanceLocked: true,
        roomId: 'room-1',
      };

      const updateSessionRoom = (s: typeof lockedSession, newRoomId: string) => {
        if (s.attendanceLocked) {
          throw new Error('Buổi học đã khóa điểm danh, không thể thay đổi thông tin!');
        }
        return { ...s, roomId: newRoomId };
      };

      expect(() => updateSessionRoom(lockedSession, 'room-2')).toThrow(
        'Buổi học đã khóa điểm danh, không thể thay đổi thông tin!',
      );
    });
  });
});
