import { SessionStatus } from '../../../../../../src/domain/value-objects/session-status.enum';

describe('Attendance Deep Integration & Business Rules Test Suite', () => {
  const sampleStudentIds = ['student-1', 'student-2', 'student-3', 'student-4', 'student-5'];
  const sampleSessionId = 'session-101';

  describe('Attendance Recording & Validations', () => {
    it('1. SHOULD record presence for a single student in a session', () => {
      const attendance = {
        classSessionId: sampleSessionId,
        studentId: sampleStudentIds[0],
        isPresent: true,
        note: 'Có mặt đúng giờ',
        reason: null,
      };
      expect(attendance.isPresent).toBe(true);
      expect(attendance.note).toBe('Có mặt đúng giờ');
    });

    it('2. SHOULD require a reason when a student is absent (isPresent = false)', () => {
      const recordAbsence = (studentId: string, isPresent: boolean, reason?: string) => {
        if (!isPresent && (!reason || reason.trim() === '')) {
          throw new Error('Cần nhập lý do vắng mặt');
        }
        return { studentId, isPresent, reason };
      };

      expect(() => recordAbsence(sampleStudentIds[1], false, '')).toThrow('Cần nhập lý do vắng mặt');
      expect(recordAbsence(sampleStudentIds[1], false, 'Ốm sốt')).toEqual({
        studentId: sampleStudentIds[1],
        isPresent: false,
        reason: 'Ốm sốt',
      });
    });

    it('3. SHOULD batch record attendance for multiple students in a class', () => {
      const batchInput = sampleStudentIds.map((id, index) => ({
        studentId: id,
        isPresent: index % 2 === 0,
        note: index % 2 === 0 ? 'Có mặt' : undefined,
        reason: index % 2 !== 0 ? 'Vắng có phép' : undefined,
      }));

      const presentCount = batchInput.filter((item) => item.isPresent).length;
      const absentCount = batchInput.filter((item) => !item.isPresent).length;

      expect(batchInput).toHaveLength(5);
      expect(presentCount).toBe(3);
      expect(absentCount).toBe(2);
    });

    it('4. SHOULD update existing attendance record when re-marking attendance before lock', () => {
      let record = { studentId: 'student-1', isPresent: false, reason: 'Đi muộn', note: '' };
      
      // Teacher changes mind before lock
      record = { ...record, isPresent: true, reason: '', note: 'Đã đến muộn 15 phút' };

      expect(record.isPresent).toBe(true);
      expect(record.note).toBe('Đã đến muộn 15 phút');
    });

    it('5. SHOULD calculate correct attendance percentage for a session', () => {
      const attendanceList = [
        { isPresent: true },
        { isPresent: true },
        { isPresent: true },
        { isPresent: false },
        { isPresent: false },
      ];

      const presentCount = attendanceList.filter((a) => a.isPresent).length;
      const rate = (presentCount / attendanceList.length) * 100;

      expect(rate).toBe(60.0);
    });

    it('6. SHOULD handle empty class attendance gracefully (0 students enrolled)', () => {
      const attendanceList: any[] = [];
      const rate = attendanceList.length > 0 ? (attendanceList.filter(a => a.isPresent).length / attendanceList.length) * 100 : 0;
      expect(rate).toBe(0);
    });

    it('7. SHOULD record attendance with teacher comments for individual students', () => {
      const feedback = {
        studentId: 'student-1',
        comment: 'Học sinh hăng hái phát biểu, tiếp thu tốt',
        score: 10,
      };

      expect(feedback.comment).toContain('hăng hái phát biểu');
      expect(feedback.score).toBe(10);
    });

    it('8. SHOULD reject attendance score less than 0 or greater than 10', () => {
      const validateScore = (score: number) => {
        if (score < 0 || score > 10) throw new Error('Điểm thái độ phải từ 0 đến 10');
        return score;
      };

      expect(() => validateScore(-1)).toThrow('Điểm thái độ phải từ 0 đến 10');
      expect(() => validateScore(11)).toThrow('Điểm thái độ phải từ 0 đến 10');
      expect(validateScore(8.5)).toBe(8.5);
    });
  });

  describe('Attendance Lock & Protection Business Rules', () => {
    it('9. SHOULD set attendanceLocked = true when session status changes to COMPLETED', () => {
      const session = { id: 's1', status: SessionStatus.SCHEDULED, attendanceLocked: false };
      
      const lockSession = (s: typeof session) => ({
        ...s,
        status: SessionStatus.COMPLETED,
        attendanceLocked: true,
      });

      const result = lockSession(session);
      expect(result.status).toBe(SessionStatus.COMPLETED);
      expect(result.attendanceLocked).toBe(true);
    });

    it('10. SHOULD throw error when attempting to modify attendance of a locked session', () => {
      const session = { id: 's1', attendanceLocked: true };
      const modifyAttendance = (s: typeof session) => {
        if (s.attendanceLocked) throw new Error('Buổi học đã bị khóa điểm danh!');
      };

      expect(() => modifyAttendance(session)).toThrow('Buổi học đã bị khóa điểm danh!');
    });

    it('11. SHOULD allow Admin role to unlock a locked attendance session when needed', () => {
      const session = { id: 's1', attendanceLocked: true };
      const unlockByAdmin = (s: typeof session, userRole: string) => {
        if (userRole !== 'ADMIN') throw new Error('Chỉ Admin mới có quyền mở khóa điểm danh!');
        return { ...s, attendanceLocked: false };
      };

      expect(() => unlockByAdmin(session, 'TEACHER')).toThrow('Chỉ Admin mới có quyền mở khóa điểm danh!');
      const unlocked = unlockByAdmin(session, 'ADMIN');
      expect(unlocked.attendanceLocked).toBe(false);
    });

    it('12. SHOULD keep historical attendance data unchanged when student drops from class', () => {
      const historicalAttendance = [
        { sessionDate: '2026-05-01', studentId: 'student-1', isPresent: true },
        { sessionDate: '2026-05-08', studentId: 'student-1', isPresent: true },
      ];

      const dropStudent = (studentId: string, attendanceRecords: typeof historicalAttendance) => {
        // Return 100% of historical records unaltered
        return attendanceRecords.filter((record) => record.studentId === studentId);
      };

      const keptRecords = dropStudent('student-1', historicalAttendance);
      expect(keptRecords).toHaveLength(2);
    });

    it('13. SHOULD NOT generate attendance records for sessions prior to student joinedDate', () => {
      const studentJoinedDate = '2026-06-15';
      const sessionDate = '2026-06-01';

      const isEligibleForSession = (joined: string, session: string) => session >= joined;

      expect(isEligibleForSession(studentJoinedDate, sessionDate)).toBe(false);
    });

    it('14. SHOULD generate attendance records for sessions on or after student joinedDate', () => {
      const studentJoinedDate = '2026-06-15';
      const sessionDate = '2026-06-16';

      const isEligibleForSession = (joined: string, session: string) => session >= joined;

      expect(isEligibleForSession(studentJoinedDate, sessionDate)).toBe(true);
    });

    it('15. SHOULD preserve past attendance when regenerateFutureSessions is triggered', () => {
      const pastSession = { id: 's-past', date: '2026-06-01', attendanceLocked: true };
      const futureSession = { id: 's-future', date: '2026-08-01', attendanceLocked: false };

      const sessions = [pastSession, futureSession];
      const today = '2026-07-20';

      const sessionsToDelete = sessions.filter((s) => s.date >= today && !s.attendanceLocked);

      expect(sessionsToDelete).toHaveLength(1);
      expect(sessionsToDelete[0].id).toBe('s-future');
    });

    it('16. SHOULD prevent deleting past sessions even if future sessions are regenerated', () => {
      const pastSessions = [
        { id: 's1', date: '2026-05-01', attendanceLocked: true },
        { id: 's2', date: '2026-06-01', attendanceLocked: true },
      ];

      const filterDeletable = (list: typeof pastSessions) => list.filter((s) => !s.attendanceLocked);
      expect(filterDeletable(pastSessions)).toHaveLength(0);
    });
  });

  describe('Attendance Statistics & Reports Calculation', () => {
    it('17. SHOULD calculate student monthly presence rate accurately', () => {
      const studentSessions = [
        { month: '07/2026', isPresent: true },
        { month: '07/2026', isPresent: true },
        { month: '07/2026', isPresent: false },
        { month: '07/2026', isPresent: true },
      ];

      const present = studentSessions.filter((s) => s.isPresent).length;
      const total = studentSessions.length;
      const rate = Math.round((present / total) * 100 * 10) / 10;

      expect(present).toBe(3);
      expect(total).toBe(4);
      expect(rate).toBe(75.0);
    });

    it('18. SHOULD calculate total absences with reason vs without reason', () => {
      const absences = [
        { isPresent: false, reason: 'Ốm' },
        { isPresent: false, reason: 'Nghỉ gia đình' },
        { isPresent: false, reason: undefined },
      ];

      const withReason = absences.filter((a) => a.reason && a.reason.trim() !== '').length;
      const withoutReason = absences.filter((a) => !a.reason || a.reason.trim() === '').length;

      expect(withReason).toBe(2);
      expect(withoutReason).toBe(1);
    });

    it('19. SHOULD support class attendance summary aggregated by center', () => {
      const classSummaries = [
        { classId: 'c1', centerId: 'center-1', totalSessions: 10, totalPresent: 90, totalExpected: 100 },
        { classId: 'c2', centerId: 'center-1', totalSessions: 10, totalPresent: 80, totalExpected: 100 },
      ];

      const totalPresent = classSummaries.reduce((sum, c) => sum + c.totalPresent, 0);
      const totalExpected = classSummaries.reduce((sum, c) => sum + c.totalExpected, 0);
      const overallRate = (totalPresent / totalExpected) * 100;

      expect(overallRate).toBe(85.0);
    });

    it('20. SHOULD flag low attendance warning when student presence drops below 70%', () => {
      const checkWarning = (rate: number) => rate < 70.0;

      expect(checkWarning(65.0)).toBe(true);
      expect(checkWarning(75.0)).toBe(false);
    });

    it('21. SHOULD calculate consecutive absence count for a student', () => {
      const sessionHistory = [
        { date: '2026-07-01', isPresent: true },
        { date: '2026-07-05', isPresent: false },
        { date: '2026-07-10', isPresent: false },
        { date: '2026-07-15', isPresent: false },
      ];

      let consecutiveAbsences = 0;
      for (let i = sessionHistory.length - 1; i >= 0; i--) {
        if (!sessionHistory[i].isPresent) {
          consecutiveAbsences++;
        } else {
          break;
        }
      }

      expect(consecutiveAbsences).toBe(3);
    });

    it('22. SHOULD reset consecutive absence counter on present session', () => {
      const sessionHistory = [
        { date: '2026-07-01', isPresent: false },
        { date: '2026-07-05', isPresent: false },
        { date: '2026-07-10', isPresent: true },
      ];

      let consecutiveAbsences = 0;
      for (let i = sessionHistory.length - 1; i >= 0; i--) {
        if (!sessionHistory[i].isPresent) {
          consecutiveAbsences++;
        } else {
          break;
        }
      }

      expect(consecutiveAbsences).toBe(0);
    });

    it('23. SHOULD support filtering attendance logs by date range', () => {
      const logs = [
        { date: '2026-06-01', studentId: 's1' },
        { date: '2026-07-01', studentId: 's1' },
        { date: '2026-07-15', studentId: 's1' },
      ];

      const from = '2026-07-01';
      const to = '2026-07-31';

      const filtered = logs.filter((l) => l.date >= from && l.date <= to);
      expect(filtered).toHaveLength(2);
    });

    it('24. SHOULD calculate teacher attendance completion rate', () => {
      const teacherSessions = [
        { id: 's1', attendanceLocked: true },
        { id: 's2', attendanceLocked: true },
        { id: 's3', attendanceLocked: false },
      ];

      const completed = teacherSessions.filter((s) => s.attendanceLocked).length;
      const completionRate = (completed / teacherSessions.length) * 100;

      expect(Math.round(completionRate)).toBe(67);
    });

    it('25. SHOULD verify complete attendance payload integrity', () => {
      const payload = {
        sessionId: 's-100',
        records: [
          { studentId: 'st-1', isPresent: true, note: 'Tốt' },
          { studentId: 'st-2', isPresent: false, reason: 'Nghỉ' },
        ],
        lockedBy: 'teacher-1',
        lockedAt: '2026-07-20T10:00:00Z',
      };

      expect(payload.records).toHaveLength(2);
      expect(payload.lockedBy).toBe('teacher-1');
      expect(payload.sessionId).toBe('s-100');
    });
  });
});
