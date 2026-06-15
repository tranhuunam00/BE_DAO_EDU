import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, MoreThanOrEqual } from 'typeorm';
import { ClassOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { ClassScheduleOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class-schedule.orm-entity';
import { ClassSessionOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { ClassStudentOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { StudentAttendanceOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { StudentOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import {
  AcademicsPersistencePort,
  EnrollmentResult,
} from '../../application/ports/academics-persistence.port';
import { AcademicError } from '../../domain/errors/academic.error';
import { ScheduleAllocation } from '../../domain/services/schedule-conflict.policy';

@Injectable()
export class TypeOrmAcademicsPersistenceAdapter
  implements AcademicsPersistencePort
{
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findRecurringAllocations(
    excludeClassId?: string,
  ): Promise<ScheduleAllocation[]> {
    const qb = this.dataSource
      .getRepository(ClassScheduleOrmEntity)
      .createQueryBuilder('schedule')
      .innerJoin(ClassOrmEntity, 'class', 'class.id = schedule.class_id')
      .select([
        'schedule.id AS id',
        'schedule.weekday AS weekday',
        'schedule.start_time AS "startTime"',
        'schedule.end_time AS "endTime"',
        'schedule.room_id AS "roomId"',
        'class.main_teacher_id AS "teacherId"',
        'class.start_date AS "startDate"',
        'class.finish_date AS "finishDate"',
      ])
      .where("class.status IN ('Planning', 'Active')");

    if (excludeClassId) {
      qb.andWhere('class.id != :excludeClassId', { excludeClassId });
    }
    return qb.getRawMany<ScheduleAllocation>();
  }

  async findSessionAllocations(
    date: string,
    excludeSessionId?: string,
  ): Promise<ScheduleAllocation[]> {
    const qb = this.dataSource
      .getRepository(ClassSessionOrmEntity)
      .createQueryBuilder('session')
      .select([
        'session.id AS id',
        'session.date AS date',
        'session.start_time AS "startTime"',
        'session.end_time AS "endTime"',
        'session.room_id AS "roomId"',
        'session.teacher_id AS "teacherId"',
      ])
      .where('session.date = :date', { date })
      .andWhere("session.status NOT IN ('Cancelled', 'Canceled')");

    if (excludeSessionId) {
      qb.andWhere('session.id != :excludeSessionId', { excludeSessionId });
    }
    return qb.getRawMany<ScheduleAllocation>();
  }

  enrollStudent(
    classId: string,
    studentId: string,
    joinedDate: string,
  ): Promise<EnrollmentResult> {
    return this.runSerializable(async (manager) => {
      const classEntity = await manager.findOne(ClassOrmEntity, {
        where: { id: classId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!classEntity) {
        throw new AcademicError('CLASS_NOT_FOUND', 'Class not found.');
      }
      const student = await manager.findOne(StudentOrmEntity, {
        where: { id: studentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!student) {
        throw new AcademicError('STUDENT_NOT_FOUND', 'Student not found.');
      }

      const repository = manager.getRepository(ClassStudentOrmEntity);
      let enrollment = await repository.findOne({
        where: { classId, studentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (enrollment?.status === 'Active') {
        if (student.status !== 'Studying') {
          student.status = 'Studying';
          await manager.save(student);
        }
        return this.toEnrollmentResult(enrollment, false);
      }

      if (classEntity.maxSize !== null) {
        const activeCount = await repository.count({
          where: { classId, status: 'Active' },
        });
        if (activeCount >= classEntity.maxSize) {
          throw new AcademicError('CLASS_FULL', 'Class is full.');
        }
      }

      const reactivated = Boolean(enrollment);
      enrollment ??= repository.create({ classId, studentId });
      enrollment.status = 'Active';
      enrollment.joinedDate = joinedDate;
      enrollment = await repository.save(enrollment);

      student.status = 'Studying';
      await manager.save(student);
      await this.createFutureAttendance(
        manager,
        classId,
        studentId,
        joinedDate,
      );
      return this.toEnrollmentResult(enrollment, reactivated);
    });
  }

  removeStudent(
    classId: string,
    studentId: string,
    effectiveDate: string,
  ): Promise<void> {
    return this.runSerializable(async (manager) => {
      const repository = manager.getRepository(ClassStudentOrmEntity);
      const enrollment = await repository.findOne({
        where: { classId, studentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!enrollment) {
        throw new AcademicError('STUDENT_NOT_FOUND', 'Enrollment not found.');
      }
      enrollment.status = 'Dropped';
      await repository.save(enrollment);

      const activeClasses = await repository.count({
        where: { studentId, status: 'Active' },
      });
      if (activeClasses === 0) {
        const student = await manager.findOne(StudentOrmEntity, {
          where: { id: studentId },
          lock: { mode: 'pessimistic_write' },
        });
        if (student) {
          student.status = 'Waiting for class';
          await manager.save(student);
        }
      }

      const sessions = await manager.find(ClassSessionOrmEntity, {
        where: {
          classId,
          attendanceLocked: false,
          date: MoreThanOrEqual(effectiveDate),
        },
      });
      const futureSessionIds = sessions.map((session) => session.id);
      if (futureSessionIds.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(StudentAttendanceOrmEntity)
          .where('student_id = :studentId', { studentId })
          .andWhere('class_session_id IN (:...sessionIds)', {
            sessionIds: futureSessionIds,
          })
          .execute();
      }
    });
  }

  private async createFutureAttendance(
    manager: EntityManager,
    classId: string,
    studentId: string,
    joinedDate: string,
  ): Promise<void> {
    const sessions = await manager
      .getRepository(ClassSessionOrmEntity)
      .createQueryBuilder('session')
      .where('session.class_id = :classId', { classId })
      .andWhere('session.date >= :joinedDate', { joinedDate })
      .andWhere('session.attendance_locked = false')
      .getMany();
    const attendance = manager.getRepository(StudentAttendanceOrmEntity);
    for (const session of sessions) {
      const exists = await attendance.findOne({
        where: { classSessionId: session.id, studentId },
      });
      if (!exists) {
        await attendance.save(
          attendance.create({
            classSessionId: session.id,
            studentId,
            isPresent: false,
          }),
        );
      }
    }
  }

  private toEnrollmentResult(
    enrollment: ClassStudentOrmEntity,
    reactivated: boolean,
  ): EnrollmentResult {
    return {
      id: enrollment.id,
      classId: enrollment.classId,
      studentId: enrollment.studentId,
      status: enrollment.status,
      joinedDate: enrollment.joinedDate,
      reactivated,
    };
  }

  private async runSerializable<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.dataSource.transaction('SERIALIZABLE', work);
      } catch (error) {
        const code = (error as { code?: string; driverError?: { code?: string } })
          .driverError?.code ??
          (error as { code?: string }).code;
        if (code !== '40001' || attempt === 3) throw error;
      }
    }
    throw new Error('Serializable transaction retry exhausted.');
  }
}
