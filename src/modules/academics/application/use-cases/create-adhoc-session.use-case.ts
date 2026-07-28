import { AcademicsPersistencePort } from '../ports/academics-persistence.port';

export class CreateAdhocSessionUseCase {
  constructor(private readonly persistence: AcademicsPersistencePort) {}

  execute(
    classId: string,
    date: string,
    startTime: string,
    endTime: string,
    roomId: string | null,
    teacherId: string | null,
    assistantId: string | null,
  ): Promise<any> {
    return this.persistence.createAdhocSession(
      classId,
      date,
      startTime,
      endTime,
      roomId,
      teacherId,
      assistantId,
    );
  }
}
