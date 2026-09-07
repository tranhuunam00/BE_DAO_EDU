import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentSessionEvaluationOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-session-evaluation.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { TeacherOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { IStudentSessionEvaluationRepositoryPort } from './application/ports/student-session-evaluation-repository.port';
import { IAiEvaluationGeneratorPort } from './application/ports/ai-evaluation-generator.port';
import { ILlmRateLimiterPort } from './application/ports/llm-rate-limiter.port';
import { ILlmEvaluationCachePort } from './application/ports/llm-evaluation-cache.port';
import { TypeOrmStudentSessionEvaluationAdapter } from './infrastructure/persistence/typeorm-student-session-evaluation.adapter';
import { GeminiAiEvaluationGeneratorAdapter } from './infrastructure/ai/gemini-ai-evaluation-generator.adapter';
import { InMemoryLlmRateLimiterAdapter } from './infrastructure/security/in-memory-llm-rate-limiter.adapter';
import { InMemoryLlmEvaluationCacheAdapter } from './infrastructure/cache/in-memory-llm-evaluation-cache.adapter';
import { GetSessionEvaluationsUseCase } from './application/use-cases/get-session-evaluations.use-case';
import { SaveSessionEvaluationsUseCase } from './application/use-cases/save-session-evaluations.use-case';
import { GenerateAiEvaluationCommentUseCase } from './application/use-cases/generate-ai-evaluation-comment.use-case';
import { StudentEvaluationController } from './presentation/controllers/student-evaluation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentSessionEvaluationOrmEntity,
      ClassSessionOrmEntity,
      TeacherOrmEntity,
      StudentAttendanceOrmEntity,
    ]),
  ],
  controllers: [StudentEvaluationController],
  providers: [
    {
      provide: IStudentSessionEvaluationRepositoryPort,
      useClass: TypeOrmStudentSessionEvaluationAdapter,
    },
    {
      provide: IAiEvaluationGeneratorPort,
      useClass: GeminiAiEvaluationGeneratorAdapter,
    },
    {
      provide: ILlmRateLimiterPort,
      useClass: InMemoryLlmRateLimiterAdapter,
    },
    {
      provide: ILlmEvaluationCachePort,
      useClass: InMemoryLlmEvaluationCacheAdapter,
    },
    {
      provide: GetSessionEvaluationsUseCase,
      useFactory: (repo: IStudentSessionEvaluationRepositoryPort) =>
        new GetSessionEvaluationsUseCase(repo),
      inject: [IStudentSessionEvaluationRepositoryPort],
    },
    {
      provide: SaveSessionEvaluationsUseCase,
      useFactory: (repo: IStudentSessionEvaluationRepositoryPort) =>
        new SaveSessionEvaluationsUseCase(repo),
      inject: [IStudentSessionEvaluationRepositoryPort],
    },
    {
      provide: GenerateAiEvaluationCommentUseCase,
      useFactory: (
        ai: IAiEvaluationGeneratorPort,
        cache: ILlmEvaluationCachePort,
        limiter: ILlmRateLimiterPort,
      ) => new GenerateAiEvaluationCommentUseCase(ai, cache, limiter),
      inject: [
        IAiEvaluationGeneratorPort,
        ILlmEvaluationCachePort,
        ILlmRateLimiterPort,
      ],
    },
  ],
  exports: [GetSessionEvaluationsUseCase, SaveSessionEvaluationsUseCase],
})
export class StudentEvaluationsModule {}
