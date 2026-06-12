import { Controller, Get, Post, Put, Delete, Body, Param, Query, ConflictException } from '@nestjs/common';
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

    return { classes, total, page: Number(page), limit: Number(limit) };
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

    return { ...classEntity, schedules, students };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo Lớp học mới' })
  async create(@Body() dto: CreateClassDto) {
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
      const statusChangedToActive = dto.status === 'Active' && classEntity.status !== 'Active';
      const hasExistingSessions = (await this.sessionRepo.count({ where: { classId: id } })) > 0;
      const dateOrHolidayChanged = (classEntity.status === 'Active' || hasExistingSessions) && (
        dto.startDate !== undefined ||
        dto.finishDate !== undefined ||
        dto.skipHolidays !== undefined
      );

      if (statusChangedToActive || dateOrHolidayChanged) {
        await this.regenerateFutureSessions(id);
      }
    }

    return this.findOne(id);
  }

  // ========= Class Students =========

  @Post(':id/students')
  @ApiOperation({ summary: 'Thêm Học sinh vào Lớp' })
  async addStudent(@Param('id') classId: string, @Body() body: { studentId: string }) {
    const existing = await this.classStudentRepo.findOne({
      where: { classId, studentId: body.studentId },
    });

    const updateStudentStatusToStudying = async () => {
      const student = await this.studentRepo.findOne({ where: { id: body.studentId } });
      if (student) {
        student.status = 'Studying';
        await this.studentRepo.save(student);
      }
    };

    if (existing) {
      if (existing.status === 'Dropped') {
        existing.status = 'Active';
        existing.joinedDate = new Date().toISOString().split('T')[0];
        await this.classStudentRepo.save(existing);

        await updateStudentStatusToStudying();

        // Generate attendance for future sessions
        await this.generateAttendanceForStudent(classId, body.studentId);
        return existing;
      }
      return existing; // already active
    }

    const cs = this.classStudentRepo.create({
      classId,
      studentId: body.studentId,
      status: 'Active',
      joinedDate: new Date().toISOString().split('T')[0],
    });
    const saved = await this.classStudentRepo.save(cs);

    await updateStudentStatusToStudying();

    // Generate attendance records for future sessions
    await this.generateAttendanceForStudent(classId, body.studentId);

    return saved;
  }

  @Delete(':id/students/:studentId')
  @ApiOperation({ summary: 'Kick Học sinh khỏi Lớp (Dropped)' })
  async removeStudent(@Param('id') classId: string, @Param('studentId') studentId: string) {
    const cs = await this.classStudentRepo.findOneOrFail({
      where: { classId, studentId },
    });
    cs.status = 'Dropped';
    await this.classStudentRepo.save(cs);

    // If student has no other active classes, set global status back to 'Waiting for class'
    const activeClasses = await this.classStudentRepo.count({
      where: { studentId, status: 'Active' },
    });
    if (activeClasses === 0) {
      const student = await this.studentRepo.findOne({ where: { id: studentId } });
      if (student) {
        student.status = 'Waiting for class';
        await this.studentRepo.save(student);
      }
    }

    // Remove future attendance (not locked ones)
    const today = new Date().toISOString().split('T')[0];
    const futureSessions = await this.sessionRepo
      .createQueryBuilder('s')
      .where('s.class_id = :classId', { classId })
      .andWhere('s.date >= :today', { today })
      .andWhere('s.attendance_locked = false')
      .getMany();

    for (const session of futureSessions) {
      await this.attendanceRepo.delete({
        classSessionId: session.id,
        studentId,
      });
    }

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

    // "không được đổi quá khứ"
    const today = new Date().toISOString().split('T')[0];
    if (session.date < today) {
      throw new Error('Không được thay đổi thông tin buổi học trong quá khứ.');
    }

    if (body.date && body.date < today) {
      throw new Error('Không được dời buổi học về quá khứ.');
    }

    const scope = body.scope || 'single';

    if (scope === 'single') {
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
        if (body.roomId !== undefined) fs.roomId = body.roomId || null;
        if (body.teacherId !== undefined) fs.teacherId = body.teacherId || null;
        await this.sessionRepo.save(fs);
      }
    }

    return { message: 'Cập nhật buổi học thành công' };
  }

  // ========= Private helpers =========

  private async generateSessions(classId: string) {
    const classEntity = await this.classRepo.findOneOrFail({ where: { id: classId } });
    const schedules = await this.scheduleRepo.find({ where: { classId } });

    if (!classEntity.startDate || schedules.length === 0) return;

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

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      for (const schedule of schedules) {
        if (weekdayMap[schedule.weekday] === dayOfWeek) {
          const dateStr = d.toISOString().split('T')[0];

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

  private async generateAttendanceForStudent(classId: string, studentId: string) {
    const today = new Date().toISOString().split('T')[0];
    const futureSessions = await this.sessionRepo
      .createQueryBuilder('s')
      .where('s.class_id = :classId', { classId })
      .andWhere('s.date >= :today', { today })
      .andWhere('s.attendance_locked = false')
      .getMany();

    for (const session of futureSessions) {
      const exists = await this.attendanceRepo.findOne({
        where: { classSessionId: session.id, studentId },
      });
      if (!exists) {
        const att = this.attendanceRepo.create({
          classSessionId: session.id,
          studentId,
          isPresent: false,
        });
        await this.attendanceRepo.save(att);
      }
    }
  }
}
