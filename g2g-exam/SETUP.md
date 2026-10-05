# G2G Thi thử tiếng Đức – triển khai vận hành thật

Hệ thống có hai chế độ:

- **Thử nghiệm cục bộ**: khi `firebase-config.js` chưa có cấu hình, dữ liệu lưu trong trình duyệt để kiểm tra giao diện và nghiệp vụ.
- **Vận hành thật bằng Firebase Blaze**: Google Login + Firestore + Cloud Functions + Storage audio + SMTP riêng.

> Trang GitHub Pages hiện tự dùng chế độ cục bộ cho đến khi điền Firebase Web Config.

## 1. Chuyển Firebase sang Blaze

Cloud Functions và luồng SMTP production dùng project Firebase ở gói **Blaze**.

Trong Firebase Console:

1. Mở project G2G Exam.
2. **Project settings / Usage and billing → Modify plan**.
3. Chọn **Blaze (pay as you go)**.
4. Liên kết Billing account của Google Cloud.
5. Nên tạo Budget Alert trong Google Cloud Billing để cảnh báo chi phí ngoài dự kiến.

Blaze không phải phí cố định hàng tháng; hệ thống vẫn ưu tiên chạy trong quota miễn phí khi lưu lượng thấp.

## 2. Dịch vụ cần bật

1. **Authentication → Sign-in method → Google**.
2. **Cloud Firestore** ở production mode.
3. **Cloud Storage**.
4. **Cloud Functions** vùng `asia-southeast1`.
5. **Secret Manager API**.
6. Authentication → Settings → Authorized domains: thêm domain thật, ví dụ `exam.g2gcareer.com`, và domain GitHub Pages nếu còn dùng để thử.

Không cần Firebase Trigger Email Extension nữa. Email được gửi trực tiếp từ Cloud Functions qua SMTP riêng.

## 3. Cấu hình frontend

Sửa `firebase-config.js`:

```js
window.G2G_FIREBASE_CONFIG = {
  apiKey: '...',
  authDomain: 'PROJECT.firebaseapp.com',
  projectId: 'PROJECT',
  storageBucket: 'PROJECT.appspot.com',
  messagingSenderId: '...',
  appId: '...'
};
```

Firebase Web Config không phải private key. **Không đưa service-account JSON, SMTP password hoặc private key lên GitHub.**

## 4. Cài và deploy backend

```bash
npm install -g firebase-tools
firebase login
cd g2g-exam
firebase use --add
cd functions
npm install
cd ..
firebase deploy --only firestore:rules,storage,functions
```

`firebase.json` đã trỏ đến:

- `firestore.rules`
- `storage.rules`
- `functions/`

## 5. Chuẩn bị Secret Manager cho SMTP

Mật khẩu SMTP **không lưu trong Firestore** và **không ghi vào source code**. Hệ thống dùng secret tên:

```text
SMTP_PASSWORD
```

Khuyến nghị tạo secret trước một lần:

```bash
gcloud services enable secretmanager.googleapis.com --project PROJECT_ID
gcloud secrets create SMTP_PASSWORD \
  --replication-policy=automatic \
  --project PROJECT_ID
```

Xác định service account đang chạy Cloud Functions, sau đó cấp đúng hai quyền cần thiết trên secret:

```bash
gcloud secrets add-iam-policy-binding SMTP_PASSWORD \
  --project PROJECT_ID \
  --member="serviceAccount:FUNCTIONS_SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding SMTP_PASSWORD \
  --project PROJECT_ID \
  --member="serviceAccount:FUNCTIONS_SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretVersionAdder"
```

Sau đó Master Admin có thể vào **Cài đặt → Máy chủ gửi thư SMTP**, nhập mật khẩu và bấm **Cập nhật mật khẩu**. Mật khẩu được gửi qua callable Cloud Function và thêm thành một version mới trong Secret Manager. Giao diện không thể đọc ngược mật khẩu đã lưu.

