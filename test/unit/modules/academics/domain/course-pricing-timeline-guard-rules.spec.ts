import { CoursePricingTimelineGuard, CoursePricingRecord } from '../../../../../src/modules/academics/domain/services/course-pricing-timeline-guard.service';
import { AcademicError } from '../../../../../src/modules/academics/domain/errors/academic.error';

describe('CoursePricingTimelineGuard - Part 2: Rules, Billed Locks, Gaps & Benchmark (Cases 27-50)', () => {
  describe('Group 3: Amounts, Rates, Null & Zero Cases (Cases 27 - 36)', () => {
    // Case 27: Zero tuition price (Scholarship / Free class)
    it('Case 27: should allow pricePerSession = 0 (100% scholarship / free class)', () => {
      expect(() => CoursePricingTimelineGuard.validateAmounts(0, 150000, 50000)).not.toThrow();
    });

    // Case 28: Zero teacher wage (Volunteer / Intern teacher)
    it('Case 28: should allow teacherWagePerSession = 0 (volunteer / intern teacher)', () => {
      expect(() => CoursePricingTimelineGuard.validateAmounts(100000, 0, 50000)).not.toThrow();
    });

    // Case 29: Zero assistant wage (Intern assistant)
    it('Case 29: should allow assistantWagePerSession = 0 (intern assistant without stipend)', () => {
      expect(() => CoursePricingTimelineGuard.validateAmounts(100000, 150000, 0)).not.toThrow();
    });

    // Case 30: Negative tuition price
    it('Case 30: should reject negative pricePerSession < 0', () => {
      expect(() => CoursePricingTimelineGuard.validateAmounts(-50000, 150000, 50000))
        .toThrow(AcademicError);
    });

    // Case 31: Negative teacher wage
    it('Case 31: should reject negative teacherWagePerSession < 0', () => {
      expect(() => CoursePricingTimelineGuard.validateAmounts(100000, -150000, 50000))
        .toThrow(AcademicError);
    });

    // Case 32: Negative assistant wage
    it('Case 32: should reject negative assistantWagePerSession < 0', () => {
      expect(() => CoursePricingTimelineGuard.validateAmounts(100000, 150000, -50000))
        .toThrow(AcademicError);
    });

    // Case 33: pricePerSession null or undefined
    it('Case 33: should reject if pricePerSession is null or undefined', () => {
      expect(() => CoursePricingTimelineGuard.validateAmounts(null, 150000, 50000))
        .toThrow(AcademicError);
      expect(() => CoursePricingTimelineGuard.validateAmounts(undefined, 150000, 50000))
        .toThrow(AcademicError);
    });

    // Case 34: assistantWagePerSession is null or undefined (No assistant in course)
    it('Case 34: should allow assistantWagePerSession to be null or undefined if course has no assistant', () => {
      expect(() => CoursePricingTimelineGuard.validateAmounts(100000, 150000, null)).not.toThrow();
      expect(() => CoursePricingTimelineGuard.validateAmounts(100000, 150000, undefined)).not.toThrow();
    });

    // Case 35: Extreme amount value
    it('Case 35: should allow large amounts up to 100,000,000 VND per session', () => {
      expect(() => CoursePricingTimelineGuard.validateAmounts(100000000, 50000000, 20000000)).not.toThrow();
    });

    // Case 36: Partial amount update check
    it('Case 36: should validate partial fields correctly without throwing if optional fields are omitted', () => {
      expect(() => CoursePricingTimelineGuard.validateAmounts(undefined, 200000, undefined, true)).not.toThrow();
    });
  });

  describe('Group 4: Lock Against Billed Dates (Cases 37 - 47)', () => {
    const maxBilledDate = '2026-03-15';

    // Case 37: Creating new pricing fully in billed past
    it('Case 37: should reject creating new pricing where effectiveTo <= maxBilledDate', () => {
      const target: CoursePricingRecord = {
        effectiveFrom: '2026-02-01',
        effectiveTo: '2026-02-28',
      };
      expect(() =>
        CoursePricingTimelineGuard.checkLockAgainstBilledDate(target, maxBilledDate, 'create'),
      ).toThrow(AcademicError);
    });

    // Case 38: Updating pricing - modifying effectiveFrom on or before maxBilledDate
    it('Case 38: should reject modifying effectiveFrom to be on or before maxBilledDate', () => {
      const original: CoursePricingRecord = {
        id: 'p1',
        effectiveFrom: '2026-03-20',
        effectiveTo: '2026-04-20',
      };
      const modified: CoursePricingRecord = {
        id: 'p1',
        effectiveFrom: '2026-03-15', // Matches maxBilledDate
        effectiveTo: '2026-04-20',
      };
      expect(() =>
        CoursePricingTimelineGuard.checkLockAgainstBilledDate(modified, maxBilledDate, 'update', original),
      ).toThrow(AcademicError);
    });

    // Case 39: Updating pricing - modifying effectiveTo to be on or before maxBilledDate
    it('Case 39: should reject modifying effectiveTo to be on or before maxBilledDate', () => {
      const original: CoursePricingRecord = {
        id: 'p1',
        effectiveFrom: '2026-03-20',
        effectiveTo: '2026-04-20',
      };
      const modified: CoursePricingRecord = {
        id: 'p1',
        effectiveFrom: '2026-03-20',
        effectiveTo: '2026-03-10', // <= maxBilledDate
      };
      expect(() =>
        CoursePricingTimelineGuard.checkLockAgainstBilledDate(modified, maxBilledDate, 'update', original),
      ).toThrow(AcademicError);
    });

    // Case 40: Updating pricing - modifying future dates (both > maxBilledDate)
    it('Case 40: should allow updating pricing if both effectiveFrom and effectiveTo are strictly > maxBilledDate', () => {
      const original: CoursePricingRecord = {
        id: 'p1',
        effectiveFrom: '2026-03-20',
        effectiveTo: '2026-04-20',
      };
      const modified: CoursePricingRecord = {
        id: 'p1',
        effectiveFrom: '2026-03-25',
        effectiveTo: '2026-04-25',
      };
      expect(() =>
        CoursePricingTimelineGuard.checkLockAgainstBilledDate(modified, maxBilledDate, 'update', original),
      ).not.toThrow();
    });

    // Case 41: Deleting pricing - effectiveFrom <= maxBilledDate
    it('Case 41: should reject deleting pricing if effectiveFrom <= maxBilledDate (Rule 4)', () => {
      const target: CoursePricingRecord = {
        id: 'p1',
        effectiveFrom: '2026-03-01', // <= 2026-03-15
        effectiveTo: '2026-03-31',
      };
      expect(() =>
        CoursePricingTimelineGuard.checkLockAgainstBilledDate(target, maxBilledDate, 'delete'),
      ).toThrow(AcademicError);
    });

    // Case 42: Deleting pricing - effectiveTo <= maxBilledDate
    it('Case 42: should reject deleting pricing if effectiveTo <= maxBilledDate', () => {
      const target: CoursePricingRecord = {
        id: 'p1',
        effectiveFrom: '2026-02-01',
        effectiveTo: '2026-03-15', // <= 2026-03-15
      };
      expect(() =>
        CoursePricingTimelineGuard.checkLockAgainstBilledDate(target, maxBilledDate, 'delete'),
      ).toThrow(AcademicError);
    });

    // Case 43: Deleting pricing safely - both effectiveFrom and effectiveTo > maxBilledDate
    it('Case 43: should allow deleting pricing if both effectiveFrom and effectiveTo > maxBilledDate (Safe deletion)', () => {
      const target: CoursePricingRecord = {
        id: 'p1',
        effectiveFrom: '2026-04-01',
        effectiveTo: '2026-04-30',
      };
      expect(() =>
        CoursePricingTimelineGuard.checkLockAgainstBilledDate(target, maxBilledDate, 'delete'),
      ).not.toThrow();
    });

    // Case 44: When maxBilledDate is null (no bills ever computed) - update is allowed
    it('Case 44: should allow updating dates freely when maxBilledDate is null', () => {
      const target: CoursePricingRecord = {
        id: 'p1',
        effectiveFrom: '2025-01-01',
        effectiveTo: '2025-01-31',
      };
      expect(() =>
        CoursePricingTimelineGuard.checkLockAgainstBilledDate(target, null, 'update'),
      ).not.toThrow();
    });

    // Case 45: When maxBilledDate is null - delete is allowed
    it('Case 45: should allow deleting any pricing when maxBilledDate is null', () => {
      const target: CoursePricingRecord = {
        id: 'p1',
        effectiveFrom: '2025-01-01',
        effectiveTo: '2025-01-31',
      };
      expect(() =>
        CoursePricingTimelineGuard.checkLockAgainstBilledDate(target, null, 'delete'),
      ).not.toThrow();
    });

    // Case 46: Computing maxBilledDate across student tuition and teacher wage
    it('Case 46: should aggregate maxBilledDate correctly between student bill and teacher wage', () => {
      const studentMax = '2026-03-10';
      const teacherMax = '2026-03-20';
      const result = CoursePricingTimelineGuard.computeMaxBilledDate(studentMax, teacherMax);
      expect(result).toBe('2026-03-20');
    });

    // Case 47: Computing maxBilledDate across student, teacher, and assistant wage
    it('Case 47: should aggregate maxBilledDate including assistant wage', () => {
      const studentMax = '2026-03-10';
      const teacherMax = '2026-03-20';
      const assistantMax = '2026-03-25';
      const result = CoursePricingTimelineGuard.computeMaxBilledDate(studentMax, teacherMax, assistantMax);
      expect(result).toBe('2026-03-25');
    });
  });

  describe('Group 5: Gap Warnings & Performance Benchmark SLA (Cases 48 - 50)', () => {
    // Case 48: Detect gap between discontinuous intervals
    it('Case 48: should detect gap between discontinuous pricing ranges and return warning', () => {
      const list: CoursePricingRecord[] = [
        { effectiveFrom: '2026-01-01', effectiveTo: '2026-01-31' },
        { effectiveFrom: '2026-03-01', effectiveTo: '2026-03-31' },
      ];
      const gaps = CoursePricingTimelineGuard.detectGaps(list);
      expect(gaps).toHaveLength(1);
      expect(gaps[0]).toEqual({
        gapFrom: '2026-02-01',
        gapTo: '2026-02-28',
      });
    });

    // Case 49: Continuous intervals without gap
    it('Case 49: should return empty gaps when pricing intervals are strictly contiguous', () => {
      const list: CoursePricingRecord[] = [
        { effectiveFrom: '2026-01-01', effectiveTo: '2026-01-31' },
        { effectiveFrom: '2026-02-01', effectiveTo: '2026-02-28' },
        { effectiveFrom: '2026-03-01', effectiveTo: '2026-03-31' },
      ];
      const gaps = CoursePricingTimelineGuard.detectGaps(list);
      expect(gaps).toHaveLength(0);
    });

    // Case 50: PERFORMANCE BENCHMARK TEST (SLA < 15ms with 1,000 intervals)
    it('Case 50: [PERFORMANCE BENCHMARK] should validate timeline & overlap against 1,000 records within SLA < 15ms', () => {
      // Generate 1,000 non-overlapping 1-day intervals in historical range
      const largeExistingList: CoursePricingRecord[] = [];
      const baseYear = 2000;
      for (let i = 0; i < 1000; i++) {
        // e.g. every 2 days
        const d = new Date(baseYear, 0, 1 + i * 2);
        const dateStr = d.toISOString().slice(0, 10);
        largeExistingList.push({
          id: `p-${i}`,
          effectiveFrom: dateStr,
          effectiveTo: dateStr,
          pricePerSession: 100000,
        });
      }

      const target: CoursePricingRecord = {
        effectiveFrom: '2026-05-01',
        effectiveTo: '2026-05-31',
      };

      const startTime = performance.now();
      CoursePricingTimelineGuard.checkOverlap(target, largeExistingList);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(15); // Strict SLA limit: < 15ms
    });
  });
});
