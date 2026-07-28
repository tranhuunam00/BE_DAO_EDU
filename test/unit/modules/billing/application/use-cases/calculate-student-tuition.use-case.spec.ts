import { CalculateStudentTuitionUseCase } from '../../../../../../src/modules/billing/application/use-cases/calculate-student-tuition.use-case';

describe('CalculateStudentTuitionUseCase', () => {
  it('should correctly calculate student tuition per class with dynamic rates and attendance rules', async () => {
    // 1. Mock Persistence Port
    const mockPersistence = {
      getTuitionCalculationData: jest.fn().mockResolvedValue({
        sessions: [
          {
            id: 'sess-june-present',
            date: '2026-06-10',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            isPresent: true,
            reason: null,
            isEnrolled: true,
          },
          {
            id: 'sess-june-absent-unauthorized',
            date: '2026-06-20',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            isPresent: false,
            reason: null, // Absent without leave -> Still billed
            isEnrolled: true,
          },
          {
            id: 'sess-june-absent-authorized',
            date: '2026-06-25',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            isPresent: false,
            reason: 'Sốt xuất huyết', // Absent with leave -> Free
            isEnrolled: true,
          },
          {
            id: 'sess-july-present',
            date: '2026-07-05',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            isPresent: true,
            reason: null,
            isEnrolled: true,
          },
          {
            id: 'sess-phys-present',
            date: '2026-07-08',
            classId: 'class-physics',
            classCode: 'PHYS6',
            className: 'Physics Class',
            courseLevelId: 'level-phys',
            isPresent: true,
            reason: null,
            isEnrolled: true,
          },
        ],
        pricingList: [
          {
            courseLevelId: 'level-6',
            pricePerSession: 150000,
            effectiveFrom: '2026-01-01',
            effectiveTo: '2026-06-30', // June and before price
          },
          {
            courseLevelId: 'level-6',
            pricePerSession: 180000,
            effectiveFrom: '2026-07-01',
            effectiveTo: null, // July and after price
          },
          {
            courseLevelId: 'level-phys',
            pricePerSession: 200000,
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
          },
        ],
        billingItems: [
          {
            classId: 'class-math',
            studentId: 'stud-1',
            month: '2026-06',
            rate: 140000, // Override rate on June bill
            paymentStatus: 'Paid',
          },
        ],
      }),
    };

    const useCase = new CalculateStudentTuitionUseCase(mockPersistence as any);

    // 2. Execute
    const { summaries: result } = await useCase.execute({
      studentId: 'stud-1',
    });

    // 3. Verify Calculations
    expect(result).toHaveLength(2);

    const mathSummary = result.find((r) => r.classId === 'class-math');
    const physSummary = result.find((r) => r.classId === 'class-physics');

    expect(mathSummary).toBeDefined();
    expect(physSummary).toBeDefined();

    // Verify Math Class details
    expect(mathSummary!.classCode).toBe('MATH6');
    expect(mathSummary!.totalSessions).toBe(4);
    expect(mathSummary!.presentSessionsCount).toBe(2);
    expect(mathSummary!.absentSessionsCount).toBe(2);

    // Total Math tuition = 140k (present) + 140k (absent unauthorized) + 0 (absent authorized) + 180k (july present) = 460k
    expect(mathSummary!.totalTuitionAmount).toBe(460000);

    const junePresentSess = mathSummary!.sessions.find((s) => s.sessionId === 'sess-june-present');
    expect(junePresentSess!.rate).toBe(140000);
    expect(junePresentSess!.isBilled).toBe(true);
    expect(junePresentSess!.amount).toBe(140000);

    const juneAbsentUnauth = mathSummary!.sessions.find((s) => s.sessionId === 'sess-june-absent-unauthorized');
    expect(juneAbsentUnauth!.isBilled).toBe(true);
    expect(juneAbsentUnauth!.amount).toBe(140000);

    const juneAbsentAuth = mathSummary!.sessions.find((s) => s.sessionId === 'sess-june-absent-authorized');
    expect(juneAbsentAuth!.isBilled).toBe(false);
    expect(juneAbsentAuth!.amount).toBe(0);

    const julyPresentSess = mathSummary!.sessions.find((s) => s.sessionId === 'sess-july-present');
    expect(julyPresentSess!.rate).toBe(180000);
    expect(julyPresentSess!.isBilled).toBe(true);
    expect(julyPresentSess!.amount).toBe(180000);
  });

  it('should return empty array when student has no sessions or enrollments', async () => {
    const mockPersistence = {
      getTuitionCalculationData: jest.fn().mockResolvedValue({
        sessions: [],
        pricingList: [],
        billingItems: [],
      }),
    };

    const useCase = new CalculateStudentTuitionUseCase(mockPersistence as any);
    const { summaries: result } = await useCase.execute({ studentId: 'stud-none' });
    expect(result).toHaveLength(0);
  });

  it('should handle student kicked out in the middle of a course (Dropped status)', async () => {
    const mockPersistence = {
      getTuitionCalculationData: jest.fn().mockResolvedValue({
        sessions: [
          {
            id: 'sess-1',
            date: '2026-06-01',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            isPresent: true,
            reason: null,
            isEnrolled: true, // Still active
          },
          {
            id: 'sess-2',
            date: '2026-06-05',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            isPresent: true,
            reason: null,
            isEnrolled: true, // Still active
          },
          {
            id: 'sess-3',
            date: '2026-06-10',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            isPresent: false,
            reason: null,
            isEnrolled: false, // Dropped (kicked out) -> Free
          },
          {
            id: 'sess-4',
            date: '2026-06-15',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            isPresent: false,
            reason: null,
            isEnrolled: false, // Dropped (kicked out) -> Free
          },
        ],
        pricingList: [
          {
            courseLevelId: 'level-6',
            pricePerSession: 150000,
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
          },
        ],
        billingItems: [],
      }),
    };

    const useCase = new CalculateStudentTuitionUseCase(mockPersistence as any);
    const { summaries: result } = await useCase.execute({ studentId: 'stud-dropped' });

    expect(result).toHaveLength(1);
    const summary = result[0];

    // Total tuition = 150k (sess-1) + 150k (sess-2) + 0 (sess-3) + 0 (sess-4) = 300k
    expect(summary.totalTuitionAmount).toBe(300000);

    const s1 = summary.sessions.find(s => s.sessionId === 'sess-1');
    const s2 = summary.sessions.find(s => s.sessionId === 'sess-2');
    const s3 = summary.sessions.find(s => s.sessionId === 'sess-3');
    const s4 = summary.sessions.find(s => s.sessionId === 'sess-4');

    expect(s1!.isBilled).toBe(true);
    expect(s1!.amount).toBe(150000);

    expect(s2!.isBilled).toBe(true);
    expect(s2!.amount).toBe(150000);

    expect(s3!.isBilled).toBe(false);
    expect(s3!.amount).toBe(0);

    expect(s4!.isBilled).toBe(false);
    expect(s4!.amount).toBe(0);
  });

  it('should handle student kicked out for several sessions and then added back', async () => {
    const mockPersistence = {
      getTuitionCalculationData: jest.fn().mockResolvedValue({
        sessions: [
          {
            id: 'sess-active-1',
            date: '2026-06-01',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            isPresent: true,
            reason: null,
            isEnrolled: true, // Initial period -> Billed
          },
          {
            id: 'sess-dropped-2',
            date: '2026-06-05',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            isPresent: false,
            reason: null,
            isEnrolled: false, // Kicked out period -> Free
          },
          {
            id: 'sess-dropped-3',
            date: '2026-06-10',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            isPresent: false,
            reason: null,
            isEnrolled: false, // Kicked out period -> Free
          },
          {
            id: 'sess-readded-4',
            date: '2026-06-15',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            isPresent: true,
            reason: null,
            isEnrolled: true, // Re-added period -> Billed
          },
        ],
        pricingList: [
          {
            courseLevelId: 'level-6',
            pricePerSession: 150000,
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
          },
        ],
        billingItems: [],
      }),
    };

    const useCase = new CalculateStudentTuitionUseCase(mockPersistence as any);
    const { summaries: result } = await useCase.execute({ studentId: 'stud-readded' });

    expect(result).toHaveLength(1);
    const summary = result[0];

    // Total tuition = 150k (sess-1) + 0 (sess-2) + 0 (sess-3) + 150k (sess-4) = 300k
    expect(summary.totalTuitionAmount).toBe(300000);

    const s1 = summary.sessions.find(s => s.sessionId === 'sess-active-1');
    const s2 = summary.sessions.find(s => s.sessionId === 'sess-dropped-2');
    const s3 = summary.sessions.find(s => s.sessionId === 'sess-dropped-3');
    const s4 = summary.sessions.find(s => s.sessionId === 'sess-readded-4');

    expect(s1!.isBilled).toBe(true);
    expect(s1!.amount).toBe(150000);

    expect(s2!.isBilled).toBe(false);
    expect(s2!.amount).toBe(0);

    expect(s3!.isBilled).toBe(false);
    expect(s3!.amount).toBe(0);

    expect(s4!.isBilled).toBe(true);
    expect(s4!.amount).toBe(150000);
  });

  it('should handle edge cases of missing or spaces-only reason for absences', async () => {
    const mockPersistence = {
      getTuitionCalculationData: jest.fn().mockResolvedValue({
        sessions: [
          {
            id: 'sess-empty-reason',
            date: '2026-06-01',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            isPresent: false,
            reason: '', // Empty reason string -> Absent without leave -> Billed
            isEnrolled: true,
          },
          {
            id: 'sess-spaces-reason',
            date: '2026-06-05',
            classId: 'class-math',
            classCode: 'MATH6',
            className: 'Math Class',
            courseLevelId: 'level-6',
            isPresent: false,
            reason: '   ', // Spaces only reason -> Absent without leave -> Billed
            isEnrolled: true,
          },
        ],
        pricingList: [
          {
            courseLevelId: 'level-6',
            pricePerSession: 150000,
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
          },
        ],
        billingItems: [],
      }),
    };

    const useCase = new CalculateStudentTuitionUseCase(mockPersistence as any);
    const { summaries: result } = await useCase.execute({ studentId: 'stud-edge' });

    expect(result).toHaveLength(1);
    const summary = result[0];
    expect(summary.totalTuitionAmount).toBe(300000); // 150k + 150k = 300k

    const emptyReasonSess = summary.sessions.find(s => s.sessionId === 'sess-empty-reason');
    const spacesReasonSess = summary.sessions.find(s => s.sessionId === 'sess-spaces-reason');

    expect(emptyReasonSess!.isBilled).toBe(true);
    expect(spacesReasonSess!.isBilled).toBe(true);
  });
});
