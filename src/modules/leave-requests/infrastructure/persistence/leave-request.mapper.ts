import { LeaveRequestOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/leave-request.orm-entity';
import {
  LeaveRequest,
  LeaveRequestStatus,
} from '../../domain/entities/leave-request';

export class LeaveRequestMapper {
  static toDomain(entity: LeaveRequestOrmEntity): LeaveRequest {
    return new LeaveRequest({
      id: entity.id,
      studentId: entity.studentId,
      classSessionId: entity.classSessionId,
      reason: entity.reason,
      status: entity.status as LeaveRequestStatus,
      submittedAt: entity.submittedAt,
      reviewedAt: entity.reviewedAt,
      reviewedByUserId: entity.reviewedByUserId,
      reviewNote: entity.reviewNote,
      cancelledAt: entity.cancelledAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toOrm(
    domain: LeaveRequest,
    entity = new LeaveRequestOrmEntity(),
  ): LeaveRequestOrmEntity {
    const props = domain.toPrimitives();
    if (props.id) entity.id = props.id;
    entity.studentId = props.studentId;
    entity.classSessionId = props.classSessionId;
    entity.reason = props.reason;
    entity.status = props.status;
    entity.submittedAt = props.submittedAt;
    entity.reviewedAt = props.reviewedAt;
    entity.reviewedByUserId = props.reviewedByUserId;
    entity.reviewNote = props.reviewNote;
    entity.cancelledAt = props.cancelledAt;
    return entity;
  }
}
