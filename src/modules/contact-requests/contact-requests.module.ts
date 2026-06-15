import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactRequestOrmEntity } from '../../infrastructure/persistence/typeorm/entities/contact-request.orm-entity';
import { ContactRequestController } from '../../presentation/controllers/contact-request.controller';
import { ContactRequestPersistencePort } from './application/ports/contact-request-persistence.port';
import {
  ListContactRequestsUseCase,
  SubmitContactRequestUseCase,
  UpdateContactRequestStatusUseCase,
} from './application/use-cases/manage-contact-requests.use-cases';
import { TypeOrmContactRequestPersistenceAdapter } from './infrastructure/persistence/typeorm-contact-request-persistence.adapter';

@Module({
  imports: [TypeOrmModule.forFeature([ContactRequestOrmEntity])],
  controllers: [ContactRequestController],
  providers: [
    {
      provide: ContactRequestPersistencePort,
      useClass: TypeOrmContactRequestPersistenceAdapter,
    },
    {
      provide: SubmitContactRequestUseCase,
      useFactory: (persistence: ContactRequestPersistencePort) =>
        new SubmitContactRequestUseCase(persistence),
      inject: [ContactRequestPersistencePort],
    },
    {
      provide: ListContactRequestsUseCase,
      useFactory: (persistence: ContactRequestPersistencePort) =>
        new ListContactRequestsUseCase(persistence),
      inject: [ContactRequestPersistencePort],
    },
    {
      provide: UpdateContactRequestStatusUseCase,
      useFactory: (persistence: ContactRequestPersistencePort) =>
        new UpdateContactRequestStatusUseCase(persistence),
      inject: [ContactRequestPersistencePort],
    },
  ],
})
export class ContactRequestsModule {}
