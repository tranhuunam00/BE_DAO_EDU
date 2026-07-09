# HƯỚNG DẪN TRIỂN KHAI PRODUCTION (FE, BE, DB & MINIO)
Tài liệu này hướng dẫn chi tiết từng bước để thiết lập và khởi chạy toàn bộ hệ thống DAO EDU trên môi trường Production (Server Ubuntu/Linux), bao gồm:
1. Cơ sở dữ liệu **PostgreSQL 15** và Kho lưu trữ **MinIO** chạy qua Docker Compose.
2. **Backend (NestJS API)** chạy qua PM2.
3. **Frontend (React SPA)** chạy qua PM2 (serve) và được định tuyến qua **Nginx Reverse Proxy**.

---

## BƯỚC 1: CHUẨN BỊ MÔI TRƯỜNG SERVER

Đảm bảo server của bạn đã cài đặt các công cụ sau:
*   **Docker & Docker Compose**: Để chạy Postgres và MinIO.
*   **Node.js (Khuyến nghị v20.x hoặc v22.x LTS) & npm**: Để build & chạy dự án Node.
*   **PM2**: Quản lý tiến trình Node.js chạy ngầm (`npm install -g pm2`).
*   **Nginx**: Làm reverse proxy.
*   **Git**: Đồng bộ mã nguồn.

Cài đặt nhanh trên Ubuntu nếu chưa có:
```bash
sudo apt update
sudo apt install -y git curl nginx build-essential

# Cài đặt Node.js v20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Cài đặt PM2 toàn cục
sudo npm install -g pm2
```

---

## BƯỚC 2: CẤU HÌNH & CHẠY DOCKER INFRASTRUCTURE (DB & MINIO)

Hệ thống cơ sở dữ liệu và lưu trữ file được đóng gói sẵn trong thư mục `BE_DAO_EDU/infra`.

1. Di chuyển vào thư mục hạ tầng:
   ```bash
   cd /root/BE_DAO_EDU/infra
   ```
2. Tạo file cấu hình môi trường `.env` từ file ví dụ:
   ```bash
   cp .env.example .env
   ```
3. Chỉnh sửa nội dung file `.env` bằng công cụ soạn thảo (ví dụ: `nano .env`):
   *   **POSTGRES_PASSWORD**: Đổi thành một mật khẩu mạnh và an toàn.
   *   **MINIO_ROOT_PASSWORD**: Đổi thành mật khẩu quản trị MinIO mạnh (tối thiểu 8 ký tự).
   *   *(Lưu ý: Mặc định cổng Postgres được cấu hình là `5435` và MinIO API là `9005` để tránh trùng lặp với các dịch vụ khác có sẵn trên hệ thống của bạn).*

4. Khởi động các dịch vụ cơ sở dữ liệu & lưu trữ:
   ```bash
   docker compose up -d
   ```
5. Kiểm tra trạng thái hoạt động:
   ```bash
   docker compose ps
   ```

### Thiết lập ban đầu trên MinIO:

Bạn có thể cấu hình bằng một trong hai cách dưới đây:

#### CÁCH A: Thiết lập nhanh qua dòng lệnh (CLI)
Chạy trực tiếp các lệnh sau trên Server (các lệnh này chạy trình khách `mc` tích hợp sẵn trong container MinIO):
```bash
# 1. Đăng nhập/Liên kết client mc (Lưu ý bao bọc mật khẩu trong dấu nháy đơn '' nếu có ký tự đặc biệt như !)
docker exec -it dao-edu-infra_production-minio mc alias set myminio http://localhost:9000 <MINIO_ROOT_USER> '<MINIO_ROOT_PASSWORD>'

# 2. Tạo bucket tên là "edu"
docker exec -it dao-edu-infra_production-minio mc mb myminio/edu

# 3. Cấp quyền tải/đọc công khai (download) cho bucket "edu" để hiển thị tệp trên web/app
docker exec -it dao-edu-infra_production-minio mc anonymous set download myminio/edu
```
*(Nếu bạn đổi tên project docker compose khác, hãy kiểm tra lại tên container chạy thực tế bằng `docker ps` để thay thế cho chính xác).*

#### CÁCH B: Thiết lập qua giao diện Web (Web UI)
1. Truy cập vào giao diện quản trị Web của MinIO qua trình duyệt: `http://<IP_SERVER>:9009` (hoặc cổng cấu hình của bạn).
2. Đăng nhập bằng `MINIO_ROOT_USER` (mặc định: `minio_admin`) và mật khẩu `MINIO_ROOT_PASSWORD` bạn vừa cấu hình.
3. Vào mục **Buckets** -> chọn **Create Bucket**.
4. Tạo một bucket tên là: **`edu`** (bắt buộc đúng tên này).
5. Sau khi tạo xong, vào phần cấu hình của Bucket đó, đặt **Access Policy** từ `private` thành `public` hoặc `custom` (cho phép tải công khai).

