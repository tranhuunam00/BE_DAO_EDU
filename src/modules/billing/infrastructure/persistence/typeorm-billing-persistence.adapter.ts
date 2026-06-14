import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  BillingPersistencePort,
  BillingTransactionContext,
  PaymentPeriodDetails,
  PeriodSummary,
} from '../../application/ports/billing-persistence.port';
import {
  BillingOrderProps,
  BillingOrderType,
} from '../../domain/entities/billing-order';
import {
  PaymentPeriodProps,
  PaymentPeriodType,
} from '../../domain/entities/payment-period';
import {
  BillingOrderDraft,
  BillingSource,
  PricingRule,
} from '../../domain/services/billing-calculator';
import { ClassSessionOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { CourseLevelPricingOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';
import { PaymentPeriodOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/payment-period.orm-entity';
import { StudentAttendanceOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { StudentMonthlyBillItemOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student-monthly-bill-item.orm-entity';
import { StudentMonthlyBillOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student-monthly-bill.orm-entity';
import { TeacherMonthlyWageItemOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/teacher-monthly-wage-item.orm-entity';
import { TeacherMonthlyWageOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/teacher-monthly-wage.orm-entity';
import { TuitionPaymentRequestOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/tuition-payment-request.orm-entity';

@Injectable()
export class TypeOrmBillingPersistenceAdapter extends BillingPersistencePort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  transaction<T>(work: (context: BillingTransactionContext) => Promise<T>) {
    return this.dataSource.transaction('SERIALIZABLE', (manager) =>
      work(new TypeOrmBillingTransactionContext(manager)),
    );
  }

  loadPricings() {
    return loadPricings(
      this.dataSource.getRepository(CourseLevelPricingOrmEntity),
    );
  }

  findTuitionSources(endDate: string, ownerIds?: string[]) {
    return findTuitionSources(
      this.dataSource.getRepository(StudentAttendanceOrmEntity),
      endDate,
      ownerIds,
    );
  }

  findSalarySources(endDate: string, ownerIds?: string[]) {
    return findSalarySources(
      this.dataSource.getRepository(ClassSessionOrmEntity),
      endDate,
      ownerIds,
    );
  }

  async listPeriods(): Promise<PeriodSummary[]> {
    const periodRepo = this.dataSource.getRepository(PaymentPeriodOrmEntity);
    const billRepo = this.dataSource.getRepository(StudentMonthlyBillOrmEntity);
    const wageRepo = this.dataSource.getRepository(TeacherMonthlyWageOrmEntity);
    const [periods, billStats, wageStats] = await Promise.all([
      periodRepo.find({ order: { createdAt: 'DESC' } }),
      aggregateOrders(billRepo),
      aggregateOrders(wageRepo),
    ]);
    return periods.map((period) => {
      const stats =
        (period.type === 'tuition' ? billStats : wageStats).get(period.id) ??
        emptyStats();
      return { ...period, ...stats } as unknown as PeriodSummary;
    });
  }

  async findPeriodDetails(id: string): Promise<PaymentPeriodDetails | null> {
    const period = await this.dataSource
      .getRepository(PaymentPeriodOrmEntity)
      .findOne({ where: { id } });
    if (!period) return null;

    if (period.type === 'tuition') {
      const bills = await this.dataSource
        .getRepository(StudentMonthlyBillOrmEntity)
        .find({
          where: { periodId: id },
          relations: { student: true, paymentRequest: { logs: true } },
          order: { student: { lastName: 'ASC', firstName: 'ASC' } },
        });
      const items = bills.length
        ? await this.dataSource
            .getRepository(StudentMonthlyBillItemOrmEntity)
            .find({ where: { billId: In(bills.map((bill) => bill.id)) } })
        : [];
      const byBill = groupItems(items, 'billId');
      return {
        period: period as unknown as PaymentPeriodProps & { id: string },
        orders: bills.map((bill) => ({
          id: bill.id,
          studentId: bill.studentId,
          code: bill.student?.studentId || '',
          name: `${bill.student?.lastName || ''} ${bill.student?.firstName || ''}`.trim(),
          nickName: bill.student?.nickName || '',
          mobile: bill.student?.mobile || '',
          totalAmount: Number(bill.totalAmount),
          paidAmount: Number(bill.paidAmount),
          status: bill.status,
          paymentDate: bill.paymentDate,
          note: bill.note,
          paymentRequest: bill.paymentRequest,
          items: (byBill.get(bill.id) ?? []).map(mapItem),
        })),
      };
    }

    const wages = await this.dataSource
      .getRepository(TeacherMonthlyWageOrmEntity)
      .find({
        where: { periodId: id },
        relations: { teacher: true },
        order: { teacher: { lastName: 'ASC', firstName: 'ASC' } },
      });
    const items = wages.length
      ? await this.dataSource
          .getRepository(TeacherMonthlyWageItemOrmEntity)
          .find({ where: { wageId: In(wages.map((wage) => wage.id)) } })
      : [];
    const byWage = groupItems(items, 'wageId');
    return {
      period: period as unknown as PaymentPeriodProps & { id: string },
      orders: wages.map((wage) => ({
        id: wage.id,
        teacherId: wage.teacherId,
        code: wage.teacher?.teacherId || '',
        name: `${wage.teacher?.lastName || ''} ${wage.teacher?.firstName || ''}`.trim(),
        mobile: wage.teacher?.mobile || '',
        type: wage.teacher?.type || '',
        totalAmount: Number(wage.totalAmount),
        paidAmount: Number(wage.paidAmount),
        status: wage.status,
        paymentDate: wage.paymentDate,
        note: wage.note,
        items: (byWage.get(wage.id) ?? []).map(mapItem),
      })),
    };
  }
}

class TypeOrmBillingTransactionContext implements BillingTransactionContext {
  constructor(private readonly manager: EntityManager) {}

  loadPricings() {
    return loadPricings(
      this.manager.getRepository(CourseLevelPricingOrmEntity),
    );
  }

  findTuitionSources(endDate: string, ownerIds?: string[]) {
    return findTuitionSources(
      this.manager.getRepository(StudentAttendanceOrmEntity),
      endDate,
      ownerIds,
    );
  }

  findSalarySources(endDate: string, ownerIds?: string[]) {
    return findSalarySources(
      this.manager.getRepository(ClassSessionOrmEntity),
      endDate,
      ownerIds,
    );
  }

  async savePeriod(
    period: PaymentPeriodProps,
  ): Promise<PaymentPeriodProps & { id: string }> {
    const entity = this.manager.getRepository(PaymentPeriodOrmEntity).create({
      name: period.name,
      type: period.type,
      month: period.month,
      startDate: new Date(`${period.startDate}T00:00:00`),
      endDate: new Date(`${period.endDate}T23:59:59.999`),
      status: period.status,
    });
    return (await this.manager
      .getRepository(PaymentPeriodOrmEntity)
      .save(entity)) as unknown as PaymentPeriodProps & { id: string };
  }

  async saveOrders(
    type: PaymentPeriodType,
    period: PaymentPeriodProps & { id: string },
    orders: BillingOrderDraft[],
  ) {
    if (type === 'tuition') {
      for (const order of orders) {
        const bill = await this.manager
          .getRepository(StudentMonthlyBillOrmEntity)
          .save({
            studentId: order.ownerId,
            periodId: period.id,
            month: period.month,
            totalAmount: order.totalAmount,
            paidAmount: 0,
            status: 'Unpaid',
            billingStartDate: new Date(period.startDate),
            billingEndDate: new Date(period.endDate),
          });
        await this.manager.getRepository(StudentMonthlyBillItemOrmEntity).save(
          order.lines.map((line) => ({
            billId: bill.id,
            classId: line.classId,
            className: line.className,
            courseName: line.courseName,
            levelName: line.levelName,
            sessionsCount: line.sessionsCount,
            rate: line.rate,
            totalAmount: line.totalAmount,
          })),
        );
        await this.manager
          .getRepository(StudentAttendanceOrmEntity)
          .update(
            { id: In(order.lines.map((line) => line.sourceId)) },
            { billId: bill.id },
          );
      }
      return;
    }

    for (const order of orders) {
      const wage = await this.manager
        .getRepository(TeacherMonthlyWageOrmEntity)
        .save({
          teacherId: order.ownerId,
          periodId: period.id,
          month: period.month,
          totalAmount: order.totalAmount,
          paidAmount: 0,
          status: 'Unpaid',
          billingStartDate: new Date(period.startDate),
          billingEndDate: new Date(period.endDate),
        });
      await this.manager.getRepository(TeacherMonthlyWageItemOrmEntity).save(
        order.lines.map((line) => ({
          wageId: wage.id,
          classId: line.classId,
          className: line.className,
          courseName: line.courseName,
          levelName: line.levelName,
          sessionsCount: line.sessionsCount,
          rate: line.rate,
          totalAmount: line.totalAmount,
        })),
      );
      await this.manager
        .getRepository(ClassSessionOrmEntity)
        .update(
          { id: In(order.lines.map((line) => line.sourceId)) },
          { wageId: wage.id },
        );
    }
  }

  async findPeriod(id: string): Promise<PaymentPeriodProps | null> {
    const period = await this.manager
      .getRepository(PaymentPeriodOrmEntity)
      .findOne({ where: { id } });
    if (!period) return null;
    return {
      ...period,
      startDate: toDateString(period.startDate),
      endDate: toDateString(period.endDate),
    };
  }

  async savePeriodStatus(id: string, status: 'Active' | 'Closed') {
    await this.manager
      .getRepository(PaymentPeriodOrmEntity)
      .update(id, { status });
  }

  async hasPaidOrders(periodId: string, type: PaymentPeriodType) {
    const repository =
      type === 'tuition'
        ? this.manager.getRepository(StudentMonthlyBillOrmEntity)
        : this.manager.getRepository(TeacherMonthlyWageOrmEntity);
    return (
      (await repository.count({ where: { periodId, status: 'Paid' } })) > 0
    );
  }

  async deletePeriod(id: string, type: PaymentPeriodType) {
    if (type === 'tuition') {
      const bills = await this.manager
        .getRepository(StudentMonthlyBillOrmEntity)
        .find({ where: { periodId: id }, select: { id: true } });
      if (bills.length) {
        const ids = bills.map((bill) => bill.id);
        await this.manager
          .getRepository(StudentAttendanceOrmEntity)
          .update({ billId: In(ids) }, { billId: null });
      }
    } else {
      const wages = await this.manager
        .getRepository(TeacherMonthlyWageOrmEntity)
        .find({ where: { periodId: id }, select: { id: true } });
      if (wages.length) {
        const ids = wages.map((wage) => wage.id);
        await this.manager
          .getRepository(ClassSessionOrmEntity)
          .update({ wageId: In(ids) }, { wageId: null });
      }
    }
    await this.manager.getRepository(PaymentPeriodOrmEntity).delete(id);
  }

  async findOrder(
    type: BillingOrderType,
    id: string,
  ): Promise<BillingOrderProps | null> {
    const order =
      type === 'tuition'
        ? await this.manager
            .getRepository(StudentMonthlyBillOrmEntity)
            .findOne({ where: { id } })
        : await this.manager
            .getRepository(TeacherMonthlyWageOrmEntity)
            .findOne({ where: { id } });
    if (!order || !order.periodId) return null;
    return {
      id: order.id,
      type,
      ownerId:
        type === 'tuition'
          ? (order as StudentMonthlyBillOrmEntity).studentId
          : (order as TeacherMonthlyWageOrmEntity).teacherId,
      periodId: order.periodId,
      totalAmount: Number(order.totalAmount),
      paidAmount: Number(order.paidAmount),
      status: order.status as 'Paid' | 'Unpaid',
      paymentDate: order.paymentDate,
      note: order.note,
    };
  }

  async saveOrder(order: BillingOrderProps) {
    const values = {
      status: order.status,
      paidAmount: order.paidAmount,
      paymentDate: order.paymentDate,
      note: order.note,
    };
    if (order.type === 'tuition') {
      await this.manager
        .getRepository(StudentMonthlyBillOrmEntity)
        .update(order.id!, values);
    } else {
      await this.manager
        .getRepository(TeacherMonthlyWageOrmEntity)
        .update(order.id!, values);
    }
  }

  async resetPaymentRequest(billId: string) {
    await this.manager
      .getRepository(TuitionPaymentRequestOrmEntity)
      .update(
        { billId },
        { status: 'pending', claimedAt: null, reconciledAt: null },
      );
  }

  async deleteOrder(type: BillingOrderType, id: string) {
    if (type === 'tuition') {
      await this.manager
        .getRepository(StudentAttendanceOrmEntity)
        .update({ billId: id }, { billId: null });
      await this.manager.getRepository(StudentMonthlyBillOrmEntity).delete(id);
    } else {
      await this.manager
        .getRepository(ClassSessionOrmEntity)
        .update({ wageId: id }, { wageId: null });
      await this.manager.getRepository(TeacherMonthlyWageOrmEntity).delete(id);
    }
  }
}

async function loadPricings(
  repository: Repository<CourseLevelPricingOrmEntity>,
): Promise<PricingRule[]> {
  const rows = await repository.find();
  return rows.map((row) => ({
    courseLevelId: row.courseLevelId,
    pricePerSession: Number(row.pricePerSession),
    teacherWagePerSession: Number(row.teacherWagePerSession),
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
  }));
}

async function findTuitionSources(
  repository: Repository<StudentAttendanceOrmEntity>,
  endDate: string,
  ownerIds?: string[],
): Promise<BillingSource[]> {
  const query = repository
    .createQueryBuilder('attendance')
    .innerJoinAndSelect('attendance.student', 'student')
    .innerJoinAndSelect('attendance.classSession', 'session')
    .innerJoinAndSelect('session.classEntity', 'classEntity')
    .leftJoinAndSelect('classEntity.course', 'course')
    .leftJoinAndSelect('classEntity.courseLevel', 'courseLevel')
    .where('attendance.billId IS NULL')
    .andWhere('session.date <= :endDate', { endDate })
    .andWhere(
      '(session.status = :completed OR session.attendance_locked = :locked)',
      {
        completed: 'Completed',
        locked: true,
      },
    )
    .andWhere(
      '(attendance.isPresent = :present OR (attendance.isPresent = :absent AND (attendance.reason IS NULL OR TRIM(attendance.reason) = :empty)))',
      { present: true, absent: false, empty: '' },
    );
  if (ownerIds?.length) {
    query.andWhere('attendance.studentId IN (:...ownerIds)', { ownerIds });
  }
  const rows = await query.getMany();
  return rows.map((row) => ({
    id: row.id,
    ownerId: row.studentId,
    ownerCode: row.student?.studentId || '',
    ownerName:
      `${row.student?.lastName || ''} ${row.student?.firstName || ''}`.trim(),
    ownerMobile: row.student?.mobile || '',
    ownerStatus: row.student?.status || '',
    ownerExtra: row.student?.nickName || '',
    classId: row.classSession.classId,
    className: row.classSession.classEntity?.className || '',
    courseName: row.classSession.classEntity?.course?.name || '',
    levelName: row.classSession.classEntity?.courseLevel?.levelName || '',
    courseLevelId: row.classSession.classEntity?.courseLevelId,
    date: row.classSession.date,
  }));
}

async function findSalarySources(
  repository: Repository<ClassSessionOrmEntity>,
  endDate: string,
  ownerIds?: string[],
): Promise<BillingSource[]> {
  const query = repository
    .createQueryBuilder('session')
    .innerJoinAndSelect('session.classEntity', 'classEntity')
    .leftJoinAndSelect('classEntity.course', 'course')
    .leftJoinAndSelect('classEntity.courseLevel', 'courseLevel')
    .innerJoinAndSelect('session.teacher', 'teacher')
    .where('session.wageId IS NULL')
    .andWhere('session.teacherId IS NOT NULL')
    .andWhere('session.date <= :endDate', { endDate })
    .andWhere(
      '(session.status = :completed OR session.attendance_locked = :locked)',
      {
        completed: 'Completed',
        locked: true,
      },
    );
  if (ownerIds?.length) {
    query.andWhere('session.teacherId IN (:...ownerIds)', { ownerIds });
  }
  const rows = await query.getMany();
  return rows.map((row) => ({
    id: row.id,
    ownerId: row.teacherId!,
    ownerCode: row.teacher?.teacherId || '',
    ownerName:
      `${row.teacher?.lastName || ''} ${row.teacher?.firstName || ''}`.trim(),
    ownerMobile: row.teacher?.mobile || '',
    ownerStatus: row.teacher?.status || '',
    classId: row.classId,
    className: row.classEntity?.className || '',
    courseName: row.classEntity?.course?.name || '',
    levelName: row.classEntity?.courseLevel?.levelName || '',
    courseLevelId: row.classEntity?.courseLevelId,
    date: row.date,
  }));
}

async function aggregateOrders<
  T extends StudentMonthlyBillOrmEntity | TeacherMonthlyWageOrmEntity,
>(repository: Repository<T>) {
  const rows = await repository
    .createQueryBuilder('orders')
    .select('orders.periodId', 'periodId')
    .addSelect('COUNT(*)', 'totalOrders')
    .addSelect(`COUNT(*) FILTER (WHERE orders.status = 'Paid')`, 'paidOrders')
    .addSelect('COALESCE(SUM(orders.totalAmount), 0)', 'totalExpected')
    .addSelect('COALESCE(SUM(orders.paidAmount), 0)', 'totalPaid')
    .where('orders.periodId IS NOT NULL')
    .groupBy('orders.periodId')
    .getRawMany<{
      periodId: string;
      totalOrders: string;
      paidOrders: string;
      totalExpected: string;
      totalPaid: string;
    }>();
  return new Map(
    rows.map((row) => [
      row.periodId,
      {
        totalOrders: Number(row.totalOrders),
        paidOrders: Number(row.paidOrders),
        totalExpected: Number(row.totalExpected),
        totalPaid: Number(row.totalPaid),
      },
    ]),
  );
}

function emptyStats() {
  return { totalExpected: 0, totalPaid: 0, totalOrders: 0, paidOrders: 0 };
}

function groupItems<T extends object, K extends keyof T>(items: T[], key: K) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const value = String(item[key]);
    grouped.set(value, [...(grouped.get(value) ?? []), item]);
  }
  return grouped;
}

function mapItem(
  item: StudentMonthlyBillItemOrmEntity | TeacherMonthlyWageItemOrmEntity,
) {
  return {
    id: item.id,
    classId: item.classId,
    className: item.className,
    courseName: item.courseName,
    levelName: item.levelName,
    sessionsCount: item.sessionsCount,
    rate: Number(item.rate),
    totalAmount: Number(item.totalAmount),
  };
}

function toDateString(value: Date) {
  return value.toISOString().slice(0, 10);
}
