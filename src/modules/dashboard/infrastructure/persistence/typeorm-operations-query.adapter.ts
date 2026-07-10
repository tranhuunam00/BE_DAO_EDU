import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SessionStatus } from '../../../../domain/value-objects/session-status.enum';
import {
  AnomaliesResult,
  CancelledReceipt,
  OperationsQueryPort,
  OperationsTasks,
  UnlockedSession,
  WaitingStudent,
} from '../../application/ports/operations-query.port';
import { CandidateClass } from '../../domain/services/class-recommendation.policy';
import { StudentRiskInput } from '../../domain/services/student-risk.policy';

@Injectable()
export class TypeOrmOperationsQueryAdapter implements OperationsQueryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getRiskInputs(): Promise<StudentRiskInput[]> {
    const [attendance, assignments] = await Promise.all([
      this.dataSource.query(`
        SELECT student.id, student.student_id AS "studentCode",
          student.first_name AS "firstName", student.last_name AS "lastName",
          student.mobile, attendance.is_present AS "isPresent"
        FROM students student
        JOIN class_students enrollment ON enrollment.student_id = student.id AND enrollment.status = 'Active'
        JOIN student_attendance attendance ON attendance.student_id = student.id
        JOIN class_sessions session ON session.id = attendance.class_session_id AND session.class_id = enrollment.class_id
        WHERE (session.date < CURRENT_DATE OR session.attendance_locked = true)
          AND session.date >= enrollment.joined_date
        ORDER BY student.id, session.date DESC, session.start_time DESC
      `),
      this.dataSource.query(`
        SELECT student.id, COUNT(DISTINCT assignment.id)::int AS "assignmentCount",
          COUNT(DISTINCT submission.assignment_id)::int AS "submittedCount"
        FROM students student
        JOIN class_students enrollment ON enrollment.student_id = student.id AND enrollment.status = 'Active'
        JOIN assignments assignment ON assignment.class_id = enrollment.class_id
          AND assignment.status IN ('published', 'closed') AND assignment.due_at < now()
        LEFT JOIN assignment_submissions submission ON submission.assignment_id = assignment.id
          AND submission.student_id = student.id
        GROUP BY student.id
      `),
    ]);
    const assignmentMap = new Map<string, any>(
      assignments.map((row: any) => [row.id, row]),
    );
    const students = new Map<string, StudentRiskInput>();
    attendance.forEach((row: any) => {
      const item: StudentRiskInput = students.get(row.id) || {
        studentId: row.id,
        studentCode: row.studentCode,
        studentName: `${row.lastName} ${row.firstName}`.trim(),
        mobile: row.mobile,
        attendance: [] as boolean[],
        assignmentCount: Number(assignmentMap.get(row.id)?.assignmentCount || 0),
        submittedCount: Number(assignmentMap.get(row.id)?.submittedCount || 0),
      };
      item.attendance.push(row.isPresent);
      students.set(row.id, item);
    });
    return Array.from(students.values());
  }

  async getWaitingStudents(): Promise<WaitingStudent[]> {
    const rows = await this.dataSource.query(`
      SELECT id, student_id AS "studentCode", first_name AS "firstName",
        last_name AS "lastName",
        EXTRACT(YEAR FROM age(CURRENT_DATE, birthdate::date))::int AS age
      FROM students WHERE status = 'Waiting for class'
      ORDER BY created_at ASC LIMIT 30
    `);
    return rows.map((row: any) => ({
      id: row.id,
      studentCode: row.studentCode,
      studentName: `${row.lastName} ${row.firstName}`.trim(),
      age: row.age === null ? null : Number(row.age),
    }));
  }

  async getCandidateClasses(): Promise<CandidateClass[]> {
    const rows = await this.dataSource.query(`
      SELECT class.id, class.class_code AS "classCode", class.class_name AS "className",
        class.status, class.max_size AS "maxSize", course.name AS "courseName",
        level.level_name AS "levelName", COUNT(DISTINCT enrollment.student_id)::int AS "studentCount",
        AVG(EXTRACT(YEAR FROM age(CURRENT_DATE, student.birthdate::date)))::numeric(5,1) AS "averageAge"
      FROM classes class
      JOIN courses course ON course.id = class.course_id
      JOIN course_levels level ON level.id = class.course_level_id
      LEFT JOIN class_students enrollment ON enrollment.class_id = class.id AND enrollment.status = 'Active'
      LEFT JOIN students student ON student.id = enrollment.student_id
      WHERE class.status IN ('Planning', 'Active')
      GROUP BY class.id, course.name, level.level_name
      HAVING class.max_size IS NULL OR COUNT(DISTINCT enrollment.student_id) < class.max_size
    `);
    return rows.map((row: any) => ({
      ...row,
      maxSize: row.maxSize === null ? null : Number(row.maxSize),
      studentCount: Number(row.studentCount),
      averageAge: row.averageAge === null ? null : Number(row.averageAge),
    }));
  }

  async getTasks(): Promise<OperationsTasks> {
    const [row] = await this.dataSource.query(`
      SELECT
        (SELECT COUNT(*)::int FROM students WHERE status = 'Waiting for class') AS "unassignedStudents",
        (SELECT COUNT(*)::int FROM class_sessions WHERE date < CURRENT_DATE AND attendance_locked = false
          AND status NOT IN ('${SessionStatus.CANCELLED}', 'Canceled')) AS \"unlockedPastSessions\",
        (SELECT COUNT(*)::int FROM payment_periods WHERE status = 'Active') AS "openPaymentPeriods",
        (SELECT COUNT(*)::int FROM billing_audit_logs WHERE event = 'PAYMENT_CANCELLED'
          AND created_at >= now() - interval '30 days') AS "cancelledReceipts"
    `);
    return {
      unassignedStudents: Number(row.unassignedStudents),
      unlockedPastSessions: Number(row.unlockedPastSessions),
      openPaymentPeriods: Number(row.openPaymentPeriods),
      cancelledReceipts: Number(row.cancelledReceipts),
    };
  }

  async getAnomalies(): Promise<AnomaliesResult> {
    const rawCancelled = await this.dataSource.query(`
      SELECT log.id,
             log.created_at              AS "createdAt",
             u.name                      AS "actorName",
             log.metadata->'after'->>'type'         AS "type",
             log.metadata->'after'->>'receiptCode'  AS "receiptCode",
             (log.metadata->'after'->>'totalAmount')::numeric AS "totalAmount",
             log.metadata->>'reason'     AS "reason"
      FROM billing_audit_logs log
      LEFT JOIN users u ON u.id = log.actor_id
      WHERE log.event = 'PAYMENT_CANCELLED'
        AND log.created_at >= now() - interval '30 days'
      ORDER BY log.created_at DESC
    `);

    const cancelledReceipts: CancelledReceipt[] = rawCancelled.map(
      (row: any) => ({
        id: row.id,
        createdAt: row.createdAt,
        actorName: row.actorName ?? null,
        type: row.type ?? '',
        receiptCode: row.receiptCode ?? null,
        totalAmount: Number(row.totalAmount ?? 0),
        reason: row.reason ?? null,
      }),
    );

    return { cancelledReceipts };
  }

  async getUnlockedSessions(): Promise<UnlockedSession[]> {
    const rows = await this.dataSource.query(`
      SELECT s.id,
             s.date,
             s.start_time AS "startTime",
             s.end_time AS "endTime",
             s.status,
             s.attendance_locked AS "attendanceLocked",
             c.id AS "classId",
             c.class_code AS "classCode",
             c.class_name AS "className",
             r.name AS "roomName",
             CONCAT(t.last_name, ' ', t.first_name) AS "teacherName"
      FROM class_sessions s
      JOIN classes c ON c.id = s.class_id
      LEFT JOIN rooms r ON r.id = s.room_id
      LEFT JOIN teachers t ON t.id = s.teacher_id
      WHERE s.date < CURRENT_DATE
        AND s.attendance_locked = false
        AND s.status NOT IN ('${SessionStatus.CANCELLED}', 'Canceled')
      ORDER BY s.date DESC, s.start_time DESC
    `);

    return rows.map((row: any) => ({
      id: row.id,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status,
      attendanceLocked: Boolean(row.attendanceLocked),
      classId: row.classId,
      classCode: row.classCode,
      className: row.className,
      roomName: row.roomName ?? null,
      teacherName: (row.teacherName && row.teacherName.trim()) ? row.teacherName.trim() : null,
    }));
  }
}
