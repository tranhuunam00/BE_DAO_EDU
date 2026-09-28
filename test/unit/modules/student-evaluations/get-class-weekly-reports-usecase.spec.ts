import { GetClassWeeklyReportsUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/get-class-weekly-reports.use-case';
import { IStudentWeeklyDataQueryPort } from '../../../../src/modules/student-evaluations/application/ports/student-weekly-data-query.port';
import {
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../../../src/modules/student-evaluations/domain/entities/student-session-evaluation.entity';
import { SqiLevel, TrendDirection } from '../../../../src/modules/student-evaluations/domain/entities/weekly-student-report.entity';

describe('GetClassWeeklyReportsUseCase & Edge Cases Spec', () => {
  let useCase: GetClassWeeklyReportsUseCase;
  let mockPort: jest.Mocked<IStudentWeeklyDataQueryPort>;

  beforeEach(() => {
    mockPort = {
      getWeeklySessions: jest.fn(),
      getPreviousWeekSqi: jest.fn(),
      verifyStudentOwnership: jest.fn(),
      getStudentInfo: jest.fn(),
      getClassStudents: jest.fn(),
      getClassName: jest.fn().mockResolvedValue('Lớp Toán 10A1'),
    } as any;
    useCase = new GetClassWeeklyReportsUseCase(mockPort);
  });

  it('1. Trả về tổng quan rỗng an toàn khi lớp học không có học sinh nào (0 học sinh)', async () => {
    mockPort.getClassStudents.mockResolvedValue([]);

    const result = await useCase.execute({
      classId: 'class-empty',
      weekNumber: 35,
      year: 2026,
    });

    expect(result.totalStudents).toBe(0);
    expect(result.averageSqi).toBe(0);
    expect(result.levelDistribution.level5).toBe(0);
    expect(result.levelDistribution.level1).toBe(0);
    expect(result.students).toHaveLength(0);
  });

  it('2. Tính toán chính xác phân bổ Level và SQI trung bình khi lớp có nhiều học sinh với năng lực khác nhau', async () => {
    mockPort.getClassStudents.mockResolvedValue([
      { id: 's-1', name: 'Nguyễn Văn A', code: 'S001' },
      { id: 's-2', name: 'Trần Thị B', code: 'S002' },
      { id: 's-3', name: 'Lê Văn C', code: 'S003' },
    ]);

    // Học sinh 1: Xuất sắc
    mockPort.getWeeklySessions.mockImplementation(async (studentId: string, startDate?: string) => {
      if (startDate && startDate < '2026-08-20') {
        return [];
      }
      if (studentId === 's-1') {
        return [
          {
            classSessionId: 'sess-1',
            subjectName: 'Toán',
            isPresent: true,
            isLate: false,
            homeworkStatus: HomeworkStatus.COMPLETED,
            participation: ParticipationStatus.ACTIVE,
            understanding: UnderstandingStatus.UNDERSTOOD,
            behaviorTags: [BehaviorTag.ATTENTIVE],
            score: '9.5',
          },
        ];
      }
      if (studentId === 's-2') {
        return [
          {
            classSessionId: 'sess-1',
            subjectName: 'Toán',
            isPresent: true,
            isLate: false,
            homeworkStatus: HomeworkStatus.COMPLETED,
            participation: ParticipationStatus.ACTIVE,
            understanding: UnderstandingStatus.UNDERSTOOD,
            behaviorTags: [],
            score: '7.5',
          },
        ];
      }
      // Học sinh 3: Vắng học, không làm bài
      return [
        {
          classSessionId: 'sess-1',
          subjectName: 'Toán',
          isPresent: false,
          isLate: false,
          homeworkStatus: HomeworkStatus.NOT_DONE,
          participation: ParticipationStatus.PASSIVE,
          understanding: UnderstandingStatus.NOT_UNDERSTOOD,
          behaviorTags: [BehaviorTag.TALKATIVE],
          score: null,
        },
      ];
    });

    mockPort.getPreviousWeekSqi.mockImplementation(async (studentId: string) => {
      if (studentId === 's-1') return 85; // Cải thiện -> UP
      if (studentId === 's-2') return 75; // Ổn định -> STABLE
      return 60; // Giảm -> DOWN
    });

    const result = await useCase.execute({
      classId: 'class-1',
      weekNumber: 35,
      year: 2026,
    });

    expect(result.totalStudents).toBe(3);
    expect(result.averageSqi).toBeGreaterThan(0);
    expect(result.students).toHaveLength(3);

    // Kiểm tra học sinh 1 (s-1)
    const s1 = result.students.find((s) => s.studentId === 's-1');
    expect(s1).toBeDefined();
    expect(s1?.level).toBe(SqiLevel.LEVEL_5_EXCELLENT);
    expect(s1?.trend).toBe(TrendDirection.UP);

    // Kiểm tra học sinh 3 (s-3)
    const s3 = result.students.find((s) => s.studentId === 's-3');
    expect(s3).toBeDefined();
    expect(s3?.sqiScore).toBeLessThan(50);
    expect(s3?.trend).toBe(TrendDirection.DOWN);

    // Kiểm tra phân bổ level
    expect(result.levelDistribution.level5).toBe(2);
    expect(result.levelDistribution.level1).toBe(1);
  });

  it('3. Xử lý an toàn khi học sinh trong lớp hoàn toàn không có buổi học nào trong tuần', async () => {
    mockPort.getClassStudents.mockResolvedValue([
      { id: 's-holiday', name: 'Học sinh Nghỉ', code: 'S999' },
    ]);
    mockPort.getWeeklySessions.mockResolvedValue([]);
    mockPort.getPreviousWeekSqi.mockResolvedValue(80);

    const result = await useCase.execute({
      classId: 'class-holiday',
      weekNumber: 35,
      year: 2026,
    });

    expect(result.students[0].hasSessions).toBe(false);
    expect(result.students[0].sqiScore).toBeNull();
    expect(result.students[0].level).toBeNull();
    expect(result.students[0].attendanceRate).toBeNull();
    expect(result.students[0].homeworkRate).toBeNull();
    expect(result.averageSqi).toBe(0);
  });

  it('4. Tính toán tổng hợp báo cáo THEO THÁNG cho cả lớp học khi truyền month và year', async () => {
    mockPort.getClassStudents.mockResolvedValue([
      { id: 's-m1', name: 'Ngô Anh Vũ', code: 'S101' },
      { id: 's-m2', name: 'Đoàn Linh', code: 'S102' },
    ]);

    mockPort.getWeeklySessions.mockImplementation(async (studentId: string, startDate?: string) => {
      // startDate của tháng 9 là 2026-09-01
      if (startDate === '2026-09-01') {
        return [
          {
            classSessionId: 'sess-m-1',
            subjectName: 'Toán',
            isPresent: true,
            isLate: false,
            homeworkStatus: HomeworkStatus.COMPLETED,
            participation: ParticipationStatus.ACTIVE,
            understanding: UnderstandingStatus.UNDERSTOOD,
            behaviorTags: [BehaviorTag.ATTENTIVE],
            score: '9.0',
          },
        ];
      }
      return [];
    });

    const result = await useCase.execute({
      classId: 'class-month-1',
      month: 9,
      year: 2026,
    });

    expect(result.startDate).toBe('2026-09-01');
    expect(result.endDate).toBe('2026-09-30');
    expect(result.month).toBe(9);
    expect(result.totalStudents).toBe(2);
    expect(result.averageSqi).toBeGreaterThan(80);
    expect(result.students[0].hasSessions).toBe(true);
  });

  it('5. HOẠT ĐỘNG AN TOÀN 100% khi học sinh CHỈ CÓ THÔNG TIN ĐIỂM DANH (không có nhận xét, điểm số hay BTVN)', async () => {
    mockPort.getClassStudents.mockResolvedValue([
      { id: 's-att-only', name: 'Trần Văn Nam', code: 'S888' },
    ]);

    // Giả lập dữ liệu chỉ có từ bảng attendance, evaluation null/undefined
    mockPort.getWeeklySessions.mockResolvedValue([
      {
        classSessionId: 'sess-att-1',
        subjectName: 'Tiếng Anh',
        isPresent: true,
        isLate: false,
        homeworkStatus: undefined,
        participation: undefined,
        understanding: undefined,
        behaviorTags: [],
        score: null,
        teacherComment: null,
      } as any,
      {
        classSessionId: 'sess-att-2',
        subjectName: 'Tiếng Anh',
        isPresent: true,
        isLate: true, // Đi muộn
        homeworkStatus: undefined,
        participation: undefined,
        understanding: undefined,
        behaviorTags: [],
        score: null,
        teacherComment: null,
      } as any,
    ]);

    const result = await useCase.execute({
      classId: 'class-att-1',
      weekNumber: 38,
      year: 2026,
    });

    expect(result.students).toHaveLength(1);
    const st = result.students[0];
    expect(st.hasSessions).toBe(true);
    expect(st.attendanceRate).toBe(100);
    expect(st.homeworkRate).toBeNull(); // Không có BTVN thì null (hiển thị —), không tự ý mặc định 0%
    // SQI vẫn tính ra điểm hợp lệ chỉ dựa trên tiêu chí có mặt, không bị NaN hoặc null
    expect(st.sqiScore).toBe(100);
    expect(Number.isNaN(st.sqiScore)).toBe(false);
    expect(result.averageSqi).toBe(st.sqiScore);
  });

  it('6. PERFORMANCE BENCHMARK: Xử lý tổng hợp báo cáo cho 50 học sinh với 12 buổi học/tháng trong < 50ms', async () => {
    const studentList = Array.from({ length: 50 }, (_, i) => ({
      id: `student-perf-${i}`,
      name: `Học sinh Benchmark ${i}`,
      code: `S${1000 + i}`,
    }));
    mockPort.getClassStudents.mockResolvedValue(studentList);

    const mockSessions = Array.from({ length: 12 }, (_, j) => ({
      classSessionId: `sess-${j}`,
      subjectName: 'Toán',
      isPresent: j % 5 !== 0,
      isLate: j % 4 === 0,
      homeworkStatus: j % 2 === 0 ? HomeworkStatus.COMPLETED : HomeworkStatus.INCOMPLETE,
      participation: ParticipationStatus.ACTIVE,
      understanding: UnderstandingStatus.UNDERSTOOD,
      behaviorTags: [],
      score: '8.0',
    }));
    mockPort.getWeeklySessions.mockResolvedValue(mockSessions);

    const startTime = performance.now();
    const result = await useCase.execute({
      classId: 'class-perf-benchmark',
      month: 9,
      year: 2026,
    });
    const executionDuration = performance.now() - startTime;

    expect(result.totalStudents).toBe(50);
    expect(result.students).toHaveLength(50);
    expect(executionDuration).toBeLessThan(50); // SLA < 50ms
  });
});

