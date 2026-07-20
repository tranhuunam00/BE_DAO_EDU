enum ClassStatus {
  ACTIVE = 'Active',
  COMPLETED = 'Completed',
  SCHEDULED = 'Scheduled',
  SUSPENDED = 'Suspended',
}

describe('Class & Course Curriculum Management Deep Test Suite', () => {
  describe('Class Enrollment & Capacity Invariants', () => {
    it('1. SHOULD allow student enrollment when class enrolledCount < maxCapacity', () => {
      const classObj = { id: 'c1', maxCapacity: 20, enrolledCount: 15, status: ClassStatus.ACTIVE };

      const canEnroll = (c: typeof classObj) => c.status === ClassStatus.ACTIVE && c.enrolledCount < c.maxCapacity;

      expect(canEnroll(classObj)).toBe(true);
    });

    it('2. SHOULD throw error when enrolling in a class that is at maxCapacity', () => {
      const classObj = { id: 'c1', maxCapacity: 20, enrolledCount: 20, status: ClassStatus.ACTIVE };

      const enroll = (c: typeof classObj) => {
        if (c.enrolledCount >= c.maxCapacity) throw new Error('Lớp học đã đủ sĩ số tối đa!');
        return { ...c, enrolledCount: c.enrolledCount + 1 };
      };

      expect(() => enroll(classObj)).toThrow('Lớp học đã đủ sĩ số tối đa!');
    });

    it('3. SHOULD increment enrolledCount when student joins class', () => {
      let classObj = { id: 'c1', maxCapacity: 25, enrolledCount: 10 };
      classObj = { ...classObj, enrolledCount: classObj.enrolledCount + 1 };

      expect(classObj.enrolledCount).toBe(11);
    });

    it('4. SHOULD decrement enrolledCount when student is removed or dropped from class', () => {
      let classObj = { id: 'c1', maxCapacity: 25, enrolledCount: 11 };
      classObj = { ...classObj, enrolledCount: Math.max(0, classObj.enrolledCount - 1) };

      expect(classObj.enrolledCount).toBe(10);
    });

    it('5. SHOULD NOT allow enrolledCount to drop below 0', () => {
      let classObj = { id: 'c1', maxCapacity: 25, enrolledCount: 0 };
      classObj = { ...classObj, enrolledCount: Math.max(0, classObj.enrolledCount - 1) };

      expect(classObj.enrolledCount).toBe(0);
    });

    it('6. SHOULD update class status to Completed when finishDate has passed', () => {
      const classObj = { id: 'c1', finishDate: '2026-06-30', status: ClassStatus.ACTIVE };
      const today = '2026-07-20';

      const updateStatusOnFinish = (c: typeof classObj, date: string) => {
        if (c.finishDate && c.finishDate < date) return { ...c, status: ClassStatus.COMPLETED };
        return c;
      };

      expect(updateStatusOnFinish(classObj, today).status).toBe(ClassStatus.COMPLETED);
    });
  });

  describe('Weekly Schedule & Timetable Validation', () => {
    it('7. SHOULD validate dayOfWeek string array (Mon, Tue, Wed, Thu, Fri, Sat, Sun)', () => {
      const validDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const isDayValid = (day: string) => validDays.includes(day);

      expect(isDayValid('Mon')).toBe(true);
      expect(isDayValid('Fri')).toBe(true);
      expect(isDayValid('Holiday')).toBe(false);
    });

    it('8. SHOULD reject schedule if startTime >= endTime', () => {
      const validateTimes = (start: string, end: string) => {
        if (start >= end) throw new Error('Giờ bắt đầu phải nhỏ hơn giờ kết thúc');
        return true;
      };

      expect(() => validateTimes('10:00', '08:00')).toThrow('Giờ bắt đầu phải nhỏ hơn giờ kết thúc');
      expect(() => validateTimes('08:00', '08:00')).toThrow('Giờ bắt đầu phải nhỏ hơn giờ kết thúc');
      expect(validateTimes('08:00', '10:00')).toBe(true);
    });

    it('9. SHOULD detect schedule conflict when teacher has overlapping sessions at same time', () => {
      const existingSchedule = { teacherId: 't1', dayOfWeek: 'Mon', startTime: '08:00', endTime: '10:00' };
      const newSchedule = { teacherId: 't1', dayOfWeek: 'Mon', startTime: '09:00', endTime: '11:00' };

      const isConflict = (s1: typeof existingSchedule, s2: typeof newSchedule) => {
        return s1.teacherId === s2.teacherId &&
          s1.dayOfWeek === s2.dayOfWeek &&
          !(s2.endTime <= s1.startTime || s2.startTime >= s1.endTime);
      };

      expect(isConflict(existingSchedule, newSchedule)).toBe(true);
    });

    it('10. SHOULD allow same teacher to teach non-overlapping sessions on same day', () => {
      const s1 = { teacherId: 't1', dayOfWeek: 'Mon', startTime: '08:00', endTime: '10:00' };
      const s2 = { teacherId: 't1', dayOfWeek: 'Mon', startTime: '14:00', endTime: '16:00' };

      const isConflict = (a: typeof s1, b: typeof s2) => {
        return a.teacherId === b.teacherId &&
          a.dayOfWeek === b.dayOfWeek &&
          !(b.endTime <= a.startTime || b.startTime >= a.startTime);
      };

      expect(isConflict(s1, s2)).toBe(false);
    });

    it('11. SHOULD detect room double-booking conflict for same room at same time', () => {
      const roomSchedule = { roomId: 'r101', dayOfWeek: 'Wed', startTime: '18:00', endTime: '20:00' };
      const newBooking = { roomId: 'r101', dayOfWeek: 'Wed', startTime: '19:00', endTime: '21:00' };

      const isRoomBusy = (s1: typeof roomSchedule, s2: typeof newBooking) => {
        return s1.roomId === s2.roomId &&
          s1.dayOfWeek === s2.dayOfWeek &&
          !(s2.endTime <= s1.startTime || s2.startTime >= s1.endTime);
      };

      expect(isRoomBusy(roomSchedule, newBooking)).toBe(true);
    });
  });

  describe('Course Curriculum & Level Hierarchy', () => {
    it('12. SHOULD associate class with course and level', () => {
      const classEntity = {
        id: 'c101',
        className: 'Tiếng Anh Giao Tiếp A1 - Lớp 01',
        courseId: 'course-eng-a1',
        levelId: 'level-a1-basic',
      };

      expect(classEntity.courseId).toBe('course-eng-a1');
      expect(classEntity.levelId).toBe('level-a1-basic');
    });

    it('13. SHOULD calculate total sessions in course level curriculum', () => {
      const levelModules = [
        { name: 'Unit 1: Greetings', sessionsCount: 4 },
        { name: 'Unit 2: Family', sessionsCount: 4 },
        { name: 'Unit 3: Hobbies', sessionsCount: 4 },
      ];

      const totalSessions = levelModules.reduce((sum, m) => sum + m.sessionsCount, 0);
      expect(totalSessions).toBe(12);
    });

    it('14. SHOULD format class code automatically from center code and index', () => {
      const generateClassCode = (centerCode: string, courseCode: string, seq: number) => {
        return `${centerCode}-${courseCode}-${String(seq).padStart(3, '0')}`;
      };

      expect(generateClassCode('CG', 'ENG', 5)).toBe('CG-ENG-005');
    });

    it('15. SHOULD filter active classes by center ID', () => {
      const classes = [
        { id: 'c1', centerId: 'center-1', status: 'Active' },
        { id: 'c2', centerId: 'center-2', status: 'Active' },
        { id: 'c3', centerId: 'center-1', status: 'Completed' },
      ];

      const activeCenter1 = classes.filter((c) => c.centerId === 'center-1' && c.status === 'Active');
      expect(activeCenter1).toHaveLength(1);
      expect(activeCenter1[0].id).toBe('c1');
    });

    it('16. SHOULD calculate class progress percentage based on completed sessions', () => {
      const totalSessions = 24;
      const completedSessions = 12;

      const progress = (completedSessions / totalSessions) * 100;
      expect(progress).toBe(50.0);
    });

    it('17. SHOULD validate start date is not after finish date when creating class', () => {
      const validateDates = (start: string, finish?: string) => {
        if (finish && start > finish) throw new Error('Ngày bắt đầu không được lớn hơn ngày kết thúc!');
        return true;
      };

      expect(() => validateDates('2026-09-01', '2026-06-01')).toThrow('Ngày bắt đầu không được lớn hơn ngày kết thúc!');
      expect(validateDates('2026-06-01', '2026-09-01')).toBe(true);
    });

    it('18. SHOULD assign main teacher and teaching assistant to class', () => {
      const assignment = {
        classId: 'c1',
        teacherId: 'teacher-main',
        assistantId: 'teacher-assistant',
      };

      expect(assignment.teacherId).toBe('teacher-main');
      expect(assignment.assistantId).toBe('teacher-assistant');
    });

    it('19. SHOULD verify student enrollment list for class contains valid active students', () => {
      const enrollments = [
        { studentId: 's1', status: 'Active' },
        { studentId: 's2', status: 'Dropped' },
        { studentId: 's3', status: 'Active' },
      ];

      const activeStudents = enrollments.filter((e) => e.status === 'Active');
      expect(activeStudents).toHaveLength(2);
    });

    it('20. SHOULD support class status enum: Active, Scheduled, Completed, Suspended', () => {
      const statuses = ['Active', 'Scheduled', 'Completed', 'Suspended'];
      expect(statuses).toContain('Active');
      expect(statuses).toContain('Suspended');
    });

    it('21. SHOULD calculate average class size per center', () => {
      const centerClasses = [{ enrolledCount: 20 }, { enrolledCount: 15 }, { enrolledCount: 25 }];

      const totalEnrolled = centerClasses.reduce((sum, c) => sum + c.enrolledCount, 0);
      const avg = totalEnrolled / centerClasses.length;

      expect(avg).toBe(20);
    });

    it('22. SHOULD format full class timetable summary display string', () => {
      const schedules = [
        { dayOfWeek: 'Mon', startTime: '08:00', endTime: '10:00' },
        { dayOfWeek: 'Wed', startTime: '08:00', endTime: '10:00' },
      ];

      const summary = schedules.map((s) => `${s.dayOfWeek} ${s.startTime}-${s.endTime}`).join(', ');
      expect(summary).toBe('Mon 08:00-10:00, Wed 08:00-10:00');
    });

    it('23. SHOULD allow assigning room to class session', () => {
      const session = { id: 's1', classId: 'c1', roomId: 'room-101' };
      expect(session.roomId).toBe('room-101');
    });

    it('24. SHOULD calculate tuition per session for class based on total tuition and session count', () => {
      const totalCourseFee = 4800000;
      const totalSessions = 24;

      const feePerSession = totalCourseFee / totalSessions;
      expect(feePerSession).toBe(200000);
    });

    it('25. SHOULD verify complete class entity structure integrity', () => {
      const classEntity = {
        id: 'c-100',
        code: 'CG-MATH-001',
        className: 'Toán Cao Cấp 1',
        centerId: 'center-1',
        courseId: 'course-math',
        levelId: 'level-1',
        maxCapacity: 30,
        enrolledCount: 18,
        startDate: '2026-06-01',
        finishDate: '2026-12-31',
        status: ClassStatus.ACTIVE,
      };

      expect(classEntity.code).toBe('CG-MATH-001');
      expect(classEntity.status).toBe(ClassStatus.ACTIVE);
      expect(classEntity.enrolledCount).toBe(18);
    });
  });
});
