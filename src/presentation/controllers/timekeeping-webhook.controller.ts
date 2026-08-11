import { Controller, Post, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ProcessRawLogUseCase } from '../../modules/timekeeping/application/use-cases/process-raw-log.use-case';

@Controller('attendance')
export class TimekeepingWebhookController {
  constructor(private readonly processRawLogUseCase: ProcessRawLogUseCase) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: any, @Req() req: any): Promise<any> {
    const contentType = req.headers['content-type'] || '';
    let alertData: any = null;

    if (contentType.includes('multipart')) {
      // Đọc raw stream của multipart body vì Express body-parser bỏ qua định dạng này
      const rawBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });
      const bodyStr = rawBody.toString('utf8');

      const match = contentType.match(/boundary=(.+)/);
      if (match) {
        const boundary = match[1].trim();
        const parts = bodyStr.split('--' + boundary);
        for (const part of parts) {
          if (part.includes('Content-Type: application/json')) {
            const jsonStart = part.indexOf('{');
            const jsonEnd = part.lastIndexOf('}') + 1;
            if (jsonStart !== -1 && jsonEnd !== -1) {
              try {
                alertData = JSON.parse(part.slice(jsonStart, jsonEnd));
              } catch (e) {
                // Bỏ qua lỗi parse
              }
              break;
            }
          }
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

          try {
            await this.processRawLogUseCase.execute(
              employeeNo,
              new Date(timeStr),
              verifyMethod,
              ev,
              eventId
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
