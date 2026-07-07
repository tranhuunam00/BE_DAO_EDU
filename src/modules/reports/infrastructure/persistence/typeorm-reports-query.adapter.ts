import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SessionStatus } from '../../../../domain/value-objects/session-status.enum';
import {
  AssignmentByClassRow,
  AssignmentSummary,
  AttendanceByClassRow,
  AttendanceByMonth,
  AttendanceSummary,
  ReportFilters,
  ReportsQueryPort,
  RevenueByMonth,
  RevenueByCenterRow,
  RevenueSummary,
  SalaryByMonth,
  SalaryByTeacherRow,
  SalarySummary,
  TopAbsentStudent,
  StudentsSummary,
  NewStudentsByMonthRow,
  NewStudentRow,
} from '../../application/ports/reports-query.port';

@Injectable()
export class TypeOrmReportsQueryAdapter extends ReportsQueryPort {
  constructor(private readonly ds: DataSource) {
    super();
  }

  // ── Revenue ──────────────────────────────────────────

  async getRevenueSummary(filters: ReportFilters): Promise<RevenueSummary> {
    const { where, params } = this.billWhereClause(filters);
    const rows = await this.ds.query(
      `SELECT
         COALESCE(SUM(b.total_amount), 0)::numeric AS expected,
         COALESCE(SUM(b.paid_amount), 0)::numeric  AS paid
       FROM student_monthly_bills b
       JOIN students s ON s.id = b.student_id
       LEFT JOIN class_students cs ON cs.student_id = s.id
       LEFT JOIN classes cl ON cl.id = cs.class_id
       ${where}`,
      params,
    );
    const expected = Number(rows[0]?.expected ?? 0);
    const paid = Number(rows[0]?.paid ?? 0);
    return {
      totalExpected: expected,
      totalPaid: paid,
      totalDebt: Math.max(expected - paid, 0),
      collectionRate: expected > 0 ? Number(((paid / expected) * 100).toFixed(1)) : 0,
    };
  }

  async getRevenueByMonth(filters: ReportFilters): Promise<RevenueByMonth[]> {
    const { where, params } = this.billWhereClause(filters, true);
    const rows = await this.ds.query(
      `SELECT
         b.month,
         COALESCE(SUM(b.total_amount), 0)::numeric AS expected,
         COALESCE(SUM(b.paid_amount), 0)::numeric  AS paid
       FROM student_monthly_bills b
       JOIN students s ON s.id = b.student_id
       LEFT JOIN class_students cs ON cs.student_id = s.id
       LEFT JOIN classes cl ON cl.id = cs.class_id
       ${where}
       GROUP BY b.month
       ORDER BY b.month DESC
       LIMIT 12`,
      params,
    );
    return rows.map((r: any) => ({
      month: r.month,
      expected: Number(r.expected),
      paid: Number(r.paid),
    }));
  }

  async getRevenueByCenter(filters: ReportFilters): Promise<RevenueByCenterRow[]> {
    const { where, params } = this.billWhereClause(filters);
    const rows = await this.ds.query(
      `SELECT
         ct.id AS "centerId",
         ct.name AS "centerName",
         COALESCE(SUM(b.total_amount), 0)::numeric AS expected,
         COALESCE(SUM(b.paid_amount), 0)::numeric  AS paid
       FROM student_monthly_bills b
       JOIN students s ON s.id = b.student_id
       LEFT JOIN class_students cs ON cs.student_id = s.id
       LEFT JOIN classes cl ON cl.id = cs.class_id
       LEFT JOIN centers ct ON ct.id = cl.center_id
       ${where}
       GROUP BY ct.id, ct.name
       ORDER BY expected DESC`,
      params,
    );
    return rows.map((r: any) => ({
      centerId: r.centerId || '',
      centerName: r.centerName || 'Chưa xác định',
      expected: Number(r.expected),
      paid: Number(r.paid),
    }));
  }

  // ── Salary ───────────────────────────────────────────

