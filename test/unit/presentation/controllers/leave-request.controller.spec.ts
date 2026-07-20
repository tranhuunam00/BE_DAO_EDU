import { LeaveRequestController } from '../../../../src/presentation/controllers/leave-request.controller';
import { Role } from '../../../../src/domain/value-objects/role.enum';
import { LeaveRequestError } from '../../../../src/modules/leave-requests/domain/errors/leave-request.error';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('LeaveRequestController', () => {
  let controller: LeaveRequestController;
  let submitLeaveRequest: { execute: jest.Mock };
  let listMyLeaveRequests: { execute: jest.Mock };
  let listManagedLeaveRequests: { execute: jest.Mock };
  let reviewLeaveRequest: { execute: jest.Mock };
  let cancelLeaveRequest: { execute: jest.Mock };

  beforeEach(() => {
    submitLeaveRequest = { execute: jest.fn() };
    listMyLeaveRequests = { execute: jest.fn() };
    listManagedLeaveRequests = { execute: jest.fn() };
    reviewLeaveRequest = { execute: jest.fn() };
    cancelLeaveRequest = { execute: jest.fn() };

    controller = new LeaveRequestController(
      submitLeaveRequest as any,
      listMyLeaveRequests as any,
      listManagedLeaveRequests as any,
      reviewLeaveRequest as any,
      cancelLeaveRequest as any,
    );
  });

  const req = { user: { sub: 'student-user-1', role: Role.STUDENT } };

  it('submits leave request for student', async () => {
    const dto = { classSessionId: 'session-1', reason: 'Ốm' };
    submitLeaveRequest.execute.mockResolvedValue({ id: 'req-1', status: 'PENDING' });

    const result = await controller.submit(req as any, dto as any);
    expect(submitLeaveRequest.execute).toHaveBeenCalledWith({
      studentUserId: 'student-user-1',
      classSessionId: 'session-1',
      reason: 'Ốm',
    });
    expect(result).toEqual({ id: 'req-1', status: 'PENDING' });
  });

  it('lists student own leave requests', async () => {
    listMyLeaveRequests.execute.mockResolvedValue([{ id: 'req-1' }]);

    const result = await controller.listMine(req as any, { status: 'PENDING' } as any);
    expect(listMyLeaveRequests.execute).toHaveBeenCalledWith({
      studentUserId: 'student-user-1',
      status: 'PENDING',
    });
    expect(result).toEqual([{ id: 'req-1' }]);
  });

  it('lists managed leave requests for teacher/admin', async () => {
    const adminReq = { user: { sub: 'admin-user-1', role: Role.ADMIN } };
    listManagedLeaveRequests.execute.mockResolvedValue([{ id: 'req-1' }]);

    const result = await controller.listManaged(adminReq as any, { status: 'PENDING' } as any);
    expect(listManagedLeaveRequests.execute).toHaveBeenCalledWith({
      actorUserId: 'admin-user-1',
      actorRole: Role.ADMIN,
      filter: { status: 'PENDING' },
    });
    expect(result).toEqual([{ id: 'req-1' }]);
  });

  it('reviews leave request', async () => {
    const adminReq = { user: { sub: 'admin-user-1', role: Role.ADMIN } };
    const dto = { decision: 'APPROVED' as any, reviewNote: 'Dong y' };
    reviewLeaveRequest.execute.mockResolvedValue({ id: 'req-1', status: 'APPROVED' });

    const result = await controller.review(adminReq as any, 'req-1', dto);
    expect(reviewLeaveRequest.execute).toHaveBeenCalledWith({
      requestId: 'req-1',
      actorUserId: 'admin-user-1',
      actorRole: Role.ADMIN,
      decision: 'APPROVED',
      reviewNote: 'Dong y',
    });
    expect(result).toEqual({ id: 'req-1', status: 'APPROVED' });
  });

  it('cancels leave request', async () => {
    cancelLeaveRequest.execute.mockResolvedValue({ id: 'req-1', status: 'CANCELLED' });

    const result = await controller.cancel(req as any, 'req-1');
    expect(cancelLeaveRequest.execute).toHaveBeenCalledWith({
      requestId: 'req-1',
      studentUserId: 'student-user-1',
    });
    expect(result).toEqual({ id: 'req-1', status: 'CANCELLED' });
  });

  it('translates LeaveRequestError.SESSION_NOT_FOUND to NotFoundException', async () => {
    submitLeaveRequest.execute.mockRejectedValue(new LeaveRequestError('SESSION_NOT_FOUND', 'Session not found'));

    await expect(controller.submit(req as any, { classSessionId: 'invalid' } as any)).rejects.toThrow(NotFoundException);
  });

  it('translates LeaveRequestError.NOT_ENROLLED to ForbiddenException', async () => {
    submitLeaveRequest.execute.mockRejectedValue(new LeaveRequestError('NOT_ENROLLED', 'Not enrolled in class'));

    await expect(controller.submit(req as any, { classSessionId: 'invalid' } as any)).rejects.toThrow(ForbiddenException);
  });

  it('translates other LeaveRequestError to ConflictException', async () => {
    submitLeaveRequest.execute.mockRejectedValue(new LeaveRequestError('ALREADY_SUBMITTED', 'Already submitted'));

    await expect(controller.submit(req as any, { classSessionId: 'session-1' } as any)).rejects.toThrow(ConflictException);
  });
});
