# Phục chế ảnh đề thi qua Google Sheet

## Phạm vi hiện tại

- Từ 1.3.242, owner cho phép chia sẻ từng ảnh raster bằng link có thời hạn để AI
  đọc mà không cần đăng nhập. Link gốc `/uploads/` vẫn yêu cầu đăng nhập. Chỉ
  thao tác `Đồng bộ ảnh` tạo/gia hạn link, không startup/polling. Đây không phải
  công khai toàn kho; ai giữ link đều có thể xem đúng ảnh đó cho tới khi hết hạn.
- `Đề Thi → Đồng bộ ảnh` là nút duy nhất. API export JSON vẫn giữ cho tương
  thích kỹ thuật, không hiển thị nút xuất file riêng.
- Chỉ đọc ảnh của mọi đề chưa vào thùng rác, không phụ thuộc bộ lọc đang chọn.
  Đề published dùng snapshot đang xuất bản, không dùng ảnh của nháp chưa công bố.
- Không xuất học viên, bài làm, đáp án, prompt AI hoặc khóa truy cập. File không
  chứa ảnh nhị phân. Link ảnh vẫn giữ nguyên quyền truy cập của website.
- Không dùng trình duyệt trong chat này theo yêu cầu owner ngày 19/10/2026.
  SSH đang timeout. Chưa xác minh Sheet chứa dữ liệu thật,
  chưa phục chế ảnh, chưa thay ảnh production. Không suy đã làm các bước này.
- Link `/uploads/` cần đăng nhập. Inventory đủ để tạo danh sách trong Sheet,
  và cột `Link cho AI` mới cấp quyền giới hạn cho ảnh được chia sẻ (xem mục dưới).
  Không trích cookie,
  công khai kho ảnh, tạo token bỏ qua đăng nhập hoặc tự mở trình duyệt để né giới hạn.

## Đồng bộ trực tiếp, chỉ khi bấm nút (1.3.236)

### Link ảnh cho AI (1.3.242)

Chẩn đoán 1.3.245: link thật đã trả 200/image/jpeg qua HTTP không session và
các user-agent thử nghiệm; DNS hệ thống, Google và Cloudflare phân giải nhất
quán. Công cụ web OpenAI vẫn báo inaccessible cho cả domain. Đây chưa phải
bằng chứng OpenAI fetch thành công hoặc website chặn một IP cụ thể. Sửa lỗi
`robots.txt` bị SPA fallback trả login HTML thành text/plain, khai báo allow
đường dẫn chia sẻ; không đổi auth, chữ ký, noindex hay hạn link. Theo tài liệu
OpenAI, robots rules có thể không áp dụng với ChatGPT-User do người dùng khởi
xướng; vì vậy không coi bản sửa robots là chứng minh đã chữa lỗi DNS. Cần
readback từ chính môi trường lỗi; không sửa pending/result hoặc tự bật lịch chạy.

- Hai cột máy quản lý J/K trên tab Ảnh: `Link cho AI`, `Hết hạn link AI`.
  Đồng bộ kiểm tra header trước khi mở rộng 9 thành 11 cột; cột lạ ở J/K thì
  dừng, không ghi đè. Không thay A:I, link gốc, link phục chế, ghi chú hoặc mã nguồn.
  Giữ vị trí hàng trống khi cập nhật. Chỉ tạo link cho ảnh còn trong inventory và
  chưa có link phục chế, không tự phục chế/gắn ảnh lên web.
- Chỉ ảnh JPG/JPEG, PNG, WebP, GIF, AVIF nằm trong `/uploads/` cùng origin.
  Không fetch URL ngoài, audio, SVG, HTML hay file bất kỳ. Route kiểm tra header
  ảnh trước khi trả bytes với MIME cố định, nosniff và cache no-store.
- Link hiệu lực tối đa 7 ngày kể từ lúc phát hành. Đồng bộ tái sử dụng link còn
  hạn; tạo link mới nếu hết hạn/đã thu hồi. Chữ ký HMAC ràng buộc tên ảnh, nonce,
  hạn dùng. Khóa/grant lưu mã hóa riêng trong `exam_image_sharing`, không snapshot
  bài thi, không migration. SQL advisory transaction lock bảo vệ cấp/thu hồi.
- `GET/HEAD /shared-exam-images/:name?signature=...` không cần session nhưng cần
  chữ ký hợp lệ và grant chưa hết hạn. Không có listing hay public original route.
  Không trả redirect R2 làm mất khả năng thu hồi. App request serializer bỏ query
  khỏi log route chia sẻ; proxy bên ngoài có thể vẫn ghi URL, coi link là bí mật.
