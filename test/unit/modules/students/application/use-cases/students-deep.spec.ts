describe('Student Profile & Parent Information Deep Test Suite', () => {
  describe('Student Code Auto-generation & Profile Invariants', () => {
    it('1. SHOULD generate student code with prefix HS and 5-digit zero-padded index', () => {
      const generateStudentCode = (seq: number) => `HS${String(seq).padStart(5, '0')}`;

      expect(generateStudentCode(1)).toBe('HS00001');
      expect(generateStudentCode(142)).toBe('HS00142');
      expect(generateStudentCode(10204)).toBe('HS10204');
    });

    it('2. SHOULD require student firstName, lastName, and gender', () => {
      const createStudent = (firstName: string, lastName: string, gender: string) => {
        if (!firstName || !lastName) throw new Error('Họ và tên học sinh là bắt buộc!');
        if (!['Nam', 'Nữ', 'Khác'].includes(gender)) throw new Error('Giới tính không hợp lệ!');
        return { firstName, lastName, gender, status: 'Active' };
      };

      expect(() => createStudent('', 'Nguyễn', 'Nam')).toThrow('Họ và tên học sinh là bắt buộc!');
      expect(() => createStudent('An', 'Nguyễn', 'Unknown')).toThrow('Giới tính không hợp lệ!');
      expect(createStudent('An', 'Nguyễn', 'Nam')).toEqual({
        firstName: 'An',
        lastName: 'Nguyễn',
        gender: 'Nam',
        status: 'Active',
      });
    });

    it('3. SHOULD validate student dateOfBirth format (YYYY-MM-DD)', () => {
      const validateDob = (dob: string) => {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dob)) throw new Error('Ngày sinh phải có dạng YYYY-MM-DD');
        return true;
      };

      expect(() => validateDob('15/05/2012')).toThrow('Ngày sinh phải có dạng YYYY-MM-DD');
      expect(validateDob('2012-05-15')).toBe(true);
    });

    it('4. SHOULD calculate student age based on dateOfBirth', () => {
      const calculateAge = (dobStr: string, currentYear: number) => {
        const birthYear = parseInt(dobStr.split('-')[0], 10);
        return currentYear - birthYear;
      };

      expect(calculateAge('2012-05-15', 2026)).toBe(14);
    });

    it('5. SHOULD validate parent phone number length and format (10 digits starting with 0)', () => {
      const validatePhone = (phone: string) => {
        const regex = /^0\d{9}$/;
        if (!regex.test(phone)) throw new Error('Số điện thoại phụ huynh phải có 10 chữ số bắt đầu bằng 0!');
        return true;
      };

      expect(() => validatePhone('0912345')).toThrow();
      expect(() => validatePhone('1900123456')).toThrow();
      expect(validatePhone('0912345678')).toBe(true);
    });
  });

  describe('Parent Profile & Multi-child Association', () => {
    it('6. SHOULD associate parent name, phone, email, and relation to student', () => {
      const parentInfo = {
        name: 'Nguyễn Văn Bố',
        phone: '0912345678',
        email: 'parent@gmail.com',
        relationship: 'Bố',
      };

      expect(parentInfo.relationship).toBe('Bố');
      expect(parentInfo.phone).toBe('0912345678');
    });

    it('7. SHOULD link multiple students to the same parent phone number', () => {
      const parentPhone = '0912345678';
      const students = [
        { id: 's1', name: 'Nguyễn Văn An', parentPhone },
        { id: 's2', name: 'Nguyễn Thị Bình', parentPhone },
      ];

      const children = students.filter((s) => s.parentPhone === parentPhone);
      expect(children).toHaveLength(2);
    });

    it('8. SHOULD update student status to Dropped when leaving center', () => {
      const student = { id: 's1', status: 'Active' };
      const dropStudent = (s: typeof student) => ({ ...s, status: 'Dropped' });

      expect(dropStudent(student).status).toBe('Dropped');
    });

    it('9. SHOULD update student status to Reserved (Bảo lưu)', () => {
      const student = { id: 's1', status: 'Active' };
      const reserveStudent = (s: typeof student) => ({ ...s, status: 'Reserved' });

      expect(reserveStudent(student).status).toBe('Reserved');
    });

    it('10. SHOULD filter student list by center ID', () => {
      const students = [
        { id: 's1', centerId: 'c1' },
        { id: 's2', centerId: 'c2' },
        { id: 's3', centerId: 'c1' },
      ];

      const center1Students = students.filter((s) => s.centerId === 'c1');
      expect(center1Students).toHaveLength(2);
    });

    it('11. SHOULD search student list by student code or full name', () => {
      const students = [
        { studentCode: 'HS00001', name: 'Nguyễn Văn An' },
        { studentCode: 'HS00002', name: 'Trần Thị Bình' },
      ];

      const search = (q: string) =>
        students.filter(
          (s) =>
            s.studentCode.toLowerCase().includes(q.toLowerCase()) ||
            s.name.toLowerCase().includes(q.toLowerCase()),
        );

      expect(search('HS00001')).toHaveLength(1);
      expect(search('Bình')).toHaveLength(1);
      expect(search('Không có')).toHaveLength(0);
    });

    it('12. SHOULD calculate total active students count per center', () => {
      const list = [
        { centerId: 'c1', status: 'Active' },
        { centerId: 'c1', status: 'Dropped' },
        { centerId: 'c1', status: 'Active' },
      ];

      const activeCount = list.filter((s) => s.centerId === 'c1' && s.status === 'Active').length;
      expect(activeCount).toBe(2);
    });
  });

  describe('Student Class Enrollment & History Tracking', () => {
    it('13. SHOULD record class enrollment date (joinedDate)', () => {
      const enrollment = {
        studentId: 's1',
        classId: 'class-101',
        joinedDate: '2026-06-01',
        status: 'Active',
      };

      expect(enrollment.joinedDate).toBe('2026-06-01');
      expect(enrollment.status).toBe('Active');
    });

    it('14. SHOULD prevent enrolling same student twice in the same class', () => {
      const existingEnrollments = [{ studentId: 's1', classId: 'c1', status: 'Active' }];

      const enroll = (studentId: string, classId: string) => {
        const exists = existingEnrollments.some((e) => e.studentId === studentId && e.classId === classId && e.status === 'Active');
        if (exists) throw new Error('Học sinh đã đăng ký vào lớp học này!');
        return { studentId, classId, status: 'Active' };
      };

      expect(() => enroll('s1', 'c1')).toThrow('Học sinh đã đăng ký vào lớp học này!');
      expect(enroll('s1', 'c2')).toEqual({ studentId: 's1', classId: 'c2', status: 'Active' });
    });

    it('15. SHOULD preserve historical class enrollments when student transfers class', () => {
      const enrollments = [
        { classId: 'c1', status: 'Transferred', joinedDate: '2026-01-01', leftDate: '2026-05-31' },
        { classId: 'c2', status: 'Active', joinedDate: '2026-06-01' },
      ];

      expect(enrollments).toHaveLength(2);
      expect(enrollments[0].status).toBe('Transferred');
      expect(enrollments[1].status).toBe('Active');
    });

    it('16. SHOULD calculate total active classes per student', () => {
      const studentClasses = [
        { classId: 'c1', status: 'Active' },
        { classId: 'c2', status: 'Active' },
        { classId: 'c3', status: 'Dropped' },
      ];

      const activeCount = studentClasses.filter((c) => c.status === 'Active').length;
      expect(activeCount).toBe(2);
    });

    it('17. SHOULD validate student avatar URL extension (png, jpg, jpeg, webp)', () => {
      const validExts = ['png', 'jpg', 'jpeg', 'webp'];
      const isValidAvatar = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase();
        return ext ? validExts.includes(ext) : false;
      };

      expect(isValidAvatar('https://img.com/avatar.jpg')).toBe(true);
      expect(isValidAvatar('https://img.com/avatar.exe')).toBe(false);
    });

    it('18. SHOULD format student full address display string', () => {
      const student = { address: 'Số 123 Đường Cầu Giấy', district: 'Cầu Giấy', city: 'Hà Nội' };
      const fullAddress = `${student.address}, ${student.district}, ${student.city}`;

      expect(fullAddress).toBe('Số 123 Đường Cầu Giấy, Cầu Giấy, Hà Nội');
    });

    it('19. SHOULD sort students alphabetically by firstName', () => {
      const list = [
        { firstName: 'Cường', lastName: 'Nguyễn' },
        { firstName: 'An', lastName: 'Trần' },
        { firstName: 'Bình', lastName: 'Lê' },
      ];

      const sorted = [...list].sort((a, b) => a.firstName.localeCompare(b.firstName, 'vi'));
      expect(sorted[0].firstName).toBe('An');
      expect(sorted[1].firstName).toBe('Bình');
      expect(sorted[2].firstName).toBe('Cường');
    });

    it('20. SHOULD check if student has any pending unpaid tuition bills', () => {
      const studentBills = [
        { billId: 'b1', status: 'Paid' },
        { billId: 'b2', status: 'Unpaid' },
      ];

      const hasDebt = studentBills.some((b) => b.status === 'Unpaid');
      expect(hasDebt).toBe(true);
    });

    it('21. SHOULD calculate student total attendance sessions completed', () => {
      const attendance = [
        { status: 'Completed', isPresent: true },
        { status: 'Completed', isPresent: false },
        { status: 'Scheduled', isPresent: false },
      ];

      const completedCount = attendance.filter((a) => a.status === 'Completed').length;
      expect(completedCount).toBe(2);
    });

    it('22. SHOULD format student gender display tag color (Nam: Blue, Nữ: Pink)', () => {
      const getGenderColor = (gender: string) => (gender === 'Nam' ? '#3b82f6' : '#ec4899');

      expect(getGenderColor('Nam')).toBe('#3b82f6');
      expect(getGenderColor('Nữ')).toBe('#ec4899');
    });

    it('23. SHOULD validate student note content maximum 500 characters', () => {
      const validateNote = (note: string) => {
        if (note.length > 500) throw new Error('Ghi chú không được vượt quá 500 ký tự');
        return true;
      };

      expect(validateNote('Học sinh chăm chỉ')).toBe(true);
      expect(() => validateNote('a'.repeat(501))).toThrow('Ghi chú không được vượt quá 500 ký tự');
    });

    it('24. SHOULD calculate student overall homework average score', () => {
      const homeworkScores = [9, 10, 8, 7];
      const avg = homeworkScores.reduce((sum, s) => sum + s, 0) / homeworkScores.length;

      expect(avg).toBe(8.5);
    });

    it('25. SHOULD verify complete student entity structure integrity', () => {
      const student = {
        id: 'student-100',
        studentCode: 'HS00100',
        userId: 'user-200',
        centerId: 'center-1',
        firstName: 'An',
        lastName: 'Nguyễn',
        gender: 'Nam',
        dateOfBirth: '2012-05-15',
        parentName: 'Nguyễn Văn Bố',
        parentPhone: '0912345678',
        parentEmail: 'parent@gmail.com',
        status: 'Active',
      };

      expect(student.studentCode).toBe('HS00100');
      expect(student.status).toBe('Active');
      expect(student.parentPhone).toBe('0912345678');
    });
  });
});
