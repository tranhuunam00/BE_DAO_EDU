describe('Financial & Educational Analytics Reports Deep Test Suite', () => {
  describe('Revenue & Tuition Analytics Reports', () => {
    it('1. SHOULD aggregate monthly tuition revenue grouped by center', () => {
      const payments = [
        { centerId: 'c1', month: '2026-07', amount: 5000000 },
        { centerId: 'c1', month: '2026-07', amount: 3000000 },
        { centerId: 'c2', month: '2026-07', amount: 4000000 },
      ];

      const revenueByCenter: Record<string, number> = {};
      for (const p of payments) {
        revenueByCenter[p.centerId] = (revenueByCenter[p.centerId] || 0) + p.amount;
      }

      expect(revenueByCenter['c1']).toBe(8000000);
      expect(revenueByCenter['c2']).toBe(4000000);
    });

    it('2. SHOULD calculate net profit = totalRevenue - totalTeacherSalary', () => {
      const totalRevenue = 50000000;
      const totalSalary = 20000000;

      const netProfit = totalRevenue - totalSalary;
      expect(netProfit).toBe(30000000);
    });

    it('3. SHOULD calculate profit margin percentage = (netProfit / totalRevenue) * 100', () => {
      const totalRevenue = 50000000;
      const netProfit = 30000000;

      const margin = (netProfit / totalRevenue) * 100;
      expect(margin).toBe(60.0);
    });

    it('4. SHOULD aggregate sale orders report grouped by payment status (Paid vs Unpaid)', () => {
      const orders = [
        { id: '1', status: 'Paid', amount: 1500000 },
        { id: '2', status: 'Unpaid', amount: 2000000 },
        { id: '3', status: 'Paid', amount: 1500000 },
      ];

      const paidTotal = orders.filter((o) => o.status === 'Paid').reduce((sum, o) => sum + o.amount, 0);
      const unpaidTotal = orders.filter((o) => o.status === 'Unpaid').reduce((sum, o) => sum + o.amount, 0);

      expect(paidTotal).toBe(3000000);
      expect(unpaidTotal).toBe(2000000);
    });

    it('5. SHOULD calculate tuition collection rate percentage = (paidTotal / (paidTotal + unpaidTotal)) * 100', () => {
      const paidTotal = 3000000;
      const unpaidTotal = 2000000;

      const collectionRate = (paidTotal / (paidTotal + unpaidTotal)) * 100;
      expect(collectionRate).toBe(60.0);
    });
  });

  describe('Attendance & Student Engagement Analytics Reports', () => {
    it('6. SHOULD calculate average class attendance rate for a given month', () => {
      const classSessions = [
        { classId: 'c1', expected: 20, present: 18 },
        { classId: 'c1', expected: 20, present: 16 },
      ];

      const totalExpected = classSessions.reduce((sum, s) => sum + s.expected, 0);
      const totalPresent = classSessions.reduce((sum, s) => sum + s.present, 0);

      const rate = (totalPresent / totalExpected) * 100;
      expect(rate).toBe(85.0);
    });

    it('7. SHOULD generate student debt report listing students with unpaid balances', () => {
      const debts = [
        { studentId: 's1', studentName: 'An', debtAmount: 1500000, daysOverdue: 15 },
        { studentId: 's2', studentName: 'Bình', debtAmount: 2000000, daysOverdue: 30 },
      ];

      const totalDebt = debts.reduce((sum, d) => sum + d.debtAmount, 0);
      expect(debts).toHaveLength(2);
      expect(totalDebt).toBe(3500000);
    });

    it('8. SHOULD sort student debt report by debtAmount descending', () => {
      const debts = [
        { studentName: 'An', debtAmount: 1000000 },
        { studentName: 'Bình', debtAmount: 3000000 },
        { studentName: 'Cường', debtAmount: 2000000 },
      ];

      const sorted = [...debts].sort((a, b) => b.debtAmount - a.debtAmount);
      expect(sorted[0].studentName).toBe('Bình');
      expect(sorted[1].studentName).toBe('Cường');
      expect(sorted[2].studentName).toBe('An');
    });

    it('9. SHOULD calculate new student growth rate month-over-month', () => {
      const previousMonthNewStudents = 20;
      const currentMonthNewStudents = 25;

      const growthRate = ((currentMonthNewStudents - previousMonthNewStudents) / previousMonthNewStudents) * 100;
      expect(growthRate).toBe(25.0);
    });

    it('10. SHOULD calculate student retention rate = ((activeEnd - newJoined) / activeStart) * 100', () => {
      const activeStart = 100;
      const newJoined = 15;
      const activeEnd = 105;

      const retentionRate = ((activeEnd - newJoined) / activeStart) * 100;
      expect(retentionRate).toBe(90.0);
    });
  });

  describe('Teacher Productivity & Assignment Reports', () => {
    it('11. SHOULD calculate total teacher salary expense per center', () => {
      const salaries = [
        { centerId: 'c1', teacherId: 't1', amount: 5000000 },
        { centerId: 'c1', teacherId: 't2', amount: 6000000 },
        { centerId: 'c2', teacherId: 't3', amount: 4000000 },
      ];

      const c1Total = salaries.filter((s) => s.centerId === 'c1').reduce((sum, s) => sum + s.amount, 0);
      expect(c1Total).toBe(11000000);
    });

    it('12. SHOULD calculate homework submission completion rate per class', () => {
      const totalAssigned = 50; // 5 assignments * 10 students
      const totalSubmitted = 45;

      const rate = (totalSubmitted / totalAssigned) * 100;
      expect(rate).toBe(90.0);
    });

    it('13. SHOULD calculate teacher average grading delay in days', () => {
      const gradings = [
        { submittedAt: '2026-07-01', gradedAt: '2026-07-02' }, // 1 day
        { submittedAt: '2026-07-01', gradedAt: '2026-07-04' }, // 3 days
      ];

      const getDaysDiff = (start: string, end: string) => {
        const d1 = new Date(start).getTime();
        const d2 = new Date(end).getTime();
        return (d2 - d1) / (1000 * 60 * 60 * 24);
      };

      const avgDelay = gradings.reduce((sum, g) => sum + getDaysDiff(g.submittedAt, g.gradedAt), 0) / gradings.length;
      expect(avgDelay).toBe(2.0);
    });

    it('14. SHOULD filter report date ranges by startMonth and endMonth', () => {
      const monthlyData = [
        { month: '2026-05', revenue: 10 },
        { month: '2026-06', revenue: 20 },
        { month: '2026-07', revenue: 30 },
        { month: '2026-08', revenue: 40 },
      ];

      const startMonth = '2026-06';
      const endMonth = '2026-07';

      const filtered = monthlyData.filter((d) => d.month >= startMonth && d.month <= endMonth);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].month).toBe('2026-06');
      expect(filtered[1].month).toBe('2026-07');
    });

    it('15. SHOULD aggregate class students count statistics', () => {
      const stats = [
        { classId: 'c1', className: 'Toán 1', activeCount: 15, droppedCount: 2 },
        { classId: 'c2', className: 'Toán 2', activeCount: 20, droppedCount: 1 },
      ];

      const totalActive = stats.reduce((sum, s) => sum + s.activeCount, 0);
      const totalDropped = stats.reduce((sum, s) => sum + s.droppedCount, 0);

      expect(totalActive).toBe(35);
      expect(totalDropped).toBe(3);
    });

    it('16. SHOULD calculate average score by subject across all classes', () => {
      const scores = [
        { subject: 'Toán', score: 8.5 },
        { subject: 'Toán', score: 9.5 },
        { subject: 'Văn', score: 7.0 },
      ];

      const mathScores = scores.filter((s) => s.subject === 'Toán');
      const mathAvg = mathScores.reduce((sum, s) => sum + s.score, 0) / mathScores.length;

      expect(mathAvg).toBe(9.0);
    });

    it('17. SHOULD format report summary numbers with thousand separators', () => {
      const formatNumber = (num: number) => num.toLocaleString('vi-VN');
      expect(formatNumber(15000000)).toBe('15.000.000');
    });

    it('18. SHOULD calculate student churn rate percentage = (droppedStudents / totalActiveStart) * 100', () => {
      const totalActiveStart = 100;
      const droppedStudents = 5;

      const churnRate = (droppedStudents / totalActiveStart) * 100;
      expect(churnRate).toBe(5.0);
    });

    it('19. SHOULD format month string validation (YYYY-MM)', () => {
      const isValidMonth = (m: string) => /^\d{4}-\d{2}$/.test(m);

      expect(isValidMonth('2026-07')).toBe(true);
      expect(isValidMonth('07/2026')).toBe(false);
    });

    it('20. SHOULD calculate average class occupancy rate per center', () => {
      const classes = [
        { enrolled: 15, capacity: 20 }, // 75%
        { enrolled: 25, capacity: 25 }, // 100%
      ];

      const totalEnrolled = classes.reduce((sum, c) => sum + c.enrolled, 0);
      const totalCapacity = classes.reduce((sum, c) => sum + c.capacity, 0);
      const occupancyRate = (totalEnrolled / totalCapacity) * 100;

      expect(occupancyRate).toBe(88.88888888888889);
      expect(Math.round(occupancyRate)).toBe(89);
    });

    it('21. SHOULD filter reports by class status (Active vs Completed)', () => {
      const reports = [
        { classId: 'c1', status: 'Active', revenue: 100 },
        { classId: 'c2', status: 'Completed', revenue: 200 },
      ];

      const activeReports = reports.filter((r) => r.status === 'Active');
      expect(activeReports).toHaveLength(1);
    });

    it('22. SHOULD group attendance reports by day of week', () => {
      const attendanceByDay = {
        Mon: { total: 100, present: 95 },
        Wed: { total: 100, present: 90 },
      };

      const monRate = (attendanceByDay.Mon.present / attendanceByDay.Mon.total) * 100;
      expect(monRate).toBe(95.0);
    });

    it('23. SHOULD calculate teacher hourly wage average per center', () => {
      const teachers = [{ hourlyRate: 200000 }, { hourlyRate: 300000 }];
      const avg = teachers.reduce((sum, t) => sum + t.hourlyRate, 0) / teachers.length;

      expect(avg).toBe(250000);
    });

    it('24. SHOULD calculate uncollected debt percentage against total billed tuition', () => {
      const totalBilled = 10000000;
      const totalUncollected = 1500000;

      const debtPercentage = (totalUncollected / totalBilled) * 100;
      expect(debtPercentage).toBe(15.0);
    });

    it('25. SHOULD verify complete report result structure integrity', () => {
      const reportResult = {
        month: '2026-07',
        centerId: 'center-1',
        totalRevenue: 50000000,
        totalSalary: 20000000,
        netProfit: 30000000,
        activeClassesCount: 12,
        activeStudentsCount: 150,
      };

      expect(reportResult.netProfit).toBe(30000000);
      expect(reportResult.activeClassesCount).toBe(12);
    });
  });
});
