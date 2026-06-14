import { TuitionPaymentRequestOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/tuition-payment-request.orm-entity';
import { TuitionPaymentRequest } from '../../domain/entities/tuition-payment-request';

export class PaymentMapper {
  static toDomain(entity: TuitionPaymentRequestOrmEntity) {
    return new TuitionPaymentRequest({
      id: entity.id,
      billId: entity.billId,
      amount: Number(entity.amount),
      bankCode: entity.bankCode,
      accountNumber: entity.accountNumber,
      accountName: entity.accountName,
      transferContent: entity.transferContent,
      qrUrl: entity.qrUrl,
      status: entity.status,
      sentAt: entity.sentAt,
      claimedAt: entity.claimedAt,
      reconciledAt: entity.reconciledAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static apply(
    domain: TuitionPaymentRequest,
    entity = new TuitionPaymentRequestOrmEntity(),
  ) {
    const props = domain.toPrimitives();
    if (props.id) entity.id = props.id;
    entity.billId = props.billId;
    entity.amount = props.amount;
    entity.bankCode = props.bankCode;
    entity.accountNumber = props.accountNumber;
    entity.accountName = props.accountName;
    entity.transferContent = props.transferContent;
    entity.qrUrl = props.qrUrl;
    entity.status = props.status;
    entity.sentAt = props.sentAt;
    entity.claimedAt = props.claimedAt;
    entity.reconciledAt = props.reconciledAt;
    return entity;
  }
}
