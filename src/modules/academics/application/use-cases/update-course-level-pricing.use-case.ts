import { CoursePricingPersistencePort, CoursePricingRecord } from '../ports/course-pricing-persistence.port';
import { UpdateCourseLevelPricingDto } from '../../../../application/dtos/course.dto';
import { AcademicError } from '../../domain/errors/academic.error';

export class UpdateCourseLevelPricingUseCase {
  constructor(
    private readonly persistence: CoursePricingPersistencePort,
    private readonly getToday: () => string = () =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()),
  ) {}

  async execute(id: string, dto: UpdateCourseLevelPricingDto): Promise<CoursePricingRecord> {
    const pricing = await this.persistence.findPricingById(id);
    if (!pricing) {
      throw new AcademicError('PRICING_NOT_FOUND', 'Không tìm thấy bảng giá lịch sử này.');
    }
    const levelId = pricing.courseLevelId;

    const isPriceChanged = dto.pricePerSession !== undefined && Number(dto.pricePerSession) !== Number(pricing.pricePerSession);
    const isTeacherWageChanged = dto.teacherWagePerSession !== undefined && Number(dto.teacherWagePerSession) !== Number(pricing.teacherWagePerSession);
    const isTaWageChanged = dto.taWagePerSession !== undefined && Number(dto.taWagePerSession) !== Number(pricing.taWagePerSession);
    
    if (dto.effectiveFrom !== undefined && !dto.effectiveFrom) {
      throw new AcademicError('BAD_REQUEST', 'Ngày bắt đầu không được để trống.');
    }
    if (dto.effectiveTo !== undefined && (!dto.effectiveTo || dto.effectiveTo === 'null')) {
      throw new AcademicError('BAD_REQUEST', 'Ngày kết thúc không được để trống.');
    }

    const newFrom = dto.effectiveFrom !== undefined ? dto.effectiveFrom : pricing.effectiveFrom;
    const newTo = dto.effectiveTo !== undefined ? dto.effectiveTo : pricing.effectiveTo;
    
    const isDateChanged = newFrom !== pricing.effectiveFrom || newTo !== pricing.effectiveTo;
    // 1. Guard price/wage value changes independently based on which field values are changing
    if (isPriceChanged) {
      const maxStudentBill = await this.persistence.getMaxStudentBillDate(levelId);
      if (maxStudentBill && pricing.effectiveFrom <= maxStudentBill) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Không thể thay đổi đơn giá học sinh vì bảng giá bắt đầu từ ${pricing.effectiveFrom} (trước hoặc trùng ngày chốt học phí học viên gần nhất là ${maxStudentBill}).`
        );
      }
    }

    if (isTeacherWageChanged) {
      const maxTeacherWage = await this.persistence.getMaxTeacherWageDate(levelId);
      if (maxTeacherWage && pricing.effectiveFrom <= maxTeacherWage) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Không thể thay đổi lương giáo viên vì bảng giá bắt đầu từ ${pricing.effectiveFrom} (trước hoặc trùng ngày chốt lương giáo viên gần nhất là ${maxTeacherWage}).`
        );
      }
    }

    if (isTaWageChanged) {
      const maxAssistantWage = await this.persistence.getMaxAssistantWageDate(levelId);
      if (maxAssistantWage && pricing.effectiveFrom <= maxAssistantWage) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Không thể thay đổi lương trợ giảng vì bảng giá bắt đầu từ ${pricing.effectiveFrom} (trước hoặc trùng ngày chốt lương trợ giảng gần nhất là ${maxAssistantWage}).`
        );
      }
    }

    const todayStr = this.getToday();

    // Helper function to check if a date violates a chốt sổ date boundary
    const checkLock = (dateVal: string | null, maxDate: string | null) => {
      if (!dateVal || !maxDate) return false;
      return dateVal <= maxDate;
    };

    const validateMaxLock = async (dateVal: string | null) => {
      if (!dateVal) return false;
      if (Number(pricing.pricePerSession) > 0) {
        const max = await this.persistence.getMaxStudentBillDate(levelId);
        if (checkLock(dateVal, max)) return true;
      }
      if (Number(pricing.teacherWagePerSession) > 0) {
        const max = await this.persistence.getMaxTeacherWageDate(levelId);
        if (checkLock(dateVal, max)) return true;
      }
      if (Number(pricing.taWagePerSession) > 0) {
        const max = await this.persistence.getMaxAssistantWageDate(levelId);
        if (checkLock(dateVal, max)) return true;
      }
      return false;
    };

    // 2. Guard effectiveFrom changes:
    // Phải cho sửa nếu ngày bắt đầu > ngày hôm nay. Nếu <= ngày hôm nay: KHÔNG cho sửa.
    if (dto.effectiveFrom !== undefined && dto.effectiveFrom !== pricing.effectiveFrom) {
      if (pricing.effectiveFrom <= todayStr) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Không thể thay đổi ngày bắt đầu vì bảng giá đã bắt đầu áp dụng (${pricing.effectiveFrom} <= ngày hôm nay ${todayStr}). Chỉ cho phép sửa nếu ngày bắt đầu lớn hơn ngày hôm nay.`
        );
      }
      if (dto.effectiveFrom <= todayStr) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Ngày bắt đầu mới (${dto.effectiveFrom}) phải lớn hơn ngày hôm nay (${todayStr}).`
        );
      }
      if (await validateMaxLock(dto.effectiveFrom)) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Không thể thay đổi ngày bắt đầu của bảng giá liên quan đến giai đoạn đã chốt sổ/lương.`
        );
      }
    }

    // 3. Guard effectiveTo changes:
    // Phải cho sửa nếu ngày kết thúc > ngày hôm nay hoặc chưa có ngày kết thúc (null).
    if (dto.effectiveTo !== undefined && dto.effectiveTo !== pricing.effectiveTo) {
      if (pricing.effectiveTo !== null && pricing.effectiveTo <= todayStr) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Không thể thay đổi ngày kết thúc vì bảng giá đã kết thúc trong quá khứ (${pricing.effectiveTo} <= ngày hôm nay ${todayStr}). Chỉ cho phép sửa nếu ngày kết thúc lớn hơn ngày hôm nay.`
        );
      }

      // Check range cho ngày kết thúc mới
      if (dto.effectiveTo !== null) {
        if (dto.effectiveTo < newFrom) {
          throw new AcademicError(
            'PRICING_CONFLICT',
            'Ngày bắt đầu áp dụng không được sau ngày kết thúc.'
          );
        }
        if (dto.effectiveTo < todayStr) {
          throw new AcademicError(
            'PRICING_CONFLICT',
            `Ngày kết thúc mới (${dto.effectiveTo}) không được ở trong quá khứ (trước ngày hôm nay ${todayStr}).`
          );
        }
        if (await validateMaxLock(dto.effectiveTo)) {
          throw new AcademicError(
            'PRICING_CONFLICT',
            `Không thể thay đổi ngày kết thúc của bảng giá liên quan đến giai đoạn đã chốt sổ/lương.`
          );
        }
      }
    }

    // 4. Validate overall range
    if (newTo && newFrom > newTo) {
      throw new AcademicError('PRICING_CONFLICT', 'Ngày bắt đầu áp dụng không được sau ngày kết thúc.');
    }

    const targetPrice = dto.pricePerSession !== undefined ? Number(dto.pricePerSession) : Number(pricing.pricePerSession);
    const targetTeacherWage = dto.teacherWagePerSession !== undefined ? Number(dto.teacherWagePerSession) : Number(pricing.teacherWagePerSession);
    const targetTaWage = dto.taWagePerSession !== undefined ? Number(dto.taWagePerSession) : Number(pricing.taWagePerSession);

    if (isDateChanged) {
      const allPricings = await this.persistence.findPricingByLevelId(levelId);
      const otherPricings = allPricings.filter((p) => p.id !== id);

      const checkFieldOverlap = (rateField: 'pricePerSession' | 'teacherWagePerSession' | 'taWagePerSession', label: string) => {
        const fieldPricings = otherPricings.filter((p) => Number((p as any)[rateField]) > 0);
        const hasOverlap = fieldPricings.some((p) => {
          const pFrom = p.effectiveFrom;
          const pTo = p.effectiveTo;
          if (newTo === null) {
            return pTo === null || pTo >= newFrom;
          }
          if (pTo === null) {
            return pFrom <= newTo;
          }
          return newFrom <= pTo && newTo >= pFrom;
        });

        if (hasOverlap) {
          throw new AcademicError(
            'PRICING_CONFLICT',
            `Khoảng thời gian áp dụng ${label} bị trùng lặp với một bản ghi ${label} khác.`,
          );
        }
      };

      if (targetPrice > 0) {
        checkFieldOverlap('pricePerSession', 'đơn giá học phí');
      }
      if (targetTeacherWage > 0) {
        checkFieldOverlap('teacherWagePerSession', 'lương giáo viên');
      }
      if (targetTaWage > 0) {
        checkFieldOverlap('taWagePerSession', 'lương trợ giảng');
      }
    }

    if (dto.pricePerSession !== undefined) pricing.pricePerSession = dto.pricePerSession;
    if (dto.teacherWagePerSession !== undefined) pricing.teacherWagePerSession = dto.teacherWagePerSession;
    if (dto.taWagePerSession !== undefined) pricing.taWagePerSession = dto.taWagePerSession;
    if (dto.effectiveFrom !== undefined) pricing.effectiveFrom = dto.effectiveFrom;
    if (dto.effectiveTo !== undefined) pricing.effectiveTo = dto.effectiveTo || null;

    return this.persistence.savePricing(pricing);
  }
}
