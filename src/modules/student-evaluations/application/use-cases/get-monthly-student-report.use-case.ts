import {
  WeeklyStudentReportEntity,
  TrendDirection,
} from '../../domain/entities/weekly-student-report.entity';
import { SqiCalculator, SessionEvaluationInput } from '../../domain/services/sqi-calculator.service';
import { IStudentWeeklyDataQueryPort } from '../ports/student-weekly-data-query.port';

export interface GetMonthlyReportInput {
  studentId: string;
  month: number;
  year: number;
  requestUserId: string;
  userRole: string;
}

export interface GetMonthlyReportOutput {
  report: WeeklyStudentReportEntity | null;
  hasSessions: boolean;
  message?: string;
}

import { IStudentReportApprovalRepositoryPort } from '../ports/student-report-approval-repository.port';

export class GetMonthlyStudentReportUseCase {
  constructor(
    private readonly queryPort: IStudentWeeklyDataQueryPort,
    private readonly approvalRepo?: IStudentReportApprovalRepositoryPort,
  ) {}

  async execute(input: GetMonthlyReportInput): Promise<GetMonthlyReportOutput> {
    const { studentId, month, year, requestUserId, userRole } = input;

    if (!studentId || !studentId.trim()) {
      throw new Error('studentId không được để trống');
    }
    if (!month || month < 1 || month > 12) {
      throw new Error('month không hợp lệ (phải từ 1 đến 12)');
    }

    // 1. Kiểm tra bảo mật phân quyền (IDOR Prevention)
    if (userRole === 'STUDENT') {
      const isOwner = await this.queryPort.verifyStudentOwnership(requestUserId, studentId);
      if (!isOwner) {
        throw new Error('Bạn không có quyền xem báo cáo của học sinh này');
      }
    }

    // 2. Tính toán ngày bắt đầu và kết thúc tháng
    const paddedMonth = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const paddedLastDay = String(lastDay).padStart(2, '0');
    const startDate = `${year}-${paddedMonth}-01`;
    const endDate = `${year}-${paddedMonth}-${paddedLastDay}`;

    // 3. Lấy thông tin học sinh
    const studentInfo = await this.queryPort.getStudentInfo(studentId);
    const studentName = studentInfo?.name || 'Học sinh';
    const studentCode = studentInfo?.code || '';

    // 4. Truy vấn các buổi học trong tháng (CHỈ ĐỌC - ZERO MUTATIONS)
    const sessions = await this.queryPort.getWeeklySessions(studentId, startDate, endDate);

    if (!sessions || sessions.length === 0) {
      return {
        report: null,
        hasSessions: false,
        message: `Tháng ${month}/${year} con không có buổi học nào hoặc trung tâm đang nghỉ (${this.formatVnDate(startDate)} - ${this.formatVnDate(endDate)}).`,
      };
    }

    // 5. Lấy dữ liệu tháng trước để so sánh Delta
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
    const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;

    const [prevSessions, approval] = await Promise.all([
      this.queryPort.getWeeklySessions(studentId, prevStart, prevEnd).catch(() => []),
      this.approvalRepo ? this.approvalRepo.findApproval(studentId, 'month', month, year) : Promise.resolve(null),
    ]);

    // 6. Tính toán điểm SQI tháng & Xu hướng
    const sqiResult = SqiCalculator.calculate(
      sessions,
      prevSessions.length > 0 ? prevSessions : null,
    );

    // 7. Tổng hợp nội dung sư phạm cho báo cáo tháng
    const pedagogicalContent = this.synthesizePedagogicalContent(studentName, sessions, sqiResult, month, year);

    // 8. Đóng gói Thực thể Báo cáo
    const report = WeeklyStudentReportEntity.create({
      studentId,
      studentName,
      studentCode,
      weekNumber: month, // Lưu trữ tháng trong trường chu kỳ
      year,
      startDate,
      endDate,
      sqiScore: sqiResult.sqiScore,
      sqiDelta: sqiResult.sqiDelta,
      sqiBreakdown: sqiResult.breakdown,
      subjectPerformances: sqiResult.subjectPerformances,
      overview: pedagogicalContent.overview,
      commendation: approval?.commendation || null,
      suggestion: approval?.suggestion || null,
      strengths: pedagogicalContent.strengths,
      improvements: pedagogicalContent.improvements,
      recommendations: pedagogicalContent.recommendations,
      sessions,
      isApproved: approval ? approval.isApproved : false,
      approvedAt: approval?.approvedAt || null,
      approvedBy: approval?.approvedByName || approval?.approvedByUserId || null,
    });

    return {
      report,
      hasSessions: true,
    };
  }

