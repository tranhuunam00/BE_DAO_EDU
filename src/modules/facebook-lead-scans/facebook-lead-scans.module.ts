import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacebookLeadItemOrmEntity } from '../../infrastructure/persistence/typeorm/entities/facebook-lead-item.orm-entity';
import { FacebookLeadScanOrmEntity } from '../../infrastructure/persistence/typeorm/entities/facebook-lead-scan.orm-entity';
import { FacebookLeadScanController } from '../../presentation/controllers/facebook-lead-scan.controller';
import { FacebookLeadScanPersistencePort } from './application/ports/facebook-lead-scan-persistence.port';
  GetFacebookLeadScanUseCase,
  ListFacebookLeadScansUseCase,
  SubmitFacebookLeadScanUseCase,
  GetScannedPostIdsUseCase,
} from './application/use-cases/manage-facebook-lead-scans.use-cases';
import { TypeOrmFacebookLeadScanPersistenceAdapter } from './infrastructure/persistence/typeorm-facebook-lead-scan-persistence.adapter';

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
  ],
})
export class FacebookLeadScansModule {}
