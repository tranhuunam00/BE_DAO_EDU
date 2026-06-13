import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClassSessionOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { StudentAttendanceOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { CourseLevelPricingOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';

@Injectable()
export class PreviewTuitionUseCase {
  constructor(
    @InjectRepository(ClassSessionOrmEntity)
    private readonly sessionRepo: Repository<ClassSessionOrmEntity>,
    @InjectRepository(StudentAttendanceOrmEntity)
    private readonly attendanceRepo: Repository<StudentAttendanceOrmEntity>,
    @InjectRepository(CourseLevelPricingOrmEntity)
    private readonly pricingRepo: Repository<CourseLevelPricingOrmEntity>,
  ) {}

  async execute(month: string, endDate: string, studentIds?: string[]) {
    if (!month || !endDate) throw new BadRequestException('Vui lòng cung cấp đầy đủ month và endDate');

    const pricings = await this.pricingRepo.find();

    const qb = this.attendanceRepo.createQueryBuilder('att')
      .leftJoinAndSelect('att.student', 'student')
      .leftJoinAndSelect('att.classSession', 'session')
      .leftJoinAndSelect('session.classEntity', 'classEntity')
      .leftJoinAndSelect('classEntity.course', 'course')
      .leftJoinAndSelect('classEntity.courseLevel', 'courseLevel')
      .where('att.billId IS NULL')
      .andWhere('session.date <= :endDateStr', { endDateStr: endDate })
      .andWhere('(session.status = :completedStatus OR session.attendance_locked = :locked)', { completedStatus: 'Completed', locked: true })
      .andWhere('(att.isPresent = :present OR (att.isPresent = :absent AND (att.reason IS NULL OR att.reason = \\\'\\\' OR TRIM(att.reason) = \\\'\\\')))', { present: true, absent: false });

    if (studentIds && studentIds.length > 0) {
      qb.andWhere('att.studentId IN (:...ids)', { ids: studentIds });
    }

    const attendances = await qb.getMany();

    const studentMap = new Map<string, { student: any, attendances: StudentAttendanceOrmEntity[] }>();
    for (const att of attendances) {
      const sId = att.studentId;
      if (!studentMap.has(sId)) {
        studentMap.set(sId, { student: att.student, attendances: [] });
      }
      studentMap.get(sId)!.attendances.push(att);
    }

    const results = [];

    for (const [studentId, data] of studentMap.entries()) {
      const { student, attendances: attList } = data;
      const classMap = new Map<string, { atts: StudentAttendanceOrmEntity[]; classEntity: any }>();
      for (const att of attList) {
        const classId = att.classSession.classId;
        if (!classMap.has(classId)) {
          classMap.set(classId, { atts: [], classEntity: att.classSession.classEntity });
        }
        classMap.get(classId)!.atts.push(att);
      }

      let studentTotalAmount = 0;
      let totalSessions = 0;

      for (const [classId, group] of classMap.entries()) {
        for (const att of group.atts) {
          const dateStr = att.classSession.date;
          const levelId = group.classEntity.courseLevelId;
          const pricing = pricings.find(
            (p) =>
              p.courseLevelId === levelId &&
              p.effectiveFrom <= dateStr &&
              (p.effectiveTo === null || p.effectiveTo >= dateStr)
          );
          const rate = pricing ? Number(pricing.pricePerSession) : 0;
          studentTotalAmount += rate;
          totalSessions++;
        }
      }

      if (studentTotalAmount > 0) {
        results.push({
          studentId: studentId,
          studentCode: student?.studentId || '',
          name: `${student?.lastName || ''} ${student?.firstName || ''}`.trim(),
          nickName: student?.nickName || '',
          mobile: student?.mobile || '',
          status: student?.status || '',
          totalSessions,
          totalAmount: studentTotalAmount,
        });
      }
    }

    const grandTotal = results.reduce((sum, r) => sum + r.totalAmount, 0);
    return { students: results, grandTotal, endDate };
  }
}
