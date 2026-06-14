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
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VietQrTransactionSyncDto } from '../../application/dtos/vietqr-callback.dto';
import { Role } from '../../domain/value-objects/role.enum';
import { StudentMonthlyBillOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-monthly-bill.orm-entity';
import { TuitionPaymentLogOrmEntity } from '../../infrastructure/persistence/typeorm/entities/tuition-payment-log.orm-entity';
import { TuitionPaymentRequestOrmEntity } from '../../infrastructure/persistence/typeorm/entities/tuition-payment-request.orm-entity';
import { VietQrCallbackLogOrmEntity } from '../../infrastructure/persistence/typeorm/entities/vietqr-callback-log.orm-entity';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { RolesGuard } from '../../infrastructure/security/roles.guard';

@Controller()
export class VietQrCallbackController {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    @InjectRepository(VietQrCallbackLogOrmEntity)
    private readonly callbackLogRepo: Repository<VietQrCallbackLogOrmEntity>,
    @InjectRepository(TuitionPaymentRequestOrmEntity)
    private readonly paymentRequestRepo: Repository<TuitionPaymentRequestOrmEntity>,
  ) {}

  @Post(['api/token_generate', 'token_generate'])
  @HttpCode(200)
  async generateToken(@Headers('authorization') authorization?: string) {
    const [username, password] = this.parseBasicAuth(authorization);
    const expectedUsername = this.requiredConfig('VIETQR_CALLBACK_USERNAME');
    const expectedPassword = this.requiredConfig('VIETQR_CALLBACK_PASSWORD');

    if (username !== expectedUsername || password !== expectedPassword) {
      throw new UnauthorizedException('Invalid VietQR callback credentials');
    }

    const expiresIn = 300;
    const accessToken = await this.jwtService.signAsync(
      { sub: username, purpose: 'vietqr_callback' },
      {
        secret: this.requiredConfig('VIETQR_CALLBACK_JWT_SECRET'),
        expiresIn,
        algorithm: 'HS512',
      },
    );
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
    };
  }

  @Post('bank/api/transaction-sync')
  @HttpCode(200)
  async transactionSync(
    @Headers('authorization') authorization: string | undefined,
    @Body() rawBody: Record<string, unknown>,
  ) {
    const body = plainToInstance(VietQrTransactionSyncDto, rawBody);
    const auditLog = await this.callbackLogRepo.save(
      this.callbackLogRepo.create({
        transactionId:
          typeof rawBody.transactionid === 'string'
            ? rawBody.transactionid
            : null,
        referenceNumber:
          typeof rawBody.referencenumber === 'string'
            ? rawBody.referencenumber
            : null,
        orderId: typeof rawBody.orderId === 'string' ? rawBody.orderId : null,
        paymentRequestId: null,
        billId: null,
        result: 'received',
        errorReason: null,
        message: 'Đã nhận callback Transaction Sync từ VietQR',
        payload: { ...rawBody },
        processedAt: null,
      }),
    );

    try {
      await this.verifyCallbackToken(authorization);
    } catch (error) {
      await this.rejectAudit(
        auditLog,
        'AUTHORIZATION_FAILED',
        'Callback không có Bearer token hợp lệ',
      );
      throw error;
    }

    const validationErrors = await validate(body, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (validationErrors.length > 0) {
      await this.rejectAudit(
        auditLog,
        'INVALID_REQUEST',
        'Payload Transaction Sync không hợp lệ',
      );
      throw this.callbackError(
        'INVALID_REQUEST',
        'Payload Transaction Sync không hợp lệ',
      );
    }

    let result:
      | { response: ReturnType<VietQrCallbackController['success']> }
      | { errorReason: string; toastMessage: string };
    try {
      result = await this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(TuitionPaymentRequestOrmEntity);
      const billRepo = manager.getRepository(StudentMonthlyBillOrmEntity);
      const logRepo = manager.getRepository(TuitionPaymentLogOrmEntity);
      const auditRepo = manager.getRepository(VietQrCallbackLogOrmEntity);
      const transactionAudit = await auditRepo.findOneByOrFail({
        id: auditLog.id,
      });

      const duplicate = await logRepo.findOne({
        where: { externalTransactionId: body.transactionid },
      });
      if (duplicate) {
        Object.assign(transactionAudit, {
          paymentRequestId: duplicate.paymentRequestId,
          billId: duplicate.billId,
          result: 'duplicate',
          errorReason: null,
          message: 'Callback lặp lại, giao dịch đã được xử lý trước đó',
          processedAt: new Date(),
        });
        await auditRepo.save(transactionAudit);
        return {
          response: this.success(body.transactionid, 'Giao dịch đã được xử lý'),
        };
      }

      const transferReference =
        this.extractTransferReference(body.content) ||
        body.content.trim().toUpperCase();
      const paymentRequestQuery = requestRepo
        .createQueryBuilder('request')
        .setLock('pessimistic_write')
        .where('UPPER(request.transfer_content) = :content', {
          content: transferReference,
        });
      if (this.isUuid(body.orderId)) {
        paymentRequestQuery.orWhere(
          'request.id = :orderId OR request.bill_id = :orderId',
          { orderId: body.orderId },
        );
      }
      const paymentRequest = await paymentRequestQuery.getOne();

      if (!paymentRequest) {
        await this.rejectTransactionAudit(
          auditRepo,
          transactionAudit,
          'PAYMENT_REQUEST_NOT_FOUND',
          'Không tìm thấy yêu cầu thanh toán phù hợp',
        );
        return this.failed(
          'PAYMENT_REQUEST_NOT_FOUND',
          'Không tìm thấy yêu cầu thanh toán phù hợp',
        );
      }
      transactionAudit.paymentRequestId = paymentRequest.id;
      transactionAudit.billId = paymentRequest.billId;
      if (paymentRequest.status === 'reconciled') {
        await this.rejectTransactionAudit(
          auditRepo,
          transactionAudit,
          'PAYMENT_ALREADY_RECONCILED',
          'Yêu cầu thanh toán đã được đối soát bằng giao dịch khác',
        );
        return this.failed(
          'PAYMENT_ALREADY_RECONCILED',
          'Yêu cầu thanh toán đã được đối soát bằng giao dịch khác',
        );
      }
      if (body.transType !== 'C') {
        await this.rejectTransactionAudit(
          auditRepo,
          transactionAudit,
          'INVALID_TRANSACTION_TYPE',
          'Giao dịch không phải giao dịch ghi có',
        );
        return this.failed(
          'INVALID_TRANSACTION_TYPE',
          'Giao dịch không phải giao dịch ghi có',
        );
      }
      if (
        this.normalizeAccount(body.bankaccount) !==
        this.normalizeAccount(paymentRequest.accountNumber)
      ) {
        await this.rejectTransactionAudit(
          auditRepo,
          transactionAudit,
          'BANK_ACCOUNT_MISMATCH',
          'Tài khoản nhận tiền không khớp',
        );
        return this.failed(
          'BANK_ACCOUNT_MISMATCH',
          'Tài khoản nhận tiền không khớp',
        );
      }
      if (Number(paymentRequest.amount) !== Number(body.amount)) {
        await this.rejectTransactionAudit(
          auditRepo,
          transactionAudit,
          'AMOUNT_MISMATCH',
          'Số tiền giao dịch không khớp',
        );
        return this.failed('AMOUNT_MISMATCH', 'Số tiền giao dịch không khớp');
      }
      if (
        body.orderId !== paymentRequest.id &&
        body.orderId !== paymentRequest.billId &&
        !body.content
          .toUpperCase()
          .includes(paymentRequest.transferContent.toUpperCase())
      ) {
        await this.rejectTransactionAudit(
          auditRepo,
          transactionAudit,
          'PAYMENT_REFERENCE_MISMATCH',
          'Mã đơn hàng hoặc nội dung chuyển khoản không khớp',
        );
        return this.failed(
          'PAYMENT_REFERENCE_MISMATCH',
          'Mã đơn hàng hoặc nội dung chuyển khoản không khớp',
        );
      }

      const bill = await billRepo.findOne({ where: { id: paymentRequest.billId } });
      if (!bill) {
        await this.rejectTransactionAudit(
          auditRepo,
          transactionAudit,
          'BILL_NOT_FOUND',
          'Không tìm thấy hóa đơn',
        );
        return this.failed('BILL_NOT_FOUND', 'Không tìm thấy hóa đơn');
      }

      const transactionDate = new Date(body.transactiontime);
      bill.status = 'Paid';
      bill.paidAmount = Number(body.amount);
      bill.paymentDate = transactionDate;
      bill.note = `Đối soát tự động qua VietQR - ${body.referencenumber}`;
      await billRepo.save(bill);

      paymentRequest.status = 'reconciled';
      paymentRequest.reconciledAt = transactionDate;
      await requestRepo.save(paymentRequest);

      await logRepo.save(
        logRepo.create({
          paymentRequestId: paymentRequest.id,
          billId: paymentRequest.billId,
          event: 'auto_reconciled',
          status: 'success',
          amount: Number(body.amount),
          source: 'vietqr_callback',
          externalTransactionId: body.transactionid,
          message: 'Đối soát tự động thành công từ callback VietQR',
          metadata: { ...body },
        }),
      );

      Object.assign(transactionAudit, {
        result: 'success',
        errorReason: null,
        message: 'Callback hợp lệ và đã đối soát thành công',
        processedAt: new Date(),
      });
      await auditRepo.save(transactionAudit);

      return {
        response: this.success(
          body.transactionid,
          'Đối soát giao dịch thành công',
        ),
      };
      });
    } catch (error) {
      await this.rejectAudit(
        auditLog,
        'INTERNAL_PROCESSING_ERROR',
        'Có lỗi nội bộ khi xử lý callback',
      );
      throw error;
    }

    if ('errorReason' in result) {
      throw this.callbackError(result.errorReason, result.toastMessage);
    }
    return result.response;
  }

  @Post('bank/api/demo-terminal/bills/:billId/success')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @HttpCode(200)
  async simulateTerminalSuccess(
    @Request() req: any,
    @Param('billId') billId: string,
  ) {
    if (this.config.get<string>('VIETQR_DEMO_ENABLED') !== 'true') {
      throw new NotFoundException('Chức năng demo terminal chưa được bật');
    }

    const paymentRequest = await this.paymentRequestRepo.findOne({
      where: { billId },
      relations: { bill: { student: true } },
    });
    if (
      !paymentRequest ||
      paymentRequest.bill.student.userId !== req.user.sub
    ) {
      throw new NotFoundException(
        'Chưa có yêu cầu thanh toán cho hóa đơn này',
      );
    }

    const now = Date.now();
    const transactionId = `DEMO-${randomUUID()}`;
    const callbackToken = await this.jwtService.signAsync(
      { sub: 'demo-terminal', purpose: 'vietqr_callback' },
      {
        secret: this.requiredConfig('VIETQR_CALLBACK_JWT_SECRET'),
        expiresIn: 60,
        algorithm: 'HS512',
      },
    );

    return this.transactionSync(`Bearer ${callbackToken}`, {
      bankaccount: paymentRequest.accountNumber,
      amount: Number(paymentRequest.amount),
      transType: 'C',
      content: paymentRequest.transferContent,
      transactionid: transactionId,
      transactiontime: now,
      referencenumber: transactionId,
      orderId: paymentRequest.id,
      terminalCode: 'DAO_EDU_DEMO',
      serviceCode: 'TUITION',
    });
  }

  @Get('bank/api/callback-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async findCallbackLogs(@Query('limit') limit?: string) {
    const parsedLimit = Number(limit || 100);
    const take =
      Number.isInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 500)
        : 100;
    return this.callbackLogRepo.find({
      order: { createdAt: 'DESC' },
      take,
    });
  }

  private parseBasicAuth(authorization?: string): [string, string] {
    if (!authorization?.startsWith('Basic ')) {
      throw new UnauthorizedException('Basic Authorization header is required');
    }
    try {
      const credentials = Buffer.from(authorization.slice(6), 'base64').toString(
        'utf8',
      );
      const separator = credentials.indexOf(':');
      if (separator < 1) throw new Error('Invalid credentials');
      return [
        credentials.slice(0, separator),
        credentials.slice(separator + 1),
      ];
    } catch {
      throw new UnauthorizedException('Invalid Basic Authorization header');
    }
  }

  private async verifyCallbackToken(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token is required');
    }
    try {
      const payload = await this.jwtService.verifyAsync<{
        purpose?: string;
      }>(token, {
        secret: this.requiredConfig('VIETQR_CALLBACK_JWT_SECRET'),
        algorithms: ['HS512'],
      });
      if (payload.purpose !== 'vietqr_callback') throw new Error('Wrong purpose');
    } catch {
      throw new UnauthorizedException('Invalid or expired VietQR callback token');
    }
  }

  private requiredConfig(key: string) {
    const value = this.config.get<string>(key)?.trim();
    if (!value) throw new BadRequestException(`Missing configuration: ${key}`);
    return value;
  }

  private normalizeAccount(value: string) {
    return value.replace(/\s/g, '');
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private extractTransferReference(content: string) {
    return content.toUpperCase().match(/DAOHP[A-Z0-9]{12}/)?.[0] || null;
  }

  private success(reftransactionid: string, toastMessage: string) {
    return {
      error: false,
      errorReason: '',
      toastMessage,
      object: { reftransactionid },
    };
  }

  private callbackError(errorReason: string, toastMessage: string) {
    return new BadRequestException({
      error: true,
      errorReason,
      toastMessage,
      object: null,
    });
  }

  private failed(errorReason: string, toastMessage: string) {
    return { errorReason, toastMessage };
  }

  private async rejectAudit(
    auditLog: VietQrCallbackLogOrmEntity,
    errorReason: string,
    message: string,
  ) {
    Object.assign(auditLog, {
      result: 'rejected',
      errorReason,
      message,
      processedAt: new Date(),
    });
    await this.callbackLogRepo.save(auditLog);
  }

  private async rejectTransactionAudit(
    repository: Repository<VietQrCallbackLogOrmEntity>,
    auditLog: VietQrCallbackLogOrmEntity,
    errorReason: string,
    message: string,
  ) {
    Object.assign(auditLog, {
      result: 'rejected',
      errorReason,
      message,
      processedAt: new Date(),
    });
    await repository.save(auditLog);
  }
}
