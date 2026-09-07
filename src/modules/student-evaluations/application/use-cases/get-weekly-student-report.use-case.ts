import {
  WeeklyStudentReportEntity,
  TrendDirection,
} from '../../domain/entities/weekly-student-report.entity';
import { SqiCalculator, SessionEvaluationInput } from '../../domain/services/sqi-calculator.service';
import { IStudentWeeklyDataQueryPort } from '../ports/student-weekly-data-query.port';

export interface GetWeeklyReportInput {
  studentId: string;
  weekNumber: number;
  year: number;
  requestUserId: string;
  userRole: string;
}

export interface GetWeeklyReportOutput {
  report: WeeklyStudentReportEntity | null;
  hasSessions: boolean;
  message?: string;
}

export class GetWeeklyStudentReportUseCase {
  constructor(private readonly queryPort: IStudentWeeklyDataQueryPort) {}

  async execute(input: GetWeeklyReportInput): Promise<GetWeeklyReportOutput> {
    const { studentId, weekNumber, year, requestUserId, userRole } = input;

    if (!studentId || !studentId.trim()) {
      throw new Error('studentId không được để trống');
    }
    if (!weekNumber || weekNumber < 1 || weekNumber > 53) {
      throw new Error('weekNumber không hợp lệ (phải từ 1 đến 53)');
    }

    // 1. Kiểm tra bảo mật phân quyền (IDOR Prevention)
    if (userRole === 'STUDENT') {
      const isOwner = await this.queryPort.verifyStudentOwnership(requestUserId, studentId);
      if (!isOwner) {
        throw new Error('Bạn không có quyền xem báo cáo của học sinh này');
      }
    }

    // 2. Tính toán ngày bắt đầu (Thứ 2) và kết thúc (Chủ Nhật) của tuần theo chuẩn ISO
    const { startDate, endDate } = this.getWeekDateRange(weekNumber, year);

    // 3. Lấy thông tin học sinh
    const studentInfo = await this.queryPort.getStudentInfo(studentId);
    const studentName = studentInfo?.name || 'Học sinh';
    const studentCode = studentInfo?.code || '';

    // 4. Truy vấn các buổi học trong tuần (CHỈ ĐỌC - ZERO MUTATIONS)
    const sessions = await this.queryPort.getWeeklySessions(studentId, startDate, endDate);

    if (!sessions || sessions.length === 0) {
      return {
        report: null,
        hasSessions: false,
        message: `Tuần ${weekNumber} (${this.formatVnDate(startDate)} - ${this.formatVnDate(endDate)}) con không có buổi học nào hoặc trung tâm nghỉ lễ.`,
      };
    }

    // 5. Lấy SQI tuần trước để tính Delta
    const previousWeek = weekNumber === 1 ? 52 : weekNumber - 1;
    const previousYear = weekNumber === 1 ? year - 1 : year;
    const previousSqi = await this.queryPort.getPreviousWeekSqi(studentId, previousWeek, previousYear);

    // 6. Tính toán điểm SQI 7 yếu tố
    const sqiResult = SqiCalculator.calculate(sessions, previousSqi);

    // 7. Tổng hợp sư phạm có căn cứ (Data -> Evidence -> Interpretation -> Recommendation)
    const pedagogicalContent = this.synthesizePedagogicalContent(studentName, sessions, sqiResult);

    // 8. Đóng gói Thực thể Báo cáo Tuần
    const report = WeeklyStudentReportEntity.create({
      studentId,
      studentName,
      studentCode,
      weekNumber,
      year,
      startDate,
      endDate,
      sqiScore: sqiResult.sqiScore,
      sqiDelta: sqiResult.sqiDelta,
      sqiBreakdown: sqiResult.breakdown,
      subjectPerformances: sqiResult.subjectPerformances,
      overview: pedagogicalContent.overview,
      strengths: pedagogicalContent.strengths,
      improvements: pedagogicalContent.improvements,
      recommendations: pedagogicalContent.recommendations,
      sessions,
      isApproved: true, // Auto-computed pure view
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
  ): { overview: string; strengths: string; improvements: string; recommendations: string[] } {
    const total = sessions.length;
    const completedHw = sessions.filter((s) => s.homeworkStatus === 'completed').length;
    const understoodCount = sessions.filter((s) => s.understanding === 'understood').length;
    const activeCount = sessions.filter((s) => s.participation === 'active').length;
    const absentCount = sessions.filter((s) => !s.isPresent).length;

    // Overview
    let overview = '';
    if (sqi.sqiScore >= 85) {
      overview = `Tuần này con ${studentName} có kết quả học tập xuất sắc, duy trì phong độ rất tốt trên lớp.`;
    } else if (sqi.sqiScore >= 70) {
      overview = `Tuần này con ${studentName} có tiến bộ ổn định, tiếp thu tốt kiến thức trọng tâm của tuần.`;
    } else {
      overview = `Tuần này con ${studentName} cần được khích lệ thêm để củng cố lại bài học và nề nếp làm bài tập.`;
    }

    // Strengths
    const strengthParts: string[] = [];
    if (understoodCount > 0) {
      strengthParts.push(`Nắm bắt bài nhanh (${understoodCount}/${total} buổi tiếp thu bài tốt)`);
    }
    if (activeCount > 0) {
      strengthParts.push('chủ động tham gia phát biểu xây dựng bài');
    }
    if (completedHw === total && total > 0) {
      strengthParts.push('hoàn thành 100% bài tập về nhà đúng hạn');
    }
    const strengths =
      strengthParts.length > 0
        ? `Con ${studentName} thể hiện tốt ở các điểm: ${strengthParts.join(', ')}.`
        : `Con ${studentName} duy trì tham gia học tập cùng lớp.`;

    // Improvements
    const improveParts: string[] = [];
    if (completedHw < total) {
      improveParts.push(`còn ${total - completedHw} buổi chưa hoàn thiện đầy đủ bài tập về nhà`);
    }
    if (absentCount > 0) {
      improveParts.push(`vắng ${absentCount} buổi học`);
    }
    if (understoodCount < total) {
      improveParts.push('cần dành thêm thời gian ôn tập lại một số phần bài học mới');
    }
    const improvements =
      improveParts.length > 0
        ? `Điểm cần lưu ý: ${improveParts.join('; ')}.`
        : 'Con không có điểm trừ đáng kể trong tuần, cần tiếp tục phát huy.';

    // Recommendations for parents
    const recommendations: string[] = [];
    if (completedHw < total) {
      recommendations.push(
        'Nhắc con dành 20-30 phút mỗi tối để giải quyết bài tập còn dang dở, tránh dồn bài trước buổi học.',
      );
    } else {
      recommendations.push('Duy trì thói quen hoàn thành bài tập sớm vào buổi tối.');
    }
    recommendations.push(
      'Khen ngợi nỗ lực của con trong tuần qua để tiếp thêm sự tự tin.',
    );
    recommendations.push(
      'Phụ huynh không cần trực tiếp dạy hay học thay con, chỉ cần khích lệ và kiểm tra việc hoàn thành.',
    );

    return { overview, strengths, improvements, recommendations };
  }

  private getWeekDateRange(weekNumber: number, year: number): { startDate: string; endDate: string } {
    // 4th of January is always in week 1 (ISO 8601)
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7; // 1: Monday, 7: Sunday
    const week1Monday = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
    const targetMonday = new Date(week1Monday.getTime() + (weekNumber - 1) * 7 * 86400000);
    const targetSunday = new Date(targetMonday.getTime() + 6 * 86400000);

    const format = (d: Date) => d.toISOString().split('T')[0];
    return {
      startDate: format(targetMonday),
      endDate: format(targetSunday),
    };
  }

  private formatVnDate(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  }
}
