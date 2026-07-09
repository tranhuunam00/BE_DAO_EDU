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
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }

    const firstMonthStr = months[0];
    const firstMonthStartDate = new Date(`${firstMonthStr}-01T00:00:00Z`);

    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      totalCourses,
      totalCenters,
      initialStudentsRes,
      newStudentsRes,
      courseDistribution,
      salaryRes,
      tuitionRes,
    ] = await Promise.all([
      this.studentRepo.count(),
      this.teacherRepo.count(),
      this.classRepo.count(),
      this.courseRepo.count(),
      this.centerRepo.count(),
      this.studentRepo.query(
        `SELECT COUNT(*)::int AS count FROM students WHERE created_at < $1`,
        [firstMonthStartDate]
      ),
      this.studentRepo.query(
        `SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*)::int AS count
         FROM students
         WHERE created_at >= $1
         GROUP BY month`,
        [firstMonthStartDate]
      ),
      this.studentRepo.query(
        `SELECT c.name AS name, COUNT(DISTINCT cs.student_id)::int AS value
         FROM courses c
         JOIN classes cl ON cl.course_id = c.id
         JOIN class_students cs ON cs.class_id = cl.id
         WHERE cs.status = 'Active'
         GROUP BY c.name
         ORDER BY value DESC
         LIMIT 5`
      ),
      this.studentRepo.query(
        `SELECT SUM(paid_amount) AS total FROM teacher_monthly_wages WHERE status = 'Paid'`
      ),
      this.studentRepo.query(
        `SELECT SUM(paid_amount) AS total FROM student_monthly_bills WHERE status = 'Paid'`
      ),
    ]);

    const monthlyNewCount = new Map<string, number>();
    if (Array.isArray(newStudentsRes)) {
      for (const row of newStudentsRes) {
        if (row && row.month) {
          monthlyNewCount.set(row.month, Number(row.count) || 0);
        }
      }
    }

    let cumulative = Number(initialStudentsRes?.[0]?.count || 0);
    const studentGrowth = months.map((month) => {
      const newCount = monthlyNewCount.get(month) || 0;
      cumulative += newCount;
      return {
        month,
        students: cumulative,
      };
    });

    return {
      message: 'Lấy thống kê hệ thống thành công',
      statistics: {
        totalStudents,
        totalTeachers,
        totalClasses,
        totalCourses,
        totalCenters,
        totalPaidSalary: Number(salaryRes?.[0]?.total || 0),
        totalCollectedTuition: Number(tuitionRes?.[0]?.total || 0),
        studentGrowth,
        courseDistribution: (courseDistribution || []).map((d: any) => ({
          name: d.name,
          value: Number(d.value),
        })),
        systemStatus: 'Hoạt động ổn định'
      }
    };
  }
}
