import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ConflictException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import dayjs from 'dayjs';
import { CourseOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course.orm-entity';
import { CourseLevelOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course-level.orm-entity';
import { CourseLevelPricingOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';
import { StudentAttendanceOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { ClassOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import {
  CreateCourseDto,
  UpdateCourseDto,
  CourseLevelPricingDto,
  CourseLevelDto,
  AddCourseLevelDto,
  UpdateCourseLevelDto,
  UpdateCourseLevelPricingDto,
} from '../../application/dtos/course.dto';
import { GetCourseLevelPricingUseCase } from '../../modules/academics/application/use-cases/get-course-level-pricing.use-case';
import { UpdateCourseLevelPricingUseCase } from '../../modules/academics/application/use-cases/update-course-level-pricing.use-case';
import { DeleteCourseLevelPricingUseCase } from '../../modules/academics/application/use-cases/delete-course-level-pricing.use-case';
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
    private readonly updateCourseLevelPricingUseCase: UpdateCourseLevelPricingUseCase,
    private readonly deleteCourseLevelPricingUseCase: DeleteCourseLevelPricingUseCase,
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

    const [items, total] = await qb
      .orderBy('c.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      courses: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết Chương trình học' })
  async findOne(@Param('id') id: string) {
    const course = await this.courseRepo.findOneOrFail({ where: { id } });
    const levels = await this.levelRepo.find({ where: { courseId: id }, order: { createdAt: 'ASC' } });

    // Get pricing and counts for each level with full lock info
    const levelsWithPricing = await Promise.all(
      levels.map(async (level) => {
        const pricing = await this.getCourseLevelPricingUseCase.execute(level.id);

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

    // Save levels
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

    const newFrom = dto.effectiveFrom;
    const newTo = dto.effectiveTo || null;

    if (newTo && newFrom > newTo) {
      throw new ConflictException('Ngày bắt đầu áp dụng không được sau ngày kết thúc.');
    }

    // 1. Guard check: Must start AFTER the last reconciled date for each configured type
    const [lastStudentBillDate, lastTeacherWageDate, lastAssistantWageDate] = await Promise.all([
      this.coursePricingPort.getMaxStudentBillDate(level.id),
      this.coursePricingPort.getMaxTeacherWageDate(level.id),
      this.coursePricingPort.getMaxAssistantWageDate(level.id),
    ]);

    if (dto.pricePerSession !== undefined && lastStudentBillDate && newFrom <= lastStudentBillDate) {
      throw new ConflictException(
        `Ngày bắt đầu áp dụng học phí (${newFrom}) phải sau ngày chốt học phí gần nhất (${lastStudentBillDate}).`
      );
    }
    if (dto.teacherWagePerSession !== undefined && lastTeacherWageDate && newFrom <= lastTeacherWageDate) {
      throw new ConflictException(
        `Ngày bắt đầu áp dụng lương giáo viên (${newFrom}) phải sau ngày chốt lương gần nhất (${lastTeacherWageDate}).`
      );
    }
    if (dto.taWagePerSession !== undefined && lastAssistantWageDate && newFrom <= lastAssistantWageDate) {
      throw new ConflictException(
        `Ngày bắt đầu áp dụng lương trợ giảng (${newFrom}) phải sau ngày chốt lương trợ giảng gần nhất (${lastAssistantWageDate}).`
      );
    }

    // 2. Fetch existing pricing list ordered by effectiveFrom ASC
    const existingList = await this.pricingRepo.find({
      where: { courseLevelId: level.id },
      order: { effectiveFrom: 'ASC' },
    });

    // 3. Inherit values from active pricing at newFrom (or closest prior pricing)
    const activePricing = existingList
      .filter((p) => p.effectiveFrom <= newFrom && (!p.effectiveTo || p.effectiveTo >= newFrom))
      .pop() || existingList[existingList.length - 1];

    const finalPrice =
      dto.pricePerSession !== undefined
        ? Number(dto.pricePerSession)
        : activePricing
        ? Number(activePricing.pricePerSession)
        : 0;
    const finalTeacherWage =
      dto.teacherWagePerSession !== undefined
        ? Number(dto.teacherWagePerSession)
        : activePricing
        ? Number(activePricing.teacherWagePerSession)
        : 0;
    const finalTaWage =
      dto.taWagePerSession !== undefined
        ? Number(dto.taWagePerSession)
        : activePricing
        ? Number(activePricing.taWagePerSession)
        : 0;

    // 4. Timeline Slicing / Splitting
    // A. Check if there is an existing record starting on exactly the same day
    const sameStartPricing = existingList.find((p) => p.effectiveFrom === newFrom);
    if (sameStartPricing) {
      sameStartPricing.pricePerSession = finalPrice;
      sameStartPricing.teacherWagePerSession = finalTeacherWage;
      sameStartPricing.taWagePerSession = finalTaWage;
      if (dto.effectiveTo !== undefined) {
        sameStartPricing.effectiveTo = newTo;
      }
      return this.pricingRepo.save(sameStartPricing);
    }

    // B. Check if newFrom splits an existing interval [p.effectiveFrom, p.effectiveTo]
    const coveringPricing = existingList.find(
      (p) => p.effectiveFrom < newFrom && (p.effectiveTo === null || p.effectiveTo >= newFrom),
    );

    if (coveringPricing) {
      const oldEffectiveTo = coveringPricing.effectiveTo;
      // Truncate covering record
      coveringPricing.effectiveTo = dayjs(newFrom).subtract(1, 'day').format('YYYY-MM-DD');
      await this.pricingRepo.save(coveringPricing);

      const nextPricing = existingList.find((p) => p.effectiveFrom > newFrom);
      let resolvedNewTo = newTo;
      if (nextPricing && (!resolvedNewTo || resolvedNewTo >= nextPricing.effectiveFrom)) {
        resolvedNewTo = dayjs(nextPricing.effectiveFrom).subtract(1, 'day').format('YYYY-MM-DD');
      }

      // Create new middle / forward record
      const newPricing = this.pricingRepo.create({
        courseLevelId: level.id,
        pricePerSession: finalPrice,
        teacherWagePerSession: finalTeacherWage,
        taWagePerSession: finalTaWage,
        effectiveFrom: newFrom,
        effectiveTo: resolvedNewTo,
      });
      const savedNew = await this.pricingRepo.save(newPricing);

      // If new record has a closed end date (resolvedNewTo != null) and old record extended beyond resolvedNewTo:
      if (
        resolvedNewTo !== null &&
        (oldEffectiveTo === null || oldEffectiveTo > resolvedNewTo) &&
        (!nextPricing || nextPricing.effectiveFrom > dayjs(resolvedNewTo).add(1, 'day').format('YYYY-MM-DD'))
      ) {
        const suffixPricing = this.pricingRepo.create({
          courseLevelId: level.id,
          pricePerSession: coveringPricing.pricePerSession,
          teacherWagePerSession: coveringPricing.teacherWagePerSession,
          taWagePerSession: coveringPricing.taWagePerSession,
          effectiveFrom: dayjs(resolvedNewTo).add(1, 'day').format('YYYY-MM-DD'),
          effectiveTo: oldEffectiveTo,
        });
        await this.pricingRepo.save(suffixPricing);
      }

      return savedNew;
    }

    // C. Inserting in past (newFrom < next records)
    const nextPricing = existingList.find((p) => p.effectiveFrom > newFrom);
    let resolvedNewTo = newTo;
    if (nextPricing && (!resolvedNewTo || resolvedNewTo >= nextPricing.effectiveFrom)) {
      resolvedNewTo = dayjs(nextPricing.effectiveFrom).subtract(1, 'day').format('YYYY-MM-DD');
    }

    const pricing = this.pricingRepo.create({
      courseLevelId: level.id,
      pricePerSession: finalPrice,
      teacherWagePerSession: finalTeacherWage,
      taWagePerSession: finalTaWage,
      effectiveFrom: newFrom,
      effectiveTo: resolvedNewTo,
    });

    return this.pricingRepo.save(pricing);
  }

  @Put('pricing/:id')
  @ApiOperation({ summary: 'Cập nhật bản ghi đơn giá' })
  async updatePricing(@Param('id') id: string, @Body() dto: UpdateCourseLevelPricingDto) {
    return this.runAcademic(() => this.updateCourseLevelPricingUseCase.execute(id, dto));
  }

  @Delete('pricing/:id')
  @ApiOperation({ summary: 'Xóa bản ghi đơn giá' })
  async deletePricing(@Param('id') id: string) {
    return this.runAcademic(() => this.deleteCourseLevelPricingUseCase.execute(id));
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
    const sessionCount = await this.pricingRepo.manager
      .getRepository(ClassSessionOrmEntity)
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