import { ParentAiChatContext } from './parent-ai-chat.port';

export const STUDENT_PROFILE_CONTEXT_QUERY_PORT = Symbol('STUDENT_PROFILE_CONTEXT_QUERY_PORT');

export interface IStudentProfileContextQueryPort {
  getStudentProfileContext(
    studentId: string,
    limitWeeks?: number,
  ): Promise<ParentAiChatContext>;

  validateParentStudentOwnership(
    userId: string,
    studentId: string,
  ): Promise<boolean>;

  getDefaultStudentForUser(userId: string): Promise<{
    studentId: string;
    studentName: string;
  } | null>;
}
