# G2G Thi thử tiếng Đức — Setup hiện tại

Production chạy hoàn toàn trên VPS:

- Frontend: HTML/CSS/ES modules do Node phục vụ cùng domain.
- API: Fastify/Node.js.
- Database: PostgreSQL.
- Đăng nhập: Google OAuth trực tiếp phía server.
- Email: SMTP/Nodemailer trực tiếp từ VPS.
- Audio: Docker volume cục bộ.
- HTTPS/reverse proxy: Traefik hiện hữu.

Domain production: `https://exam.g2gcareer.com`.

## 1. Cấu hình bí mật

Tạo `server/.env` từ `server/.env.example`. Các giá trị nhạy cảm chỉ nằm trên VPS, không commit lên GitHub.

Cần có tối thiểu:

- `PUBLIC_URL=https://exam.g2gcareer.com`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI=https://exam.g2gcareer.com/api/auth/google/callback`
- `COOKIE_SECRET`
- `SETTINGS_ENCRYPTION_KEY`
- `MASTER_EMAILS`

File `.env` ở root project chứa biến Docker như `POSTGRES_PASSWORD`.

## 2. Google OAuth

OAuth Client loại **Web application**:

- Authorized JavaScript origin: `https://exam.g2gcareer.com`
- Authorized redirect URI: `https://exam.g2gcareer.com/api/auth/google/callback`

Google Login được xử lý trong `server/src/auth.js`. Client Secret không xuất hiện ở frontend.

## 3. Chạy production

VPS đang dùng Traefik hiện hữu nên dùng:

```bash
cd /opt/g2g-source/g2g-exam
docker compose -f docker-compose.traefik.yml up -d --build
```

Health check:

```bash
curl -sS https://exam.g2gcareer.com/api/health
```

PostgreSQL không publish port ra Internet.

## 4. Auto deploy

Production checkout ở `/opt/g2g-source`. Timer `g2g-auto-deploy.timer` kiểm tra branch `main` định kỳ. Khi `g2g-exam/` thay đổi, VPS tự cập nhật source, build lại app G2G và chạy health check.

Không sửa code tracked trực tiếp trên VPS vì lần deploy kế tiếp sẽ đồng bộ lại từ GitHub. Secrets `.env` vẫn nằm riêng trên VPS.

## 5. SMTP

Đăng nhập bằng tài khoản Master → **Cài đặt**:

1. Điền Host, Port, Security, Username, From, Reply-To.
2. Nhập mật khẩu/API key và bấm **Cập nhật mật khẩu**.
3. Bấm **Gửi email thử**.
4. Khi test thành công mới bật SMTP và email kết quả.

SMTP password được mã hóa AES-256-GCM trong PostgreSQL bằng `SETTINGS_ENCRYPTION_KEY`.

## 6. Backup

Database:

```bash
docker compose -f docker-compose.traefik.yml exec -T postgres pg_dump -U g2g g2g_exam | gzip > g2g-exam-$(date +%F).sql.gz
```

Audio nằm trong Docker volume `g2g_uploads` và cần được backup cùng database.

## 7. Kiểm thử

```bash
cd g2g-exam
npm test
sh server/check-code.sh
```

GitHub Actions workflow `G2G Exam Check` chạy lại các kiểm thử khi project thay đổi.

Xem `ARCHITECTURE.md` để biết module nào cần sửa cho từng tính năng.
