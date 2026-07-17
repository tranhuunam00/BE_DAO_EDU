# BE DAO EDU - Agent Instructions & Rules

Chào mừng bạn (Agent) đến với dự án Backend của DAO EDU. Dưới đây là các quy định và hướng dẫn chi tiết mà bạn bắt buộc phải tuân theo khi phát triển và bảo trì mã nguồn tại repo này.

---

## 1. QUY TẮC BẮT BUỘC (CRITICAL RULES)

*   **Quy tắc 500 dòng:** Một file code nguồn không được vượt quá **500 dòng**. Nếu file dài hơn, bạn bắt buộc phải tách nhỏ thành các component, use case, helper hoặc module độc lập.
*   **Quản lý phiên bản Git:** Cấm tự ý thực hiện `git commit` hoặc `git push` mã nguồn lên server. Chỉ chỉnh sửa, tối ưu hóa code và chạy các lệnh test/build tại local. Việc commit và push code sẽ do **USER** tự thực hiện.

---

## 2. KIẾN TRÚC MÃ NGUỒN (CLEAN ARCHITECTURE)

Dự án áp dụng kiến trúc **Clean Architecture** phân tầng toàn cục ở thư mục gốc `src/`. Các lớp được chia rõ ràng theo chiều hướng phụ thuộc từ trong ra ngoài:

1.  **Domain Layer (`src/domain/`):**
    *   Chứa Entities (`src/domain/entities/`), Value Objects (`src/domain/value-objects/`), và interfaces của Repositories (`src/domain/repositories/`).
    *   **Không** phụ thuộc vào bất kỳ thư viện hay framework bên ngoài nào (kể cả TypeORM hay NestJS).
2.  **Application Layer (`src/application/`):**
    *   Chứa Use Cases (`src/application/use-cases/`), Interfaces/Ports (`src/application/ports/`), và DTOs (`src/application/dtos/`).
    *   Chỉ phụ thuộc vào Domain Layer.
3.  **Infrastructure Layer (`src/infrastructure/`):**
    *   Chứa các Adapter triển khai Ports (ví dụ: TypeORM Repository Adapters trong `src/infrastructure/persistence/`), cấu hình Database, Security, Storage.
    *   Áp dụng kỹ năng `dao-edu-nestjs-typeorm` khi làm việc với TypeORM.
4.  **Presentation Layer (`src/presentation/`):**
    *   Chứa Controllers (`src/presentation/controllers/`), route HTTP, request validations.
    *   Áp dụng kỹ năng `dao-edu-clean-architecture` để duy trì đúng phân lớp.

*Lưu ý:* Các file trong `src/modules/` (ví dụ `students.module.ts`, `teachers.module.ts`...) chỉ đóng vai trò kết nối (wiring) các UseCase, Repository, Controller tương ứng của từng nghiệp vụ lại với nhau để NestJS khởi chạy, không chứa thư mục layer con.

---

## 3. QUY TRÌNH PHÁT TRIỂN MODULES & APIS

Khi nhận yêu cầu thêm hoặc sửa tính năng:
1.  **Nhật ký hoạt động (Audit Logs):** Toàn bộ API thay đổi dữ liệu (POST, PUT, PATCH, DELETE) đã được tích hợp ghi log tự động qua `AuditLogInterceptor` lưu vào bảng `notification_logs`. Khi thêm API mới, hãy đảm bảo đường dẫn API khớp với cấu hình trong interceptor để tự động ghi nhận log.
2.  **Validation:** Bắt buộc sử dụng NestJS `ValidationPipe` cùng với các decorator của `class-validator` trong các file DTO ở presentation layer.
3.  **Security & Permissions:** Luôn kiểm tra quyền truy cập thông qua `@UseGuards(JwtAuthGuard, RolesGuard)` và `@Roles(Role.ADMIN, ...)` để bảo vệ tài nguyên hệ thống. Áp dụng kỹ năng `dao-edu-security` để rà soát bảo mật.

---

## 4. KỸ NĂNG CỤ THỂ ĐƯỢC PHÂN CHIA (BE SKILLS MAP)

Khi làm việc trong repo này, hãy chủ động tham khảo các kỹ năng tương ứng trong thư mục `.agents/skills/`:
*   `dao-edu-clean-architecture`: Hướng dẫn duy trì ranh giới kiến trúc và chiều hướng phụ thuộc.
*   `dao-edu-nestjs-typeorm`: Cách thiết lập Repository adapter, TypeORM Entities, và quản lý Transaction.
*   `dao-edu-security`: Rà soát bảo mật, phân quyền và kiểm tra lỗ hổng API.

