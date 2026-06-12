# HƯỚNG DẪN TRIỂN KHAI CƠ SỞ DỮ LIỆU & STORAGE BẢO MẬT (POSTGRESQL & MINIO)

Thư mục này chứa cấu hình Docker Compose để triển khai **PostgreSQL 15** và **MinIO Object Storage** (lưu trữ tương thích S3) được thiết kế theo các tiêu chuẩn bảo mật nâng cao (Security Hardening).

---

## 1. Yêu cầu hệ thống trên Server

Server của bạn cần cài đặt sẵn **Docker** và **Docker Compose v2** (được tích hợp sẵn trong lệnh `docker compose`).

Nếu chưa cài đặt trên Ubuntu/Debian, hãy chạy nhanh các lệnh sau:
```bash
# Cập nhật danh sách gói
sudo apt-get update

# Cài đặt Docker
sudo apt-get install -y docker.io docker-compose-plugin

# Khởi động Docker và kích hoạt chạy cùng hệ thống
sudo systemctl enable --now docker

# Thêm user hiện tại vào group docker để không cần gõ sudo (tùy chọn)
sudo usermod -aG docker $USER
# (Sau đó logout và login lại hoặc chạy lệnh `newgrp docker` để áp dụng)
```

---

## 2. Các bước triển khai nhanh (Quick Deployment)

### Bước 1: Sao chép thư mục lên Server
Nén thư mục `infra` này và sao chép lên server bằng lệnh `scp` hoặc qua SFTP:
```bash
scp -r ./infra user@your_server_ip:/home/user/dao-edu-infra
```

### Bước 2: Thiết lập file cấu hình môi trường (.env)
Truy cập vào thư mục trên server và tạo file `.env` từ file mẫu:
```bash
cd /home/user/dao-edu-infra
cp .env.example .env
```

Sử dụng trình chỉnh sửa (ví dụ: `nano .env`) để điền mật khẩu mạnh của bạn:
- Thay đổi `POSTGRES_PASSWORD` thành một chuỗi ngẫu nhiên dài (tối thiểu 16 ký tự).
- Thay đổi `MINIO_ROOT_PASSWORD` tương tự.
- *Mẹo tạo mật khẩu ngẫu nhiên trên Linux:* `openssl rand -base64 24`

### Bước 3: Khởi chạy các dịch vụ
Khởi chạy hệ thống ở chế độ chạy ngầm (detached mode):
```bash
docker compose up -d
```

### Bước 4: Kiểm tra trạng thái hoạt động
```bash
# Xem danh sách container và tình trạng healthcheck
docker compose ps

# Xem log hoạt động của hệ thống
docker compose logs -f
```

---

## 3. Kiến trúc bảo mật & Hướng dẫn kết nối an toàn

### 🔐 3.1. Kết nối PostgreSQL an toàn qua SSH Tunneling (Khuyên dùng)
Trong file `docker-compose.yml`, cổng PostgreSQL được thiết lập chỉ lắng nghe trên cổng `5435` của giao diện mạng cục bộ server (`127.0.0.1`) để tránh xung đột cổng `5432` mặc định (nếu đã có DB chạy trên server).

Để kết nối bằng các công cụ quản trị Database từ máy cá nhân của bạn (DBeaver, TablePlus, pgAdmin, v.v.):
1. Chạy lệnh tạo đường hầm SSH từ terminal máy cá nhân của bạn:
   ```bash
   # Tạo đường hầm: Ánh xạ cổng 5433 của máy bạn về cổng 5435 trên localhost của server
   ssh -N -L 5433:127.0.0.1:5435 user@your_server_ip
   ```
2. Trên công cụ kết nối DB (DBeaver / TablePlus):
   - **Host:** `localhost` (hoặc `127.0.0.1`)
   - **Port:** `5433` (cổng cục bộ bạn vừa forward sang)
   - **User / Password / Database:** Điền đúng thông tin trong file `.env` trên server.

---

### 🌐 3.2. Cấu hình HTTPS (SSL/TLS) cho MinIO và MinIO Console
Vì MinIO truyền tải tệp tin và thông tin đăng nhập, việc chạy HTTP trực tiếp rất không an toàn. Bạn nên cấu hình một Reverse Proxy có SSL như **Nginx** hoặc **Caddy** đứng trước MinIO.

#### Tùy chọn A: Sử dụng Caddy (Khuyên dùng vì tự động gia hạn SSL miễn phí)
Caddy tự động đăng ký và gia hạn SSL từ Let's Encrypt/ZeroSSL cực kỳ đơn giản.

Tạo file `Caddyfile` trên server của bạn:
```caddy
# Domain hoặc Subdomain cho API MinIO
s3.yourdomain.com {
    reverse_proxy 127.0.0.1:9005
}

# Domain hoặc Subdomain cho Giao diện quản trị MinIO Console
minio-admin.yourdomain.com {
    reverse_proxy 127.0.0.1:9006
}
```

#### Tùy chọn B: Sử dụng Nginx
Nếu bạn đã quen thuộc với Nginx, hãy tạo cấu hình Virtual Host:

```nginx
# Cấu hình cho API MinIO (s3.yourdomain.com)
server {
    listen 80;
    listen [::]:80;
    server_name s3.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name s3.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/s3.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/s3.yourdomain.com/privkey.pem;

    # Tối ưu hóa cho truyền tải file lớn
    client_max_body_size 50M;
    proxy_buffering off;
    proxy_request_buffering off;

    location / {
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 300;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        chunked_transfer_encoding on;

        proxy_pass http://127.0.0.1:9005;
    }
}

# Cấu hình cho Console MinIO (minio-admin.yourdomain.com)
server {
    listen 80;
    server_name minio-admin.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name minio-admin.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/minio-admin.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/minio-admin.yourdomain.com/privkey.pem;

    location / {
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        proxy_http_version 1.1;
        
        proxy_pass http://127.0.0.1:9006;
    }
}
```

---

## 4. Sao lưu và Khôi phục dữ liệu (Backup & Restore)

### 📊 4.1. Sao lưu PostgreSQL
Tạo file sao lưu dạng nén `.sql.gz` từ container đang chạy:
```bash
docker compose exec postgres pg_dump -U dao_edu_admin -d dao_edu_db | gzip > backup_$(date +%F_%H-%M-%S).sql.gz
```

Khôi phục dữ liệu từ file backup:
```bash
gunzip < backup_file.sql.gz | docker compose exec -T postgres psql -U dao_edu_admin -d dao_edu_db
```

### 📂 4.2. Sao lưu dữ liệu tệp tin của MinIO
Dữ liệu của MinIO được ánh xạ an toàn thông qua docker volume. Bạn chỉ cần sao lưu thư mục volume trên Host:
```bash
# Thư mục dữ liệu mặc định nằm tại đường dẫn Docker volumes của hệ thống
# Thường là: /var/lib/docker/volumes/dao-edu-infra-minio-data/_data
```
Hoặc dùng các công cụ đồng bộ dữ liệu như `rclone` hay MinIO Client (`mc`) để đồng bộ dữ liệu sang một máy chủ lưu trữ dự phòng khác định kỳ.
