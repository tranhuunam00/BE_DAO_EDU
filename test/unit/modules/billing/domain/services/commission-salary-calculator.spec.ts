import { performance } from 'perf_hooks';
import { CommissionSalaryCalculator } from '../../../../../../src/modules/billing/domain/services/commission-salary-calculator';

describe('CommissionSalaryCalculator', () => {
  describe('Functional Tests', () => {
    it('should calculate 20% commission when revenue is less than 100M', () => {
      // 50M revenue -> 10M commission
      expect(CommissionSalaryCalculator.calculateCommission(50_000_000)).toBe(10_000_000);
      expect(CommissionSalaryCalculator.calculateSalary(50_000_000)).toBe(15_000_000);

      // Upper boundary of tier 1: 99_999_999 -> 20% = 19_999_999.8 -> rounded to 20_000_000
      expect(CommissionSalaryCalculator.calculateCommission(99_999_999)).toBe(20_000_000);
    });

    it('should calculate progressive commission when revenue is between 100M and 200M', () => {
      // Exact threshold 100M -> 20M commission
      expect(CommissionSalaryCalculator.calculateCommission(100_000_000)).toBe(20_000_000);
      expect(CommissionSalaryCalculator.calculateSalary(100_000_000)).toBe(25_000_000);

      // 153M revenue -> 20M + 53M * 25% = 33.25M commission
      expect(CommissionSalaryCalculator.calculateCommission(153_000_000)).toBe(33_250_000);
      expect(CommissionSalaryCalculator.calculateSalary(153_000_000)).toBe(38_250_000);

      // Upper boundary of tier 2: 199_999_999 -> 20M + 99_999_999 * 0.25 = 44_999_999.75 -> 45_000_000
      expect(CommissionSalaryCalculator.calculateCommission(199_999_999)).toBe(45_000_000);
    });

    it('should calculate progressive commission when revenue is between 200M and 300M', () => {
      // Exact threshold 200M -> 45M commission
      expect(CommissionSalaryCalculator.calculateCommission(200_000_000)).toBe(45_000_000);
      expect(CommissionSalaryCalculator.calculateSalary(200_000_000)).toBe(50_000_000);

      // 250M revenue -> 45M + 50M * 30% = 60M commission
      expect(CommissionSalaryCalculator.calculateCommission(250_000_000)).toBe(60_000_000);
      expect(CommissionSalaryCalculator.calculateSalary(250_000_000)).toBe(65_000_000);

      // Upper boundary of tier 3: 299_999_999 -> 45M + 99_999_999 * 0.3 = 74_999_999.7 -> 75_000_000
      expect(CommissionSalaryCalculator.calculateCommission(299_999_999)).toBe(75_000_000);
    });

    it('should cap commission at 75M when revenue is 300M or more', () => {
      // Exact threshold 300M -> 75M commission (cap)
      expect(CommissionSalaryCalculator.calculateCommission(300_000_000)).toBe(75_000_000);
      expect(CommissionSalaryCalculator.calculateSalary(300_000_000)).toBe(80_000_000);

      // 350M revenue -> 75M commission (cap)
      expect(CommissionSalaryCalculator.calculateCommission(350_000_000)).toBe(75_000_000);
      expect(CommissionSalaryCalculator.calculateSalary(350_000_000)).toBe(80_000_000);

      // 500M revenue -> still capped at 75M
      expect(CommissionSalaryCalculator.calculateCommission(500_000_000)).toBe(75_000_000);
      expect(CommissionSalaryCalculator.calculateSalary(500_000_000)).toBe(80_000_000);
    });

    it('should return base salary and 0 commission when revenue is 0 or negative', () => {
      expect(CommissionSalaryCalculator.calculateCommission(0)).toBe(0);
      expect(CommissionSalaryCalculator.calculateSalary(0)).toBe(5_000_000);
      expect(CommissionSalaryCalculator.calculateCommission(-10_000_000 as any)).toBe(0);
      expect(CommissionSalaryCalculator.calculateSalary(-10_000_000 as any)).toBe(5_000_000);
    });
  });

  describe('Performance Benchmark Tests', () => {
    it('should calculate salary in less than 0.1ms (SLA Limit)', () => {
      const start = performance.now();
      
      // Run 10,000 times to simulate high load / batch operations
      for (let i = 0; i < 10000; i++) {
        CommissionSalaryCalculator.calculateSalary(153_000_000);
      }
      
      const duration = performance.now() - start;
      const avgDuration = duration / 10000;
      
      console.log(`[Performance Benchmark] Average execution time: ${avgDuration.toFixed(6)} ms`);
      
      // SLA Time Limit is 0.1ms (100 microseconds)
      expect(avgDuration).toBeLessThan(0.1);
    });
  });
});
