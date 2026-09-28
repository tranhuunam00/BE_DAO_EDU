import {
  AcademicsPersistencePort,
  EnrollmentResult,
} from '../ports/academics-persistence.port';

export class EnrollStudentUseCase {
  constructor(private readonly persistence: AcademicsPersistencePort) {}

  execute(classId: string, studentId: string): Promise<EnrollmentResult> {
    return this.persistence.enrollStudent(
      classId,
      studentId,
      new Date().toISOString().split('T')[0],
    );
  }
}

export class RemoveStudentFromClassUseCase {
  constructor(private readonly persistence: AcademicsPersistencePort) {}

  execute(classId: string, studentId: string, effectiveDate?: string): Promise<void> {
    return this.persistence.removeStudent(
      classId,
      studentId,
      effectiveDate || new Date().toISOString().split('T')[0],
    );
  }
}
