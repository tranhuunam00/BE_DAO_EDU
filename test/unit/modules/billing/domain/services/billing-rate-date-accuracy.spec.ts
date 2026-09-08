import { BillingCalculator, BillingSource, PricingRule } from '../../../../../../src/modules/billing/domain/services/billing-calculator';

/**
 * Test Suite: Độ chính xác của Tiền Bill theo Ngày Tháng & Đối Soát Rate Thực Tế
 * Kiểm tra đối chiếu 3 chiều giữa:
 * 1. Bảng giá CourseLevelPricing (theo effectiveFrom -> effectiveTo)
 * 2. ClassSession (ngày học, billed_teacher_wage, billed_assistant_wage)
 * 3. StudentAttendance (ngày học, billed_amount, isPresent, joinedDate)
 * 4. Bill & Wage Items (tổng số ca, rate từng giai đoạn, tổng tiền)
 */

const createSource = (overrides: Partial<BillingSource> & { id: string; ownerId: string; date: string }): BillingSource => ({
  ownerCode: `CODE-${overrides.ownerId}`,
  ownerName: `Name ${overrides.ownerId}`,
  ownerMobile: '0901234567',
  ownerStatus: 'Active',
  classId: 'class-1',
  className: 'Lớp Tiếng Anh',
  courseName: 'Tiếng Anh',
  levelName: 'Level 1',
  courseLevelId: 'level-1',
  isPresent: true,
  ...overrides,
});

