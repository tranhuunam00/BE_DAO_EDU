import { Controller, Post, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ProcessRawLogUseCase } from '../../modules/timekeeping/application/use-cases/process-raw-log.use-case';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { parseMultipartBuffer } from '../../infrastructure/utils/multipart-parser';

@Controller('attendance')
export class TimekeepingWebhookController {
  constructor(
    private readonly processRawLogUseCase: ProcessRawLogUseCase,
    private readonly minioService: MinioService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: any, @Req() req: any): Promise<any> {
    const contentType = req.headers['content-type'] || '';
    let alertData: any = null;
    let imageBuffer: Buffer | null = null;

    if (contentType.includes('multipart')) {
      // Đọc raw stream của multipart body vì Express body-parser bỏ qua định dạng này
      const rawBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });

      const match = contentType.match(/boundary=(.+)/);
      if (match) {
        const boundary = match[1].trim();
        try {
          const parts = parseMultipartBuffer(rawBody, boundary);
          for (const part of parts) {
            const partContentType = part.headers['content-type'] || '';
            const disposition = part.headers['content-disposition'] || '';

            if (partContentType.includes('application/json') || disposition.includes('name="event_log"')) {
              try {
                alertData = JSON.parse(part.data.toString('utf8'));
              } catch (e) {
                // Bỏ qua lỗi parse
              }
            } else if (partContentType.includes('image/') || disposition.includes('name="faceImage"')) {
              imageBuffer = part.data;
            }
          }
        } catch (e) {
          // Bỏ qua lỗi parse multipart
        }
      }
    } else {
      alertData = body;
    }

    if (alertData) {
      const alert = alertData.EventNotificationAlert || alertData;
      if (alert.AccessControllerEvent) {
        const ev = alert.AccessControllerEvent;
        const employeeNo = ev.employeeNoString || ev.employeeNo;
        const timeStr = alert.dateTime || ev.time;

        if (employeeNo && timeStr) {
          const minor = alert.subEventType || ev.subEventType;
          const cardNo = ev.cardNo || '';
          const eventId = alert.eventID !== undefined && alert.eventID !== null
            ? String(alert.eventID)
            : (alert.eventId !== undefined && alert.eventId !== null
              ? String(alert.eventId)
              : (ev.eventID !== undefined && ev.eventID !== null
                ? String(ev.eventID)
                : (ev.eventId !== undefined && ev.eventId !== null
                  ? String(ev.eventId)
                  : undefined)));

          let verifyMethod = 'face';
          if (minor === 75 || minor === 77) verifyMethod = 'face';
          else if (minor === 38 || minor === 69) verifyMethod = 'fingerprint';
          else if (minor === 1 || minor === 2) verifyMethod = 'card';
          else if (minor === 57 || minor === 101) verifyMethod = 'pin';
          else if (cardNo && cardNo.trim() !== '') verifyMethod = 'card';

          let imageKey: string | undefined;
          if (imageBuffer) {
            try {
              imageKey = await this.minioService.uploadFile({
                originalname: `attendance-${employeeNo}-${Date.now()}.jpg`,
                mimetype: 'image/jpeg',
                buffer: imageBuffer,
                size: imageBuffer.length,
              }, 'chamcong');
            } catch (err) {
              // Bỏ qua lỗi upload MinIO để đảm bảo log chấm công vẫn được ghi nhận
            }
          }

          try {
            await this.processRawLogUseCase.execute(
              employeeNo,
              new Date(timeStr),
              verifyMethod,
              ev,
              eventId,
              imageKey,
            );
          } catch (err) {
            // Log error but make sure to return 200 to Hikvision terminal
          }
        }
      }
    }

    // Luôn trả về 200 OK với schema chuẩn của Hikvision
    return {
      statusCode: 1,
      statusString: 'OK',
      subStatusCode: 'ok',
    };
  }
}
