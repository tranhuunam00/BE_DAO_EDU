import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TimekeepingDeviceOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/timekeeping-device.orm-entity';
import { HikvisionIsapiClient } from '../../infrastructure/external/hikvision-isapi.client';

@Injectable()
export class SyncDeviceTimeUseCase {
  constructor(
    @InjectRepository(TimekeepingDeviceOrmEntity)
    private readonly deviceRepository: Repository<TimekeepingDeviceOrmEntity>,
    private readonly configService: ConfigService,
  ) {}

  async execute(deviceId?: string): Promise<void> {
    const devices = deviceId 
      ? [await this.deviceRepository.findOne({ where: { id: deviceId } })]
      : await this.deviceRepository.find();

    if (devices.length === 0 || !devices[0]) {
      throw new NotFoundException('Không tìm thấy máy chấm công nào để đồng bộ thời gian.');
    }

    let successCount = 0;
    let lastError = '';

    const offset = 7 * 60 * 60 * 1000;
    const localTimeStr = new Date(Date.now() + offset).toISOString().replace(/\.\d+Z$/, ''); // YYYY-MM-DDTHH:mm:ss

    for (const device of devices) {
      if (!device) continue;

      const username = device.username || this.configService.get<string>('TIMEKEEPING_DEVICE_USERNAME') || 'admin';
      const password = device.password || this.configService.get<string>('TIMEKEEPING_DEVICE_PASSWORD') || '';
      const ip = device.ipAddress || this.configService.get<string>('TIMEKEEPING_DEVICE_IP') || '192.168.22.123';
      const port = device.port || this.configService.get<number>('TIMEKEEPING_DEVICE_PORT') || 80;

      const client = new HikvisionIsapiClient(`${ip}:${port}`, username, password);

      try {
        const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<Time xmlns="http://www.hikvision.com/ver20/XMLSchema" version="2.0">
  <timeMode>manual</timeMode>
  <localTime>${localTimeStr}</localTime>
  <timezone>CST-7</timezone>
</Time>`;

        await client.request('PUT', '/ISAPI/System/time', xmlPayload);
        successCount++;
        
        device.status = 'online';
        await this.deviceRepository.save(device);
      } catch (err: any) {
        lastError = err.message || 'Lỗi kết nối';
        device.status = 'offline';
        await this.deviceRepository.save(device);
      }
    }

    if (successCount === 0) {
      throw new BadRequestException(`Đồng bộ giờ thất bại. Chi tiết lỗi thiết bị: ${lastError}`);
    }
  }
}
