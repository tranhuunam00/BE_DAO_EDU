export class CommissionSalaryCalculator {
  static calculateCommission(academyRevenue: number): number {
    const revenue = academyRevenue || 0;
    if (revenue < 100000000) {
      return Math.round(revenue * 0.2);
    } else if (revenue < 200000000) {
      return Math.round(20000000 + (revenue - 100000000) * 0.25);
    } else if (revenue < 300000000) {
      return Math.round(20000000 + 25000000 + (revenue - 200000000) * 0.3);
    } else {
      return 20000000 + 25000000 + 30000000;
    }
  }

  static calculateSalary(academyRevenue: number, baseSalary = 5000000): number {
    const commission = this.calculateCommission(academyRevenue);
    return baseSalary + commission;
  }
}
