import {
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../domain/entities/student-session-evaluation.entity';

export interface AiEvaluationCriteria {
  studentName: string;
  homeworkStatus?: HomeworkStatus;
  participation?: ParticipationStatus;
  understanding?: UnderstandingStatus;
  behaviorTags?: BehaviorTag[];
  score?: string | null;
}

export interface IAiEvaluationGeneratorPort {
  generateComment(criteria: AiEvaluationCriteria): Promise<string>;
}

export const IAiEvaluationGeneratorPort = Symbol('IAiEvaluationGeneratorPort');