  private synthesizePedagogicalContent(
    studentName: string,
    sessions: SessionEvaluationInput[],
    sqi: { sqiScore: number; sqiDelta: number; trend: TrendDirection },
    month: number,
    year: number,
  ): { overview: string; strengths: string; improvements: string; recommendations: string[] } {
    const total = sessions.length;
    const hwSessions = sessions.filter((s) => Boolean(s.homeworkStatus) && s.isPresent);
    const completedHw = hwSessions.filter((s) => s.homeworkStatus === 'completed' || s.homeworkStatus === 'yes' || s.homeworkStatus === 'done' || s.homeworkStatus === 'excellent').length;

    const underSessions = sessions.filter((s) => Boolean(s.understanding) && s.isPresent);
    const understoodCount = underSessions.filter((s) => s.understanding === 'understood' || s.understanding === 'quick').length;

    const partSessions = sessions.filter((s) => Boolean(s.participation) && s.isPresent);
    const activeCount = partSessions.filter((s) => ['active', 'yes', 'active_raise_hand', 'proactive_ask', 'answer_well'].includes(String(s.participation).toLowerCase())).length;

    const absentCount = sessions.filter((s) => !s.isPresent || ['no', 'absent_unexcused', 'absent_excused'].includes((s.attendanceStatus || '').toLowerCase())).length;

    // Overview
    let overview = '';
    if (sqi.sqiScore >= 85) {
      overview = `Trong tháng ${month}/${year}, con ${studentName} có kết quả học tập tốt, tự giác và tiếp thu nhanh.`;
    } else if (sqi.sqiScore >= 70) {
      overview = `Trong tháng ${month}/${year}, con ${studentName} duy trì lực học ổn định, hoàn thành tốt các bài học.`;
    } else {
      overview = `Trong tháng ${month}/${year}, con ${studentName} cần dành thêm thời gian ôn tập để củng cố kiến thức còn thiếu.`;
    }

    // Strengths
    const strengthParts: string[] = [];
    if (underSessions.length > 0 && understoodCount > 0) {
      strengthParts.push(`Nắm bắt bài nhanh (${understoodCount}/${underSessions.length} buổi tiếp thu tốt)`);
    }
    if (partSessions.length > 0 && activeCount > 0) {
      strengthParts.push('chăm chỉ phát biểu xây dựng bài');
    }
    if (hwSessions.length > 0 && completedHw === hwSessions.length) {
      strengthParts.push('hoàn thành đủ 100% bài tập về nhà');
    }
    const strengths =
      strengthParts.length > 0
        ? `${strengthParts.join(', ')}.`
        : 'Tham gia học tập đầy đủ, đúng giờ.';

    // Improvements
    const improveParts: string[] = [];
    if (hwSessions.length > 0 && completedHw < hwSessions.length) {
      improveParts.push(`còn ${hwSessions.length - completedHw} buổi chưa làm đủ bài tập`);
    }
    if (absentCount > 0) {
      improveParts.push(`vắng ${absentCount} buổi học`);
    }
    if (underSessions.length > 0 && understoodCount < underSessions.length) {
      improveParts.push('cần ôn lại một số phần kiến thức trọng tâm');
    }
    const improvements =
      improveParts.length > 0
        ? `${improveParts.join('; ')}.`
        : 'Duy trì phong độ tốt, không có vi phạm nề nếp.';

    // Recommendations
    const recommendations: string[] = [];
    if (hwSessions.length > 0 && completedHw < hwSessions.length) {
      recommendations.push('Gia đình nhắc con làm đầy đủ bài tập trước buổi học.');
    }
    if (absentCount > 0) {
      recommendations.push('Hạn chế nghỉ học để theo kịp tiến độ kiến thức của lớp.');
    }
    recommendations.push('Động viên con tiếp tục phát huy tinh thần tự giác trong các buổi học tiếp theo.');

    return {
      overview,
      strengths,
      improvements,
      recommendations,
    };
  }

  private formatVnDate(dStr: string): string {
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dStr;
  }
}
