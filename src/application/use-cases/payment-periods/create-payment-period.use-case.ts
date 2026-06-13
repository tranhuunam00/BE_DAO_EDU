import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PaymentPeriodOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/payment-period.orm-entity';
import { StudentMonthlyBillOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/student-monthly-bill.orm-entity';
import { TeacherMonthlyWageOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/teacher-monthly-wage.orm-entity';
import { StudentMonthlyBillItemOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/student-monthly-bill-item.orm-entity';
import { TeacherMonthlyWageItemOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/teacher-monthly-wage-item.orm-entity';
import { ClassSessionOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { StudentAttendanceOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { CourseLevelPricingOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';

@Injectable()
export class CreatePaymentPeriodUseCase {
  constructor(
    @InjectRepository(PaymentPeriodOrmEntity)
    private readonly periodRepo: Repository<PaymentPeriodOrmEntity>,
    @InjectRepository(StudentMonthlyBillOrmEntity)
    private readonly studentBillRepo: Repository<StudentMonthlyBillOrmEntity>,
    @InjectRepository(TeacherMonthlyWageOrmEntity)
    private readonly teacherWageRepo: Repository<TeacherMonthlyWageOrmEntity>,
    @InjectRepository(StudentMonthlyBillItemOrmEntity)
    private readonly studentBillItemRepo: Repository<StudentMonthlyBillItemOrmEntity>,
    @InjectRepository(TeacherMonthlyWageItemOrmEntity)
    private readonly teacherWageItemRepo: Repository<TeacherMonthlyWageItemOrmEntity>,
    @InjectRepository(ClassSessionOrmEntity)
    private readonly sessionRepo: Repository<ClassSessionOrmEntity>,
    @InjectRepository(StudentAttendanceOrmEntity)
    private readonly attendanceRepo: Repository<StudentAttendanceOrmEntity>,
    @InjectRepository(CourseLevelPricingOrmEntity)
    private readonly pricingRepo: Repository<CourseLevelPricingOrmEntity>,
  ) {}

  async execute(dto: any) {
    const { name, type, month, startDate, endDate, studentIds, teacherIds } = dto;

    if (!name || !type || !month || !startDate || !endDate) {
      throw new BadRequestException('Vui lòng cung cấp đầy đủ thông tin đợt thanh toán');
    }

    const pricings = await this.pricingRepo.find();

    const period = new PaymentPeriodOrmEntity();
    period.name = name;
    period.type = type;
    period.month = month;
    period.startDate = startDate;
    period.endDate = endDate;
    period.status = 'Active';

    const savedPeriod = await this.periodRepo.save(period);

    if (type === 'tuition') {
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

      const studentMap = new Map<string, StudentAttendanceOrmEntity[]>();
      for (const att of attendances) {
        const sId = att.studentId;
        if (!studentMap.has(sId)) {
          studentMap.set(sId, []);
        }
        studentMap.get(sId)!.push(att);
      }

      for (const [studentId, attList] of studentMap.entries()) {
        const classMap = new Map<string, { atts: StudentAttendanceOrmEntity[]; classEntity: any }>();
        for (const att of attList) {
          const classId = att.classSession.classId;
          if (!classMap.has(classId)) {
            classMap.set(classId, { atts: [], classEntity: att.classSession.classEntity });
          }
          classMap.get(classId)!.atts.push(att);
        }

        let studentTotalAmount = 0;
        const billItemsData = [];

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
            
            const p = dateStr.split('-');
            const dateFormatted = p.length === 3 ? `${p[2]}/${p[1]}` : dateStr;
            const originalName = group.classEntity.className || group.classEntity.name || '';

            billItemsData.push({
              classId,
              className: `${originalName} (Buổi ${dateFormatted})`,
              courseName: group.classEntity.course?.name || '',
              levelName: group.classEntity.courseLevel?.levelName || '',
              sessionsCount: 1,
              rate: rate,
              totalAmount: rate,
            });
            studentTotalAmount += rate;
          }
        }

        if (studentTotalAmount > 0) {
          const bill = new StudentMonthlyBillOrmEntity();
          bill.studentId = studentId;
          bill.periodId = savedPeriod.id;
          bill.month = month;
          bill.totalAmount = studentTotalAmount;
          bill.paidAmount = 0;
          bill.status = 'Unpaid';
          bill.billingStartDate = savedPeriod.startDate;
          bill.billingEndDate = savedPeriod.endDate;
          const savedBill = await this.studentBillRepo.save(bill);

          const itemsToSave = billItemsData.map((item) => {
            const dbItem = new StudentMonthlyBillItemOrmEntity();
            dbItem.billId = savedBill.id;
            dbItem.classId = item.classId;
            dbItem.className = item.className;
            dbItem.courseName = item.courseName;
            dbItem.levelName = item.levelName;
            dbItem.sessionsCount = item.sessionsCount;
            dbItem.rate = item.rate;
            dbItem.totalAmount = item.totalAmount;
            return dbItem;
          });
          await this.studentBillItemRepo.save(itemsToSave);

          const attIds = attList.map((a) => a.id);
          await this.attendanceRepo.update({ id: In(attIds) }, { billId: savedBill.id });
        }
      }
    } else {
      const qb = this.sessionRepo.createQueryBuilder('session')
        .leftJoinAndSelect('session.classEntity', 'classEntity')
        .leftJoinAndSelect('classEntity.course', 'course')
        .leftJoinAndSelect('classEntity.courseLevel', 'courseLevel')
        .leftJoinAndSelect('session.teacher', 'teacher')
        .where('session.wageId IS NULL')
        .andWhere('session.teacherId IS NOT NULL')
        .andWhere('session.date <= :endDateStr', { endDateStr: endDate })
        .andWhere('(session.status = :completedStatus OR session.attendance_locked = :locked)', { completedStatus: 'Completed', locked: true });

      if (teacherIds && teacherIds.length > 0) {
        qb.andWhere('session.teacherId IN (:...ids)', { ids: teacherIds });
      }

      const sessions = await qb.getMany();

      const teacherMap = new Map<string, ClassSessionOrmEntity[]>();
      for (const sess of sessions) {
        const tId = sess.teacherId!;
        if (!teacherMap.has(tId)) {
          teacherMap.set(tId, []);
        }
        teacherMap.get(tId)!.push(sess);
      }

      for (const [teacherId, sessionList] of teacherMap.entries()) {
        const classMap = new Map<string, { sessions: ClassSessionOrmEntity[]; classEntity: any }>();
        for (const sess of sessionList) {
          const classId = sess.classId;
          if (!classMap.has(classId)) {
            classMap.set(classId, { sessions: [], classEntity: sess.classEntity });
          }
          classMap.get(classId)!.sessions.push(sess);
        }

        let teacherTotalAmount = 0;
        const wageItemsData = [];

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
            
            const p = dateStr.split('-');
            const dateFormatted = p.length === 3 ? `${p[2]}/${p[1]}` : dateStr;
            const originalName = group.classEntity.className || group.classEntity.name || '';

            wageItemsData.push({
              classId,
              className: `${originalName} (Buổi ${dateFormatted})`,
              courseName: group.classEntity.course?.name || '',
              levelName: group.classEntity.courseLevel?.levelName || '',
              sessionsCount: 1,
              rate: rate,
              totalAmount: rate,
            });
            teacherTotalAmount += rate;
          }
        }

        if (teacherTotalAmount > 0) {
          const wage = new TeacherMonthlyWageOrmEntity();
          wage.teacherId = teacherId;
          wage.periodId = savedPeriod.id;
          wage.month = month;
          wage.totalAmount = teacherTotalAmount;
          wage.paidAmount = 0;
          wage.status = 'Unpaid';
          wage.billingStartDate = savedPeriod.startDate;
          wage.billingEndDate = savedPeriod.endDate;
          const savedWage = await this.teacherWageRepo.save(wage);

          const itemsToSave = wageItemsData.map((item) => {
            const dbItem = new TeacherMonthlyWageItemOrmEntity();
            dbItem.wageId = savedWage.id;
            dbItem.classId = item.classId;
            dbItem.className = item.className;
            dbItem.courseName = item.courseName;
            dbItem.levelName = item.levelName;
            dbItem.sessionsCount = item.sessionsCount;
            dbItem.rate = item.rate;
            dbItem.totalAmount = item.totalAmount;
            return dbItem;
          });
          await this.teacherWageItemRepo.save(itemsToSave);

          const sessionIds = sessionList.map((s) => s.id);
          await this.sessionRepo.update({ id: In(sessionIds) }, { wageId: savedWage.id });
        }
      }
    }

    return {
      message: 'Đã tạo đợt thanh toán thành công',
      data: savedPeriod,
    };
  }
}
