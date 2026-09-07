import { SessionEvaluationInput } from '../../domain/services/sqi-calculator.service';

export interface StudentBasicInfo {
  id: string;
  name: string;
  code: string;
}

export interface IStudentWeeklyDataQueryPort {
  /**
   * Truy vấn toàn bộ dữ liệu điểm danh và nhận xét buổi học của học sinh trong tuần
   * TUYỆT ĐỐI CHỈ ĐỌC (READ-ONLY) - ZERO MUTATIONS
   */
  getWeeklySessions(
    studentId: string,
    startDate: string,
    endDate: string,
  ): Promise<SessionEvaluationInput[]>;

  /**
   * Lấy điểm SQI của tuần trước để so sánh Delta
   */
  getPreviousWeekSqi(studentId: string, weekNumber: number, year: number): Promise<number | null>;

  /**
   * Kiểm tra quyền sở hữu IDOR: Xác nhận studentId có thuộc tài khoản phụ huynh đang đăng nhập hay không
   */
  verifyStudentOwnership(requestUserId: string, studentId: string): Promise<boolean>;

  /**
   * Lấy thông tin cơ bản của học sinh (Tên, Mã)
   */
  getStudentInfo(studentId: string): Promise<StudentBasicInfo | null>;

  /**
   * Lấy danh sách học sinh đang học trong 1 lớp (Active)
   */
  getClassStudents(classId: string): Promise<StudentBasicInfo[]>;

  /**
   * Kiểm tra giáo viên có phụ trách lớp này hay không
   */
  verifyTeacherClassAccess(teacherUserId: string, classId: string): Promise<boolean>;

  /**
   * Lấy tên lớp học
   */
  getClassName(classId: string): Promise<string | null>;
}

export const IStudentWeeklyDataQueryPort = Symbol('IStudentWeeklyDataQueryPort');
