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

Backend luôn kiểm tra lại quyền; không dựa vào việc ẩn/hiện nút ở frontend. Khôi phục dữ liệu từ Thùng rác và xóa vĩnh viễn được kiểm tra lại ở server.

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

## 6. Dọn rác

Database dùng **soft delete** cho bài thi/câu hỏi/cụm câu hỏi. Không tự động purge dữ liệu nghiệp vụ vì có thể liên quan bảng điểm hoặc lịch sử thi; Master quyết định restore/xóa vĩnh viễn.

Media upload trong `/data/uploads` được garbage collector tự quét. File không còn được bất kỳ dữ liệu nào tham chiếu và đã cũ hơn grace period mới bị xóa. Mặc định:

- `MEDIA_GC_ENABLED=true`
- `MEDIA_GC_GRACE_HOURS=24`
- `MEDIA_GC_INTERVAL_HOURS=6`

Không đặt grace period quá ngắn vì file vừa upload có thể chưa kịp gắn vào bản nháp.

## 7. Kiểm tra sau thay đổi lớn

1. Health API trả `ok:true` và `database:true`.
2. Google Login hoạt động khi bật lại OAuth.
3. Master vào được Cài đặt.
4. Tạo/sửa câu hỏi, upload audio/hình.
5. Tạo/publish bài thi.
6. Student làm bài, reload giữa chừng, nộp bài.
7. Teacher chấm; kết quả chỉ hiện sau khi publish.
8. SMTP test và email kết quả hoạt động nếu đã bật.
9. Kiểm tra mobile và desktop.

## 8. Backup

Backup cả PostgreSQL và volume `g2g_uploads` trước migration hoặc thay đổi schema lớn. Garbage collector không thay thế backup.

## 9. Khi sửa code

Không dồn tính năng vào một file lớn. Chọn đúng module theo `ARCHITECTURE.md`; UI, domain, data access và backend action phải tách nhau. Nếu thêm một nhóm nghiệp vụ mới, tạo module mới thay vì mở rộng `app.js` hoặc `server/src/actions.js` thành monolith.
