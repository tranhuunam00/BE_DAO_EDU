import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { ProcessPendingFacebookLeadScansUseCase } from './src/modules/facebook-lead-scans/application/use-cases/process-pending-facebook-lead-scans.use-case';
import { FacebookLeadScanOrmEntity } from './src/infrastructure/persistence/typeorm/entities/facebook-lead-scan.orm-entity';
import { DataSource } from 'typeorm';

async function test() {
  console.log('=== KHOI TAO CONTEXT BE DAO EDU ===');
  const app = await NestFactory.createApplicationContext(AppModule);

  // Reset all status to PENDING for testing purposes
  const dataSource = app.get(DataSource);
  console.log('=== RESET TOAN BO TRANG THAI VE PENDING DE TEST ===');
  await dataSource.manager
    .createQueryBuilder()
    .update(FacebookLeadScanOrmEntity)
    .set({
      aiAnalysisStatus: 'PENDING',
      aiAnalysisRetryCount: 0,
      aiAnalysisError: null
    })
    .execute();
  console.log('Reset thanh cong!');

  console.log('=== LAY USECASE TU APP CONTEXT ===');
  const useCase = app.get(ProcessPendingFacebookLeadScansUseCase);

  console.log('=== BAT DAU KICH HOAT PHAN TICH AI ===');
  await useCase.execute();

  console.log('=== PHAN TICH AI HOAN THANH - DONG CONTEXT ===');
  await app.close();
}

test().catch((err) => {
  console.error('Loi khi chay test:', err);
  process.exit(1);
});
