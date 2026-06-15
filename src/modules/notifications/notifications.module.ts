import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationOrmEntity } from '../../infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { NotificationLogOrmEntity } from '../../infrastructure/persistence/typeorm/entities/notification-log.orm-entity';
import { NotificationController } from '../../presentation/controllers/notification.controller';
import { NotificationPersistencePort } from './application/ports/notification-persistence.port';
import {
  ArchiveNotificationUseCase,
  ArchiveReadNotificationsUseCase,
  ListMyNotificationsUseCase,
  ListNotificationLogsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
  MarkNotificationUnreadUseCase,
} from './application/use-cases/manage-notifications.use-cases';
import { TypeOrmNotificationPersistenceAdapter } from './infrastructure/persistence/typeorm-notification-persistence.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationOrmEntity, NotificationLogOrmEntity]),
  ],
  controllers: [NotificationController],
  providers: [
    {
      provide: NotificationPersistencePort,
      useClass: TypeOrmNotificationPersistenceAdapter,
    },
    ...[
      ListMyNotificationsUseCase,
      MarkNotificationReadUseCase,
      MarkNotificationUnreadUseCase,
      ArchiveNotificationUseCase,
      MarkAllNotificationsReadUseCase,
      ArchiveReadNotificationsUseCase,
      ListNotificationLogsUseCase,
    ].map((useCase) => ({
      provide: useCase,
      useFactory: (persistence: NotificationPersistencePort) =>
        new useCase(persistence),
      inject: [NotificationPersistencePort],
    })),
  ],
})
export class NotificationsModule {}
