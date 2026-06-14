import { BillingError } from '../errors/billing.error';
import { BillingPeriod } from './billing-period';

describe('BillingPeriod', () => {
  it('accepts a valid month and date range', () => {
    expect(BillingPeriod.create('2026-06', '2026-06-01', '2026-06-30')).toEqual(
      expect.objectContaining({ month: '2026-06' }),
    );
  });

  it.each(['2026-00', '2026-13', '06-2026', ''])(
    'rejects invalid month %s',
    (month) => {
      expect(() =>
        BillingPeriod.create(month, '2026-06-01', '2026-06-30'),
      ).toThrow(BillingError);
    },
  );

  it.each(['2026-02-30', '2026-6-01', 'not-a-date'])(
    'rejects invalid calendar date %s',
    (date) => {
      expect(() => BillingPeriod.create('2026-06', date, '2026-06-30')).toThrow(
        'Ngày bắt đầu hoặc kết thúc không hợp lệ',
      );
    },
  );

  it('rejects an inverted date range', () => {
    expect(() =>
      BillingPeriod.create('2026-06', '2026-06-30', '2026-06-01'),
    ).toThrow('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
  });
});
