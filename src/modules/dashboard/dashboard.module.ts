import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GetDashboardActivitiesUseCase } from '../../application/use-cases/dashboard/get-dashboard-activities.use-case';
import { GetDashboardRevenueUseCase } from '../../application/use-cases/dashboard/get-dashboard-revenue.use-case';
import { GetDashboardSummaryUseCase } from '../../application/use-cases/dashboard/get-dashboard-summary.use-case';
import { CenterOrmEntity } from '../../infrastructure/persistence/typeorm/entities/center.orm-entity';
import { ClassScheduleOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-schedule.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { ClassStudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { ClassOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { CourseOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course.orm-entity';
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { StudentMonthlyBillOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-monthly-bill.orm-entity';
import { StudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { TeacherMonthlyWageOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher-monthly-wage.orm-entity';
import { TeacherOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { DashboardController } from '../../presentation/controllers/dashboard.controller';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [
    IdentityModule,
    TypeOrmModule.forFeature([
      StudentOrmEntity,
      TeacherOrmEntity,
      ClassStudentOrmEntity,
      ClassOrmEntity,
      ClassScheduleOrmEntity,
      ClassSessionOrmEntity,
      StudentAttendanceOrmEntity,
      TeacherMonthlyWageOrmEntity,
      StudentMonthlyBillOrmEntity,
      CourseOrmEntity,
      CenterOrmEntity,
    ]),
  ],
  controllers: [DashboardController],
  providers: [
    GetDashboardSummaryUseCase,
    GetDashboardRevenueUseCase,
    GetDashboardActivitiesUseCase,
  ],
})
export class DashboardModule {}
