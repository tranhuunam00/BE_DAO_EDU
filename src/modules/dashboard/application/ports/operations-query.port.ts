import { CandidateClass } from '../../domain/services/class-recommendation.policy';
import { StudentRiskInput } from '../../domain/services/student-risk.policy';

export interface WaitingStudent {
  id: string;
  studentCode: string;
  studentName: string;
  age: number | null;
}

export interface OperationsTasks {
  unassignedStudents: number;
  unlockedPastSessions: number;
  openPaymentPeriods: number;
  cancelledReceipts: number;
  paymentAnomalies: number;
}

export abstract class OperationsQueryPort {
  abstract getRiskInputs(): Promise<StudentRiskInput[]>;
  abstract getWaitingStudents(): Promise<WaitingStudent[]>;
  abstract getCandidateClasses(): Promise<CandidateClass[]>;
  abstract getTasks(): Promise<OperationsTasks>;
}
