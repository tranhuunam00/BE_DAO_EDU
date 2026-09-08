import { PreviewSalaryUseCase } from '../../../../../../src/modules/billing/application/use-cases/preview-billing.use-case';
import { CreatePaymentPeriodUseCase } from '../../../../../../src/modules/billing/application/use-cases/create-payment-period.use-case';
import { BillingPersistencePort, BillingTransactionContext } from '../../../../../../src/modules/billing/application/ports/billing-persistence.port';
import { BillingSource, PricingRule } from '../../../../../../src/modules/billing/domain/services/billing-calculator';

describe('Progressive Commission Challenge Suite - Timeline, Revenue & Data Structures (20 Cases)', () => {
  let mockPersistence: jest.Mocked<BillingPersistencePort>;
  let mockContext: jest.Mocked<BillingTransactionContext>;

  const levelId = 'lvl-comm-challenge';
  const standardPricing: PricingRule[] = [
    {
      id: 'rule-tch-1',
      courseLevelId: levelId,
      pricePerSession: 0,
      teacherWagePerSession: 300000,
      taWagePerSession: 100000,
      effectiveFrom: '2026-09-01',
      effectiveTo: '2026-12-31',
    },
  ];

  const commTeacher = {
    id: 'tch-comm-01',
    teacherId: 'TC01',
    firstName: 'Bình',
    lastName: 'Nguyễn',
    mobile: '0901112222',
    status: 'Active',
    hasCommissionSalary: true,
  };

  const normalTeacher = {
    id: 'tch-norm-02',
    teacherId: 'TN02',
    firstName: 'An',
    lastName: 'Trần',
    mobile: '0903334444',
    status: 'Active',
    hasCommissionSalary: false,
  };

  beforeEach(() => {
    mockContext = {
      loadPricings: jest.fn().mockResolvedValue(standardPricing),
      findTuitionSources: jest.fn().mockResolvedValue([]),
      findSalarySources: jest.fn().mockResolvedValue([]),
      findCommissionTeachers: jest.fn().mockResolvedValue([commTeacher]),
      getPreviousMonthTuitionRevenue: jest.fn().mockResolvedValue(0),
      savePeriod: jest.fn().mockResolvedValue({ id: 'period-oct-26', type: 'salary', month: '2026-10' }),
      saveOrders: jest.fn().mockResolvedValue(['wage-id-01']),
      saveAudit: jest.fn().mockResolvedValue(undefined),
    };

    mockPersistence = {
      transaction: jest.fn().mockImplementation((work) => work(mockContext)),
      loadPricings: jest.fn().mockResolvedValue(standardPricing),
      findTuitionSources: jest.fn().mockResolvedValue([]),
      findSalarySources: jest.fn().mockResolvedValue([]),
      findCommissionTeachers: jest.fn().mockResolvedValue([commTeacher]),
      getPreviousMonthTuitionRevenue: jest.fn().mockResolvedValue(0),
      getStudentTuitionReportData: jest.fn().mockResolvedValue({ sessions: [], pricingList: [] }),
      getStudentTuitionData: jest.fn().mockResolvedValue({ sessions: [], pricingList: [] }),
      getTeacherWageCalculationData: jest.fn().mockResolvedValue({ sessions: [], pricingList: [], wageItems: [] }),
      findPeriod: jest.fn().mockResolvedValue(null),
      listPeriods: jest.fn().mockResolvedValue([]),
      getPeriodSummary: jest.fn().mockResolvedValue({ totalOrders: 0, paidOrders: 0, totalExpected: 0, totalPaid: 0 }),
      getPaymentPeriodDetails: jest.fn().mockResolvedValue(null),
      deletePeriod: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('Nhóm 1: Tương Tác Thời Gian Kỳ Lương & Doanh Số Đối Soát Tháng Trước (Cases T01 - T05)', () => {
    it('Case T01: Kỳ lương T10/2026 đối soát chuẩn xác doanh số học phí T10 (150M -> Gross 32.5M, Net 29.25M)', async () => {
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(150_000_000);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-10-31', undefined, '2026-10');
      expect(mockPersistence.getPreviousMonthTuitionRevenue).toHaveBeenCalledWith('2026-10');
      // Gross = 5M (cứng) + 32.5M (hoa hồng bậc 2: 20M + 50M*25%) = 37.5M -> Net (-10% PIT) = 33.75M
      expect(preview.teachers[0].totalAmount).toBe(33_750_000);
      expect(preview.grandTotal).toBe(33_750_000);
    });

    it('Case T02: Doanh số tháng trước chưa chốt hoặc bằng 0đ -> Chỉ nhận lương cơ bản Net 4.5M', async () => {
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(0);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-10-31', undefined, '2026-10');
      // Gross = 5M -> Net = 4.5M
      expect(preview.teachers[0].totalAmount).toBe(4_500_000);
    });

    it('Case T03: Tự động trích xuất month từ endDate khi không truyền month (endDate 2026-11-30 -> query 2026-11)', async () => {
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(80_000_000);

      await new PreviewSalaryUseCase(mockPersistence).execute('2026-11-30');
      expect(mockPersistence.getPreviousMonthTuitionRevenue).toHaveBeenCalledWith('2026-11');
    });

    it('Case T04: Doanh số cao điểm hè (250M) -> Hoa hồng bậc 3 (60M Gross -> Net 54M) cộng lương cứng', async () => {
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(250_000_000);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-07-31', undefined, '2026-07');
      // Gross: 5M + 60M = 65M -> Net: 65M * 0.9 = 58.5M
      expect(preview.teachers[0].totalAmount).toBe(58_500_000);
    });

    it('Case T05: Doanh số vượt trần kỷ lục (380M > 300M) -> Kịch trần hoa hồng 75M Gross (Net 67.5M)', async () => {
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(380_000_000);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-08-31', undefined, '2026-08');
      // Gross: 5M + 75M = 80M -> Net: 80M * 0.9 = 72M
      expect(preview.teachers[0].totalAmount).toBe(72_000_000);
    });
  });

  describe('Nhóm 2: Cấu Trúc Dữ Liệu Dòng Chi Tiết Ca Dạy Của Giáo Viên Hoa Hồng (Cases T06 - T10)', () => {
    it('Case T06: Dạy 12 ca trong tháng -> Ca dạy được bảo lưu sessionsCount nhưng reset rate=0 để tránh tính đúp', async () => {
      mockContext.getPreviousMonthTuitionRevenue.mockResolvedValue(100_000_000);
      const sources: BillingSource[] = Array.from({ length: 12 }).map((_, i) => ({
        id: `sess-${i + 1}`,
        ownerId: commTeacher.id,
        ownerCode: commTeacher.teacherId,
        ownerName: 'Nguyễn Bình',
        ownerMobile: commTeacher.mobile,
        ownerStatus: 'Active',
        classId: 'cls-math',
        className: 'Lớp Toán 9A',
        courseName: 'Toán',
        levelName: 'Level 1',
        courseLevelId: levelId,
        date: `2026-10-${String(i + 1).padStart(2, '0')}`,
        roleInSession: 'teacher',
      }));
      mockContext.findSalarySources.mockResolvedValue(sources);

      const useCase = new CreatePaymentPeriodUseCase(mockPersistence);
      await useCase.execute({
        name: 'Kỳ lương T10/2026',
        type: 'salary',
        month: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });

      expect(mockContext.saveOrders).toHaveBeenCalledWith(
        'salary',
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({
            ownerId: commTeacher.id,
            totalSessions: 12,
            totalAmount: 22_500_000, // Gross 25M (5M + 20M hoa hồng 100M) -> Net 22.5M
            lines: expect.arrayContaining([
              expect.objectContaining({ className: 'Lương cơ bản', rate: 4_500_000 }),
              expect.objectContaining({ rate: 18_000_000 }), // Net hoa hồng (20M * 0.9)
              expect.objectContaining({ className: 'Lớp Toán 9A', rate: 0, totalAmount: 0 }),
            ]),
          }),
        ]),
      );
    });

    it('Case T07: Giáo viên hoa hồng không dạy ca nào trong tháng -> Vẫn bảo toàn Lương cơ bản & Hoa hồng doanh thu', async () => {
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(120_000_000);
      mockPersistence.findSalarySources.mockResolvedValue([]); // 0 ca dạy

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-10-31', undefined, '2026-10');
      expect(preview.teachers[0].totalSessions).toBe(0);
      // Hoa hồng: 20M + 20M*0.25 = 25M Gross -> Gross tổng = 30M -> Net = 27M
      expect(preview.teachers[0].totalAmount).toBe(27_000_000);
    });

    it('Case T08: Ca dạy của giáo viên hoa hồng diễn ra ở Level chưa cấu hình bảng giá -> Không báo lỗi', async () => {
      mockContext.getPreviousMonthTuitionRevenue.mockResolvedValue(100_000_000);
      const sourceNoPricing: BillingSource = {
        id: 'sess-no-price',
        ownerId: commTeacher.id,
        ownerCode: commTeacher.teacherId,
        ownerName: 'Nguyễn Bình',
        ownerMobile: commTeacher.mobile,
        ownerStatus: 'Active',
        classId: 'cls-special',
        className: 'Lớp Ngoại Khóa',
        courseName: 'Kỹ Năng',
        levelName: 'Level Chưa Định Giá',
        courseLevelId: 'lvl-unpriced-999',
        date: '2026-10-15',
        roleInSession: 'teacher',
      };
      mockContext.findSalarySources.mockResolvedValue([sourceNoPricing]);

      const useCase = new CreatePaymentPeriodUseCase(mockPersistence);
      const result = await useCase.execute({
        name: 'Kỳ lương T10/2026',
        type: 'salary',
        month: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });
      expect(result.data.id).toBe('period-oct-26');
    });

    it('Case T09: Ca dạy có ngày vượt sau endDate (2026-11-02 > 2026-10-31) -> Được lọc chuẩn xác qua adapter', async () => {
      mockPersistence.findSalarySources.mockImplementation((endDate) => {
        const all = [
          { id: 's1', date: '2026-10-25', ownerId: commTeacher.id, roleInSession: 'teacher' } as any,
          { id: 's2', date: '2026-11-02', ownerId: commTeacher.id, roleInSession: 'teacher' } as any,
        ];
        return Promise.resolve(all.filter((s) => s.date <= endDate));
      });

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-10-31', undefined, '2026-10');
      expect(preview.teachers[0].totalSessions).toBe(1);
    });

    it('Case T10: Tên dòng chi tiết thưởng doanh thu chứa đúng format tiền tệ tiếng Việt (vi-VN)', async () => {
      mockContext.getPreviousMonthTuitionRevenue.mockResolvedValue(150_000_000);
      const useCase = new CreatePaymentPeriodUseCase(mockPersistence);

      await useCase.execute({
        name: 'Kỳ lương T10/2026',
        type: 'salary',
        month: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });

      expect(mockContext.saveOrders).toHaveBeenCalledWith(
        'salary',
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({
            lines: expect.arrayContaining([
              expect.objectContaining({
                className: 'Thưởng doanh thu học viện (Doanh thu tháng trước: 150.000.000 ₫)',
              }),
            ]),
          }),
        ]),
      );
    });
  });

  describe('Nhóm 3: Chuyển Đổi Trạng Thái Hoa Hồng & Phân Định Đa Giáo Viên (Cases T11 - T15)', () => {
    it('Case T11: Tháng 9 giáo viên thường (tính theo ca 300k), Tháng 10 bật hasCommissionSalary (ăn hoa hồng)', async () => {
      const sepSources: BillingSource[] = Array.from({ length: 4 }).map((_, i) => ({
        id: `sess-sep-${i + 1}`,
        ownerId: commTeacher.id,
        ownerCode: commTeacher.teacherId,
        ownerName: 'Nguyễn Bình',
        ownerMobile: commTeacher.mobile,
        ownerStatus: 'Active',
        classId: 'cls-1',
        className: 'Lớp Toán 9A',
        courseName: 'Toán',
        levelName: 'Level 1',
        courseLevelId: levelId,
        date: `2026-09-${String(i + 10).padStart(2, '0')}`,
        roleInSession: 'teacher',
      }));
      mockPersistence.findSalarySources.mockResolvedValue(sepSources);
      mockPersistence.findCommissionTeachers.mockResolvedValue([]);

      const previewSep = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', undefined, '2026-09');
      expect(previewSep.teachers[0].totalAmount).toBe(1_080_000);

      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(100_000_000);

      const previewOct = await new PreviewSalaryUseCase(mockPersistence).execute('2026-10-31', undefined, '2026-10');
      expect(previewOct.teachers[0].totalAmount).toBe(22_500_000);
    });

    it('Case T12: Một đợt lương có cả GV hoa hồng và GV thường -> Tính chính xác 2 cấu trúc order độc lập', async () => {
      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(100_000_000);

      const sources: BillingSource[] = [
        {
          id: 'sess-comm',
          ownerId: commTeacher.id,
          ownerCode: commTeacher.teacherId,
          ownerName: 'Nguyễn Bình',
          ownerMobile: commTeacher.mobile,
          ownerStatus: 'Active',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-10-10',
          roleInSession: 'teacher',
        },
        {
          id: 'sess-norm',
          ownerId: normalTeacher.id,
          ownerCode: normalTeacher.teacherId,
          ownerName: 'Trần An',
          ownerMobile: normalTeacher.mobile,
          ownerStatus: 'Active',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-10-10',
          roleInSession: 'teacher',
        },
      ];
      mockPersistence.findSalarySources.mockResolvedValue(sources);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-10-31', undefined, '2026-10');
      expect(preview.teachers).toHaveLength(2);

      const commOrder = preview.teachers.find((t) => t.teacherId === commTeacher.id);
      const normOrder = preview.teachers.find((t) => t.teacherId === normalTeacher.id);

      expect(commOrder?.totalAmount).toBe(22_500_000);
      expect(normOrder?.totalAmount).toBe(270_000);
      expect(preview.grandTotal).toBe(22_770_000);
    });

    it('Case T13: Hai giáo viên cùng hưởng hoa hồng doanh số học viện (180M) -> Mỗi người nhận đúng 40M hoa hồng', async () => {
      const commTeacher2 = { ...commTeacher, id: 'tch-comm-02', teacherId: 'TC02', firstName: 'Cường' };
      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher, commTeacher2]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(180_000_000);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-10-31', undefined, '2026-10');
      expect(preview.teachers).toHaveLength(2);
      expect(preview.teachers[0].totalAmount).toBe(40_500_000);
      expect(preview.teachers[1].totalAmount).toBe(40_500_000);
      expect(preview.grandTotal).toBe(81_000_000);
    });

    it('Case T14: Lọc theo danh sách teacherIds chỉ định -> Truyền đúng tham số lọc tới adapter', async () => {
      await new PreviewSalaryUseCase(mockPersistence).execute('2026-10-31', [commTeacher.id], '2026-10');
      expect(mockPersistence.findCommissionTeachers).toHaveBeenCalledWith([commTeacher.id]);
    });

    it('Case T15: Giáo viên có hasCommissionSalary=true nhưng status Inactive -> Bị loại khỏi đợt tính lương', async () => {
      mockPersistence.findCommissionTeachers.mockResolvedValue([]);
      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-10-31', undefined, '2026-10');
      expect(preview.teachers).toHaveLength(0);
    });
  });

  describe('Nhóm 4: Điều Chỉnh Tài Chính, Khấu Trừ Thuế & Tính Toàn Vẹn Giao Dịch (Cases T16 - T20)', () => {
    it('Case T16: Thêm điều chỉnh thưởng nóng (chốt mức 24,500,000đ từ gốc 22.5M) -> Sinh dòng chênh lệch +2M', async () => {
      mockContext.getPreviousMonthTuitionRevenue.mockResolvedValue(100_000_000);
      const useCase = new CreatePaymentPeriodUseCase(mockPersistence);

      await useCase.execute({
        name: 'Kỳ lương T10/2026',
        type: 'salary',
        month: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        adjustments: [
          { ownerId: commTeacher.id, adjustedAmount: 24_500_000, reason: 'Thưởng vượt KPI' },
        ],
      });

      // Lương net gốc 22.5M được điều chỉnh thành 24.5M, phát sinh dòng chênh lệch +2M
      expect(mockContext.saveOrders).toHaveBeenCalledWith(
        'salary',
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({
            ownerId: commTeacher.id,
            totalAmount: 24_500_000,
            lines: expect.arrayContaining([
              expect.objectContaining({
                className: 'Điều chỉnh: Thưởng vượt KPI',
                rate: 2_000_000,
                totalAmount: 2_000_000,
              }),
            ]),
          }),
        ]),
      );
    });

    it('Case T17: Thêm điều chỉnh phạt (chốt mức 21,500,000đ từ gốc 22.5M) -> Sinh dòng chênh lệch -1M', async () => {
      mockContext.getPreviousMonthTuitionRevenue.mockResolvedValue(100_000_000);
      const useCase = new CreatePaymentPeriodUseCase(mockPersistence);

      await useCase.execute({
        name: 'Kỳ lương T10/2026',
        type: 'salary',
        month: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        adjustments: [
          { ownerId: commTeacher.id, adjustedAmount: 21_500_000, reason: 'Phạt đi trễ' },
        ],
      });

      // Lương net gốc 22.5M điều chỉnh thành 21.5M, dòng chênh lệch -1M
      expect(mockContext.saveOrders).toHaveBeenCalledWith(
        'salary',
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({
            ownerId: commTeacher.id,
            totalAmount: 21_500_000,
            lines: expect.arrayContaining([
              expect.objectContaining({
                className: 'Điều chỉnh: Phạt đi trễ',
                rate: -1_000_000,
                totalAmount: -1_000_000,
              }),
            ]),
          }),
        ]),
      );
    });

    it('Case T18: Tính toàn vẹn giao dịch: Lưu Period, Orders và Audit Log đầy đủ metadata', async () => {
      mockContext.getPreviousMonthTuitionRevenue.mockResolvedValue(100_000_000);
      const useCase = new CreatePaymentPeriodUseCase(mockPersistence);

      await useCase.execute({
        name: 'Kỳ lương T10/2026',
        type: 'salary',
        month: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        actorId: 'admin-usr-1',
      });

      expect(mockContext.savePeriod).toHaveBeenCalled();
      expect(mockContext.saveOrders).toHaveBeenCalled();
      expect(mockContext.saveAudit).toHaveBeenCalledWith(expect.objectContaining({
        event: 'PERIOD_CREATED',
        actorId: 'admin-usr-1',
        metadata: expect.objectContaining({
          type: 'salary',
          totalAmount: 22_500_000,
        }),
      }));
    });

    it('Case T19: Doanh số tháng trước âm (-30M) do học viên rút phí -> Hoa hồng = 0đ, tổng Net vẫn giữ đủ 4.5M', async () => {
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(-30_000_000);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-10-31', undefined, '2026-10');
      expect(preview.teachers[0].totalAmount).toBe(4_500_000);
    });

    it('Case T20: Khấu trừ 10% thuế TNCN chuẩn xác trên từng dòng: Lương cứng Net 4.5M + Hoa hồng Net = Tổng Net', async () => {
      mockContext.getPreviousMonthTuitionRevenue.mockResolvedValue(220_000_000);
      // Hoa hồng 220M: 45M + 20M*0.3 = 51M Gross
      // Gross tổng: 5M + 51M = 56M
      // Net tổng: 56M * 0.9 = 50.4M
      // Net cứng: 5M * 0.9 = 4.5M
      // Net hoa hồng: 51M * 0.9 = 45.9M
      // 4.5M + 45.9M = 50.4M (khớp tuyệt đối)
      const useCase = new CreatePaymentPeriodUseCase(mockPersistence);

      await useCase.execute({
        name: 'Kỳ lương T10/2026',
        type: 'salary',
        month: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });

      expect(mockContext.saveOrders).toHaveBeenCalledWith(
        'salary',
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({
            ownerId: commTeacher.id,
            totalAmount: 50_400_000,
            lines: expect.arrayContaining([
              expect.objectContaining({ className: 'Lương cơ bản', totalAmount: 4_500_000 }),
              expect.objectContaining({ totalAmount: 45_900_000 }),
            ]),
          }),
        ]),
      );
    });
  });
});
