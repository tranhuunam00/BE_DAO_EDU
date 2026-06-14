import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { CourseLevelPricingOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';
import { PaymentPeriodOrmEntity } from '../../infrastructure/persistence/typeorm/entities/payment-period.orm-entity';
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { StudentMonthlyBillItemOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-monthly-bill-item.orm-entity';
import { StudentMonthlyBillOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-monthly-bill.orm-entity';
import { TeacherMonthlyWageItemOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher-monthly-wage-item.orm-entity';
import { TeacherMonthlyWageOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher-monthly-wage.orm-entity';
import { TuitionPaymentRequestOrmEntity } from '../../infrastructure/persistence/typeorm/entities/tuition-payment-request.orm-entity';
import { PaymentPeriodController } from '../../presentation/controllers/payment-period.controller';
import { BillingPersistencePort } from './application/ports/billing-persistence.port';
import { CreatePaymentPeriodUseCase } from './application/use-cases/create-payment-period.use-case';
import {
  DeleteBillingOrderUseCase,
  DeletePaymentPeriodUseCase,
  GetPaymentPeriodUseCase,
  ListPaymentPeriodsUseCase,
  UpdateBillingOrderUseCase,
  UpdatePaymentPeriodStatusUseCase,
} from './application/use-cases/manage-payment-period.use-cases';
import {
  PreviewSalaryUseCase,
  PreviewTuitionUseCase,
} from './application/use-cases/preview-billing.use-case';
import { TypeOrmBillingPersistenceAdapter } from './infrastructure/persistence/typeorm-billing-persistence.adapter';

const useCases = [
  PreviewTuitionUseCase,
  PreviewSalaryUseCase,
  CreatePaymentPeriodUseCase,
  ListPaymentPeriodsUseCase,
  GetPaymentPeriodUseCase,
  UpdatePaymentPeriodStatusUseCase,
  DeletePaymentPeriodUseCase,
  UpdateBillingOrderUseCase,
  DeleteBillingOrderUseCase,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentPeriodOrmEntity,
      StudentMonthlyBillOrmEntity,
      StudentMonthlyBillItemOrmEntity,
      TeacherMonthlyWageOrmEntity,
      TeacherMonthlyWageItemOrmEntity,
      StudentAttendanceOrmEntity,
      ClassSessionOrmEntity,
      CourseLevelPricingOrmEntity,
      TuitionPaymentRequestOrmEntity,
    ]),
  ],
  controllers: [PaymentPeriodController],
  providers: [
    {
      provide: BillingPersistencePort,
      useClass: TypeOrmBillingPersistenceAdapter,
    },
    ...useCases.map((useCase) => ({
      provide: useCase,
      useFactory: (persistence: BillingPersistencePort) =>
        new useCase(persistence),
      inject: [BillingPersistencePort],
    })),
  ],
})
export class BillingModule {}
