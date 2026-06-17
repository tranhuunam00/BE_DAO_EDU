import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacebookLeadItemOrmEntity } from '../../infrastructure/persistence/typeorm/entities/facebook-lead-item.orm-entity';
import { FacebookLeadScanOrmEntity } from '../../infrastructure/persistence/typeorm/entities/facebook-lead-scan.orm-entity';
import { FacebookLeadScanController } from '../../presentation/controllers/facebook-lead-scan.controller';
import { FacebookLeadScanPersistencePort } from './application/ports/facebook-lead-scan-persistence.port';
import {
  GetFacebookLeadScanUseCase,
  ListFacebookLeadScansUseCase,
  SubmitFacebookLeadScanUseCase,
  GetScannedPostIdsUseCase,
} from './application/use-cases/manage-facebook-lead-scans.use-cases';
import { TypeOrmFacebookLeadScanPersistenceAdapter } from './infrastructure/persistence/typeorm-facebook-lead-scan-persistence.adapter';
import { FacebookLeadClassifierPort } from './application/ports/facebook-lead-classifier.port';
import { GeminiFacebookLeadClassifierAdapter } from './infrastructure/ai/gemini-facebook-lead-classifier.adapter';
import { ProcessPendingFacebookLeadScansUseCase } from './application/use-cases/process-pending-facebook-lead-scans.use-case';
import { FacebookLeadAiScheduler } from './infrastructure/scheduler/facebook-lead-ai-scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FacebookLeadScanOrmEntity,
      FacebookLeadItemOrmEntity,
    ]),
  ],
  controllers: [FacebookLeadScanController],
  providers: [
    {
      provide: FacebookLeadScanPersistencePort,
      useClass: TypeOrmFacebookLeadScanPersistenceAdapter,
    },
    {
      provide: FacebookLeadClassifierPort,
      useClass: GeminiFacebookLeadClassifierAdapter,
    },
    {
      provide: SubmitFacebookLeadScanUseCase,
      useFactory: (persistence: FacebookLeadScanPersistencePort) =>
        new SubmitFacebookLeadScanUseCase(persistence),
      inject: [FacebookLeadScanPersistencePort],
    },
    {
      provide: ListFacebookLeadScansUseCase,
      useFactory: (persistence: FacebookLeadScanPersistencePort) =>
        new ListFacebookLeadScansUseCase(persistence),
      inject: [FacebookLeadScanPersistencePort],
    },
    {
      provide: GetFacebookLeadScanUseCase,
      useFactory: (persistence: FacebookLeadScanPersistencePort) =>
        new GetFacebookLeadScanUseCase(persistence),
      inject: [FacebookLeadScanPersistencePort],
    },
    {
      provide: GetScannedPostIdsUseCase,
      useFactory: (persistence: FacebookLeadScanPersistencePort) =>
        new GetScannedPostIdsUseCase(persistence),
      inject: [FacebookLeadScanPersistencePort],
    },
    {
      provide: ProcessPendingFacebookLeadScansUseCase,
      useFactory: (
        persistence: FacebookLeadScanPersistencePort,
        classifier: FacebookLeadClassifierPort,
      ) => new ProcessPendingFacebookLeadScansUseCase(persistence, classifier),
      inject: [FacebookLeadScanPersistencePort, FacebookLeadClassifierPort],
    },
    FacebookLeadAiScheduler,
  ],
})
export class FacebookLeadScansModule {}