- `Cài đặt → Nâng cao → Thu hồi link ảnh cho AI`: dán đúng link, bấm Thu hồi.
  Master-only POST `/api/exam-images/shares/revoke`, dùng origin guard hiện hữu.
  Link cũ bị vô hiệu; không xóa ảnh. Thu hồi một link cũ không thu hồi nhầm grant
  mới của cùng ảnh. Đồng bộ lần sau có thể phát hành lại bằng nonce khác.
- Header noindex/nofollow/noarchive/no-referrer chỉ là hướng dẫn, không ngăn người
  có link lưu/sao chép ảnh. Thu hồi không xóa bản đã tải. Không thay sharing Drive.
- Kiểm thử synthetic gồm Fastify HTTP thật, bytes/cache/MIME, expiry, sửa token,
  tên ảnh, thu hồi/cấp lại, master negatives và migration Sheet giữ dữ liệu cũ.
  Chưa xác minh link thực/ChatGPT tải ảnh thực cho tới khi owner bấm đồng bộ.

### Cấp quyền trong Cài đặt (1.3.237)

Từ 1.3.241, `Cài đặt → Nâng cao → Kết nối Google chính` chỉ quản lý Google
chính và quyền file Sheet ảnh. Tài khoản Sao lưu được quản lý riêng tại
`Backup → Cài đặt Backup`; callback Sao lưu quay về Backup, callback Google
chính quay về Nâng cao. API trạng thái Sheet không tải email/trạng thái Sao lưu.
Đây là thay đổi vị trí quản lý, không thay token hay tự thêm quyền/tác vụ mới.

Từ 1.3.240, tài khoản Sheet ảnh và Sao lưu là hai kết nối OAuth riêng. Sheet dùng
secret mã hóa `image_sheet_google`; tuyệt đối không fallback/copy token từ
`backup_google_drive` hoặc tài khoản đăng nhập website. Cả hai tái dùng Cloud
OAuth client và callback đã đăng ký, không cần tạo project/client/redirect mới.
State trên server gắn mục đích kết nối, user, cookie ký và thời hạn; callback
Sheet chỉ lưu token Sheet, không tạo folder hay sửa credential Sao lưu. Cấu hình
Picker cũ vẫn giữ; lần đầu sau nâng cấp cần kết nối Google Sheet ảnh riêng,
chọn tài khoản có quyền Sheet, sau đó cấp quyền file qua Picker. Cài đặt luôn
hiện email từng kết nối. Ngắt Google Sheet chỉ xóa token Sheet tại ứng dụng,
không revoke app grant (có thể ảnh hưởng token khác nếu dùng cùng tài khoản).

Từ 1.3.239, Google là nguồn xác minh quyền thực: GET trạng thái và POST đồng bộ
kiểm tra đúng file, canEdit và Sheets API bằng token hiện tại, không chặn chỉ vì
cờ `authorized` cũ chưa lưu sau Picker. Các bước kiểm tra này chỉ đọc Google,
không tự ghi lại cấu hình/khóa. `Ngắt Sheet ảnh` lưu `enabled:false` và vẫn
chặn đồng bộ; cấu hình cũ authorized:false + folderId có sẵn được giữ ngắt để
không âm thầm nối lại. Chỉ thao tác cấp quyền rõ ràng mới bật lại kết nối ngắt.
Picker hủy, chọn đúng, xác minh và hoàn tất có phản hồi riêng. Lỗi Google phân
loại từ reason code cho phép (API chưa bật, thiếu scope, hết phiên, 404/403),
không echo message/body có thể chứa nội dung hoặc token. Chưa xác minh lý do
callback production không hoàn tất; không coi cải tiến này là bằng chứng Google
đã cấp quyền. Chỉ xác nhận đồng bộ sau Sheet/status readback thật.

Từ 1.3.238, Picker dùng `DocsView.setFileIds` với ID Exam img đã biết thay vì
yêu cầu tìm theo tên trong danh sách chung. Không thêm scope hay vượt quyền:
Google vẫn loại file nếu tài khoản không được truy cập. Chưa xác minh nguyên
nhân danh sách cũ thiếu file và chưa chạy Picker thật; không coi test double
là bằng chứng cửa sổ Google đã hiển thị file production.

1. Vào `Cài đặt → Nâng cao → Kết nối Google chính` (chỉ master).
2. Bấm `Kết nối Google chính`, chọn tài khoản có quyền sửa Exam img.
   Không dùng kết nối Sao lưu làm quyền Sheet. Callback quay về Cài đặt.
