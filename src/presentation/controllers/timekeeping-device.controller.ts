import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpStatus, HttpCode, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimekeepingDeviceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/timekeeping-device.orm-entity';
import { TimekeepingLogOrmEntity } from '../../infrastructure/persistence/typeorm/entities/timekeeping-log.orm-entity';
import { TeacherOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { SyncStudentToDeviceUseCase } from '../../modules/timekeeping/application/use-cases/sync-student-to-device.use-case';
import { ConfigureWebhookUseCase } from '../../modules/timekeeping/application/use-cases/configure-webhook.use-case';
import { SyncDeviceTimeUseCase } from '../../modules/timekeeping/application/use-cases/sync-device-time.use-case';
import { ReconcileTimekeepingLogsUseCase } from '../../modules/timekeeping/application/use-cases/reconcile-timekeeping-logs.use-case';
import { MinioService } from '../../infrastructure/storage/minio.service';

@Controller('timekeeping')
export class TimekeepingDeviceController {
  constructor(
    @InjectRepository(TimekeepingDeviceOrmEntity)
    private readonly deviceRepository: Repository<TimekeepingDeviceOrmEntity>,

    @InjectRepository(TimekeepingLogOrmEntity)
    private readonly logRepository: Repository<TimekeepingLogOrmEntity>,

    @InjectRepository(TeacherOrmEntity)
    private readonly teacherRepository: Repository<TeacherOrmEntity>,

    private readonly syncStudentUseCase: SyncStudentToDeviceUseCase,
    private readonly configureWebhookUseCase: ConfigureWebhookUseCase,
    private readonly syncTimeUseCase: SyncDeviceTimeUseCase,
    private readonly reconcileUseCase: ReconcileTimekeepingLogsUseCase,
    private readonly minioService: MinioService,
  ) { }

  @Get('logs')
  async listLogs(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('verifyMethod') verifyMethod?: string,
    @Query('matchStatus') matchStatus?: 'all' | 'matched' | 'unmatched',
    @Query('role') role?: 'student' | 'teacher' | 'all' | 'unmatched',
    @Query('sessionMatchStatus') sessionMatchStatus?: 'all' | 'matched' | 'unmatched',
    @Query('classId') classId?: string,
  ): Promise<{ logs: TimekeepingLogOrmEntity[]; total: number }> {
    const qb = this.logRepository.createQueryBuilder('log')
      .leftJoinAndSelect('log.student', 'student')
      .leftJoinAndSelect('log.teacher', 'teacher')
      .orderBy('log.eventTime', 'DESC');

    if (search) {
      const searchLower = `%${search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(log.employeeNo) LIKE :search OR LOWER(student.lastName) LIKE :search OR LOWER(student.firstName) LIKE :search OR LOWER(CONCAT(student.lastName, \' \', student.firstName)) LIKE :search OR LOWER(teacher.lastName) LIKE :search OR LOWER(teacher.firstName) LIKE :search OR LOWER(CONCAT(teacher.lastName, \' \', teacher.firstName)) LIKE :search)',
        { search: searchLower }
      );
    }

    // Lọc theo vai trò (học sinh / giáo viên)
    if (role === 'student') {
      qb.andWhere('log.studentId IS NOT NULL');
    } else if (role === 'teacher') {
      qb.andWhere('log.teacherId IS NOT NULL');
    } else if (role === 'unmatched') {
      qb.andWhere('log.studentId IS NULL AND log.teacherId IS NULL');
    }

    // Lọc theo khoảng ngày (startDate & endDate) hoặc ngày đơn (date)
    if (startDate) {
      const start = new Date(`${startDate}T00:00:00+07:00`);
      qb.andWhere('log.eventTime >= :start', { start });
    }
    if (endDate) {
      const end = new Date(`${endDate}T23:59:59+07:00`);
      qb.andWhere('log.eventTime <= :end', { end });
    }
    if (!startDate && !endDate && date) {
      const start = new Date(`${date}T00:00:00+07:00`);
      const end = new Date(`${date}T23:59:59+07:00`);
      qb.andWhere('log.eventTime BETWEEN :start AND :end', { start, end });
    }

    // Lọc theo hình thức xác thực
    if (verifyMethod) {
      qb.andWhere('log.verifyMethod = :verifyMethod', { verifyMethod });
    }

    // Lọc theo trạng thái khớp học sinh
    if (matchStatus === 'matched') {
      qb.andWhere('log.studentId IS NOT NULL');
    } else if (matchStatus === 'unmatched') {
      qb.andWhere('log.studentId IS NULL');
    }

    // Lọc theo trạng thái khớp ca học
    if (sessionMatchStatus === 'matched') {
      qb.andWhere('log.matchedSessions IS NOT NULL');
    } else if (sessionMatchStatus === 'unmatched') {
      qb.andWhere('log.matchedSessions IS NULL');
    }

    // Lọc theo lớp học (classId) của ca học khớp
    if (classId) {
      qb.andWhere(`
        EXISTS (
          SELECT 1 FROM jsonb_to_recordset(
            CASE 
              WHEN jsonb_typeof(log.matched_sessions) = 'array' THEN log.matched_sessions 
              ELSE '[]'::jsonb 
            END
          ) AS x(id uuid)
          INNER JOIN class_sessions cs ON cs.id = x.id
          WHERE cs.class_id = :classId
        )
      `, { classId });
    }

    const parsedPage = Number(page) || 1;
    const parsedLimit = Number(limit) || 20;
    const skip = (parsedPage - 1) * parsedLimit;

    qb.skip(skip).take(parsedLimit);

    const [logs, total] = await qb.getManyAndCount();

    const logsWithUrls = await Promise.all(
      logs.map(async (log) => {
        let imageUrl: string | null = null;
        if (log.imageKey) {
          try {
            imageUrl = await this.minioService.getPresignedUrl(log.imageKey);
          } catch (e) {
            // ignore error
          }
        }
        return {
          ...log,
          imageUrl,
        };
      })
    );

    return { logs: logsWithUrls as any, total };
  }

  @Get('devices')
  async listDevices(): Promise<TimekeepingDeviceOrmEntity[]> {
    return this.deviceRepository.find({ order: { name: 'ASC' } });
  }

  @Post('devices')
  async createDevice(@Body() data: Partial<TimekeepingDeviceOrmEntity>): Promise<TimekeepingDeviceOrmEntity> {
    const device = this.deviceRepository.create(data);
    return this.deviceRepository.save(device);
  }

  @Put('devices/:id')
  async updateDevice(
    @Param('id') id: string,
    @Body() data: Partial<TimekeepingDeviceOrmEntity>,
  ): Promise<TimekeepingDeviceOrmEntity | null> {
    await this.deviceRepository.update(id, data);
    return this.deviceRepository.findOne({ where: { id } });
  }

  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDevice(@Param('id') id: string): Promise<void> {
    await this.deviceRepository.delete(id);
  }

  @Post('sync-student/:studentId')
  async syncStudent(
    @Param('studentId') studentId: string,
    @Body() body?: { status?: boolean },
  ): Promise<{ success: boolean; isSyncedToDevice: boolean }> {
    const newStatus = await this.syncStudentUseCase.execute(studentId, body?.status);
    return { success: true, isSyncedToDevice: newStatus };
  }

  @Post('sync-teacher/:teacherId')
  async syncTeacher(
    @Param('teacherId') teacherId: string,
    @Body() body?: { status?: boolean },
  ): Promise<{ success: boolean; isSyncedToDevice: boolean }> {
    const teacher = await this.teacherRepository.findOne({ where: { id: teacherId } });
    if (!teacher) {
      throw new NotFoundException(`Giáo viên không tồn tại trên hệ thống.`);
    }
    const newStatus = body?.status !== undefined ? body.status : !teacher.isSyncedToDevice;
    teacher.isSyncedToDevice = newStatus;
    await this.teacherRepository.save(teacher);
    return { success: true, isSyncedToDevice: newStatus };
  }

  @Post('setup-webhook/:deviceId')
  async setupWebhook(
    @Param('deviceId') deviceId: string,
    @Body() body: { serverIp: string; serverPort: number },
  ): Promise<{ success: boolean }> {
    await this.configureWebhookUseCase.execute(deviceId, body.serverIp, body.serverPort);
    return { success: true };
  }

  @Post('sync-time/:deviceId')
  async syncTime(@Param('deviceId') deviceId: string): Promise<{ success: boolean }> {
    await this.syncTimeUseCase.execute(deviceId);
    return { success: true };
  }

  @Post('manual-reconcile')
  async manualReconcile(@Body() body: { date: string }): Promise<{ success: boolean; eventsProcessed: number }> {
    console.log("heheehheheheeh")
    const result = await this.reconcileUseCase.execute(body.date);
    return { success: true, eventsProcessed: result.eventsProcessed };
  }
}
