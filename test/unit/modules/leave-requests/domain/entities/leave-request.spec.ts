import { LeaveRequest } from '../../../../../../src/modules/leave-requests/domain/entities/leave-request';
import { LeaveRequestError } from '../../../../../../src/modules/leave-requests/domain/errors/leave-request.error';

describe('LeaveRequest', () => {
  const submittedAt = new Date('2026-06-15T01:00:00.000Z');

  it('submits and approves a leave request', () => {
    const request = LeaveRequest.submit({
      studentId: 'student-1',
      classSessionId: 'session-1',
      reason: '  Có lịch khám bệnh  ',
      submittedAt,
    });

    request.approve(
      'admin-1',
      '  Đồng ý  ',
      new Date('2026-06-15T02:00:00.000Z'),
    );

    expect(request.reason).toBe('Có lịch khám bệnh');
    expect(request.status).toBe('approved');
    expect(request.reviewedByUserId).toBe('admin-1');
    expect(request.reviewNote).toBe('Đồng ý');
  });

  it('does not allow a reviewed request to transition again', () => {
    const request = LeaveRequest.submit({
      studentId: 'student-1',
      classSessionId: 'session-1',
      reason: 'Ốm',
      submittedAt,
    });
    request.reject('teacher-1', null, submittedAt);

    expect(() => request.cancel(submittedAt)).toThrow(LeaveRequestError);
  });

  it('rejects an empty reason', () => {
    expect(() =>
      LeaveRequest.submit({
        studentId: 'student-1',
        classSessionId: 'session-1',
        reason: '   ',
        submittedAt,
      }),
    ).toThrow('Lý do xin nghỉ không được để trống.');
  });
});
