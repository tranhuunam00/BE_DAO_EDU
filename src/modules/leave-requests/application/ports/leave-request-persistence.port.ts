import {
  LeaveRequest,
  LeaveRequestStatus,
} from '../../domain/entities/leave-request';

export interface LeaveSessionDetails {
  id: string;
  classId: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  attendanceLocked: boolean;
  teacherId: string | null;
  mainTeacherId: string | null;
}

export interface LeaveRequestView {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  classSessionId: string;
  classId: string;
  className: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  status: LeaveRequestStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  reviewNote: string | null;
  cancelledAt: Date | null;
}

export interface LeaveRequestListFilter {
  status?: LeaveRequestStatus;
  classId?: string;
}

export abstract class LeaveRequestPersistencePort {
  abstract findStudentIdByUserId(userId: string): Promise<string | null>;
  abstract findSession(sessionId: string): Promise<LeaveSessionDetails | null>;
  abstract isStudentEnrolled(
    classId: string,
    studentId: string,
  ): Promise<boolean>;
  abstract hasActiveRequest(
    sessionId: string,
    studentId: string,
  ): Promise<boolean>;
  abstract findById(id: string): Promise<LeaveRequest | null>;
  abstract findViewById(id: string): Promise<LeaveRequestView | null>;
  abstract listForStudent(
    studentId: string,
    filter: LeaveRequestListFilter,
  ): Promise<LeaveRequestView[]>;
  abstract listForManager(
    actorUserId: string,
    actorRole: string,
    filter: LeaveRequestListFilter,
  ): Promise<LeaveRequestView[]>;
  abstract canManageClass(
    actorUserId: string,
    actorRole: string,
    classId: string,
  ): Promise<boolean>;
  abstract saveSubmitted(
    request: LeaveRequest,
    session: LeaveSessionDetails,
  ): Promise<LeaveRequest>;
  abstract saveDecision(
    request: LeaveRequest,
    session: LeaveSessionDetails,
  ): Promise<LeaveRequest>;
  abstract saveCancellation(request: LeaveRequest): Promise<LeaveRequest>;
}
