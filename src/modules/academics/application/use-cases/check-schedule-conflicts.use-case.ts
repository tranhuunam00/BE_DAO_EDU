import { AcademicsPersistencePort } from '../ports/academics-persistence.port';
import { AcademicError } from '../../domain/errors/academic.error';
import {
  ScheduleAllocation,
  ScheduleConflictPolicy,
} from '../../domain/services/schedule-conflict.policy';

export class CheckRecurringScheduleConflictsUseCase {
  constructor(
    private readonly persistence: AcademicsPersistencePort,
    private readonly policy: ScheduleConflictPolicy,
  ) {}

  async execute(
    allocations: ScheduleAllocation[],
    excludeClassId?: string,
  ): Promise<void> {
    const existing =
      await this.persistence.findRecurringAllocations(excludeClassId);
    for (const allocation of allocations) {
      this.assertNoConflict(allocation, existing);
    }
  }

  private assertNoConflict(
    requested: ScheduleAllocation,
    existing: ScheduleAllocation[],
  ): void {
    const conflict = this.policy.findConflict(requested, existing);
    if (!conflict) return;
    if (conflict.resource === 'room') {
      throw new AcademicError(
        'ROOM_SCHEDULE_CONFLICT',
        'Room is already occupied during this time.',
      );
    }
    throw new AcademicError(
      'TEACHER_SCHEDULE_CONFLICT',
      'Teacher is already assigned during this time.',
    );
  }
}

export class CheckSessionScheduleConflictUseCase {
  constructor(
    private readonly persistence: AcademicsPersistencePort,
    private readonly policy: ScheduleConflictPolicy,
  ) {}

  async execute(
    allocation: ScheduleAllocation,
    excludeSessionId?: string,
  ): Promise<void> {
    if (!allocation.date) return;
    const existing = await this.persistence.findSessionAllocations(
      allocation.date,
      excludeSessionId,
    );
    const conflict = this.policy.findConflict(allocation, existing);
    if (!conflict) return;
    if (conflict.resource === 'room') {
      throw new AcademicError(
        'ROOM_SCHEDULE_CONFLICT',
        'Room is already occupied during this time.',
      );
    }
    throw new AcademicError(
      'TEACHER_SCHEDULE_CONFLICT',
      'Teacher is already assigned during this time.',
    );
  }
}
