import { ScheduleConflictPolicy } from '../../../../../../src/modules/academics/domain/services/schedule-conflict.policy';

describe('ScheduleConflictPolicy', () => {
  const policy = new ScheduleConflictPolicy();

  it('detects a room overlap while allowing adjacent slots', () => {
    const existing = [
      {
        weekday: 'Mon',
        startTime: '09:00',
        endTime: '10:00',
        roomId: 'room-1',
      },
    ];

    expect(
      policy.findConflict(
        {
          weekday: 'Mon',
          startTime: '09:30',
          endTime: '10:30',
          roomId: 'room-1',
        },
        existing,
      )?.resource,
    ).toBe('room');
    expect(
      policy.findConflict(
        {
          weekday: 'Mon',
          startTime: '10:00',
          endTime: '11:00',
          roomId: 'room-1',
        },
        existing,
      ),
    ).toBeNull();
  });

  it('detects a teacher conflict across different rooms', () => {
    expect(
      policy.findConflict(
        {
          date: '2026-06-15',
          startTime: '08:00',
          endTime: '09:00',
          roomId: 'room-2',
          teacherId: 'teacher-1',
        },
        [
          {
            date: '2026-06-15',
            startTime: '08:30',
            endTime: '09:30',
            roomId: 'room-1',
            teacherId: 'teacher-1',
          },
        ],
      )?.resource,
    ).toBe('teacher');
  });

  it('allows the same recurring resource in non-overlapping date ranges', () => {
    expect(
      policy.findConflict(
        {
          weekday: 'Mon',
          startTime: '08:00',
          endTime: '09:00',
          roomId: 'room-1',
          startDate: '2026-07-01',
          finishDate: '2026-07-31',
        },
        [
          {
            weekday: 'Mon',
            startTime: '08:00',
            endTime: '09:00',
            roomId: 'room-1',
            startDate: '2026-06-01',
            finishDate: '2026-06-30',
          },
        ],
      ),
    ).toBeNull();
  });
});
