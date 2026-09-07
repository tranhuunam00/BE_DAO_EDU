import {
  WeeklyStudentReportEntity,
  SqiLevel,
  TrendDirection,
} from '../../../../src/modules/student-evaluations/domain/entities/weekly-student-report.entity';

describe('WeeklyStudentReportEntity (Domain Invariants Spec)', () => {
  it('1. Khởi tạo thành công Báo cáo tuần với đầy đủ các thuộc tính và xếp hạng SQI', () => {
    const report = WeeklyStudentReportEntity.create({
      studentId: 'student-uuid-1',
      weekNumber: 35,
      year: 2026,
      startDate: '2026-08-24',
      endDate: '2026-08-30',
      sqiScore: 82,
      sqiDelta: 5,
      sqiBreakdown: {
        academic: 24.6,
        progress: 18,
        competency: 12.5,
        attendance: 9.5,
        homework: 9.0,
        attitude: 9.0,
        behavior: 5.0,
      },
      subjectPerformances: [
        { subjectName: 'Toán', score: 8.2, trend: TrendDirection.UP },
        { subjectName: 'Tiếng Anh', score: 8.5, trend: TrendDirection.UP },
        { subjectName: 'Văn', score: 7.1, trend: TrendDirection.STABLE },
      ],
      overview: 'Tuần này con có tiến bộ tốt, duy trì tinh thần học tập tích cực.',
      strengths: 'Con đang có khả năng tốt ở phần Đại số và từ vựng tiếng Anh.',
      improvements: 'Kỹ năng trình bày lời giải Toán còn thiếu bước.',
      recommendations: [
        'Mỗi ngày dành 20 phút luyện giải bài tập Toán.',
        'Tập trung vào dạng bài phương trình bậc nhất.',
        'Phụ huynh không cần học cùng con, chỉ cần nhắc nhở hoàn thành trước 21h.',
      ],
    });

    expect(report.id).toBeDefined();
    expect(report.studentId).toBe('student-uuid-1');
    expect(report.weekNumber).toBe(35);
    expect(report.year).toBe(2026);
    expect(report.sqiScore).toBe(82);
    expect(report.sqiDelta).toBe(5);
    expect(report.getLevel()).toBe(SqiLevel.LEVEL_4_GOOD);
    expect(report.isApproved).toBe(false);
    expect(report.approvedAt).toBeNull();
  });

  it('2. Xác định chính xác 5 cấp độ Level dựa trên điểm SQI', () => {
    const createWithScore = (score: number) =>
      WeeklyStudentReportEntity.create({
        studentId: 'student-1',
        weekNumber: 35,
        year: 2026,
        startDate: '2026-08-24',
        endDate: '2026-08-30',
        sqiScore: score,
        sqiDelta: 0,
        sqiBreakdown: {
          academic: 0,
          progress: 0,
          competency: 0,
          attendance: 0,
          homework: 0,
          attitude: 0,
          behavior: 0,
        },
        subjectPerformances: [],
        overview: 'Tổng quan',
        strengths: 'Điểm mạnh',
        improvements: 'Cần cải thiện',
        recommendations: [],
      });

    expect(createWithScore(95).getLevel()).toBe(SqiLevel.LEVEL_5_EXCELLENT);
    expect(createWithScore(80).getLevel()).toBe(SqiLevel.LEVEL_4_GOOD);
    expect(createWithScore(68).getLevel()).toBe(SqiLevel.LEVEL_3_FAIR);
    expect(createWithScore(52).getLevel()).toBe(SqiLevel.LEVEL_2_AVERAGE);
    expect(createWithScore(38).getLevel()).toBe(SqiLevel.LEVEL_1_WEAK);
  });

  it('3. Cho phép duyệt (approve) báo cáo tuần và lưu vết người duyệt, thời gian duyệt', () => {
    const report = WeeklyStudentReportEntity.create({
      studentId: 'student-1',
      weekNumber: 35,
      year: 2026,
      startDate: '2026-08-24',
      endDate: '2026-08-30',
      sqiScore: 80,
      sqiDelta: 2,
      sqiBreakdown: {
        academic: 24,
        progress: 16,
        competency: 12,
        attendance: 9,
        homework: 9,
        attitude: 8,
        behavior: 5,
      },
      subjectPerformances: [],
      overview: 'Con học tốt',
      strengths: 'Chăm chỉ',
      improvements: 'Cần cẩn thận hơn',
      recommendations: ['Luyện tập thêm'],
    });

    expect(report.isApproved).toBe(false);
    report.approve('teacher-uuid-1');

    expect(report.isApproved).toBe(true);
    expect(report.approvedBy).toBe('teacher-uuid-1');
    expect(report.approvedAt).toBeInstanceOf(Date);
  });

  it('4. Ném ra lỗi khi duyệt báo cáo nếu thiếu người duyệt hoặc thiếu nội dung cốt lõi', () => {
    const report = WeeklyStudentReportEntity.create({
      studentId: 'student-1',
      weekNumber: 35,
      year: 2026,
      startDate: '2026-08-24',
      endDate: '2026-08-30',
      sqiScore: 80,
      sqiDelta: 0,
      sqiBreakdown: {
        academic: 24,
        progress: 16,
        competency: 12,
        attendance: 9,
        homework: 9,
        attitude: 8,
        behavior: 5,
      },
      subjectPerformances: [],
      overview: '',
      strengths: '',
      improvements: '',
      recommendations: [],
    });

    expect(() => report.approve('')).toThrow('approvedBy không được để trống khi duyệt báo cáo');
  });

  it('5. Ném lỗi nếu điểm SQI nằm ngoài khoảng từ 0 đến 100', () => {
    expect(() =>
      WeeklyStudentReportEntity.create({
        studentId: 'student-1',
        weekNumber: 35,
        year: 2026,
        startDate: '2026-08-24',
        endDate: '2026-08-30',
        sqiScore: 105,
        sqiDelta: 0,
        sqiBreakdown: {
          academic: 0,
          progress: 0,
          competency: 0,
          attendance: 0,
          homework: 0,
          attitude: 0,
          behavior: 0,
        },
        subjectPerformances: [],
        overview: 'Test',
        strengths: 'Test',
        improvements: 'Test',
        recommendations: [],
      }),
    ).toThrow('Điểm SQI phải nằm trong khoảng từ 0 đến 100');
  });
});
