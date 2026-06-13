import { Body, Controller, Get, Param, Patch, Post, Delete, Query, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';

import { PaymentPeriodOrmEntity } from '../../infrastructure/persistence/typeorm/entities/payment-period.orm-entity';
import { StudentMonthlyBillOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-monthly-bill.orm-entity';
import { StudentMonthlyBillItemOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-monthly-bill-item.orm-entity';
import { TeacherMonthlyWageOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher-monthly-wage.orm-entity';
import { TeacherMonthlyWageItemOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher-monthly-wage-item.orm-entity';

import { PreviewTuitionUseCase } from '../../application/use-cases/payment-periods/preview-tuition.use-case';
import { PreviewSalaryUseCase } from '../../application/use-cases/payment-periods/preview-salary.use-case';
import { CreatePaymentPeriodUseCase } from '../../application/use-cases/payment-periods/create-payment-period.use-case';

@ApiTags('Quản lý Đợt Thanh Toán (Payment Periods)')
@ApiBearerAuth()
@Controller('payment-periods')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PaymentPeriodController {
  constructor(
    @InjectRepository(PaymentPeriodOrmEntity)
    private readonly periodRepo: Repository<PaymentPeriodOrmEntity>,
    @InjectRepository(StudentMonthlyBillOrmEntity)
    private readonly studentBillRepo: Repository<StudentMonthlyBillOrmEntity>,
    @InjectRepository(StudentMonthlyBillItemOrmEntity)
    private readonly studentBillItemRepo: Repository<StudentMonthlyBillItemOrmEntity>,
    @InjectRepository(TeacherMonthlyWageOrmEntity)
    private readonly teacherWageRepo: Repository<TeacherMonthlyWageOrmEntity>,
    @InjectRepository(TeacherMonthlyWageItemOrmEntity)
    private readonly teacherWageItemRepo: Repository<TeacherMonthlyWageItemOrmEntity>,
    private readonly previewTuitionUseCase: PreviewTuitionUseCase,
    private readonly previewSalaryUseCase: PreviewSalaryUseCase,
    private readonly createPaymentPeriodUseCase: CreatePaymentPeriodUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả các đợt thanh toán kèm thống kê số liệu' })
  async findAll() {
    const periods = await this.periodRepo.find({
      order: { createdAt: 'DESC' },
    });

    const results = [];
    for (const period of periods) {
      let totalExpected = 0;
      let totalPaid = 0;
      let totalOrders = 0;
      let paidOrders = 0;

      if (period.type === 'tuition') {
        const bills = await this.studentBillRepo.find({
          where: { periodId: period.id },
        });
        totalOrders = bills.length;
        paidOrders = bills.filter((b) => b.status === 'Paid').length;
        totalExpected = bills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
        totalPaid = bills.reduce((sum, b) => sum + Number(b.paidAmount), 0);
      } else {
        const wages = await this.teacherWageRepo.find({
          where: { periodId: period.id },
        });
        totalOrders = wages.length;
        paidOrders = wages.filter((w) => w.status === 'Paid').length;
        totalExpected = wages.reduce((sum, w) => sum + Number(w.totalAmount), 0);
        totalPaid = wages.reduce((sum, w) => sum + Number(w.paidAmount), 0);
      }

      results.push({
        ...period,
        totalExpected,
        totalPaid,
        totalOrders,
        paidOrders,
      });
    }

    return results;
  }

  @Get('preview/tuition')
  @ApiOperation({ summary: 'Xem trước danh sách học sinh cần thu học phí (chưa chốt sổ) đến một ngày cụ thể' })
  async previewTuition(@Query('endDate') endDate: string) {
    if (!endDate) throw new BadRequestException('Vui lòng cung cấp endDate');
    return this.previewTuitionUseCase.execute(endDate.substring(0, 7), endDate);
  }

  @Get('preview/salary')
  @ApiOperation({ summary: 'Xem trước danh sách giáo viên cần trả lương (chưa chốt sổ) đến một ngày cụ thể' })
  async previewSalary(@Query('endDate') endDate: string) {
    if (!endDate) throw new BadRequestException('Vui lòng cung cấp endDate');
    return this.previewSalaryUseCase.execute(endDate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một đợt thanh toán kèm danh sách đơn hàng bên trong' })
  async findOne(@Param('id') id: string) {
    const period = await this.periodRepo.findOne({
      where: { id },
    });
    if (!period) {
      throw new NotFoundException('Không tìm thấy đợt thanh toán');
    }

    const orders = [];
    if (period.type === 'tuition') {
      const bills = await this.studentBillRepo.find({
        where: { periodId: period.id },
        relations: { student: true },
        order: { student: { lastName: 'ASC', firstName: 'ASC' } },
      });

      for (const bill of bills) {
        const items = await this.studentBillItemRepo.find({
          where: { billId: bill.id },
        });
        orders.push({
          id: bill.id,
          studentId: bill.studentId,
          code: bill.student?.studentId || '',
          name: `${bill.student?.lastName || ''} ${bill.student?.firstName || ''}`.trim(),
          nickName: bill.student?.nickName || '',
          mobile: bill.student?.mobile || '',
          totalAmount: Number(bill.totalAmount),
          paidAmount: Number(bill.paidAmount),
          status: bill.status,
          paymentDate: bill.paymentDate,
          note: bill.note,
          items: items.map((item) => ({
            id: item.id,
            classId: item.classId,
            className: item.className,
            courseName: item.courseName,
            levelName: item.levelName,
            sessionsCount: item.sessionsCount,
            rate: Number(item.rate),
            totalAmount: Number(item.totalAmount),
          })),
        });
      }
    } else {
      const wages = await this.teacherWageRepo.find({
        where: { periodId: period.id },
        relations: { teacher: true },
        order: { teacher: { lastName: 'ASC', firstName: 'ASC' } },
      });

      for (const wage of wages) {
        const items = await this.teacherWageItemRepo.find({
          where: { wageId: wage.id },
        });
        orders.push({
          id: wage.id,
          teacherId: wage.teacherId,
          code: wage.teacher?.teacherId || '',
          name: `${wage.teacher?.lastName || ''} ${wage.teacher?.firstName || ''}`.trim(),
          mobile: wage.teacher?.mobile || '',
          type: wage.teacher?.type || '',
          totalAmount: Number(wage.totalAmount),
          paidAmount: Number(wage.paidAmount),
          status: wage.status,
          paymentDate: wage.paymentDate,
          note: wage.note,
          items: items.map((item) => ({
            id: item.id,
            classId: item.classId,
            className: item.className,
            courseName: item.courseName,
            levelName: item.levelName,
            sessionsCount: item.sessionsCount,
            rate: Number(item.rate),
            totalAmount: Number(item.totalAmount),
          })),
        });
      }
    }

    return {
      period,
      orders,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo đợt thanh toán mới và tự động chốt đơn hàng bên trong' })
  async create(@Body() body: any) {
    return this.createPaymentPeriodUseCase.execute(body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái của đợt thanh toán' })
  async updatePeriodStatus(
    @Param('id') id: string,
    @Body('status') status: 'Active' | 'Closed'
  ) {
    const period = await this.periodRepo.findOne({ where: { id } });
    if (!period) throw new NotFoundException('Không tìm thấy đợt thanh toán');

    period.status = status;
    await this.periodRepo.save(period);
    return { message: 'Cập nhật trạng thái thành công' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa đợt thanh toán và các đơn hàng liên quan' })
  async deletePeriod(@Param('id') id: string) {
    const period = await this.periodRepo.findOne({ where: { id } });
    if (!period) throw new NotFoundException('Không tìm thấy đợt thanh toán');

    if (period.type === 'tuition') {
      const bills = await this.studentBillRepo.find({ where: { periodId: period.id } });
      const billIds = bills.map((b) => b.id);
      
      if (billIds.length > 0) {
        await this.studentBillItemRepo.delete({ billId: In(billIds) });
        await this.studentBillRepo.delete({ id: In(billIds) });
      }
    } else {
      const wages = await this.teacherWageRepo.find({ where: { periodId: period.id } });
      const wageIds = wages.map((w) => w.id);
      
      if (wageIds.length > 0) {
        await this.teacherWageItemRepo.delete({ wageId: In(wageIds) });
        await this.teacherWageRepo.delete({ id: In(wageIds) });
      }
    }

    await this.periodRepo.delete(id);
    return { message: 'Xóa đợt thanh toán thành công' };
  }

  @Patch('orders/:type/:orderId')
  @ApiOperation({ summary: 'Cập nhật trạng thái thanh toán của 1 đơn hàng cụ thể' })
  async updateOrderStatus(
    @Param('type') type: 'tuition' | 'salary',
    @Param('orderId') orderId: string,
    @Body('status') status: 'Paid' | 'Unpaid',
    @Body('paidAmount') paidAmount?: number,
    @Body('note') note?: string,
  ) {
    if (type === 'tuition') {
      const bill = await this.studentBillRepo.findOne({ where: { id: orderId } });
      if (!bill) throw new NotFoundException('Không tìm thấy đơn hàng học sinh');
      
      bill.status = status;
      if (status === 'Paid') {
        bill.paidAmount = paidAmount !== undefined ? paidAmount : bill.totalAmount;
        bill.paymentDate = new Date();
      } else {
        bill.paidAmount = 0;
        bill.paymentDate = null;
      }
      if (note !== undefined) bill.note = note;
      
      await this.studentBillRepo.save(bill);
    } else {
      const wage = await this.teacherWageRepo.findOne({ where: { id: orderId } });
      if (!wage) throw new NotFoundException('Không tìm thấy bảng lương giáo viên');
      
      wage.status = status;
      if (status === 'Paid') {
        wage.paidAmount = paidAmount !== undefined ? paidAmount : wage.totalAmount;
        wage.paymentDate = new Date();
      } else {
        wage.paidAmount = 0;
        wage.paymentDate = null;
      }
      if (note !== undefined) wage.note = note;
      
      await this.teacherWageRepo.save(wage);
    }

    return { message: 'Cập nhật trạng thái đơn hàng thành công' };
  }

  @Delete('orders/:type/:orderId')
  @ApiOperation({ summary: 'Xóa 1 đơn hàng cụ thể (bỏ khỏi đợt thu)' })
  async deleteOrder(
    @Param('type') type: 'tuition' | 'salary',
    @Param('orderId') orderId: string
  ) {
    if (type === 'tuition') {
      await this.studentBillItemRepo.delete({ billId: orderId });
      await this.studentBillRepo.delete({ id: orderId });
    } else {
      await this.teacherWageItemRepo.delete({ wageId: orderId });
      await this.teacherWageRepo.delete({ id: orderId });
    }
    return { message: 'Đã xóa đơn hàng thành công' };
  }
}
