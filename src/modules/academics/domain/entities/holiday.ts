export interface HolidayProps {
  date: string;
  name: string;
  description: string | null;
}

export class Holiday {
  private constructor(private readonly props: HolidayProps) {}

  static create(input: {
    date: string;
    name: string;
    description?: string | null;
  }): Holiday {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new Error('INVALID_HOLIDAY_DATE');
    }
    const name = input.name.trim();
    if (!name) throw new Error('INVALID_HOLIDAY_NAME');
    return new Holiday({
      date: input.date,
      name,
      description: input.description?.trim() || null,
    });
  }

  toPrimitives(): HolidayProps {
    return { ...this.props };
  }
}
