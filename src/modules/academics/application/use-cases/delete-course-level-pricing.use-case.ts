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
    const pricingType = pricing.type || (Number(pricing.teacherWagePerSession) > 0 ? 'teacher' : Number(pricing.taWagePerSession) > 0 ? 'ta' : 'student');

    let isLocked = false;
    let conflictMessage = '';

    if (pricingType === 'student') {
      isLocked = await this.persistence.checkStudentBills(levelId, pricing.effectiveFrom, pricing.effectiveTo);
      conflictMessage = 'Không thể xóa bảng giá học phí này vì đã có dữ liệu thu học phí trong khoảng thời gian áp dụng.';
    } else if (pricingType === 'teacher') {
      isLocked = await this.persistence.checkTeacherWages(levelId, pricing.effectiveFrom, pricing.effectiveTo);
      conflictMessage = 'Không thể xóa bảng giá lương giáo viên này vì đã có dữ liệu tính lương trong khoảng thời gian áp dụng.';
    } else if (pricingType === 'ta') {
      isLocked = await this.persistence.checkAssistantWages(levelId, pricing.effectiveFrom, pricing.effectiveTo);
      conflictMessage = 'Không thể xóa bảng giá lương trợ giảng này vì đã có dữ liệu tính lương trợ giảng trong khoảng thời gian áp dụng.';
    }

    if (isLocked) {
      throw new AcademicError('PRICING_CONFLICT', conflictMessage);
    }

    await this.persistence.deletePricing(pricing.id);
    return { message: 'Xóa bảng giá thành công' };
  }
}
