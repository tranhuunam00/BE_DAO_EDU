import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AcademicsModule } from './modules/academics/academics.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { BillingModule } from './modules/billing/billing.module';
import { CentersModule } from './modules/centers/centers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { IdentityModule } from './modules/identity/identity.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { StudentsModule } from './modules/students/students.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { LeaveRequestsModule } from './modules/leave-requests/leave-requests.module';
import { ContactRequestsModule } from './modules/contact-requests/contact-requests.module';

@Module({
  imports: [
    InfrastructureModule,
    IdentityModule,
    StudentsModule,
    TeachersModule,
    CentersModule,
    AcademicsModule,
    AssignmentsModule,
    NotificationsModule,
    DashboardModule,
    BillingModule,
    PaymentsModule,
    LeaveRequestsModule,
    ContactRequestsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
