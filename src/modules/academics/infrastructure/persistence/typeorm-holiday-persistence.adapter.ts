import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { HolidayOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/holiday.orm-entity';
import {
  HolidayPersistencePort,
  SavedHoliday,
} from '../../application/ports/holiday-persistence.port';
import { HolidayProps } from '../../domain/entities/holiday';

@Injectable()
export class TypeOrmHolidayPersistenceAdapter implements HolidayPersistencePort {
  constructor(
    @InjectRepository(HolidayOrmEntity)
    private readonly repository: Repository<HolidayOrmEntity>,
  ) {}

  list(from?: string, to?: string): Promise<SavedHoliday[]> {
    return this.repository.find({
      where: from && to ? { date: Between(from, to) } : {},
      order: { date: 'ASC' },
    });
  }

  findById(id: string): Promise<SavedHoliday | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByDate(date: string): Promise<SavedHoliday | null> {
    return this.repository.findOne({ where: { date } });
  }

  async listDates(from: string, to: string): Promise<string[]> {
    const holidays = await this.repository.find({
      where: { date: Between(from, to) },
      select: { date: true },
    });
    return holidays.map((holiday) => holiday.date);
  }

  async save(holiday: HolidayProps & { id?: string }): Promise<SavedHoliday> {
    return this.repository.save(this.repository.create(holiday));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
