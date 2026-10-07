# G2G Thi thử — Kiến trúc

## Mục tiêu

Giữ từng thay đổi nhỏ, độc lập và dễ kiểm thử. UI, nghiệp vụ, data access và backend không được dồn vào một file lớn.

## Frontend

- `src/app.js`: bootstrap/router và điều phối màn hình. Không thêm template đề mới trực tiếp vào file này.
- `src/views/`: HTML render thuần cho Student/Admin/Builder/Modal.
- `src/domain/`: nghiệp vụ thuần, không gọi HTTP/DOM.
- `src/repositories/`: local demo và REST API adapter.
- `src/exam-specs/`: registry cấu trúc theo nhà cung cấp + trình độ.
- `src/part-templates/`: registry editor theo `templateType`.
- `src/question-groups/`: editor cho cụm câu hỏi có hành vi đặc biệt.
- `src/settings/`, `src/users/`: feature riêng, lazy-load.
- `src/ui/`: format/layout dùng chung.

### Exam specs

Các trình độ được nhận diện:

- Goethe: A1, A2, B1, B2.
- TELC: B1, B2.

Hiện chỉ Goethe A1 có cấu trúc đã được duyệt trong code. A2/B1/B2 và TELC B1/B2 được khai báo là `configured:false`; không tự suy đoán cấu trúc chính thức cho tới khi có yêu cầu/thiết kế được duyệt.

`src/exam-specs/index.js` là API duy nhất để đọc registry. Builder không được dựa vào `sections.slice(...)` hoặc vị trí cố định.

### Part templates

Mỗi phần có thể mang `templateType`. Editor đặc biệt được mở qua `src/part-templates/index.js`. Hiện có `A1_LISTENING_PART_1`; template mới phải thêm module riêng, không mở rộng `app.js` thành monolith.

## Backend

- `server/src/index.js`: HTTP/bootstrap.
- `server/src/actions/`: action nghiệp vụ bảo mật.
- `server/src/state.js`: state persistence/authorization boundary.
- `server/src/auth.js`: Google OAuth/session.
- `server/src/media-gc.js`: dọn media orphan.

## Media lifecycle

Upload nằm trong Docker volume `g2g_uploads` (`/data/uploads`). Garbage collector quét tham chiếu `/uploads/<file>` trong questions, question groups, exams, attempts, notifications và settings. File không còn tham chiếu và cũ hơn `MEDIA_GC_GRACE_HOURS` (mặc định 24 giờ) mới bị xóa. Job chạy mỗi `MEDIA_GC_INTERVAL_HOURS` (mặc định 6 giờ). Có thể tắt bằng `MEDIA_GC_ENABLED=false`.

Grace period bảo vệ file vừa upload nhưng chưa kịp gắn vào bản nháp. Demo upload không nằm trong DB sẽ tự được thu gom sau grace period.

## Trash lifecycle

- Question / Exam: soft delete → restore hoặc permanent delete.
- Question Group: cùng vòng đời; khi soft-delete, các câu bị kéo vào trash được đánh dấu `deletedByGroupId` để restore chính xác.
- Không xóa vĩnh viễn group nếu câu của group vẫn đang được bài thi tham chiếu.
- Exam có lịch sử attempt không được xóa vĩnh viễn.

## Quy tắc mở rộng

1. Thêm trình độ/cấu trúc: sửa `src/exam-specs/<provider>.js`.
2. Thêm editor đặc biệt: thêm module và đăng ký trong `src/part-templates/index.js`.
3. Không hard-code thứ tự skill bằng index/slice.
4. Backend phải kiểm tra lại quyền; frontend chỉ là UX.
5. Mọi thay đổi phải qua syntax check + `npm test` + CI trước khi đưa lên `main`.
