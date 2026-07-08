import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  BadRequestException,
  Request,
  NotFoundException,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CourseLevelPricingOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';
import { SessionStatus } from '../../domain/value-objects/session-status.enum';
import { AddStudentUseCase } from '../../application/use-cases/add-student.use-case';
import { GetStudentsUseCase } from '../../application/use-cases/get-students.use-case';
import { GetStudentByIdUseCase } from '../../application/use-cases/get-student-by-id.use-case';
import { UpdateStudentUseCase } from '../../application/use-cases/update-student.use-case';
import { GetStudentTuitionReportUseCase } from '../../modules/billing/application/use-cases/get-student-tuition-report.use-case';
import { CalculateStudentTuitionUseCase } from '../../modules/billing/application/use-cases/calculate-student-tuition.use-case';
import {
  CreateStudentDto,
  UpdateStudentDto,
} from '../../application/dtos/student.dto';
import { ClassStudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { StudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { StudentMonthlyBillOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-monthly-bill.orm-entity';
import { StudentMonthlyBillItemOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-monthly-bill-item.orm-entity';

@ApiTags('Học sinh (Students)')
@ApiBearerAuth()
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentController {
  constructor(
    private readonly addStudentUseCase: AddStudentUseCase,
    private readonly getStudentsUseCase: GetStudentsUseCase,
    private readonly getStudentByIdUseCase: GetStudentByIdUseCase,
    private readonly updateStudentUseCase: UpdateStudentUseCase,
    private readonly getStudentTuitionReportUseCase: GetStudentTuitionReportUseCase,
    private readonly calculateStudentTuitionUseCase: CalculateStudentTuitionUseCase,
    @InjectRepository(ClassStudentOrmEntity)
    private readonly classStudentRepo: Repository<ClassStudentOrmEntity>,
    @InjectRepository(ClassSessionOrmEntity)
    private readonly sessionRepo: Repository<ClassSessionOrmEntity>,
    @InjectRepository(StudentOrmEntity)
    private readonly studentRepo: Repository<StudentOrmEntity>,
    @InjectRepository(StudentMonthlyBillOrmEntity)
    private readonly monthlyBillRepo: Repository<StudentMonthlyBillOrmEntity>,
    @InjectRepository(StudentMonthlyBillItemOrmEntity)
    private readonly monthlyBillItemRepo: Repository<StudentMonthlyBillItemOrmEntity>,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Tạo mới hồ sơ học sinh (Chỉ dành cho ADMIN)' })
  @ApiResponse({ status: 201, description: 'Tạo học sinh mới thành công' })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu đầu vào không hợp lệ hoặc thiếu trường bắt buộc',
  })
  @ApiResponse({
    status: 409,
    description: 'Email tài khoản đăng nhập học sinh đã tồn tại',
  })
  @ApiResponse({
    status: 403,
    description: 'Từ chối truy cập (Bạn không phải ADMIN)',
  })
  async create(@Body() dto: CreateStudentDto) {
    return this.addStudentUseCase.execute(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary:
      'Lấy danh sách tất cả học sinh có phân trang và bộ lọc (Dành cho ADMIN & TEACHER)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Số trang muốn lấy',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Số bản ghi mỗi trang',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Từ khóa tìm kiếm (Họ tên, mã học sinh, ĐT, email)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Lọc theo trạng thái học tập',
  })
  @ApiQuery({
    name: 'province',
    required: false,
    description: 'Lọc theo Tỉnh / Thành phố',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách thành công' })
  @ApiResponse({ status: 401, description: 'Yêu cầu token xác thực' })
  @ApiResponse({
    status: 403,
    description: 'Từ chối truy cập (Học sinh không có quyền xem danh sách này)',
  })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('province') province?: string,
    @Query('noClass') noClass?: string,
  ) {
    return this.getStudentsUseCase.execute({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status,
      province,
      noClass: noClass === 'true' || noClass === '1',
    });
  }

  @Get('tuition-bulk')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Tính học phí cho tất cả học sinh trong khoảng thời gian (Kế Toán)',
  })
  async getTuitionBulk(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const students = await this.studentRepo.find({
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    const results: any[] = [];

    for (const student of students) {
      const { summaries } = await this.calculateStudentTuitionUseCase.execute({
        studentId: student.id,
        startDate,
        endDate,
        onlyLockedSessions: true,
      });

      let totalAmount = 0;
      let totalSessions = 0;
      for (const summary of summaries) {
        totalAmount += summary.totalTuitionAmount;
        totalSessions += summary.sessions.filter((s) => s.isBilled).length;
      }

      results.push({
        studentId: student.id,
        studentCode: student.studentId,
        name: `${student.lastName} ${student.firstName}`,
        nickName: student.nickName,
        mobile: student.mobile,
        status: student.status,
        totalSessions,
        totalAmount,
      });
    }

    const grandTotal = results.reduce((sum, r) => sum + r.totalAmount, 0);
    return { students: results, grandTotal, startDate, endDate };
  }

  @Get('me')
  @Roles(Role.STUDENT)
  @ApiOperation({
    summary: 'Lấy thông tin cá nhân của học sinh đang đăng nhập',
  })
  async getMyProfile(@Request() req: any) {
    const student = await this.studentRepo.findOne({
      where: { userId: req.user.sub },
    });
    if (!student) throw new NotFoundException('Không tìm thấy hồ sơ học sinh');
    return student;
  }

  @Put('me')
  @Roles(Role.STUDENT)
  @ApiOperation({
    summary: 'Cập nhật thông tin cá nhân của học sinh đang đăng nhập',
  })
  async updateMyProfile(@Request() req: any, @Body() dto: UpdateStudentDto) {
    const student = await this.studentRepo.findOne({
      where: { userId: req.user.sub },
    });
    if (!student) throw new NotFoundException('Không tìm thấy hồ sơ học sinh');

    // Only allow updating certain fields for student role to prevent privilege escalation
    const allowedDto: UpdateStudentDto = {
      mobile: dto.mobile,
      email: dto.email,
      primaryAddress: dto.primaryAddress,
      avatar: dto.avatar,
      loginPassword: dto.loginPassword,
      otherPhone1: dto.otherPhone1,
      otherPhone2: dto.otherPhone2,
      province: dto.province,
      districtWard: dto.districtWard,
      oldAddress: dto.oldAddress,
    };

    return this.updateStudentUseCase.execute(student.id, allowedDto);
  }

  @Get('me/tuition')
  @Roles(Role.STUDENT)
  @ApiOperation({
    summary: 'Lấy danh sách hóa đơn học phí của học sinh đang đăng nhập',
  })
  async getMyTuition(@Request() req: any) {
    const student = await this.studentRepo.findOne({
      where: { userId: req.user.sub },
    });
    if (!student) throw new NotFoundException('Không tìm thấy hồ sơ học sinh');

    const bills = await this.monthlyBillRepo.find({
      where: { studentId: student.id },
      relations: { period: true, paymentRequest: { logs: true } },
      order: { month: 'DESC' },
    });

    const results = await Promise.all(
      bills.map(async (bill) => {
        const items = await this.monthlyBillItemRepo.find({
          where: { billId: bill.id },
        });
        if (bill.paymentRequest?.qrUrl) {
          bill.paymentRequest.qrUrl = bill.paymentRequest.qrUrl.replace('/970418-', '/BIDV-');
        }
        return { ...bill, items };
      }),
    );

    return results;
  }

  private async calculateStudentBillingItems(
    studentId: string,
    startDate: string,
    endDate: string,
  ) {
    const { summaries } = await this.calculateStudentTuitionUseCase.execute({
      studentId,
      startDate,
      endDate,
      onlyLockedSessions: true,
    });

    const items: any[] = [];
    let grandTotal = 0;

    for (const summary of summaries) {
      const billedSessions = summary.sessions.filter((s) => s.isBilled);
      if (billedSessions.length === 0) continue;

      const sorted = [...summary.sessions].sort((a, b) => b.date.localeCompare(a.date));
      const latestRate = sorted[0] ? sorted[0].rate : 0;

      const firstSess = summary.sessions[0];
      const courseName = firstSess ? firstSess.courseName : '';
      const levelName = firstSess ? firstSess.levelName : '';

      items.push({
        classId: summary.classId,
        className: summary.className,
        courseName,
        levelName,
        sessionsCount: billedSessions.length,
        rate: latestRate,
        totalAmount: summary.totalTuitionAmount,
      });
      grandTotal += summary.totalTuitionAmount;
    }

    return { items, totalAmount: grandTotal };
  }

  @Get('monthly-bills')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Lấy danh sách hóa đơn học phí theo tháng (Kế Toán)',
  })
  async getMonthlyBills(@Query('month') month: string) {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException(
        'Tháng không hợp lệ. Định dạng yêu cầu là YYYY-MM',
      );
    }

    const students = await this.studentRepo.find({
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    const savedBills = await this.monthlyBillRepo.find({ where: { month } });
    const savedBillsMap = new Map(savedBills.map((b) => [b.studentId, b]));

    let waveStartDate: Date;
    let waveEndDate: Date;

    if (
      savedBills.length > 0 &&
      savedBills[0].billingStartDate &&
      savedBills[0].billingEndDate
    ) {
      waveStartDate = savedBills[0].billingStartDate;
      waveEndDate = savedBills[0].billingEndDate;
    } else {
      const today = new Date();
      const todayMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const [qYear, qMonth] = month.split('-').map(Number);
      const lastDay = new Date(qYear, qMonth, 0).getDate();
      const lastDayStr = `${qYear}-${String(qMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const computedEndDateStr =
        month === todayMonthStr
          ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
          : lastDayStr;

      waveEndDate = new Date(computedEndDateStr);

      const latestBill = await this.monthlyBillRepo
        .createQueryBuilder('bill')
        .where('bill.billingEndDate < :waveEndDate', { waveEndDate })
        .orderBy('bill.billingEndDate', 'DESC')
        .getOne();

      if (latestBill && latestBill.billingEndDate) {
        const nextDay = new Date(latestBill.billingEndDate);
        nextDay.setDate(nextDay.getDate() + 1);
        waveStartDate = nextDay;
      } else {
        waveStartDate = new Date(
          `${qYear}-${String(qMonth).padStart(2, '0')}-01`,
        );
      }
    }

    const waveStartDateStr = `${waveStartDate.getFullYear()}-${String(waveStartDate.getMonth() + 1).padStart(2, '0')}-${String(waveStartDate.getDate()).padStart(2, '0')}`;
    const waveEndDateStr = `${waveEndDate.getFullYear()}-${String(waveEndDate.getMonth() + 1).padStart(2, '0')}-${String(waveEndDate.getDate()).padStart(2, '0')}`;

    const results: any[] = [];

    for (const student of students) {
      const savedBill = savedBillsMap.get(student.id);

      if (savedBill) {
        const savedItems = await this.monthlyBillItemRepo.find({
          where: { billId: savedBill.id },
        });
        results.push({
          id: savedBill.id,
          studentId: student.id,
          studentCode: student.studentId,
          name: `${student.lastName} ${student.firstName}`,
          nickName: student.nickName,
          mobile: student.mobile,
          status: student.status,
          totalAmount: Number(savedBill.totalAmount),
          paidAmount: Number(savedBill.paidAmount),
          paymentStatus: savedBill.status,
          paymentDate: savedBill.paymentDate,
          billingStartDate: savedBill.billingStartDate,
          billingEndDate: savedBill.billingEndDate,
          note: savedBill.note,
          isDraft: false,
          items: savedItems.map((item) => ({
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
        const { items, totalAmount } = await this.calculateStudentBillingItems(
          student.id,
          waveStartDateStr,
          waveEndDateStr,
        );

        results.push({
          id: null,
          studentId: student.id,
          studentCode: student.studentId,
          name: `${student.lastName} ${student.firstName}`,
          nickName: student.nickName,
          mobile: student.mobile,
          status: student.status,
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

  @Post('monthly-bills/pay')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Cập nhật tình trạng đóng học phí tháng của học sinh (Kế Toán)',
  })
  async payMonthlyBill(
    @Body()
    body: {
      studentId: string;
      month: string;
      totalAmount: number;
      paidAmount: number;
      status: string;
      note?: string;
      paymentDate?: string;
      billingStartDate?: string;
      billingEndDate?: string;
    },
  ) {
    const {
      studentId,
      month,
      totalAmount,
      paidAmount,
      status,
      note,
      paymentDate,
      billingStartDate,
      billingEndDate,
    } = body;
    if (!studentId || !month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException(
        'Dữ liệu không hợp lệ. Yêu cầu studentId và month (YYYY-MM)',
      );
    }

    if (status !== 'Paid' && status !== 'Unpaid') {
      throw new BadRequestException('Trạng thái thanh toán không hợp lệ');
    }

    if (status === 'Unpaid') {
      const bill = await this.monthlyBillRepo.findOne({
        where: { studentId, month },
      });
      if (bill) {
        if (bill.periodId) {
          throw new BadRequestException(
            'Hóa đơn thuộc đợt thanh toán phải được cập nhật tại màn Kế toán',
          );
        }
        await this.monthlyBillRepo.remove(bill); // CASCADE will delete items
      }
      return { success: true, message: 'Đã hủy chốt hóa đơn thành công' };
    }

    let finalBillingStartDate = billingStartDate;
    let finalBillingEndDate = billingEndDate;

    if (!finalBillingStartDate || !finalBillingEndDate) {
      const existingBill = await this.monthlyBillRepo.findOne({
        where: { month },
      });
      if (
        existingBill &&
        existingBill.billingStartDate &&
        existingBill.billingEndDate
      ) {
        finalBillingStartDate = `${existingBill.billingStartDate.getFullYear()}-${String(existingBill.billingStartDate.getMonth() + 1).padStart(2, '0')}-${String(existingBill.billingStartDate.getDate()).padStart(2, '0')}`;
        finalBillingEndDate = `${existingBill.billingEndDate.getFullYear()}-${String(existingBill.billingEndDate.getMonth() + 1).padStart(2, '0')}-${String(existingBill.billingEndDate.getDate()).padStart(2, '0')}`;
      } else {
        const today = new Date();
        const todayMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const [qYear, qMonth] = month.split('-').map(Number);
        const lastDay = new Date(qYear, qMonth, 0).getDate();
        const lastDayStr = `${qYear}-${String(qMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        finalBillingEndDate =
          month === todayMonthStr
            ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
            : lastDayStr;

        const prevBill = await this.monthlyBillRepo
          .createQueryBuilder('bill')
          .where('bill.billingEndDate < :endDate', {
            endDate: new Date(finalBillingEndDate),
          })
          .orderBy('bill.billingEndDate', 'DESC')
          .getOne();

        if (prevBill && prevBill.billingEndDate) {
          const nextDay = new Date(prevBill.billingEndDate);
          nextDay.setDate(nextDay.getDate() + 1);
          finalBillingStartDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
        } else {
          finalBillingStartDate = `${qYear}-${String(qMonth).padStart(2, '0')}-01`;
        }
      }
    }

    const { items, totalAmount: calculatedTotalAmount } =
      await this.calculateStudentBillingItems(
        studentId,
        finalBillingStartDate,
        finalBillingEndDate,
      );

    let bill = await this.monthlyBillRepo.findOne({
      where: { studentId, month },
    });
    if (bill?.periodId) {
      throw new BadRequestException(
        'Hóa đơn thuộc đợt thanh toán phải được cập nhật tại màn Kế toán',
      );
    }
    if (!bill) {
      bill = new StudentMonthlyBillOrmEntity();
      bill.studentId = studentId;
      bill.month = month;
    }

    bill.totalAmount = calculatedTotalAmount;
    bill.paidAmount = calculatedTotalAmount; // Full payment
    bill.status = status;
    bill.note = note ?? null;
    bill.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
    bill.billingStartDate = new Date(finalBillingStartDate);
    bill.billingEndDate = new Date(finalBillingEndDate);

    const savedBill = await this.monthlyBillRepo.save(bill);

    // Delete existing bill items if any
    await this.monthlyBillItemRepo.delete({ billId: savedBill.id });

    // Save details to student_monthly_bill_items
    if (items.length > 0) {
      const ormItems = items.map((item) => {
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
      await this.monthlyBillItemRepo.save(ormItems);
    }

    return savedBill;
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Lấy chi tiết một học sinh theo ID (Dành cho ADMIN & TEACHER)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin học sinh thành công',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học sinh' })
  async findOne(@Param('id') id: string) {
    return this.getStudentByIdUseCase.execute(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cập nhật thông tin học sinh (Chỉ dành cho ADMIN)' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học sinh' })
  @ApiResponse({
    status: 403,
    description: 'Từ chối truy cập (Bạn không phải ADMIN)',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.updateStudentUseCase.execute(id, dto);
  }

  @Get(':id/classes')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Lấy danh sách lớp học của học sinh' })
  async getStudentClasses(@Param('id') studentId: string) {
    return this.classStudentRepo.find({
      where: { studentId },
      relations: {
        classEntity: {
          course: true,
          courseLevel: true,
          center: true,
        },
      },
      order: { joinedDate: 'DESC' },
    });
  }

  @Get(':id/sessions')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Lấy lịch học cụ thể của học sinh' })
  async getStudentSessions(@Param('id') studentId: string) {
    // 1. Get all class student enrollments
    const enrollments = await this.classStudentRepo.find({
      where: { studentId },
    });

    if (enrollments.length === 0) {
      return [];
    }

    const classIds = enrollments.map((e) => e.classId);

    // 2. Query sessions of these classes
    const sessions = await this.sessionRepo
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.room', 'room')
      .leftJoinAndSelect('session.classEntity', 'classEntity')
      .leftJoinAndSelect('classEntity.course', 'course')
      .leftJoinAndSelect('classEntity.courseLevel', 'courseLevel')
      .leftJoinAndSelect('classEntity.center', 'center')
      .leftJoinAndMapOne(
        'session.attendance',
        StudentAttendanceOrmEntity,
        'attendance',
        'attendance.class_session_id = session.id AND attendance.student_id = :studentId',
        { studentId },
      )
      .where('session.class_id IN (:...classIds)', { classIds })
      .orderBy('session.date', 'DESC')
      .addOrderBy('session.start_time', 'DESC')
      .getMany();

    // 3. Filter sessions for dropped/active students strictly based on enrollment joinedDate and droppedDate
    const filtered = sessions.filter((session) => {
      const enrollment = enrollments.find((e) => e.classId === session.classId);
      if (!enrollment) return false;
      const joinedDate = enrollment.joinedDate;
      if (enrollment.status === 'Active') {
        return session.date >= joinedDate;
      }
      if (enrollment.status === 'Dropped') {
        const droppedDate = enrollment.updatedAt
          ? new Date(enrollment.updatedAt).toISOString().split('T')[0]
          : enrollment.joinedDate;
        return session.date >= joinedDate && session.date <= droppedDate;
      }
      return false;
    });

    return filtered;
  }

  @Get(':id/tuition-report')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Tính tiền học phí cho học sinh trong khoảng thời gian',
  })
  async getTuitionReport(
    @Param('id') studentId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.getStudentTuitionReportUseCase.execute(
      studentId,
      startDate,
      endDate,
    );
  }
}
