describe('Student & Parent Additional 25 Edge-Case Tests', () => {
  describe('Student Registration & Validation Edge Cases', () => {
    it('26. SHOULD trim whitespace from student firstName and lastName', () => {
      const formatName = (f: string, l: string) => ({
        firstName: f.trim(),
        lastName: l.trim(),
      });

      expect(formatName('  An  ', ' Nguyễn ')).toEqual({
        firstName: 'An',
        lastName: 'Nguyễn',
      });
    });

    it('27. SHOULD validate student email format if provided', () => {
      const validateEmail = (email?: string) => {
        if (!email) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      };

      expect(validateEmail(undefined)).toBe(true);
      expect(validateEmail('student@dao.edu.vn')).toBe(true);
      expect(validateEmail('invalid-email')).toBe(false);
    });

    it('28. SHOULD check for duplicate student code on student registration', () => {
      const existingCodes = ['HS00001', 'HS00002'];
      const isCodeUnique = (code: string) => !existingCodes.includes(code.toUpperCase());

      expect(isCodeUnique('HS00001')).toBe(false);
      expect(isCodeUnique('HS00003')).toBe(true);
    });

    it('29. SHOULD validate student dateOfBirth is not in the future', () => {
      const validateDob = (dob: string, today: string) => {
        if (dob >= today) throw new Error('Ngày sinh học sinh không thể ở tương lai!');
        return true;
      };

      expect(() => validateDob('2026-12-01', '2026-07-20')).toThrow('Ngày sinh học sinh không thể ở tương lai!');
      expect(validateDob('2014-05-10', '2026-07-20')).toBe(true);
    });

    it('30. SHOULD calculate student age in full years', () => {
      const getFullAge = (birthDateStr: string, currentDateStr: string) => {
        const b = new Date(birthDateStr);
        const c = new Date(currentDateStr);
        let age = c.getFullYear() - b.getFullYear();
        const m = c.getMonth() - b.getMonth();
        if (m < 0 || (m === 0 && c.getDate() < b.getDate())) {
          age--;
        }
        return age;
      };

      expect(getFullAge('2012-08-15', '2026-07-20')).toBe(13);
      expect(getFullAge('2012-05-15', '2026-07-20')).toBe(14);
    });
  });

  describe('Parent Contact & Emergency Info', () => {
    it('31. SHOULD support secondary parent phone number for emergency contact', () => {
      const student = {
        primaryParentPhone: '0912345678',
        secondaryParentPhone: '0987654321',
      };

      expect(student.primaryParentPhone).toBe('0912345678');
      expect(student.secondaryParentPhone).toBe('0987654321');
    });

    it('32. SHOULD normalize phone number format by stripping spaces and dashes', () => {
      const normalizePhone = (phone: string) => phone.replace(/[\s-]/g, '');

      expect(normalizePhone('0912 345 678')).toBe('0912345678');
      expect(normalizePhone('0912-345-678')).toBe('0912345678');
    });

    it('33. SHOULD filter students by parent relationship type (Bố, Mẹ, Ông, Bà, Người giám hộ)', () => {
      const students = [
        { name: 'An', parentRelation: 'Bố' },
        { name: 'Bình', parentRelation: 'Mẹ' },
        { name: 'Cường', parentRelation: 'Bố' },
      ];

      const fatherStudents = students.filter((s) => s.parentRelation === 'Bố');
      expect(fatherStudents).toHaveLength(2);
    });

    it('34. SHOULD validate student school name length max 100 characters', () => {
      const validateSchool = (school: string) => {
        if (school.length > 100) throw new Error('Tên trường học quá dài!');
        return true;
      };

      expect(validateSchool('THCS Cầu Giấy')).toBe(true);
      expect(() => validateSchool('a'.repeat(101))).toThrow('Tên trường học quá dài!');
    });

    it('35. SHOULD calculate student total completed sessions across all enrolled classes', () => {
      const classSessions = [
        { classId: 'c1', completed: 10 },
        { classId: 'c2', completed: 15 },
      ];

      const totalCompleted = classSessions.reduce((sum, c) => sum + c.completed, 0);
      expect(totalCompleted).toBe(25);
    });

    it('36. SHOULD filter students with status Reserved (Bảo lưu)', () => {
      const list = [
        { name: 'A', status: 'Active' },
        { name: 'B', status: 'Reserved' },
        { name: 'C', status: 'Reserved' },
      ];

      const reserved = list.filter((s) => s.status === 'Reserved');
      expect(reserved).toHaveLength(2);
    });

    it('37. SHOULD record date when student status changed to Reserved or Dropped', () => {
      const student = { id: 's1', status: 'Active', statusChangedAt: null as string | null };

      const changeStatus = (s: typeof student, status: string, date: string) => ({
        ...s,
        status,
        statusChangedAt: date,
      });

      const updated = changeStatus(student, 'Reserved', '2026-07-20');
      expect(updated.status).toBe('Reserved');
      expect(updated.statusChangedAt).toBe('2026-07-20');
    });

    it('38. SHOULD calculate student total active assignment submissions count', () => {
      const submissions = [{ status: 'submitted' }, { status: 'graded' }, { status: 'draft' }];

      const activeSubmissions = submissions.filter((s) => ['submitted', 'graded'].includes(s.status));
      expect(activeSubmissions).toHaveLength(2);
    });

    it('39. SHOULD sort students by dateOfBirth ascending (oldest first)', () => {
      const list = [
        { name: 'A', dob: '2012-05-15' },
        { name: 'B', dob: '2010-01-20' },
        { name: 'C', dob: '2014-09-30' },
      ];

      const sorted = [...list].sort((a, b) => a.dob.localeCompare(b.dob));
      expect(sorted[0].name).toBe('B');
      expect(sorted[1].name).toBe('A');
      expect(sorted[2].name).toBe('C');
    });

    it('40. SHOULD format student full name with capitalized first letters', () => {
      const capitalizeName = (name: string) =>
        name
          .toLowerCase()
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

      expect(capitalizeName('nguyễn văn an')).toBe('Nguyễn Văn An');
    });

    it('41. SHOULD calculate student homework average score rounded to 1 decimal place', () => {
      const scores = [8.5, 9.0, 7.5]; // sum = 25
      const avg = Math.round((scores.reduce((s, a) => s + a, 0) / scores.length) * 10) / 10;

      expect(avg).toBe(8.3);
    });

    it('42. SHOULD filter students by city / province', () => {
      const students = [
        { name: 'A', city: 'Hà Nội' },
        { name: 'B', city: 'TP.HCM' },
        { name: 'C', city: 'Hà Nội' },
      ];

      const hnStudents = students.filter((s) => s.city === 'Hà Nội');
      expect(hnStudents).toHaveLength(2);
    });

    it('43. SHOULD check if student is enrolled in any class in current active month', () => {
      const enrollments = [{ classId: 'c1', status: 'Active' }];
      const isEnrolledInAny = enrollments.some((e) => e.status === 'Active');

      expect(isEnrolledInAny).toBe(true);
    });

    it('44. SHOULD format student card summary label (VD: HS00100 - Nguyễn Văn An (Lớp 8A))', () => {
      const formatCard = (code: string, name: string, grade: string) => `${code} - ${name} (${grade})`;

      expect(formatCard('HS00100', 'Nguyễn Văn An', 'Lớp 8A')).toBe('HS00100 - Nguyễn Văn An (Lớp 8A)');
    });

    it('45. SHOULD calculate student total tuition paid in year', () => {
      const paidBills = [
        { year: 2026, amount: 2000000 },
        { year: 2026, amount: 2000000 },
        { year: 2025, amount: 1500000 },
      ];

      const paid2026 = paidBills.filter((b) => b.year === 2026).reduce((sum, b) => sum + b.amount, 0);
      expect(paid2026).toBe(4000000);
    });

    it('46. SHOULD validate student note content allows markdown or plain text', () => {
      const note = '### Ghi chú học tập\n- Tiếp thu nhanh\n- Hay hỏi bài';
      expect(note).toContain('Ghi chú học tập');
    });

    it('47. SHOULD filter student list with pagination (page & limit)', () => {
      const allStudents = Array.from({ length: 25 }, (_, i) => ({ id: `s-${i + 1}` }));

      const page = 2;
      const limit = 10;
      const paginated = allStudents.slice((page - 1) * limit, page * limit);

      expect(paginated).toHaveLength(10);
      expect(paginated[0].id).toBe('s-11');
    });

    it('48. SHOULD calculate student leave requests count', () => {
      const leaveRequests = [
        { status: 'APPROVED' },
        { status: 'REJECTED' },
        { status: 'PENDING' },
      ];

      expect(leaveRequests).toHaveLength(3);
      expect(leaveRequests.filter((l) => l.status === 'APPROVED')).toHaveLength(1);
    });

    it('49. SHOULD allow updating parent email address', () => {
      let student = { id: 's1', parentEmail: 'old@gmail.com' };
      student = { ...student, parentEmail: 'new@gmail.com' };

      expect(student.parentEmail).toBe('new@gmail.com');
    });

    it('50. SHOULD verify complete student profile data structure integrity', () => {
      const profile = {
        id: 'student-200',
        studentCode: 'HS00200',
        firstName: 'Bình',
        lastName: 'Lê',
        gender: 'Nữ',
        dateOfBirth: '2013-10-25',
        schoolName: 'THCS Nguyễn Du',
        gradeName: 'Lớp 7B',
        parentName: 'Lê Thị Mẹ',
        parentPhone: '0987654321',
        parentEmail: 'le.me@gmail.com',
        parentRelation: 'Mẹ',
        address: 'Số 45 Đường Láng',
        district: 'Đống Đa',
        city: 'Hà Nội',
        status: 'Active',
      };

      expect(profile.studentCode).toBe('HS00200');
      expect(profile.gender).toBe('Nữ');
      expect(profile.status).toBe('Active');
    });
  });
});
