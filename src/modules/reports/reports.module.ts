import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ReportsQueryPort } from './application/ports/reports-query.port';
import { GetRevenueReportUseCase } from './application/use-cases/get-revenue-report.use-case';
import { GetSalaryReportUseCase } from './application/use-cases/get-salary-report.use-case';
import { GetAttendanceReportUseCase } from './application/use-cases/get-attendance-report.use-case';
import { GetAssignmentReportUseCase } from './application/use-cases/get-assignment-report.use-case';
import { GetStudentsReportUseCase } from './application/use-cases/get-students-report.use-case';
import { TypeOrmReportsQueryAdapter } from './infrastructure/persistence/typeorm-reports-query.adapter';
import { ReportController } from '../../presentation/controllers/report.controller';

@Module({
  imports: [IdentityModule],
  controllers: [ReportController],
  providers: [
    { provide: ReportsQueryPort, useClass: TypeOrmReportsQueryAdapter },
    {
      provide: GetRevenueReportUseCase,
      useFactory: (q: ReportsQueryPort) => new GetRevenueReportUseCase(q),
      inject: [ReportsQueryPort],
    },
    {
      provide: GetSalaryReportUseCase,
      useFactory: (q: ReportsQueryPort) => new GetSalaryReportUseCase(q),
      inject: [ReportsQueryPort],
    },
    {
      provide: GetAttendanceReportUseCase,
      useFactory: (q: ReportsQueryPort) => new GetAttendanceReportUseCase(q),
      inject: [ReportsQueryPort],
    },
    {
      provide: GetAssignmentReportUseCase,
      useFactory: (q: ReportsQueryPort) => new GetAssignmentReportUseCase(q),
      inject: [ReportsQueryPort],
    },
    {
      provide: GetStudentsReportUseCase,
      useFactory: (q: ReportsQueryPort) => new GetStudentsReportUseCase(q),
      inject: [ReportsQueryPort],
    },
  ],
})
export class ReportsModule {}
