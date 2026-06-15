import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load variables from .env file
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

import { UserOrmEntity } from './entities/user.orm-entity';
import { StudentOrmEntity } from './entities/student.orm-entity';
import { TeacherOrmEntity } from './entities/teacher.orm-entity';
import { RoleOrmEntity } from './entities/role.orm-entity';
import { PermissionOrmEntity } from './entities/permission.orm-entity';
import { CenterOrmEntity } from './entities/center.orm-entity';
import { RoomOrmEntity } from './entities/room.orm-entity';
import { CourseOrmEntity } from './entities/course.orm-entity';
import { CourseLevelOrmEntity } from './entities/course-level.orm-entity';
import { CourseLevelPricingOrmEntity } from './entities/course-level-pricing.orm-entity';
import { ClassOrmEntity } from './entities/class.orm-entity';
import { ClassScheduleOrmEntity } from './entities/class-schedule.orm-entity';
import { ClassSessionOrmEntity } from './entities/class-session.orm-entity';
import { ClassStudentOrmEntity } from './entities/class-student.orm-entity';
import { StudentAttendanceOrmEntity } from './entities/student-attendance.orm-entity';
import { StudentMonthlyBillOrmEntity } from './entities/student-monthly-bill.orm-entity';
import { TeacherMonthlyWageOrmEntity } from './entities/teacher-monthly-wage.orm-entity';
import { StudentMonthlyBillItemOrmEntity } from './entities/student-monthly-bill-item.orm-entity';
import { TeacherMonthlyWageItemOrmEntity } from './entities/teacher-monthly-wage-item.orm-entity';
import { PaymentPeriodOrmEntity } from './entities/payment-period.orm-entity';
import { AssignmentOrmEntity } from './entities/assignment.orm-entity';
import { AssignmentAttachmentOrmEntity } from './entities/assignment-attachment.orm-entity';
import { AssignmentSubmissionOrmEntity } from './entities/assignment-submission.orm-entity';
import { SubmissionAttachmentOrmEntity } from './entities/submission-attachment.orm-entity';
import { NotificationOrmEntity } from './entities/notification.orm-entity';
import { NotificationLogOrmEntity } from './entities/notification-log.orm-entity';
import { TuitionPaymentRequestOrmEntity } from './entities/tuition-payment-request.orm-entity';
import { TuitionPaymentLogOrmEntity } from './entities/tuition-payment-log.orm-entity';
import { VietQrCallbackLogOrmEntity } from './entities/vietqr-callback-log.orm-entity';
import { LeaveRequestOrmEntity } from './entities/leave-request.orm-entity';
import { BillingAuditLogOrmEntity } from './entities/billing-audit-log.orm-entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5435', 10),
  username: process.env.DATABASE_USER || 'dao_edu_db_admin',
  password: process.env.DATABASE_PASSWORD || 'P@ssw0rd_Edu_Dao_2026_Secure!',
  database: process.env.DATABASE_NAME || 'dao_edu_db',
  entities: [
    UserOrmEntity,
    StudentOrmEntity,
    TeacherOrmEntity,
    RoleOrmEntity,
    PermissionOrmEntity,
    CenterOrmEntity,
    RoomOrmEntity,
    CourseOrmEntity,
    CourseLevelOrmEntity,
    CourseLevelPricingOrmEntity,
    ClassOrmEntity,
    ClassScheduleOrmEntity,
    ClassSessionOrmEntity,
    ClassStudentOrmEntity,
    StudentAttendanceOrmEntity,
    StudentMonthlyBillOrmEntity,
    TeacherMonthlyWageOrmEntity,
    StudentMonthlyBillItemOrmEntity,
    TeacherMonthlyWageItemOrmEntity,
    PaymentPeriodOrmEntity,
    AssignmentOrmEntity,
    AssignmentAttachmentOrmEntity,
    AssignmentSubmissionOrmEntity,
    SubmissionAttachmentOrmEntity,
    NotificationOrmEntity,
    NotificationLogOrmEntity,
    TuitionPaymentRequestOrmEntity,
    TuitionPaymentLogOrmEntity,
    VietQrCallbackLogOrmEntity,
    LeaveRequestOrmEntity,
    BillingAuditLogOrmEntity,
  ],
  migrations: [path.join(__dirname, '/migrations/*.{ts,js}')],
  synchronize: false, // Turn off synchronize when using migrations
});
