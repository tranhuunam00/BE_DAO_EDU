import { Test, TestingModule } from '@nestjs/testing';
import { TimekeepingWebhookController } from '../../../../src/presentation/controllers/timekeeping-webhook.controller';
import { ProcessRawLogUseCase } from '../../../../src/modules/timekeeping/application/use-cases/process-raw-log.use-case';
import { MinioService } from '../../../../src/infrastructure/storage/minio.service';
import { HttpStatus } from '@nestjs/common';
import { performance } from 'perf_hooks';

describe('TimekeepingWebhookController', () => {
  let controller: TimekeepingWebhookController;
  let processRawLogUseCase: jest.Mocked<ProcessRawLogUseCase>;
  let minioService: any;

  const mockProcessRawLogUseCase = {
    execute: jest.fn().mockResolvedValue([]),
  };

  const mockMinioService = {
    uploadFile: jest.fn().mockResolvedValue('mock-image-key'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimekeepingWebhookController],
      providers: [
        {
          provide: ProcessRawLogUseCase,
          useValue: mockProcessRawLogUseCase,
        },
        {
          provide: MinioService,
          useValue: mockMinioService,
        },
      ],
    }).compile();

    controller = module.get<TimekeepingWebhookController>(TimekeepingWebhookController);
    processRawLogUseCase = module.get(ProcessRawLogUseCase);
    minioService = module.get(MinioService);
    jest.clearAllMocks();
  });

  describe('handleWebhook - JSON Payload (application/json)', () => {
    it('nên xử lý thành công webhook gửi dữ liệu dạng JSON chuẩn có EventNotificationAlert', async () => {
      // Arrange
      const body = {
        EventNotificationAlert: {
          dateTime: '2026-08-11T17:15:30+07:00',
          subEventType: 75,
          eventID: 1024,
          AccessControllerEvent: {
            employeeNoString: 'STU-1080',
            cardNo: '12345678',
          },
        },
      };
      const req = {
        headers: {
          'content-type': 'application/json',
        },
      };

      // Act
      const result = await controller.handleWebhook(body, req);

      // Assert
      expect(result).toEqual({
        statusCode: 1,
        statusString: 'OK',
        subStatusCode: 'ok',
      });
      expect(processRawLogUseCase.execute).toHaveBeenCalledWith(
        'STU-1080',
        expect.any(Date),
        'face',
        body.EventNotificationAlert.AccessControllerEvent,
        '1024',
        undefined,
      );
    });

    it('nên xử lý thành công webhook gửi dữ liệu JSON không lồng EventNotificationAlert', async () => {
      // Arrange
      const body = {
        dateTime: '2026-08-11T17:15:30+07:00',
        subEventType: 1,
        eventId: 2048,
        AccessControllerEvent: {
          employeeNo: 'STU-1079',
          cardNo: '87654321',
        },
      };
      const req = {
        headers: {
          'content-type': 'application/json',
        },
      };

      // Act
      const result = await controller.handleWebhook(body, req);

      // Assert
      expect(result).toEqual({
        statusCode: 1,
        statusString: 'OK',
        subStatusCode: 'ok',
      });
      expect(processRawLogUseCase.execute).toHaveBeenCalledWith(
        'STU-1079',
        expect.any(Date),
        'card',
        body.AccessControllerEvent,
        '2048',
        undefined,
      );
    });
  });

  describe('handleWebhook - Multipart Payload (multipart/form-data)', () => {
    it('nên tự động trích xuất JSON và xử lý khi Hikvision gửi dữ liệu dạng multipart', async () => {
      // Arrange
      const boundary = 'boundary-12345';
      const multipartBody = 
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="event_log"; filename="event.json"\r\n` +
        `Content-Type: application/json\r\n\r\n` +
        JSON.stringify({
          EventNotificationAlert: {
            dateTime: '2026-08-11T17:15:30+07:00',
            subEventType: 38,
            eventId: 5000,
            AccessControllerEvent: {
              employeeNoString: 'STU-1078',
              cardNo: '',
            },
          },
        }) + `\r\n` +
        `--${boundary}--`;

      // Mock Req stream
      const reqMock: any = {
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from(multipartBody, 'utf-8'));
          }
          if (event === 'end') {
            callback();
          }
          return reqMock;
        }),
      };

      // Act
      const result = await controller.handleWebhook({}, reqMock);

      // Assert
      expect(result).toEqual({
        statusCode: 1,
        statusString: 'OK',
        subStatusCode: 'ok',
      });
      expect(processRawLogUseCase.execute).toHaveBeenCalledWith(
        'STU-1078',
        expect.any(Date),
        'fingerprint',
        expect.any(Object),
        '5000',
        undefined,
      );
    });

    it('nên trích xuất cả JSON và ảnh binary, upload lên MinIO và truyền imageKey vào usecase', async () => {
      // Arrange
      const boundary = 'boundary-12345';
      const jsonContent = JSON.stringify({
        EventNotificationAlert: {
          dateTime: '2026-08-11T17:15:30+07:00',
          subEventType: 75,
          eventId: 6000,
          AccessControllerEvent: {
            employeeNoString: 'STU-1077',
            cardNo: '',
          },
        },
      });
      const dummyImageBuffer = Buffer.from('fake-jpeg-image-binary-data');

      // Tạo multipart body thủ công chứa cả 2 phần: JSON và Ảnh binary
      const multipartBody = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from(`Content-Disposition: form-data; name="event_log"; filename="event.json"\r\n`),
        Buffer.from(`Content-Type: application/json\r\n\r\n`),
        Buffer.from(jsonContent),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from(`Content-Disposition: form-data; name="faceImage"; filename="face.jpg"\r\n`),
        Buffer.from(`Content-Type: image/jpeg\r\n\r\n`),
        dummyImageBuffer,
        Buffer.from(`\r\n--${boundary}--`),
      ]);

      // Mock Req stream
      const reqMock: any = {
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback(multipartBody);
          }
          if (event === 'end') {
            callback();
          }
          return reqMock;
        }),
      };

      // Act
      const result = await controller.handleWebhook({}, reqMock);

      // Assert
      expect(result).toEqual({
        statusCode: 1,
        statusString: 'OK',
        subStatusCode: 'ok',
      });
      expect(minioService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          mimetype: 'image/jpeg',
          buffer: dummyImageBuffer,
        }),
        'chamcong',
      );
      expect(processRawLogUseCase.execute).toHaveBeenCalledWith(
        'STU-1077',
        expect.any(Date),
        'face',
        expect.any(Object),
        '6000',
        'mock-image-key',
      );
    });
  });

  describe('handleWebhook - Edge Cases & Lỗi ngoại lệ', () => {
    it('không được gọi UseCase nhưng vẫn trả về OK khi thiếu employeeNo hoặc dateTime', async () => {
      // Arrange
      const body = {
        EventNotificationAlert: {
          subEventType: 75,
          AccessControllerEvent: {
            cardNo: '12345678', // Thiếu employeeNoString hoặc employeeNo
          },
        },
      };
      const req = {
        headers: {
          'content-type': 'application/json',
        },
      };

      // Act
      const result = await controller.handleWebhook(body, req);

      // Assert
      expect(result).toEqual({
        statusCode: 1,
        statusString: 'OK',
        subStatusCode: 'ok',
      });
      expect(processRawLogUseCase.execute).not.toHaveBeenCalled();
    });

    it('vẫn phải trả về OK (statusCode = 1) khi usecase xảy ra lỗi ngoại lệ để tránh treo hàng đợi của thiết bị', async () => {
      // Arrange
      const body = {
        EventNotificationAlert: {
          dateTime: '2026-08-11T17:15:30+07:00',
          AccessControllerEvent: {
            employeeNo: 'STU-1080',
          },
        },
      };
      const req = {
        headers: {
          'content-type': 'application/json',
        },
      };

      processRawLogUseCase.execute.mockRejectedValueOnce(new Error('Lỗi cơ sở dữ liệu kết nối'));

      // Act & Assert
      await expect(controller.handleWebhook(body, req)).resolves.toEqual({
        statusCode: 1,
        statusString: 'OK',
        subStatusCode: 'ok',
      });
      expect(processRawLogUseCase.execute).toHaveBeenCalled();
    });
  });

  describe('handleWebhook - Performance Benchmark', () => {
    it('phải hoàn thành việc parse và điều phối webhook trong giới hạn SLA < 2ms cho 100 lần chạy', async () => {
      // Arrange
      const body = {
        EventNotificationAlert: {
          dateTime: '2026-08-11T17:15:30+07:00',
          subEventType: 75,
          eventID: 9999,
          AccessControllerEvent: {
            employeeNoString: 'STU-1080',
          },
        },
      };
      const req = {
        headers: {
          'content-type': 'application/json',
        },
      };

      // Act & Benchmark
      const startTime = performance.now();
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        await controller.handleWebhook(body, req);
      }
      const duration = performance.now() - startTime;
      const avgDuration = duration / iterations;

      console.log(`[Webhook Controller Performance] Average execution time: ${avgDuration.toFixed(4)}ms`);

      // Assert SLA: < 2ms trung bình cho mỗi webhook request
      expect(avgDuration).toBeLessThan(2);
    });
  });
});
