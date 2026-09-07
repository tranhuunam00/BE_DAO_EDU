import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TimekeepingDeviceOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/timekeeping-device.orm-entity';
import { HikvisionIsapiClient } from '../../infrastructure/external/hikvision-isapi.client';

@Injectable()
export class ConfigureWebhookUseCase {
  constructor(
    @InjectRepository(TimekeepingDeviceOrmEntity)
    private readonly deviceRepository: Repository<TimekeepingDeviceOrmEntity>,
    private readonly configService: ConfigService,
  ) {}

  async execute(deviceId: string, serverIp: string, serverPort: number): Promise<void> {
    const device = await this.deviceRepository.findOne({ where: { id: deviceId } });
    if (!device) {
      throw new NotFoundException(`Không tìm thấy máy chấm công cấu hình có ID ${deviceId}.`);
    }

    const username = device.username || this.configService.get<string>('TIMEKEEPING_DEVICE_USERNAME') || 'admin';
    const password = device.password || this.configService.get<string>('TIMEKEEPING_DEVICE_PASSWORD') || '';
    const ip = device.ipAddress || this.configService.get<string>('TIMEKEEPING_DEVICE_IP') || '192.168.22.123';
    const port = device.port || this.configService.get<number>('TIMEKEEPING_DEVICE_PORT') || 80;

    const client = new HikvisionIsapiClient(`${ip}:${port}`, username, password);

    try {
      const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList xmlns="http://www.hikvision.com/ver20/XMLSchema" version="2.0">
  <HttpHostNotification>
    <id>1</id>
    <url>/api/attendance/webhook</url>
    <addressingFormatType>ipaddress</addressFormatType>
    <ipAddress>${serverIp}</ipAddress>
    <portNo>${serverPort}</portNo>
    <httpNotificationFormat>JSON</httpNotificationFormat>
  </HttpHostNotification>
</HttpHostNotificationList>`;

      await client.request('PUT', '/ISAPI/Event/notification/httpHosts/1', xmlPayload);
      
      device.status = 'online';
      await this.deviceRepository.save(device);
    } catch (err: any) {
      device.status = 'offline';
      await this.deviceRepository.save(device);
      throw new BadRequestException(`Cấu hình Webhook thất bại. Lỗi kết nối thiết bị: ${err.message || err}`);
    }
  }
}
