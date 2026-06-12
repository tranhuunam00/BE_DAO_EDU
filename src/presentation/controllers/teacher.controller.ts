import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';
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
}
