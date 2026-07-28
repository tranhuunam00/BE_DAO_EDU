import { CalculateTeacherWageUseCase } from '../../../../../../src/modules/billing/application/use-cases/calculate-teacher-wage.use-case';

describe('CalculateTeacherWageUseCase', () => {
  it('should calculate teacher wages correctly with main teacher role, assistant role, and overrides', async () => {
    const mockPersistence = {
      getTeacherWageCalculationData: jest.fn().mockResolvedValue({
        sessions: [
          {
            id: 'sess-1',
            date: '2026-06-01',
            startTime: '18:00',
            endTime: '19:30',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            courseName: 'Math',
            levelName: 'Grade 6',
            teacherId: 'teacher-1',
            assistantId: 'assistant-1',
          },
          {
            id: 'sess-2',
            date: '2026-06-03',
            startTime: '18:00',
            endTime: '19:30',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            courseName: 'Math',
            levelName: 'Grade 6',
            teacherId: 'teacher-2',
            assistantId: 'teacher-1', // Role = assistant here
          },
          {
            id: 'sess-3',
            date: '2026-06-05',
            startTime: '18:00',
            endTime: '19:30',
            classId: 'class-phys',
            classCode: 'PHYS7',
            className: 'Physics Class',
            courseLevelId: 'level-7',
            courseName: 'Physics',
            levelName: 'Grade 7',
            teacherId: 'teacher-1',
            assistantId: null,
          },
        ],
        pricingList: [
          {
            id: 'price-1',
            courseLevelId: 'level-6',
            levelName: 'Grade 6',
            pricePerSession: 150000,
            teacherWagePerSession: 100000,
            taWagePerSession: 50000,
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
          },
          {
            id: 'price-2',
            courseLevelId: 'level-7',
            levelName: 'Grade 7',
            pricePerSession: 200000,
            teacherWagePerSession: 120000,
            taWagePerSession: 60000,
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
          },
        ],
        wageItems: [
          {
            classId: 'class-phys',
            month: '2026-06',
            rate: 130000, // Override rate on June bill for Physics class
            paymentStatus: 'Paid',
          },
        ],
      }),
    };

    const useCase = new CalculateTeacherWageUseCase(mockPersistence as any);
    const { summaries, pricingHistory } = await useCase.execute({
      teacherId: 'teacher-1',
    });

    expect(mockPersistence.getTeacherWageCalculationData).toHaveBeenCalledWith(
      'teacher-1',
      undefined,
      undefined,
      undefined,
      undefined,
    );

    expect(summaries).toHaveLength(2);
    expect(pricingHistory).toHaveLength(2);

    const mathSummary = summaries.find((s) => s.classId === 'class-math');
    const physSummary = summaries.find((s) => s.classId === 'class-phys');

    expect(mathSummary).toBeDefined();
    expect(physSummary).toBeDefined();

    // Verify Math class (1 session main teacher = 100k, 1 session assistant = 50k)
    expect(mathSummary!.totalSessions).toBe(2);
    expect(mathSummary!.totalWageAmount).toBe(150000);
    
    const sess1 = mathSummary!.sessions.find((s) => s.sessionId === 'sess-1');
    const sess2 = mathSummary!.sessions.find((s) => s.sessionId === 'sess-2');
    
    expect(sess1!.role).toBe('teacher');
    expect(sess1!.rate).toBe(100000);
    expect(sess2!.role).toBe('assistant');
    expect(sess2!.rate).toBe(50000);

    // Verify Physics class (1 session main teacher = 130k override rate instead of 120k level rate)
    expect(physSummary!.totalSessions).toBe(1);
    expect(physSummary!.totalWageAmount).toBe(130000);

    const sess3 = physSummary!.sessions.find((s) => s.sessionId === 'sess-3');
    expect(sess3!.role).toBe('teacher');
    expect(sess3!.rate).toBe(130000);
  });

  it('should handle assistant added or kicked out in the middle of a course (Case 1 & 2)', async () => {
    // assistant-1 taught session 3 & 4 of math class (added in the middle)
    // assistant-1 taught session 5 & 6 of phys class (kicked out in the middle - session 7 & 8 have no assistant)
    const mockPersistence = {
      getTeacherWageCalculationData: jest.fn().mockResolvedValue({
        sessions: [
          { id: 'sess-3', date: '2026-06-05', classId: 'class-math', classCode: 'MATH6', className: 'Math Class', courseLevelId: 'level-6', teacherId: 'teacher-main', assistantId: 'assistant-1' },
          { id: 'sess-4', date: '2026-06-07', classId: 'class-math', classCode: 'MATH6', className: 'Math Class', courseLevelId: 'level-6', teacherId: 'teacher-main', assistantId: 'assistant-1' },
          { id: 'sess-5', date: '2026-06-10', classId: 'class-phys', classCode: 'PHYS7', className: 'Physics Class', courseLevelId: 'level-7', teacherId: 'teacher-main', assistantId: 'assistant-1' },
          { id: 'sess-6', date: '2026-06-12', classId: 'class-phys', classCode: 'PHYS7', className: 'Physics Class', courseLevelId: 'level-7', teacherId: 'teacher-main', assistantId: 'assistant-1' },
        ],
        pricingList: [
          { courseLevelId: 'level-6', teacherWagePerSession: 100000, taWagePerSession: 50000, effectiveFrom: '2026-01-01', effectiveTo: null },
          { courseLevelId: 'level-7', teacherWagePerSession: 120000, taWagePerSession: 60000, effectiveFrom: '2026-01-01', effectiveTo: null },
        ],
        wageItems: [],
      }),
    };

    const useCase = new CalculateTeacherWageUseCase(mockPersistence as any);
    const { summaries } = await useCase.execute({ teacherId: 'assistant-1' });

    expect(summaries).toHaveLength(2);
    const mathSummary = summaries.find((s) => s.classId === 'class-math');
    const physSummary = summaries.find((s) => s.classId === 'class-phys');

    // Math class: 2 sessions as assistant = 2 * 50k = 100k
    expect(mathSummary!.totalSessions).toBe(2);
    expect(mathSummary!.totalWageAmount).toBe(100000);
    expect(mathSummary!.sessions[0].role).toBe('assistant');
    expect(mathSummary!.sessions[0].rate).toBe(50000);

    // Physics class: 2 sessions as assistant = 2 * 60k = 120k
    expect(physSummary!.totalSessions).toBe(2);
    expect(physSummary!.totalWageAmount).toBe(120000);
    expect(physSummary!.sessions[0].role).toBe('assistant');
    expect(physSummary!.sessions[0].rate).toBe(60000);
  });

  it('should handle changing teachers (replaced, substituted) in the middle of a course (Case 3, 4 & 5)', async () => {
    // teacher-new replaces teacher-old in the middle of math class (Session 1 & 2: teacher-old, Session 3 & 4: teacher-new)
    // teacher-sub acts as a substitute teacher for only Session 5
    const mockPersistence = {
      getTeacherWageCalculationData: jest.fn().mockImplementation(async (teacherId) => {
        if (teacherId === 'teacher-old') {
          return {
            sessions: [
              { id: 'sess-1', date: '2026-06-01', classId: 'class-math', classCode: 'MATH6', className: 'Math Class', courseLevelId: 'level-6', teacherId: 'teacher-old', assistantId: null },
              { id: 'sess-2', date: '2026-06-03', classId: 'class-math', classCode: 'MATH6', className: 'Math Class', courseLevelId: 'level-6', teacherId: 'teacher-old', assistantId: null },
            ],
            pricingList: [{ courseLevelId: 'level-6', teacherWagePerSession: 100000, taWagePerSession: 50000, effectiveFrom: '2026-01-01', effectiveTo: null }],
            wageItems: [],
          };
        }
        if (teacherId === 'teacher-new') {
          return {
            sessions: [
              { id: 'sess-3', date: '2026-06-05', classId: 'class-math', classCode: 'MATH6', className: 'Math Class', courseLevelId: 'level-6', teacherId: 'teacher-new', assistantId: null },
              { id: 'sess-4', date: '2026-06-07', classId: 'class-math', classCode: 'MATH6', className: 'Math Class', courseLevelId: 'level-6', teacherId: 'teacher-new', assistantId: null },
              { id: 'sess-6', date: '2026-06-12', classId: 'class-math', classCode: 'MATH6', className: 'Math Class', courseLevelId: 'level-6', teacherId: 'teacher-new', assistantId: null },
            ],
            pricingList: [{ courseLevelId: 'level-6', teacherWagePerSession: 100000, taWagePerSession: 50000, effectiveFrom: '2026-01-01', effectiveTo: null }],
            wageItems: [],
          };
        }
        if (teacherId === 'teacher-sub') {
          return {
            sessions: [
              { id: 'sess-5', date: '2026-06-10', classId: 'class-math', classCode: 'MATH6', className: 'Math Class', courseLevelId: 'level-6', teacherId: 'teacher-sub', assistantId: null },
            ],
            pricingList: [{ courseLevelId: 'level-6', teacherWagePerSession: 100000, taWagePerSession: 50000, effectiveFrom: '2026-01-01', effectiveTo: null }],
            wageItems: [],
          };
        }
        return { sessions: [], pricingList: [], wageItems: [] };
      }),
    };

    const useCase = new CalculateTeacherWageUseCase(mockPersistence as any);

    // 1. Check teacher-old
    const resOld = await useCase.execute({ teacherId: 'teacher-old' });
    expect(resOld.summaries[0].totalSessions).toBe(2);
    expect(resOld.summaries[0].totalWageAmount).toBe(200000); // 2 * 100k

    // 2. Check teacher-new
    const resNew = await useCase.execute({ teacherId: 'teacher-new' });
    expect(resNew.summaries[0].totalSessions).toBe(3);
    expect(resNew.summaries[0].totalWageAmount).toBe(300000); // 3 * 100k

    // 3. Check teacher-sub (substitute)
    const resSub = await useCase.execute({ teacherId: 'teacher-sub' });
    expect(resSub.summaries[0].totalSessions).toBe(1);
    expect(resSub.summaries[0].totalWageAmount).toBe(100000); // 1 * 100k
  });

  it('should handle adding or removing assistants for only specific sessions (Case 6 & 7)', async () => {
    // assistant-1 is added for ONLY session 2
    // assistant-2 is hired for sessions 4, 5, 7 but REMOVED for session 6
    const mockPersistence = {
      getTeacherWageCalculationData: jest.fn().mockImplementation(async (teacherId) => {
        if (teacherId === 'assistant-1') {
          return {
            sessions: [
              { id: 'sess-2', date: '2026-06-03', classId: 'class-math', classCode: 'MATH6', className: 'Math Class', courseLevelId: 'level-6', teacherId: 'teacher-main', assistantId: 'assistant-1' },
            ],
            pricingList: [{ courseLevelId: 'level-6', teacherWagePerSession: 100000, taWagePerSession: 50000, effectiveFrom: '2026-01-01', effectiveTo: null }],
            wageItems: [],
          };
        }
        if (teacherId === 'assistant-2') {
          return {
            sessions: [
              { id: 'sess-4', date: '2026-06-07', classId: 'class-math', classCode: 'MATH6', className: 'Math Class', courseLevelId: 'level-6', teacherId: 'teacher-main', assistantId: 'assistant-2' },
              { id: 'sess-5', date: '2026-06-10', classId: 'class-math', classCode: 'MATH6', className: 'Math Class', courseLevelId: 'level-6', teacherId: 'teacher-main', assistantId: 'assistant-2' },
              { id: 'sess-7', date: '2026-06-15', classId: 'class-math', classCode: 'MATH6', className: 'Math Class', courseLevelId: 'level-6', teacherId: 'teacher-main', assistantId: 'assistant-2' },
            ],
            pricingList: [{ courseLevelId: 'level-6', teacherWagePerSession: 100000, taWagePerSession: 50000, effectiveFrom: '2026-01-01', effectiveTo: null }],
            wageItems: [],
          };
        }
        return { sessions: [], pricingList: [], wageItems: [] };
      }),
    };

    const useCase = new CalculateTeacherWageUseCase(mockPersistence as any);

    // assistant-1 (added for 1 session only)
    const resAs1 = await useCase.execute({ teacherId: 'assistant-1' });
    expect(resAs1.summaries[0].totalSessions).toBe(1);
    expect(resAs1.summaries[0].totalWageAmount).toBe(50000); // 1 * 50k

    // assistant-2 (assigned to 3 sessions, missed session 6)
    const resAs2 = await useCase.execute({ teacherId: 'assistant-2' });
    expect(resAs2.summaries[0].totalSessions).toBe(3);
    expect(resAs2.summaries[0].totalWageAmount).toBe(150000); // 3 * 50k
  });

  it('should handle teacher wage rate changes in the middle of a course based on pricing history date range (Rate change mid-course)', async () => {
    const mockPersistence = {
      getTeacherWageCalculationData: jest.fn().mockResolvedValue({
        sessions: [
          { id: 'sess-1', date: '2026-06-01', classId: 'class-math', classCode: 'MATH6', className: 'Math Class', courseLevelId: 'level-6', teacherId: 'teacher-1', assistantId: null },
          { id: 'sess-2', date: '2026-06-10', classId: 'class-math', classCode: 'MATH6', className: 'Math Class', courseLevelId: 'level-6', teacherId: 'teacher-1', assistantId: null },
        ],
        pricingList: [
          {
            courseLevelId: 'level-6',
            teacherWagePerSession: 100000,
            taWagePerSession: 50000,
            effectiveFrom: '2026-01-01',
            effectiveTo: '2026-06-05',
          },
          {
            courseLevelId: 'level-6',
            teacherWagePerSession: 120000,
            taWagePerSession: 60000,
            effectiveFrom: '2026-06-06',
            effectiveTo: null,
          },
        ],
        wageItems: [],
      }),
    };

    const useCase = new CalculateTeacherWageUseCase(mockPersistence as any);
    const { summaries } = await useCase.execute({ teacherId: 'teacher-1' });

    expect(summaries).toHaveLength(1);
    const summary = summaries[0];
    
    // Total wage = 100k (before June 5) + 120k (after June 6) = 220k
    expect(summary.totalWageAmount).toBe(220000);

    const s1 = summary.sessions.find(s => s.sessionId === 'sess-1');
    const s2 = summary.sessions.find(s => s.sessionId === 'sess-2');

    expect(s1!.rate).toBe(100000);
    expect(s2!.rate).toBe(120000);
  });
});
