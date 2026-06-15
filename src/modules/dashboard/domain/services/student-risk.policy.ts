export interface StudentRiskInput {
  studentId: string;
  studentCode: string;
  studentName: string;
  mobile: string | null;
  attendance: boolean[];
  assignmentCount: number;
  submittedCount: number;
}

export class StudentRiskPolicy {
  evaluate(input: StudentRiskInput) {
    const total = input.attendance.length;
    const absent = input.attendance.filter((present) => !present).length;
    let consecutiveAbsences = 0;
    for (const present of input.attendance) {
      if (present) break;
      consecutiveAbsences += 1;
    }
    const missedAssignments = input.assignmentCount - input.submittedCount;
    const absenceRate = total ? absent / total : 0;
    const missedAssignmentRate = input.assignmentCount
      ? missedAssignments / input.assignmentCount
      : 0;
    let score = absenceRate * 55 + missedAssignmentRate * 25;
    if (consecutiveAbsences >= 3) score += 25;
    else if (consecutiveAbsences >= 2) score += 15;
    const reasons: string[] = [];
    if (absenceRate >= 0.25) reasons.push(`Vắng ${absent}/${total} buổi`);
    if (consecutiveAbsences >= 2) {
      reasons.push(`Vắng liên tiếp ${consecutiveAbsences} buổi gần nhất`);
    }
    if (missedAssignmentRate >= 0.3) {
      reasons.push(`Chưa nộp ${missedAssignments}/${input.assignmentCount} bài`);
    }
    return {
      studentId: input.studentId,
      studentCode: input.studentCode,
      studentName: input.studentName,
      mobile: input.mobile,
      level: score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low',
      score: Math.min(Math.round(score), 100),
      reasons,
      suggestion:
        score >= 35
          ? 'Liên hệ phụ huynh để xác nhận tình hình và thống nhất hỗ trợ.'
          : 'Tiếp tục theo dõi.',
    };
  }
}
