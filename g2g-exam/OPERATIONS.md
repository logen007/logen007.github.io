# G2G Thi thử — Sổ tay vận hành

## 1. Nguyên tắc

Production chạy trên VPS với Node.js + PostgreSQL. Không sửa trực tiếp điểm, lượt thi hoặc dữ liệu quyền trong database trừ khi đang xử lý sự cố có ghi nhận rõ ràng.

Code production lấy từ branch `main`. Mọi thay đổi trong `g2g-exam/` phải qua `G2G Exam Check` và được auto-deploy kiểm tra cú pháp trước khi build.

## 2. Trạng thái lượt thi

Luồng chuẩn:

`in_progress → grading → ready → published`

Bài chỉ có câu tự chấm:

`in_progress → ready → published`

Học viên bỏ lượt:

`in_progress → abandoned`

Học viên chỉ thấy điểm khi kết quả đã `published`.

## 3. Quyền

- **Student**: làm bài, xem lịch sử của chính mình.
- **Teacher**: tạo câu hỏi/bài thi; sửa nội dung mình sở hữu; chấm bài mình sở hữu hoặc được duyệt quyền chấm.
- **Master**: quản trị toàn hệ thống, tài khoản, thùng rác, cài đặt và công bố khi được phép theo nghiệp vụ.

Backend luôn kiểm tra lại quyền; không dựa vào việc ẩn/hiện nút ở frontend.

## 4. Dữ liệu nhạy cảm

- Google Client Secret, cookie secret, encryption key: chỉ trong `server/.env` trên VPS.
- PostgreSQL password: chỉ trong `.env` trên VPS.
- SMTP password/API key: được mã hóa trong PostgreSQL; frontend không đọc lại được plaintext.
- Đáp án đúng và điểm riêng tư chưa công bố không được gửi xuống state của học viên.

## 5. Deploy

Timer production: `g2g-auto-deploy.timer`.

Luồng:

`GitHub main → syntax check → Docker build/recreate G2G app → health check`

Không restart Traefik, n8n, Hermes hoặc các dịch vụ OtherBrick khi deploy G2G.

Health endpoint:

```text
https://exam.g2gcareer.com/api/health
```

## 6. Kiểm tra sau thay đổi lớn

1. Health API trả `ok:true` và `database:true`.
2. Google Login hoạt động.
3. Master vào được Cài đặt.
4. Tạo/sửa câu hỏi, upload audio.
5. Tạo/publish bài thi.
6. Student làm bài, reload giữa chừng, nộp bài.
7. Teacher chấm; kết quả chỉ hiện sau khi publish.
8. SMTP test và email kết quả hoạt động nếu đã bật.
9. Kiểm tra mobile và desktop.

## 7. Backup

Backup cả PostgreSQL và volume `g2g_uploads` trước migration hoặc thay đổi schema lớn.

## 8. Khi sửa code

Không dồn tính năng vào một file lớn. Chọn đúng module theo `ARCHITECTURE.md`; UI, domain, data access và backend action phải tách nhau. Nếu thêm một nhóm nghiệp vụ mới, tạo module mới thay vì mở rộng `app.js` hoặc `server/src/actions.js` thành monolith.
