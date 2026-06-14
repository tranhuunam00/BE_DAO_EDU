/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../domain/value-objects/role.enum';
import { NotificationOrmEntity } from '../../infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { StudentMonthlyBillOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-monthly-bill.orm-entity';
import { TuitionPaymentRequestOrmEntity } from '../../infrastructure/persistence/typeorm/entities/tuition-payment-request.orm-entity';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { RolesGuard } from '../../infrastructure/security/roles.guard';

@Controller('tuition-payment-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TuitionPaymentRequestController {
  constructor(
    @InjectRepository(TuitionPaymentRequestOrmEntity)
    private readonly paymentRequestRepo: Repository<TuitionPaymentRequestOrmEntity>,
    @InjectRepository(StudentMonthlyBillOrmEntity)
    private readonly billRepo: Repository<StudentMonthlyBillOrmEntity>,
    @InjectRepository(NotificationOrmEntity)
    private readonly notificationRepo: Repository<NotificationOrmEntity>,
    private readonly config: ConfigService,
  ) {}

  @Post('bills/:billId/send')
  @Roles(Role.ADMIN)
  async send(@Param('billId') billId: string) {
    const bill = await this.billRepo.findOne({
      where: { id: billId },
      relations: { student: true, period: true },
    });
    if (!bill) throw new NotFoundException('Không tìm thấy hóa đơn học phí');
    if (bill.status === 'Paid') {
      throw new BadRequestException('Hóa đơn đã được xác nhận thanh toán');
    }
    if (
      Number(bill.totalAmount) <= 0 ||
      !Number.isInteger(Number(bill.totalAmount))
    ) {
      throw new BadRequestException(
        'Số tiền tạo QR phải là số nguyên dương theo đơn vị VND',
      );
    }
    if (!bill.student.userId) {
      throw new BadRequestException(
        'Học sinh chưa có tài khoản đăng nhập để nhận yêu cầu thanh toán',
      );
    }

    const bank = this.getBankConfig();
    const transferContent = `DAOHP${bill.id.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const qrUrl = this.buildQrUrl(
      bank,
      Number(bill.totalAmount),
      transferContent,
    );
    const now = new Date();

    let request = await this.paymentRequestRepo.findOne({ where: { billId } });
    if (request) {
      Object.assign(request, {
        amount: Number(bill.totalAmount),
        ...bank,
        transferContent,
        qrUrl,
        status: 'pending' as const,
        sentAt: now,
      });
    } else {
      request = this.paymentRequestRepo.create({
        billId,
        amount: Number(bill.totalAmount),
        ...bank,
        transferContent,
        qrUrl,
        status: 'pending',
        sentAt: now,
      });
    }
    const saved = await this.paymentRequestRepo.save(request);

    await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: bill.student.userId,
        type: 'tuition_payment_request',
        title: 'Yêu cầu đóng học phí',
        message: `${bill.period?.name || `Học phí tháng ${bill.month}`}: ${Number(bill.totalAmount).toLocaleString('vi-VN')} đ`,
        linkPath: '/student/tuition',
        readAt: null,
      }),
    );

    return saved;
  }

  @Get('bills/:billId')
  @Roles(Role.ADMIN, Role.STUDENT)
  async findForBill(@Request() req: any, @Param('billId') billId: string) {
    const request = await this.paymentRequestRepo.findOne({
      where: { billId },
      relations: { bill: { student: true } },
    });
    if (!request) {
      throw new NotFoundException('Chưa có yêu cầu thanh toán cho hóa đơn này');
    }
    if (
      req.user.role === Role.STUDENT &&
      request.bill.student.userId !== req.user.sub
    ) {
      throw new NotFoundException('Chưa có yêu cầu thanh toán cho hóa đơn này');
    }
    return request;
  }

  private getBankConfig() {
    const bankCode = this.config.get<string>('VIETQR_BANK_CODE')?.trim();
    const accountNumber = this.config
      .get<string>('VIETQR_ACCOUNT_NUMBER')
      ?.trim();
    const accountName = this.config.get<string>('VIETQR_ACCOUNT_NAME')?.trim();

    if (!bankCode || !accountNumber || !accountName) {
      throw new BadRequestException(
        'Chưa cấu hình VIETQR_BANK_CODE, VIETQR_ACCOUNT_NUMBER và VIETQR_ACCOUNT_NAME',
      );
    }
    if (!/^[A-Za-z0-9]{2,20}$/.test(bankCode)) {
      throw new BadRequestException('VIETQR_BANK_CODE không hợp lệ');
    }
    if (!/^\d{1,19}$/.test(accountNumber)) {
      throw new BadRequestException('VIETQR_ACCOUNT_NUMBER không hợp lệ');
    }
    if (accountName.length > 100) {
      throw new BadRequestException('VIETQR_ACCOUNT_NAME quá dài');
    }
    return { bankCode, accountNumber, accountName };
  }

  private buildQrUrl(
    bank: { bankCode: string; accountNumber: string; accountName: string },
    amount: number,
    transferContent: string,
  ) {
    const params = new URLSearchParams({
      amount: String(Math.round(amount)),
      addInfo: transferContent,
      accountName: bank.accountName,
    });
    return `https://img.vietqr.io/image/${encodeURIComponent(bank.bankCode)}-${encodeURIComponent(bank.accountNumber)}-compact2.png?${params.toString()}`;
  }
}
