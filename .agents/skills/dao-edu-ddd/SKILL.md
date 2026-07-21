---
name: dao-edu-ddd
description: Hướng dẫn chuẩn về Domain-Driven Design (DDD) kết hợp với Test-Driven Development (TDD) và Performance Benchmarking áp dụng cho dự án Backend BE_DAO_EDU. Sử dụng khi thêm mới, tái cấu trúc hoặc bảo trì các Bounded Context, Entities, Value Objects, Aggregates, Domain Events, Domain Services, Use Cases, TDD Red-Green-Refactor, PERFORMANCE TEST BENCHMARK, USER TEST REVIEW bắt buộc và Persistence Adapters dưới thư mục src/modules.
---

# Hướng Dẫn Chuẩn Domain-Driven Design (DDD), TDD & Performance Test - Dự Án BE_DAO_EDU

Tài liệu này định nghĩa đầy đủ chuẩn mực thiết kế **Domain-Driven Design (DDD)** kết hợp quy trình **Test-Driven Development (TDD)**, **Performance Benchmark Testing** và **bắt buộc USER REVIEW KỊCH BẢN TEST** áp dụng cho hệ thống Backend NestJS của **DAO EDU**.

---

## 1. QUY TẮC BẮT BUỘC: VIẾT TEST TRƯỚC KHI CODE & TRÌNH USER REVIEW

> [!CAUTION]
> **QUY TẮC PHÁT TRIỂN BẮT BUỘC (MANDATORY WORKFLOW):**
> 1. **BẮT BUỘC VIẾT TEST TRƯỚC (TDD RED-FIRST)**: Khi thêm tính năng mới hoặc sửa bug, Agent **KHÔNG ĐƯỢC PHÉP** viết code xử lý nghiệp vụ trước. Phải viết file Unit Test (`.spec.ts`) trước.
> 2. **BẮT BUỘC CÓ KỊCH BẢN PERFORMANCE TEST BENCHMARK**: Đối với các thuật toán, domain services hoặc use cases xử lý danh sách/mảng dữ liệu lớn (như tính học phí, tạo lịch học, tổng hợp báo cáo), kịch bản test **BẮT BUỘC chứa bài test đo thời gian thực thi (Performance Benchmark với `performance.now()`)** để đảm bảo không bị nghẽn (bottleneck) hoặc quá thời gian phản hồi SLA cho phép.
> 3. **BẮT BUỘC TRÌNH USER REVIEW KỊCH BẢN TEST**: Sau khi viết xong kịch bản test (gồm cả logic đúng/sai và performance benchmark), Agent **BẮT BUỘC DỪNG LẠI**, trình bày danh sách các test case cho **USER REVIEW VÀ PHÊ DUYỆT**.
> 4. **CHỈ KHI USER PHÊ DUYỆT KỊCH BẢN TEST**: Agent mới được phép tiến hành viết code nghiệp vụ để pass bộ test!

---

## 2. Kiến Trúc Tầng (Layered Architecture) trong từng Bounded Context

Mỗi module trong `src/modules/<context>` tuân thủ nghiêm ngặt cấu trúc tầng sau:

```text
src/modules/<context>/
├── domain/                      # 1. TẦNG DOMAIN (Cốt lõi nghiệp vụ - Zero Dependencies - Pure Jest Tests)
│   ├── aggregates/              # Aggregates / Aggregate Roots (Gốc cụm thực thể)
│   ├── entities/                # Domain Entities (Gắn với danh tính ID)
│   ├── value-objects/           # Value Objects (Giá trị bất biến, tự validate)
│   ├── events/                  # Domain Events (Sự kiện nghiệp vụ đã xảy ra)
│   ├── services/                # Domain Services (Logic tính toán liên Entity/Aggregate)
│   └── errors/                  # Domain Errors (Lỗi nghiệp vụ đặc thù)
│
├── application/                 # 2. TẦNG APPLICATION (Điều phối luồng - Orchestration - Mock Port Tests)
│   ├── ports/                   # Interfaces / Abstract classes cho Persistence & External API
│   ├── event-handlers/          # Handlers xử lý Domain Events bất đồng bộ
│   └── use-cases/               # Use Case Classes (Điều phối luồng công việc)
│
├── infrastructure/              # 3. TẦNG INFRASTRUCTURE (Chi tiết kỹ thuật - Integration Tests)
│   ├── persistence/             # TypeORM Adapters, Repositories thực thi Ports
│   └── external/                # Triển khai kết nối Third-party (VietQR, MinIO, S3...)
│
└── presentation/                # 4. TẦNG PRESENTATION (Giao tiếp HTTP / REST - E2E Tests)
    └── controllers/             # NestJS Controllers, DTOs
```

---

## 3. Quy Trình 4 Bước TDD + Performance + DDD

```text
       ┌────────────────────────────────────────────────────────┐
       │   1. RED: Viết Spec Test (Chức năng + Performance)     │
       │    (Bao gồm bài test benchmark thời gian chạy SLA)     │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │   2. USER REVIEW: Trình Kịch Bản Test Cho User Duyệt   │
       │     (Dừng lại chờ User Phê Duyệt Danh Sách Test Cases) │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │      3. GREEN: Viết Code Nghiệp Vụ Tối Thống          │
       │  (Để toàn bộ test cases & SLA time limit chuyển PASS)  │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │          4. REFACTOR: Tối Ưu & Làm Sạch Code           │
       │      (Giữ tính Encapsulation, DRY, test vẫn PASS)       │
       └────────────────────────────────────────────────────────┘
```

