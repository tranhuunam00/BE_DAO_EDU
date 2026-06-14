export interface ScheduleAllocation {
  id?: string;
  weekday?: string;
  date?: string;
  startDate?: string | null;
  finishDate?: string | null;
  startTime: string;
  endTime: string;
  roomId?: string | null;
  teacherId?: string | null;
}

export type ScheduleConflictResource = 'room' | 'teacher';

export interface ScheduleConflict {
  resource: ScheduleConflictResource;
  allocation: ScheduleAllocation;
}

export class ScheduleConflictPolicy {
  findConflict(
    requested: ScheduleAllocation,
    existing: ScheduleAllocation[],
  ): ScheduleConflict | null {
    for (const allocation of existing) {
      if (!this.isSameOccurrence(requested, allocation)) continue;
      if (!this.overlaps(requested, allocation)) continue;

      if (requested.roomId && requested.roomId === allocation.roomId) {
        return { resource: 'room', allocation };
      }
      if (
        requested.teacherId &&
        requested.teacherId === allocation.teacherId
      ) {
        return { resource: 'teacher', allocation };
      }
    }
    return null;
  }

  private isSameOccurrence(
    requested: ScheduleAllocation,
    existing: ScheduleAllocation,
  ): boolean {
    if (requested.date || existing.date) {
      return requested.date === existing.date;
    }
    return (
      requested.weekday === existing.weekday &&
      this.dateRangesOverlap(requested, existing)
    );
  }

  private dateRangesOverlap(
    requested: ScheduleAllocation,
    existing: ScheduleAllocation,
  ): boolean {
    const requestedStart = requested.startDate ?? '0001-01-01';
    const requestedFinish = requested.finishDate ?? '9999-12-31';
    const existingStart = existing.startDate ?? '0001-01-01';
    const existingFinish = existing.finishDate ?? '9999-12-31';
    return requestedStart <= existingFinish && existingStart <= requestedFinish;
  }

  private overlaps(
    requested: ScheduleAllocation,
    existing: ScheduleAllocation,
  ): boolean {
    return (
      requested.startTime < existing.endTime &&
      existing.startTime < requested.endTime
    );
  }
}
