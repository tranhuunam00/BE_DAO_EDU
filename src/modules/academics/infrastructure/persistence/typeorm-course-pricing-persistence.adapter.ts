import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { CoursePricingPersistencePort } from '../../application/ports/course-pricing-persistence.port';
import { CourseLevelPricingOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/course-level-pricing.orm-entity';
import { StudentAttendanceOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { ClassSessionOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';

@Injectable()
export class TypeOrmCoursePricingPersistenceAdapter implements CoursePricingPersistencePort {
  constructor(
    @InjectRepository(CourseLevelPricingOrmEntity)
    private readonly pricingRepo: Repository<CourseLevelPricingOrmEntity>,
  ) {}

  async findPricingByLevelId(levelId: string): Promise<CourseLevelPricingOrmEntity[]> {
    return this.pricingRepo.find({
      where: { courseLevelId: levelId },
      order: { effectiveFrom: 'DESC' },
    });
  }

  async findPricingById(id: string): Promise<CourseLevelPricingOrmEntity | null> {
    return this.pricingRepo.findOne({ where: { id } });
  }

  async findActivePricing(levelId: string): Promise<CourseLevelPricingOrmEntity | null> {
    return this.pricingRepo.findOne({
      where: { courseLevelId: levelId, effectiveTo: IsNull() },
    });
  }

  async savePricing(pricing: CourseLevelPricingOrmEntity): Promise<CourseLevelPricingOrmEntity> {
    return this.pricingRepo.save(pricing);
  }

  async createPricing(pricingData: Partial<CourseLevelPricingOrmEntity>): Promise<CourseLevelPricingOrmEntity> {
    return this.pricingRepo.create(pricingData);
  }

  async deletePricing(id: string): Promise<void> {
    await this.pricingRepo.delete(id);
  }

  async checkStudentBills(levelId: string, from: string, to: string | null): Promise<boolean> {
    const qb = this.pricingRepo.manager
      .getRepository(StudentAttendanceOrmEntity)
      .createQueryBuilder('att')
      .innerJoin('att.classSession', 'session')
      .innerJoin('session.classEntity', 'class')
      .where('class.courseLevelId = :levelId', { levelId })
      .andWhere('att.billId IS NOT NULL')
      .andWhere('session.date >= :from', { from });
    if (to) {
      qb.andWhere('session.date <= :to', { to });
    }
    return (await qb.getCount()) > 0;
  }

  async checkTeacherWages(levelId: string, from: string, to: string | null): Promise<boolean> {
    const qb = this.pricingRepo.manager
      .getRepository(ClassSessionOrmEntity)
      .createQueryBuilder('session')
      .innerJoin('session.classEntity', 'class')
      .where('class.courseLevelId = :levelId', { levelId })
      .andWhere('session.wageId IS NOT NULL')
      .andWhere('session.date >= :from', { from });
    if (to) {
      qb.andWhere('session.date <= :to', { to });
    }
    return (await qb.getCount()) > 0;
  }

  async checkAssistantWages(levelId: string, from: string, to: string | null): Promise<boolean> {
    const qb = this.pricingRepo.manager
      .getRepository(ClassSessionOrmEntity)
      .createQueryBuilder('session')
      .innerJoin('session.classEntity', 'class')
      .where('class.courseLevelId = :levelId', { levelId })
      .andWhere('session.assistantWageId IS NOT NULL')
      .andWhere('session.date >= :from', { from });
    if (to) {
      qb.andWhere('session.date <= :to', { to });
    }
    return (await qb.getCount()) > 0;
  }

  async getMaxStudentBillDate(levelId: string): Promise<string | null> {
    const result = await this.pricingRepo.manager
      .getRepository(StudentAttendanceOrmEntity)
      .createQueryBuilder('att')
      .innerJoin('att.classSession', 'session')
      .innerJoin('session.classEntity', 'class')
      .where('class.courseLevelId = :levelId', { levelId })
      .andWhere('att.billId IS NOT NULL')
      .select('MAX(session.date)', 'maxDate')
      .getRawOne();
    return result?.maxDate || null;
  }

  async getMaxTeacherWageDate(levelId: string): Promise<string | null> {
    const result = await this.pricingRepo.manager
      .getRepository(ClassSessionOrmEntity)
      .createQueryBuilder('session')
      .innerJoin('session.classEntity', 'class')
      .where('class.courseLevelId = :levelId', { levelId })
      .andWhere('session.wageId IS NOT NULL')
      .select('MAX(session.date)', 'maxDate')
      .getRawOne();
    return result?.maxDate || null;
  }

  async getMaxAssistantWageDate(levelId: string): Promise<string | null> {
    const result = await this.pricingRepo.manager
      .getRepository(ClassSessionOrmEntity)
      .createQueryBuilder('session')
      .innerJoin('session.classEntity', 'class')
      .where('class.courseLevelId = :levelId', { levelId })
      .andWhere('session.assistantWageId IS NOT NULL')
      .select('MAX(session.date)', 'maxDate')
      .getRawOne();
    return result?.maxDate || null;
  }
}
