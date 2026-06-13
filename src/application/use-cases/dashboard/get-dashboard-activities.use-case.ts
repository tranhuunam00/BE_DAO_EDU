import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { StudentOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/student.orm-entity';

@Injectable()
export class GetDashboardActivitiesUseCase {
  constructor(
    @InjectRepository(ClassOrmEntity)
    private readonly classRepo: Repository<ClassOrmEntity>,
    @InjectRepository(StudentOrmEntity)
    private readonly studentRepo: Repository<StudentOrmEntity>,
  ) {}

  async execute() {
    // Get 5 most recent classes
    const classes = await this.classRepo.find({
      order: { createdAt: 'DESC' },
      take: 5
    });

    // Get 5 most recent students
    const students = await this.studentRepo.find({
      order: { createdAt: 'DESC' },
      take: 5
    });

    const activities = [];

    for (const c of classes) {
      activities.push({
        id: `class-${c.id}`,
        action: 'Tạo lớp học mới',
        target: `Lớp ${c.className}`,
        time: c.createdAt,
        type: 'class'
      });
    }

    for (const s of students) {
      activities.push({
        id: `student-${s.id}`,
        action: 'Tiếp nhận học sinh',
        target: `Học sinh ${s.firstName} ${s.lastName}`,
        time: s.createdAt,
        type: 'student'
      });
    }

    // Sort combined by time DESC and take top 10
    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return {
      activities: activities.slice(0, 10)
    };
  }
}
