# Backend PM2 release deployment

Mỗi lần push lên nhánh `master`, workflow chỉ deploy khi commit mới nhất chứa:

```text
release v
```

Ví dụ:

```bash
git commit -m "release v1.0.0"
git push origin master
```

## Chuẩn bị server một lần

Server Linux cần có Git, Node.js, npm, PM2, `curl` và `flock`.

```bash
npm install -g pm2
mkdir -p /var/www/dao-edu
cd /var/www/dao-edu
git clone https://github.com/tranhuunam00/BE_DAO_EDU.git
```

Tạo `/var/www/dao-edu/BE_DAO_EDU/.env` cho backend.

Chạy lần đầu:

```bash
cd /var/www/dao-edu/BE_DAO_EDU
bash scripts/deploy-pm2.sh master
pm2 startup
pm2 save
```

Nên đặt Nginx/Caddy để chuyển `/api` tới `127.0.0.1:5005`.

## GitHub Actions secrets

Cấu hình các Secret trên GitHub Repository để chạy CI/CD tự động:

1. **Repository Secrets (Dùng chung cho cả 2 môi trường)**:
   Vào *Settings ➡️ Secrets and variables ➡️ Actions*, thêm các Repository secrets sau:
   - `SSH_HOST`: IP hoặc hostname server.
   - `SSH_PORT`: cổng SSH, thường là `22`.
   - `SSH_USER`: user deploy.
   - `SSH_PRIVATE_KEY`: private key của user deploy.
   - `SSH_KNOWN_HOSTS`: kết quả `ssh-keyscan -H server.example.com`.

2. **Environment Secrets (Tách biệt cho Dev và Production)**:
   Để tránh việc merge nhánh làm ghi đè thư mục deploy, chúng ta cấu hình `DEPLOY_PATH` theo từng Môi trường (Environment):
   - Vào *Settings ➡️ Environments*, tạo 2 môi trường: **`development`** và **`production`**.
   - Trong môi trường **`development`**: Thêm biến `DEPLOY_PATH` là đường dẫn của Dev (ví dụ: `/root/BE_DAO_EDU` hoặc `/var/www/dao-edu/BE_DAO_EDU`).
   - Trong môi trường **`production`**: Thêm biến `DEPLOY_PATH` là đường dẫn của Production (ví dụ: `/root/master/BE_DAO_EDU`).

User deploy phải có quyền ghi repository backend và chạy PM2. Không commit `.env`, password database hoặc private key lên Git.

## Kiểm tra

```bash
pm2 status
pm2 logs dao-edu-production-api
```

Script dùng khóa `flock`, từ chối deploy khi tracked file trên server bị sửa,
chỉ fast-forward Git và kiểm tra HTTP sau khi reload.
