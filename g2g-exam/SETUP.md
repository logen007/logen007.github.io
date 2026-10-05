# G2G Thi thử tiếng Đức – thiết lập môi trường chạy thật

Hệ thống có hai chế độ:

- **Cục bộ**: không có `G2G_FIREBASE_CONFIG`, dữ liệu lưu trong trình duyệt để phát triển/thử nghiệm.
- **Firebase**: đăng nhập Google + Firestore + Cloud Functions + email kết quả.

## 1. Tạo Firebase project

1. Tạo project tại Firebase Console.
2. Bật **Authentication → Google**.
3. Tạo **Cloud Firestore** ở production mode.
4. Trong Authentication → Settings → Authorized domains, thêm domain chạy hệ thống, ví dụ `exam.g2gcareer.com` và domain GitHub Pages dùng thử.

## 2. Điền cấu hình web

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

Các giá trị Firebase Web Config không phải service-account secret. Tuyệt đối không đưa private key/service account lên GitHub.

## 3. Deploy rules và Functions

Cài Firebase CLI rồi đăng nhập:

```bash
npm install -g firebase-tools
firebase login
cd g2g-exam
firebase use --add
cd functions
npm install
cd ..
firebase deploy --only firestore:rules,functions
```

Cloud Functions chịu trách nhiệm cho các thao tác nhạy cảm:

- chấm tự động khi nộp bài;
- lưu điểm chấm tay;
- công bố kết quả;
- tạo email thông báo;
- thay đổi vai trò học viên/giáo viên;
- tạo bản câu hỏi công khai không chứa đáp án đúng.

## 4. Gửi email khi có điểm

Cài Firebase Extension **Trigger Email** (`firebase/firestore-send-email`) và cấu hình collection gửi là:

```text
mail
```

Function `publishAttemptResult` tự tạo document trong `mail` khi chủ bài/Quản trị cấp cao công bố kết quả.

## 5. Tạo Master Admin lần đầu

1. Đăng nhập hệ thống bằng Google một lần. Hệ thống sẽ tạo tài khoản với vai trò `student`.
2. Trong Firestore Console, mở `users/{uid}` của tài khoản đó.
3. Đổi `role` thành `master`.
4. Đăng xuất/đăng nhập lại.

Từ thời điểm đó Master Admin có thể nâng tài khoản khác thành Giáo viên ngay trong giao diện.

## 6. Quyền dữ liệu

- Học viên chỉ đọc bài đã xuất bản và bản câu hỏi công khai **không có đáp án đúng**.
- Học viên chỉ sửa câu trả lời của lượt thi đang làm hoặc tự bỏ lượt.
- Điểm và trạng thái nộp/chấm/công bố chỉ được Cloud Functions thay đổi.
- Giáo viên chỉ sửa/xóa câu hỏi và bài thi do mình tạo.
- Giáo viên khác muốn chấm phải gửi yêu cầu và được chủ bài duyệt.
- Chỉ chủ bài hoặc Master Admin được công bố kết quả.
- Chỉ Master Admin thấy Thùng rác và xóa vĩnh viễn.

## 7. Question Bank công khai

Mỗi lần giáo viên tạo/sửa `questions/{id}`, trigger `syncQuestionPublic` tạo `questionPublic/{id}` đã bỏ `correctAnswer` và rubric riêng tư. Học viên chỉ đọc `questionPublic`.

Nếu import một ngân hàng câu hỏi có sẵn sau khi triển khai, gọi callable function `rebuildQuestionPublic` bằng tài khoản Master Admin một lần để tạo lại toàn bộ bản công khai.

## 8. Quy trình cập nhật an toàn

1. Sửa/test ở chế độ local trước.
2. Chạy `node g2g-exam/tests/core.test.mjs`.
3. Deploy Functions/rules trước nếu thay đổi logic server.
4. Sau đó deploy frontend.
5. Không sửa trực tiếp cấu trúc bài đã có học viên thi; tạo đề/phiên bản mới nếu thay đổi lớn.

## 9. Sao lưu

Nên bật backup Firestore theo lịch hoặc xuất dữ liệu định kỳ. Các collection quan trọng:

`users`, `questions`, `questionPublic`, `exams`, `attempts`, `gradingRequests`, `notifications`, `auditLog`.
