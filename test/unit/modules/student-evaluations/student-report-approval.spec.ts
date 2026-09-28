import { performance } from 'perf_hooks';

// --- DOMAIN ENUMS & INTERFACES ---
export enum ReportPeriodType {
  WEEK = 'week',
  MONTH = 'month',
}

export interface StudentReportApprovalProps {
  id?: string;
  studentId: string;
  reportType: ReportPeriodType;
  periodNumber: number;
  year: number;
  isApproved: boolean;
  approvedByUserId?: string | null;
  approvedAt?: Date | null;
  sentToZaloAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class StudentReportApprovalEntity {
  private _id: string;
  private _studentId: string;
  private _reportType: ReportPeriodType;
  private _periodNumber: number;
  private _year: number;
  private _isApproved: boolean;
  private _approvedByUserId: string | null;
  private _approvedAt: Date | null;
  private _sentToZaloAt: Date | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: StudentReportApprovalProps) {
    if (!props.studentId || !props.studentId.trim()) {
      throw new Error('studentId không được để trống');
    }
    if (props.reportType === ReportPeriodType.WEEK && (props.periodNumber < 1 || props.periodNumber > 53)) {
      throw new Error('Số tuần không hợp lệ (1 - 53)');
    }
    if (props.reportType === ReportPeriodType.MONTH && (props.periodNumber < 1 || props.periodNumber > 12)) {
      throw new Error('Số tháng không hợp lệ (1 - 12)');
    }
    if (props.year < 2020 || props.year > 2100) {
      throw new Error('Năm không hợp lệ');
    }

    this._id = props.id || 'mock-uuid-' + Math.random().toString(36).substring(2, 9);
    this._studentId = props.studentId;
    this._reportType = props.reportType;
    this._periodNumber = props.periodNumber;
    this._year = props.year;
    this._isApproved = props.isApproved ?? false;
    this._approvedByUserId = props.approvedByUserId || null;
    this._approvedAt = props.approvedAt || null;
    this._sentToZaloAt = props.sentToZaloAt || null;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  public static create(props: StudentReportApprovalProps): StudentReportApprovalEntity {
    return new StudentReportApprovalEntity(props);
  }

  public get id(): string { return this._id; }
  public get studentId(): string { return this._studentId; }
  public get reportType(): ReportPeriodType { return this._reportType; }
  public get periodNumber(): number { return this._periodNumber; }
  public get year(): number { return this._year; }
  public get isApproved(): boolean { return this._isApproved; }
  public get approvedByUserId(): string | null { return this._approvedByUserId; }
  public get approvedAt(): Date | null { return this._approvedAt; }
  public get sentToZaloAt(): Date | null { return this._sentToZaloAt; }

  public approve(approvedByUserId: string): void {
    if (!approvedByUserId || !approvedByUserId.trim()) {
      throw new Error('approvedByUserId không được để trống');
    }
    this._isApproved = true;
    this._approvedByUserId = approvedByUserId.trim();
    this._approvedAt = new Date();
    this._updatedAt = new Date();
  }

  public unapprove(): void {
    this._isApproved = false;
    this._approvedByUserId = null;
    this._approvedAt = null;
    this._updatedAt = new Date();
  }

  public markZaloSent(): void {
    this._sentToZaloAt = new Date();
    this._updatedAt = new Date();
  }
}

// --- PORT INTERFACE ---
export interface IStudentReportApprovalRepositoryPort {
  findApproval(
    studentId: string,
    reportType: ReportPeriodType,
    periodNumber: number,
    year: number,
  ): Promise<StudentReportApprovalEntity | null>;

  saveApproval(approval: StudentReportApprovalEntity): Promise<StudentReportApprovalEntity>;

