export enum SqiLevel {
  LEVEL_5_EXCELLENT = 'Level 5 - Xuất sắc',
  LEVEL_4_GOOD = 'Level 4 - Giỏi',
  LEVEL_3_FAIR = 'Level 3 - Khá',
  LEVEL_2_AVERAGE = 'Level 2 - Trung bình',
  LEVEL_1_WEAK = 'Level 1 - Yếu',
}

export enum TrendDirection {
  UP = 'up',
  DOWN = 'down',
  STABLE = 'stable',
  NEW = 'new',
}

export interface SqiBreakdown {
  academic: number;
  progress: number;
  competency: number;
  attendance: number;
  homework: number;
  attitude: number;
  behavior: number;
}

export interface SubjectPerformance {
  subjectName: string;
  score: number;
  trend: TrendDirection;
  isEstimated?: boolean;
}

export interface CreateWeeklyStudentReportProps {
  id?: string;
  studentId: string;
  studentName?: string;
  studentCode?: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  sqiScore: number;
  sqiDelta: number;
  sqiBreakdown: SqiBreakdown;
  subjectPerformances: SubjectPerformance[];
  overview: string;
  strengths: string;
  improvements: string;
  recommendations: string[];
  sessions?: any[];
  isApproved?: boolean;
  approvedAt?: Date | null;
  approvedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class WeeklyStudentReportEntity {
  private _id: string;
  private _studentId: string;
  private _studentName?: string;
  private _studentCode?: string;
  private _weekNumber: number;
  private _year: number;
  private _startDate: string;
  private _endDate: string;
  private _sqiScore: number;
  private _sqiDelta: number;
  private _sqiBreakdown: SqiBreakdown;
  private _subjectPerformances: SubjectPerformance[];
  private _overview: string;
  private _strengths: string;
  private _improvements: string;
  private _recommendations: string[];
  private _sessions: any[];
  private _isApproved: boolean;
  private _approvedAt: Date | null;
  private _approvedBy: string | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CreateWeeklyStudentReportProps) {
    if (!props.studentId || !props.studentId.trim()) {
      throw new Error('studentId không được để trống');
    }
    if (props.sqiScore < 0 || props.sqiScore > 100) {
      throw new Error('Điểm SQI phải nằm trong khoảng từ 0 đến 100');
    }

    this._id = props.id || this.generateUuid();
    this._studentId = props.studentId;
    this._studentName = props.studentName;
    this._studentCode = props.studentCode;
    this._weekNumber = props.weekNumber;
    this._year = props.year;
    this._startDate = props.startDate;
    this._endDate = props.endDate;
    this._sqiScore = Math.round(props.sqiScore * 10) / 10;
    this._sqiDelta = Math.round(props.sqiDelta * 10) / 10;
    this._sqiBreakdown = { ...props.sqiBreakdown };
    this._subjectPerformances = props.subjectPerformances ? [...props.subjectPerformances] : [];
    this._overview = props.overview || '';
    this._strengths = props.strengths || '';
    this._improvements = props.improvements || '';
    this._recommendations = props.recommendations ? [...props.recommendations] : [];
    this._sessions = props.sessions ? [...props.sessions] : [];
    this._isApproved = props.isApproved ?? false;
    this._approvedAt = props.approvedAt || null;
    this._approvedBy = props.approvedBy || null;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  public static create(props: CreateWeeklyStudentReportProps): WeeklyStudentReportEntity {
    return new WeeklyStudentReportEntity(props);
  }

  public get id(): string { return this._id; }
  public get studentId(): string { return this._studentId; }
  public get studentName(): string | undefined { return this._studentName; }
  public get studentCode(): string | undefined { return this._studentCode; }
  public get weekNumber(): number { return this._weekNumber; }
  public get year(): number { return this._year; }
  public get startDate(): string { return this._startDate; }
  public get endDate(): string { return this._endDate; }
  public get sqiScore(): number { return this._sqiScore; }
  public get sqiDelta(): number { return this._sqiDelta; }
  public get sqiBreakdown(): SqiBreakdown { return { ...this._sqiBreakdown }; }
  public get subjectPerformances(): SubjectPerformance[] { return [...this._subjectPerformances]; }
  public get overview(): string { return this._overview; }
  public get strengths(): string { return this._strengths; }
  public get improvements(): string { return this._improvements; }
  public get recommendations(): string[] { return [...this._recommendations]; }
  public get isApproved(): boolean { return this._isApproved; }
  public get approvedAt(): Date | null { return this._approvedAt; }
  public get approvedBy(): string | null { return this._approvedBy; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }

  public getLevel(): SqiLevel {
    if (this._sqiScore >= 90) return SqiLevel.LEVEL_5_EXCELLENT;
    if (this._sqiScore >= 75) return SqiLevel.LEVEL_4_GOOD;
    if (this._sqiScore >= 60) return SqiLevel.LEVEL_3_FAIR;
    if (this._sqiScore >= 45) return SqiLevel.LEVEL_2_AVERAGE;
    return SqiLevel.LEVEL_1_WEAK;
  }

  public approve(approvedBy: string): void {
    if (!approvedBy || !approvedBy.trim()) {
      throw new Error('approvedBy không được để trống khi duyệt báo cáo');
    }
    if (!this._overview.trim() && !this._strengths.trim()) {
      throw new Error('Không thể duyệt báo cáo khi chưa có nội dung nhận xét');
    }
    this._isApproved = true;
    this._approvedBy = approvedBy.trim();
    this._approvedAt = new Date();
    this._updatedAt = new Date();
  }

  public unapprove(): void {
    this._isApproved = false;
    this._approvedBy = null;
    this._approvedAt = null;
    this._updatedAt = new Date();
  }

  public toJSON() {
    return {
      id: this._id,
      studentId: this._studentId,
      studentName: this._studentName,
      studentCode: this._studentCode,
      weekNumber: this._weekNumber,
      year: this._year,
      startDate: this._startDate,
      endDate: this._endDate,
      sqiScore: this._sqiScore,
      sqiDelta: this._sqiDelta,
      sqiBreakdown: this._sqiBreakdown,
      subjectPerformances: this._subjectPerformances,
      overview: this._overview,
      strengths: this._strengths,
      improvements: this._improvements,
      recommendations: this._recommendations,
      sessions: this._sessions,
      level: this.getLevel(),
      isApproved: this._isApproved,
      approvedAt: this._approvedAt,
      approvedBy: this._approvedBy,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