describe('Billing Rate vs Session & Attendance Date Accuracy Suite (10 Scenarios)', () => {
  // =========================================================================
  // Scenario 1: Chuẩn 1 tháng cố định giá (Flat Rate Single Month)
  // =========================================================================
  it('Scenario 1: [Flat Rate] Đối chiếu chính xác 100% rate giữa Bảng giá, 4 ca học của GV và Điểm danh của Học sinh trong tháng 3', () => {
    const marchPricing: PricingRule[] = [
      {
        courseLevelId: 'level-toeic',
        pricePerSession: 150000,
        teacherWagePerSession: 80000,
        taWagePerSession: 40000,
        effectiveFrom: '2026-03-01',
        effectiveTo: '2026-03-31',
      },
    ];

    const sessionDates = ['2026-03-05', '2026-03-12', '2026-03-19', '2026-03-26'];
    const studentSources: BillingSource[] = sessionDates.map((date, idx) =>
      createSource({
        id: `att-${idx + 1}`,
        ownerId: 'student-an',
        classId: 'class-toeic-01',
        courseLevelId: 'level-toeic',
        date,
        isPresent: true,
      }),
    );

    const teacherSources: BillingSource[] = sessionDates.map((date, idx) =>
      createSource({
        id: `sess-${idx + 1}`,
        ownerId: 'teacher-nam',
        classId: 'class-toeic-01',
        courseLevelId: 'level-toeic',
        date,
        roleInSession: 'teacher',
      }),
    );

    const assistantSources: BillingSource[] = sessionDates.map((date, idx) =>
      createSource({
        id: `sess-${idx + 1}`,
        ownerId: 'ta-hoa',
        classId: 'class-toeic-01',
        courseLevelId: 'level-toeic',
        date,
        roleInSession: 'assistant',
      }),
    );

    // 1. Tính tiền học sinh
    const [studentBill] = BillingCalculator.calculate(studentSources, marchPricing, 'pricePerSession');
    expect(studentBill.totalSessions).toBe(4);
    expect(studentBill.totalAmount).toBe(600000); // 4 x 150,000
    expect(studentBill.lines).toHaveLength(1);
    expect(studentBill.lines[0].rate).toBe(150000);
    expect(studentBill.lines[0].sessionsCount).toBe(4);

    // Đối chiếu từng buổi điểm danh: mỗi buổi phải khớp chính xác 150k
    studentSources.forEach((s) => {
      const active = BillingCalculator.getActivePricing(marchPricing, s.date, 'pricePerSession', s.courseLevelId);
      expect(active?.pricePerSession).toBe(150000);
    });

    // 2. Tính lương GV chính
    const [teacherWage] = BillingCalculator.calculate(teacherSources, marchPricing, 'teacherWagePerSession');
    expect(teacherWage.totalSessions).toBe(4);
    expect(teacherWage.totalAmount).toBe(320000); // 4 x 80,000
    expect(teacherWage.lines[0].rate).toBe(80000);

    // 3. Tính thù lao Trợ giảng
    const [taWage] = BillingCalculator.calculate(assistantSources, marchPricing, 'teacherWagePerSession');
    expect(taWage.totalSessions).toBe(4);
    expect(taWage.totalAmount).toBe(160000); // 4 x 40,000
    expect(taWage.lines[0].rate).toBe(40000);
  });

  // =========================================================================
  // Scenario 2: Đổi giá giữa tháng (Mid-Month Price Transition)
  // =========================================================================
  it('Scenario 2: [Mid-Month Split] Tháng 4 đổi giá từ ngày 16: Tách chính xác ca trước 16 và sau 16 cho cả GV và HS', () => {
    const aprilPricing: PricingRule[] = [
      {
        courseLevelId: 'level-ielts',
        pricePerSession: 120000,
        teacherWagePerSession: 70000,
        taWagePerSession: 35000,
        effectiveFrom: '2026-04-01',
        effectiveTo: '2026-04-15',
      },
      {
        courseLevelId: 'level-ielts',
        pricePerSession: 160000,
        teacherWagePerSession: 90000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-04-16',
        effectiveTo: '2026-04-30',
      },
    ];

    const sessions = [
      { id: 'cs-1', date: '2026-04-03', expectedStudentRate: 120000, expectedTeacherRate: 70000, expectedTaRate: 35000 },
      { id: 'cs-2', date: '2026-04-10', expectedStudentRate: 120000, expectedTeacherRate: 70000, expectedTaRate: 35000 },
      { id: 'cs-3', date: '2026-04-17', expectedStudentRate: 160000, expectedTeacherRate: 90000, expectedTaRate: 50000 },
      { id: 'cs-4', date: '2026-04-24', expectedStudentRate: 160000, expectedTeacherRate: 90000, expectedTaRate: 50000 },
    ];

    sessions.forEach((s) => {
      const studentP = BillingCalculator.getActivePricing(aprilPricing, s.date, 'pricePerSession', 'level-ielts');
      const teacherP = BillingCalculator.getActivePricing(aprilPricing, s.date, 'teacherWagePerSession', 'level-ielts');
      const taP = BillingCalculator.getActivePricing(aprilPricing, s.date, 'taWagePerSession', 'level-ielts');

      expect(studentP?.pricePerSession).toBe(s.expectedStudentRate);
      expect(teacherP?.teacherWagePerSession).toBe(s.expectedTeacherRate);
      expect(taP?.taWagePerSession).toBe(s.expectedTaRate);
    });

    const studentSources: BillingSource[] = sessions.map((s) =>
      createSource({
        id: `att-${s.id}`,
        ownerId: 'student-binh',
        classId: 'class-ielts-02',
        courseLevelId: 'level-ielts',
        date: s.date,
        isPresent: true,
      }),
    );

    const [studentBill] = BillingCalculator.calculate(studentSources, aprilPricing, 'pricePerSession');
    expect(studentBill.totalAmount).toBe(560000); // 2 x 120k + 2 x 160k
    expect(studentBill.lines).toHaveLength(2);

    const lineEarly = studentBill.lines.find((l) => l.rate === 120000);
    const lineLate = studentBill.lines.find((l) => l.rate === 160000);
    expect(lineEarly?.sessionsCount).toBe(2);
    expect(lineEarly?.totalAmount).toBe(240000);
    expect(lineEarly?.sourceIds).toEqual(['att-cs-1', 'att-cs-2']);

    expect(lineLate?.sessionsCount).toBe(2);
    expect(lineLate?.totalAmount).toBe(320000);
    expect(lineLate?.sourceIds).toEqual(['att-cs-3', 'att-cs-4']);

    const teacherSources: BillingSource[] = sessions.map((s) =>
      createSource({
        id: s.id,
        ownerId: 'teacher-hung',
        classId: 'class-ielts-02',
        courseLevelId: 'level-ielts',
        date: s.date,
        roleInSession: 'teacher',
      }),
    );

    const [teacherWage] = BillingCalculator.calculate(teacherSources, aprilPricing, 'teacherWagePerSession');
    expect(teacherWage.totalAmount).toBe(320000); // 2 x 70k + 2 x 90k
    expect(teacherWage.lines).toHaveLength(2);
    expect(teacherWage.lines.find((l) => l.rate === 70000)?.sessionsCount).toBe(2);
    expect(teacherWage.lines.find((l) => l.rate === 90000)?.sessionsCount).toBe(2);
  });

  // =========================================================================
  // Scenario 3: Mốc biên chính xác từng ngày (Exact Date Boundaries)
  // =========================================================================
  it('Scenario 3: [Boundary Exactness] Ca học đúng ngày kết thúc đợt 1 (15/5) nhận giá cũ, đúng ngày bắt đầu đợt 2 (16/5) nhận giá mới', () => {
    const boundaryPricing: PricingRule[] = [
      {
        courseLevelId: 'lvl-bound',
        pricePerSession: 100000,
        teacherWagePerSession: 60000,
        taWagePerSession: 30000,
        effectiveFrom: '2026-05-01',
        effectiveTo: '2026-05-15',
      },
      {
        courseLevelId: 'lvl-bound',
        pricePerSession: 200000,
        teacherWagePerSession: 120000,
        taWagePerSession: 60000,
        effectiveFrom: '2026-05-16',
        effectiveTo: '2026-05-31',
      },
    ];

    const pMay15 = BillingCalculator.getActivePricing(boundaryPricing, '2026-05-15', 'pricePerSession', 'lvl-bound');
    const pMay16 = BillingCalculator.getActivePricing(boundaryPricing, '2026-05-16', 'pricePerSession', 'lvl-bound');

    expect(pMay15?.pricePerSession).toBe(100000);
    expect(pMay15?.teacherWagePerSession).toBe(60000);

    expect(pMay16?.pricePerSession).toBe(200000);
    expect(pMay16?.teacherWagePerSession).toBe(120000);
  });

  // =========================================================================
  // Scenario 4: Chuyển giao Năm mới & Năm nhuận 29/02
  // =========================================================================
  it('Scenario 4: [Calendar Transitions] Đối soát chính xác khi qua năm (31/12 -> 01/01) và năm nhuận (29/02)', () => {
    const leapYearPricing: PricingRule[] = [
      {
        courseLevelId: 'lvl-leap',
        pricePerSession: 180000,
        teacherWagePerSession: 100000,
        taWagePerSession: 50000,
        effectiveFrom: '2024-02-01',
        effectiveTo: '2024-02-29',
      },
      {
        courseLevelId: 'lvl-leap',
        pricePerSession: 220000,
        teacherWagePerSession: 120000,
        taWagePerSession: 60000,
        effectiveFrom: '2024-03-01',
        effectiveTo: '2024-03-31',
      },
    ];

    const pFeb29 = BillingCalculator.getActivePricing(leapYearPricing, '2024-02-29', 'pricePerSession', 'lvl-leap');
    const pMar01 = BillingCalculator.getActivePricing(leapYearPricing, '2024-03-01', 'pricePerSession', 'lvl-leap');

    expect(pFeb29?.pricePerSession).toBe(180000);
    expect(pMar01?.pricePerSession).toBe(220000);
  });

  // =========================================================================
  // Scenario 5: Cách ly tuyệt đối ca học ngoài kỳ tính tiền (Out-of-Range Isolation)
  // =========================================================================
  it('Scenario 5: [Range Isolation] Ca học ngày 30/06 và 01/08 không bị tính nhầm vào bill tháng 7', () => {
    const julyPricing: PricingRule[] = [
      {
        courseLevelId: 'lvl-july',
        pricePerSession: 150000,
        teacherWagePerSession: 80000,
        taWagePerSession: 40000,
        effectiveFrom: '2026-07-01',
        effectiveTo: '2026-07-31',
      },
    ];

    const allSessions = [
      { id: 'cs-jun', date: '2026-06-30' },
      { id: 'cs-jul-1', date: '2026-07-05' },
      { id: 'cs-jul-2', date: '2026-07-15' },
      { id: 'cs-aug', date: '2026-08-01' },
    ];

    const filteredForJuly = allSessions.filter((s) => s.date >= '2026-07-01' && s.date <= '2026-07-31');
    expect(filteredForJuly).toHaveLength(2);

    const sources: BillingSource[] = filteredForJuly.map((s) =>
      createSource({
        id: `att-${s.id}`,
        ownerId: 'std-july',
        classId: 'cls-july',
        courseLevelId: 'lvl-july',
        date: s.date,
        isPresent: true,
      }),
    );

    const [bill] = BillingCalculator.calculate(sources, julyPricing, 'pricePerSession');
    expect(bill.totalSessions).toBe(2);
    expect(bill.totalAmount).toBe(300000); // 2 x 150k
    expect(bill.lines[0].sourceIds).toEqual(['att-cs-jul-1', 'att-cs-jul-2']);
    expect(bill.lines[0].sourceIds).not.toContain('att-cs-jun');
    expect(bill.lines[0].sourceIds).not.toContain('att-cs-aug');
  });

  // =========================================================================
  // Scenario 6: CH-05 Dual-Role cùng ngày nhưng khác vai trò và khác rate
  // =========================================================================
  it('Scenario 6: [CH-05 Dual-Role Date Accuracy] Thầy Nam cùng ngày 10/08: Ca sáng dạy chính (80k), ca chiều trợ giảng (40k)', () => {
    const augustPricing: PricingRule[] = [
      {
        courseLevelId: 'lvl-aug',
        pricePerSession: 150000,
        teacherWagePerSession: 80000,
        taWagePerSession: 40000,
        effectiveFrom: '2026-08-01',
        effectiveTo: '2026-08-31',
      },
    ];

    const sources: BillingSource[] = [
      createSource({
        id: 'sess-morning',
        ownerId: 'tch-nam',
        classId: 'cls-morning',
        courseLevelId: 'lvl-aug',
        date: '2026-08-10',
        roleInSession: 'teacher',
      }),
      createSource({
        id: 'sess-afternoon',
        ownerId: 'tch-nam',
        classId: 'cls-afternoon',
        courseLevelId: 'lvl-aug',
        date: '2026-08-10',
        roleInSession: 'assistant',
      }),
    ];

    const [wage] = BillingCalculator.calculate(sources, augustPricing, 'teacherWagePerSession');
    expect(wage.totalAmount).toBe(120000); // 80k + 40k
    expect(wage.totalSessions).toBe(2);
    expect(wage.lines).toHaveLength(2);

    const teacherLine = wage.lines.find((l) => l.roleInSession === 'teacher');
    const assistantLine = wage.lines.find((l) => l.roleInSession === 'assistant');

    expect(teacherLine?.rate).toBe(80000);
    expect(teacherLine?.totalAmount).toBe(80000);
    expect(teacherLine?.sourceIds).toEqual(['sess-morning']);

    expect(assistantLine?.rate).toBe(40000);
    expect(assistantLine?.totalAmount).toBe(40000);
    expect(assistantLine?.sourceIds).toEqual(['sess-afternoon']);
  });

  // =========================================================================
  // Scenario 7: Điểm danh vắng mặt (Absent Session Rate Mapping)
  // =========================================================================
  it('Scenario 7: [Absent Rate Accuracy] Buổi học vắng mặt: Học sinh không bị tính tiền nhưng GV vẫn nhận đủ lương ca học đó', () => {
    const pricing: PricingRule[] = [
      {
        courseLevelId: 'lvl-sep',
        pricePerSession: 140000,
        teacherWagePerSession: 75000,
        taWagePerSession: 35000,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-09-30',
      },
    ];

    // Ngày 05/09: Đi học. Ngày 12/09: Vắng mặt
    const studentSources: BillingSource[] = [
      createSource({ id: 'att-1', ownerId: 'std-lan', classId: 'cls-1', courseLevelId: 'lvl-sep', date: '2026-09-05', isPresent: true }),
      createSource({ id: 'att-2', ownerId: 'std-lan', classId: 'cls-1', courseLevelId: 'lvl-sep', date: '2026-09-12', isPresent: false }),
    ];

    const [studentBill] = BillingCalculator.calculate(studentSources, pricing, 'pricePerSession');
    expect(studentBill.totalAmount).toBe(140000);
    expect(studentBill.totalSessions).toBe(1);

    // Giáo viên dạy cả 2 ca ngày 05/09 và 12/09 -> Vẫn nhận đủ 75k x 2 = 150,000đ
    const teacherSources: BillingSource[] = [
      createSource({ id: 'sess-1', ownerId: 'tch-tuan', classId: 'cls-1', courseLevelId: 'lvl-sep', date: '2026-09-05', roleInSession: 'teacher' }),
      createSource({ id: 'sess-2', ownerId: 'tch-tuan', classId: 'cls-1', courseLevelId: 'lvl-sep', date: '2026-09-12', roleInSession: 'teacher' }),
    ];

    const [teacherWage] = BillingCalculator.calculate(teacherSources, pricing, 'teacherWagePerSession');
    expect(teacherWage.totalAmount).toBe(150000);
    expect(teacherWage.totalSessions).toBe(2);
    expect(teacherWage.lines[0].rate).toBe(75000);
  });

  // =========================================================================
  // Scenario 8: Ngày vào lớp của Học sinh (Student joinedDate Boundary)
  // =========================================================================
  it('Scenario 8: [Joined Date Alignment] Học sinh vào lớp ngày 15/10: Ca học ngày 08/10 không được tính tiền cho học sinh này', () => {
    const octPricing: PricingRule[] = [
      {
        courseLevelId: 'lvl-oct',
        pricePerSession: 130000,
        teacherWagePerSession: 70000,
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-10-31',
      },
    ];

    const joinedDate = '2026-10-15';
    const rawSessions = [
      { date: '2026-10-08', id: 's-early' },
      { date: '2026-10-16', id: 's-valid-1' },
      { date: '2026-10-23', id: 's-valid-2' },
    ];

    const validStudentSessions = rawSessions.filter((s) => s.date >= joinedDate);
    expect(validStudentSessions).toHaveLength(2);

    const studentSources: BillingSource[] = validStudentSessions.map((s) =>
      createSource({
        id: `att-${s.id}`,
        ownerId: 'std-join-late',
        classId: 'cls-oct',
        courseLevelId: 'lvl-oct',
        date: s.date,
        isPresent: true,
      }),
    );

    const [bill] = BillingCalculator.calculate(studentSources, octPricing, 'pricePerSession');
    expect(bill.totalSessions).toBe(2);
    expect(bill.totalAmount).toBe(260000); // 2 x 130k
    expect(bill.lines[0].sourceIds).not.toContain('att-s-early');
  });

  // =========================================================================
  // Scenario 9: Học bổng 0đ xen kẽ (Zero Rate Scholarship Alignment)
  // =========================================================================
  it('Scenario 9: [Zero Rate Scholarship] Học bổng 100% (rate = 0đ): Tiền bill học sinh = 0 nhưng ca học của GV vẫn hưởng lương chuẩn', () => {
    const scholarshipPricing: PricingRule[] = [
      {
        courseLevelId: 'lvl-free',
        pricePerSession: 0,
        teacherWagePerSession: 100000,
        effectiveFrom: '2026-11-01',
        effectiveTo: '2026-11-30',
      },
    ];

    const sources: BillingSource[] = [
      createSource({ id: 'att-free-1', ownerId: 'std-scholarship', classId: 'cls-free', courseLevelId: 'lvl-free', date: '2026-11-10', isPresent: true }),
      createSource({ id: 'att-free-2', ownerId: 'std-scholarship', classId: 'cls-free', courseLevelId: 'lvl-free', date: '2026-11-20', isPresent: true }),
    ];

    const [studentBill] = BillingCalculator.calculate(sources, scholarshipPricing, 'pricePerSession');
    expect(studentBill.totalAmount).toBe(0);
    expect(studentBill.lines[0].rate).toBe(0);

    const teacherSources: BillingSource[] = [
      createSource({ id: 'sess-free-1', ownerId: 'tch-pro', classId: 'cls-free', courseLevelId: 'lvl-free', date: '2026-11-10', roleInSession: 'teacher' }),
      createSource({ id: 'sess-free-2', ownerId: 'tch-pro', classId: 'cls-free', courseLevelId: 'lvl-free', date: '2026-11-20', roleInSession: 'teacher' }),
    ];

    const [teacherWage] = BillingCalculator.calculate(teacherSources, scholarshipPricing, 'teacherWagePerSession');
    expect(teacherWage.totalAmount).toBe(200000); // 2 x 100,000
    expect(teacherWage.lines[0].rate).toBe(100000);
  });

  // =========================================================================
  // Scenario 10: Đối soát 3 chiều không lệch 1 đồng (Three-Way Reconciliation)
  // =========================================================================
  it('Scenario 10: [Three-Way Zero Variance] Đối soát tam giác: Tổng tiền Bill = Tổng tiền Items = Tổng tiền từng ca học trong tháng', () => {
    const pricing: PricingRule[] = [
      { courseLevelId: 'lvl-recon', pricePerSession: 125000, teacherWagePerSession: 65000, effectiveFrom: '2026-12-01', effectiveTo: '2026-12-15' },
      { courseLevelId: 'lvl-recon', pricePerSession: 175000, teacherWagePerSession: 85000, effectiveFrom: '2026-12-16', effectiveTo: '2026-12-31' },
    ];

    const sessions = [
      { id: 's1', date: '2026-12-05' },
      { id: 's2', date: '2026-12-10' },
      { id: 's3', date: '2026-12-20' },
    ];

    const studentSources: BillingSource[] = sessions.map((s) =>
      createSource({
        id: `att-${s.id}`,
        ownerId: 'std-recon',
        classId: 'cls-recon',
        courseLevelId: 'lvl-recon',
        date: s.date,
        isPresent: true,
      }),
    );

    const [bill] = BillingCalculator.calculate(studentSources, pricing, 'pricePerSession');

    // 1. Tính tổng từ từng ca học trực tiếp
    const sumFromSessions = sessions.reduce((sum, s) => {
      const active = BillingCalculator.getActivePricing(pricing, s.date, 'pricePerSession', 'lvl-recon');
      return sum + (active?.pricePerSession || 0);
    }, 0);

    // 2. Tính tổng từ bill items (lines)
    const sumFromLines = bill.lines.reduce((sum, line) => sum + line.totalAmount, 0);

    // 3. Đối chiếu 3 chiều
    expect(bill.totalAmount).toBe(425000); // 125k + 125k + 175k = 425,000
    expect(sumFromSessions).toBe(bill.totalAmount);
    expect(sumFromLines).toBe(bill.totalAmount);

    // Sai lệch phải bằng 0 tuyệt đối
    const variance = bill.totalAmount - sumFromSessions;
    expect(variance).toBe(0);
  });
});