---

## BƯỚC 3: CẤU HÌNH & TRIỂN KHAI BACKEND (BE)

1. Di chuyển vào thư mục Backend:
   ```bash
   cd /root/BE_DAO_EDU
   ```
2. Tạo file cấu hình `.env` cho Backend:
   ```bash
   cp .env.example .env
   ```
3. Chỉnh sửa file `.env` (`nano .env`) và thay thế các thông tin chính xác:
   ```env
    PORT=5005
    JWT_SECRET=Thay_Bang_Mot_Chuoi_Random_Sieu_Bao_Mat
    APP_VERSION=v1.0.0

    # CẤU HÌNH KẾT NỐI DATABASE (Khớp với thông tin ở Bước 2)
    DATABASE_HOST=127.0.0.1
    DATABASE_PORT=5436
    DATABASE_USER=dao_edu_admin
    DATABASE_PASSWORD=mat_khau_database_ban_da_dat_o_buoc_2
    DATABASE_NAME=dao_edu_db

    # CẤU HÌNH KẾT NỐI MINIO (Khớp với thông tin ở Bước 2)
    MINIO_ENDPOINT=127.0.0.1
    MINIO_PORT=9008
    MINIO_USE_SSL=false
    MINIO_ACCESS_KEY=minio_admin
    MINIO_SECRET_KEY=mat_khau_minio_ban_da_dat_o_buoc_2
    MINIO_BUCKET_NAME=edu

    # QUAN TRỌNG: Tên miền và cổng của MinIO ở môi trường mạng bên ngoài để sinh link tải file/ảnh
    MINIO_EXTERNAL_ENDPOINT=apiedu.home-care.vn:9008
    
    # CẤU HÌNH VIETQR (Nếu có)
    VIETQR_BANK_CODE=MB
    VIETQR_ACCOUNT_NUMBER=123456789
    VIETQR_ACCOUNT_NAME=CONG TY DAO GROUP
    VIETQR_DEMO_ENABLED=false
   ```
4. Cài đặt các gói thư viện và biên dịch (build) dự án:
   ```bash
   npm ci
   npm run build
   ```
5. Chạy cơ chế di cư dữ liệu để tạo cấu trúc bảng (Migrations):
   ```bash
   npm run migration:run
   ```
6. Khởi tạo tài khoản quản trị (ADMIN) duy nhất cho Production và xóa sạch dữ liệu demo:
   ```bash
   node scripts/init-prod-admin.js <email_admin_cua_ban> <mat_khau_admin_cua_ban> "Tên hiển thị Admin"
   ```
   *Ví dụ:*
   ```bash
   node scripts/init-prod-admin.js admin@daogroup.com TruongThanhCong2026! "DAO GROUP Admin"
   ```
7. Khởi động Backend bằng PM2:
   ```bash
   pm2 start ecosystem.config.cjs --env production
   pm2 save
   ```
8. Kiểm tra logs để đảm bảo Backend chạy không lỗi:
   ```bash
   pm2 logs dao-edu-production-api
   ```

---

## BƯỚC 4: CẤU HÌNH & TRIỂN KHAI FRONTEND (FE)

1. Di chuyển vào thư mục Frontend:
   ```bash
   cd /root/FE-Dao-EDU
   ```
2. Tạo file cấu hình môi trường `.env.production`:
   ```bash
   cp .env.production.example .env.production
   ```
3. Chỉnh sửa file `.env.production` (`nano .env.production`):
   ```env
    VITE_API_URL=http://apiedu.home-care.vn/api
    VITE_APP_VERSION=v1.0.0
    ```
    *(Nếu server chạy HTTPS, hãy sử dụng `https://apiedu.home-care.vn/api`)*

4. Cài đặt các thư viện và tiến hành build dự án:
   ```bash
   npm ci
   npm run build
   ```
   *Quá trình này sẽ tạo ra một thư mục tĩnh tên là `dist` chứa toàn bộ mã nguồn Frontend đã biên dịch tối ưu.*

5. Sử dụng PM2 để phục vụ ứng dụng Frontend (Single Page Application - SPA):
   ```bash
   # Triển khai trực tiếp file tĩnh qua PM2 serve ở cổng 5006
   pm2 serve dist 5006 --name dao-edu-production-web --spa
   pm2 save
   ```
