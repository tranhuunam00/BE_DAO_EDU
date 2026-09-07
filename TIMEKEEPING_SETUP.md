# Hướng Dẫn Kết Nối Máy Chấm Công Nội Bộ (LAN) Với Server Backend (Cloud)

Tài liệu này hướng dẫn cách kết nối và đồng bộ dữ liệu từ máy chấm công vân tay/khuôn mặt (nằm ở mạng LAN nội bộ nhà/văn phòng) với Server Backend DAO EDU đang triển khai trên Cloud (mạng Internet công cộng).

---

## 🚨 Vấn Đề Thực Tế
*   **Máy chấm công** thông thường có địa chỉ IP nội bộ (LAN) dạng `192.168.1.x` hoặc `192.168.22.x`.
*   **Server Backend** chạy trên Cloud (ví dụ: IP `103.90.227.173`).
*   Server Cloud nằm ngoài Internet **không thể truy cập trực tiếp** vào IP nội bộ `192.168.x.x` ở nhà hay văn phòng của bạn. Nếu cố tình gọi, Backend sẽ báo lỗi `fetch failed` hoặc `Lỗi kết nối`.

---

## 🛠️ Giải Pháp 1: Sử Dụng Pinggy Qua SSH (Dễ nhất - Không cần cài đặt)
Pinggy cho phép tạo một đường hầm (tunnel) công khai từ Internet trỏ thẳng vào IP máy chấm công nội bộ mà không cần cài đặt phần mềm hay đăng ký tài khoản.

### Bước 1: Chạy lệnh SSH trên máy tính nội bộ
Mở **PowerShell / CMD** (trên Windows) hoặc **Terminal** (trên macOS/Linux) của một máy tính đang kết nối cùng mạng Wi-Fi/LAN với máy chấm công, chạy lệnh:

```bash
ssh -o StrictHostKeyChecking=no -p 443 -R 80:<IP_MÁY_CHẤM_CÔNG>:80 free.pinggy.io
```
*(Thay thế `<IP_MÁY_CHẤM_CÔNG>` bằng IP thực tế của máy chấm công, ví dụ: `192.168.1.18`)*

### Bước 2: Lấy đường dẫn công khai
Sau khi chạy, màn hình terminal sẽ hiển thị các đường link công khai do Pinggy cấp, ví dụ:
*   `https://ambua-27-72-61-93.free.pinggy.net`
*   `https://yvaoj-27-72-61-93.run.pinggy-free.link`

*Lưu ý: Giữ nguyên cửa sổ Terminal này chạy ngầm trong suốt thời gian test. Nếu tắt đi, kết nối sẽ bị ngắt.*

### Bước 3: Cấu hình trên Web Admin
1.  Truy cập vào trang quản trị web của hệ thống.
2.  Vào phần **Máy chấm công** -> Chọn **Chỉnh sửa** thiết bị.
3.  Nhập thông tin:
    *   **Địa chỉ IP**: `ambua-27-72-61-93.free.pinggy.net` (Nhập domain Pinggy cấp, bỏ `https://` đi).
    *   **Cổng kết nối**: `80` (hoặc `443`).
4.  Bấm **Lưu** và tiến hành đồng bộ.

---

## 🛠️ Giải Pháp 2: Sử Dụng Ngrok (Ổn định hơn - Cần đăng ký tài khoản)
Ngrok là giải pháp đường hầm rất phổ biến và có độ ổn định cao.

### Bước 1: Cài đặt và cấu hình Ngrok
1.  Đăng ký tài khoản miễn phí tại [ngrok.com](https://ngrok.com).
2.  Tải Ngrok về máy tính (cùng mạng LAN với máy chấm công) và thiết lập authtoken theo hướng dẫn trên web của họ.
3.  Chạy lệnh tạo đường hầm trỏ tới IP máy chấm công:
    ```bash
    ngrok http <IP_MÁY_CHẤM_CÔNG>:80
    ```

### Bước 2: Cấu hình Web
1.  Copy đường link Ngrok cấp (ví dụ: `xxxx-xxxx.ngrok-free.app`).
2.  Cập nhật vào ô **Địa chỉ IP** của máy chấm công trên Web Admin (bỏ `https://`).
3.  Để cổng kết nối là `80` hoặc `443`.

---

## 🛠️ Giải Pháp 3: Cấu Hình Port Forwarding Trên Router (Dùng thực tế lâu dài)
Đây là cách thiết lập vĩnh viễn, không phụ thuộc vào máy tính trung gian.

1.  Truy cập vào trang cấu hình Router mạng tại văn phòng (ví dụ: `192.168.1.1`).
2.  Tìm mục **Port Forwarding / Virtual Server / NAT**.
3.  Tạo một bản ghi cấu hình:
    *   **External Port**: Cổng công khai (ví dụ: `8080`).
    *   **Internal IP**: IP máy chấm công (ví dụ: `192.168.1.18`).
    *   **Internal Port**: `80`.
    *   **Protocol**: `TCP`.
4.  Tra cứu IP công cộng hiện tại của văn phòng (truy cập [ip.me](https://ip.me) hoặc gõ "my ip" trên Google).
5.  Trên Web Admin, cấu hình thiết bị với:
    *   **Địa chỉ IP**: `<IP_Công_Cộng_Của_Văn_Phòng>` (ví dụ: `113.161.45.67`).
    *   **Cổng kết nối**: `<External_Port>` (ví dụ: `8080`).

---

## 💻 Giải Pháp 4: Chạy Toàn Bộ Dự Án Dưới Local
Nếu bạn là Lập trình viên đang phát triển tính năng:
1.  Khởi chạy Backend local: `npm run start:dev` (chạy ở cổng `5000`).
2.  Khởi chạy Frontend local: `npm run dev` (chạy ở cổng `5173`).
3.  Truy cập `http://localhost:5173`. Lúc này Backend đang chạy trên máy tính local của bạn nên có thể kết nối trực tiếp đến IP LAN `192.168.1.18:80`.
