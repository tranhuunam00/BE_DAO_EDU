import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationOrmEntity } from '../../infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { StudentMonthlyBillOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-monthly-bill.orm-entity';
import { TuitionPaymentLogOrmEntity } from '../../infrastructure/persistence/typeorm/entities/tuition-payment-log.orm-entity';
import { TuitionPaymentRequestOrmEntity } from '../../infrastructure/persistence/typeorm/entities/tuition-payment-request.orm-entity';
import { VietQrCallbackLogOrmEntity } from '../../infrastructure/persistence/typeorm/entities/vietqr-callback-log.orm-entity';
import { TuitionPaymentRequestController } from '../../presentation/controllers/tuition-payment-request.controller';
import { VietQrCallbackController } from '../../presentation/controllers/vietqr-callback.controller';
import { PaymentPersistencePort } from './application/ports/payment-persistence.port';
import {
  PaymentConfigPort,
  PaymentIdPort,
  PaymentQrCodePort,
  VietQrTokenPort,
} from './application/ports/payment-services.port';
import { ClaimTuitionTransferUseCase } from './application/use-cases/claim-tuition-transfer.use-case';
import { GenerateVietQrTokenUseCase } from './application/use-cases/generate-vietqr-token.use-case';
import { GetTuitionPaymentRequestUseCase } from './application/use-cases/get-tuition-payment-request.use-case';
import { ListVietQrAuditsUseCase } from './application/use-cases/list-vietqr-audits.use-case';
import { ProcessVietQrTransactionUseCase } from './application/use-cases/process-vietqr-transaction.use-case';
import { SendTuitionPaymentRequestUseCase } from './application/use-cases/send-tuition-payment-request.use-case';
import { SimulateTerminalSuccessUseCase } from './application/use-cases/simulate-terminal-success.use-case';
import { TypeOrmPaymentPersistenceAdapter } from './infrastructure/persistence/typeorm-payment-persistence.adapter';
import { PaymentConfigAdapter } from './infrastructure/services/payment-config.adapter';
import { PaymentIdAdapter } from './infrastructure/services/payment-id.adapter';
import { VietQrQrCodeAdapter } from './infrastructure/services/vietqr-qr-code.adapter';
import { VietQrTokenAdapter } from './infrastructure/services/vietqr-token.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentMonthlyBillOrmEntity,
      NotificationOrmEntity,
      TuitionPaymentRequestOrmEntity,
      TuitionPaymentLogOrmEntity,
      VietQrCallbackLogOrmEntity,
    ]),
  ],
  controllers: [TuitionPaymentRequestController, VietQrCallbackController],
  providers: [
    {
      provide: PaymentPersistencePort,
      useClass: TypeOrmPaymentPersistenceAdapter,
    },
    { provide: PaymentConfigPort, useClass: PaymentConfigAdapter },
    { provide: PaymentQrCodePort, useClass: VietQrQrCodeAdapter },
    { provide: VietQrTokenPort, useClass: VietQrTokenAdapter },
    { provide: PaymentIdPort, useClass: PaymentIdAdapter },
    {
      provide: SendTuitionPaymentRequestUseCase,
      useFactory: (
        persistence: PaymentPersistencePort,
        config: PaymentConfigPort,
        qrCode: PaymentQrCodePort,
      ) => new SendTuitionPaymentRequestUseCase(persistence, config, qrCode),
      inject: [PaymentPersistencePort, PaymentConfigPort, PaymentQrCodePort],
    },
    {
      provide: ClaimTuitionTransferUseCase,
      useFactory: (persistence: PaymentPersistencePort) =>
        new ClaimTuitionTransferUseCase(persistence),
      inject: [PaymentPersistencePort],
    },
    {
      provide: GetTuitionPaymentRequestUseCase,
      useFactory: (persistence: PaymentPersistencePort) =>
        new GetTuitionPaymentRequestUseCase(persistence),
      inject: [PaymentPersistencePort],
    },
    {
      provide: GenerateVietQrTokenUseCase,
      useFactory: (tokens: VietQrTokenPort) =>
        new GenerateVietQrTokenUseCase(tokens),
      inject: [VietQrTokenPort],
    },
    {
      provide: ProcessVietQrTransactionUseCase,
      useFactory: (
        persistence: PaymentPersistencePort,
        tokens: VietQrTokenPort,
      ) => new ProcessVietQrTransactionUseCase(persistence, tokens),
      inject: [PaymentPersistencePort, VietQrTokenPort],
    },
    {
      provide: SimulateTerminalSuccessUseCase,
      useFactory: (
        persistence: PaymentPersistencePort,
        config: PaymentConfigPort,
        tokens: VietQrTokenPort,
        ids: PaymentIdPort,
        process: ProcessVietQrTransactionUseCase,
      ) =>
        new SimulateTerminalSuccessUseCase(
          persistence,
          config,
          tokens,
          ids,
          process,
        ),
      inject: [
        PaymentPersistencePort,
        PaymentConfigPort,
        VietQrTokenPort,
        PaymentIdPort,
        ProcessVietQrTransactionUseCase,
      ],
    },
    {
      provide: ListVietQrAuditsUseCase,
      useFactory: (persistence: PaymentPersistencePort) =>
        new ListVietQrAuditsUseCase(persistence),
      inject: [PaymentPersistencePort],
    },
  ],
  exports: [SendTuitionPaymentRequestUseCase],
})
export class PaymentsModule {}
