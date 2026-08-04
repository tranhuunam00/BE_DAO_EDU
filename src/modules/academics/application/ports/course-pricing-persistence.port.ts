export interface CoursePricingRecord {
  id: string;
  courseLevelId: string;
  pricePerSession: number;
  teacherWagePerSession: number;
  taWagePerSession: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export abstract class CoursePricingPersistencePort {
  abstract findPricingByLevelId(levelId: string): Promise<CoursePricingRecord[]>;
  abstract findPricingById(id: string): Promise<CoursePricingRecord | null>;
  abstract findActivePricing(levelId: string): Promise<CoursePricingRecord | null>;
  abstract savePricing(pricing: any): Promise<any>;
  abstract createPricing(pricingData: any): Promise<any>;
  abstract deletePricing(id: string): Promise<void>;
  abstract checkStudentBills(levelId: string, from: string, to: string | null): Promise<boolean>;
  abstract checkTeacherWages(levelId: string, from: string, to: string | null): Promise<boolean>;
  abstract checkAssistantWages(levelId: string, from: string, to: string | null): Promise<boolean>;
  abstract getMaxStudentBillDate(levelId: string): Promise<string | null>;
  abstract getMaxTeacherWageDate(levelId: string): Promise<string | null>;
  abstract getMaxAssistantWageDate(levelId: string): Promise<string | null>;
}