6. Kiểm tra trạng thái các service qua PM2:
   ```bash
   pm2 status
   ```
    *Bạn sẽ thấy hai dịch vụ: `dao-edu-production-api` (BE) chạy cổng 5005 và `dao-edu-production-web` (FE) chạy cổng 5006.*

---

## BƯỚC 5: CẤU HÌNH NGINX REVERSE PROXY

Để người dùng truy cập trực tiếp qua cổng mặc định `80` (HTTP) hoặc `443` (HTTPS) thay vì gõ cổng `5000` hay `5001`, chúng ta cấu hình Nginx để điều phối yêu cầu:

1. Tạo file cấu hình Nginx mới:
   ```bash
   sudo nano /etc/nginx/sites-available/dao-edu-production
   ```
2. Dán nội dung cấu hình sau vào (thay thế địa chỉ IP/domain tương ứng):
   ```nginx
    # 1. Cấu hình Nginx cho Frontend (edu.home-care.vn)
    server {
        listen 80;
        server_name edu.home-care.vn;

        location / {
            proxy_pass http://127.0.0.1:5006;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }

    # 2. Cấu hình Nginx cho Backend API (apiedu.home-care.vn)
    server {
        listen 80;
        server_name apiedu.home-care.vn;

        location / {
            proxy_pass http://127.0.0.1:5005;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            
            # Cho phép tải file dung lượng lớn (Tài liệu học tập/Bài tập)
            client_max_body_size 50M;
        }
    }
   ```
3. Kích hoạt cấu hình mới và vô hiệu hóa cấu hình mặc định (nếu cần):
   ```bash
   sudo ln -sf /etc/nginx/sites-available/dao-edu-production /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   ```
4. Kiểm tra cú pháp cấu hình Nginx:
   ```bash
   sudo nginx -t
   ```
5. Khởi động lại dịch vụ Nginx để áp dụng thay đổi:
   ```bash
   sudo systemctl reload nginx
   ```

### BƯỚC 5.5: CẤU HÌNH SSL/HTTPS MIỄN PHÍ BẰNG CERTBOT (LET'S ENCRYPT)

Để bảo mật dữ liệu truyền tải và chạy API qua giao thức `https://`, hãy cài đặt SSL miễn phí cho tên miền của bạn:

1. Cài đặt Certbot và plugin Nginx:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```
2. Yêu cầu cấp chứng chỉ SSL và tự động cấu hình Nginx (thay thế bằng tên miền thực tế của bạn):
   ```bash
   sudo certbot --nginx -d apiedu.home-care.vn -d edu.home-care.vn
   ```
   *(Nhập Email và chọn `Y` để đồng ý các điều khoản. Certbot sẽ tự cấu hình SSL vào file `/etc/nginx/sites-available/dao-edu-production` và tự động thiết lập chuyển hướng từ HTTP sang HTTPS).*

3. **Lưu ý quan trọng sau khi có SSL**: 
   * Hãy quay lại **Bước 4.3** để cập nhật lại cấu hình Frontend `.env.production` sử dụng **`https://`**:
     ```env
     VITE_API_URL=https://apiedu.home-care.vn/api
     ```
   * Cần build lại Frontend để cập nhật đường dẫn mới: `npm run build && pm2 restart dao-edu-production-web`.
   * Kiểm tra tự động gia hạn SSL hàng tháng: `sudo certbot renew --dry-run`.

---

## BƯỚC 6: CẤU HÌNH FIREWALL (TƯỜNG LỬA)

Do hệ thống lưu trữ file **MinIO** sinh ra liên kết pre-signed tải ảnh/file trực tiếp thông qua cổng API của nó (`9005`), bạn cần đảm bảo cổng này có thể truy cập được từ bên ngoài:

```bash
# Mở cổng 80 (HTTP), 443 (HTTPS nếu có)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Mở cổng 9005 để người dùng tải lên/tải về tài liệu trực tiếp từ MinIO
sudo ufw allow 9005/tcp

# Reload firewall
sudo ufw reload
```

---

## MỘT SỐ LỆNH VẬN HÀNH THƯỜNG DÙNG

*   **Xem danh sách các dịch vụ đang chạy của PM2**:
    ```bash
    pm2 status
    ```
*   **Xem logs thời gian thực của ứng dụng**:
    ```bash
    pm2 logs dao-edu-production-api   # Backend
    pm2 logs dao-edu-production-web   # Frontend
    ```
*   **Khởi động lại/Dừng ứng dụng**:
    ```bash
    pm2 restart all
    pm2 stop all
    ```
*   **Xem logs của Database và MinIO**:
    ```bash
    cd /root/BE_DAO_EDU/infra
    docker compose logs -f
    ```
