import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { StudentOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { TimekeepingDeviceOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/timekeeping-device.orm-entity';
import { HikvisionIsapiClient } from '../../infrastructure/external/hikvision-isapi.client';
import { normalizeEmployeeNo } from '../../domain/services/timekeeping-matcher';

@Injectable()
export class SyncStudentToDeviceUseCase {
  constructor(
    @InjectRepository(StudentOrmEntity)
    private readonly studentRepository: Repository<StudentOrmEntity>,

    @InjectRepository(TimekeepingDeviceOrmEntity)
    private readonly deviceRepository: Repository<TimekeepingDeviceOrmEntity>,
    private readonly configService: ConfigService,
  ) {}

  async execute(studentId: string): Promise<void> {
    const student = await this.studentRepository.findOne({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException(`Học sinh không tồn tại trên hệ thống.`);
    }

    const devices = await this.deviceRepository.find();
    if (devices.length === 0) {
      throw new BadRequestException('Không tìm thấy máy chấm công nào được cấu hình trong hệ thống.');
    }

    let successCount = 0;
    let lastError = '';

    for (const device of devices) {
      const username = device.username || this.configService.get<string>('TIMEKEEPING_DEVICE_USERNAME') || 'admin';
      const password = device.password || this.configService.get<string>('TIMEKEEPING_DEVICE_PASSWORD') || '';
      const ip = device.ipAddress || this.configService.get<string>('TIMEKEEPING_DEVICE_IP') || '192.168.22.123';
      const port = device.port || this.configService.get<number>('TIMEKEEPING_DEVICE_PORT') || 80;

      const client = new HikvisionIsapiClient(`${ip}:${port}`, username, password);

      try {
        const payload = {
          UserInfo: {
            employeeNo: normalizeEmployeeNo(student.studentId), // Sử dụng hàm chuẩn hóa trung gian
            name: `${student.lastName} ${student.firstName}`.trim().substring(0, 31), // Giới hạn ký tự thiết bị
            userType: 'normal',
            Valid: {
              enable: true,
              beginTime: '2026-01-01T00:00:00',
              endTime: '2036-12-31T23:59:59',
              timeType: 'local',
            },
            belongGroup: '1', // Nhóm mặc định
            doorRight: '1',    // Quyền ra vào cửa số 1
            RightPlan: [
              {
                doorNo: 1,
                planTemplateNo: '1', // Kế hoạch 24/7 mặc định
              },
            ],
          },
        };

        await client.request('PUT', '/ISAPI/AccessControl/UserInfo/SetUp?format=json', payload);
        successCount++;
        
        // Cập nhật trạng thái thiết bị thành online
        if (device.status !== 'online') {
          device.status = 'online';
          await this.deviceRepository.save(device);
        }
      } catch (err: any) {
        lastError = err.message || 'Lỗi kết nối';
        // Đánh dấu thiết bị offline nếu lỗi kết nối vật lý
        if (device.status !== 'offline') {
          device.status = 'offline';
          await this.deviceRepository.save(device);
        }
      }
    }

    if (successCount > 0) {
      student.isSyncedToDevice = true;
      await this.studentRepository.save(student);
    } else {
      throw new BadRequestException(`Đồng bộ thất bại. Chi tiết lỗi thiết bị: ${lastError}`);
    }
  }
}
