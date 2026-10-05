# Triển khai G2G Exam trên VPS

Bản này không cần Firebase. Một container Node phục vụ cả frontend + REST API cùng domain; PostgreSQL lưu dữ liệu; audio lưu volume riêng; Google OAuth dùng trực tiếp; SMTP gửi từ VPS.

## 1. DNS/domain

Trỏ `exam.g2gcareer.com` về VPS. Reverse proxy (Nginx/Traefik/Cloudflare Tunnel) chuyển HTTPS vào `127.0.0.1:8787`.

## 2. Google OAuth

Google Cloud Console → OAuth Client loại Web application:

- Authorized JavaScript origin: `https://exam.g2gcareer.com`
- Authorized redirect URI: `https://exam.g2gcareer.com/api/auth/google/callback`

Lấy `Client ID` và `Client Secret` đưa vào `server/.env`. Secret chỉ nằm trên VPS, không xuất hiện trong frontend.

## 3. Biến môi trường

```bash
cd g2g-exam
cp server/.env.example server/.env
```

Điền tối thiểu:

- `PUBLIC_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `COOKIE_SECRET` (chuỗi ngẫu nhiên dài)
- `SETTINGS_ENCRYPTION_KEY` (chuỗi ngẫu nhiên dài khác; dùng mã hóa SMTP password)
- `MASTER_EMAILS` (email Google của Quản trị cấp cao đầu tiên)

Tạo file `.env` cùng cấp `docker-compose.vps.yml` hoặc export biến `POSTGRES_PASSWORD` trước khi chạy.

## 4. Chạy

```bash
export POSTGRES_PASSWORD='MAT_KHAU_DB_RAT_DAI'
docker compose -f docker-compose.vps.yml up -d --build
curl http://127.0.0.1:8787/api/health
```

Database schema tự tạo khi app khởi động. Không commit `server/.env`.

## 5. Cấu hình SMTP

Đăng nhập bằng email nằm trong `MASTER_EMAILS` → **Quản trị cấp cao → Cài đặt**.

Điền Host, Port, STARTTLS/SSL, username, From, Reply-To. Nhập SMTP password/API key ở ô riêng và bấm **Cập nhật mật khẩu**. Mật khẩu được mã hóa AES-256-GCM trong PostgreSQL bằng `SETTINGS_ENCRYPTION_KEY`; frontend không thể đọc ngược lại.

Sau đó dùng **Gửi email thử**, rồi mới bật SMTP + email kết quả.

## 6. Backup

PostgreSQL:

```bash
docker compose -f docker-compose.vps.yml exec -T postgres pg_dump -U g2g g2g_exam | gzip > g2g-exam-$(date +%F).sql.gz
```

Audio nằm ở Docker volume `g2g_uploads`; backup volume này cùng database.

## 7. Cập nhật phiên bản

```bash
git pull
docker compose -f docker-compose.vps.yml up -d --build
```

Trước mỗi lần cập nhật nên backup database. Bản GitHub Pages vẫn giữ chế độ demo/local; chỉ image VPS overlay `repository.js`, `settings.js`, `media.js` để dùng backend self-host.

## 8. Kiểm tra trước pilot

1. Master đăng nhập Google.
2. Tạo Giáo viên và kiểm tra quyền.
3. Tạo câu hỏi + upload audio.
4. Tạo/publish bài thi.
5. Học viên đăng nhập Google, làm bài, reload giữa chừng, hết giờ, nộp bài.
6. Giáo viên chấm, Master/chủ bài công bố.
7. Kiểm tra email kết quả và retry khi SMTP lỗi.
8. Kiểm tra thi lại, bỏ lượt, maintenance mode.
9. Test mobile + desktop.
10. Backup DB + audio trước khi mở rộng người dùng.
