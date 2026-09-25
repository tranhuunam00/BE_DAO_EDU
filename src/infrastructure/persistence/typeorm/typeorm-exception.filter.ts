import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

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
            ? 'Room or teacher schedule conflicts with another session.'
            : 'The requested record already exists.',
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

    response.status(500).json({
      statusCode: 500,
      message: 'Database operation failed.',
    });
  }
}
