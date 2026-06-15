import { HolidayProps } from '../../domain/entities/holiday';

export interface SavedHoliday extends HolidayProps {
  id: string;
}

export abstract class HolidayPersistencePort {
  abstract list(from?: string, to?: string): Promise<SavedHoliday[]>;
  abstract findById(id: string): Promise<SavedHoliday | null>;
  abstract findByDate(date: string): Promise<SavedHoliday | null>;
  abstract listDates(from: string, to: string): Promise<string[]>;
  abstract save(holiday: HolidayProps & { id?: string }): Promise<SavedHoliday>;
  abstract delete(id: string): Promise<void>;
}
