import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/assignment.orm-entity';
import { ClassScheduleOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-schedule.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { ClassStudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { ClassOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { CourseLevelPricingOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';
import { CourseLevelOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course-level.orm-entity';
import { CourseOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course.orm-entity';
import { NotificationOrmEntity } from '../../infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { StudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { TeacherOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { ClassController } from '../../presentation/controllers/class.controller';
import { CourseController } from '../../presentation/controllers/course.controller';
import { AcademicsPersistencePort } from './application/ports/academics-persistence.port';
import {
  CheckRecurringScheduleConflictsUseCase,
  CheckSessionScheduleConflictUseCase,
} from './application/use-cases/check-schedule-conflicts.use-case';
import {
  EnrollStudentUseCase,
  RemoveStudentFromClassUseCase,
} from './application/use-cases/manage-enrollment.use-cases';
import { ScheduleConflictPolicy } from './domain/services/schedule-conflict.policy';
import { TypeOrmAcademicsPersistenceAdapter } from './infrastructure/persistence/typeorm-academics-persistence.adapter';
import { HolidayOrmEntity } from '../../infrastructure/persistence/typeorm/entities/holiday.orm-entity';
import { HolidayController } from '../../presentation/controllers/holiday.controller';
import { HolidayPersistencePort } from './application/ports/holiday-persistence.port';
import {
  DeleteHolidayUseCase,
  GetHolidayDatesUseCase,
  ListHolidaysUseCase,
  SaveHolidayUseCase,
} from './application/use-cases/manage-holidays.use-cases';
import { TypeOrmHolidayPersistenceAdapter } from './infrastructure/persistence/typeorm-holiday-persistence.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourseOrmEntity,
      CourseLevelOrmEntity,
      CourseLevelPricingOrmEntity,
      ClassOrmEntity,
      ClassScheduleOrmEntity,
      ClassSessionOrmEntity,
      ClassStudentOrmEntity,
      StudentAttendanceOrmEntity,
      StudentOrmEntity,
      AssignmentOrmEntity,
      NotificationOrmEntity,
      HolidayOrmEntity,
      TeacherOrmEntity,
    ]),
  ],
  controllers: [CourseController, ClassController, HolidayController],
  providers: [
    ScheduleConflictPolicy,
    {
      provide: AcademicsPersistencePort,
      useClass: TypeOrmAcademicsPersistenceAdapter,
    },
    {
      provide: CheckRecurringScheduleConflictsUseCase,
      useFactory: (
        persistence: AcademicsPersistencePort,
        policy: ScheduleConflictPolicy,
      ) => new CheckRecurringScheduleConflictsUseCase(persistence, policy),
      inject: [AcademicsPersistencePort, ScheduleConflictPolicy],
    },
    {
      provide: CheckSessionScheduleConflictUseCase,
      useFactory: (
        persistence: AcademicsPersistencePort,
        policy: ScheduleConflictPolicy,
      ) => new CheckSessionScheduleConflictUseCase(persistence, policy),
      inject: [AcademicsPersistencePort, ScheduleConflictPolicy],
    },
    {
      provide: EnrollStudentUseCase,
      useFactory: (persistence: AcademicsPersistencePort) =>
        new EnrollStudentUseCase(persistence),
      inject: [AcademicsPersistencePort],
    },
    {
      provide: RemoveStudentFromClassUseCase,
      useFactory: (persistence: AcademicsPersistencePort) =>
        new RemoveStudentFromClassUseCase(persistence),
      inject: [AcademicsPersistencePort],
    },
    {
      provide: HolidayPersistencePort,
      useClass: TypeOrmHolidayPersistenceAdapter,
    },
    {
      provide: ListHolidaysUseCase,
      useFactory: (persistence: HolidayPersistencePort) =>
        new ListHolidaysUseCase(persistence),
      inject: [HolidayPersistencePort],
    },
    {
      provide: GetHolidayDatesUseCase,
      useFactory: (persistence: HolidayPersistencePort) =>
        new GetHolidayDatesUseCase(persistence),
      inject: [HolidayPersistencePort],
    },
    {
      provide: SaveHolidayUseCase,
      useFactory: (persistence: HolidayPersistencePort) =>
        new SaveHolidayUseCase(persistence),
      inject: [HolidayPersistencePort],
    },
    {
      provide: DeleteHolidayUseCase,
      useFactory: (persistence: HolidayPersistencePort) =>
        new DeleteHolidayUseCase(persistence),
      inject: [HolidayPersistencePort],
    },
  ],
})
export class AcademicsModule {}
