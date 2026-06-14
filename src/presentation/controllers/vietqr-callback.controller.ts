import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../../domain/value-objects/role.enum';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { GenerateVietQrTokenUseCase } from '../../modules/payments/application/use-cases/generate-vietqr-token.use-case';
import { ListVietQrAuditsUseCase } from '../../modules/payments/application/use-cases/list-vietqr-audits.use-case';
import { ProcessVietQrTransactionUseCase } from '../../modules/payments/application/use-cases/process-vietqr-transaction.use-case';
import { SimulateTerminalSuccessUseCase } from '../../modules/payments/application/use-cases/simulate-terminal-success.use-case';
import { PaymentError } from '../../modules/payments/domain/errors/payment.error';

@Controller()
export class VietQrCallbackController {
  constructor(
    private readonly generateToken: GenerateVietQrTokenUseCase,
    private readonly processTransaction: ProcessVietQrTransactionUseCase,
    private readonly simulateTerminal: SimulateTerminalSuccessUseCase,
    private readonly listAudits: ListVietQrAuditsUseCase,
  ) {}

  @Post(['api/token_generate', 'token_generate'])
  @HttpCode(200)
  async token(@Headers('authorization') authorization?: string) {
    return this.generateToken.execute(authorization);
  }

  @Post('bank/api/transaction-sync')
  @HttpCode(200)
  async transactionSync(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      return await this.processTransaction.execute(authorization, body);
    } catch (error) {
      if (!(error instanceof PaymentError)) throw error;
      if (error.code === 'AUTHORIZATION_FAILED') {
        throw new UnauthorizedException(error.message);
      }
      throw new BadRequestException({
        error: true,
        errorReason: error.code,
        toastMessage: error.message,
        object: null,
      });
    }
  }

  @Post('bank/api/demo-terminal/bills/:billId/success')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @HttpCode(200)
  async simulateTerminalSuccess(
    @Request() req: any,
    @Param('billId') billId: string,
  ) {
    try {
      return await this.simulateTerminal.execute({
        billId,
        studentUserId: req.user.sub,
      });
    } catch (error) {
      if (!(error instanceof PaymentError)) throw error;
      if (
        error.code === 'DEMO_DISABLED' ||
        error.code === 'PAYMENT_REQUEST_NOT_FOUND'
      ) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  @Get('bank/api/callback-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findCallbackLogs(@Query('limit') limit?: string) {
    return this.listAudits.execute(limit);
  }
}