  async getSalarySummary(filters: ReportFilters): Promise<SalarySummary> {
    const { where, params } = this.salaryWhereClause(filters);
    const rows = await this.ds.query(
      `SELECT
         t.type,
         COALESCE(SUM(wi.total_amount), 0)::numeric AS total,
         COALESCE(SUM(wi.total_amount * (CASE WHEN w.status = 'Paid' THEN 1 ELSE 0 END)), 0)::numeric AS paid
       FROM teacher_monthly_wages w
       JOIN teachers t ON t.id = w.teacher_id
       LEFT JOIN teacher_monthly_wage_items wi ON wi.wage_id = w.id
       LEFT JOIN classes cl ON cl.id = wi.class_id
       ${where}
       GROUP BY t.type`,
      params,
    );

    let totalMainTeacher = 0;
    let totalTA = 0;
    let totalPaid = 0;

    for (const r of rows) {
      const total = Number(r.total);
      const paid = Number(r.paid);
      totalPaid += paid;
      if (r.type === 'Teaching Assistant') {
        totalTA += total;
      } else {
        totalMainTeacher += total;
      }
    }

    return {
      totalMainTeacher,
      totalTA,
      totalExpense: totalMainTeacher + totalTA,
      totalPaid,
      totalUnpaid: totalMainTeacher + totalTA - totalPaid,
    };
  }

  async getSalaryByTeacher(filters: ReportFilters): Promise<SalaryByTeacherRow[]> {
    const { where, params } = this.salaryWhereClause(filters);
    const rows = await this.ds.query(
      `SELECT
         t.id AS "teacherId",
         t.teacher_id AS "teacherCode",
         CONCAT(t.last_name, ' ', t.first_name) AS "teacherName",
         t.type,
         COALESCE(SUM(wi.sessions_count), 0)::int AS sessions,
         COALESCE(SUM(wi.total_amount), 0)::numeric AS "totalAmount",
         COALESCE(SUM(wi.total_amount * (CASE WHEN w.status = 'Paid' THEN 1 ELSE 0 END)), 0)::numeric AS "paidAmount",
         MAX(w.status) AS status
       FROM teacher_monthly_wages w
       JOIN teachers t ON t.id = w.teacher_id
       LEFT JOIN teacher_monthly_wage_items wi ON wi.wage_id = w.id
       LEFT JOIN classes cl ON cl.id = wi.class_id
       ${where}
       GROUP BY t.id, t.teacher_id, t.last_name, t.first_name, t.type
       ORDER BY "totalAmount" DESC`,
      params,
    );

    return rows.map((r: any) => ({
      teacherId: r.teacherId,
      teacherCode: r.teacherCode,
      teacherName: r.teacherName,
      type: r.type,
      sessions: Number(r.sessions),
      totalAmount: Number(r.totalAmount),
      paidAmount: Number(r.paidAmount),
      status: r.status,
    }));
  }

