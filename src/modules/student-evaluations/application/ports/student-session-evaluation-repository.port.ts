import { StudentSessionEvaluationEntity } from '../../domain/entities/student-session-evaluation.entity';

export interface IStudentSessionEvaluationRepositoryPort {
  saveBatch(evaluations: StudentSessionEvaluationEntity[]): Promise<StudentSessionEvaluationEntity[]>;
  findBySessionId(sessionId: string): Promise<StudentSessionEvaluationEntity[]>;
  findBySessionAndStudent(
    sessionId: string,
    studentId: string,
  ): Promise<StudentSessionEvaluationEntity | null>;
}

export const IStudentSessionEvaluationRepositoryPort = Symbol(
  'IStudentSessionEvaluationRepositoryPort',
);
