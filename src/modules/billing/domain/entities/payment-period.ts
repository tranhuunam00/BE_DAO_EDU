import { BillingError } from '../errors/billing.error';
import { BillingPeriod } from '../value-objects/billing-period';

export type PaymentPeriodType = 'tuition' | 'salary';
export type PaymentPeriodStatus = 'Active' | 'Closed';

export interface PaymentPeriodProps {
  id?: string;
  name: string;
  type: PaymentPeriodType;
  month: string;
  startDate: string;
  endDate: string;
  status: PaymentPeriodStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PaymentPeriod {
  private constructor(private readonly props: PaymentPeriodProps) {}

  static create(
    input: Omit<
      PaymentPeriodProps,
      'id' | 'status' | 'createdAt' | 'updatedAt'
    >,
  ) {
    const name = input.name?.trim();
    if (!name) {
      throw new BillingError(
        'INVALID_REQUEST',
        'Tên đợt thanh toán không được để trống',
      );
    }
    if (input.type !== 'tuition' && input.type !== 'salary') {
      throw new BillingError(
        'INVALID_PERIOD_TYPE',
        'Loại đợt thanh toán không hợp lệ',
      );
    }
    const period = BillingPeriod.create(
      input.month,
      input.startDate,
      input.endDate,
    );
    return new PaymentPeriod({
      name,
      type: input.type,
      month: period.month,
      startDate: period.startDate,
      endDate: period.endDate,
      status: 'Active',
    });
  }

  static restore(props: PaymentPeriodProps) {
    return new PaymentPeriod(props);
  }

  get id() {
    return this.props.id;
  }
  get type() {
    return this.props.type;
  }
  get status() {
    return this.props.status;
  }

  changeStatus(status: PaymentPeriodStatus) {
    if (status !== 'Active' && status !== 'Closed') {
      throw new BillingError(
        'INVALID_PERIOD_STATUS',
        'Trạng thái đợt thanh toán không hợp lệ',
      );
    }
    this.props.status = status;
  }

  toPrimitives(): PaymentPeriodProps {
    return { ...this.props };
  }
}
