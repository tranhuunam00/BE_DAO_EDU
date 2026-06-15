import { LeaveRequestError } from '../errors/leave-request.error';

export type LeaveRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface LeaveRequestProps {
  id?: string;
  studentId: string;
  classSessionId: string;
  reason: string;
  status: LeaveRequestStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  reviewNote: string | null;
  cancelledAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class LeaveRequest {
  constructor(private readonly props: LeaveRequestProps) {
    const reason = props.reason.trim();
    if (!reason) {
      throw new LeaveRequestError(
        'INVALID_REASON',
        'Lý do xin nghỉ không được để trống.',
      );
    }
    this.props.reason = reason;
  }

  static submit(input: {
    studentId: string;
    classSessionId: string;
    reason: string;
    submittedAt: Date;
  }) {
    return new LeaveRequest({
      ...input,
      status: 'pending',
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNote: null,
      cancelledAt: null,
    });
  }

  get id() {
    return this.props.id;
  }
  get studentId() {
    return this.props.studentId;
  }
  get classSessionId() {
    return this.props.classSessionId;
  }
  get reason() {
    return this.props.reason;
  }
  get status() {
    return this.props.status;
  }
  get submittedAt() {
    return this.props.submittedAt;
  }
  get reviewedAt() {
    return this.props.reviewedAt;
  }
  get reviewedByUserId() {
    return this.props.reviewedByUserId;
  }
  get reviewNote() {
    return this.props.reviewNote;
  }
  get cancelledAt() {
    return this.props.cancelledAt;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  approve(reviewerUserId: string, reviewNote: string | null, now: Date) {
    this.assertPending();
    this.props.status = 'approved';
    this.props.reviewedByUserId = reviewerUserId;
    this.props.reviewNote = normalizeOptionalText(reviewNote);
    this.props.reviewedAt = now;
  }

  reject(reviewerUserId: string, reviewNote: string | null, now: Date) {
    this.assertPending();
    this.props.status = 'rejected';
    this.props.reviewedByUserId = reviewerUserId;
    this.props.reviewNote = normalizeOptionalText(reviewNote);
    this.props.reviewedAt = now;
  }

  cancel(now: Date) {
    this.assertPending();
    this.props.status = 'cancelled';
    this.props.cancelledAt = now;
  }

  toPrimitives(): LeaveRequestProps {
    return { ...this.props };
  }

  private assertPending() {
    if (this.status !== 'pending') {
      throw new LeaveRequestError(
        'LEAVE_REQUEST_NOT_PENDING',
        'Chỉ có thể xử lý đơn xin nghỉ đang chờ duyệt.',
      );
    }
  }
}

function normalizeOptionalText(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized || null;
}
