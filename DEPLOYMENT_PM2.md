# Backend PM2 release deployment

Mỗi lần push lên nhánh `main`, workflow chỉ deploy khi commit mới nhất chứa:

```text
release v
```

Ví dụ:

```bash
git commit -m "release v1.0.0"
git push origin main
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
bash scripts/deploy-pm2.sh main
pm2 startup
pm2 save
```

Nên đặt Nginx/Caddy để chuyển `/api` tới `127.0.0.1:5000`.

## GitHub Actions secrets

Thêm các secret sau vào repository backend:

- `SSH_HOST`: IP hoặc hostname server.
- `SSH_PORT`: cổng SSH, thường là `22`.
- `SSH_USER`: user deploy không phải root.
- `SSH_PRIVATE_KEY`: private key của user deploy.
- `SSH_KNOWN_HOSTS`: kết quả `ssh-keyscan -H server.example.com`.
- `DEPLOY_PATH`: `/var/www/dao-edu/BE_DAO_EDU`.

User deploy phải có quyền ghi repository backend và chạy PM2. Không commit `.env`,
password database hoặc private key lên Git.

## Kiểm tra

```bash
pm2 status
pm2 logs dao-edu-api
```

Script dùng khóa `flock`, từ chối deploy khi tracked file trên server bị sửa,
chỉ fast-forward Git và kiểm tra HTTP sau khi reload.
