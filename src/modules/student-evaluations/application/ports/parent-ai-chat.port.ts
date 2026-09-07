export interface StudentRecentSessionSummary {
  date: string;
  subject: string;
  isPresent: boolean;
  homeworkStatus?: string;
  understanding?: string;
  behaviorTags?: string[];
  score?: string | null;
  teacherComment?: string | null;
}

export interface ParentAiChatContext {
  studentId: string;
  studentName: string;
  className?: string;
  currentSqiScore?: number;
  sqiTrend?: 'up' | 'down' | 'stable';
  attendanceRatePercent: number;
  homeworkCompletionPercent: number;
  averageScore?: number | null;
  strengths: string[];
  weaknesses: string[];
  recentSessions: StudentRecentSessionSummary[];
}

export interface ParentChatMessageItem {
  role: 'user' | 'model';
  text: string;
}

export interface ParentAiChatResponse {
  answer: string;
  followUpSuggestions: string[];
  groundedDataSummary: {
    sqiScore?: number;
    attendanceRate: number;
    homeworkRate: number;
    sessionCount: number;
  };
}

export const PARENT_AI_CHAT_PORT = Symbol('PARENT_AI_CHAT_PORT');

export interface IParentAiChatPort {
  askChatbot(
    question: string,
    context: ParentAiChatContext,
    history?: ParentChatMessageItem[],
  ): Promise<ParentAiChatResponse>;
}
