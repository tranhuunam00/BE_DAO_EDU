import { BillingError } from '../errors/billing.error';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export class BillingPeriod {
  private constructor(
    public readonly month: string,
    public readonly startDate: string,
    public readonly endDate: string,
  ) {}

  static create(month: string, startDate: string, endDate: string) {
    const monthNumber = Number(month?.slice(5, 7));
    if (!MONTH_PATTERN.test(month) || monthNumber < 1 || monthNumber > 12) {
      throw new BillingError('INVALID_MONTH', 'Tháng thanh toán không hợp lệ');
    }
    if (!this.isValidDate(startDate) || !this.isValidDate(endDate)) {
      throw new BillingError(
        'INVALID_DATE_RANGE',
        'Ngày bắt đầu hoặc kết thúc không hợp lệ',
      );
    }
    if (startDate > endDate) {
      throw new BillingError(
        'INVALID_DATE_RANGE',
        'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc',
      );
    }
    return new BillingPeriod(month, startDate, endDate);
  }

  private static isValidDate(value: string) {
    if (!DATE_PATTERN.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    );
  }
}
