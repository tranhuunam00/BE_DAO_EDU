import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentSessionEvaluationOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student-session-evaluation.orm-entity';
import { IStudentSessionEvaluationRepositoryPort } from '../../application/ports/student-session-evaluation-repository.port';
import {
  StudentSessionEvaluationEntity,
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../domain/entities/student-session-evaluation.entity';

@Injectable()
export class TypeOrmStudentSessionEvaluationAdapter
  implements IStudentSessionEvaluationRepositoryPort
{
  constructor(
    @InjectRepository(StudentSessionEvaluationOrmEntity)
    private readonly repository: Repository<StudentSessionEvaluationOrmEntity>,
  ) {}

  async saveBatch(
    evaluations: StudentSessionEvaluationEntity[],
  ): Promise<StudentSessionEvaluationEntity[]> {
    if (!evaluations.length) return [];

    const ormEntities = evaluations.map((e) => this.toOrmEntity(e));
    const saved = await this.repository.save(ormEntities);
    return saved.map((s) => this.toDomainEntity(s));
  }

  async findBySessionId(sessionId: string): Promise<StudentSessionEvaluationEntity[]> {
    const list = await this.repository.find({
      where: { classSessionId: sessionId },
      order: { createdAt: 'ASC' },
    });
    return list.map((item) => this.toDomainEntity(item));
  }

  async findBySessionAndStudent(
    sessionId: string,
    studentId: string,
  ): Promise<StudentSessionEvaluationEntity | null> {
    const item = await this.repository.findOne({
      where: { classSessionId: sessionId, studentId },
    });
    return item ? this.toDomainEntity(item) : null;
  }

  private toOrmEntity(domain: StudentSessionEvaluationEntity): StudentSessionEvaluationOrmEntity {
    const orm = new StudentSessionEvaluationOrmEntity();
    orm.id = domain.id;
    orm.classSessionId = domain.classSessionId;
    orm.studentId = domain.studentId;
    orm.teacherId = domain.teacherId;
    orm.homeworkStatus = domain.homeworkStatus;
    orm.participation = domain.participation;
    orm.understanding = domain.understanding;
    orm.behaviorTags = domain.behaviorTags;
    orm.score = domain.score;
    orm.comment = domain.comment;
    orm.isAiGenerated = domain.isAiGenerated;
    orm.isApproved = domain.isApproved;
    orm.approvedAt = domain.approvedAt;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }

  private toDomainEntity(orm: StudentSessionEvaluationOrmEntity): StudentSessionEvaluationEntity {
    return StudentSessionEvaluationEntity.reconstruct({
      id: orm.id,
      classSessionId: orm.classSessionId,
      studentId: orm.studentId,
      teacherId: orm.teacherId,
      homeworkStatus: orm.homeworkStatus as HomeworkStatus,
      participation: orm.participation as ParticipationStatus,
      understanding: orm.understanding as UnderstandingStatus,
      behaviorTags: (orm.behaviorTags || []) as BehaviorTag[],
      score: orm.score,
      comment: orm.comment,
      isAiGenerated: orm.isAiGenerated,
      isApproved: orm.isApproved,
      approvedAt: orm.approvedAt,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }
}
