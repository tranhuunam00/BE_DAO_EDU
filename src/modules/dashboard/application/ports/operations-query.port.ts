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
}

export interface CancelledReceipt {
  id: string;
  createdAt: Date;
  actorName: string | null;
  type: string;
  receiptCode: string | null;
  totalAmount: number;
  reason: string | null;
}

export interface AnomaliesResult {
  cancelledReceipts: CancelledReceipt[];
}

export abstract class OperationsQueryPort {
  abstract getRiskInputs(): Promise<StudentRiskInput[]>;
  abstract getWaitingStudents(): Promise<WaitingStudent[]>;
  abstract getCandidateClasses(): Promise<CandidateClass[]>;
  abstract getTasks(): Promise<OperationsTasks>;
  abstract getAnomalies(): Promise<AnomaliesResult>;
}
