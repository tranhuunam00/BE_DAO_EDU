import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TimekeepingDeviceOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/timekeeping-device.orm-entity';
import { HikvisionIsapiClient } from '../../infrastructure/external/hikvision-isapi.client';
import { ProcessRawLogUseCase } from './process-raw-log.use-case';
import { normalizeEmployeeNo } from '../../domain/services/timekeeping-matcher';

@Injectable()
export class ReconcileTimekeepingLogsUseCase {
  private readonly logger = new Logger(ReconcileTimekeepingLogsUseCase.name);

  constructor(
    @InjectRepository(TimekeepingDeviceOrmEntity)
    private readonly deviceRepository: Repository<TimekeepingDeviceOrmEntity>,
    private readonly processRawLogUseCase: ProcessRawLogUseCase,
    private readonly configService: ConfigService,
  ) {}

  async execute(date: string): Promise<{ success: boolean; eventsProcessed: number }> {
    const devices = await this.deviceRepository.find();
    let totalProcessed = 0;

    for (const device of devices) {
      const username = device.username || this.configService.get<string>('TIMEKEEPING_DEVICE_USERNAME') || 'admin';
      const password = device.password || this.configService.get<string>('TIMEKEEPING_DEVICE_PASSWORD') || '';
      const ip = device.ipAddress || this.configService.get<string>('TIMEKEEPING_DEVICE_IP') || '192.168.22.123';
      const port = device.port || this.configService.get<number>('TIMEKEEPING_DEVICE_PORT') || 80;

      const client = new HikvisionIsapiClient(`${ip}:${port}`, username, password);

      try {
        const payload = {
          AcsEventCond: {
            searchID: `reconcile-${date}-${Date.now()}`,
            searchResultPosition: 0,
            maxResults: 1000,
            startTime: `${date}T00:00:00+07:00`,
            endTime: `${date}T23:59:59+07:00`,
            major: 0,
            minor: 0,
            timeReverseOrder: true,
            isAttendanceInfo: true,
          },
        };

        const result = await client.request('POST', '/ISAPI/AccessControl/AcsEvent?format=json', payload);
        
        // Kiểm tra kết quả trả về từ Hikvision
        const infoList = result?.AcsEvent?.InfoList || [];
        for (const ev of infoList) {
          const rawEmployeeNo = ev.employeeNoString || ev.employeeNo;
          const timeStr = ev.time || ev.dateTime;
          
          if (!rawEmployeeNo || !timeStr) continue;

          const employeeNo = normalizeEmployeeNo(rawEmployeeNo);

          const minor = ev.subEventType || ev.minor;
          const cardNo = ev.cardNo || '';
          
          // Phân loại cách thức quét
          let verifyMethod = 'face';
          if (minor === 75 || minor === 77) verifyMethod = 'face';
          else if (minor === 38 || minor === 69) verifyMethod = 'fingerprint';
          else if (minor === 1 || minor === 2) verifyMethod = 'card';
          else if (minor === 57 || minor === 101) verifyMethod = 'pin';
          else if (cardNo && cardNo.trim() !== '') verifyMethod = 'card';

          const eventId = ev.eventID !== undefined && ev.eventID !== null
            ? String(ev.eventID)
            : (ev.eventId !== undefined && ev.eventId !== null
              ? String(ev.eventId)
              : undefined);

          try {
            await this.processRawLogUseCase.execute(
              employeeNo,
              new Date(timeStr),
              verifyMethod,
              ev,
              eventId
            );
            totalProcessed++;
          } catch (err: any) {
            // Log lỗi của từng học sinh nhưng không dừng cả tiến trình đối soát
            this.logger.error(`Lỗi đối khớp mã ${employeeNo}: ${err.message || err}`);
          }
        }

        device.status = 'online';
        device.lastSyncTime = new Date();
        await this.deviceRepository.save(device);
      } catch (err: any) {
        this.logger.error(`Lỗi kết nối thiết bị ${device.name} (${device.ipAddress}): ${err.message || err}`);
        device.status = 'offline';
        await this.deviceRepository.save(device);
      }
    }

    return { success: true, eventsProcessed: totalProcessed };
  }
}
