import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../../domain/value-objects/role.enum';
import { ClaimTuitionTransferUseCase } from '../../modules/payments/application/use-cases/claim-tuition-transfer.use-case';
import { GetTuitionPaymentRequestUseCase } from '../../modules/payments/application/use-cases/get-tuition-payment-request.use-case';
import { SendTuitionPaymentRequestUseCase } from '../../modules/payments/application/use-cases/send-tuition-payment-request.use-case';
import { PaymentError } from '../../modules/payments/domain/errors/payment.error';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { RolesGuard } from '../../infrastructure/security/roles.guard';

@Controller('tuition-payment-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TuitionPaymentRequestController {
  constructor(
    private readonly sendPaymentRequest: SendTuitionPaymentRequestUseCase,
    private readonly claimTransfer: ClaimTuitionTransferUseCase,
    private readonly getPaymentRequest: GetTuitionPaymentRequestUseCase,
  ) {}

  @Post('bills/:billId/send')
  @Roles(Role.ADMIN)
  async send(@Param('billId') billId: string) {
    return this.run(() => this.sendPaymentRequest.execute(billId));
  }

  @Post('bills/:billId/generate-qr')
  @Roles(Role.ADMIN)
  async generateQr(@Param('billId') billId: string) {
    return this.run(() => this.sendPaymentRequest.executeGenerateOnly(billId));
  }

  @Post('bills/:billId/confirm-transfer')
  @Roles(Role.STUDENT)
  async confirmTransfer(@Request() req: any, @Param('billId') billId: string) {
    return this.run(() =>
      this.claimTransfer.execute({
        billId,
        studentUserId: req.user.sub,
      }),
    );
  }

  @Get('bills/:billId')
  @Roles(Role.ADMIN, Role.STUDENT)
  async findForBill(@Request() req: any, @Param('billId') billId: string) {
    return this.run(() =>
      this.getPaymentRequest.execute({
        billId,
        actorRole: req.user.role,
        actorUserId: req.user.sub,
      }),
    );
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (!(error instanceof PaymentError)) throw error;
      if (
        error.code === 'PAYMENT_REQUEST_NOT_FOUND' ||
        error.code === 'BILL_NOT_FOUND'
      ) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }
}
