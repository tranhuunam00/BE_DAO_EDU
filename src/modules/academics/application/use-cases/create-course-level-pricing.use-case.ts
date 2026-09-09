import { CoursePricingPersistencePort, CoursePricingRecord } from '../ports/course-pricing-persistence.port';
import { CourseLevelPricingDto } from '../../../../application/dtos/course.dto';
import { AcademicError } from '../../domain/errors/academic.error';
import { CoursePricingTimelineGuard } from '../../domain/services/course-pricing-timeline-guard.service';

export class CreateCourseLevelPricingUseCase {
  constructor(private readonly persistence: CoursePricingPersistencePort) {}

  async execute(levelId: string, dto: CourseLevelPricingDto): Promise<CoursePricingRecord> {
    // 1. Normalize and strictly validate dates (Mandatory effectiveFrom and effectiveTo)
    const { effectiveFrom, effectiveTo } = CoursePricingTimelineGuard.normalizeAndValidateDates(
      dto.effectiveFrom,
      dto.effectiveTo,
    );

    // 2. Validate non-negative amounts
    CoursePricingTimelineGuard.validateAmounts(
      dto.pricePerSession,
      dto.teacherWagePerSession,
      dto.taWagePerSession,
      true,
    );

    const finalPrice = dto.pricePerSession !== undefined ? Number(dto.pricePerSession) : 0;
    const finalTeacherWage = dto.teacherWagePerSession !== undefined ? Number(dto.teacherWagePerSession) : 0;
    const finalTaWage = dto.taWagePerSession !== undefined ? Number(dto.taWagePerSession) : 0;

    if (finalPrice <= 0 && finalTeacherWage <= 0 && finalTaWage <= 0) {
      throw new AcademicError(
        'BAD_REQUEST',
        'Vui lòng cấu hình ít nhất một loại đơn giá hoặc lương lớn hơn 0.',
      );
    }

    let pricingType: 'student' | 'teacher' | 'ta' = 'student';
    if (dto.type === 'student' || dto.type === 'teacher' || dto.type === 'ta') {
      pricingType = dto.type;
    } else if (finalTeacherWage > 0 && finalPrice <= 0 && finalTaWage <= 0) {
      pricingType = 'teacher';
    } else if (finalTaWage > 0 && finalPrice <= 0 && finalTeacherWage <= 0) {
      pricingType = 'ta';
    } else if (finalPrice > 0) {
      pricingType = 'student';
    } else if (finalTeacherWage > 0) {
      pricingType = 'teacher';
    } else {
      pricingType = 'ta';
    }

    // 3. Lock check against already billed dates for the active rates
    const [maxStudentBillDate, maxTeacherWageDate, maxAssistantWageDate] = await Promise.all([
      finalPrice > 0 ? this.persistence.getMaxStudentBillDate(levelId) : Promise.resolve(null),
      finalTeacherWage > 0 ? this.persistence.getMaxTeacherWageDate(levelId) : Promise.resolve(null),
      finalTaWage > 0 ? this.persistence.getMaxAssistantWageDate(levelId) : Promise.resolve(null),
    ]);

    if (finalPrice > 0 && maxStudentBillDate) {
      if (effectiveTo <= maxStudentBillDate) {
        throw new AcademicError(
          'PRICING_LOCKED_BILLED',
          `Không thể tạo bảng giá hoàn toàn trong quá khứ đã chốt tiền (trước hoặc bằng ${maxStudentBillDate})`,
        );
      }
      if (effectiveFrom <= maxStudentBillDate) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Ngày bắt đầu áp dụng học phí (${effectiveFrom}) phải sau ngày chốt học phí gần nhất (${maxStudentBillDate}).`,
        );
      }
    }

    if (finalTeacherWage > 0 && maxTeacherWageDate) {
      if (effectiveTo <= maxTeacherWageDate) {
        throw new AcademicError(
          'PRICING_LOCKED_BILLED',
          `Không thể tạo bảng giá hoàn toàn trong quá khứ đã chốt tiền (trước hoặc bằng ${maxTeacherWageDate})`,
        );
      }
      if (effectiveFrom <= maxTeacherWageDate) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Ngày bắt đầu áp dụng lương giáo viên (${effectiveFrom}) phải sau ngày chốt lương gần nhất (${maxTeacherWageDate}).`,
        );
      }
    }

    if (finalTaWage > 0 && maxAssistantWageDate) {
      if (effectiveTo <= maxAssistantWageDate) {
        throw new AcademicError(
          'PRICING_LOCKED_BILLED',
          `Không thể tạo bảng giá hoàn toàn trong quá khứ đã chốt tiền (trước hoặc bằng ${maxAssistantWageDate})`,
        );
      }
      if (effectiveFrom <= maxAssistantWageDate) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Ngày bắt đầu áp dụng lương trợ giảng (${effectiveFrom}) phải sau ngày chốt lương trợ giảng gần nhất (${maxAssistantWageDate}).`,
        );
      }
    }

    // 4. Overlap collision detection strictly within the SAME type
    const existingList = await this.persistence.findPricingByLevelId(levelId);

    const checkFieldOverlap = (rateField: 'pricePerSession' | 'teacherWagePerSession' | 'taWagePerSession', label: string, pType: string) => {
      const fieldPricings = existingList.filter((p) => {
        if (p.type) return p.type === pType;
        return Number((p as any)[rateField]) > 0;
      });
      const overlap = fieldPricings.some((p) => {
        const pFrom = p.effectiveFrom;
        const pTo = p.effectiveTo;
        if (pTo === null) {
          return pFrom <= effectiveTo;
        }
        return effectiveFrom <= pTo && effectiveTo >= pFrom;
      });
      if (overlap) {
        throw new AcademicError(
          'PRICING_CONFLICT',
          `Khoảng thời gian áp dụng ${label} bị trùng lặp với một bản ghi ${label} khác.`,
        );
      }
    };

    if (finalPrice > 0) {
      checkFieldOverlap('pricePerSession', 'đơn giá học phí', 'student');
    }
    if (finalTeacherWage > 0) {
      checkFieldOverlap('teacherWagePerSession', 'lương giáo viên', 'teacher');
    }
    if (finalTaWage > 0) {
      checkFieldOverlap('taWagePerSession', 'lương trợ giảng', 'ta');
    }

    return this.persistence.createPricing({
      courseLevelId: levelId,
      pricePerSession: finalPrice,
      teacherWagePerSession: finalTeacherWage,
      taWagePerSession: finalTaWage,
      effectiveFrom,
      effectiveTo,
      type: pricingType,
    });
  }
}
