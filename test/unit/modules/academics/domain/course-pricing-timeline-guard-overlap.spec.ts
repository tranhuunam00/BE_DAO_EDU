import { CoursePricingTimelineGuard, CoursePricingRecord } from '../../../../../src/modules/academics/domain/services/course-pricing-timeline-guard.service';
import { AcademicError } from '../../../../../src/modules/academics/domain/errors/academic.error';

describe('CoursePricingTimelineGuard - Part 1: Date Validations & Collision Detection (Cases 1-26)', () => {
  describe('Group 1: Date Formats & Edge Boundaries (Cases 1 - 10)', () => {
    // Case 1: effectiveFrom is null or undefined
    it('Case 01: should throw BAD_REQUEST if effectiveFrom is null or undefined', () => {
      expect(() => CoursePricingTimelineGuard.normalizeAndValidateDates(null, '2026-03-31'))
        .toThrow(AcademicError);
      expect(() => CoursePricingTimelineGuard.normalizeAndValidateDates(undefined, '2026-03-31'))
        .toThrow(AcademicError);
    });

    // Case 2: effectiveTo is null or undefined
    it('Case 02: should throw BAD_REQUEST if effectiveTo is null or undefined', () => {
      expect(() => CoursePricingTimelineGuard.normalizeAndValidateDates('2026-03-01', null))
        .toThrow(AcademicError);
      expect(() => CoursePricingTimelineGuard.normalizeAndValidateDates('2026-03-01', undefined))
        .toThrow(AcademicError);
    });

    // Case 3: effectiveFrom does not match YYYY-MM-DD
    it('Case 03: should throw BAD_REQUEST if effectiveFrom is invalid format (not YYYY-MM-DD)', () => {
      const invalidFormats = ['01-03-2026', '2026/03/01', '2026-3-1', 'invalid-date', ''];
      for (const fmt of invalidFormats) {
        expect(() => CoursePricingTimelineGuard.normalizeAndValidateDates(fmt, '2026-03-31'))
          .toThrow(AcademicError);
      }
    });

    // Case 4: effectiveTo does not match YYYY-MM-DD
    it('Case 04: should throw BAD_REQUEST if effectiveTo is invalid format (not YYYY-MM-DD)', () => {
      const invalidFormats = ['31-03-2026', '2026/03/31', '2026-13-45', 'invalid-date', ''];
      for (const fmt of invalidFormats) {
        expect(() => CoursePricingTimelineGuard.normalizeAndValidateDates('2026-03-01', fmt))
          .toThrow(AcademicError);
      }
    });

    // Case 5: effectiveFrom contains ISO timestamp with time/timezone
    it('Case 05: should reject or sanitize effectiveFrom containing ISO timestamp strings', () => {
      const isoDate = '2026-03-01T15:30:00.000Z';
      // Should normalize to YYYY-MM-DD '2026-03-01' without timezone drift
      const result = CoursePricingTimelineGuard.normalizeAndValidateDates(isoDate, '2026-03-31');
      expect(result.effectiveFrom).toBe('2026-03-01');
    });

    // Case 6: effectiveTo contains ISO timestamp with time/timezone
    it('Case 06: should reject or sanitize effectiveTo containing ISO timestamp strings', () => {
      const isoDate = '2026-03-31T23:59:59.999Z';
      const result = CoursePricingTimelineGuard.normalizeAndValidateDates('2026-03-01', isoDate);
      expect(result.effectiveTo).toBe('2026-03-31');
    });

    // Case 7: effectiveTo < effectiveFrom (End date before start date)
    it('Case 07: should throw BAD_REQUEST if effectiveTo is strictly before effectiveFrom', () => {
      expect(() => CoursePricingTimelineGuard.normalizeAndValidateDates('2026-03-31', '2026-03-01'))
        .toThrow(AcademicError);
    });

    // Case 8: effectiveTo === effectiveFrom (Single day pricing)
    it('Case 08: should allow single-day pricing where effectiveTo equals effectiveFrom', () => {
      const result = CoursePricingTimelineGuard.normalizeAndValidateDates('2026-03-15', '2026-03-15');
      expect(result.effectiveFrom).toBe('2026-03-15');
      expect(result.effectiveTo).toBe('2026-03-15');
    });

    // Case 9: Leap Year handling (2024-02-29 vs 2025-02-28)
    it('Case 09: should handle leap year dates (2024-02-29) and reject non-leap year (2025-02-29)', () => {
      const validLeap = CoursePricingTimelineGuard.normalizeAndValidateDates('2024-02-01', '2024-02-29');
      expect(validLeap.effectiveTo).toBe('2024-02-29');

      expect(() => CoursePricingTimelineGuard.normalizeAndValidateDates('2025-02-01', '2025-02-29'))
        .toThrow(AcademicError);
    });

    // Case 10: Date range across calendar years
    it('Case 10: should allow pricing timeline crossing across different calendar years', () => {
      const result = CoursePricingTimelineGuard.normalizeAndValidateDates('2025-11-01', '2026-02-28');
      expect(result.effectiveFrom).toBe('2025-11-01');
      expect(result.effectiveTo).toBe('2026-02-28');
    });
  });

  describe('Group 2: "Chạm là Chặn" - Strict No-Overlap Collision Detection (Cases 11 - 26)', () => {
    const existingPricing: CoursePricingRecord[] = [
      {
        id: 'p-existing-1',
        effectiveFrom: '2026-03-01',
        effectiveTo: '2026-03-31',
        pricePerSession: 150000,
        teacherWagePerSession: 200000,
      },
    ];

    // Case 11: Exact same interval
    it('Case 11: should reject new pricing with exact same date range [2026-03-01, 2026-03-31]', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2026-03-01',
        effectiveTo: '2026-03-31',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, existingPricing))
        .toThrow(AcademicError);
    });

    // Case 12: Sub-interval (Strictly inside)
    it('Case 12: should reject new pricing completely inside existing range [2026-03-10, 2026-03-20]', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2026-03-10',
        effectiveTo: '2026-03-20',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, existingPricing))
        .toThrow(AcademicError);
    });

    // Case 13: Super-interval (Completely engulfing existing range)
    it('Case 13: should reject new pricing completely engulfing existing range [2026-02-15, 2026-04-15]', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2026-02-15',
        effectiveTo: '2026-04-15',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, existingPricing))
        .toThrow(AcademicError);
    });

    // Case 14: Left overlap (Spans across start boundary)
    it('Case 14: should reject new pricing overlapping left boundary [2026-02-15, 2026-03-15]', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2026-02-15',
        effectiveTo: '2026-03-15',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, existingPricing))
        .toThrow(AcademicError);
    });

    // Case 15: Right overlap (Spans across end boundary)
    it('Case 15: should reject new pricing overlapping right boundary [2026-03-15, 2026-04-15]', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2026-03-15',
        effectiveTo: '2026-04-15',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, existingPricing))
        .toThrow(AcademicError);
    });

    // Case 16: Left boundary touch (effectiveTo === existing.effectiveFrom)
    it('Case 16: should reject new pricing touching left boundary [2026-02-01, 2026-03-01] ("Chạm là Chặn")', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2026-02-01',
        effectiveTo: '2026-03-01', // Touches existing start '2026-03-01'
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, existingPricing))
        .toThrow(AcademicError);
    });

    // Case 17: Right boundary touch (effectiveFrom === existing.effectiveTo)
    it('Case 17: should reject new pricing touching right boundary [2026-03-31, 2026-04-30] ("Chạm là Chặn")', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2026-03-31', // Touches existing end '2026-03-31'
        effectiveTo: '2026-04-30',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, existingPricing))
        .toThrow(AcademicError);
    });

    // Case 18: Adjacent before (Immediately preceding without touching)
    it('Case 18: should allow new pricing immediately preceding existing without touching [2026-02-01, 2026-02-28]', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2026-02-01',
        effectiveTo: '2026-02-28',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, existingPricing)).not.toThrow();
    });

    // Case 19: Adjacent after (Immediately following without touching)
    it('Case 19: should allow new pricing immediately following existing without touching [2026-04-01, 2026-04-30]', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2026-04-01',
        effectiveTo: '2026-04-30',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, existingPricing)).not.toThrow();
    });

    // Case 20: Far future
    it('Case 20: should allow new pricing in far future [2027-01-01, 2027-12-31]', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2027-01-01',
        effectiveTo: '2027-12-31',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, existingPricing)).not.toThrow();
    });

    // Case 21: Far past
    it('Case 21: should allow new pricing in far past [2024-01-01, 2024-12-31]', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2024-01-01',
        effectiveTo: '2024-12-31',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, existingPricing)).not.toThrow();
    });

    // Multiple existing intervals
    const multiPricingList: CoursePricingRecord[] = [
      { id: 'p1', effectiveFrom: '2026-01-01', effectiveTo: '2026-01-31' },
      { id: 'p2', effectiveFrom: '2026-03-01', effectiveTo: '2026-03-31' },
      { id: 'p3', effectiveFrom: '2026-05-01', effectiveTo: '2026-05-31' },
    ];

    // Case 22: Fit cleanly in the gap between two intervals
    it('Case 22: should allow new pricing fitting cleanly between two intervals [2026-02-01, 2026-02-28]', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2026-02-01',
        effectiveTo: '2026-02-28',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, multiPricingList)).not.toThrow();
    });

    // Case 23: Engulfing multiple intervals
    it('Case 23: should reject new pricing engulfing multiple intervals [2026-01-15, 2026-03-15]', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2026-01-15',
        effectiveTo: '2026-03-15',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, multiPricingList))
        .toThrow(AcademicError);
    });

    // Case 24: Touching boundary of middle interval
    it('Case 24: should reject new pricing touching end of p1 and start of p2 [2026-01-31, 2026-03-01]', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2026-01-31',
        effectiveTo: '2026-03-01',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, multiPricingList))
        .toThrow(AcademicError);
    });

    // Case 25: Updating same record (Self-exclusion)
    it('Case 25: should ignore self record ID when checking overlap during update', () => {
      const target: CoursePricingRecord = {
        id: 'p2', // Same ID as existing interval 2
        effectiveFrom: '2026-03-05',
        effectiveTo: '2026-03-25',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, multiPricingList)).not.toThrow();
    });

    // Case 26: Updating record to collide with another record
    it('Case 26: should reject update if modified range collides with another existing record', () => {
      const target: CoursePricingRecord = {
        id: 'p2',
        effectiveFrom: '2026-01-20', // Overlaps p1
        effectiveTo: '2026-03-25',
      };
      expect(() => CoursePricingTimelineGuard.checkOverlap(target, multiPricingList))
        .toThrow(AcademicError);
    });
  });
});
