import { getMetadataArgsStorage } from 'typeorm';
import { StudentAttendanceOrmEntity } from '../../../../../../src/infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { ClassSessionOrmEntity } from '../../../../../../src/infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { ClassStudentOrmEntity } from '../../../../../../src/infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { StudentMonthlyBillOrmEntity } from '../../../../../../src/infrastructure/persistence/typeorm/entities/student-monthly-bill.orm-entity';
import { StudentMonthlyBillItemOrmEntity } from '../../../../../../src/infrastructure/persistence/typeorm/entities/student-monthly-bill-item.orm-entity';

describe('Database Indexes Spec (TDD)', () => {
  it('should define indexes on student_attendance table columns', () => {
    const indices = getMetadataArgsStorage().indices.filter(
      (idx) => idx.target === StudentAttendanceOrmEntity
    );
    const indexNames = indices.map((idx) => idx.name);

    expect(indexNames).toContain('idx_student_attendance_class_session_id');
    expect(indexNames).toContain('idx_student_attendance_student_id');
    expect(indexNames).toContain('idx_student_attendance_bill_id');
  });

  it('should define indexes on class_sessions table columns', () => {
    const indices = getMetadataArgsStorage().indices.filter(
      (idx) => idx.target === ClassSessionOrmEntity
    );
    const indexNames = indices.map((idx) => idx.name);

    expect(indexNames).toContain('idx_class_sessions_class_id');
    expect(indexNames).toContain('idx_class_sessions_date');
  });

  it('should define indexes on class_students table columns', () => {
    const indices = getMetadataArgsStorage().indices.filter(
      (idx) => idx.target === ClassStudentOrmEntity
    );
    const indexNames = indices.map((idx) => idx.name);

    expect(indexNames).toContain('idx_class_students_class_id');
    expect(indexNames).toContain('idx_class_students_student_id');
  });

  it('should define indexes on student_monthly_bills table columns', () => {
    const indices = getMetadataArgsStorage().indices.filter(
      (idx) => idx.target === StudentMonthlyBillOrmEntity
    );
    const indexNames = indices.map((idx) => idx.name);

    expect(indexNames).toContain('idx_student_monthly_bills_student_id');
    expect(indexNames).toContain('idx_student_monthly_bills_month');
  });

  it('should define indexes on student_monthly_bill_items table columns', () => {
    const indices = getMetadataArgsStorage().indices.filter(
      (idx) => idx.target === StudentMonthlyBillItemOrmEntity
    );
    const indexNames = indices.map((idx) => idx.name);

    expect(indexNames).toContain('idx_student_monthly_bill_items_bill_id');
    expect(indexNames).toContain('idx_student_monthly_bill_items_class_id');
  });
});