  async getSalaryByMonth(filters: ReportFilters): Promise<SalaryByMonth[]> {
    const { where, params } = this.salaryWhereClause(filters, true);
    const rows = await this.ds.query(
      `SELECT
         w.month,
         t.type,
         COALESCE(SUM(wi.total_amount), 0)::numeric AS total
       FROM teacher_monthly_wages w
       JOIN teachers t ON t.id = w.teacher_id
       LEFT JOIN teacher_monthly_wage_items wi ON wi.wage_id = w.id
       LEFT JOIN classes cl ON cl.id = wi.class_id
       ${where}
       GROUP BY w.month, t.type
       ORDER BY w.month DESC
       LIMIT 24`,
      params,
    );

    const monthMap: Record<string, { mainTeacher: number; ta: number }> = {};
    for (const r of rows) {
      if (!monthMap[r.month]) monthMap[r.month] = { mainTeacher: 0, ta: 0 };
      if (r.type === 'Teaching Assistant') {
        monthMap[r.month].ta += Number(r.total);
      } else {
        monthMap[r.month].mainTeacher += Number(r.total);
      }
    }

    return Object.entries(monthMap)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12);
  }

  // ── Attendance ───────────────────────────────────────

  async getAttendanceSummary(filters: ReportFilters): Promise<AttendanceSummary> {
    const { where, params } = this.attendanceWhereClause(filters);
    const rows = await this.ds.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE sa.is_present = true)::int AS present,
         COUNT(*) FILTER (WHERE sa.is_present = false)::int AS absent
       FROM student_attendance sa
       JOIN class_sessions cs ON cs.id = sa.class_session_id
       JOIN classes cl ON cl.id = cs.class_id
       ${where}`,
      params,
    );
    const total = Number(rows[0]?.total ?? 0);
    const present = Number(rows[0]?.present ?? 0);
    const absent = Number(rows[0]?.absent ?? 0);
    return {
      totalSessions: total,
      totalPresent: present,
      totalAbsent: absent,
      attendanceRate: total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0,
    };
  }

  async getAttendanceByClass(filters: ReportFilters): Promise<AttendanceByClassRow[]> {
    const { where, params } = this.attendanceWhereClause(filters);
    const rows = await this.ds.query(
      `SELECT
         cl.id AS "classId",
         cl.class_code AS "classCode",
         cl.class_name AS "className",
         COUNT(*)::int AS "totalSessions",
         COUNT(*) FILTER (WHERE sa.is_present = true)::int AS "presentCount",
         COUNT(*) FILTER (WHERE sa.is_present = false)::int AS "absentCount"
       FROM student_attendance sa
       JOIN class_sessions cs ON cs.id = sa.class_session_id
       JOIN classes cl ON cl.id = cs.class_id
       ${where}
       GROUP BY cl.id, cl.class_code, cl.class_name
       ORDER BY "totalSessions" DESC`,
      params,
    );
    return rows.map((r: any) => {
      const total = Number(r.totalSessions);
      const present = Number(r.presentCount);
      return {
        classId: r.classId,
        classCode: r.classCode,
        className: r.className,
        totalSessions: total,
        presentCount: present,
        absentCount: Number(r.absentCount),
        rate: total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0,
      };
    });
  }

  async getAttendanceByMonth(filters: ReportFilters): Promise<AttendanceByMonth[]> {
    const { where, params } = this.attendanceWhereClause(filters, true);
    const rows = await this.ds.query(
      `SELECT
         TO_CHAR(cs.date::date, 'YYYY-MM') AS month,
         COUNT(*) FILTER (WHERE sa.is_present = true)::int AS present,
         COUNT(*) FILTER (WHERE sa.is_present = false)::int AS absent
       FROM student_attendance sa
       JOIN class_sessions cs ON cs.id = sa.class_session_id
       JOIN classes cl ON cl.id = cs.class_id
       ${where}
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      params,
    );
    return rows.map((r: any) => {
      const present = Number(r.present);
      const absent = Number(r.absent);
      const total = present + absent;
      return {
        month: r.month,
        rate: total > 0 ? Number(((present / total) * 100).toFixed(1)) : 0,
        present,
        absent,
      };
    });
  }

  async getTopAbsentStudents(filters: ReportFilters): Promise<TopAbsentStudent[]> {
    const { where, params } = this.attendanceWhereClause(filters);
    const rows = await this.ds.query(
      `SELECT
         s.id AS "studentId",
         s.student_id AS "studentCode",
         CONCAT(s.last_name, ' ', s.first_name) AS "studentName",
         COUNT(*) FILTER (WHERE sa.is_present = false)::int AS "absentCount",
         COUNT(*)::int AS "totalSessions"
       FROM student_attendance sa
       JOIN class_sessions cs ON cs.id = sa.class_session_id
       JOIN classes cl ON cl.id = cs.class_id
       JOIN students s ON s.id = sa.student_id
       ${where}
       GROUP BY s.id, s.student_id, s.last_name, s.first_name
       HAVING COUNT(*) FILTER (WHERE sa.is_present = false) > 0
       ORDER BY "absentCount" DESC
       LIMIT 15`,
      params,
    );
    return rows.map((r: any) => {
      const absent = Number(r.absentCount);
      const total = Number(r.totalSessions);
      return {
        studentId: r.studentId,
        studentCode: r.studentCode,
        studentName: r.studentName,
        absentCount: absent,
        totalSessions: total,
        rate: total > 0 ? Number(((absent / total) * 100).toFixed(1)) : 0,
      };
    });
  }

  // ── Assignments ──────────────────────────────────────

  async getAssignmentSummary(filters: ReportFilters): Promise<AssignmentSummary> {
    const { where, params } = this.assignmentWhereClause(filters);
    const rows = await this.ds.query(
      `SELECT
         COUNT(DISTINCT a.id)::int AS assigned,
         COUNT(sub.id)::int AS submitted,
         COUNT(sub.id) FILTER (WHERE sub.status = 'graded')::int AS graded,
         COALESCE(AVG(sub.score) FILTER (WHERE sub.status = 'graded'), 0)::numeric AS avg_score
       FROM assignments a
       JOIN classes cl ON cl.id = a.class_id
       LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id
       ${where}`,
      params,
    );

    const assigned = Number(rows[0]?.assigned ?? 0);
    const submitted = Number(rows[0]?.submitted ?? 0);
    const graded = Number(rows[0]?.graded ?? 0);

    // Count total expected submissions (assigned assignments × enrolled students)
    const expectedRows = await this.ds.query(
      `SELECT
         COALESCE(SUM(enrolled.cnt), 0)::int AS total_expected
       FROM assignments a
       JOIN classes cl ON cl.id = a.class_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS cnt FROM class_students cs WHERE cs.class_id = a.class_id AND cs.status = 'Active'
       ) enrolled ON true
       ${where}`,
      params,
    );
    const totalExpected = Number(expectedRows[0]?.total_expected ?? 0);
    const missing = Math.max(totalExpected - submitted, 0);

    return {
      totalAssigned: assigned,
      totalSubmitted: submitted,
      totalGraded: graded,
      totalMissing: missing,
      averageScore: Number(Number(rows[0]?.avg_score ?? 0).toFixed(1)),
    };
  }

  async getAssignmentByClass(filters: ReportFilters): Promise<AssignmentByClassRow[]> {
    const { where, params } = this.assignmentWhereClause(filters);
    const rows = await this.ds.query(
      `SELECT
         cl.id AS "classId",
         cl.class_code AS "classCode",
         cl.class_name AS "className",
         COUNT(DISTINCT a.id)::int AS assigned,
         COUNT(sub.id)::int AS submitted,
         COUNT(sub.id) FILTER (WHERE sub.status = 'graded')::int AS graded,
         COALESCE(AVG(sub.score) FILTER (WHERE sub.status = 'graded'), 0)::numeric AS avg_score
       FROM assignments a
       JOIN classes cl ON cl.id = a.class_id
       LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id
       ${where}
       GROUP BY cl.id, cl.class_code, cl.class_name
       ORDER BY assigned DESC`,
      params,
    );

    return rows.map((r: any) => {
      const assigned = Number(r.assigned);
      const submitted = Number(r.submitted);
      return {
        classId: r.classId,
        classCode: r.classCode,
        className: r.className,
        assigned,
        submitted,
        graded: Number(r.graded),
        missing: Math.max(0, assigned - submitted),
        averageScore: Number(Number(r.avg_score).toFixed(1)),
      };
    });
  }

  // ── Students ───────────────────────────────────────

  async getStudentsSummary(filters: ReportFilters): Promise<StudentsSummary> {
    const { where, params } = this.studentWhereClause(filters);
    const rows = await this.ds.query(
      `SELECT
         COUNT(DISTINCT s.id)::int AS total,
         COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'Active')::int AS active
       FROM students s
       LEFT JOIN class_students cs ON cs.student_id = s.id
       LEFT JOIN classes cl ON cl.id = cs.class_id
       ${where}`,
      params,
    );

    const monthVal = filters.month || new Date().toISOString().slice(0, 7);
    const newStudentsRows = await this.ds.query(
      `SELECT COUNT(DISTINCT s.id)::int AS count
       FROM students s
       LEFT JOIN class_students cs ON cs.student_id = s.id
       LEFT JOIN classes cl ON cl.id = cs.class_id
       ${where} AND TO_CHAR(s.created_at, 'YYYY-MM') = $${params.length + 1}`,
      [...params, monthVal],
    );

    return {
      totalStudents: Number(rows[0]?.total ?? 0),
      activeStudents: Number(rows[0]?.active ?? 0),
      newStudentsThisMonth: Number(newStudentsRows[0]?.count ?? 0),
    };
  }

  async getNewStudentsByMonth(filters: ReportFilters): Promise<NewStudentsByMonthRow[]> {
    const { where, params } = this.studentWhereClause(filters, true);
    const rows = await this.ds.query(
      `SELECT
         TO_CHAR(s.created_at, 'YYYY-MM') AS month,
         COUNT(DISTINCT s.id)::int AS count
       FROM students s
       LEFT JOIN class_students cs ON cs.student_id = s.id
       LEFT JOIN classes cl ON cl.id = cs.class_id
       ${where}
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      params,
    );
    return rows.map((r: any) => ({
      month: r.month,
      count: Number(r.count),
    }));
  }

  async getNewStudentsList(filters: ReportFilters): Promise<NewStudentRow[]> {
    const { where, params } = this.studentWhereClause(filters);
    const rows = await this.ds.query(
      `SELECT
         s.id AS "studentId",
         s.student_id AS "studentCode",
         CONCAT(s.last_name, ' ', s.first_name) AS "studentName",
         s.mobile,
         s.status,
         s.created_at AS "createdAt"
       FROM students s
       LEFT JOIN class_students cs ON cs.student_id = s.id
       LEFT JOIN classes cl ON cl.id = cs.class_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT 50`,
      params,
    );
    return rows.map((r: any) => ({
      studentId: r.studentId,
      studentCode: r.studentCode,
      studentName: r.studentName,
      mobile: r.mobile,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  // ── Filter helpers ───────────────────────────────────

  private applyClassFilters(
    filters: ReportFilters,
    conditions: string[],
    params: any[],
    idx: { value: number },
    columnPrefix = 'cs.class_id'
  ) {
    if (filters.classIds && filters.classIds.length > 0) {
      const placeHolders = filters.classIds.map(() => `$${idx.value++}`).join(', ');
      conditions.push(`${columnPrefix} IN (${placeHolders})`);
      params.push(...filters.classIds);
    } else if (filters.classId) {
      conditions.push(`${columnPrefix} = $${idx.value++}`);
      params.push(filters.classId);
    }
    if (filters.classStatus) {
      conditions.push(`cl.status = $${idx.value++}`);
      params.push(filters.classStatus);
    }
  }

  private studentWhereClause(filters: ReportFilters, skipMonth = false) {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    const idx = { value: 1 };

    if (filters.startMonth) {
      conditions.push(`TO_CHAR(s.created_at, 'YYYY-MM') >= $${idx.value++}`);
      params.push(filters.startMonth);
    }
    if (filters.endMonth) {
      conditions.push(`TO_CHAR(s.created_at, 'YYYY-MM') <= $${idx.value++}`);
      params.push(filters.endMonth);
    }
    if (filters.month && !filters.startMonth && !filters.endMonth && !skipMonth) {
      conditions.push(`TO_CHAR(s.created_at, 'YYYY-MM') = $${idx.value++}`);
      params.push(filters.month);
    }

    if (filters.centerId) {
      conditions.push(`cl.center_id = $${idx.value++}`);
      params.push(filters.centerId);
    }
    this.applyClassFilters(filters, conditions, params, idx, 'cs.class_id');

    return { where: `WHERE ${conditions.join(' AND ')}`, params };
  }

  private billWhereClause(filters: ReportFilters, skipMonth = false) {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    const idx = { value: 1 };

    if (filters.startMonth) {
      conditions.push(`b.month >= $${idx.value++}`);
      params.push(filters.startMonth);
    }
    if (filters.endMonth) {
      conditions.push(`b.month <= $${idx.value++}`);
      params.push(filters.endMonth);
    }
    if (filters.month && !filters.startMonth && !filters.endMonth && !skipMonth) {
      conditions.push(`b.month = $${idx.value++}`);
      params.push(filters.month);
    }

    if (filters.centerId) {
      conditions.push(`cl.center_id = $${idx.value++}`);
      params.push(filters.centerId);
    }
    this.applyClassFilters(filters, conditions, params, idx, 'cs.class_id');

    return { where: `WHERE ${conditions.join(' AND ')}`, params };
  }

  private attendanceWhereClause(filters: ReportFilters, skipMonth = false) {
    const conditions: string[] = [`cs.status = '${SessionStatus.COMPLETED}'`];
    const params: any[] = [];
    const idx = { value: 1 };

    if (filters.startMonth) {
      conditions.push(`TO_CHAR(cs.date::date, 'YYYY-MM') >= $${idx.value++}`);
      params.push(filters.startMonth);
    }
    if (filters.endMonth) {
      conditions.push(`TO_CHAR(cs.date::date, 'YYYY-MM') <= $${idx.value++}`);
      params.push(filters.endMonth);
    }
    if (filters.month && !filters.startMonth && !filters.endMonth && !skipMonth) {
      conditions.push(`TO_CHAR(cs.date::date, 'YYYY-MM') = $${idx.value++}`);
      params.push(filters.month);
    }

    if (filters.centerId) {
      conditions.push(`cl.center_id = $${idx.value++}`);
      params.push(filters.centerId);
    }
    this.applyClassFilters(filters, conditions, params, idx, 'cl.id');

    return { where: `WHERE ${conditions.join(' AND ')}`, params };
  }

  private assignmentWhereClause(filters: ReportFilters) {
    const conditions: string[] = [`a.status = 'published'`];
    const params: any[] = [];
    const idx = { value: 1 };

    if (filters.startMonth) {
      conditions.push(`TO_CHAR(a.created_at, 'YYYY-MM') >= $${idx.value++}`);
      params.push(filters.startMonth);
    }
    if (filters.endMonth) {
      conditions.push(`TO_CHAR(a.created_at, 'YYYY-MM') <= $${idx.value++}`);
      params.push(filters.endMonth);
    }
    if (filters.month && !filters.startMonth && !filters.endMonth) {
      conditions.push(`TO_CHAR(a.created_at, 'YYYY-MM') = $${idx.value++}`);
      params.push(filters.month);
    }

    if (filters.centerId) {
      conditions.push(`cl.center_id = $${idx.value++}`);
      params.push(filters.centerId);
    }
    this.applyClassFilters(filters, conditions, params, idx, 'cl.id');

    return { where: `WHERE ${conditions.join(' AND ')}`, params };
  }

  private salaryWhereClause(filters: ReportFilters, skipMonth = false) {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    const idx = { value: 1 };

    if (filters.startMonth) {
      conditions.push(`w.month >= $${idx.value++}`);
      params.push(filters.startMonth);
    }
    if (filters.endMonth) {
      conditions.push(`w.month <= $${idx.value++}`);
      params.push(filters.endMonth);
    }
    if (filters.month && !filters.startMonth && !filters.endMonth && !skipMonth) {
      conditions.push(`w.month = $${idx.value++}`);
      params.push(filters.month);
    }

    if (filters.centerId) {
      conditions.push(`cl.center_id = $${idx.value++}`);
      params.push(filters.centerId);
    }
    this.applyClassFilters(filters, conditions, params, idx, 'cl.id');

    return { where: `WHERE ${conditions.join(' AND ')}`, params };
  }

  // Implementation of new reports
  async getClassStudentsStats(filters: ReportFilters): Promise<any[]> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    const idx = { value: 1 };

    if (filters.centerId) {
      conditions.push(`cl.center_id = $${idx.value++}`);
      params.push(filters.centerId);
    }
    this.applyClassFilters(filters, conditions, params, idx, 'cl.id');

    const where = `WHERE ${conditions.join(' AND ')}`;

    // Fetch classes
    const classes = await this.ds.query(
      `SELECT
         cl.id AS "classId",
         cl.class_code AS "classCode",
         cl.class_name AS "className",
         ct.name AS "centerName"
       FROM classes cl
       LEFT JOIN centers ct ON ct.id = cl.center_id
       ${where}
       ORDER BY cl.class_code ASC`,
      params,
    );

    // Fetch enrolled students based on month filter if present
    const studentConditions: string[] = ['1=1'];
    const studentParams: any[] = [];
    const sIdx = { value: 1 };

    if (filters.month) {
      const startOfMonth = `${filters.month}-01`;
      const parts = filters.month.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const lastDay = new Date(y, m, 0).getDate();
      const endOfMonth = `${filters.month}-${String(lastDay).padStart(2, '0')}`;

      studentConditions.push(`cs.joined_date <= $${sIdx.value++}::date`);
      studentParams.push(endOfMonth);

      studentConditions.push(`NOT (cs.status = 'Dropped' AND cs.updated_at::date < $${sIdx.value++}::date)`);
      studentParams.push(startOfMonth);
    }

    if (filters.centerId) {
      studentConditions.push(`cl.center_id = $${sIdx.value++}`);
      studentParams.push(filters.centerId);
    }
    this.applyClassFilters(filters, studentConditions, studentParams, sIdx, 'cl.id');

    const studentWhere = `WHERE ${studentConditions.join(' AND ')}`;
    const enrolledStudents = await this.ds.query(
      `SELECT
         cs.class_id AS "classId",
         s.id AS "studentId",
         s.student_id AS "studentCode",
         CONCAT(s.last_name, ' ', s.first_name) AS "studentName",
         s.mobile AS "mobile",
         s.birthdate AS "birthdate",
         cs.status AS "status",
         cs.joined_date AS "joinedDate",
         cs.updated_at AS "updatedAt"
       FROM class_students cs
       JOIN students s ON s.id = cs.student_id
       LEFT JOIN classes cl ON cl.id = cs.class_id
       ${studentWhere}
       ORDER BY cs.joined_date DESC, s.last_name ASC`,
      studentParams,
    );

    // Group students by class
    const studentsByClassMap = new Map<string, any[]>();
    for (const s of enrolledStudents) {
      if (!studentsByClassMap.has(s.classId)) {
        studentsByClassMap.set(s.classId, []);
      }
      
      // Determine status in selected month
      let statusInMonth = s.status;
      if (filters.month && s.status === 'Dropped') {
        const parts = filters.month.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const lastDay = new Date(y, m, 0).getDate();
        const endOfMonth = new Date(y, m - 1, lastDay, 23, 59, 59);
        const dropDate = new Date(s.updatedAt);
        if (dropDate > endOfMonth) {
          statusInMonth = 'Active';
        }
      }

      studentsByClassMap.get(s.classId)!.push({
        studentId: s.studentId,
        studentCode: s.studentCode,
        studentName: s.studentName,
        mobile: s.mobile,
        birthdate: s.birthdate,
        status: statusInMonth,
        joinedDate: s.joinedDate,
        updatedAt: s.updatedAt,
      });
    }

    // Map stats back to classes
    return classes.map((cl: any) => {
      const list = studentsByClassMap.get(cl.classId) || [];
      const activeCount = list.filter(s => s.status === 'Active').length;
      const droppedCount = list.filter(s => s.status === 'Dropped').length;
      return {
        ...cl,
        activeCount,
        droppedCount,
        totalCount: activeCount + droppedCount,
        students: list,
      };
    });
  }

  async getSaleOrdersReport(filters: ReportFilters): Promise<any[]> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    const idx = { value: 1 };

    if (filters.month) {
      conditions.push(`b.month = $${idx.value++}`);
      params.push(filters.month);
    }
    if (filters.centerId) {
      conditions.push(`cl.center_id = $${idx.value++}`);
      params.push(filters.centerId);
    }
    this.applyClassFilters(filters, conditions, params, idx, 'cs.class_id');

    const where = `WHERE ${conditions.join(' AND ')}`;
    return this.ds.query(
      `SELECT
         b.id AS "billId",
         b.month AS "month",
         b.receipt_code AS "receiptCode",
         s.student_id AS "studentCode",
         CONCAT(s.last_name, ' ', s.first_name) AS "studentName",
         cl.class_code AS "classCode",
         cl.class_name AS "className",
         b.total_amount AS "totalAmount",
         b.paid_amount AS "paidAmount",
         b.status AS "status",
         b.payment_method AS "paymentMethod",
         b.payment_date AS "paymentDate"
       FROM student_monthly_bills b
       JOIN students s ON s.id = b.student_id
       LEFT JOIN class_students cs ON cs.student_id = s.id AND cs.status = 'Active'
       LEFT JOIN classes cl ON cl.id = cs.class_id
       ${where}
       ORDER BY b.created_at DESC`,
      params,
    );
  }

  async getStudentAttendanceReport(filters: ReportFilters): Promise<any[]> {
    const conditions: string[] = [`cs.status = '${SessionStatus.COMPLETED}'`];
    const params: any[] = [];
    const idx = { value: 1 };

    if (filters.month) {
      conditions.push(`TO_CHAR(cs.date::date, 'YYYY-MM') = $${idx.value++}`);
      params.push(filters.month);
    }
    if (filters.centerId) {
      conditions.push(`cl.center_id = $${idx.value++}`);
      params.push(filters.centerId);
    }
    this.applyClassFilters(filters, conditions, params, idx, 'cl.id');

    const where = `WHERE ${conditions.join(' AND ')}`;
    return this.ds.query(
      `SELECT
         s.id AS "studentId",
         s.student_id AS "studentCode",
         CONCAT(s.last_name, ' ', s.first_name) AS "studentName",
         cl.class_code AS "classCode",
         cl.class_name AS "className",
         COUNT(sa.id)::int AS "totalSessions",
         COUNT(sa.id) FILTER (WHERE sa.is_present = true)::int AS "presentCount",
         COUNT(sa.id) FILTER (WHERE sa.is_present = false)::int AS "absentCount"
       FROM student_attendance sa
       JOIN class_sessions cs ON cs.id = sa.class_session_id
       JOIN classes cl ON cl.id = cs.class_id
       JOIN students s ON s.id = sa.student_id
       ${where}
       GROUP BY s.id, s.student_id, s.last_name, s.first_name, cl.id, cl.class_code, cl.class_name
       ORDER BY "absentCount" DESC, s.last_name ASC`,
      params,
    );
  }

  async getStudentDebtsReport(filters: ReportFilters): Promise<any[]> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    const idx = { value: 1 };

    if (filters.month) {
      conditions.push(`b.month = $${idx.value++}`);
      params.push(filters.month);
    }
    if (filters.centerId) {
      conditions.push(`cl.center_id = $${idx.value++}`);
      params.push(filters.centerId);
    }
    this.applyClassFilters(filters, conditions, params, idx, 'cs.class_id');

    const where = `WHERE ${conditions.join(' AND ')}`;
    return this.ds.query(
      `SELECT
         s.id AS "studentId",
         s.student_id AS "studentCode",
         CONCAT(s.last_name, ' ', s.first_name) AS "studentName",
         cl.class_code AS "classCode",
         cl.class_name AS "className",
         COALESCE(SUM(b.total_amount), 0)::numeric AS "totalExpected",
         COALESCE(SUM(b.paid_amount), 0)::numeric AS "totalPaid",
         COALESCE(SUM(b.total_amount - b.paid_amount), 0)::numeric AS "debtAmount"
       FROM students s
       JOIN student_monthly_bills b ON b.student_id = s.id
       LEFT JOIN class_students cs ON cs.student_id = s.id AND cs.status = 'Active'
       LEFT JOIN classes cl ON cl.id = cs.class_id
       ${where}
       GROUP BY s.id, s.student_id, s.last_name, s.first_name, cl.id, cl.class_code, cl.class_name
       ORDER BY "debtAmount" DESC`,
      params,
    );
  }
}
