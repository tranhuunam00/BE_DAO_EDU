import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentMonthlyBillOrmEntity } from '../../../infrastructure/persistence/typeorm/entities/student-monthly-bill.orm-entity';

@Injectable()
export class GetDashboardRevenueUseCase {
  constructor(
    @InjectRepository(StudentMonthlyBillOrmEntity)
    private readonly billRepo: Repository<StudentMonthlyBillOrmEntity>,
  ) { }

  async execute() {
    const bills = await this.billRepo.find();

    let maxDate = new Date();
    const validMonths = bills.map(b => b.month).filter(Boolean);
    if (validMonths.length > 0) {
      const maxMonthStr = validMonths.reduce((a, b) => a > b ? a : b);
      const [year, month] = maxMonthStr.split('-');
      maxDate = new Date(Number(year), Number(month) - 1, 1);
    }

    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(maxDate.getFullYear(), maxDate.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }

    // Group by month (format: YYYY-MM)
    const map = new Map<string, { expected: number; actual: number }>();
    for (const m of months) {
      map.set(m, { expected: 0, actual: 0 });
    }

    for (const b of bills) {
      if (!b.month || !map.has(b.month)) continue;

      const stats = map.get(b.month)!;
      const amount = Number(b.totalAmount) || 0;
      stats.expected += amount;

      if (b.status === 'Paid') {
        stats.actual += amount;
      }
    }

    const revenueData = months.map(m => ({
      month: m,
      expected: map.get(m)!.expected,
      actual: map.get(m)!.actual,
    }));

    return {
      revenue: revenueData
    };
  }
}
