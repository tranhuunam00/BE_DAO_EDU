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

export interface PeriodSummary extends PaymentPeriodProps {
  id: string;
  totalExpected: number;
  totalPaid: number;
  totalOrders: number;
  paidOrders: number;
}

export interface PaymentPeriodDetails {
  period: PaymentPeriodProps & { id: string };
  orders: Record<string, unknown>[];
}

export interface BillingAuditInput {
  event: string;
  orderType?: BillingOrderType;
  orderId?: string;
  periodId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

export interface BillingTransactionContext {
  loadPricings(): Promise<PricingRule[]>;
  findTuitionSources(
    endDate: string,
    ownerIds?: string[],
  ): Promise<BillingSource[]>;
  findSalarySources(
    endDate: string,
    ownerIds?: string[],
  ): Promise<BillingSource[]>;
  savePeriod(
    period: PaymentPeriodProps,
  ): Promise<PaymentPeriodProps & { id: string }>;
  saveOrders(
    type: PaymentPeriodType,
    period: PaymentPeriodProps & { id: string },
    orders: BillingOrderDraft[],
  ): Promise<void>;
  findPeriod(id: string): Promise<PaymentPeriodProps | null>;
  savePeriodStatus(id: string, status: 'Active' | 'Closed'): Promise<void>;
  hasPaidOrders(periodId: string, type: PaymentPeriodType): Promise<boolean>;
  deletePeriod(id: string, type: PaymentPeriodType): Promise<void>;
  findOrder(
    type: BillingOrderType,
    id: string,
  ): Promise<BillingOrderProps | null>;
  saveOrder(order: BillingOrderProps): Promise<void>;
  saveAudit(input: BillingAuditInput): Promise<void>;
  resetPaymentRequest(billId: string): Promise<void>;
  deleteOrder(type: BillingOrderType, id: string): Promise<void>;
}

export abstract class BillingPersistencePort {
  abstract transaction<T>(
    work: (context: BillingTransactionContext) => Promise<T>,
  ): Promise<T>;
  abstract loadPricings(): Promise<PricingRule[]>;
  abstract findTuitionSources(
    endDate: string,
    ownerIds?: string[],
  ): Promise<BillingSource[]>;
  abstract findSalarySources(
    endDate: string,
    ownerIds?: string[],
  ): Promise<BillingSource[]>;
  abstract listPeriods(): Promise<PeriodSummary[]>;
  abstract findPeriodDetails(id: string): Promise<PaymentPeriodDetails | null>;
}