  findApprovalsByStudents(
    studentIds: string[],
    reportType: ReportPeriodType,
    periodNumber: number,
    year: number,
  ): Promise<Map<string, StudentReportApprovalEntity>>;
}

// --- USE CASE: APPROVE / UNAPPROVE REPORT ---
export interface ToggleReportApprovalInput {
  studentId: string;
  reportType: ReportPeriodType;
  periodNumber: number;
  year: number;
  isApproved: boolean;
  userId: string;
}

export class ToggleReportApprovalUseCase {
  constructor(private readonly repository: IStudentReportApprovalRepositoryPort) {}

  async execute(input: ToggleReportApprovalInput): Promise<StudentReportApprovalEntity> {
    let approval = await this.repository.findApproval(
      input.studentId,
      input.reportType,
      input.periodNumber,
      input.year,
    );

    if (!approval) {
      approval = StudentReportApprovalEntity.create({
        studentId: input.studentId,
        reportType: input.reportType,
        periodNumber: input.periodNumber,
        year: input.year,
        isApproved: false,
      });
    }

    if (input.isApproved) {
      approval.approve(input.userId);
    } else {
      approval.unapprove();
    }

    return await this.repository.saveApproval(approval);
  }
}

// --- USE CASE: MARK ZALO SENT ---
export class MarkReportZaloSentUseCase {
  constructor(private readonly repository: IStudentReportApprovalRepositoryPort) {}

