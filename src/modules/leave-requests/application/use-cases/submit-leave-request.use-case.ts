import { LeaveRequestPersistencePort } from '../ports/leave-request-persistence.port';
import { LeaveRequest } from '../../domain/entities/leave-request';
import { LeaveRequestError } from '../../domain/errors/leave-request.error';
import { SessionStatus } from '../../../../domain/value-objects/session-status.enum';

export class SubmitLeaveRequestUseCase {
  constructor(private readonly persistence: LeaveRequestPersistencePort) {}

  async execute(input: {
    studentUserId: string;
    studentId?: string;
    classSessionId: string;
    reason: string;
  }) {
    const session = await this.persistence.findSession(input.classSessionId);
    if (!session) {
      throw new LeaveRequestError(
        'SESSION_NOT_FOUND',
        'Không tìm thấy buổi học.',
      );
    }

    let studentId = input.studentId;
    if (studentId) {
      const isOwner = await this.persistence.isStudentOwnedByUser(
        studentId,
        input.studentUserId,
      );
      if (!isOwner) {
        throw new LeaveRequestError(
          'FORBIDDEN',
          'Bạn không có quyền gửi đơn xin nghỉ cho học sinh này.',
        );
      }
    } else {
      const students = await this.persistence.findStudentsByUserId(
        input.studentUserId,
      );
      const activeStudents = students.filter((s) => s.status !== 'Inactive');

      const enrolledStudents: { id: string; name?: string; status?: string }[] = [];
      for (const s of activeStudents) {
        if (await this.persistence.isStudentEnrolled(session.classId, s.id)) {
          enrolledStudents.push(s);
        }
      }

      if (enrolledStudents.length === 0) {
        const fallbackId = (await this.persistence.findStudentIdByUserId(
          input.studentUserId,
        )) || undefined;
        if (fallbackId && (await this.persistence.isStudentEnrolled(session.classId, fallbackId))) {
          studentId = fallbackId;
        } else {
          throw new LeaveRequestError(
            'NOT_ENROLLED',
            'Học sinh không theo học lớp của buổi học này.',
          );
        }
      } else if (enrolledStudents.length > 1) {
        throw new LeaveRequestError(
          'AMBIGUOUS_STUDENT',
          'Tài khoản có nhiều học sinh cùng học lớp này, vui lòng chọn cụ thể học sinh xin nghỉ.',
        );
      } else {
        studentId = enrolledStudents[0].id;
      }
    }

    if (!studentId) {
      throw new LeaveRequestError(
        'STUDENT_NOT_FOUND',
        'Không tìm thấy hồ sơ học sinh.',
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
