import { AcademicsPersistencePort } from '../../../../../../src/modules/academics/application/ports/academics-persistence.port';
import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';
import { ScheduleConflictPolicy } from '../../../../../../src/modules/academics/domain/services/schedule-conflict.policy';
import {
  CheckRecurringScheduleConflictsUseCase,
  CheckSessionScheduleConflictUseCase,
} from '../../../../../../src/modules/academics/application/use-cases/check-schedule-conflicts.use-case';
import {
  EnrollStudentUseCase,
  RemoveStudentFromClassUseCase,
} from '../../../../../../src/modules/academics/application/use-cases/manage-enrollment.use-cases';

describe('Academics use cases', () => {
  const persistence = {
    findRecurringAllocations: jest.fn(),
    findSessionAllocations: jest.fn(),
    enrollStudent: jest.fn(),
    removeStudent: jest.fn(),
  } as jest.Mocked<AcademicsPersistencePort>;
  const policy = new ScheduleConflictPolicy();

  beforeEach(() => jest.clearAllMocks());

  it('rejects a recurring room conflict', async () => {
    persistence.findRecurringAllocations.mockResolvedValue([
      {
        weekday: 'Mon',
        startTime: '08:00',
        endTime: '09:00',
        roomId: 'room-1',
      },
    ]);
    const useCase = new CheckRecurringScheduleConflictsUseCase(
      persistence,
      policy,
    );

    await expect(
      useCase.execute([
        {
          weekday: 'Mon',
          startTime: '08:30',
          endTime: '09:30',
          roomId: 'room-1',
        },
      ]),
    ).rejects.toMatchObject<Partial<AcademicError>>({
      code: 'ROOM_SCHEDULE_CONFLICT',
    });
  });

  it('rejects a concrete teacher conflict', async () => {
    persistence.findSessionAllocations.mockResolvedValue([
      {
        date: '2026-06-15',
        startTime: '08:00',
        endTime: '09:00',
        teacherId: 'teacher-1',
      },
    ]);
    const useCase = new CheckSessionScheduleConflictUseCase(
      persistence,
      policy,
    );

    await expect(
      useCase.execute({
        date: '2026-06-15',
        startTime: '08:30',
        endTime: '09:30',
        teacherId: 'teacher-1',
      }),
    ).rejects.toMatchObject<Partial<AcademicError>>({
      code: 'TEACHER_SCHEDULE_CONFLICT',
    });
  });

  it('delegates enrollment and removal to the transactional port', async () => {
    persistence.enrollStudent.mockResolvedValue({
      id: 'enrollment-1',
      classId: 'class-1',
      studentId: 'student-1',
      status: 'Active',
      joinedDate: '2026-06-14',
      reactivated: false,
    });
    persistence.removeStudent.mockResolvedValue(undefined);

    await new EnrollStudentUseCase(persistence).execute(
      'class-1',
      'student-1',
    );
    await new RemoveStudentFromClassUseCase(persistence).execute(
      'class-1',
      'student-1',
    );

    expect(persistence.enrollStudent).toHaveBeenCalledWith(
      'class-1',
      'student-1',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(persistence.removeStudent).toHaveBeenCalled();
  });
});
