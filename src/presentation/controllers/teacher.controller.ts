import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { CourseLevelPricingOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';
import { TeacherOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { TeacherMonthlyWageOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher-monthly-wage.orm-entity';
import { TeacherMonthlyWageItemOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher-monthly-wage-item.orm-entity';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';
import { SessionStatus } from '../../domain/value-objects/session-status.enum';
import { AddTeacherUseCase } from '../../application/use-cases/add-teacher.use-case';
import { GetTeachersUseCase } from '../../application/use-cases/get-teachers.use-case';
import { GetTeacherByIdUseCase } from '../../application/use-cases/get-teacher-by-id.use-case';
import { UpdateTeacherUseCase } from '../../application/use-cases/update-teacher.use-case';
import { CreateTeacherDto, UpdateTeacherDto } from '../../application/dtos/teacher.dto';

@ApiTags('Giáo viên (Teachers)')
@ApiBearerAuth()
@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherController {
  constructor(
    private readonly addTeacherUseCase: AddTeacherUseCase,
    private readonly getTeachersUseCase: GetTeachersUseCase,
    private readonly getTeacherByIdUseCase: GetTeacherByIdUseCase,
    private readonly updateTeacherUseCase: UpdateTeacherUseCase,
    @InjectRepository(ClassSessionOrmEntity)
    private readonly sessionRepo: Repository<ClassSessionOrmEntity>,
    @InjectRepository(TeacherOrmEntity)
    private readonly teacherRepo: Repository<TeacherOrmEntity>,
    @InjectRepository(TeacherMonthlyWageOrmEntity)
    private readonly monthlyWageRepo: Repository<TeacherMonthlyWageOrmEntity>,
    @InjectRepository(TeacherMonthlyWageItemOrmEntity)
    private readonly monthlyWageItemRepo: Repository<TeacherMonthlyWageItemOrmEntity>,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Tạo mới hồ sơ giáo viên (Chỉ dành cho ADMIN)' })
  @ApiResponse({ status: 201, description: 'Tạo giáo viên mới thành công' })
  async create(@Body() dto: CreateTeacherDto) {
    return this.addTeacherUseCase.execute(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách tất cả giáo viên có phân trang và bộ lọc (Dành cho ADMIN)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'province', required: false })
  @ApiQuery({ name: 'type', required: false })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('province') province?: string,
    @Query('type') type?: string,
  ) {
    return this.getTeachersUseCase.execute({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status,
      province,
      type,
    });
  }

  @Get('wages-bulk')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Tính lương cho tất cả giáo viên trong khoảng thời gian (Kế Toán)' })
  async getWagesBulk(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const teachers = await this.teacherRepo.find({ order: { lastName: 'ASC', firstName: 'ASC' } });
    const results: any[] = [];

    for (const teacher of teachers) {
      const sessions = await this.sessionRepo
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.classEntity', 'classEntity')
        .leftJoinAndSelect('classEntity.course', 'course')
        .leftJoinAndSelect('classEntity.courseLevel', 'courseLevel')
        .where('session.teacher_id = :teacherId', { teacherId: teacher.id })
        .andWhere('session.date >= :startDate', { startDate })
        .andWhere('session.date <= :endDate', { endDate })
        .andWhere('(session.status = :s OR session.attendance_locked = :l)', { s: SessionStatus.COMPLETED, l: true })
        .getMany();

      const levelIds = Array.from(new Set(sessions.map(s => s.classEntity.courseLevelId)));
      let pricingList: CourseLevelPricingOrmEntity[] = [];
      if (levelIds.length > 0) {
        pricingList = await this.sessionRepo.manager.find(CourseLevelPricingOrmEntity, { where: { courseLevelId: In(levelIds) } });
      }

      let totalAmount = 0;
      for (const session of sessions) {
        const date = session.date;
        const levelId = session.classEntity.courseLevelId;
        const pricing = pricingList.find(p => p.courseLevelId === levelId && p.effectiveFrom <= date && (p.effectiveTo === null || p.effectiveTo >= date));
        const rate = pricing ? Number(pricing.teacherWagePerSession) : 0;
        totalAmount += rate;
      }

      results.push({
        teacherId: teacher.id,
        teacherCode: teacher.teacherId,
        name: `${teacher.lastName} ${teacher.firstName}`,
        mobile: teacher.mobile,
        type: teacher.type,
        status: teacher.status,
        totalSessions: sessions.length,
        totalAmount,
      });
    }

    const grandTotal = results.reduce((sum, r) => sum + r.totalAmount, 0);
    return { teachers: results, grandTotal, startDate, endDate };
  }

  private async calculateTeacherWageItems(
    teacherId: string,
    startDate: string,
    endDate: string,
  ) {
    const sessions = await this.sessionRepo
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.classEntity', 'classEntity')
      .leftJoinAndSelect('classEntity.course', 'course')
      .leftJoinAndSelect('classEntity.courseLevel', 'courseLevel')
      .where('session.teacher_id = :teacherId', { teacherId })
      .andWhere('session.date >= :startDate', { startDate })
      .andWhere('session.date <= :endDate', { endDate })
      .andWhere('(session.status = :s OR session.attendance_locked = :l)', { s: SessionStatus.COMPLETED, l: true })
      .getMany();

    if (sessions.length === 0) {
      return { items: [], totalAmount: 0 };
    }

    const levelIds = Array.from(new Set(sessions.map(s => s.classEntity.courseLevelId)));
    let pricingList: CourseLevelPricingOrmEntity[] = [];
    if (levelIds.length > 0) {
      pricingList = await this.sessionRepo.manager.find(CourseLevelPricingOrmEntity, {
        where: { courseLevelId: In(levelIds) },
      });
    }

    // Group sessions by class
    const classSessionMap = new Map<string, { sessions: any[]; classEntity: any }>();
    for (const session of sessions) {
      const classId = session.classId;
      if (!classSessionMap.has(classId)) {
        classSessionMap.set(classId, { sessions: [], classEntity: session.classEntity });
      }
      classSessionMap.get(classId)!.sessions.push(session);
    }

    const items: any[] = [];
    let grandTotal = 0;

    for (const [classId, group] of classSessionMap.entries()) {
      let classTotalAmount = 0;
      let latestRate = 0;
      let latestDate = '';

      for (const session of group.sessions) {
        const date = session.date;
        const levelId = group.classEntity.courseLevelId;
        const pricing = pricingList.find(
          p =>
            p.courseLevelId === levelId &&
            p.effectiveFrom <= date &&
            (p.effectiveTo === null || p.effectiveTo >= date),
        );
        const rate = pricing ? Number(pricing.teacherWagePerSession) : 0;
        classTotalAmount += rate;

        if (!latestDate || date > latestDate) {
          latestDate = date;
          latestRate = rate;
        }
      }

      if (group.sessions.length > 0) {
        items.push({
          classId,
          className: group.classEntity.name,
          courseName: group.classEntity.course?.name || '',
          levelName: group.classEntity.courseLevel?.name || '',
          sessionsCount: group.sessions.length,
          rate: latestRate,
          totalAmount: classTotalAmount,
        });
        grandTotal += classTotalAmount;
      }
    }

    return { items, totalAmount: grandTotal };
  }

  @Get('monthly-wages')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách thanh toán lương giáo viên theo tháng (Kế Toán)' })
  async getMonthlyWages(@Query('month') month: string) {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('Tháng không hợp lệ. Định dạng yêu cầu là YYYY-MM');
    }

    const teachers = await this.teacherRepo.find({ order: { lastName: 'ASC', firstName: 'ASC' } });
    const savedWages = await this.monthlyWageRepo.find({ where: { month } });
    const savedWagesMap = new Map(savedWages.map(w => [w.teacherId, w]));

    let waveStartDate: Date;
    let waveEndDate: Date;

    if (savedWages.length > 0 && savedWages[0].billingStartDate && savedWages[0].billingEndDate) {
      waveStartDate = savedWages[0].billingStartDate;
      waveEndDate = savedWages[0].billingEndDate;
    } else {
      const today = new Date();
      const todayMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const [qYear, qMonth] = month.split('-').map(Number);
      const lastDay = new Date(qYear, qMonth, 0).getDate();
      const lastDayStr = `${qYear}-${String(qMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const computedEndDateStr = month === todayMonthStr
        ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        : lastDayStr;

      waveEndDate = new Date(computedEndDateStr);

      const latestWage = await this.monthlyWageRepo
        .createQueryBuilder('wage')
        .where('wage.billingEndDate < :waveEndDate', { waveEndDate })
        .orderBy('wage.billingEndDate', 'DESC')
        .getOne();

      if (latestWage && latestWage.billingEndDate) {
        const nextDay = new Date(latestWage.billingEndDate);
        nextDay.setDate(nextDay.getDate() + 1);
        waveStartDate = nextDay;
      } else {
        waveStartDate = new Date(`${qYear}-${String(qMonth).padStart(2, '0')}-01`);
      }
    }

    const waveStartDateStr = `${waveStartDate.getFullYear()}-${String(waveStartDate.getMonth() + 1).padStart(2, '0')}-${String(waveStartDate.getDate()).padStart(2, '0')}`;
    const waveEndDateStr = `${waveEndDate.getFullYear()}-${String(waveEndDate.getMonth() + 1).padStart(2, '0')}-${String(waveEndDate.getDate()).padStart(2, '0')}`;

    const results: any[] = [];

    for (const teacher of teachers) {
      const savedWage = savedWagesMap.get(teacher.id);

      if (savedWage) {
        const savedItems = await this.monthlyWageItemRepo.find({ where: { wageId: savedWage.id } });
        results.push({
          id: savedWage.id,
          teacherId: teacher.id,
          teacherCode: teacher.teacherId,
          name: `${teacher.lastName} ${teacher.firstName}`,
          mobile: teacher.mobile,
          type: teacher.type,
          status: teacher.status,
          totalAmount: Number(savedWage.totalAmount),
          paidAmount: Number(savedWage.paidAmount),
          paymentStatus: savedWage.status,
          paymentDate: savedWage.paymentDate,
          billingStartDate: savedWage.billingStartDate,
          billingEndDate: savedWage.billingEndDate,
          note: savedWage.note,
          isDraft: false,
          items: savedItems.map(item => ({
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
      } else {
        const { items, totalAmount } = await this.calculateTeacherWageItems(
          teacher.id,
          waveStartDateStr,
          waveEndDateStr,
        );

        results.push({
          id: null,
          teacherId: teacher.id,
          teacherCode: teacher.teacherId,
          name: `${teacher.lastName} ${teacher.firstName}`,
          mobile: teacher.mobile,
          type: teacher.type,
          status: teacher.status,
          totalAmount,
          paidAmount: 0,
          paymentStatus: 'Unpaid',
          paymentDate: null,
          billingStartDate: waveStartDate,
          billingEndDate: waveEndDate,
          note: '',
          isDraft: true,
          items,
        });
      }
    }

    return results;
  }

  @Post('monthly-wages/pay')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cập nhật tình trạng trả lương tháng của giáo viên (Kế Toán)' })
  async payMonthlyWage(@Body() body: {
    teacherId: string;
    month: string;
    totalAmount: number;
    paidAmount: number;
    status: string;
    note?: string;
    paymentDate?: string;
    billingStartDate?: string;
    billingEndDate?: string;
  }) {
    const { teacherId, month, totalAmount, paidAmount, status, note, paymentDate, billingStartDate, billingEndDate } = body;
    if (!teacherId || !month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('Dữ liệu không hợp lệ. Yêu cầu teacherId và month (YYYY-MM)');
    }

    if (status !== 'Paid' && status !== 'Unpaid') {
      throw new BadRequestException('Trạng thái thanh toán không hợp lệ');
    }

    if (status === 'Unpaid') {
      const wage = await this.monthlyWageRepo.findOne({ where: { teacherId, month } });
      if (wage) {
        if (wage.periodId) {
          throw new BadRequestException(
            'Kỳ lương thuộc đợt thanh toán phải được cập nhật tại màn Kế toán',
          );
        }
        await this.monthlyWageRepo.remove(wage); // CASCADE will delete items
      }
      return { success: true, message: 'Đã hủy thanh toán lương thành công' };
    }

    let finalBillingStartDate = billingStartDate;
    let finalBillingEndDate = billingEndDate;

    if (!finalBillingStartDate || !finalBillingEndDate) {
      const existingWage = await this.monthlyWageRepo.findOne({ where: { month } });
      if (existingWage && existingWage.billingStartDate && existingWage.billingEndDate) {
        finalBillingStartDate = `${existingWage.billingStartDate.getFullYear()}-${String(existingWage.billingStartDate.getMonth() + 1).padStart(2, '0')}-${String(existingWage.billingStartDate.getDate()).padStart(2, '0')}`;
        finalBillingEndDate = `${existingWage.billingEndDate.getFullYear()}-${String(existingWage.billingEndDate.getMonth() + 1).padStart(2, '0')}-${String(existingWage.billingEndDate.getDate()).padStart(2, '0')}`;
      } else {
        const today = new Date();
        const todayMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const [qYear, qMonth] = month.split('-').map(Number);
        const lastDay = new Date(qYear, qMonth, 0).getDate();
        const lastDayStr = `${qYear}-${String(qMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        finalBillingEndDate = month === todayMonthStr
          ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
          : lastDayStr;

        const prevWage = await this.monthlyWageRepo
          .createQueryBuilder('wage')
          .where('wage.billingEndDate < :endDate', { endDate: new Date(finalBillingEndDate) })
          .orderBy('wage.billingEndDate', 'DESC')
          .getOne();

        if (prevWage && prevWage.billingEndDate) {
          const nextDay = new Date(prevWage.billingEndDate);
          nextDay.setDate(nextDay.getDate() + 1);
          finalBillingStartDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
        } else {
          finalBillingStartDate = `${qYear}-${String(qMonth).padStart(2, '0')}-01`;
        }
      }
    }

    const { items, totalAmount: calculatedTotalAmount } = await this.calculateTeacherWageItems(
      teacherId,
      finalBillingStartDate,
      finalBillingEndDate,
    );

    let wage = await this.monthlyWageRepo.findOne({ where: { teacherId, month } });
    if (wage?.periodId) {
      throw new BadRequestException(
        'Kỳ lương thuộc đợt thanh toán phải được cập nhật tại màn Kế toán',
      );
    }
    if (!wage) {
      wage = new TeacherMonthlyWageOrmEntity();
      wage.teacherId = teacherId;
      wage.month = month;
    }

    wage.totalAmount = calculatedTotalAmount;
    wage.paidAmount = calculatedTotalAmount; // Full payment
    wage.status = status;
    wage.note = note ?? null;
    wage.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
    wage.billingStartDate = new Date(finalBillingStartDate);
    wage.billingEndDate = new Date(finalBillingEndDate);

    const savedWage = await this.monthlyWageRepo.save(wage);

    // Delete existing wage items if any
    await this.monthlyWageItemRepo.delete({ wageId: savedWage.id });

    // Save details to teacher_monthly_wage_items
    if (items.length > 0) {
      const ormItems = items.map(item => {
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
      await this.monthlyWageItemRepo.save(ormItems);
    }

    return savedWage;
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Lấy chi tiết một giáo viên theo ID (Dành cho ADMIN)' })
  async findOne(@Param('id') id: string) {
    return this.getTeacherByIdUseCase.execute(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cập nhật thông tin giáo viên (Chỉ dành cho ADMIN)' })
  async update(@Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    return this.updateTeacherUseCase.execute(id, dto);
  }

  @Get(':id/wages-report')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Tính lương giáo viên trong khoảng thời gian' })
  async getWagesReport(
    @Param('id') teacherId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const sessions = await this.sessionRepo
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.classEntity', 'classEntity')
      .leftJoinAndSelect('classEntity.course', 'course')
      .leftJoinAndSelect('classEntity.courseLevel', 'courseLevel')
      .where('(session.teacher_id = :teacherId OR session.assistant_id = :teacherId)', { teacherId })
      .andWhere('session.date >= :startDate', { startDate })
      .andWhere('session.date <= :endDate', { endDate })
      .andWhere('(session.status = :completedStatus OR session.attendance_locked = :locked)', { completedStatus: SessionStatus.COMPLETED, locked: true })
      .orderBy('session.date', 'ASC')
      .addOrderBy('session.start_time', 'ASC')
      .getMany();

    if (sessions.length === 0) {
      return { sessions: [], totalSessions: 0, totalAmount: 0 };
    }

    const levelIds = Array.from(new Set(sessions.map(s => s.classEntity.courseLevelId)));
    let pricingList: CourseLevelPricingOrmEntity[] = [];
    if (levelIds.length > 0) {
      pricingList = await this.sessionRepo.manager.find(CourseLevelPricingOrmEntity, {
        where: { courseLevelId: In(levelIds) },
        relations: { courseLevel: true }
      });
    }

    const reportSessions = sessions.map(session => {
      const date = session.date;
      const levelId = session.classEntity.courseLevelId;
      const role = session.teacherId === teacherId ? 'teacher' : 'assistant';

      const pricing = pricingList.find(p => {
        return p.courseLevelId === levelId &&
               p.effectiveFrom <= date &&
               (p.effectiveTo === null || p.effectiveTo >= date);
      });

      const rateField = role === 'teacher' ? 'teacherWagePerSession' : 'taWagePerSession';
      const rate = pricing ? Number(pricing[rateField]) : 0;
      const amount = rate;

      return {
        id: session.id,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        classId: session.classId,
        className: session.classEntity.className,
        classCode: session.classEntity.classCode,
        courseName: session.classEntity.course?.name || '',
        levelName: session.classEntity.courseLevel?.levelName || '',
        role,
        rate,
        amount,
        pricingEffectiveFrom: pricing ? pricing.effectiveFrom : null,
        pricingEffectiveTo: pricing ? pricing.effectiveTo : null,
      };
    });

    const totalAmount = reportSessions.reduce((sum, s) => sum + s.amount, 0);
    const totalSessions = reportSessions.length;

    return {
      sessions: reportSessions,
      totalSessions,
      totalAmount,
      pricingHistory: pricingList.map(p => ({
        id: p.id,
        levelName: p.courseLevel?.levelName || '',
        pricePerSession: Number(p.pricePerSession),
        teacherWagePerSession: Number(p.teacherWagePerSession),
        effectiveFrom: p.effectiveFrom,
        effectiveTo: p.effectiveTo
      }))
    };
  }

  // Fetch actual payment history records finalized in teacher_monthly_wages table - release v1.8.24
  @Get(':id/wages-history')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Lấy lịch sử nhận lương thực tế của giáo viên theo năm' })
  async getWagesHistory(
    @Param('id') teacherId: string,
    @Query('year') year: string,
  ) {
    if (!year || !/^\d{4}$/.test(year)) {
      throw new BadRequestException('Năm không hợp lệ. Định dạng yêu cầu là YYYY');
    }

    const wages = await this.monthlyWageRepo
      .createQueryBuilder('wage')
      .leftJoinAndSelect('wage.period', 'period')
      .leftJoinAndSelect('wage.items', 'items')
      .where('wage.teacher_id = :teacherId', { teacherId })
      .andWhere('wage.month LIKE :yearPattern', { yearPattern: `${year}-%` })
      .orderBy('wage.month', 'DESC')
      .addOrderBy('wage.created_at', 'DESC')
      .getMany();

    return wages.map(wage => ({
      id: wage.id,
      month: wage.month,
      totalAmount: Number(wage.totalAmount),
      paidAmount: Number(wage.paidAmount),
      status: wage.status,
      paymentDate: wage.paymentDate,
      paymentMethod: wage.paymentMethod,
      note: wage.note,
      periodName: wage.period?.name || `Đợt chi trả Tháng ${wage.month}`,
      items: wage.items.map(item => ({
        id: item.id,
        classId: item.classId,
        className: item.className,
        courseName: item.courseName,
        levelName: item.levelName,
        sessionsCount: item.sessionsCount,
        rate: Number(item.rate),
        totalAmount: Number(item.totalAmount)
      }))
    }));
  }
}