  async execute(
    studentId: string,
    reportType: ReportPeriodType,
    periodNumber: number,
    year: number,
  ): Promise<StudentReportApprovalEntity> {
    let approval = await this.repository.findApproval(studentId, reportType, periodNumber, year);
    if (!approval) {
      approval = StudentReportApprovalEntity.create({
        studentId,
        reportType,
        periodNumber,
        year,
        isApproved: true,
      });
    }
    approval.markZaloSent();
    return await this.repository.saveApproval(approval);
  }
}

// ==========================================
// TDD UNIT TESTS & PERFORMANCE BENCHMARKS
// ==========================================
describe('StudentReportApproval (TDD & Performance Benchmark Spec)', () => {
  let mockRepo: IStudentReportApprovalRepositoryPort;
  let inMemoryDb: Map<string, StudentReportApprovalEntity>;

  beforeEach(() => {
    inMemoryDb = new Map();
    mockRepo = {
      findApproval: jest.fn(async (sId, rType, pNum, year) => {
        const key = `${sId}_${rType}_${pNum}_${year}`;
        return inMemoryDb.get(key) || null;
      }),
      saveApproval: jest.fn(async (entity) => {
        const key = `${entity.studentId}_${entity.reportType}_${entity.periodNumber}_${entity.year}`;
        inMemoryDb.set(key, entity);
        return entity;
      }),
      findApprovalsByStudents: jest.fn(async (sIds, rType, pNum, year) => {
        const map = new Map<string, StudentReportApprovalEntity>();
        for (const id of sIds) {
          const key = `${id}_${rType}_${pNum}_${year}`;
          const found = inMemoryDb.get(key);
          if (found) map.set(id, found);
        }
        return map;
      }),
    };
  });

  describe('1. Entity Validation & Logic', () => {
    it('nên tạo entity phê duyệt báo cáo tuần hợp lệ', () => {
      const entity = StudentReportApprovalEntity.create({
        studentId: 'std-1',
        reportType: ReportPeriodType.WEEK,
        periodNumber: 39,
        year: 2026,
        isApproved: false,
      });

      expect(entity.studentId).toBe('std-1');
      expect(entity.reportType).toBe(ReportPeriodType.WEEK);
      expect(entity.periodNumber).toBe(39);
      expect(entity.isApproved).toBe(false);
    });

    it('nên ném lỗi nếu studentId để trống', () => {
      expect(() => {
        StudentReportApprovalEntity.create({
          studentId: '',
          reportType: ReportPeriodType.WEEK,
          periodNumber: 1,
          year: 2026,
          isApproved: false,
        });
      }).toThrow('studentId không được để trống');
    });

    it('nên ném lỗi nếu số tuần hoặc số tháng vượt quá giới hạn', () => {
      expect(() => {
        StudentReportApprovalEntity.create({
          studentId: 'std-1',
          reportType: ReportPeriodType.WEEK,
          periodNumber: 54,
          year: 2026,
          isApproved: false,
        });
      }).toThrow('Số tuần không hợp lệ');

      expect(() => {
        StudentReportApprovalEntity.create({
          studentId: 'std-1',
          reportType: ReportPeriodType.MONTH,
          periodNumber: 13,
          year: 2026,
          isApproved: false,
        });
      }).toThrow('Số tháng không hợp lệ');
    });

    it('nên cập nhật trạng thái phê duyệt và hủy phê duyệt chính xác', () => {
      const entity = StudentReportApprovalEntity.create({
        studentId: 'std-1',
        reportType: ReportPeriodType.MONTH,
        periodNumber: 9,
        year: 2026,
        isApproved: false,
      });

      entity.approve('teacher-user-123');
      expect(entity.isApproved).toBe(true);
      expect(entity.approvedByUserId).toBe('teacher-user-123');
      expect(entity.approvedAt).toBeInstanceOf(Date);

      entity.unapprove();
      expect(entity.isApproved).toBe(false);
      expect(entity.approvedByUserId).toBeNull();
      expect(entity.approvedAt).toBeNull();
    });

    it('nên cập nhật thời điểm gửi Zalo chính xác', () => {
      const entity = StudentReportApprovalEntity.create({
        studentId: 'std-1',
        reportType: ReportPeriodType.WEEK,
        periodNumber: 39,
        year: 2026,
        isApproved: true,
      });

      entity.markZaloSent();
      expect(entity.sentToZaloAt).toBeInstanceOf(Date);
    });
  });

  describe('2. Use Cases Execution', () => {
    it('ToggleReportApprovalUseCase nên lưu duyệt báo cáo tuần khi Admin/Giáo viên phê duyệt', async () => {
      const useCase = new ToggleReportApprovalUseCase(mockRepo);
      const result = await useCase.execute({
        studentId: 'std-999',
        reportType: ReportPeriodType.WEEK,
        periodNumber: 40,
        year: 2026,
        isApproved: true,
        userId: 'admin-01',
      });

      expect(result.isApproved).toBe(true);
      expect(result.approvedByUserId).toBe('admin-01');
      expect(mockRepo.saveApproval).toHaveBeenCalled();
    });

    it('MarkReportZaloSentUseCase nên ghi nhận thời điểm gửi Zalo thành công', async () => {
      const useCase = new MarkReportZaloSentUseCase(mockRepo);
      const result = await useCase.execute('std-999', ReportPeriodType.MONTH, 9, 2026);

      expect(result.sentToZaloAt).toBeInstanceOf(Date);
    });
  });

  describe('3. Performance Benchmark (SLA Limit < 50ms for Bulk Query/Approve)', () => {
    it('nên xử lý truy vấn và duyệt hàng loạt 100 học sinh dưới 50ms', async () => {
      const studentIds = Array.from({ length: 100 }, (_, i) => `std-bulk-${i}`);
      const useCase = new ToggleReportApprovalUseCase(mockRepo);

      const start = performance.now();

      // Duyệt hàng loạt 100 học sinh
      await Promise.all(
        studentIds.map((id) =>
          useCase.execute({
            studentId: id,
            reportType: ReportPeriodType.WEEK,
            periodNumber: 39,
            year: 2026,
            isApproved: true,
            userId: 'teacher-bulk-01',
          }),
        ),
      );

      // Truy vấn hàng loạt 100 học sinh
      const resultMap = await mockRepo.findApprovalsByStudents(
        studentIds,
        ReportPeriodType.WEEK,
        39,
        2026,
      );

      const elapsed = performance.now() - start;

      expect(resultMap.size).toBe(100);
      expect(elapsed).toBeLessThan(50); // SLA Limit < 50ms
    });
  });
});
