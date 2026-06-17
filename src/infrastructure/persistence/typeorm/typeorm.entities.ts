import { AssignmentAttachmentOrmEntity } from './entities/assignment-attachment.orm-entity';
import { AssignmentSubmissionOrmEntity } from './entities/assignment-submission.orm-entity';
import { AssignmentOrmEntity } from './entities/assignment.orm-entity';
import { CenterOrmEntity } from './entities/center.orm-entity';
import { ClassScheduleOrmEntity } from './entities/class-schedule.orm-entity';
import { ClassSessionOrmEntity } from './entities/class-session.orm-entity';
import { ClassStudentOrmEntity } from './entities/class-student.orm-entity';
import { ClassOrmEntity } from './entities/class.orm-entity';
import { CourseLevelPricingOrmEntity } from './entities/course-level-pricing.orm-entity';
import { CourseLevelOrmEntity } from './entities/course-level.orm-entity';
import { CourseOrmEntity } from './entities/course.orm-entity';
import { NotificationOrmEntity } from './entities/notification.orm-entity';
import { NotificationLogOrmEntity } from './entities/notification-log.orm-entity';
import { PaymentPeriodOrmEntity } from './entities/payment-period.orm-entity';
import { PermissionOrmEntity } from './entities/permission.orm-entity';
import { RoleOrmEntity } from './entities/role.orm-entity';
import { RoomOrmEntity } from './entities/room.orm-entity';
import { StudentAttendanceOrmEntity } from './entities/student-attendance.orm-entity';
import { StudentMonthlyBillItemOrmEntity } from './entities/student-monthly-bill-item.orm-entity';
import { StudentMonthlyBillOrmEntity } from './entities/student-monthly-bill.orm-entity';
import { StudentOrmEntity } from './entities/student.orm-entity';
import { SubmissionAttachmentOrmEntity } from './entities/submission-attachment.orm-entity';
import { TeacherMonthlyWageItemOrmEntity } from './entities/teacher-monthly-wage-item.orm-entity';
import { TeacherMonthlyWageOrmEntity } from './entities/teacher-monthly-wage.orm-entity';
import { TeacherOrmEntity } from './entities/teacher.orm-entity';
import { TuitionPaymentLogOrmEntity } from './entities/tuition-payment-log.orm-entity';
import { TuitionPaymentRequestOrmEntity } from './entities/tuition-payment-request.orm-entity';
import { UserOrmEntity } from './entities/user.orm-entity';
import { VietQrCallbackLogOrmEntity } from './entities/vietqr-callback-log.orm-entity';
import { LeaveRequestOrmEntity } from './entities/leave-request.orm-entity';
import { BillingAuditLogOrmEntity } from './entities/billing-audit-log.orm-entity';
import { HolidayOrmEntity } from './entities/holiday.orm-entity';
import { ContactRequestOrmEntity } from './entities/contact-request.orm-entity';
import { FacebookLeadItemOrmEntity } from './entities/facebook-lead-item.orm-entity';
import { FacebookLeadScanOrmEntity } from './entities/facebook-lead-scan.orm-entity';
import { LeadOrmEntity } from './entities/lead.orm-entity';
import { LeadDemandOrmEntity } from './entities/lead-demand.orm-entity';
import { LeadInteractionOrmEntity } from './entities/lead-interaction.orm-entity';

export const TYPEORM_ENTITIES = [
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
  HolidayOrmEntity,
  ContactRequestOrmEntity,
  FacebookLeadScanOrmEntity,
  FacebookLeadItemOrmEntity,
  LeadOrmEntity,
  LeadDemandOrmEntity,
  LeadInteractionOrmEntity,
];
