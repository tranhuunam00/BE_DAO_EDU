export type LeaveRequestErrorCode =
  | 'STUDENT_NOT_FOUND'
  | 'SESSION_NOT_FOUND'
  | 'LEAVE_REQUEST_NOT_FOUND'
  | 'NOT_ENROLLED'
  | 'SESSION_NOT_AVAILABLE'
  | 'INVALID_REASON'
  | 'DUPLICATE_LEAVE_REQUEST'
  | 'LEAVE_REQUEST_NOT_PENDING'
  | 'FORBIDDEN'
  | 'ATTENDANCE_ALREADY_BILLED'
  | 'AMBIGUOUS_STUDENT';

export class LeaveRequestError extends Error {
  constructor(
    public readonly code: LeaveRequestErrorCode,
    message: string,
  ) {
    super(message);
    this.name = LeaveRequestError.name;
  }
}
