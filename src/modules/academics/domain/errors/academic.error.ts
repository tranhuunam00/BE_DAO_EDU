export class AcademicError extends Error {
  constructor(
    public readonly code:
      | 'CLASS_NOT_FOUND'
      | 'STUDENT_NOT_FOUND'
      | 'CLASS_FULL'
      | 'ROOM_SCHEDULE_CONFLICT'
      | 'TEACHER_SCHEDULE_CONFLICT'
      | 'PRICING_NOT_FOUND'
      | 'PRICING_CONFLICT'
      | 'PRICING_LOCKED_BILLED'
      | 'INVALID_PRICING_TIMELINE'
      | 'INVALID_PRICING_AMOUNT'
      | 'ATTENDANCE_LOCKED'
      | 'INVALID_JOINED_DATE'
      | 'ATTENDANCE_ALREADY_BILLED'
      | 'ATTENDANCE_ATTENDED_CONFLICT'
      | 'CANNOT_MODIFY_JOINED_DATE_PROTECTED'
      | 'CANNOT_DELETE_SESSION_PROTECTED'
      | 'BAD_REQUEST'
      | 'CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = AcademicError.name;
  }
}
