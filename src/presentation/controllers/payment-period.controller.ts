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
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { CourseLevelPricingOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';

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
    @InjectRepository(StudentAttendanceOrmEntity)
    private readonly attendanceRepo: Repository<StudentAttendanceOrmEntity>,
    @InjectRepository(ClassSessionOrmEntity)
    private readonly sessionRepo: Repository<ClassSessionOrmEntity>,
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

  @Get('preview/tuition')
  @ApiOperation({ summary: 'Xem trước danh sách học sinh cần thu học phí (chưa chốt sổ) đến một ngày cụ thể' })
  async previewTuition(@Query('endDate') endDate: string) {
    if (!endDate) throw new BadRequestException('Vui lòng cung cấp endDate');
    
    const pricings = await this.periodRepo.manager.find(CourseLevelPricingOrmEntity);

    const qb = this.attendanceRepo.createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.classSession', 'session')
      .leftJoinAndSelect('session.classEntity', 'classEntity')
      .leftJoinAndSelect('classEntity.course', 'course')
      .leftJoinAndSelect('classEntity.courseLevel', 'courseLevel')
      .leftJoinAndSelect('attendance.student', 'student')
      .where('attendance.billId IS NULL')
      .andWhere('session.date <= :endDateStr', { endDateStr: endDate })
      .andWhere('(session.status = :completedStatus OR session.attendance_locked = :locked)', { completedStatus: 'Completed', locked: true })
      .andWhere('(attendance.isPresent = :present OR (attendance.isPresent = :absent AND (attendance.reason IS NULL OR attendance.reason = \'\' OR TRIM(attendance.reason) = \'\')))', { present: true, absent: false });

    const attendances = await qb.getMany();

    const studentMap = new Map<string, { student: any, attendances: StudentAttendanceOrmEntity[] }>();
    for (const att of attendances) {
      const sId = att.studentId;
      if (!studentMap.has(sId)) {
        studentMap.set(sId, { student: att.student, attendances: [] });
      }
      studentMap.get(sId)!.attendances.push(att);
    }

    const results = [];

    for (const [studentId, data] of studentMap.entries()) {
      const { student, attendances: attList } = data;
      const classMap = new Map<string, { atts: StudentAttendanceOrmEntity[]; classEntity: any }>();
      for (const att of attList) {
        const classId = att.classSession.classId;
        if (!classMap.has(classId)) {
          classMap.set(classId, { atts: [], classEntity: att.classSession.classEntity });
        }
        classMap.get(classId)!.atts.push(att);
      }

      let studentTotalAmount = 0;
      let totalSessions = 0;

      for (const [classId, group] of classMap.entries()) {
        for (const att of group.atts) {
          const dateStr = att.classSession.date;
          const levelId = group.classEntity.courseLevelId;
          const pricing = pricings.find(
            (p) =>
              p.courseLevelId === levelId &&
              p.effectiveFrom <= dateStr &&
              (p.effectiveTo === null || p.effectiveTo >= dateStr)
          );
          const rate = pricing ? Number(pricing.pricePerSession) : 0;
          studentTotalAmount += rate;
          totalSessions++;
        }
      }

      if (studentTotalAmount > 0) {
        results.push({
          studentId: studentId,
          studentCode: student?.studentId || '',
          name: `${student?.lastName || ''} ${student?.firstName || ''}`.trim(),
          nickName: student?.nickName || '',
          mobile: student?.mobile || '',
          status: student?.status || '',
          totalSessions,
          totalAmount: studentTotalAmount,
        });
      }
    }

    const grandTotal = results.reduce((sum, r) => sum + r.totalAmount, 0);
    return { students: results, grandTotal, endDate };
  }

  @Get('preview/salary')
  @ApiOperation({ summary: 'Xem trước danh sách giáo viên cần trả lương (chưa chốt sổ) đến một ngày cụ thể' })
  async previewSalary(@Query('endDate') endDate: string) {
    if (!endDate) throw new BadRequestException('Vui lòng cung cấp endDate');

    const pricings = await this.periodRepo.manager.find(CourseLevelPricingOrmEntity);

    const qb = this.sessionRepo.createQueryBuilder('session')
      .leftJoinAndSelect('session.classEntity', 'classEntity')
      .leftJoinAndSelect('classEntity.course', 'course')
      .leftJoinAndSelect('classEntity.courseLevel', 'courseLevel')
      .leftJoinAndSelect('session.teacher', 'teacher')
      .where('session.wageId IS NULL')
      .andWhere('session.teacherId IS NOT NULL')
      .andWhere('session.date <= :endDateStr', { endDateStr: endDate })
      .andWhere('(session.status = :completedStatus OR session.attendance_locked = :locked)', { completedStatus: 'Completed', locked: true });

    const sessions = await qb.getMany();

    const teacherMap = new Map<string, { teacher: any, sessions: ClassSessionOrmEntity[] }>();
    for (const sess of sessions) {
      const tId = sess.teacherId!;
      if (!teacherMap.has(tId)) {
        teacherMap.set(tId, { teacher: sess.teacher, sessions: [] });
      }
      teacherMap.get(tId)!.sessions.push(sess);
    }

    const results = [];

    for (const [teacherId, data] of teacherMap.entries()) {
      const { teacher, sessions: sessionList } = data;
      
      const classMap = new Map<string, { sessions: ClassSessionOrmEntity[]; classEntity: any }>();
      for (const sess of sessionList) {
        const classId = sess.classId;
        if (!classMap.has(classId)) {
          classMap.set(classId, { sessions: [], classEntity: sess.classEntity });
        }
        classMap.get(classId)!.sessions.push(sess);
      }

      let teacherTotalAmount = 0;
      let totalSessions = 0;

      for (const [classId, group] of classMap.entries()) {
        for (const sess of group.sessions) {
          const dateStr = sess.date;
          const levelId = group.classEntity.courseLevelId;
          const pricing = pricings.find(
            (p) =>
              p.courseLevelId === levelId &&
              p.effectiveFrom <= dateStr &&
              (p.effectiveTo === null || p.effectiveTo >= dateStr)
          );
          const rate = pricing ? Number(pricing.teacherWagePerSession) : 0;
          teacherTotalAmount += rate;
          totalSessions++;
        }
      }

      if (teacherTotalAmount > 0) {
        results.push({
          teacherId: teacherId,
          teacherCode: teacher?.teacherId || '',
          name: `${teacher?.lastName || ''} ${teacher?.firstName || ''}`.trim(),
          mobile: teacher?.mobile || '',
          type: teacher?.type || '',
          status: teacher?.status || '',
          totalSessions,
          totalAmount: teacherTotalAmount,
        });
      }
    }

    const grandTotal = results.reduce((sum, r) => sum + r.totalAmount, 0);
    return { teachers: results, grandTotal, endDate };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo đợt thanh toán mới và tự động chốt đơn hàng bên trong' })
  async create(@Body() body: {
    name: string;
    type: 'tuition' | 'salary';
    month: string;
    startDate: string;
    endDate: string;
    studentIds?: string[];
    teacherIds?: string[];
  }) {
    const { name, type, month, startDate, endDate, studentIds, teacherIds } = body;
    if (!name || !type || !month || !startDate || !endDate) {
      throw new BadRequestException('Vui lòng điền đầy đủ thông tin: name, type, month, startDate, endDate');
    }

    // 1. Save Period
    const period = new PaymentPeriodOrmEntity();
    period.name = name;
    period.type = type;
    period.month = month;
    period.startDate = new Date(startDate);
    period.endDate = new Date(endDate);
    period.status = 'Active';
    const savedPeriod = await this.periodRepo.save(period);

    // Load all level pricing for memory calculation
    const pricings = await this.periodRepo.manager.find(CourseLevelPricingOrmEntity);

    if (type === 'tuition') {
      // 2. Fetch unbilled attendances (isPresent = true OR (isPresent = false and empty reason))
      const qb = this.attendanceRepo.createQueryBuilder('attendance')
        .leftJoinAndSelect('attendance.classSession', 'session')
        .leftJoinAndSelect('session.classEntity', 'classEntity')
        .leftJoinAndSelect('classEntity.course', 'course')
        .leftJoinAndSelect('classEntity.courseLevel', 'courseLevel')
        .leftJoinAndSelect('attendance.student', 'student')
        .where('attendance.billId IS NULL')
        .andWhere('session.date <= :endDateStr', { endDateStr: endDate })
        .andWhere('(session.status = :completedStatus OR session.attendance_locked = :locked)', { completedStatus: 'Completed', locked: true })
        .andWhere('(attendance.isPresent = :present OR (attendance.isPresent = :absent AND (attendance.reason IS NULL OR attendance.reason = \'\' OR TRIM(attendance.reason) = \'\')))', { present: true, absent: false });

      if (studentIds && studentIds.length > 0) {
        qb.andWhere('attendance.studentId IN (:...studentIds)', { studentIds });
      }

      const attendances = await qb.getMany();

      // Group attendances by student
      const studentMap = new Map<string, StudentAttendanceOrmEntity[]>();
      for (const att of attendances) {
        const sId = att.studentId;
        if (!studentMap.has(sId)) {
          studentMap.set(sId, []);
        }
        studentMap.get(sId)!.push(att);
      }

      for (const [studentId, attList] of studentMap.entries()) {
        // Group student attendances by class
        const classMap = new Map<string, { atts: StudentAttendanceOrmEntity[]; classEntity: any }>();
        for (const att of attList) {
          const classId = att.classSession.classId;
          if (!classMap.has(classId)) {
            classMap.set(classId, { atts: [], classEntity: att.classSession.classEntity });
          }
          classMap.get(classId)!.atts.push(att);
        }

        let studentTotalAmount = 0;
        const billItemsData = [];

        for (const [classId, group] of classMap.entries()) {
          for (const att of group.atts) {
            const dateStr = att.classSession.date;
            const levelId = group.classEntity.courseLevelId;
            const pricing = pricings.find(
              (p) =>
                p.courseLevelId === levelId &&
                p.effectiveFrom <= dateStr &&
                (p.effectiveTo === null || p.effectiveTo >= dateStr)
            );
            const rate = pricing ? Number(pricing.pricePerSession) : 0;
            
            const p = dateStr.split('-');
            const dateFormatted = p.length === 3 ? `${p[2]}/${p[1]}` : dateStr;
            const originalName = group.classEntity.className || group.classEntity.name || '';

            billItemsData.push({
              classId,
              className: `${originalName} (Buổi ${dateFormatted})`,
              courseName: group.classEntity.course?.name || '',
              levelName: group.classEntity.courseLevel?.levelName || '',
              sessionsCount: 1,
              rate: rate,
              totalAmount: rate,
            });
            studentTotalAmount += rate;
          }
        }

        if (studentTotalAmount > 0) {
          // Create Student Bill
          const bill = new StudentMonthlyBillOrmEntity();
          bill.studentId = studentId;
          bill.periodId = savedPeriod.id;
          bill.month = month;
          bill.totalAmount = studentTotalAmount;
          bill.paidAmount = 0;
          bill.status = 'Unpaid';
          bill.billingStartDate = savedPeriod.startDate;
          bill.billingEndDate = savedPeriod.endDate;
          const savedBill = await this.studentBillRepo.save(bill);

          // Create Bill Items
          const itemsToSave = billItemsData.map((item) => {
            const dbItem = new StudentMonthlyBillItemOrmEntity();
            dbItem.billId = savedBill.id;
            dbItem.classId = item.classId;
            dbItem.className = item.className;
            dbItem.courseName = item.courseName;
            dbItem.levelName = item.levelName;
            dbItem.sessionsCount = item.sessionsCount;
            dbItem.rate = item.rate;
            dbItem.totalAmount = item.totalAmount;
            return dbItem;
          });
          await this.studentBillItemRepo.save(itemsToSave);

          // Update attendances to point to this bill
          const attIds = attList.map((a) => a.id);
          await this.attendanceRepo.update({ id: In(attIds) }, { billId: savedBill.id });
        }
      }
    } else {
      // Type is salary (Teacher Wages)
      // 2. Fetch unbilled teacher sessions
      const qb = this.sessionRepo.createQueryBuilder('session')
        .leftJoinAndSelect('session.classEntity', 'classEntity')
        .leftJoinAndSelect('classEntity.course', 'course')
        .leftJoinAndSelect('classEntity.courseLevel', 'courseLevel')
        .leftJoinAndSelect('session.teacher', 'teacher')
        .where('session.wageId IS NULL')
        .andWhere('session.teacherId IS NOT NULL')
        .andWhere('session.date <= :endDateStr', { endDateStr: endDate })
        .andWhere('(session.status = :completedStatus OR session.attendance_locked = :locked)', { completedStatus: 'Completed', locked: true });

      if (teacherIds && teacherIds.length > 0) {
        qb.andWhere('session.teacherId IN (:...teacherIds)', { teacherIds });
      }

      const sessions = await qb.getMany();

      // Group sessions by teacher
      const teacherMap = new Map<string, ClassSessionOrmEntity[]>();
      for (const sess of sessions) {
        const tId = sess.teacherId!;
        if (!teacherMap.has(tId)) {
          teacherMap.set(tId, []);
        }
        teacherMap.get(tId)!.push(sess);
      }

      for (const [teacherId, sessionList] of teacherMap.entries()) {
        // Group teacher sessions by class
        const classMap = new Map<string, { sessions: ClassSessionOrmEntity[]; classEntity: any }>();
        for (const sess of sessionList) {
          const classId = sess.classId;
          if (!classMap.has(classId)) {
            classMap.set(classId, { sessions: [], classEntity: sess.classEntity });
          }
          classMap.get(classId)!.sessions.push(sess);
        }

        let teacherTotalAmount = 0;
        const wageItemsData = [];

        for (const [classId, group] of classMap.entries()) {
          for (const sess of group.sessions) {
            const dateStr = sess.date;
            const levelId = group.classEntity.courseLevelId;
            const pricing = pricings.find(
              (p) =>
                p.courseLevelId === levelId &&
                p.effectiveFrom <= dateStr &&
                (p.effectiveTo === null || p.effectiveTo >= dateStr)
            );
            const rate = pricing ? Number(pricing.teacherWagePerSession) : 0;
            
            const p = dateStr.split('-');
            const dateFormatted = p.length === 3 ? `${p[2]}/${p[1]}` : dateStr;
            const originalName = group.classEntity.className || group.classEntity.name || '';

            wageItemsData.push({
              classId,
              className: `${originalName} (Buổi ${dateFormatted})`,
              courseName: group.classEntity.course?.name || '',
              levelName: group.classEntity.courseLevel?.levelName || '',
              sessionsCount: 1,
              rate: rate,
              totalAmount: rate,
            });
            teacherTotalAmount += rate;
          }
        }

        if (teacherTotalAmount > 0) {
          // Create Teacher Wage
          const wage = new TeacherMonthlyWageOrmEntity();
          wage.teacherId = teacherId;
          wage.periodId = savedPeriod.id;
          wage.month = month;
          wage.totalAmount = teacherTotalAmount;
          wage.paidAmount = 0;
          wage.status = 'Unpaid';
          wage.billingStartDate = savedPeriod.startDate;
          wage.billingEndDate = savedPeriod.endDate;
          const savedWage = await this.teacherWageRepo.save(wage);

          // Create Wage Items
          const itemsToSave = wageItemsData.map((item) => {
            const dbItem = new TeacherMonthlyWageItemOrmEntity();
            dbItem.wageId = savedWage.id;
            dbItem.classId = item.classId;
            dbItem.className = item.className;
            dbItem.courseName = item.courseName;
            dbItem.levelName = item.levelName;
            dbItem.sessionsCount = item.sessionsCount;
            dbItem.rate = item.rate;
            dbItem.totalAmount = item.totalAmount;
            return dbItem;
          });
          await this.teacherWageItemRepo.save(itemsToSave);

          // Update sessions to point to this wage
          const sessionIds = sessionList.map((s) => s.id);
          await this.sessionRepo.update({ id: In(sessionIds) }, { wageId: savedWage.id });
        }
      }
    }

    return savedPeriod;
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái của đợt thanh toán (Khóa / Mở)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'Active' | 'Closed' }
  ) {
    const period = await this.periodRepo.findOne({ where: { id } });
    if (!period) {
      throw new NotFoundException('Không tìm thấy đợt thanh toán');
    }

    if (body.status !== 'Active' && body.status !== 'Closed') {
      throw new BadRequestException('Trạng thái không hợp lệ. Chỉ chấp nhận Active hoặc Closed.');
    }

    period.status = body.status;
    return this.periodRepo.save(period);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa đợt thanh toán (Tự động giải phóng các buổi học/điểm danh bên trong)' })
  async remove(@Param('id') id: string) {
    const period = await this.periodRepo.findOne({ where: { id } });
    if (!period) {
      throw new NotFoundException('Không tìm thấy đợt thanh toán');
    }

    // CASCADE delete in studentBills / teacherWages will automatically delete the orders
    // The foreign keys student_attendance.bill_id ON DELETE SET NULL and class_sessions.wage_id ON DELETE SET NULL
    // will set bill_id / wage_id back to null in the database.
    await this.periodRepo.remove(period);

    return { success: true, message: 'Đã xóa đợt thanh toán và giải phóng các buổi học thành công.' };
  }

  @Patch('orders/:type/:orderId')
  @ApiOperation({ summary: 'Cập nhật trạng thái thanh toán của một hóa đơn/lương cụ thể trong đợt' })
  async updateOrderPayment(
    @Param('type') type: 'tuition' | 'salary',
    @Param('orderId') orderId: string,
    @Body() body: {
      status: 'Paid' | 'Unpaid';
      paidAmount: number;
      paymentDate?: string;
      note?: string;
    }
  ) {
    const { status, paidAmount, paymentDate, note } = body;
    if (status !== 'Paid' && status !== 'Unpaid') {
      throw new BadRequestException('Trạng thái thanh toán không hợp lệ');
    }

    if (type === 'tuition') {
      const bill = await this.studentBillRepo.findOne({
        where: { id: orderId },
        relations: { period: true },
      });
      if (!bill) {
        throw new NotFoundException('Không tìm thấy hóa đơn học phí');
      }

      if (bill.period && bill.period.status === 'Closed') {
        throw new BadRequestException('Đợt thanh toán này đã bị Khóa. Không thể chỉnh sửa.');
      }

      bill.status = status;
      bill.paidAmount = paidAmount;
      bill.paymentDate = status === 'Paid' ? (paymentDate ? new Date(paymentDate) : new Date()) : null;
      bill.note = note || null;

      return this.studentBillRepo.save(bill);
    } else {
      const wage = await this.teacherWageRepo.findOne({
        where: { id: orderId },
        relations: { period: true },
      });
      if (!wage) {
        throw new NotFoundException('Không tìm thấy đơn lương giáo viên');
      }

      if (wage.period && wage.period.status === 'Closed') {
        throw new BadRequestException('Đợt thanh toán này đã bị Khóa. Không thể chỉnh sửa.');
      }

      wage.status = status;
      wage.paidAmount = paidAmount;
      wage.paymentDate = status === 'Paid' ? (paymentDate ? new Date(paymentDate) : new Date()) : null;
      wage.note = note || null;

      return this.teacherWageRepo.save(wage);
    }
  }

  @Delete('orders/:type/:orderId')
  @ApiOperation({ summary: 'Loại bỏ một đơn hàng (hóa đơn/lương) khỏi đợt thanh toán' })
  async removeOrder(
    @Param('type') type: 'tuition' | 'salary',
    @Param('orderId') orderId: string
  ) {
    if (type === 'tuition') {
      const bill = await this.studentBillRepo.findOne({
        where: { id: orderId },
        relations: { period: true },
      });
      if (!bill) {
        throw new NotFoundException('Không tìm thấy hóa đơn học phí');
      }
      if (bill.period && bill.period.status === 'Closed') {
        throw new BadRequestException('Đợt thanh toán này đã bị Khóa. Không thể chỉnh sửa.');
      }
      // Delete will trigger ON DELETE SET NULL on student_attendance.bill_id
      await this.studentBillRepo.remove(bill);
    } else {
      const wage = await this.teacherWageRepo.findOne({
        where: { id: orderId },
        relations: { period: true },
      });
      if (!wage) {
        throw new NotFoundException('Không tìm thấy đơn lương giáo viên');
      }
      if (wage.period && wage.period.status === 'Closed') {
        throw new BadRequestException('Đợt thanh toán này đã bị Khóa. Không thể chỉnh sửa.');
      }
      // Delete will trigger ON DELETE SET NULL on class_sessions.wage_id
      await this.teacherWageRepo.remove(wage);
    }

    return { success: true, message: 'Đã loại bỏ đơn hàng khỏi đợt và giải phóng các ca học tương ứng.' };
  }
}
