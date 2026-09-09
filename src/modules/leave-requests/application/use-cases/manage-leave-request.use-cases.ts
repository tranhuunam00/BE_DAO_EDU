import { LeaveRequestStatus } from '../../domain/entities/leave-request';
import { LeaveRequestError } from '../../domain/errors/leave-request.error';
import {
  LeaveRequestListFilter,
  LeaveRequestPersistencePort,
} from '../ports/leave-request-persistence.port';
import { SessionStatus } from '../../../../domain/value-objects/session-status.enum';

export class ListMyLeaveRequestsUseCase {
  constructor(private readonly persistence: LeaveRequestPersistencePort) {}

  async execute(input: { studentUserId: string; studentId?: string; status?: LeaveRequestStatus }) {
    if (input.studentId) {
      const isOwner = await this.persistence.isStudentOwnedByUser(
        input.studentId,
        input.studentUserId,
      );
      if (!isOwner) {
        throw new LeaveRequestError(
          'FORBIDDEN',
          'Bạn không có quyền xem đơn của học sinh này.',
        );
      }
      return this.persistence.listForStudent(input.studentId, {
        status: input.status,
      });
    }

    return this.persistence.listForUserStudents(input.studentUserId, {
      status: input.status,
    });
  }
}

export class ListManagedLeaveRequestsUseCase {
  constructor(private readonly persistence: LeaveRequestPersistencePort) {}

  execute(input: {
    actorUserId: string;
    actorRole: string;
    filter: LeaveRequestListFilter;
  }) {
    return this.persistence.listForManager(
      input.actorUserId,
      input.actorRole,
      input.filter,
    );
  }
}

export class ReviewLeaveRequestUseCase {
  constructor(private readonly persistence: LeaveRequestPersistencePort) {}

  async execute(input: {
    requestId: string;
    actorUserId: string;
    actorRole: string;
    decision: 'approved' | 'rejected';
    reviewNote?: string;
  }) {
    const request = await this.persistence.findById(input.requestId);
    if (!request) {
      throw new LeaveRequestError(
        'LEAVE_REQUEST_NOT_FOUND',
        'Không tìm thấy đơn xin nghỉ.',
      );
    }
    const session = await this.persistence.findSession(request.classSessionId);
    if (!session) {
      throw new LeaveRequestError(
        'SESSION_NOT_FOUND',
        'Không tìm thấy buổi học.',
      );
    }
    if (
      !(await this.persistence.canManageClass(
        input.actorUserId,
        input.actorRole,
        session.classId,
      ))
    ) {
      throw new LeaveRequestError(
        'FORBIDDEN',
        'Bạn không phụ trách lớp học này.',
      );
    }
    if (
      input.decision === 'approved' &&
      (session.attendanceLocked || session.status === SessionStatus.COMPLETED)
    ) {
      throw new LeaveRequestError(
        'SESSION_NOT_AVAILABLE',
        'Không thể duyệt đơn khi điểm danh của buổi học đã bị khóa.',
      );
    }

    if (input.decision === 'approved') {
      const isBilled = await this.persistence.isAttendanceBilled(
        request.classSessionId,
        request.studentId,
      );
      if (isBilled) {
        throw new LeaveRequestError(
          'ATTENDANCE_ALREADY_BILLED',
          'Không thể duyệt đơn xin nghỉ: Buổi học này của học sinh đã được xuất hóa đơn tính học phí. Vui lòng liên hệ kế toán để điều chỉnh trước.',
        );
      }
    }

    const now = new Date();
    if (input.decision === 'approved') {
      request.approve(input.actorUserId, input.reviewNote ?? null, now);
    } else {
      request.reject(input.actorUserId, input.reviewNote ?? null, now);
    }
    const saved = await this.persistence.saveDecision(request, session);
    return this.persistence.findViewById(saved.id!);
  }
}

export class CancelLeaveRequestUseCase {
  constructor(private readonly persistence: LeaveRequestPersistencePort) {}

  async execute(input: { requestId: string; studentUserId: string; studentId?: string }) {
    const request = await this.persistence.findById(input.requestId);
    if (!request) {
      throw new LeaveRequestError(
        'LEAVE_REQUEST_NOT_FOUND',
        'Không tìm thấy đơn xin nghỉ.',
      );
    }

    const isOwner = await this.persistence.isStudentOwnedByUser(
      request.studentId,
      input.studentUserId,
    );
    if (!isOwner) {
      const fallbackId = (await this.persistence.findStudentIdByUserId(
        input.studentUserId,
      )) || undefined;
      if (fallbackId !== request.studentId) {
        throw new LeaveRequestError(
          'FORBIDDEN',
          'Bạn không có quyền hủy đơn xin nghỉ này.',
        );
      }
    }

    request.cancel(new Date());
    const saved = await this.persistence.saveCancellation(request);
    return this.persistence.findViewById(saved.id!);
  }
}