3. Nhập Picker API key và Project number trong cùng Cloud project của OAuth Backup.
   Key phải cho phép Google Picker API, referrer website và `https://docs.google.com/*`.
   Bật Google Picker API, Google Sheets API trong Cloud project; không tạo OAuth mới.
4. Lưu cấu hình, bấm `Chọn Exam img và cấp quyền`, chọn đúng file trong Picker.
   Máy chủ kiểm chứng ID, quyền chỉnh sửa và Sheets API trước khi ghi authorized.
   Chọn sai/hủy/lỗi không ghi nhận thành công và không đồng bộ ảnh.
5. Sau đó dùng `Đề Thi → Đồng bộ ảnh`. Không đồng bộ lúc cấp quyền hoặc tải Cài đặt.

Picker config lưu mã hóa trong secrets key `image_sheet_picker`, không lộ trong
settings/infrastructure/public APIs. Master-only POST `/api/exam-images/picker`
cung cấp API key và access token `drive.file` ngắn hạn cho Google Picker trong
trình duyệt theo thiết kế Google; không refresh token/client secret, không cache,
không localStorage. Mọi route mới dùng master guard và origin policy hiện hữu.
Không thêm scope OAuth. Khác với các API key AI, key Picker cần có trong trình
duyệt của master khi mở Google Picker, vì vậy phải hạn chế referrer/API trên Cloud.
Ngắt Sheet ảnh là tắt sử dụng tại ứng dụng, không revoke kết nối Sao lưu hay xóa
file. Ngắt Google sao lưu chỉ xóa kết nối Sao lưu trong ứng dụng và revoke token đó;
nếu hai kết nối dùng cùng tài khoản, Google có thể thu hồi grant chung, nên UI
cảnh báo khi ngắt Sao lưu. Quyền Picker vẫn có thể thu hồi trong tài khoản Google.
Đổi tài khoản Sheet cần xác minh/cấp quyền lại.

Kết nối Google sao lưu nằm trong popup Cài đặt Backup. Chưa chạy Google
Picker thật bằng trình duyệt hoặc xác minh quyền production: chỉ báo hoàn tất
đồng bộ sau status/Sheet readback thật, không suy từ health/version/tests.

- Chỉ chạy khi master bấm `Đề Thi → Đồng bộ ảnh`. Không timer, không chạy khi
  khởi động máy chủ, mở trang, thêm đề hoặc mở link Sheet. Không cần xuất/nhập JSON.
- Dùng kết nối OAuth riêng cho Sheet với scope `drive.file` hiện có. Google
  Sheets API phải được bật trên cùng Google Cloud project của OAuth Backup.
  Không thêm OAuth scope, service account, token phía client hoặc dependency.
- Dùng đúng Sheet `Exam img` owner chỉ định, ID tại `IMAGE_SHEET_ID` trong
  `server/src/image-sheet.js`. Không tìm/tạo Sheet khác, không đổi sharing hay
  appProperties. Đích cũ trong cursor không được dùng làm fallback.
  Mã Sheet và thời điểm đồng bộ lưu mã hóa trong `secrets`; toàn bộ
  link phục chế/trạng thái/ghi chú/vị trí vẫn nằm trong Sheet, không bản sao DB.
- Chỉ master được dùng API:
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
- Sheet bị xóa/đổi header/không có quyền: dừng, không tự thay Sheet mới. Giới hạn
  50.000 hàng/tab; vượt giới hạn cần phân trang/đổi cấu trúc có chủ đích.
- Sheet không xuất hiện trong danh sách backup và không thể bị xóa bằng API
  xóa backup. Lỗi Google được che nội dung/token; muốn thử lại phải bấm nút.
- Test dùng dữ liệu tổng hợp/API doubles; chưa xác minh API bật hoặc quyền OAuth
  production. Chỉ ghi kết nối thực hoạt động khi đọc lại Sheet/status thành công.
- Connector đã sửa được Sheet không chứng minh token Sheet trên server có
  quyền. Scope `drive.file` chỉ truy cập tệp đã được cấp cho ứng dụng: Sheet do
  owner tạo ngoài ứng dụng có thể cần chọn/cấp quyền tệp qua Google Picker.
  Không tự nâng sang quyền đọc toàn bộ Drive/Sheets để né lỗi. Lỗi được trả 400
  với hướng dẫn an toàn để UI hiển thị, không bị global 5xx handler che mất.

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

1. Khi bấm đồng bộ, máy chủ đọc inventory mới và Sheet cũ trước khi ghi. Worker dùng
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
