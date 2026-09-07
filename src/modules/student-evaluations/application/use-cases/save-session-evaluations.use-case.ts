import {
  StudentSessionEvaluationEntity,
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../domain/entities/student-session-evaluation.entity';
import { IStudentSessionEvaluationRepositoryPort } from '../ports/student-session-evaluation-repository.port';

export interface EvaluationItemInput {
  studentId: string;
  homeworkStatus?: HomeworkStatus;
  participation?: ParticipationStatus;
  understanding?: UnderstandingStatus;
  behaviorTags?: BehaviorTag[];
  score?: string | null;
  comment?: string | null;
  isAiGenerated?: boolean;
  isApproved?: boolean;
}

export interface SaveSessionEvaluationsInput {
  classSessionId: string;
  teacherId?: string | null;
  evaluations: EvaluationItemInput[];
}

export interface SaveSessionEvaluationsOutput {
  savedCount: number;
  evaluations: StudentSessionEvaluationEntity[];
}

export class SaveSessionEvaluationsUseCase {
  constructor(
    private readonly repository: IStudentSessionEvaluationRepositoryPort,
  ) {}

  async execute(input: SaveSessionEvaluationsInput): Promise<SaveSessionEvaluationsOutput> {
    if (!input.classSessionId || !input.classSessionId.trim()) {
      throw new Error('classSessionId không được để trống');
    }

    if (!input.evaluations || input.evaluations.length === 0) {
      await this.repository.saveBatch([]);
      return { savedCount: 0, evaluations: [] };
    }

    // 1. Validate tất cả studentId đầu vào
    for (const item of input.evaluations) {
      if (!item.studentId || !item.studentId.trim()) {
        throw new Error('studentId không được để trống');
      }
    }

    // 2. Lấy danh sách đánh giá hiện có của buổi học để xử lý Idempotent Upsert
    const existingList = await this.repository.findBySessionId(input.classSessionId);
    const existingMap = new Map<string, StudentSessionEvaluationEntity>(
      existingList.map((e) => [e.studentId, e]),
    );

    const entitiesToSave: StudentSessionEvaluationEntity[] = [];

    // 3. Chuẩn bị danh sách bản ghi
    for (const item of input.evaluations) {
      const existing = existingMap.get(item.studentId);

      if (existing) {
        // Cập nhật bản ghi cũ
        existing.updateCriteria({
          homeworkStatus: item.homeworkStatus,
          participation: item.participation,
          understanding: item.understanding,
          behaviorTags: item.behaviorTags,
          score: item.score,
        });

        if (input.teacherId) {
          existing.assignTeacher(input.teacherId);
        }

        if (item.comment !== undefined && item.comment !== null) {
          existing.updateComment(item.comment, item.isAiGenerated ?? false);
        }

        if (item.isApproved === true) {
          existing.approve();
        } else if (item.isApproved === false) {
          existing.unapprove();
        }

        entitiesToSave.push(existing);
      } else {
        // Tạo bản ghi mới
        const newEntity = StudentSessionEvaluationEntity.create({
          classSessionId: input.classSessionId,
          studentId: item.studentId,
          teacherId: input.teacherId,
          homeworkStatus: item.homeworkStatus,
          participation: item.participation,
          understanding: item.understanding,
          behaviorTags: item.behaviorTags,
          score: item.score,
        });

        if (item.comment) {
          newEntity.updateComment(item.comment, item.isAiGenerated ?? false);
        }

        if (item.isApproved) {
          newEntity.approve();
        }

        entitiesToSave.push(newEntity);
      }
    }

    // 4. Lưu batch vào cơ sở dữ liệu qua Repository Port
    const saved = await this.repository.saveBatch(entitiesToSave);

    return {
      savedCount: saved.length,
      evaluations: saved,
    };
  }
}
