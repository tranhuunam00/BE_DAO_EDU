import { GetStudentTuitionReportUseCase } from '../../../../../../src/modules/billing/application/use-cases/get-student-tuition-report.use-case';

describe('GetStudentTuitionReportUseCase', () => {
  it('calculates the tuition report correctly separating excused/unexcused absences', async () => {
    const mockCalculator = {
      execute: jest.fn().mockResolvedValue({
        summaries: [
          {
            classId: 'class-1',
            classCode: 'ENG-A',
            className: 'English A',
            totalSessions: 3,
            presentSessionsCount: 1,
            absentSessionsCount: 2,
            totalTuitionAmount: 300000,
            sessions: [
              {
                sessionId: 'session-1',
                date: '2026-06-10',
                startTime: '18:00',
                endTime: '19:30',
                classId: 'class-1',
                className: 'English A',
                classCode: 'ENG-A',
                courseLevelId: 'level-1',
                courseName: 'English',
                levelName: 'A1',
                isPresent: true,
                reason: null,
                isBilled: true,
                rate: 150000,
                amount: 150000,
                pricingEffectiveFrom: '2026-01-01',
                pricingEffectiveTo: null,
              },
              {
                sessionId: 'session-2',
                date: '2026-06-12',
                startTime: '18:00',
                endTime: '19:30',
                classId: 'class-1',
                className: 'English A',
                classCode: 'ENG-A',
                courseLevelId: 'level-1',
                courseName: 'English',
                levelName: 'A1',
                isPresent: false,
                reason: 'Nghỉ có phép',
                isBilled: false,
                rate: 150000,
                amount: 0,
                pricingEffectiveFrom: '2026-01-01',
                pricingEffectiveTo: null,
              },
              {
                sessionId: 'session-3',
                date: '2026-06-14',
                startTime: '18:00',
                endTime: '19:30',
                classId: 'class-1',
                className: 'English A',
                classCode: 'ENG-A',
                courseLevelId: 'level-1',
                courseName: 'English',
                levelName: 'A1',
                isPresent: false,
                reason: '', // Nghỉ không phép
                isBilled: true,
                rate: 150000,
                amount: 150000,
                pricingEffectiveFrom: '2026-01-01',
                pricingEffectiveTo: null,
              },
            ],
          },
        ],
        pricingHistory: [
          {
            courseLevelId: 'level-1',
            pricePerSession: 150000,
            teacherWagePerSession: 80000,
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
            levelName: 'A1',
            id: 'pricing-1',
          },
        ],
      }),
    };

    const useCase = new GetStudentTuitionReportUseCase(mockCalculator as any);
    const result = await useCase.execute('student-1', '2026-06-01', '2026-06-30');

    expect(mockCalculator.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      onlyLockedSessions: true,
    });

    expect(result.sessions).toHaveLength(3);
    
    // Session 1: Present (billed)
    expect(result.sessions[0].amount).toBe(150000);
    
    // Session 2: Absent excused (not billed)
    expect(result.sessions[1].amount).toBe(0);
    
    // Session 3: Absent unexcused (billed)
    expect(result.sessions[2].amount).toBe(150000);

    expect(result.totalSessions).toBe(2);
    expect(result.totalAmount).toBe(300000);
    expect(result.pricingHistory).toHaveLength(1);
  });
});
