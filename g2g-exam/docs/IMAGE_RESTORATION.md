# Phục chế ảnh đề thi qua Google Sheet

## Phạm vi hiện tại

- `Đề Thi → Xuất ảnh` tải `g2g-exam-images.json`, chỉ tài khoản master.
- Chỉ đọc ảnh của mọi đề chưa vào thùng rác, không phụ thuộc bộ lọc đang chọn.
  Đề published dùng snapshot đang xuất bản, không dùng ảnh của nháp chưa công bố.
- Không xuất học viên, bài làm, đáp án, prompt AI hoặc khóa truy cập. File không
  chứa ảnh nhị phân. Link ảnh vẫn giữ nguyên quyền truy cập của website.
- Không dùng trình duyệt trong chat này theo yêu cầu owner ngày 19/10/2026.
  SSH đang timeout. Chưa xác minh Sheet chứa dữ liệu thật,
  chưa phục chế ảnh, chưa thay ảnh production. Không suy đã làm các bước này.
- Link `/uploads/` cần đăng nhập. Inventory đủ để tạo danh sách trong Sheet,
  nhưng không cấp quyền tải ảnh nhị phân cho worker. Phục chế cần nguồn file gốc
  do owner gửi hoặc khôi phục kết nối máy chủ đã được cấp quyền. Không trích cookie,
  công khai kho ảnh, tạo token bỏ qua đăng nhập hoặc tự mở trình duyệt để né giới hạn.

## Đồng bộ trực tiếp (1.3.234)

- Máy chủ production tự chạy sau khi khởi động 30 giây, rồi 5 phút sau mỗi lần
  hoàn tất. Không cần mở trang, xuất/nhập JSON hay trình duyệt của Codex.
- Tái dùng kết nối Drive trong Sao lưu và scope `drive.file` hiện có. Google
  Sheets API phải được bật trên cùng Google Cloud project của OAuth Backup.
  Không thêm OAuth scope, service account, token phía client hoặc dependency.
- Tự tạo một Sheet riêng trong thư mục G2G Exam của kết nối Drive. Không đổi
  sharing. Mã Sheet và thời điểm đồng bộ lưu mã hóa trong `secrets`; toàn bộ
  link phục chế/trạng thái/ghi chú/vị trí vẫn nằm trong Sheet, không bản sao DB.
- `Đề Thi → Sheet ảnh` mở Sheet đã tạo. Chỉ master được dùng API:
  `GET /api/exam-images/status`, `GET /api/exam-images/sheet`,
  `POST /api/exam-images/sync` (đồng bộ ngay). POST chịu origin policy hiện hữu.
- Đọc metadata/header và từng khối tối đa 1.000 hàng trước khi append. Giữ nguyên
  tất cả hàng cũ và cột thủ công; không ghi đè link, status, checksum hay ghi chú.
  Link gốc/link phục chế ở hai cột liền nhau. Text mới ghi bằng stringValue,
  không thực thi công thức từ tên đề/URL.
- Đối soát sourceId, alias và link đã gắn web trước khi thêm. Ảnh có bản phục chế
  không tạo lại hàng/job. Vị trí mới có mã hash gồm version, chỉ append để giữ
  lịch sử. Không tự phục chế hay áp dụng ảnh lên website trong bước đồng bộ này.
- Có single-flight và PostgreSQL advisory lock giữa các instance. Mỗi batch thêm
  tối đa 200 hàng mỗi tab, atomic cả hai tab. Timeout: đọc lại ID ở lần sau, không
  replay append mù. Sheets không có khóa chống người dùng chỉnh/sort đồng thời;
  không chạy worker ghi hàng mới khác trong khi đồng bộ.
- Ghi ý định trước khi tạo file, tìm lại theo appProperties nếu bị gián đoạn.
  Kết quả tạo không rõ hoặc nhiều Sheet trùng: dừng đối soát, không tạo lặp.
  Sheet bị xóa/đổi header/đổi Drive: dừng, không tự thay Sheet mới. Giới hạn
  50.000 hàng/tab; vượt giới hạn cần phân trang/đổi cấu trúc có chủ đích.
- Sheet không xuất hiện trong danh sách backup và không thể bị xóa bằng API
  xóa backup. Lỗi Google được che nội dung/token; lần sau retry sau 5 phút.
- Test dùng dữ liệu tổng hợp/API doubles; chưa xác minh API bật hoặc quyền OAuth
  production. Chỉ ghi kết nối thực hoạt động khi đọc lại Sheet/status thành công.

## Sổ ảnh

