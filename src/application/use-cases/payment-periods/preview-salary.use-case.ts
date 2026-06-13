import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassSessionOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { CourseLevelPricingOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';

@Injectable()
export class PreviewSalaryUseCase {
  constructor(
    @InjectRepository(ClassSessionOrmEntity)
    private readonly sessionRepo: Repository<ClassSessionOrmEntity>,
    @InjectRepository(CourseLevelPricingOrmEntity)
    private readonly pricingRepo: Repository<CourseLevelPricingOrmEntity>,
  ) {}

  async execute(endDate: string) {
    if (!endDate) throw new BadRequestException('Vui lòng cung cấp endDate');

    const pricings = await this.pricingRepo.find();

    const qb = this.sessionRepo.createQueryBuilder('session')
      .leftJoinAndSelect('session.classEntity', 'classEntity')
      .leftJoinAndSelect('classEntity.course', 'course')
      .leftJoinAndSelect('classEntity.courseLevel', 'courseLevel')
      .leftJoinAndSelect('session.teacher', 'teacher')
      .where('session.wageId IS NULL')
      .andWhere('session.teacherId IS NOT NULL')
      .andWhere('session.date <= :endDateStr', { endDateStr: endDate })
      .andWhere('(session.status = :completedStatus OR session.attendance_locked = :locked)', { completedStatus: 'Completed', locked: true });

    const sessions = await qb.getMany();

    const teacherMap = new Map<string, { teacher: any, sessions: ClassSessionOrmEntity[] }>();
    for (const sess of sessions) {
      const tId = sess.teacherId!;
      if (!teacherMap.has(tId)) {
        teacherMap.set(tId, { teacher: sess.teacher, sessions: [] });
      }
      teacherMap.get(tId)!.sessions.push(sess);
    }

    const results = [];

    for (const [teacherId, data] of teacherMap.entries()) {
      const { teacher, sessions: sessionList } = data;
      
      const classMap = new Map<string, { sessions: ClassSessionOrmEntity[]; classEntity: any }>();
      for (const sess of sessionList) {
        const classId = sess.classId;
        if (!classMap.has(classId)) {
          classMap.set(classId, { sessions: [], classEntity: sess.classEntity });
        }
        classMap.get(classId)!.sessions.push(sess);
      }

      let teacherTotalAmount = 0;
      let totalSessions = 0;

      for (const [classId, group] of classMap.entries()) {
        for (const sess of group.sessions) {
          const dateStr = sess.date;
          const levelId = group.classEntity.courseLevelId;
          const pricing = pricings.find(
            (p) =>
              p.courseLevelId === levelId &&
              p.effectiveFrom <= dateStr &&
              (p.effectiveTo === null || p.effectiveTo >= dateStr)
          );
          const rate = pricing ? Number(pricing.teacherWagePerSession) : 0;
          teacherTotalAmount += rate;
          totalSessions++;
        }
      }

      if (teacherTotalAmount > 0) {
        results.push({
          teacherId: teacherId,
          teacherCode: teacher?.teacherId || '',
          name: `${teacher?.lastName || ''} ${teacher?.firstName || ''}`.trim(),
          mobile: teacher?.mobile || '',
          status: teacher?.status || '',
          totalSessions,
          totalAmount: teacherTotalAmount,
        });
      }
    }

    const grandTotal = results.reduce((sum, r) => sum + r.totalAmount, 0);
    return { teachers: results, grandTotal, endDate };
  }
}
