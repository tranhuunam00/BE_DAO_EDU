import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, ConflictException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CourseOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course.orm-entity';
import { CourseLevelOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course-level.orm-entity';
import { CourseLevelPricingOrmEntity } from '../../infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';
import { CreateCourseDto, UpdateCourseDto, CourseLevelPricingDto, CourseLevelDto, AddCourseLevelDto, UpdateCourseLevelDto } from '../../application/dtos/course.dto';

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

    // Get pricing for each level
    const levelsWithPricing = await Promise.all(
      levels.map(async (level) => {
        const pricing = await this.pricingRepo.find({
          where: { courseLevelId: level.id },
          order: { effectiveFrom: 'DESC' },
        });
        return { ...level, pricing };
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

    // Validate new dates overlap with any existing records
    const pricingList = await this.pricingRepo.find({ where: { courseLevelId: level.id } });
    const newFrom = dto.effectiveFrom;
    const newTo = dto.effectiveTo || null;

    if (newTo && newFrom > newTo) {
      throw new ConflictException('Ngày bắt đầu áp dụng không được sau ngày kết thúc.');
    }

    // 1. Auto-cap the current open-ended pricing (where effectiveTo is null)
    const activePricing = await this.pricingRepo.findOne({
      where: { courseLevelId: level.id, effectiveTo: IsNull() },
    });

    if (activePricing) {
      if (newFrom < activePricing.effectiveFrom) {
        throw new ConflictException(
          `Ngày bắt đầu áp dụng mới (${newFrom}) phải từ ngày bắt đầu của giá hiện hành (${activePricing.effectiveFrom}) trở đi.`
        );
      }

      // Cap the previous open pricing at 1 day before the new one starts
      const prevDate = new Date(newFrom);
      prevDate.setDate(prevDate.getDate() - 1);
      activePricing.effectiveTo = prevDate.toISOString().split('T')[0];
      await this.pricingRepo.save(activePricing);
    }

    // 2. Perform general overlap validation against all OTHER records (now including the capped activePricing)
    for (const p of pricingList) {
      if (p.id === activePricing?.id) {
        // Double check against the updated/capped active pricing just in case
        const capTo = activePricing.effectiveTo;
        if (capTo && (newFrom <= capTo) && (newTo === null || activePricing.effectiveFrom <= newTo)) {
          throw new ConflictException(`Khoảng thời gian này bị trùng lặp với giá hiện hành đã được điều chỉnh.`);
        }
        continue;
      }
      
      const pFrom = p.effectiveFrom;
      const pTo = p.effectiveTo;

      const overlap = (pTo === null || newFrom <= pTo) && (newTo === null || pFrom <= newTo);
      if (overlap) {
        throw new ConflictException(`Khoảng thời gian áp dụng trùng lặp với bảng giá đã cấu hình (${pFrom} - ${pTo || 'nay'}).`);
      }
    }

    const pricing = this.pricingRepo.create({
      courseLevelId: level.id,
      pricePerSession: dto.pricePerSession,
      teacherWagePerSession: dto.teacherWagePerSession,
      effectiveFrom: newFrom,
      effectiveTo: newTo,
    });

    return this.pricingRepo.save(pricing);
  }

  @Get('levels/:levelId/pricing')
  @ApiOperation({ summary: 'Lấy lịch sử giá của Level' })
  async getPricing(@Param('levelId') levelId: string) {
    return this.pricingRepo.find({
      where: { courseLevelId: levelId },
      order: { effectiveFrom: 'DESC' },
    });
  }
}
