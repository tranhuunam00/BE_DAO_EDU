import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import { NotificationLogOrmEntity } from '../persistence/typeorm/entities/notification-log.orm-entity';

const urlMap = [
  { path: '/students', label: 'học sinh', type: 'STUDENT' },
  { path: '/teachers', label: 'giáo viên', type: 'TEACHER' },
  { path: '/classes', label: 'lớp học', type: 'CLASS' },
  { path: '/courses', label: 'chương trình', type: 'COURSE' },
  { path: '/centers', label: 'trung tâm', type: 'CENTER' },
  { path: '/rooms', label: 'phòng học', type: 'ROOM' },
  { path: '/holidays', label: 'ngày nghỉ lễ', type: 'HOLIDAY' },
  { path: '/leaves', label: 'đơn xin nghỉ', type: 'LEAVE_REQUEST' },
  { path: '/assignments', label: 'bài tập', type: 'ASSIGNMENT' },
  { path: '/accounting', label: 'kế toán', type: 'ACCOUNTING' },
  { path: '/payments', label: 'giao dịch thanh toán', type: 'PAYMENT' },
  { path: '/study-materials', label: 'tài liệu học tập', type: 'STUDY_MATERIAL' },
];

function getActionLabel(method: string, label: string): string {
  switch (method) {
    case 'POST':
      return `Tạo mới ${label}`;
    case 'PUT':
    case 'PATCH':
      return `Cập nhật ${label}`;
    case 'DELETE':
      return `Xóa ${label}`;
    default:
      return `Thao tác ${label}`;
  }
}

function getEventType(method: string): string {
  switch (method) {
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return 'ACTION';
  }
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const { method, url, body, ip, user } = request;

    // Chỉ log các request thay đổi dữ liệu (POST, PUT, PATCH, DELETE)
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // Tránh loop vô hạn nếu thao tác trực tiếp với logs
    if (url.includes('/notifications/logs') || url.includes('/notifications')) {
      return next.handle();
    }

    // Tìm xem URL thuộc module nào
    const matched = urlMap.find((item) => url.includes(item.path));
    if (!matched) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: async () => {
          try {
            const userId = user?.sub || user?.id || null;
            if (!userId) return; // Chỉ log khi đã login

            // Đảm bảo không log password
            const sanitizedBody = { ...body };
            if (sanitizedBody.password) {
              sanitizedBody.password = '********';
            }

            const title = getActionLabel(method, matched.label);
            const eventType = getEventType(method);

            await this.dataSource
              .getRepository(NotificationLogOrmEntity)
              .save({
                notificationId: null,
                userId,
                eventType,
                notificationType: matched.type,
                title,
                metadata: {
                  url,
                  ip,
                  body: sanitizedBody,
                  statusCode: response.statusCode,
                },
              });
          } catch (e) {
            console.error('AuditLogInterceptor failed to save log:', e);
          }
        },
      }),
    );
  }
}
