import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentSessionEvaluationOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-session-evaluation.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { TeacherOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { StudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { ClassOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { ClassStudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';

import { IStudentSessionEvaluationRepositoryPort } from './application/ports/student-session-evaluation-repository.port';
import { IAiEvaluationGeneratorPort } from './application/ports/ai-evaluation-generator.port';
import { ILlmRateLimiterPort } from './application/ports/llm-rate-limiter.port';
import { ILlmEvaluationCachePort } from './application/ports/llm-evaluation-cache.port';
import { IStudentWeeklyDataQueryPort } from './application/ports/student-weekly-data-query.port';
import { PARENT_AI_CHAT_PORT } from './application/ports/parent-ai-chat.port';
import { STUDENT_PROFILE_CONTEXT_QUERY_PORT } from './application/ports/student-profile-context-query.port';

import { TypeOrmStudentSessionEvaluationAdapter } from './infrastructure/persistence/typeorm-student-session-evaluation.adapter';
import { TypeOrmStudentWeeklyDataQueryAdapter } from './infrastructure/persistence/typeorm-student-weekly-data-query.adapter';
import { TypeOrmStudentProfileContextAdapter } from './infrastructure/persistence/typeorm-student-profile-context.adapter';
import { GeminiAiEvaluationGeneratorAdapter } from './infrastructure/ai/gemini-ai-evaluation-generator.adapter';
import { GeminiParentAiChatAdapter } from './infrastructure/ai/gemini-parent-ai-chat.adapter';
import { InMemoryLlmRateLimiterAdapter } from './infrastructure/security/in-memory-llm-rate-limiter.adapter';
import { InMemoryLlmEvaluationCacheAdapter } from './infrastructure/cache/in-memory-llm-evaluation-cache.adapter';

import { GetSessionEvaluationsUseCase } from './application/use-cases/get-session-evaluations.use-case';
import { SaveSessionEvaluationsUseCase } from './application/use-cases/save-session-evaluations.use-case';
import { GenerateAiEvaluationCommentUseCase } from './application/use-cases/generate-ai-evaluation-comment.use-case';
import { GetWeeklyStudentReportUseCase } from './application/use-cases/get-weekly-student-report.use-case';
import { GetClassWeeklyReportsUseCase } from './application/use-cases/get-class-weekly-reports.use-case';
import { AskParentAiChatbotUseCase } from './application/use-cases/ask-parent-ai-chatbot.use-case';

import { StudentEvaluationController } from './presentation/controllers/student-evaluation.controller';
import { WeeklyStudentReportController } from './presentation/controllers/weekly-student-report.controller';
import { ParentAiChatController } from './presentation/controllers/parent-ai-chat.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentSessionEvaluationOrmEntity,
      ClassSessionOrmEntity,
      TeacherOrmEntity,
      StudentAttendanceOrmEntity,
      StudentOrmEntity,
      ClassOrmEntity,
      ClassStudentOrmEntity,
    ]),
  ],
  controllers: [
    StudentEvaluationController,
    WeeklyStudentReportController,
    ParentAiChatController,
  ],
  providers: [
    {
      provide: IStudentSessionEvaluationRepositoryPort,
      useClass: TypeOrmStudentSessionEvaluationAdapter,
    },
    {
      provide: IStudentWeeklyDataQueryPort,
      useClass: TypeOrmStudentWeeklyDataQueryAdapter,
    },
    {
      provide: STUDENT_PROFILE_CONTEXT_QUERY_PORT,
      useClass: TypeOrmStudentProfileContextAdapter,
    },
    {
      provide: PARENT_AI_CHAT_PORT,
      useClass: GeminiParentAiChatAdapter,
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
    {
      provide: GetWeeklyStudentReportUseCase,
      useFactory: (queryPort: IStudentWeeklyDataQueryPort) =>
        new GetWeeklyStudentReportUseCase(queryPort),
      inject: [IStudentWeeklyDataQueryPort],
    },
    {
      provide: GetClassWeeklyReportsUseCase,
      useFactory: (queryPort: IStudentWeeklyDataQueryPort) =>
        new GetClassWeeklyReportsUseCase(queryPort),
      inject: [IStudentWeeklyDataQueryPort],
    },
    {
      provide: AskParentAiChatbotUseCase,
      useFactory: (chatPort: any, contextPort: any, rateLimiter: any) =>
        new AskParentAiChatbotUseCase(chatPort, contextPort, rateLimiter),
      inject: [
        PARENT_AI_CHAT_PORT,
        STUDENT_PROFILE_CONTEXT_QUERY_PORT,
        ILlmRateLimiterPort,
      ],
    },
  ],
  exports: [
    GetSessionEvaluationsUseCase,
    SaveSessionEvaluationsUseCase,
    GetWeeklyStudentReportUseCase,
    GetClassWeeklyReportsUseCase,
    AskParentAiChatbotUseCase,
  ],
})
export class StudentEvaluationsModule {}
