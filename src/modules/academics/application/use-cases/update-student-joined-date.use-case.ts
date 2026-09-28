import { AcademicsPersistencePort } from '../ports/academics-persistence.port';

export class UpdateStudentJoinedDateUseCase {
  constructor(private readonly persistence: AcademicsPersistencePort) {}

  execute(classId: string, studentId: string, joinedDate: string) {
    return this.persistence.updateStudentJoinedDate(classId, studentId, joinedDate);
  }
}

export class UpdateAllStudentsJoinedDateUseCase {
  constructor(private readonly persistence: AcademicsPersistencePort) {}

  execute(classId: string, joinedDate: string) {
    return this.persistence.updateAllStudentsJoinedDate(classId, joinedDate);
  }
}

export class UpdateStudentDroppedDateUseCase {
  constructor(private readonly persistence: AcademicsPersistencePort) {}

  execute(classId: string, studentId: string, droppedDate: string) {
    return this.persistence.updateStudentDroppedDate(classId, studentId, droppedDate);
  }
}
