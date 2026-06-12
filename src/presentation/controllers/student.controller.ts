import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';
import { AddStudentUseCase } from '../../application/use-cases/add-student.use-case';
import { GetStudentsUseCase } from '../../application/use-cases/get-students.use-case';
import { GetStudentByIdUseCase } from '../../application/use-cases/get-student-by-id.use-case';
import { UpdateStudentUseCase } from '../../application/use-cases/update-student.use-case';
import { CreateStudentDto, UpdateStudentDto } from '../../application/dtos/student.dto';
import { ClassStudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';

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
    @InjectRepository(ClassStudentOrmEntity)
    private readonly classStudentRepo: Repository<ClassStudentOrmEntity>,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Tạo mới hồ sơ học sinh (Chỉ dành cho ADMIN)' })
  @ApiResponse({ status: 201, description: 'Tạo học sinh mới thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ hoặc thiếu trường bắt buộc' })
  @ApiResponse({ status: 409, description: 'Email tài khoản đăng nhập học sinh đã tồn tại' })
  @ApiResponse({ status: 403, description: 'Từ chối truy cập (Bạn không phải ADMIN)' })
  async create(@Body() dto: CreateStudentDto) {
    return this.addStudentUseCase.execute(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Lấy danh sách tất cả học sinh có phân trang và bộ lọc (Dành cho ADMIN & TEACHER)' })
  @ApiQuery({ name: 'page', required: false, description: 'Số trang muốn lấy', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Số bản ghi mỗi trang', example: 10 })
  @ApiQuery({ name: 'search', required: false, description: 'Từ khóa tìm kiếm (Họ tên, mã học sinh, ĐT, email)' })
  @ApiQuery({ name: 'status', required: false, description: 'Lọc theo trạng thái học tập' })
  @ApiQuery({ name: 'province', required: false, description: 'Lọc theo Tỉnh / Thành phố' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách thành công' })
  @ApiResponse({ status: 401, description: 'Yêu cầu token xác thực' })
  @ApiResponse({ status: 403, description: 'Từ chối truy cập (Học sinh không có quyền xem danh sách này)' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('province') province?: string,
  ) {
    return this.getStudentsUseCase.execute({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status,
      province,
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Lấy chi tiết một học sinh theo ID (Dành cho ADMIN & TEACHER)' })
  @ApiResponse({ status: 200, description: 'Lấy thông tin học sinh thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học sinh' })
  async findOne(@Param('id') id: string) {
    return this.getStudentByIdUseCase.execute(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cập nhật thông tin học sinh (Chỉ dành cho ADMIN)' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học sinh' })
  @ApiResponse({ status: 403, description: 'Từ chối truy cập (Bạn không phải ADMIN)' })
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
        }
      },
      order: { joinedDate: 'DESC' }
    });
  }
}
