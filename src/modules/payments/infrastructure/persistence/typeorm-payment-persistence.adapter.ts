import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { NotificationOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { StudentMonthlyBillOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student-monthly-bill.orm-entity';
import { TuitionPaymentLogOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/tuition-payment-log.orm-entity';
import { TuitionPaymentRequestOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/tuition-payment-request.orm-entity';
import { VietQrCallbackLogOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/vietqr-callback-log.orm-entity';
import { BillingAuditLogOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/billing-audit-log.orm-entity';
import {
  CallbackAudit,
  PaymentPersistencePort,
  PaymentTransactionContext,
  TuitionBill,
} from '../../application/ports/payment-persistence.port';
import { PaymentLog } from '../../domain/entities/payment-log';
import { TuitionPaymentRequest } from '../../domain/entities/tuition-payment-request';
import { PaymentMapper } from './payment.mapper';

@Injectable()
export class TypeOrmPaymentPersistenceAdapter extends PaymentPersistencePort {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TuitionPaymentRequestOrmEntity)
    private readonly requestRepo: Repository<TuitionPaymentRequestOrmEntity>,
    @InjectRepository(VietQrCallbackLogOrmEntity)
    private readonly auditRepo: Repository<VietQrCallbackLogOrmEntity>,
  ) {
    super();
  }

  transaction<T>(
    work: (context: PaymentTransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction((manager) =>
      work(new TypeOrmPaymentTransactionContext(manager)),
    );
  }

  async findRequestDetailsByBillId(billId: string) {
    const entity = await this.requestRepo.findOne({
      where: { billId },
      relations: { bill: { student: true }, logs: true },
    });
    if (!entity) return null;
    return {
      request: PaymentMapper.toDomain(entity).toPrimitives(),
      studentUserId: entity.bill.student.userId,
      logs: (entity.logs || []).map(toPaymentLog),
    };
  }

  async saveAudit(audit: CallbackAudit): Promise<CallbackAudit> {
    const entity = audit.id
      ? await this.auditRepo.findOneBy({ id: audit.id })
      : null;
    const saved = await this.auditRepo.save(
      applyAudit(audit, entity ?? undefined),
    );
    return toAudit(saved);
  }

  async listAudits(limit: number): Promise<CallbackAudit[]> {
    const entities = await this.auditRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return entities.map(toAudit);
  }
}

class TypeOrmPaymentTransactionContext implements PaymentTransactionContext {
  constructor(private readonly manager: EntityManager) {}

  async findBillById(id: string): Promise<TuitionBill | null> {
    const entity = await this.manager
      .getRepository(StudentMonthlyBillOrmEntity)
      .findOne({
        where: { id },
        relations: { student: true, period: true },
      });
    if (!entity) return null;
    return {
      id: entity.id,
      month: entity.month,
      totalAmount: Number(entity.totalAmount),
      paidAmount: Number(entity.paidAmount),
      status: entity.status,
      paymentDate: entity.paymentDate,
      note: entity.note,
      paymentMethod: entity.paymentMethod,
      receiptCode: entity.receiptCode,
      studentUserId: entity.student?.userId ?? null,
      periodName: entity.period?.name ?? null,
    };
  }

  async saveBill(bill: TuitionBill): Promise<void> {
    const receiptCode =
      bill.status === 'Paid' && !bill.receiptCode
        ? await createReceiptCode(this.manager)
        : bill.receiptCode;
    await this.manager.getRepository(StudentMonthlyBillOrmEntity).update(
      { id: bill.id },
      {
        paidAmount: bill.paidAmount,
        status: bill.status,
        paymentDate: bill.paymentDate,
        note: bill.note,
        paymentMethod: bill.paymentMethod,
        receiptCode,
      },
    );
    await this.manager.getRepository(BillingAuditLogOrmEntity).save({
      event: 'PAYMENT_CONFIRMED',
      orderType: 'tuition',
      orderId: bill.id,
      periodId: null,
      actorId: null,
      metadata: {
        source: 'vietqr_callback',
        paymentMethod: bill.paymentMethod,
        receiptCode,
      },
    });
  }

  async findRequestByBillId(billId: string, lock = false) {
    const repository = this.manager.getRepository(
      TuitionPaymentRequestOrmEntity,
    );
    const entity = lock
      ? await repository.findOne({
          where: { billId },
          lock: { mode: 'pessimistic_write' },
        })
      : await repository.findOne({ where: { billId } });
    return entity ? PaymentMapper.toDomain(entity) : null;
  }

  async findRequestForTransaction(orderId: string, content: string) {
    const reference =
      content.toUpperCase().match(/DAOHP[A-Z0-9]{12}/)?.[0] ||
      content.trim().toUpperCase();
    const query = this.manager
      .getRepository(TuitionPaymentRequestOrmEntity)
      .createQueryBuilder('request')
      .setLock('pessimistic_write')
      .where('UPPER(request.transfer_content) = :content', {
        content: reference,
      });
    if (isUuid(orderId)) {
      query.orWhere('request.id = :orderId OR request.bill_id = :orderId', {
        orderId,
      });
    }
    const entity = await query.getOne();
    return entity ? PaymentMapper.toDomain(entity) : null;
  }

  async saveRequest(request: TuitionPaymentRequest) {
    const repository = this.manager.getRepository(
      TuitionPaymentRequestOrmEntity,
    );
    const existing = request.id
      ? await repository.findOneBy({ id: request.id })
      : undefined;
    const saved = await repository.save(
      PaymentMapper.apply(request, existing ?? undefined),
    );
    return PaymentMapper.toDomain(saved);
  }

  async listPaymentLogs(paymentRequestId: string): Promise<PaymentLog[]> {
    const entities = await this.manager
      .getRepository(TuitionPaymentLogOrmEntity)
      .find({
        where: { paymentRequestId },
        order: { createdAt: 'ASC' },
      });
    return entities.map(toPaymentLog);
  }

  async findPaymentLogByTransactionId(transactionId: string) {
    const entity = await this.manager
      .getRepository(TuitionPaymentLogOrmEntity)
      .findOne({
        where: { externalTransactionId: transactionId },
      });
    return entity ? toPaymentLog(entity) : null;
  }

  async savePaymentLog(log: PaymentLog): Promise<PaymentLog> {
    const repository = this.manager.getRepository(TuitionPaymentLogOrmEntity);
    const entity = repository.create(log);
    const saved = await repository.save(entity);
    return toPaymentLog(saved);
  }

  async findAuditById(id: string): Promise<CallbackAudit> {
    const entity = await this.manager
      .getRepository(VietQrCallbackLogOrmEntity)
      .findOneByOrFail({ id });
    return toAudit(entity);
  }

  async saveAudit(audit: CallbackAudit): Promise<CallbackAudit> {
    const repository = this.manager.getRepository(VietQrCallbackLogOrmEntity);
    const existing = audit.id
      ? await repository.findOneBy({ id: audit.id })
      : undefined;
    return toAudit(
      await repository.save(applyAudit(audit, existing ?? undefined)),
    );
  }

  async saveNotification(input: {
    userId: string;
    type: string;
    title: string;
    message: string;
    linkPath: string | null;
    priority?: 'normal' | 'important' | 'urgent';
    metadata?: Record<string, unknown>;
  }) {
    const repository = this.manager.getRepository(NotificationOrmEntity);
    await repository.save(
      repository.create({
        ...input,
        priority: input.priority ?? 'normal',
        metadata: input.metadata ?? {},
        readAt: null,
      }),
    );
  }
}

function toPaymentLog(entity: TuitionPaymentLogOrmEntity): PaymentLog {
  return {
    id: entity.id,
    paymentRequestId: entity.paymentRequestId,
    billId: entity.billId,
    event: entity.event,
    status: entity.status,
    amount: Number(entity.amount),
    source: entity.source,
    externalTransactionId: entity.externalTransactionId,
    message: entity.message,
    metadata: entity.metadata,
    createdAt: entity.createdAt,
  };
}

function toAudit(entity: VietQrCallbackLogOrmEntity): CallbackAudit {
  return {
    id: entity.id,
    transactionId: entity.transactionId,
    referenceNumber: entity.referenceNumber,
    orderId: entity.orderId,
    paymentRequestId: entity.paymentRequestId,
    billId: entity.billId,
    result: entity.result,
    errorReason: entity.errorReason,
    message: entity.message,
    payload: entity.payload,
    processedAt: entity.processedAt,
    createdAt: entity.createdAt,
  };
}

async function createReceiptCode(manager: EntityManager) {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dayPrefix = `PT-${yy}${mm}${dd}-`;

  const lastBill = await manager
    .getRepository(StudentMonthlyBillOrmEntity)
    .createQueryBuilder('bill')
    .where('bill.receiptCode LIKE :prefix', { prefix: `${dayPrefix}%` })
    .orderBy('bill.receiptCode', 'DESC')
    .getOne();

  let nextSeq = 1;
  if (lastBill && lastBill.receiptCode) {
    const parts = lastBill.receiptCode.split('-');
    const lastSeqStr = parts[parts.length - 1];
    const lastSeq = parseInt(lastSeqStr, 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${dayPrefix}${String(nextSeq).padStart(4, '0')}`;
}

function applyAudit(
  audit: CallbackAudit,
  entity = new VietQrCallbackLogOrmEntity(),
) {
  if (audit.id) entity.id = audit.id;
  entity.transactionId = audit.transactionId;
  entity.referenceNumber = audit.referenceNumber;
  entity.orderId = audit.orderId;
  entity.paymentRequestId = audit.paymentRequestId;
  entity.billId = audit.billId;
  entity.result = audit.result;
  entity.errorReason = audit.errorReason;
  entity.message = audit.message;
  entity.payload = audit.payload;
  entity.processedAt = audit.processedAt;
  return entity;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
