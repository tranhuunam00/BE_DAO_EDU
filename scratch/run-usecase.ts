import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GetDashboardRevenueUseCase } from '../src/application/use-cases/dashboard/get-dashboard-revenue.use-case';
import { GetDashboardSummaryUseCase } from '../src/application/use-cases/dashboard/get-dashboard-summary.use-case';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const revenueUseCase = app.get(GetDashboardRevenueUseCase);
  const summaryUseCase = app.get(GetDashboardSummaryUseCase);

  const revenueResult = await revenueUseCase.execute();
  console.log('--- REVENUE RESULT ---');
  console.log(JSON.stringify(revenueResult, null, 2));

  const summaryResult = await summaryUseCase.execute();
  console.log('--- SUMMARY RESULT ---');
  console.log(JSON.stringify(summaryResult, null, 2));

  await app.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
