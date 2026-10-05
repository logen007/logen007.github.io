# G2G Thi thử tiếng Đức – triển khai vận hành thật

Hệ thống có hai chế độ:

- **Thử nghiệm cục bộ**: khi `firebase-config.js` chưa có cấu hình, dữ liệu lưu trong trình duyệt để kiểm tra giao diện và nghiệp vụ.
- **Vận hành thật bằng Firebase**: Google Login + Firestore + Cloud Functions + Storage audio + email kết quả.

> Trang GitHub Pages hiện tự dùng chế độ cục bộ cho đến khi điền Firebase Web Config.

## 1. Dịch vụ cần bật trong Firebase

1. Tạo một Firebase project riêng cho hệ thống thi thử.
2. Bật **Authentication → Google**.
3. Tạo **Cloud Firestore** ở production mode.
4. Bật **Cloud Storage**.
5. Bật **Cloud Functions** / billing phù hợp với yêu cầu deploy Functions.
6. Authentication → Settings → Authorized domains: thêm domain thật, ví dụ `exam.g2gcareer.com`, và domain GitHub Pages nếu còn dùng để thử.

## 2. Cấu hình frontend

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

Firebase Web Config không phải private key. **Không đưa service-account JSON hoặc private key lên GitHub.**

## 3. Cài và deploy backend

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

## 4. Các thao tác nhạy cảm chạy phía server

Cloud Functions hiện chịu trách nhiệm cho:

- tạo lượt thi và số lần thi;
- bỏ lượt / làm lại;
- khởi tạo đồng hồ từng phần;
- chuyển phần và tạo deadline trên server;
- chấm tự động khi nộp;
- giữ điểm chưa công bố trong `attemptPrivate`;
- lưu điểm chấm tay;
- công bố kết quả;
- gửi thông báo/email;
- đổi vai trò Học viên ↔ Giáo viên bởi Master Admin;
- tạo `questionPublic` không chứa đáp án đúng;
- khóa câu hỏi khi đã dùng trong đề xuất bản.

Học viên không thể tự ghi `totalScore`, `result`, đáp án đúng hoặc điểm chấm tay qua client.

## 5. Cấu trúc dữ liệu chính

- `users`: tài khoản và vai trò.
- `questions`: ngân hàng câu hỏi đầy đủ; học viên không được đọc.
- `questionPublic`: bản dành cho học viên, không có `correctAnswer`/rubric riêng tư.
- `exams`: bài thi và cấu trúc các phần.
- `attempts`: lượt thi, câu trả lời, trạng thái và **chỉ chứa điểm sau khi đã công bố**.
- `attemptPrivate`: điểm tự động/điểm chấm tay/nhận xét trước khi công bố; chỉ giáo viên đọc.
- `gradingRequests`: yêu cầu xin chấm.
- `notifications`: thông báo kết quả.
- `auditLog`: nhật ký hành động quan trọng.
- `mail`: hàng đợi gửi email.

## 6. Gửi email khi có điểm

Cài Firebase Extension **Trigger Email** (`firebase/firestore-send-email`) và đặt collection gửi là:

```text
mail
```

Khi chủ bài hoặc Master Admin công bố điểm, Function tự tạo document trong `mail`. Học viên nhận email rồi đăng nhập để xem chi tiết.

Không gửi điểm tạm qua email trước khi công bố.

## 7. Tạo Master Admin lần đầu

1. Đăng nhập hệ thống bằng Google một lần. Hệ thống tự tạo user với role `student`.
2. Firestore Console → `users/{uid}` → đổi `role` thành `master`.
3. Đăng xuất và đăng nhập lại.
4. Sau đó dùng giao diện Master Admin để cấp quyền Giáo viên cho tài khoản khác.

Không để nhiều tài khoản Master Admin nếu không cần thiết.

## 8. Quyền và ownership

- Học viên: chỉ đọc đề đã xuất bản, câu hỏi public và các lượt thi của chính mình.
- Giáo viên: xem bài thi/câu hỏi dùng chung.
- Câu hỏi: chỉ người tạo hoặc Master Admin được sửa/xóa; câu đã dùng trong đề xuất bản được khóa để tránh thay đổi lịch sử.
- Bài thi: chủ bài hoặc Master Admin được quản lý.
- Giáo viên khác muốn chấm: gửi yêu cầu → chủ bài duyệt.
- Người được duyệt chấm được nhập điểm nhưng **không được công bố** kết quả của bài người khác.
- Chỉ chủ bài hoặc Master Admin công bố kết quả.
- Giáo viên xóa bài là soft delete; Trash chỉ Master Admin nhìn thấy.
- Bài thi đã có lượt thi không được xóa vĩnh viễn để bảo toàn bảng điểm.

## 9. Audio

Audio câu hỏi được lưu dưới:

```text
question-audio/{teacherUid}/{questionId}/...
```

Giới hạn hiện tại: **25 MB/tệp**, chỉ tài khoản chủ đường dẫn được upload/xóa. Học viên đăng nhập có thể đọc audio của đề.

Ở chế độ local, audio nhỏ có thể lưu dạng data URL chỉ để thử; không dùng cách này cho production.

## 10. Migration từ dữ liệu cũ

Nếu trước đây đã có điểm chưa công bố nằm trực tiếp trong `attempts`, sau khi deploy Functions mới hãy gọi callable Function:

```text
migrateAttemptPrivacy
```

bằng tài khoản Master Admin **một lần**. Function chuyển các trường điểm/nhận xét chưa công bố sang `attemptPrivate`.

Nếu đã import ngân hàng câu hỏi trước khi trigger `syncQuestionPublic` tồn tại, gọi:

```text
rebuildQuestionPublic
```

bằng Master Admin một lần.

## 11. Kiểm thử trước mỗi lần phát hành

Local:

```bash
cd g2g-exam
npm test
node --check src/app.js
node --check src/core.js
node --check src/repository.js
node --check functions/bootstrap.js
node --check functions/attempts.js
node --check functions/secure-grading.js
```

Các trường hợp tối thiểu phải test:

- Google login mới / login lại / logout.
- học viên thi lần đầu, reload, tiếp tục;
- bỏ lượt và làm lại;
- hết giờ từng phần;
- autosave Writing;
- mất mạng / có mạng lại;
- nộp bài không lộ điểm;
- chấm thiếu / chấm đủ / nhập điểm vượt max;
- giáo viên khác xin chấm → từ chối / duyệt;
- grader được duyệt không thể publish;
- owner publish → email;
- xem Best / Latest / All Attempts;
- soft delete / restore / permanent delete;
- quyền câu hỏi của giáo viên khác;
- mobile 360–430 px, tablet ~768 px, desktop 1280–1920 px.

Repo có workflow `.github/workflows/g2g-exam-ci.yml`. Nếu GitHub Actions đang tắt cho repo thì cần bật Actions trong Settings để workflow thực sự chạy.

## 12. Backup và nâng phiên bản

Nên bật backup Firestore định kỳ trước khi đưa học viên thật vào dùng.

Không thay đổi cấu trúc một đề đã có học viên bắt đầu làm. Hệ thống hiện khóa cấu trúc để bảo toàn lịch sử; khi cần sửa lớn hãy tạo **đề/phiên bản mới**.

Các collection cần backup tối thiểu:

`users`, `questions`, `questionPublic`, `exams`, `attempts`, `attemptPrivate`, `gradingRequests`, `notifications`, `auditLog`.
