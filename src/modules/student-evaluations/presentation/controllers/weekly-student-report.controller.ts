import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Headers,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../../../infrastructure/security/roles.guard';
import { Roles } from '../../../../infrastructure/security/roles.decorator';
import { Role } from '../../../../domain/value-objects/role.enum';
import { GetWeeklyStudentReportUseCase } from '../../application/use-cases/get-weekly-student-report.use-case';
import { GetMonthlyStudentReportUseCase } from '../../application/use-cases/get-monthly-student-report.use-case';
import { GetClassWeeklyReportsUseCase } from '../../application/use-cases/get-class-weekly-reports.use-case';
import { ToggleReportApprovalUseCase } from '../../application/use-cases/toggle-report-approval.use-case';
import { StudentOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { Body, Post, Inject } from '@nestjs/common';
import { IStudentReportApprovalRepositoryPort } from '../../application/ports/student-report-approval-repository.port';

@Controller('weekly-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WeeklyStudentReportController {
  constructor(
    private readonly getWeeklyReportUseCase: GetWeeklyStudentReportUseCase,
    private readonly getMonthlyReportUseCase: GetMonthlyStudentReportUseCase,
    private readonly getClassWeeklyReportsUseCase: GetClassWeeklyReportsUseCase,
    private readonly toggleReportApprovalUseCase: ToggleReportApprovalUseCase,
    @InjectRepository(StudentOrmEntity)
    private readonly studentRepo: Repository<StudentOrmEntity>,
    @Inject(IStudentReportApprovalRepositoryPort)
    private readonly approvalRepo?: IStudentReportApprovalRepositoryPort,
  ) {}

  /**
   * 1. API DÀNH CHO PHỤ HUYNH / HỌC SINH (STUDENT)
   * Tự động lấy báo cáo của học sinh thuộc tài khoản đang đăng nhập
   * Hỗ trợ header 'x-student-id' khi tài khoản có nhiều con
   */
  @Get('my-report')
  @Roles(Role.STUDENT)
  async getMyReport(
    @Req() req: any,
    @Headers('x-student-id') headerStudentId?: string,
    @Query('week') weekStr?: string,
    @Query('year') yearStr?: string,
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new ForbiddenException('Không xác định được danh tính người dùng');
    }

    // 1. Xác định studentId (Nếu có header x-student-id thì kiểm tra quyền sở hữu, nếu không lấy con đầu tiên)
    let targetStudentId = headerStudentId;
    if (targetStudentId) {
      const owned = await this.studentRepo.findOne({
        where: { id: targetStudentId, userId },
      });
      if (!owned) {
        throw new ForbiddenException('Bạn không có quyền truy cập báo cáo của học sinh này.');
      }
    } else {
      const defaultStudent = await this.studentRepo.findOne({
        where: { userId },
      });
      if (!defaultStudent) {
        throw new NotFoundException('Tài khoản này chưa được liên kết với học sinh nào');
      }
      targetStudentId = defaultStudent.id;
    }

    const { weekNumber, year } = this.resolveWeekAndYear(weekStr, yearStr);

    const result = await this.getWeeklyReportUseCase.execute({
      studentId: targetStudentId,
      weekNumber,
      year,
      requestUserId: userId,
      userRole: 'STUDENT',
    });

    return {
      success: true,
      data: this.serializeReport(result.report),
      hasSessions: result.hasSessions,
      message: result.message,
    };
  }

  /**
   * 2. API DÀNH CHO GIÁO VIÊN & ADMIN: XEM TỔNG HỢP SQI CẢ LỚP HỌC
   */
  @Get('class/:classId')
  @Roles(Role.ADMIN, Role.TEACHER)
  async getClassWeeklyReports(
    @Param('classId') classId: string,
    @Req() req: any,
    @Query('week') weekStr?: string,
    @Query('year') yearStr?: string,
    @Query('month') monthStr?: string,
  ) {
    let weekNumber: number | undefined;
    let month: number | undefined;
    let year: number;

    if (monthStr) {
      const resolved = this.resolveMonthAndYear(monthStr, yearStr);
      month = resolved.month;
      year = resolved.year;
    } else {
      const resolved = this.resolveWeekAndYear(weekStr, yearStr);
      weekNumber = resolved.weekNumber;
      year = resolved.year;
    }

    const result = await this.getClassWeeklyReportsUseCase.execute({
      classId,
      weekNumber,
      month,
      year,
      requestUserId: req.user?.sub,
      userRole: req.user?.role,
    });

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 3. API DÀNH CHO GIÁO VIÊN & ADMIN: XEM CHI TIẾT BÁO CÁO CỦA 1 HỌC SINH
   */
  @Get('student/:studentId')
  @Roles(Role.ADMIN, Role.TEACHER)
  async getStudentWeeklyReport(
    @Param('studentId') studentId: string,
    @Req() req: any,
    @Query('week') weekStr?: string,
    @Query('year') yearStr?: string,
  ) {
    const { weekNumber, year } = this.resolveWeekAndYear(weekStr, yearStr);

    const result = await this.getWeeklyReportUseCase.execute({
      studentId,
      weekNumber,
      year,
      requestUserId: req.user?.sub,
      userRole: req.user?.role,
    });

    return {
      success: true,
      data: this.serializeReport(result.report),
      hasSessions: result.hasSessions,
      message: result.message,
    };
  }

  /**
   * 4. API DÀNH CHO PHỤ HUYNH / HỌC SINH: XEM BÁO CÁO THÁNG
   */
  @Get('my-report/monthly')
  @Roles(Role.STUDENT)
  async getMyMonthlyReport(
    @Req() req: any,
    @Headers('x-student-id') headerStudentId?: string,
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
  ) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new ForbiddenException('Không xác định được danh tính người dùng');
    }

    let targetStudentId = headerStudentId;
    if (targetStudentId) {
      const owned = await this.studentRepo.findOne({
        where: { id: targetStudentId, userId },
      });
      if (!owned) {
        throw new ForbiddenException('Bạn không có quyền truy cập báo cáo của học sinh này.');
      }
    } else {
      const defaultStudent = await this.studentRepo.findOne({
        where: { userId },
      });
      if (!defaultStudent) {
        throw new NotFoundException('Tài khoản này chưa được liên kết với học sinh nào');
      }
      targetStudentId = defaultStudent.id;
    }

    const { month, year } = this.resolveMonthAndYear(monthStr, yearStr);

    const result = await this.getMonthlyReportUseCase.execute({
      studentId: targetStudentId,
      month,
      year,
      requestUserId: userId,
      userRole: 'STUDENT',
    });

    return {
      success: true,
      data: this.serializeReport(result.report),
      hasSessions: result.hasSessions,
      message: result.message,
    };
  }

  /**
   * 5. API DÀNH CHO GIÁO VIÊN & ADMIN: XEM BÁO CÁO THÁNG CỦA 1 HỌC SINH
   */
  @Get('student/:studentId/monthly')
  @Roles(Role.ADMIN, Role.TEACHER)
  async getStudentMonthlyReport(
    @Param('studentId') studentId: string,
    @Req() req: any,
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
  ) {
    const { month, year } = this.resolveMonthAndYear(monthStr, yearStr);

    const result = await this.getMonthlyReportUseCase.execute({
      studentId,
      month,
      year,
      requestUserId: req.user?.sub,
      userRole: req.user?.role,
    });

    return {
      success: true,
      data: this.serializeReport(result.report),
      hasSessions: result.hasSessions,
      message: result.message,
    };
  }

  /**
   * 6. API DÀNH CHO GIÁO VIÊN & ADMIN: PHÊ DUYỆT / HỦY DUYỆT BÁO CÁO CỦA HỌC SINH
   */
  @Post('student/:studentId/toggle-approval')
  @Roles(Role.ADMIN, Role.TEACHER)
  async toggleReportApproval(
    @Param('studentId') studentId: string,
    @Body()
    body: {
      reportType: 'week' | 'month';
      periodNumber: number;
      year: number;
      isApproved: boolean;
      commendation?: string | null;
      suggestion?: string | null;
    },
    @Req() req: any,
  ) {
    const userId = req.user?.sub;
    const result = await this.toggleReportApprovalUseCase.execute({
      studentId,
      reportType: body.reportType,
      periodNumber: body.periodNumber,
      year: body.year,
      isApproved: body.isApproved,
      userId,
      commendation: body.commendation,
      suggestion: body.suggestion,
    });

    return {
      success: true,
      data: result,
      message: body.isApproved ? 'Đã phê duyệt báo cáo thành công' : 'Đã hủy duyệt báo cáo',
    };
  }

  /**
   * 7. API DÀNH CHO GIÁO VIÊN & ADMIN: SINH NHẬN XÉT SƯ PHẠM BÁO CÁO BẰNG GEMINI AI
   */
  @Post('student/:studentId/generate-pedagogy')
  @Roles(Role.ADMIN, Role.TEACHER)
  async generateReportPedagogy(
    @Param('studentId') studentId: string,
    @Body()
    body: {
      studentName?: string;
      reportType: 'week' | 'month';
      periodNumber: number;
      year: number;
      sqiScore?: number;
      strengths?: string;
      improvements?: string;
    },
  ) {
    let studentName = body.studentName;
    if (!studentName && this.studentRepo) {
      const student = await this.studentRepo.findOne({ where: { id: studentId } });
      if (student) studentName = `${student.lastName} ${student.firstName}`.trim();
    }
    studentName = studentName || 'học sinh';

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const prompt = `Bạn là chuyên gia cố vấn sư phạm cao cấp tại tổ chức giáo dục DAO EDU. Dựa vào kết quả học tập của học sinh ${studentName} trong ${body.reportType === 'month' ? `tháng ${body.periodNumber}/${body.year}` : `tuần ${body.periodNumber}/${body.year}`}:
- Điểm SQI đánh giá tổng hợp: ${body.sqiScore ?? 80}/100
- Điểm mạnh hiện tại: ${body.strengths || 'Điểm danh đầy đủ, tiếp thu bài tốt, có ý thức học tập'}
- Điểm cần lưu ý/cải thiện: ${body.improvements || 'Cần duy trì đều đặn thói quen làm bài tập về nhà và tập trung hơn'}

Hãy soạn thảo nhận xét sư phạm toàn diện, chi tiết, mang tính xây dựng và chuẩn mực giáo dục dưới định dạng JSON duy nhất không kèm markdown (bắt buộc có đủ 4 trường nội dung):
{
  "commendation": "Lời tuyên dương sâu sắc (2-3 câu) ghi nhận sự nỗ lực, tiến bộ nổi bật và tinh thần tự giác của con",
  "strengths": "Nhận xét chi tiết (2-3 câu) về ưu điểm, khả năng tư duy, mức độ tương tác và khả năng tiếp thu bài trên lớp",
  "improvements": "Điểm con cần lưu ý và rèn giũa thêm (2-3 câu) về nền nếp làm bài tập, chuyên cần, hoặc độ tập trung",
  "suggestion": "Kế hoạch rèn luyện cụ thể tại nhà (2-3 câu) và hướng dẫn chi tiết để gia đình/phụ huynh đồng hành hỗ trợ con hiệu quả",
  "recommendations": ["Gợi ý phối hợp 1 cho phụ huynh", "Gợi ý phối hợp 2 cho phụ huynh"]
}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
          const parsed = JSON.parse(cleaned);
          return { success: true, data: parsed };
        }
      } catch {
        // Fallback below
      }
    }

    const isGood = (body.sqiScore ?? 80) >= 80;
    return {
      success: true,
      data: {
        commendation: isGood
          ? `Tuyên dương con ${studentName} đã duy trì thái độ học tập rất nghiêm túc, tích cực phát biểu và đạt chỉ số SQI xuất sắc (${body.sqiScore ?? 85}/100) trong đợt học vừa qua!`
          : `Thầy cô ghi nhận sự cố gắng, tính tự giác và tinh thần vượt khó của con ${studentName} trong suốt các buổi học vừa qua.`,
        strengths: isGood
          ? `Con ${studentName} có khả năng tiếp thu bài nhanh, tư duy logic tốt và chủ động thảo luận các dạng bài học cùng thầy cô và các bạn.`
          : `Con ${studentName} có ý thức lắng nghe giảng bài, tuân thủ tốt nội quy lớp học và luôn cố gắng hoàn thành nhiệm vụ được giao.`,
        improvements: isGood
          ? `Con cần chú ý rèn luyện tính cẩn thận trong các bước trình bày chi tiết và chủ động thử sức thêm với các bài tập nâng cao.`
          : `Con cần dành thêm thời gian ôn tập kiến thức sau mỗi buổi học và duy trì thói quen làm bài tập về nhà đầy đủ trước khi lên lớp.`,
        suggestion:
          `• Học sinh: Dành 25-30 phút mỗi ngày xem lại bài giảng trọng tâm và tự giác hoàn thành bài tập đúng hạn.\n• Gia đình: Phụ huynh tiếp tục động viên, nhắc nhở con kiểm tra lại bài vở vào buổi tối để con tự tin và tiến bộ vượt bậc.`,
        recommendations: [
          'Gia đình dành lời khen ngợi để tiếp thêm sự tự tin cho con sau mỗi tuần học.',
          'Nhắc con chuẩn bị sách vở và hoàn thiện bài tập sớm vào buổi tối trước khi đến lớp.',
        ],
      },
    };
  }

  /**
   * 8. API DÀNH CHO GIÁO VIÊN & ADMIN: ĐÁNH DẤU / HỦY ĐÃ GỬI BÁO CÁO CHO PHỤ HUYNH
   */
  @Post('student/:studentId/toggle-zalo-sent')
  @Roles(Role.ADMIN, Role.TEACHER)
  async toggleZaloSent(
    @Param('studentId') studentId: string,
    @Body()
    body: {
      reportType: 'week' | 'month';
      periodNumber: number;
      year: number;
      isSent: boolean;
    },
  ) {
    if (!this.approvalRepo) {
      return { success: true, message: 'Đã cập nhật trạng thái gửi' };
    }

    const existing = await this.approvalRepo.findApproval(
      studentId,
      body.reportType,
      body.periodNumber,
      body.year,
    );

    const updated = await this.approvalRepo.saveApproval({
      studentId,
      reportType: body.reportType,
      periodNumber: body.periodNumber,
      year: body.year,
      isApproved: existing?.isApproved ?? false,
      approvedByUserId: existing?.approvedByUserId ?? null,
      approvedAt: existing?.approvedAt ?? null,
      sentToZaloAt: body.isSent ? new Date() : null,
      commendation: existing?.commendation ?? null,
      suggestion: existing?.suggestion ?? null,
    });

    return {
      success: true,
      data: updated,
      message: body.isSent ? 'Đã đánh dấu đã gửi báo cáo cho Phụ huynh' : 'Đã bỏ đánh dấu gửi',
    };
  }

  private resolveMonthAndYear(monthStr?: string, yearStr?: string): { month: number; year: number } {
    const now = new Date();
    const currentYear = yearStr ? parseInt(yearStr, 10) : now.getFullYear();
    const currentMonth = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
    const validMonth = !isNaN(currentMonth) && currentMonth >= 1 && currentMonth <= 12 ? currentMonth : now.getMonth() + 1;
    return { month: validMonth, year: !isNaN(currentYear) ? currentYear : now.getFullYear() };
  }

  private serializeReport(report: any): any {
    if (!report) return null;
    return typeof report.toJSON === 'function' ? report.toJSON() : report;
  }

  private resolveWeekAndYear(weekStr?: string, yearStr?: string): { weekNumber: number; year: number } {
    const now = new Date();
    const currentYear = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

    if (weekStr) {
      const parsedWeek = parseInt(weekStr, 10);
      if (!isNaN(parsedWeek) && parsedWeek >= 1 && parsedWeek <= 53) {
        return { weekNumber: parsedWeek, year: currentYear };
      }
    }

    // Mặc định tuần hiện tại theo ISO
    const target = new Date(now.valueOf());
    const dayNr = (now.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const currentWeekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);

    return { weekNumber: currentWeekNumber, year: currentYear };
  }
}
