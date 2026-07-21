# BE DAO EDU - Agent Instructions & Rules

Chào mừng bạn (Agent) đến với dự án Backend của DAO EDU. Dưới đây là các quy định và hướng dẫn chi tiết mà bạn bắt buộc phải tuân theo khi phát triển và bảo trì mã nguồn tại repo này.

---

## 1. QUY TẮC BẮT BUỘC (CRITICAL RULES)

1.  **Quy tắc TDD, Performance Test & User Review (BẮT BUỘC STRICT TDD, PERFORMANCE BENCHMARK & USER TEST REVIEW):**
    *   Khi phát triển tính năng mới hoặc sửa lỗi (bug fix): Agent **BẮT BUỘC phải viết kịch bản Unit Test / Spec TRƯỚC khi viết code triển khai** (TDD Loop - Red before Green).
    *   **BẮT BUỘC CÓ KỊCH BẢN PERFORMANCE TEST (BENCHMARK)**: Đối với các hàm tính toán, dịch vụ xử lý dữ liệu lớn (Bulk operations, Session generation, Report aggregation, Billing calculation), kịch bản test **BẮT BUỘC phải chứa bài test đo thời gian thực thi (Performance Benchmark với `performance.now()`) và giới hạn thời gian chạy tối đa (SLA Time Limit)** để ngăn chặn bottleneck/lags.
    *   Sau khi viết xong bộ test case (dạng file `.spec.ts` gồm cả chức năng và performance), Agent **BẮT BUỘC dừng lại và trình cho USER REVIEW & Phê duyệt kịch bản test**.
    *   **CHỈ KHI USER ĐÃ REVIEW VÀ ĐỒNG Ý KỊCH BẢN TEST**, Agent mới được phép tiến hành viết code triển khai nghiệp vụ để pass test!

2.  **Quy tắc 500 dòng:**
    *   Một file code nguồn không được vượt quá **500 dòng**. Nếu file dài hơn, bạn bắt buộc phải tách nhỏ thành các component, use case, helper hoặc module độc lập.

3.  **Quản lý phiên bản Git:**
    *   Cấm tự ý thực hiện `git commit` hoặc `git push` mã nguồn lên server. Chỉ chỉnh sửa, tối ưu hóa code và chạy các lệnh test/build tại local. Việc commit và push code sẽ do **USER** tự thực hiện.

---

## 2. KIẾN TRÚC MÃ NGUỒN (CLEAN ARCHITECTURE & DDD)

Dự án áp dụng kiến trúc **Clean Architecture & Domain-Driven Design (DDD)** phân tầng toàn cục và trong từng module tại `src/modules/<context>`:

1.  **Domain Layer (`src/modules/<context>/domain/`):**
    *   Chứa Aggregates, Entities, Value Objects, Domain Events, Domain Services và Domain Errors.
    *   **Tuyệt đối KHÔNG** phụ thuộc vào bất kỳ thư viện hay framework bên ngoài nào (Zero dependencies - Không NestJS, không TypeORM).
2.  **Application Layer (`src/modules/<context>/application/`):**
    *   Chứa Use Cases (`use-cases/`), Interfaces/Ports (`ports/`), và Event Handlers (`event-handlers/`).
    *   Chỉ phụ thuộc vào Domain Layer.
3.  **Infrastructure Layer (`src/modules/<context>/infrastructure/`):**
    *   Chứa các Adapter triển khai Ports (TypeORM Persistence Adapters), kết nối Third-party (VietQR, MinIO, Storage...).
4.  **Presentation Layer (`src/modules/<context>/presentation/`):**
    *   Chứa Controllers, DTOs (`class-validator`), Guards, HTTP Routes.

---

## 3. QUY TRÌNH PHÁT TRIỂN MODULES & APIS (TDD + PERFORMANCE + DDD)

Khi nhận yêu cầu thêm hoặc sửa tính năng:
1.  **Bước 1 - TDD RED, PERFORMANCE BENCHMARK & USER REVIEW (Viết Test trước):** Viết file `.spec.ts` bao gồm test logic nghiệp vụ VÀ test performance benchmark với dataset lớn. Trình USER kịch bản test để review.
2.  **Bước 2 - GREEN (Viết Code):** Nhận phê duyệt từ USER $\rightarrow$ Viết code tối thiểu trong Domain / Use Case để test PASS cả chức năng và mốc thời gian performance.
3.  **Bước 3 - REFACTOR:** Làm sạch code, đảm bảo tính đóng gói (Encapsulation), duy trì test PASS 100% và đạt chuẩn Performance.
4.  **Nhật ký hoạt động (Audit Logs):** Toàn bộ API thay đổi dữ liệu (POST, PUT, PATCH, DELETE) phải đảm bảo khớp đường dẫn để ghi nhận log qua `AuditLogInterceptor`.
5.  **Security & Permissions:** Luôn kiểm tra quyền truy cập thông qua `@UseGuards(JwtAuthGuard, RolesGuard)` và `@Roles(Role.ADMIN, ...)`.

---

## 4. KỸ NĂNG CỤ THỂ ĐƯỢC PHÂN CHIA (BE SKILLS MAP)

Khi làm việc trong repo này, hãy chủ động tham khảo các kỹ năng tương ứng trong thư mục `.agents/skills/`:
*   `dao-edu-ddd`: Hướng dẫn chi tiết chuẩn Domain-Driven Design kết hợp TDD Red-Green-Refactor, Performance Benchmarking và User Test Review.
*   `dao-edu-clean-architecture`: Hướng dẫn duy trì ranh giới kiến trúc và chiều hướng phụ thuộc.
*   `dao-edu-nestjs-typeorm`: Cách thiết lập Repository adapter, TypeORM Entities, và quản lý Transaction.
*   `dao-edu-security`: Rà soát bảo mật, phân quyền và kiểm tra lỗ hổng API.
