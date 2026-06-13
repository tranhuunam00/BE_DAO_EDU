import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { TeacherOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { ClassOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { CourseOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/course.orm-entity';
import { CenterOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/center.orm-entity';

@Injectable()
export class GetDashboardSummaryUseCase {
  constructor(
    @InjectRepository(StudentOrmEntity)
    private readonly studentRepo: Repository<StudentOrmEntity>,
    @InjectRepository(TeacherOrmEntity)
    private readonly teacherRepo: Repository<TeacherOrmEntity>,
    @InjectRepository(ClassOrmEntity)
    private readonly classRepo: Repository<ClassOrmEntity>,
    @InjectRepository(CourseOrmEntity)
    private readonly courseRepo: Repository<CourseOrmEntity>,
    @InjectRepository(CenterOrmEntity)
    private readonly centerRepo: Repository<CenterOrmEntity>,
  ) {}

  async execute() {
    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      totalCourses,
      totalCenters
    ] = await Promise.all([
      this.studentRepo.count(),
      this.teacherRepo.count(),
      this.classRepo.count(),
      this.courseRepo.count(),
      this.centerRepo.count(),
    ]);

    return {
      message: 'Lấy thống kê hệ thống thành công',
      statistics: {
        totalStudents,
        totalTeachers,
        totalClasses,
        totalCourses,
        totalCenters,
        systemStatus: 'Hoạt động ổn định'
      }
    };
  }
}
