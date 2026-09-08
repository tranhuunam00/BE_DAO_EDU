import { PreviewSalaryUseCase } from '../../../../../../src/modules/billing/application/use-cases/preview-billing.use-case';
import { CreatePaymentPeriodUseCase } from '../../../../../../src/modules/billing/application/use-cases/create-payment-period.use-case';
import { BillingPersistencePort, BillingTransactionContext } from '../../../../../../src/modules/billing/application/ports/billing-persistence.port';
import { BillingSource, PricingRule } from '../../../../../../src/modules/billing/domain/services/billing-calculator';
import { CommissionSalaryCalculator } from '../../../../../../src/modules/billing/domain/services/commission-salary-calculator';

describe('Session Wage Query & Commission Salary Suite (25 Cases)', () => {
  let mockPersistence: jest.Mocked<BillingPersistencePort>;
  let mockContext: jest.Mocked<BillingTransactionContext>;

  const levelId = 'lvl-comm-101';
  const samplePricing: PricingRule[] = [
    {
      id: 'rule-tch',
      courseLevelId: levelId,
      pricePerSession: 0,
      teacherWagePerSession: 300000,
      taWagePerSession: 100000,
      effectiveFrom: '2026-09-01',
      effectiveTo: '2026-12-31',
    },
  ];

  beforeEach(() => {
    mockContext = {
      loadPricings: jest.fn().mockResolvedValue(samplePricing),
      findTuitionSources: jest.fn().mockResolvedValue([]),
      findSalarySources: jest.fn().mockResolvedValue([]),
      findCommissionTeachers: jest.fn().mockResolvedValue([]),
      getPreviousMonthTuitionRevenue: jest.fn().mockResolvedValue(0),
      savePeriod: jest.fn().mockResolvedValue({ id: 'period-new-1', type: 'salary', month: '2026-09' }),
      saveOrders: jest.fn().mockResolvedValue(['wage-id-1']),
      saveAudit: jest.fn().mockResolvedValue(undefined),
    };

    mockPersistence = {
      transaction: jest.fn().mockImplementation((work) => work(mockContext)),
      loadPricings: jest.fn().mockResolvedValue(samplePricing),
      findTuitionSources: jest.fn().mockResolvedValue([]),
      findSalarySources: jest.fn().mockResolvedValue([]),
      findCommissionTeachers: jest.fn().mockResolvedValue([]),
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

  describe('Nhóm 1: Kiểm tra an toàn thù lao ca dạy & Khấu trừ thuế TNCN (Cases W01 - W10)', () => {
    it('Case W01: Quét ca dạy của giáo viên thường và khấu trừ 10% thuế TNCN', async () => {
      const sources: BillingSource[] = [
        {
          id: 'sess-1',
          ownerId: 'tch-01',
          ownerCode: 'T01',
          ownerName: 'Nguyễn Văn A',
          ownerMobile: '0901234567',
          ownerStatus: 'Active',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-10',
          roleInSession: 'teacher',
        },
      ];
      mockPersistence.findSalarySources.mockResolvedValue(sources);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', undefined, '2026-09');
      expect(preview.teachers).toHaveLength(1);
      // Gross = 300,000 -> Net = 270,000
      expect(preview.teachers[0].totalAmount).toBe(270000);
      expect(preview.teachers[0].totalSessions).toBe(1);
    });

    it('Case W02: Quét ca dạy của trợ giảng và khấu trừ 10% thuế TNCN', async () => {
      const sources: BillingSource[] = [
        {
          id: 'sess-ta',
          ownerId: 'ta-01',
          ownerCode: 'TA01',
          ownerName: 'Trần Thị B',
          ownerMobile: '0907654321',
          ownerStatus: 'Active',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-10',
          roleInSession: 'assistant',
        },
      ];
      mockPersistence.findSalarySources.mockResolvedValue(sources);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', undefined, '2026-09');
      // Gross = 100,000 -> Net = 90,000
      expect(preview.teachers[0].totalAmount).toBe(90000);
      expect(preview.teachers[0].totalSessions).toBe(1);
    });

    it('Case W03: Tính tổng tiền kỳ lương cho 10 ca dạy GV chính (Gross 3,000,000 -> Net 2,700,000)', async () => {
      const sources: BillingSource[] = Array.from({ length: 10 }).map((_, i) => ({
        id: `sess-${i + 1}`,
        ownerId: 'tch-01',
        ownerCode: 'T01',
        ownerName: 'Nguyễn Văn A',
        ownerMobile: '0901234567',
        ownerStatus: 'Active',
        classId: 'cls-1',
        className: 'Lớp Toán 9A',
        courseName: 'Toán',
        levelName: 'Level 1',
        courseLevelId: levelId,
        date: `2026-09-${String(i + 1).padStart(2, '0')}`,
        roleInSession: 'teacher',
      }));
      mockPersistence.findSalarySources.mockResolvedValue(sources);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', undefined, '2026-09');
      expect(preview.teachers[0].totalSessions).toBe(10);
      expect(preview.teachers[0].totalAmount).toBe(2700000);
      expect(preview.grandTotal).toBe(2700000);
    });

    it('Case W04: Lọc theo danh sách teacherIds được chọn', async () => {
      mockPersistence.findSalarySources.mockResolvedValue([]);
      await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', ['tch-01', 'tch-02'], '2026-09');
      expect(mockPersistence.findSalarySources).toHaveBeenCalledWith('2026-09-30', ['tch-01', 'tch-02']);
    });

    it('Case W05: Báo lỗi khi không cung cấp endDate trong PreviewSalaryUseCase', async () => {
      await expect(new PreviewSalaryUseCase(mockPersistence).execute('', undefined)).rejects.toThrow('Vui lòng cung cấp endDate');
    });

    it('Case W06: Tự động trích xuất month từ endDate nếu không truyền tham số month', async () => {
      mockPersistence.findSalarySources.mockResolvedValue([]);
      await new PreviewSalaryUseCase(mockPersistence).execute('2026-11-20');
      expect(mockPersistence.getPreviousMonthTuitionRevenue).toHaveBeenCalledWith('2026-11');
    });

    it('Case W07: Không có ca dạy nào phát sinh -> trả về danh sách rỗng và grandTotal = 0', async () => {
      mockPersistence.findSalarySources.mockResolvedValue([]);
      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30');
      expect(preview.teachers).toHaveLength(0);
      expect(preview.grandTotal).toBe(0);
    });

    it('Case W08: Tạo đợt thanh toán lương gọi transaction và lưu orders thành công', async () => {
      const sources: BillingSource[] = [
        {
          id: 'sess-1',
          ownerId: 'tch-01',
          ownerCode: 'T01',
          ownerName: 'Nguyễn Văn A',
          ownerMobile: '0901234567',
          ownerStatus: 'Active',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-10',
          roleInSession: 'teacher',
        },
      ];
      mockContext.findSalarySources.mockResolvedValue(sources);

      const result = await new CreatePaymentPeriodUseCase(mockPersistence).execute({
        name: 'Lương Tháng 9/2026',
        type: 'salary',
        month: '2026-09',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        teacherIds: ['tch-01'],
      });

      expect(mockContext.saveOrders).toHaveBeenCalledWith('salary', expect.anything(), [
        expect.objectContaining({
          ownerId: 'tch-01',
          totalAmount: 270000,
        }),
      ]);
      expect(result.data.id).toBe('period-new-1');
    });

    it('Case W09: Tạo audit log khi đợt lương được tạo thành công', async () => {
      mockContext.findSalarySources.mockResolvedValue([]);
      await new CreatePaymentPeriodUseCase(mockPersistence).execute({
        name: 'Lương Tháng 9/2026',
        type: 'salary',
        month: '2026-09',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      });
      expect(mockContext.saveAudit).toHaveBeenCalledWith(expect.objectContaining({
        event: 'PERIOD_CREATED',
        periodId: 'period-new-1',
      }));
    });

    it('Case W10: Báo lỗi khi tên đợt thanh toán rỗng', async () => {
      await expect(new CreatePaymentPeriodUseCase(mockPersistence).execute({
        name: '',
        type: 'salary',
        month: '2026-09',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      })).rejects.toThrow();
    });
  });

  describe('Nhóm 2: Tính lương Lũy Tiến theo Doanh Thu Học Viện (Cases W11 - W20)', () => {
    const commTeacher = {
      id: 'tch-comm-01',
      teacherId: 'TCOMM01',
      firstName: 'Dung',
      lastName: 'Vu',
      mobile: '0987654321',
      status: 'Active',
    };

    it('Case W11: Doanh thu = 0đ -> Lương cứng 5M, Net = 4,500,000đ', async () => {
      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(0);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', undefined, '2026-09');
      expect(preview.teachers[0].totalAmount).toBe(4500000);
    });

    it('Case W12: Doanh thu 80M (Bậc 1: 20%) -> Hoa hồng 16M, Gross 21M, Net 18,900,000đ', async () => {
      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(80000000);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', undefined, '2026-09');
      // Gross = 5M + 16M = 21M -> Net = 21M * 0.9 = 18.9M
      expect(preview.teachers[0].totalAmount).toBe(18900000);
    });

    it('Case W13: Doanh thu 100M (Chuyển tiếp Bậc 1-2) -> Hoa hồng 20M, Gross 25M, Net 22,500,000đ', async () => {
      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(100000000);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', undefined, '2026-09');
      // Gross = 5M + 20M = 25M -> Net = 22,500,000
      expect(preview.teachers[0].totalAmount).toBe(22500000);
    });

    it('Case W14: Doanh thu 153M (Bậc 2) -> Hoa hồng 33.25M, Gross 38.25M, Net 34,425,000đ', async () => {
      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(153000000);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', undefined, '2026-09');
      // Gross = 38.25M -> Net = 34,425,000
      expect(preview.teachers[0].totalAmount).toBe(34425000);
    });

    it('Case W15: Doanh thu 200M (Chuyển tiếp Bậc 2-3) -> Hoa hồng 45M, Gross 50M, Net 45,000,000đ', async () => {
      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(200000000);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', undefined, '2026-09');
      // Gross = 5M + 45M = 50M -> Net = 45,000,000
      expect(preview.teachers[0].totalAmount).toBe(45000000);
    });

    it('Case W16: Doanh thu 250M (Bậc 3) -> Hoa hồng 60M, Gross 65M, Net 58,500,000đ', async () => {
      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(250000000);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', undefined, '2026-09');
      // Gross = 5M + 60M = 65M -> Net = 58,500,000
      expect(preview.teachers[0].totalAmount).toBe(58500000);
    });

    it('Case W17: Doanh thu 300M (Chạm mốc trần) -> Hoa hồng 75M, Gross 80M, Net 72,000,000đ', async () => {
      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(300000000);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', undefined, '2026-09');
      // Gross = 80M -> Net = 72,000,000
      expect(preview.teachers[0].totalAmount).toBe(72000000);
    });

    it('Case W18: Doanh thu 500M (Vượt mốc trần) -> Vẫn capped hoa hồng 75M, Net 72,000,000đ', async () => {
      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(500000000);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', undefined, '2026-09');
      expect(preview.teachers[0].totalAmount).toBe(72000000);
    });

    it('Case W19: Doanh thu âm (do hoàn phí) -> Bảo vệ hoa hồng không âm, Net 4,500,000đ', async () => {
      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(-20000000);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', undefined, '2026-09');
      expect(preview.teachers[0].totalAmount).toBe(4500000);
    });

    it('Case W20: Nhiều giáo viên lũy tiến cùng nhận hoa hồng theo cùng doanh thu học viện', async () => {
      const commTeacher2 = {
        id: 'tch-comm-02',
        teacherId: 'TCOMM02',
        firstName: 'Thanh',
        lastName: 'Le',
        mobile: '0981112223',
        status: 'Active',
      };
      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher, commTeacher2]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(100000000);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', undefined, '2026-09');
      expect(preview.teachers).toHaveLength(2);
      expect(preview.teachers[0].totalAmount).toBe(22500000);
      expect(preview.teachers[1].totalAmount).toBe(22500000);
      expect(preview.grandTotal).toBe(45000000);
    });
  });

  describe('Nhóm 3: Chống tính trùng 2 lần cho ca dạy của Giáo viên Lũy Tiến (Cases W21 - W25)', () => {
    const commTeacher = {
      id: 'tch-comm-01',
      teacherId: 'TCOMM01',
      firstName: 'Dung',
      lastName: 'Vu',
      mobile: '0987654321',
      status: 'Active',
    };

    it('Case W21: Giáo viên lũy tiến có 5 ca dạy -> đếm đúng 5 buổi nhưng rate buổi = 0đ', async () => {
      const sessions: BillingSource[] = Array.from({ length: 5 }).map((_, i) => ({
        id: `sess-comm-${i + 1}`,
        ownerId: 'tch-comm-01',
        ownerCode: 'TCOMM01',
        ownerName: 'Vu Dung',
        ownerMobile: '0987654321',
        ownerStatus: 'Active',
        classId: 'cls-1',
        className: 'Lớp Toán 9A',
        courseName: 'Toán',
        levelName: 'Level 1',
        courseLevelId: levelId,
        date: `2026-09-${String(i + 1).padStart(2, '0')}`,
        roleInSession: 'teacher',
      }));

      mockContext.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockContext.getPreviousMonthTuitionRevenue.mockResolvedValue(100000000);
      mockContext.findSalarySources.mockResolvedValue(sessions);

      await new CreatePaymentPeriodUseCase(mockPersistence).execute({
        name: 'Lương Tháng 9',
        type: 'salary',
        month: '2026-09',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        teacherIds: ['tch-comm-01'],
      });

      expect(mockContext.saveOrders).toHaveBeenCalledWith('salary', expect.anything(), [
        expect.objectContaining({
          ownerId: 'tch-comm-01',
          totalSessions: 5,
          totalAmount: 22500000,
          lines: expect.arrayContaining([
            expect.objectContaining({ className: 'Lương cơ bản', totalAmount: 4500000 }),
            expect.objectContaining({ rate: 0, totalAmount: 0 }), // Ca dạy được set rate = 0
          ]),
        }),
      ]);
    });

    it('Case W22: Không bị cộng trùng tiền: Tổng tiền nhận chỉ từ lương cứng + hoa hồng', async () => {
      const sessions: BillingSource[] = [
        {
          id: 'sess-comm-1',
          ownerId: 'tch-comm-01',
          ownerCode: 'TCOMM01',
          ownerName: 'Vu Dung',
          ownerMobile: '0987654321',
          ownerStatus: 'Active',
          classId: 'cls-1',
          className: 'Lớp Toán 9A',
          courseName: 'Toán',
          levelName: 'Level 1',
          courseLevelId: levelId,
          date: '2026-09-10',
          roleInSession: 'teacher',
        },
      ];

      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(0);
      mockPersistence.findSalarySources.mockResolvedValue(sessions);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', ['tch-comm-01']);
      // Dù có 1 ca dạy (300k), tổng nhận vẫn là 4.5M (lương cứng), không bị cộng 300k
      expect(preview.teachers[0].totalAmount).toBe(4500000);
      expect(preview.teachers[0].totalSessions).toBe(1);
    });

    it('Case W23: Giáo viên lũy tiến không có ca dạy nào (0 ca) -> vẫn nhận đủ lương cứng + hoa hồng', async () => {
      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(100000000);
      mockPersistence.findSalarySources.mockResolvedValue([]);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30', ['tch-comm-01']);
      expect(preview.teachers[0].totalSessions).toBe(0);
      expect(preview.teachers[0].totalAmount).toBe(22500000);
    });

    it('Case W24: Đợt lương hỗn hợp cả Giáo viên thường và Giáo viên lũy tiến', async () => {
      const normalTeacherSource: BillingSource = {
        id: 'sess-norm-1',
        ownerId: 'tch-normal-1',
        ownerCode: 'TNORM',
        ownerName: 'Trần Văn Nam',
        ownerMobile: '0901111111',
        ownerStatus: 'Active',
        classId: 'cls-1',
        className: 'Lớp Toán 9A',
        courseName: 'Toán',
        levelName: 'Level 1',
        courseLevelId: levelId,
        date: '2026-09-10',
        roleInSession: 'teacher',
      };

      mockPersistence.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockPersistence.getPreviousMonthTuitionRevenue.mockResolvedValue(100000000);
      mockPersistence.findSalarySources.mockResolvedValue([normalTeacherSource]);

      const preview = await new PreviewSalaryUseCase(mockPersistence).execute('2026-09-30');
      expect(preview.teachers).toHaveLength(2);
      const norm = preview.teachers.find((t) => t.teacherId === 'tch-normal-1');
      const comm = preview.teachers.find((t) => t.teacherId === 'tch-comm-01');

      expect(norm?.totalAmount).toBe(270000); // 300k * 0.9
      expect(comm?.totalAmount).toBe(22500000); // 25M * 0.9
      expect(preview.grandTotal).toBe(22770000);
    });

    it('Case W25: Điều chỉnh thủ công (adjustment) cho giáo viên lũy tiến hoạt động chuẩn xác', async () => {
      mockContext.findCommissionTeachers.mockResolvedValue([commTeacher]);
      mockContext.getPreviousMonthTuitionRevenue.mockResolvedValue(0); // Net mặc định 4.5M
      mockContext.findSalarySources.mockResolvedValue([]);

      await new CreatePaymentPeriodUseCase(mockPersistence).execute({
        name: 'Lương Tháng 9',
        type: 'salary',
        month: '2026-09',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        adjustments: [
          {
            ownerId: 'tch-comm-01',
            adjustedAmount: 5000000,
            reason: 'Thưởng chuyên cần tháng 9',
          },
        ],
      });

      expect(mockContext.saveOrders).toHaveBeenCalledWith('salary', expect.anything(), [
        expect.objectContaining({
          ownerId: 'tch-comm-01',
          totalAmount: 5000000,
        }),
      ]);
    });
  });
});