Một Google Sheet riêng, giữ quyền riêng tư hiện có. Khi tạo, ghi URL/ID thực đã
đọc lại vào mục này; không tự đoán ID. Ảnh phục chế lưu thành file riêng trong
Drive, link cạnh link gốc. Sheet quản lý công việc; website chỉ lưu media và các
tham chiếu được áp dụng. Không nhét ảnh nhị phân, secret hoặc session cookie vào Sheet.

- Tab `Ảnh`: mã nguồn, link gốc, link phục chế (ngay cạnh), trạng thái,
  SHA-256 file gốc, SHA-256 ảnh mới, link đã gắn web, ghi chú, các alias nguồn.
- Tab `Vị trí`: examId, tên đề, provider, level, trạng thái/version đề, entityId,
  entity, JSON pointer, mã nguồn ảnh. Một ảnh có thể dùng tại nhiều vị trí.
- `sourceId` là SHA-256 của URL chuẩn hóa, **không phải checksum nội dung ảnh**.
  Chỉ ảnh đã tải thành công mới có SHA-256 file. Không coi URL khác là ảnh khác
  trước khi so checksum. Không bỏ query của URL ngoài website hoặc URL có phiên bản.

## Khi có đề mới / tiếp tục sau gián đoạn

1. Máy chủ tự đọc inventory mới và Sheet cũ trước khi ghi. Khi xử lý thủ công dùng
   `scripts/media/restoration-registry.mjs` để merge: chỉ thêm nguồn mới, giữ link
   phục chế, trạng thái và ghi chú cũ. Không xóa hàng chỉ vì ảnh không còn trong đề.
   Ghi nội dung đề/URL dưới dạng giá trị RAW, không diễn giải chúng thành công thức.
2. So alias/link đã gắn web trước để ảnh phục chế đang được web dùng không trở
   thành một job mới. Giữ bản xuất vị trí theo version; không ghi đè lịch sử áp dụng.
3. Tải nguồn và tính SHA-256. Nếu cùng checksum với ảnh đã có bản phục chế, tái
   sử dụng bản đó dù tên file/URL khác. Nếu cùng URL nhưng bytes đổi, giữ lại để
   xử lý phiên bản mới, không tự dùng kết quả cũ hoặc xóa lịch sử.
4. Chỉ một worker xử lý Sheet tại một thời điểm. Ghi `processing` trước khi gọi
   công cụ; ghi link output ngay khi có file. Job bị gián đoạn phải đối soát output
   trước, không tự gọi phục chế lần nữa. Không hứa Google Sheet có khóa nguyên tử.
5. Giữ nguyên chữ, số, ký hiệu, bố cục và nội dung đáp án. Không đoán chi tiết
   không đọc được. Ảnh mới lưu riêng; không ghi đè hay xóa ảnh gốc. Link có sẵn
   thì bỏ qua tạo lại. Ghi `restored`, rồi `approved` sau khi owner duyệt.

## Bước gắn lại web — chưa triển khai tự động

Chỉ dùng hàng approved. Tải output từ Drive lên kho media hiện hữu khi sắp áp dụng
(tránh file chưa được tham chiếu bị GC dọn sau grace period). Trước khi thay phải
kiểm tra entityId/pointer còn trỏ đúng ảnh gốc và version đề chưa thay đổi.
Không thay theo số hàng Sheet, nhãn câu hoặc tìm-thay chuỗi toàn DB.

Giữ snapshot bài làm và releases cũ. Đề published đi qua luồng sửa/xuất bản chuẩn,
không sửa trực tiếp release bất biến. Lưu receipt old/new URL, vị trí và version
trong Sheet để rollback. Chỉ ghi `applied` khi website xác nhận đúng các vị trí.
Không coi việc có link phục chế là đã cập nhật website.

## Owner và kiểm tra

`server/src/exam-image-inventory.js`: xuất read-only, snapshot, URL và vị trí.
`server/src/image-restoration-registry.js`: merge/dedup/khôi phục job dùng chung;
`scripts/media/restoration-registry.mjs` giữ compatibility cho worker offline.
`server/src/image-sheet-sync.js`: mapping Sheet, đọc bounded và append-only.
`server/src/image-sheet.js`: Drive/Sheets transport, cursor, lock, scheduler/routes.
Các test tương ứng nối vào suite VPS hiện hữu; HTTP/SQL integration kiểm tra
401/403/master và projection không rò dữ liệu. Không cấp thêm OAuth scopes hoặc
dịch vụ mới cho export. Chưa có bằng chứng E2E Sheets/imagegen/web replacement
khi chưa nhận inventory thật; không báo quy trình hoàn chỉnh đã hoạt động.
