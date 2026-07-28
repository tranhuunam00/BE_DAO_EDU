import { LeaveRequest } from '../../../../../../src/modules/leave-requests/domain/entities/leave-request';
import { LeaveRequestError } from '../../../../../../src/modules/leave-requests/domain/errors/leave-request.error';
import {
  LeaveRequestListFilter,
  LeaveRequestPersistencePort,
  LeaveRequestView,
  LeaveSessionDetails,
} from '../../../../../../src/modules/leave-requests/application/ports/leave-request-persistence.port';
import { ReviewLeaveRequestUseCase } from '../../../../../../src/modules/leave-requests/application/use-cases/manage-leave-request.use-cases';
import { SubmitLeaveRequestUseCase } from '../../../../../../src/modules/leave-requests/application/use-cases/submit-leave-request.use-case';

describe('Leave request use cases', () => {
  let persistence: InMemoryLeaveRequestPersistence;

  beforeEach(() => {
    persistence = new InMemoryLeaveRequestPersistence();
  });

  it('submits a request for an enrolled student', async () => {
    const useCase = new SubmitLeaveRequestUseCase(persistence);

    const result = await useCase.execute({
      studentUserId: 'student-user',
      classSessionId: 'session-1',
      reason: 'Có lịch khám bệnh',
    });

    expect(result?.status).toBe('pending');
    expect(persistence.requests).toHaveLength(1);
  });

  it('rejects a duplicate active request', async () => {
    const useCase = new SubmitLeaveRequestUseCase(persistence);
    await useCase.execute({
      studentUserId: 'student-user',
      classSessionId: 'session-1',
      reason: 'Ốm',
    });

    await expect(
      useCase.execute({
        studentUserId: 'student-user',
        classSessionId: 'session-1',
        reason: 'Vẫn ốm',
      }),
    ).rejects.toMatchObject<Partial<LeaveRequestError>>({
      code: 'DUPLICATE_LEAVE_REQUEST',
    });
  });

  it('allows the responsible teacher to approve', async () => {
    const submit = new SubmitLeaveRequestUseCase(persistence);
    const submitted = await submit.execute({
      studentUserId: 'student-user',
      classSessionId: 'session-1',
      reason: 'Việc gia đình',
    });
    const review = new ReviewLeaveRequestUseCase(persistence);

    const result = await review.execute({
      requestId: submitted!.id,
      actorUserId: 'teacher-user',
      actorRole: 'TEACHER',
      decision: 'approved',
    });

    expect(result?.status).toBe('approved');
  });

  it('prevents an unrelated teacher from reviewing', async () => {
    const submit = new SubmitLeaveRequestUseCase(persistence);
    const submitted = await submit.execute({
      studentUserId: 'student-user',
      classSessionId: 'session-1',
      reason: 'Việc gia đình',
    });
    const review = new ReviewLeaveRequestUseCase(persistence);

    await expect(
      review.execute({
        requestId: submitted!.id,
        actorUserId: 'other-teacher',
        actorRole: 'TEACHER',
        decision: 'approved',
      }),
    ).rejects.toMatchObject<Partial<LeaveRequestError>>({
      code: 'FORBIDDEN',
    });
  });
});

class InMemoryLeaveRequestPersistence extends LeaveRequestPersistencePort {
  requests: LeaveRequest[] = [];
  private readonly session: LeaveSessionDetails = {
    id: 'session-1',
    classId: 'class-1',
    className: 'Toán 10',
    date: '2099-06-20',
    startTime: '08:00',
    endTime: '09:30',
    status: 'Scheduled',
    attendanceLocked: false,
    teacherId: 'teacher-1',
    mainTeacherId: 'teacher-1',
  };

  findStudentIdByUserId(userId: string) {
    return Promise.resolve(userId === 'student-user' ? 'student-1' : null);
  }
  findSession(sessionId: string) {
    return Promise.resolve(sessionId === this.session.id ? this.session : null);
  }
  isStudentEnrolled(classId: string, studentId: string) {
    return Promise.resolve(classId === 'class-1' && studentId === 'student-1');
  }
  hasActiveRequest(sessionId: string, studentId: string) {
    return Promise.resolve(
      this.requests.some(
        (request) =>
          request.classSessionId === sessionId &&
          request.studentId === studentId &&
          ['pending', 'approved'].includes(request.status),
      ),
    );
  }
  private persist(request: LeaveRequest) {
    const saved = this.withId(request);
    const index = this.requests.findIndex((item) => item.id === saved.id);
    if (index >= 0) this.requests[index] = saved;
    else this.requests.push(saved);
    return Promise.resolve(saved);
  }
  findById(id: string) {
    return Promise.resolve(
      this.requests.find((request) => request.id === id) ?? null,
    );
  }
  async findViewById(id: string) {
    const request = await this.findById(id);
    return request ? this.view(request) : null;
  }
  listForStudent(studentId: string, filter: LeaveRequestListFilter) {
    void filter;
    return Promise.resolve(
      this.requests
        .filter((request) => request.studentId === studentId)
        .map((request) => this.view(request)),
    );
  }
  listForManager(
    actorUserId: string,
    actorRole: string,
    filter: LeaveRequestListFilter,
  ) {
    void actorUserId;
    void actorRole;
    void filter;
    return Promise.resolve(this.requests.map((request) => this.view(request)));
  }
  canManageClass(actorUserId: string, actorRole: string, classId: string) {
    return Promise.resolve(
      actorRole === 'ADMIN' ||
        (actorUserId === 'teacher-user' && classId === 'class-1'),
    );
  }
  saveSubmitted(request: LeaveRequest, session: LeaveSessionDetails) {
    void session;
    return this.persist(request);
  }
  saveDecision(request: LeaveRequest, session: LeaveSessionDetails) {
    void session;
    return this.persist(request);
  }
  saveCancellation(request: LeaveRequest) {
    return this.persist(request);
  }

  private withId(request: LeaveRequest) {
    if (request.id) return request;
    return new LeaveRequest({
      ...request.toPrimitives(),
      id: `leave-${this.requests.length + 1}`,
    });
  }

  private view(request: LeaveRequest): LeaveRequestView {
    return {
      id: request.id!,
      studentId: request.studentId,
      studentCode: 'HS001',
      studentName: 'Nguyễn Văn A',
      classSessionId: request.classSessionId,
      classId: this.session.classId,
      className: this.session.className,
      sessionDate: this.session.date,
      startTime: this.session.startTime,
      endTime: this.session.endTime,
      reason: request.reason,
      status: request.status,
      submittedAt: request.submittedAt,
      reviewedAt: request.reviewedAt,
      reviewedByUserId: request.reviewedByUserId,
      reviewNote: request.reviewNote,
      cancelledAt: request.cancelledAt,
    };
  }
}
