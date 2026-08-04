import { CoursePricingPersistencePort, CoursePricingRecord } from '../ports/course-pricing-persistence.port';
import { UpdateCourseLevelPricingDto } from '../../../../application/dtos/course.dto';
import { AcademicError } from '../../domain/errors/academic.error';

export class UpdateCourseLevelPricingUseCase {
  constructor(private readonly persistence: CoursePricingPersistencePort) {}

  async execute(id: string, dto: UpdateCourseLevelPricingDto): Promise<CoursePricingRecord> {
    const pricing = await this.persistence.findPricingById(id);
    if (!pricing) {
      throw new AcademicError('PRICING_NOT_FOUND', 'Không tìm thấy bảng giá lịch sử này.');
    }
    const levelId = pricing.courseLevelId;

    const isPriceChanged = dto.pricePerSession !== undefined && Number(dto.pricePerSession) !== Number(pricing.pricePerSession);
    const isTeacherWageChanged = dto.teacherWagePerSession !== undefined && Number(dto.teacherWagePerSession) !== Number(pricing.teacherWagePerSession);
    const isTaWageChanged = dto.taWagePerSession !== undefined && Number(dto.taWagePerSession) !== Number(pricing.taWagePerSession);
    
    const newFrom = dto.effectiveFrom !== undefined ? dto.effectiveFrom : pricing.effectiveFrom;
    const newTo = dto.effectiveTo !== undefined ? (dto.effectiveTo || null) : pricing.effectiveTo;
    
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

    // Helper function to check if a date range change violates a chốt sổ date boundary
    const validateDateLock = async (oldDate: string | null, newDate: string | null) => {
      // For effectiveFrom, it is never null. For effectiveTo, it can be null.
      const checkLock = async (dateVal: string | null, maxDate: string | null) => {
        if (!dateVal || !maxDate) return false;
        return dateVal <= maxDate;
      };

      if (Number(pricing.pricePerSession) > 0) {
        const max = await this.persistence.getMaxStudentBillDate(levelId);
        if (await checkLock(oldDate, max) || await checkLock(newDate, max)) return true;
      }
      if (Number(pricing.teacherWagePerSession) > 0) {
        const max = await this.persistence.getMaxTeacherWageDate(levelId);
        if (await checkLock(oldDate, max) || await checkLock(newDate, max)) return true;
      }
      if (Number(pricing.taWagePerSession) > 0) {
        const max = await this.persistence.getMaxAssistantWageDate(levelId);
        if (await checkLock(oldDate, max) || await checkLock(newDate, max)) return true;
      }
      return false;
    };

    // 2. Guard effectiveFrom changes
    if (dto.effectiveFrom !== undefined && dto.effectiveFrom !== pricing.effectiveFrom) {
      if (await validateDateLock(pricing.effectiveFrom, dto.effectiveFrom)) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Không thể thay đổi ngày bắt đầu của bảng giá liên quan đến giai đoạn đã chốt sổ/lương.`
        );
      }
    }

    // 3. Guard effectiveTo changes
    if (dto.effectiveTo !== undefined && dto.effectiveTo !== pricing.effectiveTo) {
      if (await validateDateLock(pricing.effectiveTo, dto.effectiveTo || null)) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Không thể thay đổi ngày kết thúc của bảng giá liên quan đến giai đoạn đã chốt sổ/lương.`
        );
      }
    }

    // 5. Overlap validation with other records
    if (newTo && newFrom > newTo) {
      throw new AcademicError('PRICING_CONFLICT', 'Ngày bắt đầu áp dụng không được sau ngày kết thúc.');
    }

    if (dto.pricePerSession !== undefined) pricing.pricePerSession = dto.pricePerSession;
    if (dto.teacherWagePerSession !== undefined) pricing.teacherWagePerSession = dto.teacherWagePerSession;
    if (dto.taWagePerSession !== undefined) pricing.taWagePerSession = dto.taWagePerSession;
    if (dto.effectiveFrom !== undefined) pricing.effectiveFrom = dto.effectiveFrom;
    if (dto.effectiveTo !== undefined) pricing.effectiveTo = dto.effectiveTo || null;

    return this.persistence.savePricing(pricing);
  }
}
