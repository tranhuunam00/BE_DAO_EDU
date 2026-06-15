import { Holiday } from '../../domain/entities/holiday';
import { HolidayPersistencePort } from '../ports/holiday-persistence.port';

export class ListHolidaysUseCase {
  constructor(private readonly persistence: HolidayPersistencePort) {}
  execute(from?: string, to?: string) {
    return this.persistence.list(from, to);
  }
}

export class GetHolidayDatesUseCase {
  constructor(private readonly persistence: HolidayPersistencePort) {}
  execute(from: string, to: string) {
    return this.persistence.listDates(from, to);
  }
}

export class SaveHolidayUseCase {
  constructor(private readonly persistence: HolidayPersistencePort) {}

  async execute(input: {
    id?: string;
    date: string;
    name: string;
    description?: string | null;
  }) {
    if (input.id && !(await this.persistence.findById(input.id))) {
      throw new Error('HOLIDAY_NOT_FOUND');
    }
    const sameDate = await this.persistence.findByDate(input.date);
    if (sameDate && sameDate.id !== input.id) {
      throw new Error('HOLIDAY_DATE_EXISTS');
    }
    return this.persistence.save({
      id: input.id,
      ...Holiday.create(input).toPrimitives(),
    });
  }
}

export class DeleteHolidayUseCase {
  constructor(private readonly persistence: HolidayPersistencePort) {}

  async execute(id: string) {
    if (!(await this.persistence.findById(id))) throw new Error('HOLIDAY_NOT_FOUND');
    await this.persistence.delete(id);
  }
}
