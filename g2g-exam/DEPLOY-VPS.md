# Triển khai G2G Exam trên VPS

Bản này không cần Firebase. Một container Node phục vụ cả frontend + REST API cùng domain; PostgreSQL lưu dữ liệu; audio lưu volume riêng; Google OAuth dùng trực tiếp; SMTP gửi từ VPS.

## VPS đang dùng chung

VPS hiện hữu đã có Traefik và n8n nên **không bind lại 80/443 và không restart dịch vụ cũ**. Trước khi triển khai, chạy script chỉ-đọc:

```bash
bash server/preflight-existing-vps.sh
```

Script kiểm tra container đang chạy, port 80/443/8787, network của Traefik, cấu hình Traefik và tình trạng n8n. Không stop/restart/remove container nào.

Sau khi xác định đúng Docker network và certificate resolver của Traefik, dùng `docker-compose.traefik.yml` để app G2G tham gia cùng network proxy nhưng giữ PostgreSQL trong network nội bộ riêng.

## 1. DNS/domain

Trỏ `exam.g2gcareer.com` về VPS. Với VPS dùng Traefik hiện hữu, ưu tiên route trực tiếp container qua `docker-compose.traefik.yml`; không cần mở thêm 80/443.

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

Không commit `server/.env`.

## 4. Chạy trên VPS dùng Traefik hiện hữu

Sau preflight, đặt các biến theo đúng Traefik đang chạy:

```bash
export POSTGRES_PASSWORD='MAT_KHAU_DB_RAT_DAI'
export TRAEFIK_NETWORK='TEN_NETWORK_TRAEFIK'
export TRAEFIK_CERTRESOLVER='TEN_CERT_RESOLVER'
export TRAEFIK_ENTRYPOINT='websecure'
export G2G_HOST='exam.g2gcareer.com'

docker compose -f docker-compose.traefik.yml up -d --build
```

Kiểm tra:

```bash
docker compose -f docker-compose.traefik.yml ps
docker compose -f docker-compose.traefik.yml logs --tail=100 app
curl -I https://exam.g2gcareer.com/api/health
```

Database schema tự tạo khi app khởi động. PostgreSQL không publish port ra host.

Nếu không dùng Traefik, file `docker-compose.vps.yml` vẫn có thể chạy app ở `127.0.0.1:8787` cho reverse proxy riêng.

## 5. Cấu hình SMTP

Đăng nhập bằng email nằm trong `MASTER_EMAILS` → **Quản trị cấp cao → Cài đặt**.

Điền Host, Port, STARTTLS/SSL, username, From, Reply-To. Nhập SMTP password/API key ở ô riêng và bấm **Cập nhật mật khẩu**. Mật khẩu được mã hóa AES-256-GCM trong PostgreSQL bằng `SETTINGS_ENCRYPTION_KEY`; frontend không thể đọc ngược lại.

Sau đó dùng **Gửi email thử**, rồi mới bật SMTP + email kết quả.

## 6. Backup

PostgreSQL:

```bash
docker compose -f docker-compose.traefik.yml exec -T postgres pg_dump -U g2g g2g_exam | gzip > g2g-exam-$(date +%F).sql.gz
```

Audio nằm ở Docker volume `g2g_uploads`; backup volume này cùng database.

## 7. Cập nhật phiên bản

```bash
git pull
docker compose -f docker-compose.traefik.yml up -d --build
```

Trước mỗi lần cập nhật nên backup database. Không thay đổi container/network/volume của n8n, Hermes hoặc các dịch vụ OtherBrick hiện hữu.

## 8. Kiểm tra trước pilot

1. Xác nhận n8n/Hermes/OtherBrick vẫn healthy trước và sau deploy.
2. Master đăng nhập Google.
3. Tạo Giáo viên và kiểm tra quyền.
4. Tạo câu hỏi + upload audio.
5. Tạo/publish bài thi.
6. Học viên đăng nhập Google, làm bài, reload giữa chừng, hết giờ, nộp bài.
7. Giáo viên chấm, Master/chủ bài công bố.
8. Kiểm tra email kết quả và retry khi SMTP lỗi.
9. Kiểm tra thi lại, bỏ lượt, maintenance mode.
10. Test mobile + desktop và backup DB + audio trước khi mở rộng người dùng.
