# G2G Thi thử — Sổ tay vận hành

Tài liệu này dùng khi đưa hệ thống từ bản thử nghiệm sang vận hành thật và khi bảo trì sau này.

## 1. Nguyên tắc triển khai

Không sửa trực tiếp dữ liệu điểm hoặc lượt thi trong Firestore trừ khi đang xử lý sự cố có ghi nhận audit.

Mỗi thay đổi code phải đi qua workflow `G2G Exam Check`. Chỉ triển khai production khi workflow xanh.

Luồng an toàn:

1. Sửa code theo từng nhóm nhỏ.
2. Chạy kiểm tra cú pháp + core tests + edge tests + static frontend tests.
3. Xác nhận GitHub Pages build thành công đối với frontend.
4. Với thay đổi backend: deploy Functions/Rules vào Firebase test trước.
5. Test tài khoản Học viên, Giáo viên và Quản trị cấp cao.
6. Sau đó mới deploy production.

## 2. Kiến trúc vận hành

Frontend tĩnh:
- `vi.html`
- `styles.css`
- `enhancements.css`
- `src/app.js`

Logic nghiệp vụ dùng chung:
- `src/core.js`

Lớp dữ liệu:
- `src/repository.js`
- localStorage khi chưa cấu hình Firebase
- Firebase Auth + Firestore khi đã cấu hình Firebase

Media:
- `src/media.js`
- Firebase Storage ở production

Backend bảo mật:
- `functions/attempts.js`: thao tác lượt thi
- `functions/secure-grading.js`: dữ liệu điểm riêng tư
- `functions/concurrency.js`: chống thao tác trùng/race condition
- `functions/integrity.js`: khóa câu hỏi của đề đã xuất bản
- `functions/bootstrap.js`: export Functions production

Bảo mật:
- `firestore.rules`
- `storage.rules`

## 3. Dữ liệu quan trọng

Các collection production:

- `users`: tài khoản và vai trò
- `questions`: ngân hàng câu hỏi đầy đủ, giáo viên truy cập
- `questionPublic`: bản câu hỏi không chứa đáp án đúng cho học viên
- `exams`: bài thi
- `attempts`: lượt thi và dữ liệu học viên được phép đọc
- `attemptPrivate`: điểm chưa công bố và dữ liệu chấm riêng tư
- `attemptLocks`: khóa chống tạo trùng lượt thi khi bấm/nạp lại đồng thời
- `gradingRequests`: yêu cầu xin chấm
- `notifications`: thông báo kết quả
- `mail`: hàng đợi gửi email
- `auditLog`: nhật ký thao tác quan trọng

Không cấp client quyền ghi trực tiếp vào `attemptPrivate`, `attemptLocks`, `mail`, `auditLog`.

## 4. Trạng thái lượt thi

Luồng chuẩn:

`in_progress → grading → ready → published`

Với bài không có câu chấm tay:

`in_progress → ready → published`

Nếu học viên bỏ lượt:

`in_progress → abandoned`

Học viên chỉ nhìn thấy điểm khi trạng thái là `published`.

## 5. Xử lý chấm bài đồng thời

Production Functions dùng transaction cho lưu điểm.

Nếu hai giáo viên được cấp quyền chấm và lưu gần nhau:
- hệ thống đọc phiên bản điểm mới nhất;
- merge điểm theo kỹ năng;
- Firestore tự retry transaction nếu dữ liệu thay đổi trong lúc lưu;
- tránh ghi đè toàn bộ object điểm bằng bản cũ.

Chủ đề hoặc Quản trị cấp cao mới được công bố kết quả.

## 6. Chống công bố/gửi email trùng

`publishAttemptResult` là idempotent.

Mỗi attempt dùng ID cố định:
- notification: `result-{attemptId}`
- email: `result-{attemptId}`
- audit publish: `publish-{attemptId}`

Nếu người dùng double-click hoặc request được retry do mạng:
- lần đầu chuyển `ready → published`;
- lần sau nhận trạng thái `published` và không tạo thêm email.

## 7. Chống tạo trùng lượt thi

Backend dùng `attemptLocks/{studentId}__{examId}`.

Lock lưu:
- attempt hiện tại;
- số lần thi cuối;
- thời điểm cập nhật.

Hai request `Bắt đầu thi` đồng thời sẽ cùng quy về một attempt đang làm thay vì tạo hai bản ghi.

## 8. Quy tắc sửa đề và câu hỏi

Khi đề đã có học viên bắt đầu:
- không đổi cấu trúc đề cũ;
- giữ lịch sử điểm nguyên vẹn;
- muốn thay đổi lớn phải tạo đề/phiên bản mới.

Khi câu hỏi đã nằm trong đề xuất bản:
- câu được khóa;
- giáo viên không sửa trực tiếp;
- tạo câu hỏi mới hoặc bản sao để thay thế trong phiên bản đề mới.

## 9. Sao lưu

Tối thiểu mỗi ngày sao lưu:
- `users`
- `questions`
- `exams`
- `attempts`
- `attemptPrivate`
- `gradingRequests`
- `auditLog`

Khuyến nghị lưu bản backup ngoài Firebase project chính.

Trước migration lớn phải tạo một backup thủ công và ghi lại commit code tương ứng.

## 10. Khôi phục khi deploy lỗi

Frontend:
1. Xác định commit cuối cùng có `G2G Exam Check` xanh.
2. Revert commit gây lỗi.
3. Chờ GitHub Pages build thành công.
4. Refresh bằng cache-busting version nếu cần.

Firebase Functions:
1. Không thay đổi Rules/Functions tiếp trong lúc sự cố chưa xác định.
2. Deploy lại commit Functions ổn định gần nhất.
3. Kiểm tra `auditLog`, `attempts`, `attemptPrivate` trước khi cho học viên thi tiếp.

Không xóa attempt để “sửa nhanh”.

## 11. Checklist trước ngày có lớp thi

- Google Login hoạt động.
- Học viên mới đăng nhập được và có role student.
- Danh sách đề chỉ có đề `published`.
- Bắt đầu/tiếp tục/làm lại hoạt động.
- Reload giữa bài không reset timer.
- Autosave câu trả lời hoạt động.
- Audio đúng giới hạn số lượt nghe.
- Hết giờ xử lý đúng cấu hình từng phần.
- Nộp bài không lộ điểm chưa công bố.
- Giáo viên được phép mới nhìn thấy bài cần chấm.
- Giáo viên khác phải xin chấm và được duyệt.
- Lưu tạm điểm không gửi mail.
- Công bố điểm gửi đúng một email.
- Học viên xem được kết quả sau publish.
- Bảng điểm Best/Latest/All Attempts đúng.
- Mobile/tablet/desktop không tràn nút hoặc bảng.

## 12. Khi có lỗi từ người dùng

Cần ghi lại:
- email/tài khoản (không ghi token/password);
- mã bài thi;
- attempt ID;
- thời gian xảy ra;
- thiết bị/trình duyệt;
- ảnh lỗi nếu có.

Sau đó kiểm tra theo thứ tự:
1. trạng thái attempt;
2. `auditLog`;
3. Functions logs;
4. Firestore document;
5. frontend console/network nếu cần.

Không sửa dữ liệu trước khi xác định nguyên nhân.
