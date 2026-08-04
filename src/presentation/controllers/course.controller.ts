import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ConflictException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { CourseOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course.orm-entity';
import { CourseLevelOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course-level.orm-entity';
import { CourseLevelPricingOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { ClassOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { CreateCourseDto, UpdateCourseDto, CourseLevelPricingDto, CourseLevelDto, AddCourseLevelDto, UpdateCourseLevelDto } from '../../application/dtos/course.dto';
import { GetCourseLevelPricingUseCase } from '../../modules/academics/application/use-cases/get-course-level-pricing.use-case';
import { AcademicError } from '../../modules/academics/domain/errors/academic.error';
import { CoursePricingPersistencePort } from '../../modules/academics/application/ports/course-pricing-persistence.port';

@ApiTags('Courses')
@Controller('courses')
export class CourseController {
  constructor(
    @InjectRepository(CourseOrmEntity)
    private readonly courseRepo: Repository<CourseOrmEntity>,
    @InjectRepository(CourseLevelOrmEntity)
    private readonly levelRepo: Repository<CourseLevelOrmEntity>,
    @InjectRepository(CourseLevelPricingOrmEntity)
    private readonly pricingRepo: Repository<CourseLevelPricingOrmEntity>,
    private readonly getCourseLevelPricingUseCase: GetCourseLevelPricingUseCase,
    private readonly coursePricingPort: CoursePricingPersistencePort,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách Chương trình học' })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    const qb = this.courseRepo.createQueryBuilder('c');

    if (search) {
      qb.andWhere('(c.name ILIKE :s OR c.short_name ILIKE :s)', { s: `%${search}%` });
    }
    if (status) {
      qb.andWhere('c.status = :status', { status });
    }
    if (category) {
      qb.andWhere('c.category = :category', { category });
    }

    qb.orderBy('c.created_at', 'DESC');
    const total = await qb.getCount();
    const courses = await qb.skip((page - 1) * limit).take(limit).getMany();

    return { courses, total, page: Number(page), limit: Number(limit) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết Chương trình học' })
  async findOne(@Param('id') id: string) {
    const course = await this.courseRepo.findOneOrFail({ where: { id } });
    const levels = await this.levelRepo.find({ where: { courseId: id }, order: { createdAt: 'ASC' } });

    // Get pricing and counts for each level
    const levelsWithPricing = await Promise.all(
      levels.map(async (level) => {
        const pricing = await this.pricingRepo.find({
          where: { courseLevelId: level.id },
          order: { effectiveFrom: 'DESC' },
        });

        const classCount = await this.pricingRepo.manager.getRepository(ClassOrmEntity).count({
          where: { courseLevelId: level.id },
        });

        const sessionCount = await this.pricingRepo.manager.getRepository(ClassSessionOrmEntity)
          .createQueryBuilder('session')
          .innerJoin('session.classEntity', 'class')
          .where('class.courseLevelId = :levelId', { levelId: level.id })
          .getCount();

        return { ...level, pricing, classCount, sessionCount };
      }),
    );

    return { ...course, levels: levelsWithPricing };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo Chương trình học mới' })
  async create(@Body() dto: CreateCourseDto) {
    if (!dto.levels || dto.levels.length === 0) {
      throw new ConflictException('Chương trình học phải có ít nhất một level cấu hình.');
    }

    const exists = await this.courseRepo.createQueryBuilder('c')
      .where('LOWER(c.short_name) = LOWER(:sn)', { sn: dto.shortName.trim() })
      .getOne();
    if (exists) {
      throw new ConflictException('Mã chương trình học này đã tồn tại.');
    }

    const course = this.courseRepo.create({
      category: dto.category,
      name: dto.name,
      shortName: dto.shortName,
      typeOfPeriod: dto.typeOfPeriod || null,
      year: dto.year || null,
      maxSize: dto.maxSize || null,
      status: dto.status || 'Active',
      description: dto.description || null,
      assignedTo: dto.assignedTo || null,
      centerId: dto.centerId || null,
    });

    const saved = await this.courseRepo.save(course);

    // Create levels if provided
    if (dto.levels && dto.levels.length > 0) {
      for (const levelDto of dto.levels) {
        const level = this.levelRepo.create({
          courseId: saved.id,
          levelName: levelDto.levelName,
          levelCode: levelDto.levelCode,
          totalHours: levelDto.totalHours,
          isFixedHour: levelDto.isFixedHour || false,
          canUpgrade: levelDto.canUpgrade || false,
          gradebookSetting: levelDto.gradebookSetting || null,
        });
        await this.levelRepo.save(level);
      }
    }

    return this.findOne(saved.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật Chương trình học' })
  async update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    const course = await this.courseRepo.findOneOrFail({ where: { id } });

    if (dto.category !== undefined) course.category = dto.category;
    if (dto.name !== undefined) course.name = dto.name;
    if (dto.shortName !== undefined) course.shortName = dto.shortName;
    if (dto.typeOfPeriod !== undefined) course.typeOfPeriod = dto.typeOfPeriod || null;
    if (dto.year !== undefined) course.year = dto.year || null;
    if (dto.maxSize !== undefined) course.maxSize = dto.maxSize || null;
    if (dto.status !== undefined) course.status = dto.status;
    if (dto.description !== undefined) course.description = dto.description || null;
    if (dto.assignedTo !== undefined) course.assignedTo = dto.assignedTo || null;
    if (dto.centerId !== undefined) course.centerId = dto.centerId || null;

    await this.courseRepo.save(course);

    // Sync levels if provided
    if (dto.levels !== undefined) {
      await this.levelRepo.delete({ courseId: id });
      for (const levelDto of dto.levels) {
        const level = this.levelRepo.create({
          courseId: id,
          levelName: levelDto.levelName,
          levelCode: levelDto.levelCode,
          totalHours: levelDto.totalHours,
          isFixedHour: levelDto.isFixedHour || false,
          canUpgrade: levelDto.canUpgrade || false,
          gradebookSetting: levelDto.gradebookSetting || null,
        });
        await this.levelRepo.save(level);
      }
    }

    return this.findOne(id);
  }

  @Post(':id/levels')
  @ApiOperation({ summary: 'Thêm Level cho Chương trình học' })
  async addLevel(@Param('id') id: string, @Body() dto: AddCourseLevelDto) {
    const course = await this.courseRepo.findOneOrFail({ where: { id } });

    const exists = await this.levelRepo.findOne({
      where: { courseId: id, levelCode: dto.levelCode.trim() },
    });
    if (exists) {
      throw new ConflictException('Mã Level này đã tồn tại trong chương trình học.');
    }

    const level = this.levelRepo.create({
      courseId: id,
      levelName: dto.levelName,
      levelCode: dto.levelCode,
      totalHours: dto.totalHours,
      isFixedHour: dto.isFixedHour || false,
      canUpgrade: dto.canUpgrade || false,
      gradebookSetting: dto.gradebookSetting || null,
    });

    const savedLevel = await this.levelRepo.save(level);

    // Save initial level pricing
    const pricing = this.pricingRepo.create({
      courseLevelId: savedLevel.id,
      pricePerSession: dto.pricePerSession,
      teacherWagePerSession: dto.teacherWagePerSession,
      taWagePerSession: dto.taWagePerSession,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: null,
    });
    await this.pricingRepo.save(pricing);

    return this.findOne(id);
  }

  @Put('levels/:levelId')
  @ApiOperation({ summary: 'Cập nhật thông tin Level' })
  async updateLevel(@Param('levelId') levelId: string, @Body() dto: UpdateCourseLevelDto) {
    const level = await this.levelRepo.findOneOrFail({ where: { id: levelId } });

    if (dto.levelCode !== undefined && dto.levelCode.trim() !== level.levelCode) {
      const exists = await this.levelRepo.findOne({
        where: { courseId: level.courseId, levelCode: dto.levelCode.trim() },
      });
      if (exists) {
        throw new ConflictException('Mã Level này đã tồn tại trong chương trình học.');
      }
      level.levelCode = dto.levelCode.trim();
    }

    if (dto.levelName !== undefined) level.levelName = dto.levelName;
    if (dto.totalHours !== undefined) level.totalHours = dto.totalHours;
    if (dto.isFixedHour !== undefined) level.isFixedHour = dto.isFixedHour;
    if (dto.canUpgrade !== undefined) level.canUpgrade = dto.canUpgrade;
    if (dto.gradebookSetting !== undefined) level.gradebookSetting = dto.gradebookSetting || null;

    await this.levelRepo.save(level);
    return this.findOne(level.courseId);
  }

  // ========= Level Pricing Endpoints =========

  @Post('levels/:levelId/pricing')
  @ApiOperation({ summary: 'Thêm Bảng giá cho Level' })
  async addPricing(@Param('levelId') levelId: string, @Body() dto: CourseLevelPricingDto) {
    const level = await this.levelRepo.findOneOrFail({ where: { id: levelId } });

    // Identify which pricing type is being configured (tuition, teacher wage, assistant wage)
    let rateField: 'pricePerSession' | 'teacherWagePerSession' | 'taWagePerSession' | null = null;
    if (dto.pricePerSession !== undefined && Number(dto.pricePerSession) > 0) {
      rateField = 'pricePerSession';
    } else if (dto.teacherWagePerSession !== undefined && Number(dto.teacherWagePerSession) > 0) {
      rateField = 'teacherWagePerSession';
    } else if (dto.taWagePerSession !== undefined && Number(dto.taWagePerSession) > 0) {
      rateField = 'taWagePerSession';
    }

    if (!rateField) {
      throw new ConflictException('Vui lòng cung cấp tối thiểu một giá trị học phí hoặc lương hợp lệ (> 0).');
    }

    // Filter historical records of the same type to validate overlaps
    const pricingList = (await this.pricingRepo.find({ where: { courseLevelId: level.id } }))
      .filter(p => Number(p[rateField]) > 0);

    const newFrom = dto.effectiveFrom;
    const newTo = dto.effectiveTo || null;

    if (newTo && newFrom > newTo) {
      throw new ConflictException('Ngày bắt đầu áp dụng không được sau ngày kết thúc.');
    }

    // 1. Guard: new pricing must start AFTER the last reconciled (chốt sổ) session date for this type
    let lastReconciledDate: string | null = null;
    if (rateField === 'pricePerSession') {
      lastReconciledDate = await this.coursePricingPort.getMaxStudentBillDate(level.id);
    } else if (rateField === 'teacherWagePerSession') {
      lastReconciledDate = await this.coursePricingPort.getMaxTeacherWageDate(level.id);
    } else if (rateField === 'taWagePerSession') {
      lastReconciledDate = await this.coursePricingPort.getMaxAssistantWageDate(level.id);
    }

    if (lastReconciledDate && newFrom <= lastReconciledDate) {
      throw new ConflictException(
        `Ngày bắt đầu áp dụng (${newFrom}) phải sau ngày chốt sổ gần nhất (${lastReconciledDate}). Các buổi trước hoặc đúng ngày này đã được tính tiền/lương.`
      );
    }



    const pricing = this.pricingRepo.create({
      courseLevelId: level.id,
      pricePerSession: dto.pricePerSession || 0,
      teacherWagePerSession: dto.teacherWagePerSession || 0,
      taWagePerSession: dto.taWagePerSession || 0,
      effectiveFrom: newFrom,
      effectiveTo: newTo,
    });

    return this.pricingRepo.save(pricing);
  }

  @Delete('levels/:levelId')
  @ApiOperation({ summary: 'Xóa Level nếu chưa có lớp học hay buổi học nào sử dụng' })
  async deleteLevel(@Param('levelId') levelId: string) {
    const level = await this.levelRepo.findOneOrFail({ where: { id: levelId } });

    // 1. Check if any classes reference this level
    const classCount = await this.pricingRepo.manager.getRepository(ClassOrmEntity).count({
      where: { courseLevelId: levelId },
    });

    if (classCount > 0) {
      throw new ConflictException('Không thể xóa Level vì đã có lớp học sử dụng.');
    }

    // 2. Check if any class sessions are associated with this level
    const sessionCount = await this.pricingRepo.manager.getRepository(ClassSessionOrmEntity)
      .createQueryBuilder('session')
      .innerJoin('session.classEntity', 'class')
      .where('class.courseLevelId = :levelId', { levelId })
      .getCount();

    if (sessionCount > 0) {
      throw new ConflictException('Không thể xóa Level vì có buổi học/điểm danh liên quan.');
    }

    // 3. Delete pricing rules then delete level
    await this.pricingRepo.delete({ courseLevelId: levelId });
    await this.levelRepo.delete(levelId);

    return { message: 'Xóa Level thành công' };
  }

  @Get('levels/:levelId/active-classes')
  @ApiOperation({ summary: 'Lấy danh sách các lớp đang hoạt động của Level' })
  async getActiveClasses(@Param('levelId') levelId: string) {
    return this.pricingRepo.manager.getRepository(ClassOrmEntity).find({
      where: { courseLevelId: levelId, status: 'Active' },
      select: {
        id: true,
        className: true,
        classCode: true,
      },
    });
  }

  @Get('levels/:levelId/pricing')
  @ApiOperation({ summary: 'Lấy lịch sử giá của Level kèm trạng thái khóa đối soát' })
  async getPricing(@Param('levelId') levelId: string) {
    return this.getCourseLevelPricingUseCase.execute(levelId);
  }

  private async runAcademic<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof AcademicError) {
        if (error.code === 'PRICING_NOT_FOUND') {
          throw new NotFoundException(error.message);
        }
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