Nếu muốn khóa chặt quyền hơn, hãy tạo secret thủ công như trên thay vì cấp quyền tạo toàn bộ secret cho service account.

## 6. Cấu hình SMTP trong Admin

Trong **Quản trị cấp cao → Cài đặt** điền:

- Máy chủ SMTP;
- cổng;
- SSL/TLS trực tiếp, STARTTLS hoặc không mã hóa;
- username;
- mật khẩu/khóa SMTP qua Secret Manager;
- tên người gửi;
- email người gửi;
- Reply-To;
- timeout;
- kiểm tra chứng chỉ TLS;
- mẫu email text + HTML;
- email nhận thử.

Luồng nên dùng:

1. Điền SMTP nhưng chưa bật gửi mail.
2. Bấm **Lưu cài đặt**.
3. Nhập mật khẩu → **Cập nhật mật khẩu**.
4. Bấm **Kiểm tra kết nối** và xác nhận trạng thái Secret Manager.
5. **Gửi email thử**.
6. Khi email thử thành công mới bật **Bật gửi thư qua SMTP** và **Gửi email khi công bố kết quả**.

## 7. Cài đặt đăng nhập Google

Trang Cài đặt có:

- bật/tắt đăng nhập Google;
- bật/tắt học viên mới tự đăng ký;
- giới hạn tên miền email, ví dụ `g2gcareer.com`;
- trạng thái Firebase.

Firebase Google Provider vẫn phải được bật một lần trong Firebase Console. Client Secret hoặc khóa server không được đưa vào trang web.

`publicSettings/global` chỉ chứa các thiết lập an toàn cần trước khi đăng nhập. Firestore rules dùng cài đặt này để hạn chế việc tạo học viên mới.

## 8. Các thao tác nhạy cảm chạy phía server

Cloud Functions chịu trách nhiệm cho:

- tạo lượt thi và số lần thi;
- bỏ lượt / làm lại;
- khởi tạo đồng hồ từng phần;
- chuyển phần và tạo deadline trên server;
- chấm tự động khi nộp;
- giữ điểm chưa công bố trong `attemptPrivate`;
- lưu điểm chấm tay;
- công bố kết quả;
- gửi email trực tiếp qua SMTP;
- retry email lỗi mà không công bố điểm lần hai;
- đổi vai trò Học viên ↔ Giáo viên bởi Master Admin;
- tạo `questionPublic` không chứa đáp án đúng;
- khóa câu hỏi khi đã dùng trong đề xuất bản.

Học viên không thể tự ghi `totalScore`, `result`, đáp án đúng hoặc điểm chấm tay qua client.

## 9. Cấu trúc dữ liệu chính

- `users`: tài khoản và vai trò.
- `settings`: cài đặt nội bộ; client không được ghi trực tiếp.
- `publicSettings`: cài đặt an toàn có thể đọc trước đăng nhập.
- `questions`: ngân hàng câu hỏi đầy đủ; học viên không được đọc.
- `questionPublic`: bản dành cho học viên, không có đáp án đúng.
- `exams`: bài thi và cấu trúc các phần.
- `attempts`: lượt thi, câu trả lời, trạng thái và **chỉ chứa điểm sau khi đã công bố**.
- `attemptPrivate`: điểm tự động/điểm chấm tay/nhận xét trước khi công bố; chỉ giáo viên đọc.
- `gradingRequests`: yêu cầu xin chấm.
- `notifications`: trạng thái thông báo/email kết quả: `queued`, `sending`, `sent`, `failed`, `email_disabled`, `no_email`.
- `auditLog`: nhật ký hành động quan trọng.

SMTP password nằm trong Secret Manager, không nằm trong các collection trên.

## 10. Cơ chế email kết quả

Khi chủ bài hoặc Master Admin công bố điểm:

```text
ready
→ published
→ tạo notification deterministic result-{attemptId}
→ claim trạng thái sending bằng Firestore transaction
→ gửi qua Nodemailer + SMTP
→ sent hoặc failed
```