---

## 4. Phân Tầng Test & Performance Benchmark

| Seam (Ranh giới Test) | Loại Test & Performance Target | Kỹ Thuật Test | SLA Time Limit |
| :--- | :--- | :--- | :--- |
| **Domain Logic** | Unit Test Invariants & Pure Benchmark | Pure Jest (Zero DB) | `< 10ms` cho 1,000 items |
| **Bulk Calculation** | Performance Benchmark (Vòng lặp lớn) | `performance.now()` | `< 50ms` cho 10,000 items |
| **Application Flow** | Use Case Orchestration & Mock Ports | Jest Mock Ports | `< 30ms` |
| **Persistence Query** | Integration & SQL Indexing Check | Test DB / Postgres | `< 100ms` cho 50,000 rows |

---

## 5. Ví Dụ Kịch Bản Performance Benchmark Trong Test File (`.spec.ts`)

```typescript
describe('BillingCalculator (Performance & Functional Spec)', () => {
  it('tính toán chính xác học phí cho 10,000 bản ghi điểm danh trong dưới 50ms (Performance Benchmark)', () => {
    // 1. Arrange: Khởi tạo dataset lớn 10,000 điểm danh
    const mockSources = Array.from({ length: 10000 }, (_, i) => ({
      id: `attendance-${i}`,
      ownerId: `student-${i % 500}`,
      ownerCode: `S${i}`,
      ownerName: `Học sinh ${i}`,
      ownerMobile: '0901234567',
      ownerStatus: 'Active',
      classId: `class-${i % 20}`,
      className: 'Lớp Tiếng Anh',
      courseName: 'Tiếng Anh Giao Tiếp',
      levelName: 'Level A1',
      courseLevelId: 'level-1',
      date: '2026-07-01',
    }));

    const pricings = [
      {
        courseLevelId: 'level-1',
        pricePerSession: 150000,
        teacherWagePerSession: 90000,
        taWagePerSession: 50000,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      },
    ];

    // 2. Act & Performance Measurement
    const startTime = performance.now();
    const orders = BillingCalculator.calculate(mockSources, pricings, 'pricePerSession');
    const executionTimeMs = performance.now() - startTime;

    // 3. Assert Functional
    expect(orders.length).toBe(500); // 500 học sinh độc lập

    // 4. Assert Performance SLA (< 50ms)
    expect(executionTimeMs).toBeLessThan(50);
  });
});
```

---

## 6. Các Thành Phần Cốt Lõi (DDD Building Blocks)

### 6.1. Domain Entity
- Có định danh duy nhất (`id`), đại diện cho đối tượng sống xuyên suốt hệ thống. Encapsulation, bảo vệ Invariants. **Zero dependencies**.

### 6.2. Value Object
- Không có ID, bất biến (Immutable), tự validate khi khởi tạo (`Money`, `BillingPeriod`).

### 6.3. Aggregate & Aggregate Root
- Cụm các Entity/VO liên quan chặt chẽ. Đảm bảo toàn vẹn dữ liệu qua Aggregate Root. 1 Repository cho 1 Aggregate Root.

### 6.4. Domain Events
- Sự kiện nghiệp vụ đã xảy ra (`TuitionPaidEvent`). Dùng để decoupling và kích hoạt side-effects (VietQR, Zalo, Audit Log).

### 6.5. Domain Service
- Logic tính toán liên Entity/Aggregate. Pure TypeScript function hoặc Stateless class.

### 6.6. Application Port & Use Case
- Application Port: Abstract interface cho DB/ngoại vi. Use Case: Điều phối luồng công việc.

---

## 7. Quy Tắc Vàng (Golden Rules & Anti-Patterns)

> [!IMPORTANT]
> 1. **Strict Test-First, Performance Benchmark & User Review**: BẮT BUỘC viết file `.spec.ts` (gồm cả logic + performance SLA benchmark) trước, TRÌNH USER REVIEW rồi mới được viết code triển khai.
> 2. **Zero-Dependency Domain**: Tầng `domain/` KHÔNG ĐƯỢC `import` bất kỳ thứ gì từ `@nestjs/...`, `typeorm`, hay tầng `infrastructure/`/`presentation/`.
> 3. **Phân biệt ORM Entity và Domain Entity**: `StudentAttendanceOrmEntity` (TypeORM DB table) KHÁC VỚI `StudentAttendance` (Domain Entity/VO).
> 4. **Không lọt Logic Nghiệp Vụ ra Controller**: Controller CHỈ nhận HTTP Request, gọi `UseCase.execute()`, và trả về HTTP Response.
> 5. **Giao tiếp giữa các Bounded Context**: Dùng **Application Port**, **Service Interface** hoặc **Domain Events**.

---

## 8. Checklist Bắt Buộc Khi Nhận Yêu Cầu Mới

- [ ] **Bước 1**: Đã tạo file `.spec.ts` viết bộ test case mô tả các kịch bản đúng/sai VÀ test performance benchmark chưa?
- [ ] **Bước 2**: Đã trình danh sách kịch bản test cho USER REVIEW và nhận phê duyệt chưa?
- [ ] **Bước 3**: Đã viết code triển khai tối thiểu để test PASS (Green) cả về chức năng lẫn thời gian SLA thực thi chưa?
- [ ] **Bước 4**: Tầng `domain/` có giữ được tính Zero-dependency (không import NestJS/TypeORM) không?
