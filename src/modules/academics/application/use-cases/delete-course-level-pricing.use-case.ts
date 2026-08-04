import { CoursePricingPersistencePort } from '../ports/course-pricing-persistence.port';
import { AcademicError } from '../../domain/errors/academic.error';

export class DeleteCourseLevelPricingUseCase {
  constructor(private readonly persistence: CoursePricingPersistencePort) {}

  async execute(id: string): Promise<{ message: string }> {
    const pricing = await this.persistence.findPricingById(id);
    if (!pricing) {
      throw new AcademicError('PRICING_NOT_FOUND', 'Không tìm thấy bảng giá lịch sử này.');
    }
    const levelId = pricing.courseLevelId;

    const isLocked = (await this.persistence.checkStudentBills(levelId, pricing.effectiveFrom, pricing.effectiveTo)) ||
                     (await this.persistence.checkTeacherWages(levelId, pricing.effectiveFrom, pricing.effectiveTo)) ||
                     (await this.persistence.checkAssistantWages(levelId, pricing.effectiveFrom, pricing.effectiveTo));

    if (isLocked) {
      throw new AcademicError('PRICING_CONFLICT', 'Không thể xóa bảng giá này vì đã có dữ liệu thu học phí hoặc tính lương trong khoảng thời gian áp dụng.');
    }

    await this.persistence.deletePricing(pricing.id);
    return { message: 'Xóa bảng giá thành công' };
  }
}
