import { performance } from 'perf_hooks';
import { CommissionSalaryCalculator } from '../../../../../../src/modules/billing/domain/services/commission-salary-calculator';

describe('CommissionSalaryCalculator', () => {
  describe('Functional Tests', () => {
    it('should calculate 20% commission when revenue is less than 100M', () => {
      // 50M revenue -> 10M commission
      expect(CommissionSalaryCalculator.calculateCommission(50_000_000)).toBe(10_000_000);
      expect(CommissionSalaryCalculator.calculateSalary(50_000_000)).toBe(15_000_000);
    });

    it('should calculate progressive commission when revenue is between 100M and 200M', () => {
      // 153M revenue -> 20M + 53M * 25% = 33.25M commission
      expect(CommissionSalaryCalculator.calculateCommission(153_000_000)).toBe(33_250_000);
      expect(CommissionSalaryCalculator.calculateSalary(153_000_000)).toBe(38_250_000);
    });

    it('should calculate progressive commission when revenue is between 200M and 300M', () => {
      // 250M revenue -> 45M + 50M * 30% = 60M commission
      expect(CommissionSalaryCalculator.calculateCommission(250_000_000)).toBe(60_000_000);
      expect(CommissionSalaryCalculator.calculateSalary(250_000_000)).toBe(65_000_000);
    });

    it('should cap commission at 75M when revenue is 300M or more', () => {
      // 350M revenue -> 75M commission (cap)
      expect(CommissionSalaryCalculator.calculateCommission(350_000_000)).toBe(75_000_000);
      expect(CommissionSalaryCalculator.calculateSalary(350_000_000)).toBe(80_000_000);
    });

    it('should return base salary and 0 commission when revenue is 0', () => {
      expect(CommissionSalaryCalculator.calculateCommission(0)).toBe(0);
      expect(CommissionSalaryCalculator.calculateSalary(0)).toBe(5_000_000);
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
