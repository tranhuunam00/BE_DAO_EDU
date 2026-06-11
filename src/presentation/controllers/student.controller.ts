import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';
import { AddStudentUseCase } from '../../application/use-cases/add-student.use-case';
import { GetStudentsUseCase } from '../../application/use-cases/get-students.use-case';
import { CreateStudentDto } from '../../application/dtos/student.dto';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentController {
  constructor(
    private readonly addStudentUseCase: AddStudentUseCase,
    private readonly getStudentsUseCase: GetStudentsUseCase,
  ) {}

  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateStudentDto) {
    return this.addStudentUseCase.execute(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.TEACHER)
  async findAll() {
    return this.getStudentsUseCase.execute();
  }
}