Nếu người dùng bấm công bố hai lần, kết quả không được công bố hai lần và email không được gửi song song hai lần. Nếu gửi mail lỗi, kết quả vẫn giữ trạng thái đã công bố và có thể gọi `retryResultEmail` để gửi lại.

Mẫu email hỗ trợ:

- `{student}`
- `{exam}`
- `{score}`
- `{result}`
- `{url}`

Không gửi điểm tạm trước khi công bố.

## 11. Tạo Master Admin lần đầu

1. Bật Google Login và cho phép học viên mới đăng ký tạm thời.
2. Đăng nhập hệ thống bằng Google một lần. Hệ thống tạo user role `student`.
3. Firestore Console → `users/{uid}` → đổi `role` thành `master`.
4. Đăng xuất và đăng nhập lại.
5. Dùng Master Admin để cấp quyền Giáo viên cho các tài khoản khác.
6. Sau đó có thể tắt tự đăng ký nếu muốn chỉ nhận tài khoản được kiểm soát.

Không để nhiều tài khoản Master Admin nếu không cần thiết.

## 12. Quyền và ownership

- Học viên: chỉ đọc đề đã xuất bản, câu hỏi public và lượt thi của chính mình.
- Giáo viên: xem bài thi/câu hỏi dùng chung.
- Câu hỏi: chỉ người tạo hoặc Master Admin được sửa/xóa; câu đã dùng trong đề xuất bản được khóa.
- Bài thi: chủ bài hoặc Master Admin được quản lý.
- Giáo viên khác muốn chấm: gửi yêu cầu → chủ bài duyệt.
- Người được duyệt chấm được nhập điểm nhưng không được công bố kết quả của bài người khác.
- Chỉ chủ bài hoặc Master Admin công bố kết quả.
- Giáo viên xóa bài là soft delete; Trash chỉ Master Admin nhìn thấy.
- Bài thi đã có lượt thi không được xóa vĩnh viễn để bảo toàn bảng điểm.

## 13. Audio

Audio câu hỏi được lưu dưới:

```text
question-audio/{teacherUid}/{questionId}/...
```

Giới hạn hiện tại: **25 MB/tệp**, chỉ tài khoản chủ đường dẫn được upload/xóa. Học viên đăng nhập có thể đọc audio của đề.

## 14. Kiểm thử trước mỗi lần phát hành

```bash
cd g2g-exam
npm test
node --check src/app.js
node --check src/core.js
node --check src/repository.js
node --check src/settings.js
node --check functions/bootstrap.js
node --check functions/concurrency.js
node --check functions/settings.js
node --check functions/mailer.js
```

Các trường hợp tối thiểu phải test:

- Google login bật/tắt;
- cho phép/cấm tài khoản mới;
- giới hạn domain email;
- SMTP sai host, sai port, sai password;
- SMTP SSL 465 và STARTTLS 587;
- test email;
- publish khi SMTP lỗi;
- retry email;
- double click publish;
- học viên thi lần đầu, reload, tiếp tục;
- bỏ lượt và làm lại;
- hết giờ từng phần;
- autosave Writing;
- mất mạng / có mạng lại;
- nộp bài không lộ điểm;
- chấm thiếu / chấm đủ / nhập điểm vượt max;
- quyền xin chấm;
- mobile 360–430 px, tablet ~768 px, desktop 1280–1920 px.

GitHub Actions dùng workflow `.github/workflows/g2g-check.yml`.

## 15. Backup và nâng phiên bản

Nên bật backup Firestore định kỳ trước khi đưa học viên thật vào dùng.

Không thay đổi cấu trúc một đề đã có học viên bắt đầu làm. Khi cần sửa lớn hãy tạo đề/phiên bản mới.

Các collection cần backup tối thiểu:

`users`, `settings`, `publicSettings`, `questions`, `questionPublic`, `exams`, `attempts`, `attemptPrivate`, `gradingRequests`, `notifications`, `auditLog`.

Secret `SMTP_PASSWORD` nên được quản lý bằng IAM riêng; không export secret vào file backup thông thường.
