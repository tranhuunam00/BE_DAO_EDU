import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { ClassScheduleOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-schedule.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { ClassStudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { CourseOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course.orm-entity';
import { StudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { CreateClassDto, UpdateClassDto } from '../../application/dtos/class.dto';
import { AssignmentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/assignment.orm-entity';
import { NotificationOrmEntity } from '../../infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { GetHolidayDatesUseCase } from '../../modules/academics/application/use-cases/manage-holidays.use-cases';
import { AcademicError } from '../../modules/academics/domain/errors/academic.error';
import {
  CheckRecurringScheduleConflictsUseCase,
  CheckSessionScheduleConflictUseCase,
} from '../../modules/academics/application/use-cases/check-schedule-conflicts.use-case';
import {
  EnrollStudentUseCase,
  RemoveStudentFromClassUseCase,
} from '../../modules/academics/application/use-cases/manage-enrollment.use-cases';

function parseDateSafely(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (/^\d{4}$/.test(trimmed)) {
    return new Date(`${trimmed}-01-01T00:00:00.000Z`);
  }
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function hasScheduleOverlap(schedules: { weekday: string; startTime: string; endTime: string }[]): boolean {
  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const a = schedules[i];
      const b = schedules[j];
      if (a.weekday === b.weekday) {
        if (a.startTime < b.endTime && b.startTime < a.endTime) {
          return true;
        }
      }
    }
  }
  return false;
}

function validateSchedules(
  schedules: { weekday: string; startTime: string; endTime: string }[],
): void {
  if (schedules.length === 0) {
    throw new ConflictException(
      'Lop hoc phai co it nhat mot lich hoc co dinh.',
    );
  }

  const weekdays = new Set(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

  for (const schedule of schedules) {
    if (!weekdays.has(schedule.weekday)) {
      throw new ConflictException('Thu trong tuan khong hop le.');
    }
    if (
      !timePattern.test(schedule.startTime) ||
      !timePattern.test(schedule.endTime)
    ) {
      throw new ConflictException('Gio hoc phai co dinh dang HH:mm.');
    }
    if (schedule.startTime >= schedule.endTime) {
      throw new ConflictException('Gio ket thuc phai sau gio bat dau.');
    }
  }

  if (hasScheduleOverlap(schedules)) {
    throw new ConflictException(
      'Lich hoc dinh ky bi trung thoi gian tren cung mot thu.',
    );
  }
}

@ApiTags('Classes')
@Controller('classes')
export class ClassController {
  constructor(
    @InjectRepository(ClassOrmEntity)
    private readonly classRepo: Repository<ClassOrmEntity>,
    @InjectRepository(ClassScheduleOrmEntity)
    private readonly scheduleRepo: Repository<ClassScheduleOrmEntity>,
    @InjectRepository(ClassSessionOrmEntity)
    private readonly sessionRepo: Repository<ClassSessionOrmEntity>,
    @InjectRepository(ClassStudentOrmEntity)
    private readonly classStudentRepo: Repository<ClassStudentOrmEntity>,
    @InjectRepository(StudentAttendanceOrmEntity)
    private readonly attendanceRepo: Repository<StudentAttendanceOrmEntity>,
    @InjectRepository(CourseOrmEntity)
    private readonly courseRepo: Repository<CourseOrmEntity>,
    @InjectRepository(StudentOrmEntity)
    private readonly studentRepo: Repository<StudentOrmEntity>,
    @InjectRepository(AssignmentOrmEntity)
    private readonly assignmentRepo: Repository<AssignmentOrmEntity>,
    @InjectRepository(NotificationOrmEntity)
    private readonly notificationRepo: Repository<NotificationOrmEntity>,
    private readonly getHolidayDates: GetHolidayDatesUseCase,
    private readonly checkRecurringScheduleConflicts: CheckRecurringScheduleConflictsUseCase,
    private readonly checkSessionScheduleConflict: CheckSessionScheduleConflictUseCase,
    private readonly enrollStudentUseCase: EnrollStudentUseCase,
    private readonly removeStudentUseCase: RemoveStudentFromClassUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách Lớp học' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('centerId') centerId?: string,
    @Query('courseId') courseId?: string,
  ) {
    const qb = this.classRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.course', 'course')
      .leftJoinAndSelect('c.courseLevel', 'level')
      .leftJoinAndSelect('c.mainTeacher', 'teacher')
      .leftJoinAndSelect('c.center', 'center');

    if (search) {
      qb.andWhere('(c.class_name ILIKE :s OR c.class_code ILIKE :s)', { s: `%${search}%` });
    }
    if (status) qb.andWhere('c.status = :status', { status });
    if (centerId) qb.andWhere('c.center_id = :centerId', { centerId });
    if (courseId) qb.andWhere('c.course_id = :courseId', { courseId });

    qb.orderBy('c.created_at', 'DESC');
    const total = await qb.getCount();
    const classes = await qb.skip((page - 1) * limit).take(limit).getMany();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneWeekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    oneWeekLater.setHours(23, 59, 59, 999);

    const classesWithEndingSoon = classes.map(c => {
      let isEndingSoon = false;
      if (c.status === 'Active' && c.finishDate) {
        const finish = new Date(c.finishDate);
        isEndingSoon = finish >= today && finish <= oneWeekLater;
      }
      return { ...c, isEndingSoon };
    });

    return { classes: classesWithEndingSoon, total, page: Number(page), limit: Number(limit) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết Lớp học' })
  async findOne(@Param('id') id: string) {
    const classEntity = await this.classRepo.findOneOrFail({
      where: { id },
      relations: { course: true, courseLevel: true, mainTeacher: true, center: true },
    });
    const schedules = await this.scheduleRepo.find({
      where: { classId: id },
      relations: { room: true },
      order: { weekday: 'ASC' },
    });
    const students = await this.classStudentRepo.find({
      where: { classId: id },
      relations: { student: true },
      order: { joinedDate: 'ASC' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneWeekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    oneWeekLater.setHours(23, 59, 59, 999);

    let isEndingSoon = false;
    if (classEntity.status === 'Active' && classEntity.finishDate) {
      const finish = new Date(classEntity.finishDate);
      isEndingSoon = finish >= today && finish <= oneWeekLater;
    }

    return { ...classEntity, schedules, students, isEndingSoon };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo Lớp học mới' })
  async create(@Body() dto: CreateClassDto) {
    validateSchedules(dto.schedules ?? []);
    if (!dto.schedules || dto.schedules.length === 0) {
      throw new ConflictException('Lớp học phải có ít nhất một lịch học cố định.');
    }

    if (dto.schedules && hasScheduleOverlap(dto.schedules)) {
      throw new ConflictException('Lịch học định kỳ bị trùng thời gian trên cùng một thứ.');
    }

    const classStart = parseDateSafely(dto.startDate);
    const classFinish = parseDateSafely(dto.finishDate);

    if (classStart && classFinish && classStart > classFinish) {
      throw new ConflictException('Ngày kết thúc phải sau ngày khai giảng.');
    }

    if (dto.courseId && classStart) {
      const course = await this.courseRepo.findOne({ where: { id: dto.courseId } });
      if (course && course.year) {
        const courseStart = parseDateSafely(course.year);
        if (courseStart && classStart < courseStart) {
          const readableDate = course.year.includes('-')
            ? course.year.split('-').reverse().join('/')
            : `01/01/${course.year}`;
          throw new ConflictException(
            `Ngày khai giảng của lớp học không được trước ngày bắt đầu của chương trình học (${readableDate}).`
          );
        }
      }
    }

    await this.runAcademic(() =>
      this.checkRecurringScheduleConflicts.execute(
        (dto.schedules ?? []).map((schedule) => ({
          weekday: schedule.weekday,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          roomId: schedule.roomId ?? null,
          teacherId: dto.mainTeacherId ?? null,
          startDate: dto.startDate,
          finishDate: dto.finishDate,
        })),
      ),
    );

    const existsCode = await this.classRepo.createQueryBuilder('c')
      .where('LOWER(c.class_code) = LOWER(:code)', { code: dto.classCode.trim() })
      .getOne();
    if (existsCode) {
      throw new ConflictException('Mã lớp học này đã tồn tại.');
    }

    const existsName = await this.classRepo.createQueryBuilder('c')
      .where('LOWER(c.class_name) = LOWER(:name)', { name: dto.className.trim() })
      .getOne();
    if (existsName) {
      throw new ConflictException('Tên lớp học này đã tồn tại.');
    }

    const classEntity = this.classRepo.create({
      courseId: dto.courseId,
      courseLevelId: dto.courseLevelId,
      classCode: dto.classCode,
      className: dto.className,
      upgradeFromClassId: dto.upgradeFromClassId || null,
      typeOfClass: dto.typeOfClass || null,
      defaultHours: dto.defaultHours || null,
      status: dto.status || 'Planning',
      startDate: dto.startDate || null,
      finishDate: dto.finishDate || null,
      syllabusBy: dto.syllabusBy || null,
      maxSize: dto.maxSize || null,
      skipHolidays: dto.skipHolidays || false,
      description: dto.description || null,
      mainTeacherId: dto.mainTeacherId || null,
      assignedTo: dto.assignedTo || null,
      csoName: dto.csoName || null,
      centerId: dto.centerId || null,
    });

    const saved = await this.classRepo.save(classEntity);

    // Create schedules
    if (dto.schedules && dto.schedules.length > 0) {
      for (const s of dto.schedules) {
        const schedule = this.scheduleRepo.create({
          classId: saved.id,
          roomId: s.roomId || null,
          weekday: s.weekday,
          startTime: s.startTime,
          endTime: s.endTime,
          durationMins: s.durationMins || null,
        });
        await this.scheduleRepo.save(schedule);
      }
    }

    // If startDate is set and status is Active, generate sessions
    if (saved.startDate && (saved.status === 'Active')) {
      await this.generateSessions(saved.id);
    }

    return this.findOne(saved.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật Lớp học' })
  async update(@Param('id') id: string, @Body() dto: UpdateClassDto) {
    const classEntity = await this.classRepo.findOneOrFail({ where: { id } });
    const previousStatus = classEntity.status;

    if (dto.schedules !== undefined) {
      validateSchedules(dto.schedules);
    }

    // Validate unique classCode and className
    if (dto.classCode !== undefined) {
      const existsCode = await this.classRepo.createQueryBuilder('c')
        .where('LOWER(c.class_code) = LOWER(:code)', { code: dto.classCode.trim() })
        .andWhere('c.id != :id', { id })
        .getOne();
      if (existsCode) {
        throw new ConflictException('Mã lớp học này đã tồn tại.');
      }
    }

    if (dto.className !== undefined) {
      const existsName = await this.classRepo.createQueryBuilder('c')
        .where('LOWER(c.class_name) = LOWER(:name)', { name: dto.className.trim() })
        .andWhere('c.id != :id', { id })
        .getOne();
      if (existsName) {
        throw new ConflictException('Tên lớp học này đã tồn tại.');
      }
    }

    if (dto.schedules && hasScheduleOverlap(dto.schedules)) {
      throw new ConflictException('Lịch học định kỳ bị trùng thời gian trên cùng một thứ.');
    }

    const finalCourseId = dto.courseId !== undefined ? dto.courseId : classEntity.courseId;
    const finalStartDate = dto.startDate !== undefined ? dto.startDate : classEntity.startDate;
    const finalFinishDate = dto.finishDate !== undefined ? dto.finishDate : classEntity.finishDate;

    const classStart = parseDateSafely(finalStartDate);
    const classFinish = parseDateSafely(finalFinishDate);

    if (classStart && classFinish && classStart > classFinish) {
      throw new ConflictException('Ngày kết thúc phải sau ngày khai giảng.');
    }

    if (finalCourseId && classStart) {
      const course = await this.courseRepo.findOne({ where: { id: finalCourseId } });
      if (course && course.year) {
        const courseStart = parseDateSafely(course.year);
        if (courseStart && classStart < courseStart) {
          const readableDate = course.year.includes('-')
            ? course.year.split('-').reverse().join('/')
            : `01/01/${course.year}`;
          throw new ConflictException(
            `Ngày khai giảng của lớp học không được trước ngày bắt đầu của chương trình học (${readableDate}).`
          );
        }
      }
    }

    if (
      dto.schedules !== undefined ||
      dto.mainTeacherId !== undefined ||
      dto.startDate !== undefined ||
      dto.finishDate !== undefined
    ) {
      const schedules =
        dto.schedules ??
        (await this.scheduleRepo.find({ where: { classId: id } }));
      await this.runAcademic(() =>
        this.checkRecurringScheduleConflicts.execute(
          schedules.map((schedule) => ({
            weekday: schedule.weekday,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            roomId: schedule.roomId ?? null,
            teacherId:
              dto.mainTeacherId !== undefined
                ? dto.mainTeacherId || null
                : classEntity.mainTeacherId,
            startDate: finalStartDate,
            finishDate: finalFinishDate,
          })),
          id,
        ),
      );
    }

    if (dto.courseId !== undefined) classEntity.courseId = dto.courseId;
    if (dto.courseLevelId !== undefined) classEntity.courseLevelId = dto.courseLevelId;
    if (dto.classCode !== undefined) classEntity.classCode = dto.classCode;
    if (dto.className !== undefined) classEntity.className = dto.className;
    if (dto.upgradeFromClassId !== undefined) classEntity.upgradeFromClassId = dto.upgradeFromClassId || null;
    if (dto.typeOfClass !== undefined) classEntity.typeOfClass = dto.typeOfClass || null;
    if (dto.defaultHours !== undefined) classEntity.defaultHours = dto.defaultHours || null;
    if (dto.status !== undefined) classEntity.status = dto.status;
    if (dto.startDate !== undefined) classEntity.startDate = dto.startDate || null;
    if (dto.finishDate !== undefined) classEntity.finishDate = dto.finishDate || null;
    if (dto.syllabusBy !== undefined) classEntity.syllabusBy = dto.syllabusBy || null;
    if (dto.maxSize !== undefined) classEntity.maxSize = dto.maxSize || null;
    if (dto.skipHolidays !== undefined) classEntity.skipHolidays = dto.skipHolidays;
    if (dto.description !== undefined) classEntity.description = dto.description || null;
    if (dto.mainTeacherId !== undefined) classEntity.mainTeacherId = dto.mainTeacherId || null;
    if (dto.assignedTo !== undefined) classEntity.assignedTo = dto.assignedTo || null;
    if (dto.csoName !== undefined) classEntity.csoName = dto.csoName || null;
    if (dto.centerId !== undefined) classEntity.centerId = dto.centerId || null;

    await this.classRepo.save(classEntity);
    const hasExistingSessions =
      (await this.sessionRepo.count({ where: { classId: id } })) > 0;
    const statusChanged =
      dto.status !== undefined && previousStatus !== classEntity.status;

    // Sync teacher to all future unlocked sessions if mainTeacherId is updated
    if (dto.mainTeacherId !== undefined) {
      const todayStr = new Date().toISOString().split('T')[0];
      await this.sessionRepo
        .createQueryBuilder()
        .update(ClassSessionOrmEntity)
        .set({ teacherId: dto.mainTeacherId || null })
        .where('class_id = :classId', { classId: id })
        .andWhere('date >= :today', { today: todayStr })
        .andWhere('attendance_locked = false')
        .execute();
    }

    // Sync schedules if provided
    if (dto.schedules !== undefined) {
      await this.scheduleRepo.delete({ classId: id });
      for (const s of dto.schedules) {
        const schedule = this.scheduleRepo.create({
          classId: id,
          roomId: s.roomId || null,
          weekday: s.weekday,
          startTime: s.startTime,
          endTime: s.endTime,
          durationMins: s.durationMins || null,
        });
        await this.scheduleRepo.save(schedule);
      }

      // Regenerate future sessions
      await this.regenerateFutureSessions(id);
    } else {
      // If schedules weren't updated, but status/startDate/finishDate/skipHolidays changed, regenerate future sessions
      const dateOrHolidayChanged = (classEntity.status === 'Active' || hasExistingSessions) && (
        dto.startDate !== undefined ||
        dto.finishDate !== undefined ||
        dto.skipHolidays !== undefined
      );

      if (statusChanged || dateOrHolidayChanged) {
        await this.regenerateFutureSessions(id);
      }
    }

    return this.findOne(id);
  }

  // ========= Class Students =========

  @Post(':id/students')
  @ApiOperation({ summary: 'Thêm Học sinh vào Lớp' })
  async addStudent(
    @Param('id') classId: string,
    @Body() body: { studentId?: string; studentIds?: string[] },
  ) {
    const studentIds =
      body.studentIds || (body.studentId ? [body.studentId] : []);
    if (studentIds.length === 0) {
      throw new BadRequestException('studentId or studentIds must be provided');
    }

    const results = [];
    for (const studentId of studentIds) {
      const saved = await this.runAcademic(() =>
        this.enrollStudentUseCase.execute(classId, studentId),
      );
      await this.notifyStudentAboutOpenAssignments(classId, studentId);
      results.push(saved);
    }

    return results;
  }

  @Delete(':id/students/:studentId')
  @ApiOperation({ summary: 'Kick Học sinh khỏi Lớp (Dropped)' })
  async removeStudent(@Param('id') classId: string, @Param('studentId') studentId: string) {
    await this.runAcademic(() =>
      this.removeStudentUseCase.execute(classId, studentId),
    );

    return { message: 'Học sinh đã được chuyển sang trạng thái Dropped' };
  }

  // ========= Sessions =========

  @Get(':id/sessions')
  @ApiOperation({ summary: 'Lấy danh sách buổi học của Lớp' })
  async getSessions(
    @Param('id') classId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const qb = this.sessionRepo.createQueryBuilder('s')
      .leftJoinAndSelect('s.teacher', 'teacher')
      .leftJoinAndSelect('s.room', 'room')
      .where('s.class_id = :classId', { classId });

    if (month && year) {
      const startOfMonth = `${year}-${month.padStart(2, '0')}-01`;
      const endOfMonth = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];
      qb.andWhere('s.date >= :start AND s.date <= :end', { start: startOfMonth, end: endOfMonth });
    }

    qb.orderBy('s.date', 'ASC').addOrderBy('s.start_time', 'ASC');
    return qb.getMany();
  }

  @Post(':id/generate-sessions')
  @ApiOperation({ summary: 'Sinh danh sách buổi học từ lịch cố định' })
  async generateSessionsEndpoint(@Param('id') classId: string) {
    const classEntity = await this.classRepo.findOneOrFail({ where: { id: classId } });
    if (classEntity.status !== 'Active') {
      throw new ConflictException(
        'Chỉ có thể sinh các buổi học khi lớp học ở trạng thái "Hoạt động". Vui lòng cập nhật trạng thái lớp sang "Hoạt động" trước.'
      );
    }
    const schedules = await this.scheduleRepo.find({ where: { classId } });
    if (schedules.length === 0) {
      throw new ConflictException(
        'Lớp học chưa có lịch học cố định. Vui lòng cấu hình lịch học trước.'
      );
    }
    if (!classEntity.startDate) {
      throw new ConflictException('Lớp học chưa cấu hình ngày khai giảng.');
    }

    await this.regenerateFutureSessions(classId);
    return { message: 'Đã sinh buổi học thành công' };
  }

  @Get('sessions/:sessionId/attendance')
  @ApiOperation({ summary: 'Lấy danh sách điểm danh của buổi học' })
  async getSessionAttendance(@Param('sessionId') sessionId: string) {
    const attendance = await this.attendanceRepo.find({
      where: { classSessionId: sessionId },
      relations: { student: true },
      order: { id: 'ASC' }
    });
    return attendance;
  }

  @Post('sessions/:sessionId/start-attendance')
  @ApiOperation({ summary: 'Bắt đầu điểm danh (chuyển trạng thái sang Đang học)' })
  async startAttendance(
    @Param('sessionId') sessionId: string,
    @Query('bypassTimeCheck') bypassTimeCheck?: string,
  ) {
    const session = await this.sessionRepo.findOneOrFail({
      where: { id: sessionId },
      relations: { classEntity: true },
    });

    if (session.attendanceLocked) {
      throw new Error('Buổi học này đã hoàn thành và khóa điểm danh.');
    }

    // Check time window: 10 mins before startTime until endTime
    if (bypassTimeCheck !== 'true') {
      const now = new Date();
      
      const sessionDate = session.date;
      const startParts = session.startTime.split(':');
      const endParts = session.endTime.split(':');

      const sessionStart = new Date(`${sessionDate}T${startParts[0]}:${startParts[1]}:00`);
      const sessionEnd = new Date(`${sessionDate}T${endParts[0]}:${endParts[1]}:00`);

      const tenMinsBeforeStart = new Date(sessionStart.getTime() - 10 * 60 * 1000);

      if (now < tenMinsBeforeStart || now > sessionEnd) {
        throw new Error('Chỉ được điểm danh từ trước buổi học 10 phút đến khi kết thúc buổi học.');
      }
    }

    session.status = 'In-Progress';
    await this.sessionRepo.save(session);
    return session;
  }

  @Post('sessions/:sessionId/attendance')
  @ApiOperation({ summary: 'Ghi nhận điểm danh cho học sinh' })
  async saveAttendance(
    @Param('sessionId') sessionId: string,
    @Body() body: { attendance: { studentId: string; isPresent: boolean; reason?: string; note?: string }[] }
  ) {
    const session = await this.sessionRepo.findOneOrFail({ where: { id: sessionId } });
    if (session.attendanceLocked) {
      throw new Error('Điểm danh của buổi học này đã bị khóa.');
    }

    for (const item of body.attendance) {
      let record = await this.attendanceRepo.findOne({
        where: { classSessionId: sessionId, studentId: item.studentId }
      });

      if (!record) {
        record = this.attendanceRepo.create({
          classSessionId: sessionId,
          studentId: item.studentId,
        });
      }

      record.isPresent = item.isPresent;
      record.reason = item.reason || null;
      record.note = item.note || null;
      await this.attendanceRepo.save(record);
    }

    return { message: 'Điểm danh lưu thành công' };
  }

  @Post('sessions/:sessionId/attendance-override')
  @ApiOperation({ summary: '[Admin] Sửa điểm danh đã chốt - chỉ với buổi chưa tính tiền' })
  async overrideAttendance(
    @Param('sessionId') sessionId: string,
    @Body() body: { attendance: { studentId: string; isPresent: boolean; reason?: string; note?: string }[] }
  ) {
    const session = await this.sessionRepo.findOneOrFail({ where: { id: sessionId } });
    if (!session.attendanceLocked) {
      throw new ConflictException('Buổi học này chưa được chốt. Hãy sử dụng endpoint điểm danh thông thường.');
    }

    // Check that none of the attendance records for this session have been billed
    const existingRecords = await this.attendanceRepo.find({ where: { classSessionId: sessionId } });
    const billedRecord = existingRecords.find(r => r.billId !== null);
    if (billedRecord) {
      throw new ConflictException(
        'Không thể sửa điểm danh: một hoặc nhiều học sinh trong buổi học này đã được tính tiền vào hóa đơn. Vui lòng liên hệ kế toán để điều chỉnh.'
      );
    }

    // Apply the override
    for (const item of body.attendance) {
      let record = await this.attendanceRepo.findOne({
        where: { classSessionId: sessionId, studentId: item.studentId }
      });

      if (!record) {
        record = this.attendanceRepo.create({
          classSessionId: sessionId,
          studentId: item.studentId,
        });
      }

      record.isPresent = item.isPresent;
      record.reason = item.reason || null;
      record.note = item.note || null;
      await this.attendanceRepo.save(record);
    }

    return { message: 'Đã cập nhật điểm danh thành công (Admin override)' };
  }

  @Post('sessions/:sessionId/complete')
  @ApiOperation({ summary: 'Kết thúc buổi học (chuyển trạng thái sang Hoàn thành)' })
  async completeSession(@Param('sessionId') sessionId: string) {
    const session = await this.sessionRepo.findOneOrFail({ where: { id: sessionId } });
    session.status = 'Completed';
    session.attendanceLocked = true;
    await this.sessionRepo.save(session);
    return session;
  }

  @Put('sessions/:sessionId')
  @ApiOperation({ summary: 'Cập nhật một buổi học cụ thể (đổi lịch, đổi phòng, đổi giáo viên)' })
  async updateSession(
    @Param('sessionId') sessionId: string,
    @Body() body: {
      date?: string;
      startTime?: string;
      endTime?: string;
      roomId?: string;
      teacherId?: string;
      status?: string;
      scope?: 'single' | 'all-future';
    }
  ) {
    const session = await this.sessionRepo.findOneOrFail({ where: { id: sessionId } });

    if (session.attendanceLocked) {
      throw new ConflictException(
        'Completed or attendance-locked sessions cannot be changed.',
      );
    }

    // "không được đổi quá khứ"
    const today = new Date().toISOString().split('T')[0];
    if (session.date < today) {
      throw new Error('Không được thay đổi thông tin buổi học trong quá khứ.');
    }

    if (body.date && body.date < today) {
      throw new Error('Không được dời buổi học về quá khứ.');
    }

    const scope = body.scope || 'single';
    const nextStartTime = body.startTime ?? session.startTime;
    const nextEndTime = body.endTime ?? session.endTime;
    validateSchedules([
      {
        weekday: 'Mon',
        startTime: nextStartTime,
        endTime: nextEndTime,
      },
    ]);

    if (scope === 'all-future' && body.date !== undefined) {
      throw new ConflictException(
        'A date change can only be applied to one session.',
      );
    }

    if (scope === 'single') {
      await this.runAcademic(() =>
        this.checkSessionScheduleConflict.execute(
          {
            date: body.date ?? session.date,
            startTime: nextStartTime,
            endTime: nextEndTime,
            roomId:
              body.roomId !== undefined
                ? body.roomId || null
                : session.roomId,
            teacherId:
              body.teacherId !== undefined
                ? body.teacherId || null
                : session.teacherId,
          },
          session.id,
        ),
      );
      if (body.date !== undefined) session.date = body.date;
      if (body.startTime !== undefined) session.startTime = body.startTime;
      if (body.endTime !== undefined) session.endTime = body.endTime;
      if (body.roomId !== undefined) session.roomId = body.roomId || null;
      if (body.teacherId !== undefined) session.teacherId = body.teacherId || null;
      if (body.status !== undefined) session.status = body.status;
      await this.sessionRepo.save(session);
    } else {
      const futureSessions = await this.sessionRepo
        .createQueryBuilder('s')
        .where('s.class_id = :classId', { classId: session.classId })
        .andWhere('s.date >= :startDate', { startDate: session.date })
        .andWhere('s.attendance_locked = false')
        .getMany();

      for (const fs of futureSessions) {
        await this.runAcademic(() =>
          this.checkSessionScheduleConflict.execute(
            {
              date: fs.date,
              startTime: body.startTime ?? fs.startTime,
              endTime: body.endTime ?? fs.endTime,
              roomId:
                body.roomId !== undefined ? body.roomId || null : fs.roomId,
              teacherId:
                body.teacherId !== undefined
                  ? body.teacherId || null
                  : fs.teacherId,
            },
            fs.id,
          ),
        );
        if (body.startTime !== undefined) fs.startTime = body.startTime;
        if (body.endTime !== undefined) fs.endTime = body.endTime;
        if (body.roomId !== undefined) fs.roomId = body.roomId || null;
        if (body.teacherId !== undefined) fs.teacherId = body.teacherId || null;
        if (body.status !== undefined) fs.status = body.status;
        await this.sessionRepo.save(fs);
      }
    }

    return { message: 'Cập nhật buổi học thành công' };
  }

  // ========= Private helpers =========

  private async generateSessions(classId: string) {
    const classEntity = await this.classRepo.findOneOrFail({ where: { id: classId } });
    const schedules = await this.scheduleRepo.find({ where: { classId } });

    if (
      classEntity.status !== 'Active' ||
      !classEntity.startDate ||
      schedules.length === 0
    ) {
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const startFromStr = classEntity.startDate > todayStr ? classEntity.startDate : todayStr;

    const startDate = new Date(startFromStr);
    const endDate = classEntity.finishDate ? new Date(classEntity.finishDate) : new Date(startDate);
    if (!classEntity.finishDate) {
      endDate.setMonth(endDate.getMonth() + 3); // Default 3 months if no end date
    }

    const weekdayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };

    const activeStudents = await this.classStudentRepo.find({
      where: { classId, status: 'Active' },
    });
    const holidayDates = classEntity.skipHolidays
      ? new Set(
          await this.getHolidayDates.execute(
            startFromStr,
            endDate.toISOString().split('T')[0],
          ),
        )
      : new Set<string>();

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const dateStr = d.toISOString().split('T')[0];
      if (holidayDates.has(dateStr)) continue;
      for (const schedule of schedules) {
        if (weekdayMap[schedule.weekday] === dayOfWeek) {
          // Check if session already exists
          const exists = await this.sessionRepo.findOne({
            where: { classId, date: dateStr, startTime: schedule.startTime },
          });
          if (exists) {
            // Update teacher if it's a future session and not locked
            if (!exists.attendanceLocked && exists.date >= todayStr) {
              exists.teacherId = classEntity.mainTeacherId;
              await this.sessionRepo.save(exists);
            }
            continue;
          }

          const session = this.sessionRepo.create({
            classId,
            roomId: schedule.roomId,
            teacherId: classEntity.mainTeacherId,
            date: dateStr,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            status: 'Scheduled',
            attendanceLocked: false,
          });
          const savedSession = await this.sessionRepo.save(session);

          // Create attendance records for all active students
          for (const cs of activeStudents) {
            const att = this.attendanceRepo.create({
              classSessionId: savedSession.id,
              studentId: cs.studentId,
              isPresent: false,
            });
            await this.attendanceRepo.save(att);
          }
        }
      }
    }
  }

  private async regenerateFutureSessions(classId: string) {
    const today = new Date().toISOString().split('T')[0];

    // Delete future unlocked sessions
    await this.sessionRepo
      .createQueryBuilder()
      .delete()
      .where('class_id = :classId', { classId })
      .andWhere('date >= :today', { today })
      .andWhere('attendance_locked = false')
      .execute();

    // Regenerate
    await this.generateSessions(classId);
  }

  private async notifyStudentAboutOpenAssignments(classId: string, studentId: string) {
    const [student, assignments] = await Promise.all([
      this.studentRepo.findOne({ where: { id: studentId } }),
      this.assignmentRepo.createQueryBuilder('assignment')
        .where('assignment.class_id = :classId', { classId })
        .andWhere('assignment.status = :status', { status: 'published' })
        .andWhere('(assignment.due_at IS NULL OR assignment.due_at > :now)', { now: new Date() })
        .getMany(),
    ]);
    if (!student?.userId || assignments.length === 0) return;
    await this.notificationRepo.save(assignments.map((assignment) => this.notificationRepo.create({
      userId: student.userId!,
      type: 'assignment_available',
      title: 'Bài tập đang mở trong lớp',
      message: assignment.title,
      linkPath: '/student/assignments',
      priority: 'important',
      metadata: { assignmentId: assignment.id, classId },
    })));
  }

  private async runAcademic<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (!(error instanceof AcademicError)) throw error;
      if (
        error.code === 'CLASS_NOT_FOUND' ||
        error.code === 'STUDENT_NOT_FOUND'
      ) {
        throw new NotFoundException(error.message);
      }
      throw new ConflictException(error.message);
    }
  }
}
