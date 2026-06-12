import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';
import { AddStudentUseCase } from '../../application/use-cases/add-student.use-case';
import { GetStudentsUseCase } from '../../application/use-cases/get-students.use-case';
import { CreateStudentDto } from '../../application/dtos/student.dto';

@ApiTags('Học sinh (Students)')
@ApiBearerAuth() // Đánh dấu API yêu cầu xác thực JWT Bearer Token
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentController {
  constructor(
    private readonly addStudentUseCase: AddStudentUseCase,
    private readonly getStudentsUseCase: GetStudentsUseCase,
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
  @ApiOperation({ summary: 'Lấy danh sách tất cả học sinh (Dành cho ADMIN & TEACHER)' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách thành công' })
  @ApiResponse({ status: 401, description: 'Yêu cầu token xác thực' })
  @ApiResponse({ status: 403, description: 'Từ chối truy cập (Học sinh không có quyền xem danh sách này)' })
  async findAll() {
    return this.getStudentsUseCase.execute();
  }
}
