import { AcademicError } from '../errors/academic.error';

export interface CoursePricingRecord {
  id?: string;
  courseId?: string;
  levelId?: string;
  effectiveFrom: string;
  effectiveTo: string;
  pricePerSession?: number | null;
  teacherWagePerSession?: number | null;
  assistantWagePerSession?: number | null;
}

export interface PricingGap {
  gapFrom: string;
  gapTo: string;
}

/**
 * CoursePricingTimelineGuard
 * Bộ quy tắc nghiệp vụ quản trị timeline Bảng giá và Snapshot Tài chính (Zero-dependency).
 */
export class CoursePricingTimelineGuard {
  static readonly DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

  /**
   * Chuẩn hóa và xác thực ngày bắt đầu, ngày kết thúc.
   * Triệt tiêu hoàn toàn lỗi lệch múi giờ bằng cách chuẩn hóa về chuỗi 10 ký tự YYYY-MM-DD.
   */
  static normalizeAndValidateDates(
    effectiveFrom: unknown,
    effectiveTo: unknown,
  ): { effectiveFrom: string; effectiveTo: string } {
    if (effectiveFrom === null || effectiveFrom === undefined) {
      throw new AcademicError('BAD_REQUEST', 'Ngày bắt đầu không được để trống');
    }
    if (effectiveTo === null || effectiveTo === undefined) {
      throw new AcademicError('BAD_REQUEST', 'Ngày kết thúc không được để trống');
    }

    let fromStr = String(effectiveFrom).trim();
    let toStr = String(effectiveTo).trim();

    if (fromStr.includes('T')) {
      fromStr = fromStr.slice(0, 10);
    }
    if (toStr.includes('T')) {
      toStr = toStr.slice(0, 10);
    }

    if (!this.DATE_REGEX.test(fromStr)) {
      throw new AcademicError('BAD_REQUEST', `Định dạng ngày bắt đầu không hợp lệ (yêu cầu YYYY-MM-DD): ${fromStr}`);
    }
    if (!this.DATE_REGEX.test(toStr)) {
      throw new AcademicError('BAD_REQUEST', `Định dạng ngày kết thúc không hợp lệ (yêu cầu YYYY-MM-DD): ${toStr}`);
    }

    this.validateCalendarDate(fromStr);
    this.validateCalendarDate(toStr);

    if (toStr < fromStr) {
      throw new AcademicError('BAD_REQUEST', 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu');
    }

    return { effectiveFrom: fromStr, effectiveTo: toStr };
  }

  /**
   * Kiểm tra tính hợp lệ của ngày dương lịch (ví dụ năm nhuận 29/02).
   */
  private static validateCalendarDate(dateStr: string): void {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    if (
      dateObj.getUTCFullYear() !== y ||
      dateObj.getUTCMonth() !== m - 1 ||
      dateObj.getUTCDate() !== d
    ) {
      throw new AcademicError('BAD_REQUEST', `Ngày ${dateStr} không tồn tại trên lịch dương`);
    }
  }

  /**
   * Xác thực số tiền học phí và thù lao giáo viên, trợ giảng.
   */
  static validateAmounts(
    pricePerSession?: unknown,
    teacherWagePerSession?: unknown,
    assistantWagePerSession?: unknown,
    isPartial = false,
  ): void {
    if (!isPartial && (pricePerSession === null || pricePerSession === undefined)) {
      throw new AcademicError('BAD_REQUEST', 'Học phí mỗi buổi không được để trống');
    }

    if (pricePerSession !== undefined && pricePerSession !== null) {
      const num = Number(pricePerSession);
      if (isNaN(num) || num < 0) {
        throw new AcademicError('BAD_REQUEST', 'Học phí mỗi buổi không được là số âm');
      }
    }

    if (teacherWagePerSession !== undefined && teacherWagePerSession !== null) {
      const num = Number(teacherWagePerSession);
      if (isNaN(num) || num < 0) {
        throw new AcademicError('BAD_REQUEST', 'Lương giáo viên mỗi buổi không được là số âm');
      }
    }

    if (assistantWagePerSession !== undefined && assistantWagePerSession !== null) {
      const num = Number(assistantWagePerSession);
      if (isNaN(num) || num < 0) {
        throw new AcademicError('BAD_REQUEST', 'Lương trợ giảng mỗi buổi không được là số âm');
      }
    }
  }

  /**
   * Nguyên tắc "Chạm là Chặn" - Strict No-Overlap Collision Detection.
   * Nếu có bất kỳ sự giao thoa hoặc chạm biên nào với bảng giá cũ -> Ném lỗi từ chối ngay lập tức.
   */
  static checkOverlap(target: CoursePricingRecord, existingList: CoursePricingRecord[]): void {
    const targetFrom = target.effectiveFrom;
    const targetTo = target.effectiveTo;

    for (const existing of existingList) {
      // Bỏ qua chính bản ghi đang cập nhật
      if (target.id && existing.id && target.id === existing.id) {
        continue;
      }

      const existingFrom = existing.effectiveFrom;
      const existingTo = existing.effectiveTo;

      // Hai khoảng [A, B] và [C, D] chạm nhau hoặc giao nhau khi: A <= D && B >= C
      if (targetFrom <= existingTo && targetTo >= existingFrom) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Khoảng thời gian [${targetFrom} -> ${targetTo}] bị trùng lặp hoặc chạm biên với bảng giá hiện có [${existingFrom} -> ${existingTo}]`,
        );
      }
    }
  }

  /**
   * Kiểm tra khóa an toàn đối với ngày đã tính tiền (maxBilledDate).
   */
  static checkLockAgainstBilledDate(
    target: CoursePricingRecord,
    maxBilledDate: string | null,
    action: 'create' | 'update' | 'delete',
    original?: CoursePricingRecord,
  ): void {
    if (!maxBilledDate) {
      return;
    }

    if (action === 'create') {
      if (target.effectiveTo <= maxBilledDate) {
        throw new AcademicError(
          'PRICING_LOCKED_BILLED',
          `Không thể tạo bảng giá hoàn toàn trong quá khứ đã chốt tiền (trước hoặc bằng ${maxBilledDate})`,
        );
      }
    }

    if (action === 'update') {
      if (target.effectiveFrom <= maxBilledDate) {
        throw new AcademicError(
          'PRICING_LOCKED_BILLED',
          `Không thể thay đổi ngày bắt đầu về trước hoặc bằng ngày tính tiền gần nhất (${maxBilledDate})`,
        );
      }
      if (target.effectiveTo <= maxBilledDate) {
        throw new AcademicError(
          'PRICING_LOCKED_BILLED',
          `Không thể thay đổi ngày kết thúc về trước hoặc bằng ngày tính tiền gần nhất (${maxBilledDate})`,
        );
      }
    }

    if (action === 'delete') {
      // Quy tắc 4: Chỉ cho xóa các giá có cả ngày bắt đầu và kết thúc > ngày tính tiền gần nhất
      if (target.effectiveFrom <= maxBilledDate || target.effectiveTo <= maxBilledDate) {
        throw new AcademicError(
          'PRICING_LOCKED_BILLED',
          `Không thể xóa bảng giá đã có buổi học tính tiền (${target.effectiveFrom} -> ${target.effectiveTo} <= ${maxBilledDate})`,
        );
      }
    }
  }

  /**
   * Phát hiện khoảng trống (Gap) giữa các dải giá kế tiếp.
   */
  static detectGaps(pricingList: CoursePricingRecord[]): PricingGap[] {
    if (!pricingList || pricingList.length <= 1) {
      return [];
    }

    const sorted = [...pricingList].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    const gaps: PricingGap[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // Ngày liền sau current.effectiveTo
      const currentEnd = new Date(current.effectiveTo);
      currentEnd.setDate(currentEnd.getDate() + 1);
      const nextContinuousDateStr = currentEnd.toISOString().slice(0, 10);

      if (next.effectiveFrom > nextContinuousDateStr) {
        const nextStartDate = new Date(next.effectiveFrom);
        nextStartDate.setDate(nextStartDate.getDate() - 1);
        const gapEndStr = nextStartDate.toISOString().slice(0, 10);

        gaps.push({
          gapFrom: nextContinuousDateStr,
          gapTo: gapEndStr,
        });
      }
    }

    return gaps;
  }

  /**
   * Tính mốc maxBilledDate lớn nhất giữa học sinh, giáo viên, và trợ giảng.
   */
  static computeMaxBilledDate(...dates: (string | null | undefined)[]): string | null {
    const validDates = dates.filter((d): d is string => typeof d === 'string' && this.DATE_REGEX.test(d.slice(0, 10)));
    if (validDates.length === 0) {
      return null;
    }
    return validDates.map((d) => d.slice(0, 10)).reduce((max, d) => (d > max ? d : max), validDates[0].slice(0, 10));
  }
}
