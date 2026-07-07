export interface ReportFilters {
  month?: string;       // e.g. '2026-06'
  startMonth?: string;  // Range filter start
  endMonth?: string;    // Range filter end
  centerId?: string;
  classId?: string;
  classIds?: string[];  // Support selecting multiple classes
  classStatus?: string; // Filter by class status
}

export interface RevenueSummary {
  totalExpected: number;
  totalPaid: number;
  totalDebt: number;
  collectionRate: number;
}

export interface RevenueByMonth {
  month: string;
  expected: number;
  paid: number;
}

export interface RevenueByCenterRow {
  centerId: string;
  centerName: string;
  expected: number;
  paid: number;
}

export interface SalarySummary {
  totalMainTeacher: number;
  totalTA: number;
  totalExpense: number;
  totalPaid: number;
  totalUnpaid: number;
}

export interface SalaryByTeacherRow {
  teacherId: string;
  teacherCode: string;
  teacherName: string;
  type: string;
  sessions: number;
  totalAmount: number;
  paidAmount: number;
  status: string;
}

export interface SalaryByMonth {
  month: string;
  mainTeacher: number;
  ta: number;
}

export interface AttendanceSummary {
  totalSessions: number;
  totalPresent: number;
  totalAbsent: number;
  attendanceRate: number;
}

export interface AttendanceByClassRow {
  classId: string;
  classCode: string;
  className: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  rate: number;
}

export interface AttendanceByMonth {
  month: string;
  rate: number;
  present: number;
  absent: number;
}

export interface TopAbsentStudent {
  studentId: string;
  studentCode: string;
  studentName: string;
  absentCount: number;
  totalSessions: number;
  rate: number;
}

export interface AssignmentSummary {
  totalAssigned: number;
  totalSubmitted: number;
  totalGraded: number;
  totalMissing: number;
  averageScore: number;
}

export interface AssignmentByClassRow {
  classId: string;
  classCode: string;
  className: string;
  assigned: number;
  submitted: number;
  graded: number;
  missing: number;
  averageScore: number;
}

export abstract class ReportsQueryPort {
  // Revenue
  abstract getRevenueSummary(filters: ReportFilters): Promise<RevenueSummary>;
  abstract getRevenueByMonth(filters: ReportFilters): Promise<RevenueByMonth[]>;
  abstract getRevenueByCenter(filters: ReportFilters): Promise<RevenueByCenterRow[]>;

  // Salary
  abstract getSalarySummary(filters: ReportFilters): Promise<SalarySummary>;
  abstract getSalaryByTeacher(filters: ReportFilters): Promise<SalaryByTeacherRow[]>;
  abstract getSalaryByMonth(filters: ReportFilters): Promise<SalaryByMonth[]>;

  // Attendance
  abstract getAttendanceSummary(filters: ReportFilters): Promise<AttendanceSummary>;
  abstract getAttendanceByClass(filters: ReportFilters): Promise<AttendanceByClassRow[]>;
  abstract getAttendanceByMonth(filters: ReportFilters): Promise<AttendanceByMonth[]>;
  abstract getTopAbsentStudents(filters: ReportFilters): Promise<TopAbsentStudent[]>;

  // Assignments
  abstract getAssignmentSummary(filters: ReportFilters): Promise<AssignmentSummary>;
  abstract getAssignmentByClass(filters: ReportFilters): Promise<AssignmentByClassRow[]>;

  // Students
  abstract getStudentsSummary(filters: ReportFilters): Promise<StudentsSummary>;
  abstract getNewStudentsByMonth(filters: ReportFilters): Promise<NewStudentsByMonthRow[]>;
  abstract getNewStudentsList(filters: ReportFilters): Promise<NewStudentRow[]>;
  // New reports
  abstract getClassStudentsStats(filters: ReportFilters): Promise<any[]>;
  abstract getSaleOrdersReport(filters: ReportFilters): Promise<any[]>;
  abstract getStudentAttendanceReport(filters: ReportFilters): Promise<any[]>;
  abstract getStudentDebtsReport(filters: ReportFilters): Promise<any[]>;
}

export interface StudentsSummary {
  totalStudents: number;
  activeStudents: number;
  newStudentsThisMonth: number;
}

export interface NewStudentsByMonthRow {
  month: string;
  count: number;
}

export interface NewStudentRow {
  studentId: string;
  studentCode: string;
  studentName: string;
  mobile: string | null;
  status: string;
  createdAt: string;
}

