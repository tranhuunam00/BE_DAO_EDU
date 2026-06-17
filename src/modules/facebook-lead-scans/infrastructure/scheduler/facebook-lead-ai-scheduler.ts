import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProcessPendingFacebookLeadScansUseCase } from '../../application/use-cases/process-pending-facebook-lead-scans.use-case';

@Injectable()
export class FacebookLeadAiScheduler {
  private readonly logger = new Logger(FacebookLeadAiScheduler.name);
  private isRunning = false;

  constructor(
    private readonly processPendingScans: ProcessPendingFacebookLeadScansUseCase,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    if (this.isRunning) {
      this.logger.warn('Previous AI classification cron run is still active. Skipping this iteration to prevent overlap.');
      return;
    }

    this.isRunning = true;
    try {
      this.logger.log('Executing Facebook Lead AI classification cron job...');
      await this.processPendingScans.execute();
    } catch (error) {
      this.logger.error('Error occurred during Facebook Lead AI classification cron job execution:', error);
    } finally {
      this.isRunning = false;
    }
  }
}
