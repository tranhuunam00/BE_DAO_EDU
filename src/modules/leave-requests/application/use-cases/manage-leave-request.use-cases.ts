import { LeaveRequestStatus } from '../../domain/entities/leave-request';
import { LeaveRequestError } from '../../domain/errors/leave-request.error';
import {
  LeaveRequestListFilter,
  LeaveRequestPersistencePort,
} from '../ports/leave-request-persistence.port';
import { SessionStatus } from '../../../../domain/value-objects/session-status.enum';

export class ListMyLeaveRequestsUseCase {
  constructor(private readonly persistence: LeaveRequestPersistencePort) {}

  async execute(input: { studentUserId: string; status?: LeaveRequestStatus }) {
    const studentId = await this.persistence.findStudentIdByUserId(
      input.studentUserId,
    );
    if (!studentId) {
      throw new LeaveRequestError(
        'STUDENT_NOT_FOUND',
        'Không tìm thấy hồ sơ học sinh.',
      );
    }
    return this.persistence.listForStudent(studentId, {
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

  async execute(input: { requestId: string; studentUserId: string }) {
    const studentId = await this.persistence.findStudentIdByUserId(
      input.studentUserId,
    );
    if (!studentId) {
      throw new LeaveRequestError(
        'STUDENT_NOT_FOUND',
        'Không tìm thấy hồ sơ học sinh.',
      );
    }
    const request = await this.persistence.findById(input.requestId);
    if (!request) {
      throw new LeaveRequestError(
        'LEAVE_REQUEST_NOT_FOUND',
        'Không tìm thấy đơn xin nghỉ.',
      );
    }
    if (request.studentId !== studentId) {
      throw new LeaveRequestError(
        'FORBIDDEN',
        'Bạn không có quyền hủy đơn xin nghỉ này.',
      );
    }
    request.cancel(new Date());
    const saved = await this.persistence.saveCancellation(request);
    return this.persistence.findViewById(saved.id!);
  }
}
