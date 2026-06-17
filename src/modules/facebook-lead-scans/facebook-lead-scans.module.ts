import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacebookLeadItemOrmEntity } from '../../infrastructure/persistence/typeorm/entities/facebook-lead-item.orm-entity';
import { FacebookLeadScanOrmEntity } from '../../infrastructure/persistence/typeorm/entities/facebook-lead-scan.orm-entity';
import { LeadOrmEntity } from '../../infrastructure/persistence/typeorm/entities/lead.orm-entity';
import { LeadDemandOrmEntity } from '../../infrastructure/persistence/typeorm/entities/lead-demand.orm-entity';
import { LeadInteractionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/lead-interaction.orm-entity';

import { FacebookLeadScanController } from '../../presentation/controllers/facebook-lead-scan.controller';
import { LeadCrmController } from '../../presentation/controllers/lead-crm.controller';

import { FacebookLeadScanPersistencePort } from './application/ports/facebook-lead-scan-persistence.port';
import { LeadCrmPersistencePort } from './application/ports/lead-crm-persistence.port';

import {
  GetFacebookLeadScanUseCase,
  ListFacebookLeadScansUseCase,
  SubmitFacebookLeadScanUseCase,
  GetScannedPostIdsUseCase,
} from './application/use-cases/manage-facebook-lead-scans.use-cases';

import { ListLeadsUseCase } from './application/use-cases/list-leads.use-case';
import { GetLeadDetailsUseCase } from './application/use-cases/get-lead-details.use-case';
import { AddLeadInteractionUseCase } from './application/use-cases/add-lead-interaction.use-case';

import { TypeOrmFacebookLeadScanPersistenceAdapter } from './infrastructure/persistence/typeorm-facebook-lead-scan-persistence.adapter';
import { TypeOrmLeadCrmPersistenceAdapter } from './infrastructure/persistence/typeorm-lead-crm-persistence.adapter';

import { FacebookLeadClassifierPort } from './application/ports/facebook-lead-classifier.port';
import { GeminiFacebookLeadClassifierAdapter } from './infrastructure/ai/gemini-facebook-lead-classifier.adapter';
import { ProcessPendingFacebookLeadScansUseCase } from './application/use-cases/process-pending-facebook-lead-scans.use-case';
import { FacebookLeadAiScheduler } from './infrastructure/scheduler/facebook-lead-ai-scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FacebookLeadScanOrmEntity,
      FacebookLeadItemOrmEntity,
      LeadOrmEntity,
      LeadDemandOrmEntity,
      LeadInteractionOrmEntity,
    ]),
  ],
  controllers: [FacebookLeadScanController, LeadCrmController],
  providers: [
    {
      provide: FacebookLeadScanPersistencePort,
      useClass: TypeOrmFacebookLeadScanPersistenceAdapter,
    },
    {
      provide: LeadCrmPersistencePort,
      useClass: TypeOrmLeadCrmPersistenceAdapter,
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
      provide: ListLeadsUseCase,
      useFactory: (persistence: LeadCrmPersistencePort) =>
        new ListLeadsUseCase(persistence),
      inject: [LeadCrmPersistencePort],
    },
    {
      provide: GetLeadDetailsUseCase,
      useFactory: (persistence: LeadCrmPersistencePort) =>
        new GetLeadDetailsUseCase(persistence),
      inject: [LeadCrmPersistencePort],
    },
    {
      provide: AddLeadInteractionUseCase,
      useFactory: (persistence: LeadCrmPersistencePort) =>
        new AddLeadInteractionUseCase(persistence),
      inject: [LeadCrmPersistencePort],
    },
    {
      provide: ProcessPendingFacebookLeadScansUseCase,
      useFactory: (
        persistence: FacebookLeadScanPersistencePort,
        classifier: FacebookLeadClassifierPort,
        crmPersistence: LeadCrmPersistencePort,
      ) => new ProcessPendingFacebookLeadScansUseCase(persistence, classifier, crmPersistence),
      inject: [
        FacebookLeadScanPersistencePort,
        FacebookLeadClassifierPort,
        LeadCrmPersistencePort,
      ],
    },
    FacebookLeadAiScheduler,
  ],
})
export class FacebookLeadScansModule { }
