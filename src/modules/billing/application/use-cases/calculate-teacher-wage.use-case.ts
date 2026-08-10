import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { BillingPersistencePort } from '../ports/billing-persistence.port';
import { BillingCalculator } from '../../domain/services/billing-calculator';

export interface CalculateTeacherWageInput {
  teacherId: string;
  classIds?: string[];
  startDate?: string;
  endDate?: string;
  onlyLockedSessions?: boolean;
}

export interface TeacherSessionDetail {
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  classId: string;
  className: string;
  classCode: string;
  courseLevelId: string;
  courseName: string;
  levelName: string;
  role: 'teacher' | 'assistant';
  rate: number;
  amount: number;
  pricingEffectiveFrom: string | null;
  pricingEffectiveTo: string | null;
}

export interface ClassWageSummary {
  classId: string;
  classCode: string;
  className: string;
  totalSessions: number;
  totalWageAmount: number;
  sessions: TeacherSessionDetail[];
}

@Injectable()
export class CalculateTeacherWageUseCase {
  constructor(private readonly persistence: BillingPersistencePort) {}

  // =========================================================================
  // NGUYÊN TẮC AN TOÀN TÀI CHÍNH & TÍNH LƯƠNG GIÁO VIÊN/TRỢ GIẢNG (WAGE SAFETY RULE):
  // 1. Chỉ tính lương đối với các ca học mà Giáo viên đã bấm CHỐT (trạng thái 'Completed'
  //    hoặc khóa điểm danh 'attendance_locked = true').
  // 2. Kết hợp bắt buộc phải tồn tại dữ liệu điểm danh trong bảng 'student_attendance'
  //    (tức là phải có ít nhất 1 học sinh được tích điểm danh, bất kể là tự động qua máy
  //    hay giáo viên tích thủ công).
  // 3. Nếu buổi học chưa bắt đầu (Scheduled) hoặc không có dữ liệu điểm danh nào trong DB,
  //    hệ thống sẽ BỎ QUA HOÀN TOÀN, không tính lương ca này cho giáo viên và trợ giảng.
  // =========================================================================
  async execute(input: CalculateTeacherWageInput): Promise<{
    summaries: ClassWageSummary[];
    pricingHistory: any[];
  }> {
    const { sessions, pricingList, wageItems } =
      await this.persistence.getTeacherWageCalculationData(
        input.teacherId,
        input.classIds,
        input.startDate,
        input.endDate,
        input.onlyLockedSessions,
      );

    // Sort pricingList newest first to prioritize the latest configured rules when ranges overlap
    const sortedPricings = BillingCalculator.sortPricings(pricingList);

    // Map wage items rate: key = `${classId}_${month}` -> rate
    const wageMap = new Map<string, number>();
    for (const item of wageItems) {
      if (item.classId) {
        const key = `${item.classId}_${item.month}`;
        wageMap.set(key, item.rate);
      }
    }

    // Group sessions by class
    const classGroups = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const group = classGroups.get(s.classId) ?? [];
      group.push(s);
      classGroups.set(s.classId, group);
    }

    const summaries: ClassWageSummary[] = [];

    for (const [classId, classSessions] of classGroups.entries()) {
      const firstSession = classSessions[0];
      const classCode = firstSession.classCode;
      const className = firstSession.className;

      const mappedSessions: TeacherSessionDetail[] = classSessions.map((session) => {
        const dateStr = session.date;
        const month = dateStr.substring(0, 7); // YYYY-MM
        const levelId = session.courseLevelId;
        const role = session.teacherId === input.teacherId ? 'teacher' : 'assistant';

        // 1. Get rate
        const wageKey = `${classId}_${month}`;
        const overriddenRate = wageMap.get(wageKey);

        const rateField = role === 'teacher' ? 'teacherWagePerSession' : 'taWagePerSession';

        const pricing = BillingCalculator.getActivePricing(
          pricingList,
          dateStr,
          rateField,
          levelId,
        );

        let rate = 0;
        if (overriddenRate !== undefined) {
          rate = overriddenRate;
        } else {
          rate = pricing ? Number(pricing[rateField]) : 0;
        }

        const amount = rate;

        return {
          sessionId: session.id,
          date: dateStr,
          startTime: session.startTime,
          endTime: session.endTime,
          classId: session.classId,
          className: session.className,
          classCode: session.classCode,
          courseLevelId: session.courseLevelId,
          courseName: session.courseName,
          levelName: session.levelName,
          role,
          rate,
          amount,
          pricingEffectiveFrom: pricing ? pricing.effectiveFrom : null,
          pricingEffectiveTo: pricing ? pricing.effectiveTo : null,
        };
      });

      const totalSessions = mappedSessions.length;
      const totalWageAmount = mappedSessions.reduce((sum, s) => sum + s.amount, 0);

      summaries.push({
        classId,
        classCode,
        className,
        totalSessions,
        totalWageAmount,
        sessions: mappedSessions,
      });
    }

    return {
      summaries,
      pricingHistory: pricingList,
    };
  }
}
