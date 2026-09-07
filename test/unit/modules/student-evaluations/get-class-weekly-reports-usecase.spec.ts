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
    mockPort.getWeeklySessions.mockImplementation(async (studentId: string) => {
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
    expect(result.students[0].sqiScore).toBe(0);
    expect(result.averageSqi).toBe(0);
  });
});
