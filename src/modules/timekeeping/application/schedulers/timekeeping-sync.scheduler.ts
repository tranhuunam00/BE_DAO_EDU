import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReconcileTimekeepingLogsUseCase } from '../use-cases/reconcile-timekeeping-logs.use-case';
import { SyncDeviceTimeUseCase } from '../use-cases/sync-device-time.use-case';

@Injectable()
export class TimekeepingSyncScheduler {
  private readonly logger = new Logger(TimekeepingSyncScheduler.name);

  constructor(
    private readonly reconcileUseCase: ReconcileTimekeepingLogsUseCase,
    private readonly syncTimeUseCase: SyncDeviceTimeUseCase,
  ) {}

  // 1. Cron Job quét bù sự kiện chấm công hàng ngày lúc 23:00 (11:00 PM)
  @Cron('0 23 * * *')
  async handleDailyReconcile() {
    this.logger.log('Bắt đầu chạy Cron Job đối soát điểm danh tự động...');
    const today = new Date();
    const offset = 7 * 60 * 60 * 1000;
    const localTime = new Date(today.getTime() + offset);
    const dateString = localTime.toISOString().substring(0, 10); // YYYY-MM-DD

    try {
      const result = await this.reconcileUseCase.execute(dateString);
      this.logger.log(`Cron Job đối soát hoàn tất. Đã xử lý ${result.eventsProcessed} sự kiện.`);
    } catch (err: any) {
      this.logger.error(`Lỗi chạy Cron Job đối soát: ${err.message || err}`);
    }
  }

  // 2. Cron Job đồng bộ múi giờ chuẩn cho máy chấm công hàng ngày lúc 01:00 AM
  @Cron('0 1 * * *')
  async handleDailyTimeSync() {
    this.logger.log('Bắt đầu Cron Job đồng bộ thời gian thiết bị chấm công...');
    try {
      await this.syncTimeUseCase.execute();
      this.logger.log('Đồng bộ thời gian máy chấm công thành công.');
    } catch (err: any) {
      this.logger.error(`Lỗi chạy Cron Job đồng bộ giờ: ${err.message || err}`);
    }
  }

  // 3. Cron Job đối soát tự động mỗi 5 phút cho ngày hôm nay
  // @Cron('*/5 * * * *')
  async handleAutoReconcileEvery5Minutes() {
    this.logger.log('Bắt đầu Cron Job đối soát tự động 5 phút/lần...');
    const today = new Date();
    const offset = 7 * 60 * 60 * 1000;
    const localTime = new Date(today.getTime() + offset);
    const dateString = localTime.toISOString().substring(0, 10); // YYYY-MM-DD

    try {
      const result = await this.reconcileUseCase.execute(dateString);
      this.logger.log(`Cron Job đối soát 5 phút hoàn tất. Đã xử lý ${result.eventsProcessed} sự kiện.`);
    } catch (err: any) {
      this.logger.error(`Lỗi chạy Cron Job đối soát 5 phút: ${err.message || err}`);
    }
  }
}
