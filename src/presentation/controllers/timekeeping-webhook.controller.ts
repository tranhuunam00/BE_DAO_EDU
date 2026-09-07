import { Controller, Post, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ProcessRawLogUseCase } from '../../modules/timekeeping/application/use-cases/process-raw-log.use-case';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { parseMultipartBuffer } from '../../infrastructure/utils/multipart-parser';
import { parseDeviceTime } from '../../modules/timekeeping/domain/services/timekeeping-matcher';


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
    console.log(`[Webhook] ===== NHẬN REQUEST WEBHOOK ĐIỂM DANH MỚI =====`);
    console.log(`[Webhook] Content-Type:`, contentType);
    
    let alertData: any = null;
    let imageBuffer: Buffer | null = null;

    if (contentType.includes('multipart')) {
      console.log(`[Webhook] Phát hiện dữ liệu dạng Multipart. Đang đọc stream dữ liệu...`);
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
          console.log(`[Webhook] Đã phân tách thành công ${parts.length} parts từ multipart body.`);
          for (const part of parts) {
            const partContentType = part.headers['content-type'] || '';
            const disposition = part.headers['content-disposition'] || '';

            if (partContentType.includes('application/json') || disposition.includes('name="event_log"')) {
              try {
                alertData = JSON.parse(part.data.toString('utf8'));
                console.log(`[Webhook] -> Đã trích xuất JSON event_log.`);
              } catch (e) {
                console.error(`[Webhook] -> Lỗi parse JSON event_log:`, e.message);
              }
            } else if (partContentType.includes('image/') || disposition.includes('name="faceImage"')) {
              imageBuffer = part.data;
              console.log(`[Webhook] -> Đã trích xuất file ảnh faceImage (${imageBuffer.length} bytes).`);
            }
          }
        } catch (e) {
          console.error(`[Webhook] -> Lỗi phân tích cú pháp Multipart buffer:`, e.message);
        }
      } else {
        console.warn(`[Webhook] -> Không tìm thấy boundary trong Content-Type multipart.`);
      }
    } else {
      console.log(`[Webhook] Nhận dữ liệu dạng JSON/XML thông thường.`);
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

          console.log(`[Webhook] -> Xử lý sự kiện: employeeNo=${employeeNo}, name=${ev.name || ev.employeeName || 'N/A'}, time=${timeStr}, verifyMethod=${verifyMethod}`);

          let imageKey: string | undefined;
          if (imageBuffer) {
            try {
              console.log(`[Webhook] -> Đang tiến hành upload ảnh lên MinIO...`);
              imageKey = await this.minioService.uploadFile({
                originalname: `attendance-${employeeNo}-${Date.now()}.jpg`,
                mimetype: 'image/jpeg',
                buffer: imageBuffer,
                size: imageBuffer.length,
              }, 'chamcong');
              console.log(`[Webhook] -> Upload MinIO thành công. imageKey = "${imageKey}"`);
            } catch (err) {
              console.error(`[Webhook] -> Lỗi upload ảnh lên MinIO:`, err.message);
            }
          } else {
            console.log(`[Webhook] -> Không nhận được ảnh đi kèm trong sự kiện.`);
          }

          try {
            console.log(`[Webhook] -> Đang gọi ProcessRawLogUseCase để lưu sự kiện vào Database...`);
            await this.processRawLogUseCase.execute(
              employeeNo,
              parseDeviceTime(timeStr),
              verifyMethod,
              ev,
              eventId,
              imageKey,
            );
            console.log(`[Webhook] -> Lưu database thành công.`);
          } catch (err) {
            console.error(`[Webhook] -> Lỗi lưu database:`, err.message);
          }
        } else {
          console.warn(`[Webhook] -> Bỏ qua sự kiện do thiếu employeeNo hoặc timeStr.`);
        }
      } else {
        console.warn(`[Webhook] -> JSON alertData không chứa AccessControllerEvent.`);
      }
    } else {
      console.warn(`[Webhook] -> Không nhận diện được dữ liệu alertData.`);
    }

    // Luôn trả về 200 OK với schema chuẩn của Hikvision
    return {
      statusCode: 1,
      statusString: 'OK',
      subStatusCode: 'ok',
    };
  }
}
