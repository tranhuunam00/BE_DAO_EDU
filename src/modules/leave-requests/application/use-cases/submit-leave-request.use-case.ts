import { LeaveRequestPersistencePort } from '../ports/leave-request-persistence.port';
import { LeaveRequest } from '../../domain/entities/leave-request';
import { LeaveRequestError } from '../../domain/errors/leave-request.error';
import { SessionStatus } from '../../../../domain/value-objects/session-status.enum';

export class SubmitLeaveRequestUseCase {
  constructor(private readonly persistence: LeaveRequestPersistencePort) {}

  async execute(input: {
    studentUserId: string;
    classSessionId: string;
    reason: string;
  }) {
    const studentId = await this.persistence.findStudentIdByUserId(
      input.studentUserId,
    );
    if (!studentId) {
      throw new LeaveRequestError(
        'STUDENT_NOT_FOUND',
        'Không tìm thấy hồ sơ học sinh.',
      );
    }

    const session = await this.persistence.findSession(input.classSessionId);
    if (!session) {
      throw new LeaveRequestError(
        'SESSION_NOT_FOUND',
        'Không tìm thấy buổi học.',
      );
    }

    if (
      !(await this.persistence.isStudentEnrolled(session.classId, studentId))
    ) {
      throw new LeaveRequestError(
        'NOT_ENROLLED',
        'Học sinh không theo học lớp của buổi học này.',
      );
    }

    const today = new Date().toISOString().split('T')[0];
    if (
      session.date < today ||
      session.attendanceLocked ||
      session.status === SessionStatus.COMPLETED
    ) {
      throw new LeaveRequestError(
        'SESSION_NOT_AVAILABLE',
        'Không thể xin nghỉ cho buổi học đã qua hoặc đã khóa điểm danh.',
      );
    }

    if (
      await this.persistence.hasActiveRequest(input.classSessionId, studentId)
    ) {
      throw new LeaveRequestError(
        'DUPLICATE_LEAVE_REQUEST',
        'Đã có đơn xin nghỉ đang chờ hoặc đã được duyệt cho buổi học này.',
      );
    }

    const request = LeaveRequest.submit({
      studentId,
      classSessionId: input.classSessionId,
      reason: input.reason,
      submittedAt: new Date(),
    });
    const saved = await this.persistence.saveSubmitted(request, session);
    return this.persistence.findViewById(saved.id!);
  }
}
