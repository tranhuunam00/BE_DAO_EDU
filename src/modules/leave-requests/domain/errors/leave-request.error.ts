export type LeaveRequestErrorCode =
  | 'STUDENT_NOT_FOUND'
  | 'SESSION_NOT_FOUND'
  | 'LEAVE_REQUEST_NOT_FOUND'
  | 'NOT_ENROLLED'
  | 'SESSION_NOT_AVAILABLE'
  | 'INVALID_REASON'
  | 'DUPLICATE_LEAVE_REQUEST'
  | 'LEAVE_REQUEST_NOT_PENDING'
  | 'FORBIDDEN';

export class LeaveRequestError extends Error {
  constructor(
    public readonly code: LeaveRequestErrorCode,
    message: string,
  ) {
    super(message);
    this.name = LeaveRequestError.name;
  }
}
