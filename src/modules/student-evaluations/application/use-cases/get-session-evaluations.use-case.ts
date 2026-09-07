import { StudentSessionEvaluationEntity } from '../../domain/entities/student-session-evaluation.entity';
import { IStudentSessionEvaluationRepositoryPort } from '../ports/student-session-evaluation-repository.port';

export class GetSessionEvaluationsUseCase {
  constructor(
    private readonly repository: IStudentSessionEvaluationRepositoryPort,
  ) {}

  async execute(classSessionId: string): Promise<StudentSessionEvaluationEntity[]> {
    if (!classSessionId || !classSessionId.trim()) {
      throw new Error('classSessionId không được để trống');
    }
    return this.repository.findBySessionId(classSessionId);
  }
}
