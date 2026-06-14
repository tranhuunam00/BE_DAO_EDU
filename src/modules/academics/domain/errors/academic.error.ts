export class AcademicError extends Error {
  constructor(
    public readonly code:
      | 'CLASS_NOT_FOUND'
      | 'STUDENT_NOT_FOUND'
      | 'CLASS_FULL'
      | 'ROOM_SCHEDULE_CONFLICT'
      | 'TEACHER_SCHEDULE_CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = AcademicError.name;
  }
}
