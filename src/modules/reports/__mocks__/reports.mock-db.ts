/**
 * SHARED MOCK DB — reports module
 * ─────────────────────────────────────────────────────────────────────────────
 * File duy nhat chua toan bo fixture du lieu cho tat ca .spec.ts cua module
 * reports. KHONG dinh nghia input rieng trong tung file test.
 *
 * Schema phan anh cac bang thuc:
 *   students            (id, student_id, last_name, first_name, status)
 *   classes             (id, class_code, class_name, center_id, status)
 *   class_sessions      (id, class_id, date)
 *   student_attendance  (id, student_id, class_session_id, is_present)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Students ────────────────────────────────────────────────────────────────

export const MOCK_STUDENTS = [
  { id: 'stu-1', studentCode: 'HS001', lastName: 'Nguyen', firstName: 'Van A',  status: 'Active' },
  { id: 'stu-2', studentCode: 'HS002', lastName: 'Tran',   firstName: 'Thi B',  status: 'Active' },
  { id: 'stu-3', studentCode: 'HS003', lastName: 'Le',     firstName: 'Van C',  status: 'Active' },
  { id: 'stu-4', studentCode: 'HS004', lastName: 'Pham',   firstName: 'Thi D',  status: 'Active' },
  { id: 'stu-5', studentCode: 'HS005', lastName: 'Hoang',  firstName: 'Van E',  status: 'Active' },
  { id: 'stu-6', studentCode: 'HS006', lastName: 'Vu',     firstName: 'Thi F',  status: 'Active' },
  // Tie case: stu-7 va stu-8 cung ty le 100% — ca 2 phai xuat hien trong top present
  { id: 'stu-7', studentCode: 'HS007', lastName: 'Bui',    firstName: 'Van G',  status: 'Active' },
  { id: 'stu-8', studentCode: 'HS008', lastName: 'Dang',   firstName: 'Thi H',  status: 'Active' },
  // Inactive — khong duoc tinh vao top
  { id: 'stu-9', studentCode: 'HS009', lastName: 'Do',     firstName: 'Van I',  status: 'Inactive' },
] as const;

// ─── Centers & Classes ───────────────────────────────────────────────────────

export const MOCK_CENTERS = [
  { id: 'ctr-1', name: 'Co so 1' },
  { id: 'ctr-2', name: 'Co so 2' },
] as const;

export const MOCK_CLASSES = [
  { id: 'cls-1', classCode: 'TOAN-01', className: 'Toan 10A', centerId: 'ctr-1', status: 'Active' },
  { id: 'cls-2', classCode: 'VAN-01',  className: 'Van 10A',  centerId: 'ctr-2', status: 'Active' },
] as const;

// ─── Sessions (thang 2026-09) ─────────────────────────────────────────────────
// cls-1: 5 buoi; cls-2: 5 buoi

export const MOCK_SESSIONS = [
  { id: 'ses-1', classId: 'cls-1', date: '2026-09-01' },
  { id: 'ses-2', classId: 'cls-1', date: '2026-09-05' },
  { id: 'ses-3', classId: 'cls-1', date: '2026-09-10' },
  { id: 'ses-4', classId: 'cls-1', date: '2026-09-15' },
  { id: 'ses-5', classId: 'cls-1', date: '2026-09-20' },
  { id: 'ses-6', classId: 'cls-2', date: '2026-09-02' },
  { id: 'ses-7', classId: 'cls-2', date: '2026-09-06' },
  { id: 'ses-8', classId: 'cls-2', date: '2026-09-11' },
  { id: 'ses-9', classId: 'cls-2', date: '2026-09-16' },
  { id: 'ses-10', classId: 'cls-2', date: '2026-09-21' },
] as const;

// ─── Attendance ───────────────────────────────────────────────────────────────
//
// Ket qua mong doi (gop ca cls-1 + cls-2, tong 10 buoi moi HS):
//
//   stu-1 (HS001): 10/10 present -> 100%  ─┐ TOP PRESENT
//   stu-7 (HS007): 10/10 present -> 100%  ─┤ TIE: ca 2 phai co mat
//   stu-8 (HS008): 10/10 present -> 100%  ─┘
//   stu-2 (HS002):  9/10 present -> 90%
//   stu-3 (HS003):  8/10 present -> 80%
//   stu-4 (HS004):  5/10 present -> 50%
//   stu-5 (HS005):  3/10 present -> 30%   ─┐ TOP ABSENT
//   stu-6 (HS006):  1/10 present -> 10%   ─┘

export const MOCK_ATTENDANCE = [
  // stu-1: di du 10/10
  { id: 'att-1-1',  studentId: 'stu-1', sessionId: 'ses-1',  isPresent: true  },
  { id: 'att-1-2',  studentId: 'stu-1', sessionId: 'ses-2',  isPresent: true  },
  { id: 'att-1-3',  studentId: 'stu-1', sessionId: 'ses-3',  isPresent: true  },
  { id: 'att-1-4',  studentId: 'stu-1', sessionId: 'ses-4',  isPresent: true  },
  { id: 'att-1-5',  studentId: 'stu-1', sessionId: 'ses-5',  isPresent: true  },
  { id: 'att-1-6',  studentId: 'stu-1', sessionId: 'ses-6',  isPresent: true  },
  { id: 'att-1-7',  studentId: 'stu-1', sessionId: 'ses-7',  isPresent: true  },
  { id: 'att-1-8',  studentId: 'stu-1', sessionId: 'ses-8',  isPresent: true  },
  { id: 'att-1-9',  studentId: 'stu-1', sessionId: 'ses-9',  isPresent: true  },
  { id: 'att-1-10', studentId: 'stu-1', sessionId: 'ses-10', isPresent: true  },

  // stu-2: 9/10
  { id: 'att-2-1',  studentId: 'stu-2', sessionId: 'ses-1',  isPresent: true  },
  { id: 'att-2-2',  studentId: 'stu-2', sessionId: 'ses-2',  isPresent: true  },
  { id: 'att-2-3',  studentId: 'stu-2', sessionId: 'ses-3',  isPresent: true  },
  { id: 'att-2-4',  studentId: 'stu-2', sessionId: 'ses-4',  isPresent: true  },
  { id: 'att-2-5',  studentId: 'stu-2', sessionId: 'ses-5',  isPresent: true  },
  { id: 'att-2-6',  studentId: 'stu-2', sessionId: 'ses-6',  isPresent: true  },
  { id: 'att-2-7',  studentId: 'stu-2', sessionId: 'ses-7',  isPresent: true  },
  { id: 'att-2-8',  studentId: 'stu-2', sessionId: 'ses-8',  isPresent: true  },
  { id: 'att-2-9',  studentId: 'stu-2', sessionId: 'ses-9',  isPresent: true  },
  { id: 'att-2-10', studentId: 'stu-2', sessionId: 'ses-10', isPresent: false }, // 1 vang

  // stu-3: 8/10
  { id: 'att-3-1',  studentId: 'stu-3', sessionId: 'ses-1',  isPresent: true  },
  { id: 'att-3-2',  studentId: 'stu-3', sessionId: 'ses-2',  isPresent: true  },
  { id: 'att-3-3',  studentId: 'stu-3', sessionId: 'ses-3',  isPresent: true  },
  { id: 'att-3-4',  studentId: 'stu-3', sessionId: 'ses-4',  isPresent: true  },
  { id: 'att-3-5',  studentId: 'stu-3', sessionId: 'ses-5',  isPresent: true  },
  { id: 'att-3-6',  studentId: 'stu-3', sessionId: 'ses-6',  isPresent: true  },
  { id: 'att-3-7',  studentId: 'stu-3', sessionId: 'ses-7',  isPresent: true  },
  { id: 'att-3-8',  studentId: 'stu-3', sessionId: 'ses-8',  isPresent: true  },
  { id: 'att-3-9',  studentId: 'stu-3', sessionId: 'ses-9',  isPresent: false },
  { id: 'att-3-10', studentId: 'stu-3', sessionId: 'ses-10', isPresent: false },

  // stu-4: 5/10
  { id: 'att-4-1',  studentId: 'stu-4', sessionId: 'ses-1',  isPresent: true  },
  { id: 'att-4-2',  studentId: 'stu-4', sessionId: 'ses-2',  isPresent: true  },
  { id: 'att-4-3',  studentId: 'stu-4', sessionId: 'ses-3',  isPresent: true  },
  { id: 'att-4-4',  studentId: 'stu-4', sessionId: 'ses-4',  isPresent: true  },
  { id: 'att-4-5',  studentId: 'stu-4', sessionId: 'ses-5',  isPresent: true  },
  { id: 'att-4-6',  studentId: 'stu-4', sessionId: 'ses-6',  isPresent: false },
  { id: 'att-4-7',  studentId: 'stu-4', sessionId: 'ses-7',  isPresent: false },
  { id: 'att-4-8',  studentId: 'stu-4', sessionId: 'ses-8',  isPresent: false },
  { id: 'att-4-9',  studentId: 'stu-4', sessionId: 'ses-9',  isPresent: false },
  { id: 'att-4-10', studentId: 'stu-4', sessionId: 'ses-10', isPresent: false },

  // stu-5: 3/10
  { id: 'att-5-1',  studentId: 'stu-5', sessionId: 'ses-1',  isPresent: true  },
  { id: 'att-5-2',  studentId: 'stu-5', sessionId: 'ses-2',  isPresent: true  },
  { id: 'att-5-3',  studentId: 'stu-5', sessionId: 'ses-3',  isPresent: true  },
  { id: 'att-5-4',  studentId: 'stu-5', sessionId: 'ses-4',  isPresent: false },
  { id: 'att-5-5',  studentId: 'stu-5', sessionId: 'ses-5',  isPresent: false },
  { id: 'att-5-6',  studentId: 'stu-5', sessionId: 'ses-6',  isPresent: false },
  { id: 'att-5-7',  studentId: 'stu-5', sessionId: 'ses-7',  isPresent: false },
  { id: 'att-5-8',  studentId: 'stu-5', sessionId: 'ses-8',  isPresent: false },
  { id: 'att-5-9',  studentId: 'stu-5', sessionId: 'ses-9',  isPresent: false },
  { id: 'att-5-10', studentId: 'stu-5', sessionId: 'ses-10', isPresent: false },

  // stu-6: 1/10
  { id: 'att-6-1',  studentId: 'stu-6', sessionId: 'ses-1',  isPresent: true  },
  { id: 'att-6-2',  studentId: 'stu-6', sessionId: 'ses-2',  isPresent: false },
  { id: 'att-6-3',  studentId: 'stu-6', sessionId: 'ses-3',  isPresent: false },
  { id: 'att-6-4',  studentId: 'stu-6', sessionId: 'ses-4',  isPresent: false },
  { id: 'att-6-5',  studentId: 'stu-6', sessionId: 'ses-5',  isPresent: false },
  { id: 'att-6-6',  studentId: 'stu-6', sessionId: 'ses-6',  isPresent: false },
  { id: 'att-6-7',  studentId: 'stu-6', sessionId: 'ses-7',  isPresent: false },
  { id: 'att-6-8',  studentId: 'stu-6', sessionId: 'ses-8',  isPresent: false },
  { id: 'att-6-9',  studentId: 'stu-6', sessionId: 'ses-9',  isPresent: false },
  { id: 'att-6-10', studentId: 'stu-6', sessionId: 'ses-10', isPresent: false },

  // stu-7: 10/10 (TIE voi stu-1 va stu-8)
  { id: 'att-7-1',  studentId: 'stu-7', sessionId: 'ses-1',  isPresent: true  },
  { id: 'att-7-2',  studentId: 'stu-7', sessionId: 'ses-2',  isPresent: true  },
  { id: 'att-7-3',  studentId: 'stu-7', sessionId: 'ses-3',  isPresent: true  },
  { id: 'att-7-4',  studentId: 'stu-7', sessionId: 'ses-4',  isPresent: true  },
  { id: 'att-7-5',  studentId: 'stu-7', sessionId: 'ses-5',  isPresent: true  },
  { id: 'att-7-6',  studentId: 'stu-7', sessionId: 'ses-6',  isPresent: true  },
  { id: 'att-7-7',  studentId: 'stu-7', sessionId: 'ses-7',  isPresent: true  },
  { id: 'att-7-8',  studentId: 'stu-7', sessionId: 'ses-8',  isPresent: true  },
  { id: 'att-7-9',  studentId: 'stu-7', sessionId: 'ses-9',  isPresent: true  },
  { id: 'att-7-10', studentId: 'stu-7', sessionId: 'ses-10', isPresent: true  },

  // stu-8: 10/10 (TIE voi stu-1 va stu-7)
  { id: 'att-8-1',  studentId: 'stu-8', sessionId: 'ses-1',  isPresent: true  },
  { id: 'att-8-2',  studentId: 'stu-8', sessionId: 'ses-2',  isPresent: true  },
  { id: 'att-8-3',  studentId: 'stu-8', sessionId: 'ses-3',  isPresent: true  },
  { id: 'att-8-4',  studentId: 'stu-8', sessionId: 'ses-4',  isPresent: true  },
  { id: 'att-8-5',  studentId: 'stu-8', sessionId: 'ses-5',  isPresent: true  },
  { id: 'att-8-6',  studentId: 'stu-8', sessionId: 'ses-6',  isPresent: true  },
  { id: 'att-8-7',  studentId: 'stu-8', sessionId: 'ses-7',  isPresent: true  },
  { id: 'att-8-8',  studentId: 'stu-8', sessionId: 'ses-8',  isPresent: true  },
  { id: 'att-8-9',  studentId: 'stu-8', sessionId: 'ses-9',  isPresent: true  },
  { id: 'att-8-10', studentId: 'stu-8', sessionId: 'ses-10', isPresent: true  },

  // stu-9 (Inactive): co attendance nhung khong duoc tinh
  { id: 'att-9-1',  studentId: 'stu-9', sessionId: 'ses-1',  isPresent: false },
] as const;

// ─── Helper: tinh attendance tu mock data (pure function, khong can DB) ───────

export type MockAttendanceRow = (typeof MOCK_ATTENDANCE)[number];
export type MockSessionRow    = (typeof MOCK_SESSIONS)[number];

export interface StudentAttendanceStat {
  studentId: string;
  studentCode: string;
  fullName: string;
  presentCount: number;
  absentCount: number;
  totalSessions: number;
  attendanceRate: number;
  rank: number;
}

/** Simulate DENSE_RANK logic tren mock data (dung de assert trong spec) */
export function computeTopStudentsFromMock(
  attendance: readonly MockAttendanceRow[],
  sessions: readonly MockSessionRow[],
  students: typeof MOCK_STUDENTS,
  rankBy: 'present' | 'absent',
  filterClassId?: string,
): StudentAttendanceStat[] {
  const sessionIds = filterClassId
    ? sessions.filter((s) => s.classId === filterClassId).map((s) => s.id)
    : sessions.map((s) => s.id);

  const filtered = attendance.filter((a) => (sessionIds as string[]).includes(a.sessionId));

  const map = new Map<string, { present: number; absent: number }>();
  for (const a of filtered) {
    const cur = map.get(a.studentId) ?? { present: 0, absent: 0 };
    if (a.isPresent) cur.present++;
    else cur.absent++;
    map.set(a.studentId, cur);
  }

  const rows: StudentAttendanceStat[] = [];
  for (const [studentId, counts] of map.entries()) {
    const stu = students.find((s) => s.id === studentId);
    if (!stu || stu.status !== 'Active') continue;
    const total = counts.present + counts.absent;
    rows.push({
      studentId,
      studentCode: stu.studentCode,
      fullName: `${stu.lastName} ${stu.firstName}`,
      presentCount: counts.present,
      absentCount: counts.absent,
      totalSessions: total,
      attendanceRate: total > 0 ? Number(((counts.present / total) * 100).toFixed(1)) : 0,
      rank: 0,
    });
  }

  const sortKey = rankBy === 'present' ? 'presentCount' : 'absentCount';
  rows.sort((a, b) => b[sortKey] - a[sortKey]);

  // DENSE_RANK
  let rank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i][sortKey] !== rows[i - 1][sortKey]) {
      rank = i + 1;
    }
    rows[i].rank = rank;
  }

  return rows;
}

// ─── Performance Benchmark Dataset ───────────────────────────────────────────

/** Tao dataset lon de benchmark — 200 HS * 50 sessions = 10_000 attendance rows */
export function generateLargeMockAttendance(studentCount = 200, sessionsPerClass = 50) {
  const sessions = Array.from({ length: sessionsPerClass }, (_, i) => ({
    id: `perf-ses-${i}`,
    classId: 'perf-cls-1',
    date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
  }));

  const students = Array.from({ length: studentCount }, (_, i) => ({
    id: `perf-stu-${i}`,
    studentCode: `PERF${String(i).padStart(4, '0')}`,
    lastName: 'Perf',
    firstName: `Student ${i}`,
    status: 'Active' as const,
  }));

  const attendance = students.flatMap((stu, si) =>
    sessions.map((ses, sei) => ({
      id: `perf-att-${si}-${sei}`,
      studentId: stu.id,
      sessionId: ses.id,
      isPresent: (si + sei) % 3 !== 0, // mix present/absent
    })),
  );

  return { students, sessions, attendance };
}
