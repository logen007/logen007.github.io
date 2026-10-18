# G2G Exam — bắt đầu tại đây

**Dành cho chat Codex mới:** đọc README này, tự kiểm tra môi trường và tiếp tục
theo yêu cầu mới nhất của người dùng. Không cần lịch sử chat cũ để tìm quy trình.

## 1. Tìm đúng repository và công việc hiện tại

- GitHub: https://github.com/logen007/logen007.github.io
- Ứng dụng nằm trong **`g2g-exam/`**, không phải toàn bộ repository.
- Website: https://exam.g2gcareer.com — không phải môi trường test.
- Kiểm tra `pwd`, Git root, `git remote -v`, `git status --short --branch`, diff và
  commit gần nhất. Giữ nguyên thay đổi chưa commit của người khác.
- Nếu project hiện tại chỉ là thư mục chat, tìm checkout hiện có qua project
  context hoặc hồ sơ local bên dưới; không clone thêm/ghi đè checkout đang làm.
- Đọc `g2g-exam/AGENTS.md` rồi làm trong thư mục ứng dụng. Bắt đầu bằng feature
  branch phù hợp, không reset hoặc tự chuyển khỏi branch có thay đổi chưa lưu.

## 2. Kết nối — không mang secret theo tài liệu

**GitHub:** dùng connector GitHub hoặc Git credential đã cấp sẵn trong môi trường.
Xác minh đúng remote và quyền bằng thao tác đọc trước; không in credential,
token, nội dung `.env` hay private key vào chat/log. README không cấp quyền mới.

**Trên máy Mac làm việc hiện tại:** có hồ sơ riêng ngoài Git tại
`~/Documents/Codex/G2G-CONNECTIONS.local.md`. Đọc hồ sơ này để biết đường dẫn
checkout và SSH profile VPS. File này không chứa password/token/private key,
không commit hoặc copy nội dung vào PR/public docs.

**VPS:** chỉ dùng SSH profile/khóa đã được owner cấp. Địa chỉ, port và key path
ở hồ sơ local, không trong repo công khai. Cấu hình SSH tồn tại **không chứng minh
đăng nhập thành công**, và không cho phép sửa production. Không bỏ host-key
verification; nếu fingerprint thay đổi phải dừng xác minh. Nếu máy mới không có
hồ sơ hoặc quyền, tiếp tục phần local/GitHub độc lập và chỉ hỏi phần truy cập còn thiếu.

VPS dùng chung Traefik/n8n và dịch vụ khác: không restart/remove chúng, không chiếm
80/443, không đổi network/volume dùng chung. `g2g-exam/DEPLOY-VPS.md` là hướng dẫn
triển khai, **không phải** yêu cầu chạy deploy khi vừa đọc README. Thông số default
trong script phải đối chiếu cấu hình host trước khi sử dụng.

## 3. Đọc đúng nguồn, không tạo quy tắc thứ hai

| Cần biết | Đọc trong `g2g-exam/` |
| --- | --- |
| Quyền hạn, giới hạn và cách làm việc | `AGENTS.md` |
| Quy trình 7 bước, UI/UX, review và release/rollback | `docs/ENGINEERING.md` |
| Module chịu trách nhiệm | `docs/MAINTENANCE.md` |
| UI/component/token/mobile/light-dark | `docs/UI_STYLE.md` |
| Luật thi và rubric | `specs/README.md` + đúng APPROVED specification |
| Chọn và chạy test | `docs/QUALITY_GATES.md` |
| Audit và cải tiến đang review | `docs/ENGINEERING_AUDIT.md` |
| Restore dữ liệu | `docs/disaster-recovery/RESTORE.md` — chỉ môi trường cô lập |

Không đổi luật thi, điểm, quyền, snapshot hoặc dữ liệu production để sửa UI hoặc
làm test xanh. Không thêm framework/dependency/dịch vụ nếu chưa có lý do cần thiết.

## 4. Thực hiện và kiểm chứng

Từ `g2g-exam/`, dùng Node 22 như CI. Dependency dùng lockfile (`npm ci` và
`npm ci --prefix server --ignore-scripts`) khi cần, không auto-upgrade.

```sh
npm run quality -- --risk low --plan
npm run quality -- --risk medium
```

Chọn risk/test theo `docs/QUALITY_GATES.md`; `--plan` không chạy kiểm thử.
HIGH cần runtime SQL/DOM cô lập và bao gồm dependency audit; thiếu prerequisite
hoặc security gate đỏ thì không được báo pass/đủ điều kiện phát hành.
Không mở browser, kể cả headless, nếu chưa được cho phép. Báo rõ những gì chưa
kiểm chứng. Các test phải dùng dữ liệu tổng hợp, không Google/Drive/SMTP/AI thật.

## 5. GitHub/main/production

**Push/merge main sẽ được VPS tự triển khai. Không dùng main để thử việc.**
Tự review + test trên feature branch, chuẩn bị PR. Quyền phát hành phải phù hợp
request hiện tại; yêu cầu “không deploy” luôn được ưu tiên, dù chat trước từng cho
phép deploy thường lệ. Không bật auto-merge hoặc bypass gate.

Workflow v1 hiện được chuẩn bị ở `feature/g2g-engineering-workflow-v1`,
[Draft PR #9](https://github.com/logen007/logen007.github.io/pull/9).
Đọc trạng thái PR/CI mới nhất, không suy là đã merge từ tên README. Trong phạm vi
workflow/bootstrap này: **không merge main, không deploy, không tăng app version**.
Nếu README chưa có trên main, chat mới cần checkout branch này hoặc đọc README
đúng ref; không tự merge chỉ để lấy tài liệu.

## 6. Bàn giao cho chat sau

Giữ owner docs cập nhật khi thay đổi; không chỉ ghi trong lời chat. Khi dừng, ghi
branch/commit/PR, mục tiêu đang làm, test thực chạy, blocker và trạng thái deploy.
Phân biệt đã kiểm chứng / chưa kiểm chứng / giả định / đề xuất. Đọc trạng thái Git,
PR và yêu cầu mới trước khi tiếp tục; tài liệu không thay quyền truy cập thực tế.
