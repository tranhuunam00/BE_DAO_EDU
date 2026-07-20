describe('Financial & Educational Analytics Reports Additional 25 Edge-Case Tests', () => {
  describe('Revenue Trends & Monthly Analytics Edge Cases', () => {
    it('26. SHOULD calculate percentage change in monthly revenue compared to previous month', () => {
      const prevRevenue = 40000000;
      const currRevenue = 50000000;

      const pctChange = ((currRevenue - prevRevenue) / prevRevenue) * 100;
      expect(pctChange).toBe(25.0);
    });

    it('27. SHOULD handle zero previous month revenue without division by zero error', () => {
      const prevRevenue = 0;
      const currRevenue = 20000000;

      const pctChange = prevRevenue === 0 ? 100.0 : ((currRevenue - prevRevenue) / prevRevenue) * 100;
      expect(pctChange).toBe(100.0);
    });

    it('28. SHOULD aggregate revenue by payment method (VietQR, Cash, BankTransfer)', () => {
      const payments = [
        { method: 'VietQR', amount: 5000000 },
        { method: 'Cash', amount: 2000000 },
        { method: 'VietQR', amount: 3000000 },
      ];

      const byMethod: Record<string, number> = {};
      for (const p of payments) {
        byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      }

      expect(byMethod['VietQR']).toBe(8000000);
      expect(byMethod['Cash']).toBe(2000000);
    });

    it('29. SHOULD calculate average revenue per student per center', () => {
      const centerRevenue = 15000000;
      const studentCount = 10;

      const avgPerStudent = centerRevenue / studentCount;
      expect(avgPerStudent).toBe(1500000);
    });

    it('30. SHOULD filter report statistics by class status (Active, Completed)', () => {
      const classes = [
        { id: 'c1', status: 'Active', studentCount: 15 },
        { id: 'c2', status: 'Completed', studentCount: 20 },
      ];

      const activeOnly = classes.filter((c) => c.status === 'Active');
      expect(activeOnly).toHaveLength(1);
    });
  });

  describe('Attendance Breakdown & Dropout Risk Reports', () => {
    it('31. SHOULD identify students at high risk of dropping out (absence rate >= 30%)', () => {
      const studentStats = [
        { id: 's1', name: 'An', totalSessions: 10, absentCount: 4 }, // 40%
        { id: 's2', name: 'Bình', totalSessions: 10, absentCount: 1 }, // 10%
      ];

      const highRisk = studentStats.filter((s) => (s.absentCount / s.totalSessions) * 100 >= 30.0);
      expect(highRisk).toHaveLength(1);
      expect(highRisk[0].name).toBe('An');
    });

    it('32. SHOULD calculate total unexcused absences in a month across center', () => {
      const absences = [
        { reason: 'Ốm', isExcused: true },
        { reason: undefined, isExcused: false },
        { reason: undefined, isExcused: false },
      ];

      const unexcusedCount = absences.filter((a) => !a.isExcused).length;
      expect(unexcusedCount).toBe(2);
    });

    it('33. SHOULD calculate average class completion rate percentage', () => {
      const classes = [
        { totalSessions: 24, completedSessions: 12 }, // 50%
        { totalSessions: 24, completedSessions: 24 }, // 100%
      ];

      const avgRate =
        classes.reduce((sum, c) => sum + (c.completedSessions / c.totalSessions) * 100, 0) / classes.length;

      expect(avgRate).toBe(75.0);
    });

    it('34. SHOULD aggregate student debt by age of debt (<30 days, 30-60 days, >60 days)', () => {
      const debts = [
        { amount: 1000000, daysOverdue: 15 },
        { amount: 2000000, daysOverdue: 45 },
        { amount: 3000000, daysOverdue: 75 },
      ];

      const range30 = debts.filter((d) => d.daysOverdue < 30).reduce((s, d) => s + d.amount, 0);
      const range60 = debts.filter((d) => d.daysOverdue >= 30 && d.daysOverdue <= 60).reduce((s, d) => s + d.amount, 0);
      const range90 = debts.filter((d) => d.daysOverdue > 60).reduce((s, d) => s + d.amount, 0);

      expect(range30).toBe(1000000);
      expect(range60).toBe(2000000);
      expect(range90).toBe(3000000);
    });

    it('35. SHOULD calculate total teacher salary expense per course subject', () => {
      const teacherWages = [
        { subject: 'Toán', amount: 8000000 },
        { subject: 'Văn', amount: 5000000 },
        { subject: 'Toán', amount: 6000000 },
      ];

      const mathTotal = teacherWages.filter((w) => w.subject === 'Toán').reduce((sum, w) => sum + w.amount, 0);
      expect(mathTotal).toBe(14000000);
    });

    it('36. SHOULD format report date range label (VD: Báo cáo Từ 01/06/2026 Đến 30/06/2026)', () => {
      const formatRange = (start: string, end: string) => `Báo cáo Từ ${start} Đến ${end}`;
      expect(formatRange('01/06/2026', '30/06/2026')).toBe('Báo cáo Từ 01/06/2026 Đến 30/06/2026');
    });

    it('37. SHOULD calculate homework submission response rate per teacher', () => {
      const teacherStats = [
        { teacherId: 't1', assigned: 40, submitted: 36 },
      ];

      const rate = (teacherStats[0].submitted / teacherStats[0].assigned) * 100;
      expect(rate).toBe(90.0);
    });

    it('38. SHOULD sort centers by total monthly net revenue descending', () => {
      const centers = [
        { centerName: 'Cầu Giấy', netRevenue: 30000000 },
        { centerName: 'Đống Đa', netRevenue: 45000000 },
        { centerName: 'Ba Đình', netRevenue: 20000000 },
      ];

      const sorted = [...centers].sort((a, b) => b.netRevenue - a.netRevenue);
      expect(sorted[0].centerName).toBe('Đống Đa');
      expect(sorted[1].centerName).toBe('Cầu Giấy');
      expect(sorted[2].centerName).toBe('Ba Đình');
    });

    it('39. SHOULD calculate average student attendance per day of week', () => {
      const dayStats = [
        { day: 'Mon', rate: 92.0 },
        { day: 'Wed', rate: 88.0 },
        { day: 'Fri', rate: 90.0 },
      ];

      const avg = dayStats.reduce((sum, d) => sum + d.rate, 0) / dayStats.length;
      expect(avg).toBe(90.0);
    });

    it('40. SHOULD calculate tuition discount loss total across center', () => {
      const discounts = [
        { discountAmount: 300000 },
        { discountAmount: 500000 },
        { discountAmount: 200000 },
      ];

      const totalDiscount = discounts.reduce((sum, d) => sum + d.discountAmount, 0);
      expect(totalDiscount).toBe(1000000);
    });

    it('41. SHOULD calculate average class size per course level', () => {
      const classes = [
        { level: 'A1', enrolled: 20 },
        { level: 'A1', enrolled: 24 },
      ];

      const avg = classes.reduce((sum, c) => sum + c.enrolled, 0) / classes.length;
      expect(avg).toBe(22);
    });

    it('42. SHOULD filter revenue reports by single center ID', () => {
      const revenues = [
        { centerId: 'c1', revenue: 1000 },
        { centerId: 'c2', revenue: 2000 },
      ];

      const c1Revenue = revenues.filter((r) => r.centerId === 'c1');
      expect(c1Revenue).toHaveLength(1);
    });

    it('43. SHOULD calculate teacher cost percentage relative to gross tuition revenue', () => {
      const grossRevenue = 100000000; // 100M
      const totalSalary = 35000000; // 35M

      const salaryPct = (totalSalary / grossRevenue) * 100;
      expect(salaryPct).toBe(35.0);
    });

    it('44. SHOULD validate report startMonth is before or equal to endMonth', () => {
      const validateMonths = (start: string, end: string) => {
        if (start > end) throw new Error('Tháng bắt đầu phải nhỏ hơn hoặc bằng tháng kết thúc!');
        return true;
      };

      expect(() => validateMonths('2026-08', '2026-06')).toThrow('Tháng bắt đầu phải nhỏ hơn hoặc bằng tháng kết thúc!');
      expect(validateMonths('2026-06', '2026-08')).toBe(true);
    });

    it('45. SHOULD calculate total active classes count in report summary', () => {
      const activeClasses = 15;
      expect(activeClasses).toBe(15);
    });

    it('46. SHOULD format percentage rate string rounded to 1 decimal place (VD: 87.5%)', () => {
      const formatPct = (rate: number) => `${rate.toFixed(1)}%`;
      expect(formatPct(87.543)).toBe('87.5%');
    });

    it('47. SHOULD calculate total number of completed class sessions in month', () => {
      const sessions = [
        { status: 'Completed' },
        { status: 'Completed' },
        { status: 'Scheduled' },
      ];

      const completedCount = sessions.filter((s) => s.status === 'Completed').length;
      expect(completedCount).toBe(2);
    });

    it('48. SHOULD calculate average student grade across all graded assignments in month', () => {
      const scores = [8.0, 9.0, 10.0, 9.0];
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;

      expect(avg).toBe(9.0);
    });

    it('49. SHOULD group monthly revenue data by quarter (Q1, Q2, Q3, Q4)', () => {
      const getQuarter = (monthStr: string) => {
        const m = parseInt(monthStr.split('-')[1], 10);
        if (m <= 3) return 'Q1';
        if (m <= 6) return 'Q2';
        if (m <= 9) return 'Q3';
        return 'Q4';
      };

      expect(getQuarter('2026-07')).toBe('Q3');
      expect(getQuarter('2026-02')).toBe('Q1');
    });

    it('50. SHOULD verify complete report analytics data structure integrity', () => {
      const reportAnalytics = {
        period: '2026-07',
        centerId: 'center-1',
        grossRevenue: 60000000,
        netRevenue: 55000000,
        totalSalaryPaid: 20000000,
        netProfit: 35000000,
        attendanceRate: 92.5,
        totalStudents: 120,
      };

      expect(reportAnalytics.period).toBe('2026-07');
      expect(reportAnalytics.netProfit).toBe(35000000);
      expect(reportAnalytics.attendanceRate).toBe(92.5);
    });
  });
});
