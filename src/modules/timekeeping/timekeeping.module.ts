import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { TimekeepingDeviceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/timekeeping-device.orm-entity';
import { TimekeepingLogOrmEntity } from '../../infrastructure/persistence/typeorm/entities/timekeeping-log.orm-entity';
import { TeacherOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { StorageModule } from '../../infrastructure/storage/storage.module';

import { ProcessRawLogUseCase } from './application/use-cases/process-raw-log.use-case';
import { SyncStudentToDeviceUseCase } from './application/use-cases/sync-student-to-device.use-case';
import { ConfigureWebhookUseCase } from './application/use-cases/configure-webhook.use-case';
import { SyncDeviceTimeUseCase } from './application/use-cases/sync-device-time.use-case';
import { ReconcileTimekeepingLogsUseCase } from './application/use-cases/reconcile-timekeeping-logs.use-case';
import { TimekeepingSyncScheduler } from './application/schedulers/timekeeping-sync.scheduler';

import { TimekeepingWebhookController } from '../../presentation/controllers/timekeeping-webhook.controller';
import { TimekeepingDeviceController } from '../../presentation/controllers/timekeeping-device.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentOrmEntity,
      StudentAttendanceOrmEntity,
      ClassSessionOrmEntity,
      TimekeepingDeviceOrmEntity,
      TimekeepingLogOrmEntity,
      TeacherOrmEntity,
    ]),
    StorageModule,
  ],
  controllers: [
    TimekeepingWebhookController,
    TimekeepingDeviceController,
  ],
  providers: [
    ProcessRawLogUseCase,
    SyncStudentToDeviceUseCase,
    ConfigureWebhookUseCase,
    SyncDeviceTimeUseCase,
    ReconcileTimekeepingLogsUseCase,
    TimekeepingSyncScheduler,
  ],
  exports: [
    ProcessRawLogUseCase,
  ],
})
export class TimekeepingModule {}
