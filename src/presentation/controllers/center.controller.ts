import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';
import { AddCenterUseCase } from '../../application/use-cases/add-center.use-case';
import { GetCentersUseCase } from '../../application/use-cases/get-centers.use-case';
import { GetCenterByIdUseCase } from '../../application/use-cases/get-center-by-id.use-case';
import { UpdateCenterUseCase } from '../../application/use-cases/update-center.use-case';
import { CreateCenterDto, UpdateCenterDto } from '../../application/dtos/center.dto';

@ApiTags('Trung tâm (Centers)')
@ApiBearerAuth()
@Controller('centers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CenterController {
  constructor(
    private readonly addCenterUseCase: AddCenterUseCase,
    private readonly getCentersUseCase: GetCentersUseCase,
    private readonly getCenterByIdUseCase: GetCenterByIdUseCase,
    private readonly updateCenterUseCase: UpdateCenterUseCase,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Tạo mới thông tin trung tâm (Chỉ dành cho ADMIN)' })
  @ApiResponse({ status: 201, description: 'Tạo trung tâm mới thành công' })
  async create(@Body() dto: CreateCenterDto) {
    return this.addCenterUseCase.execute(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách tất cả trung tâm có phân trang và bộ lọc (Dành cho ADMIN)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'province', required: false })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('province') province?: string,
  ) {
    return this.getCentersUseCase.execute({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status,
      province,
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Lấy chi tiết một trung tâm theo ID (Dành cho ADMIN)' })
  async findOne(@Param('id') id: string) {
    return this.getCenterByIdUseCase.execute(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cập nhật thông tin trung tâm (Chỉ dành cho ADMIN)' })
  async update(@Param('id') id: string, @Body() dto: UpdateCenterDto) {
    return this.updateCenterUseCase.execute(id, dto);
  }
}
