import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { ClassStudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { ClassOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { LeaveRequestOrmEntity } from '../../infrastructure/persistence/typeorm/entities/leave-request.orm-entity';
import { NotificationOrmEntity } from '../../infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { StudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { TeacherOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { LeaveRequestController } from '../../presentation/controllers/leave-request.controller';
import { LeaveRequestPersistencePort } from './application/ports/leave-request-persistence.port';
import {
  CancelLeaveRequestUseCase,
  ListManagedLeaveRequestsUseCase,
  ListMyLeaveRequestsUseCase,
  ReviewLeaveRequestUseCase,
} from './application/use-cases/manage-leave-request.use-cases';
import { SubmitLeaveRequestUseCase } from './application/use-cases/submit-leave-request.use-case';
import { TypeOrmLeaveRequestPersistenceAdapter } from './infrastructure/persistence/typeorm-leave-request-persistence.adapter';

const persistenceFactory = {
  provide: LeaveRequestPersistencePort,
  useClass: TypeOrmLeaveRequestPersistenceAdapter,
};

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeaveRequestOrmEntity,
      StudentOrmEntity,
      TeacherOrmEntity,
      ClassOrmEntity,
      ClassSessionOrmEntity,
      ClassStudentOrmEntity,
      StudentAttendanceOrmEntity,
      NotificationOrmEntity,
    ]),
  ],
  controllers: [LeaveRequestController],
  providers: [
    persistenceFactory,
    {
      provide: SubmitLeaveRequestUseCase,
      useFactory: (persistence: LeaveRequestPersistencePort) =>
        new SubmitLeaveRequestUseCase(persistence),
      inject: [LeaveRequestPersistencePort],
    },
    {
      provide: ListMyLeaveRequestsUseCase,
      useFactory: (persistence: LeaveRequestPersistencePort) =>
        new ListMyLeaveRequestsUseCase(persistence),
      inject: [LeaveRequestPersistencePort],
    },
    {
      provide: ListManagedLeaveRequestsUseCase,
      useFactory: (persistence: LeaveRequestPersistencePort) =>
        new ListManagedLeaveRequestsUseCase(persistence),
      inject: [LeaveRequestPersistencePort],
    },
    {
      provide: ReviewLeaveRequestUseCase,
      useFactory: (persistence: LeaveRequestPersistencePort) =>
        new ReviewLeaveRequestUseCase(persistence),
      inject: [LeaveRequestPersistencePort],
    },
    {
      provide: CancelLeaveRequestUseCase,
      useFactory: (persistence: LeaveRequestPersistencePort) =>
        new CancelLeaveRequestUseCase(persistence),
      inject: [LeaveRequestPersistencePort],
    },
  ],
})
export class LeaveRequestsModule {}
