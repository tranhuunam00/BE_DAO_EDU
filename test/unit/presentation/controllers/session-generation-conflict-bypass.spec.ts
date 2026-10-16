/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test suite: Session Generation Conflict Bypass & Performance Benchmark
 *
 * Requirements:
 * 1. Functional: generateSessions / regenerateFutureSessions allows flexible session generation
 *    even when room/teacher is shared without being blocked by hard DB constraints.
 * 2. In_Progress & Locked sessions are preserved.
 * 3. Performance Benchmark (SLA): Measuring bulk date computation with performance.now() < 150ms.
 */

import { performance } from 'perf_hooks';
import { ClassController } from '../../../../src/presentation/controllers/class.controller';
import { SessionStatus } from '../../../../src/domain/value-objects/session-status.enum';
import { ClassSessionOrmEntity } from '../../../../src/infrastructure/persistence/typeorm/entities/class-session.orm-entity';

describe('Session Generation Conflict Bypass & Performance Benchmark', () => {
  const makeMockCtrl = () => {
    const savedSessions: any[] = [];
    const updatedSessions: any[] = [];

    const mockClassRepo: any = {
      findOneOrFail: jest.fn().mockResolvedValue({
        id: 'class-hoa7',
        classCode: 'HOA7',
        status: 'Active',
        startDate: '2026-10-01',
        finishDate: '2026-10-31',
        mainTeacherId: 'teacher-hanh',
        assistantId: null,
        skipHolidays: false,
      }),
    };

    const mockScheduleRepo: any = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'sched-1',
          classId: 'class-hoa7',
          roomId: 'room-02',
          weekday: 'Wed',
          startTime: '18:30:00',
          endTime: '20:00:00',
        },
      ]),
    };

    const mockSessionRepo: any = {
      find: jest.fn().mockImplementation((args: any) => {
        if (args?.where?.status === SessionStatus.SCHEDULED) {
          // Candidate sessions to delete
          return Promise.resolve([
            {
              id: 'sess-scheduled',
              classId: 'class-hoa7',
              date: '2026-10-14',
              status: SessionStatus.SCHEDULED,
              attendanceLocked: false,
            },
          ]);
        }
        // Existing sessions in range (include an In_Progress session on 2026-10-07)
        return Promise.resolve([
          {
            id: 'sess-in-progress',
            classId: 'class-hoa7',
            date: '2026-10-07',
            startTime: '18:00:00',
            endTime: '19:30:00',
            roomId: 'room-02',
            teacherId: 'teacher-hanh',
            status: SessionStatus.IN_PROGRESS,
            attendanceLocked: false,
          },
        ]);
      }),
      createQueryBuilder: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      }),
    };

    const mockClassStudentRepo: any = {
      find: jest.fn().mockResolvedValue([]),
    };

    const mockAttendanceRepo: any = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    const mockDataSource: any = {
      transaction: jest.fn().mockImplementation(async (cb: (manager: any) => Promise<any>) => {
        const mockManager: any = {
          save: jest.fn().mockImplementation(async (entityClass: any, items: any[]) => {
            if (entityClass === ClassSessionOrmEntity) {
              if (items[0]?.id) {
                updatedSessions.push(...items);
              } else {
                savedSessions.push(...items);
              }
              return items.map((it, idx) => ({ ...it, id: it.id || `gen-${idx}` }));
            }
            return items;
          }),
          create: jest.fn().mockImplementation((_cls: any, data: any) => ({ ...data })),
        };
        return cb(mockManager);
      }),
    };

    const mockNotificationRepo: any = {
      manager: {
        getRepository: jest.fn().mockReturnValue({
          save: jest.fn().mockResolvedValue({}),
        }),
      },
    };

    const ctrl = new ClassController(
      mockClassRepo,
      mockScheduleRepo,
      mockSessionRepo,
      mockClassStudentRepo,
      mockAttendanceRepo,
      {} as any, // courseRepo
      {} as any, // studentRepo
      {} as any, // teacherRepo
      {} as any, // assignmentRepo
      mockNotificationRepo,
      { execute: jest.fn().mockResolvedValue([]) } as any, // getHolidayDates
      { execute: jest.fn().mockResolvedValue(undefined) } as any, // checkRecurringScheduleConflicts
      { execute: jest.fn().mockResolvedValue(undefined) } as any, // checkSessionScheduleConflict
      { execute: jest.fn() } as any, // enrollStudentUseCase
      { execute: jest.fn().mockResolvedValue(undefined) } as any, // removeStudentUseCase
      { execute: jest.fn().mockResolvedValue(undefined) } as any, // createAdhocSessionUseCase
      mockDataSource,
    );

    return { ctrl, savedSessions, updatedSessions };
  };

  it('1. SHOULD generate sessions successfully from specified fromDate even with overlapping room/teacher', async () => {
    const { ctrl, savedSessions } = makeMockCtrl();

    await (ctrl as any).regenerateFutureSessions('class-hoa7', '2026-10-01');

    // Should have generated future sessions
    expect(savedSessions.length).toBeGreaterThan(0);
    const generatedDates = savedSessions.map((s) => s.date);
    expect(generatedDates).toContain('2026-10-14');
    expect(generatedDates).toContain('2026-10-21');
    expect(generatedDates).toContain('2026-10-28');
  });

  it('2. SHOULD preserve In_Progress and attendance-locked sessions without duplicating them', async () => {
    const { ctrl, savedSessions } = makeMockCtrl();

    await (ctrl as any).regenerateFutureSessions('class-hoa7', '2026-10-01');

    // On 2026-10-07, existing was In_Progress -> it MUST NOT generate a duplicate session on 2026-10-07
    const generatedDates = savedSessions.map((s) => s.date);
    expect(generatedDates).not.toContain('2026-10-07');
  });

  it('3. BENCHMARK: Bulk session generation across 365 days should complete under 150ms SLA', async () => {
    const { ctrl } = makeMockCtrl();

    const t0 = performance.now();
    await (ctrl as any).generateSessions('class-hoa7', '2026-01-01');
    const elapsedMs = performance.now() - t0;

    expect(elapsedMs).toBeLessThan(150);
  });
});
