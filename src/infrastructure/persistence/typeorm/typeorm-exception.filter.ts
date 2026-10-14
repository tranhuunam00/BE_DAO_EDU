import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Injectable,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

@Injectable()
@Catch(QueryFailedError)
export class TypeOrmExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    console.error('[TypeOrmExceptionFilter] DB error:', exception.message, (exception as any).query);
    const code = (
      exception as QueryFailedError & {
        driverError?: { code?: string; constraint?: string };
      }
    ).driverError?.code;
    const response = host.switchToHttp().getResponse<{
      status: (status: number) => { json: (body: unknown) => void };
    }>();

    if (code === '23P01' || code === '23505') {
      response.status(409).json({
        statusCode: 409,
        message:
          code === '23P01'
            ? 'Trùng lịch: Phòng học hoặc giáo viên đã có lịch buổi học khác trong khung giờ này.'
            : 'Bản ghi này đã tồn tại trong hệ thống.',
      });
      return;
    }

    if (code === '22P02') {
      response.status(400).json({
        statusCode: 400,
        message: 'Định dạng mã ID không hợp lệ.',
      });
      return;
    }

    // Bắt lỗi từ các PostgreSQL Trigger bảo vệ dữ liệu (CANNOT_DELETE_SESSION, CANNOT_DELETE_ATTENDANCE)
    if (exception.message?.includes('CANNOT_DELETE_SESSION') || exception.message?.includes('CANNOT_DELETE_ATTENDANCE')) {
      const match = exception.message.match(/CANNOT_DELETE_[^:]+:\s*([^\n\r.]+)/);
      const userMessage = match ? match[1].trim() : exception.message;
      response.status(409).json({
        statusCode: 409,
        message: userMessage,
      });
      return;
    }

    response.status(500).json({
      statusCode: 500,
      message: 'Thao tác cơ sở dữ liệu thất bại. Vui lòng thử lại sau.',
    });
  }
}
