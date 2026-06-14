import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../domain/value-objects/role.enum';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { CreatePaymentPeriodUseCase } from '../../modules/billing/application/use-cases/create-payment-period.use-case';
import {
  DeleteBillingOrderUseCase,
  DeletePaymentPeriodUseCase,
  GetPaymentPeriodUseCase,
  ListPaymentPeriodsUseCase,
  UpdateBillingOrderUseCase,
  UpdatePaymentPeriodStatusUseCase,
} from '../../modules/billing/application/use-cases/manage-payment-period.use-cases';
import {
  PreviewSalaryUseCase,
  PreviewTuitionUseCase,
} from '../../modules/billing/application/use-cases/preview-billing.use-case';
import { BillingError } from '../../modules/billing/domain/errors/billing.error';

@ApiTags('Quản lý Đợt Thanh Toán (Payment Periods)')
@ApiBearerAuth()
@Controller('payment-periods')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PaymentPeriodController {
  constructor(
    private readonly listPeriods: ListPaymentPeriodsUseCase,
    private readonly getPeriod: GetPaymentPeriodUseCase,
    private readonly previewTuitionUseCase: PreviewTuitionUseCase,
    private readonly previewSalaryUseCase: PreviewSalaryUseCase,
    private readonly createPeriod: CreatePaymentPeriodUseCase,
    private readonly updatePeriodStatus: UpdatePaymentPeriodStatusUseCase,
    private readonly deletePeriodUseCase: DeletePaymentPeriodUseCase,
    private readonly updateOrder: UpdateBillingOrderUseCase,
    private readonly deleteOrderUseCase: DeleteBillingOrderUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách đợt thanh toán kèm thống kê' })
  findAll() {
    return this.run(() => this.listPeriods.execute());
  }

  @Get('preview/tuition')
  @ApiOperation({ summary: 'Xem trước danh sách học sinh cần thu học phí' })
  previewTuition(@Query('endDate') endDate: string) {
    return this.run(() =>
      this.previewTuitionUseCase.execute(endDate?.slice(0, 7), endDate),
    );
  }

  @Get('preview/salary')
  @ApiOperation({ summary: 'Xem trước danh sách giáo viên cần trả lương' })
  previewSalary(@Query('endDate') endDate: string) {
    return this.run(() => this.previewSalaryUseCase.execute(endDate));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết đợt thanh toán và các đơn bên trong' })
  findOne(@Param('id') id: string) {
    return this.run(() => this.getPeriod.execute(id));
  }

  @Post()
  @ApiOperation({ summary: 'Tạo đợt thanh toán và chốt các đơn bên trong' })
  create(@Body() body: any) {
    return this.run(() => this.createPeriod.execute(body));
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái đợt thanh toán' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'Active' | 'Closed',
  ) {
    return this.run(() => this.updatePeriodStatus.execute(id, status));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa đợt thanh toán và các đơn liên quan' })
  deletePeriod(@Param('id') id: string) {
    return this.run(() => this.deletePeriodUseCase.execute(id));
  }

  @Patch('orders/:type/:orderId')
  @ApiOperation({ summary: 'Cập nhật trạng thái thanh toán của một đơn' })
  updateOrderStatus(
    @Param('type') type: 'tuition' | 'salary',
    @Param('orderId') orderId: string,
    @Body('status') status: 'Paid' | 'Unpaid',
    @Body('paidAmount') paidAmount?: number,
    @Body('note') note?: string,
  ) {
    return this.run(() =>
      this.updateOrder.execute({ type, orderId, status, paidAmount, note }),
    );
  }

  @Delete('orders/:type/:orderId')
  @ApiOperation({ summary: 'Xóa một đơn khỏi đợt thanh toán' })
  deleteOrder(
    @Param('type') type: 'tuition' | 'salary',
    @Param('orderId') orderId: string,
  ) {
    return this.run(() => this.deleteOrderUseCase.execute(type, orderId));
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (!(error instanceof BillingError)) throw error;
      if (
        error.code === 'PERIOD_NOT_FOUND' ||
        error.code === 'ORDER_NOT_FOUND'
      ) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }
}
