---
name: max-500-lines-per-file
description: Quy chuẩn bắt buộc giới hạn 1 file không quá 500 dòng code trong DAO EDU. Sử dụng khi tạo mới, tái cấu trúc (refactor), tách component/use-case/adapter hoặc review chất lượng mã nguồn.
---

# Quy Chuẩn Giới Hạn Tối Đa 500 Dòng Cho Mỗi File (Max 500 Lines Per File)

## 1. Nguyên Tắc Cốt Lõi (Core Invariant)
* **Bắt buộc tuyệt đối**: Bất kỳ file mã nguồn nào trong hệ thống (`.ts`, `.tsx`, `.js`, `.jsx`, `.html`, `.css`) **không được phép vượt quá 500 dòng**.
* Nếu một file chạm ngưỡng hoặc có nguy cơ vượt quá 500 dòng, lập tức thực hiện phân tách thành các module/component/use case/helper nhỏ gọn, chuyên biệt (Single Responsibility Principle).

## 2. Chiến Lược Phân Tách Khi File Tiếp Cận 500 Dòng

### A. Đối với Backend (`BE_DAO_EDU`)
* **Controllers**: Tách các nhóm endpoint liên quan thành các controller phụ hoặc chuyển toàn bộ logic xử lý sang các **Use Cases** độc lập trong tầng `application/use-cases/`.
* **Use Cases**: Mỗi file Use Case chỉ đảm nhiệm **duy nhất 1 hành vi nghiệp vụ** (`Execute`).
* **Adapters & Repositories**: Tách các query phức tạp thành các Query Adapters riêng biệt (ví dụ: `TypeOrmReportsQueryAdapter`, `TypeOrmCoursePricingPersistenceAdapter`).
* **DTOs & Interfaces**: Đặt DTOs và Interfaces vào các file `*.dto.ts` và `*.port.ts` chuyên trách, không nhồi nhét chung vào Use Case hay Controller.
* **Test Files (`*.spec.ts`)**: Khi bộ test case lớn hơn 400 dòng, phân chia thành các file test theo từng danh mục hoặc module (ví dụ: `course-pricing-slicing.spec.ts`, `course-pricing-lock.spec.ts`).

### B. Đối với Frontend (`FE-Dao-EDU`)
* **Pages & Views**: Tách các Modals, Tabs, Timelines thành các component con trong thư mục `Components/` (ví dụ: `CourseDetailComponents/LevelPricingModal.tsx`, `StudentDetailTabs/TuitionTab.tsx`).
* **Utils & Helpers**: Tách các hàm tính toán, định dạng tiền tệ, múi giờ sang `src/utils/` (ví dụ: `src/utils/pricing.ts`).
* **Custom Hooks**: Tách logic gọi API, state pagination, form management ra custom hooks (`useLevelPricing.ts`).

## 3. Checklist Tự Động Rà Soát Trước Khi Hoàn Tất Task
1. Kiểm tra số dòng của tất cả file vừa tạo hoặc vừa sửa:
   ```bash
   # Đảm bảo không file nào > 500 dòng
   ```
2. Nếu phát hiện file $> 500$ dòng:
   - Bước 1: Trích xuất các helper/pure functions ra file `*.helper.ts` hoặc `*.util.ts`.
   - Bước 2: Tách các Sub-Components hoặc Sub-Use Cases.
   - Bước 3: Tái cấu trúc imports và chạy lại toàn bộ unit tests để xác nhận 100% Passed.
