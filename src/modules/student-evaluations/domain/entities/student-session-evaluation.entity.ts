import {
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../value-objects/evaluation-criteria.vo';

export { HomeworkStatus, ParticipationStatus, UnderstandingStatus, BehaviorTag };

export interface CreateStudentSessionEvaluationProps {
  id?: string;
  classSessionId: string;
  studentId: string;
  teacherId?: string | null;
  homeworkStatus?: HomeworkStatus;
  participation?: ParticipationStatus;
  understanding?: UnderstandingStatus;
  behaviorTags?: BehaviorTag[];
  score?: string | null;
  comment?: string | null;
  isAiGenerated?: boolean;
  isApproved?: boolean;
  approvedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class StudentSessionEvaluationEntity {
  private _id: string;
  private _classSessionId: string;
  private _studentId: string;
  private _teacherId: string | null;
  private _homeworkStatus: HomeworkStatus;
  private _participation: ParticipationStatus;
  private _understanding: UnderstandingStatus;
  private _behaviorTags: BehaviorTag[];
  private _score: string | null;
  private _comment: string | null;
  private _isAiGenerated: boolean;
  private _isApproved: boolean;
  private _approvedAt: Date | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CreateStudentSessionEvaluationProps) {
    if (!props.classSessionId || !props.classSessionId.trim()) {
      throw new Error('classSessionId không được để trống');
    }
    if (!props.studentId || !props.studentId.trim()) {
      throw new Error('studentId không được để trống');
    }

    this._id = props.id || this.generateUuid();
    this._classSessionId = props.classSessionId;
    this._studentId = props.studentId;
    this._teacherId = props.teacherId || null;
    this._homeworkStatus = props.homeworkStatus || HomeworkStatus.COMPLETED;
    this._participation = props.participation || ParticipationStatus.ACTIVE;
    this._understanding = props.understanding || UnderstandingStatus.UNDERSTOOD;
    this._behaviorTags = props.behaviorTags ? Array.from(new Set(props.behaviorTags)) : [];
    this._score = this.validateAndNormalizeScore(props.score);
    this._comment = this.validateComment(props.comment);
    this._isAiGenerated = props.isAiGenerated ?? false;
    this._isApproved = props.isApproved ?? false;
    this._approvedAt = props.approvedAt || null;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  public static create(props: CreateStudentSessionEvaluationProps): StudentSessionEvaluationEntity {
    return new StudentSessionEvaluationEntity(props);
  }

  public static reconstruct(props: CreateStudentSessionEvaluationProps & { id: string }): StudentSessionEvaluationEntity {
    return new StudentSessionEvaluationEntity(props);
  }

  public get id(): string { return this._id; }
  public get classSessionId(): string { return this._classSessionId; }
  public get studentId(): string { return this._studentId; }
  public get teacherId(): string | null { return this._teacherId; }
  public get homeworkStatus(): HomeworkStatus { return this._homeworkStatus; }
  public get participation(): ParticipationStatus { return this._participation; }
  public get understanding(): UnderstandingStatus { return this._understanding; }
  public get behaviorTags(): BehaviorTag[] { return [...this._behaviorTags]; }
  public get score(): string | null { return this._score; }
  public get comment(): string | null { return this._comment; }
  public get isAiGenerated(): boolean { return this._isAiGenerated; }
  public get isApproved(): boolean { return this._isApproved; }
  public get approvedAt(): Date | null { return this._approvedAt; }
  public get createdAt(): Date { return this._createdAt; }
  public get updatedAt(): Date { return this._updatedAt; }

  public updateCriteria(props: {
    homeworkStatus?: HomeworkStatus;
    participation?: ParticipationStatus;
    understanding?: UnderstandingStatus;
    behaviorTags?: BehaviorTag[];
    score?: string | null;
  }): void {
    if (props.homeworkStatus !== undefined) this._homeworkStatus = props.homeworkStatus;
    if (props.participation !== undefined) this._participation = props.participation;
    if (props.understanding !== undefined) this._understanding = props.understanding;
    if (props.behaviorTags !== undefined) {
      this._behaviorTags = Array.from(new Set(props.behaviorTags));
    }
    if (props.score !== undefined) {
      this._score = this.validateAndNormalizeScore(props.score);
    }
    this._isApproved = false;
    this._approvedAt = null;
    this._updatedAt = new Date();
  }

  public updateComment(comment: string, isAiGenerated: boolean = false): void {
    this._comment = this.validateComment(comment);
    this._isAiGenerated = isAiGenerated;
    this._isApproved = false;
    this._approvedAt = null;
    this._updatedAt = new Date();
  }

  public approve(): void {
    if (!this._comment || !this._comment.trim()) {
      throw new Error('Không thể duyệt đánh giá khi chưa có nội dung nhận xét');
    }
    this._isApproved = true;
    this._approvedAt = new Date();
    this._updatedAt = new Date();
  }

  public unapprove(): void {
    this._isApproved = false;
    this._approvedAt = null;
    this._updatedAt = new Date();
  }

  public assignTeacher(teacherId: string): void {
    this._teacherId = teacherId;
    this._updatedAt = new Date();
  }

  private validateComment(comment?: string | null): string | null {
    if (!comment) return null;
    if (comment.length > 2000) {
      throw new Error('Nội dung nhận xét không được vượt quá 2,000 ký tự');
    }
    return comment;
  }

  private validateAndNormalizeScore(score?: string | null): string | null {
    if (score === undefined || score === null || score === '') return null;
    const num = Number(String(score).replace(',', '.'));
    if (isNaN(num) || num < 0 || num > 10) {
      throw new Error('Điểm đánh giá phải nằm trong khoảng từ 0 đến 10');
    }
    return String(score).trim();
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
