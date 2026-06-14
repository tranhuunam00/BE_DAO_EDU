import { ScheduleAllocation } from '../../domain/services/schedule-conflict.policy';

export interface EnrollmentResult {
  id: string;
  classId: string;
  studentId: string;
  status: string;
  joinedDate: string;
  reactivated: boolean;
}

export abstract class AcademicsPersistencePort {
  abstract findRecurringAllocations(
    excludeClassId?: string,
  ): Promise<ScheduleAllocation[]>;

  abstract findSessionAllocations(
    date: string,
    excludeSessionId?: string,
  ): Promise<ScheduleAllocation[]>;

  abstract enrollStudent(
    classId: string,
    studentId: string,
    joinedDate: string,
  ): Promise<EnrollmentResult>;

  abstract removeStudent(
    classId: string,
    studentId: string,
    effectiveDate: string,
  ): Promise<void>;
}
