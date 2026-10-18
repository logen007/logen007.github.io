# Quality gates

Đây là nguồn điều phối kiểm thử. Các script/test hiện hữu vẫn sở hữu assertion;
`scripts/quality.mjs` chỉ chạy chúng, không triển khai hay thay luật sản phẩm.

## Chọn rủi ro theo ảnh hưởng, không theo số dòng

| Mức | Ví dụ | Automated gate tối thiểu | Bổ sung trước release |
| --- | --- | --- | --- |
| LOW | text, icon, CSS cục bộ không đổi dữ liệu | targeted UI tests, workflow tests, syntax, build | UI states và ma trận responsive/theme; nêu rõ chưa visual |
| MEDIUM | filter, form, navigation, async UI hoặc API shape không đổi quyền | `npm test`, UI/workflow/performance regressions, syntax, build + owner tests | integration nếu chạm persistence/transport; negative/failure cases |
| HIGH | điểm/deadline/snapshot, auth, delete/restore, migration, secret, deploy/shared architecture | MEDIUM + security/SQL/HTTP/DOM isolation, R2/backup/speaking checks và dependency audit | approved spec, independent review khi có, rollback, E2E nếu được cho phép; không miễn security/visual khi chưa chứng minh |

CI hiện hữu vẫn yêu cầu các check của nó; chọn LOW local không bỏ được CI. Tài
liệu thuần: diff/link/command review + `npm run test:workflow` nếu chạm hướng dẫn
workflow; không ép full test cho thay đổi prose không ảnh hưởng code/config.
Nếu UI đổi structural layout/shared tokens, nâng ít nhất MEDIUM. Khi có nghi ngờ,
nâng rủi ro thay vì chọn ít test nhất. Test lỗi là lỗi, không ghi “không liên quan”
nếu chưa tái hiện ở baseline hoặc chỉ ra dependency cụ thể.

## Các lệnh đã triển khai

Từ thư mục `g2g-exam/`, dùng Node 22 như CI (SQL hooks cần runtime có
`node:module.registerHooks`). Cài dependency đúng lockfile khi cần:
`npm ci` và `npm ci --prefix server --ignore-scripts`. Không chạy `npm audit fix`.

```sh
npm run quality -- --risk low --test tests/name-confirm.test.mjs
npm run quality -- --risk medium --test tests/page-history.test.mjs
npm run quality -- --risk high --plan
npm run test:workflow
```

- `--plan` chỉ in danh sách, **không** chạy test/build hoặc chứng minh pass.
- LOW luôn chạy nhóm UI representative, không chỉ test được chọn. MEDIUM thêm
  suite hiện hữu/performance. HIGH thêm check của CI và regression SQL/HTTP.
- `--test` nhận file tồn tại `tests/*.test.mjs` trong repo, không shell fragment,
  path traversal hoặc symlink ra ngoài. Không có cờ skip lỗi/build.
- Runner fail-fast, giữ lỗi/exit code và không âm thầm bỏ integration thiếu runtime.
  Nó bỏ database target/preview-port kế thừa trong child env, nhưng **không phải
  security sandbox**; vẫn phải review test không kết nối dịch vụ thật.
- HIGH cần `G2G_PGLITE_PATH` và `G2G_JSDOM_PATH`. Cài runtime kiểm thử vào thư mục
  tạm, không thêm production dependency:

```sh
G2G_TEST_RUNTIME="$(mktemp -d /tmp/g2g-quality-runtime.XXXXXX)"
npm install --prefix "$G2G_TEST_RUNTIME" --no-save --ignore-scripts @electric-sql/pglite@0.5.8 jsdom@26.1.0
G2G_PGLITE_PATH="$G2G_TEST_RUNTIME/node_modules/@electric-sql/pglite/dist/index.js" \
G2G_JSDOM_PATH="$G2G_TEST_RUNTIME/node_modules/jsdom/lib/api.js" \
npm run quality -- --risk high
```

Runtime cô lập dùng cùng phiên bản đang cài trong CI, không DB production. Chưa
chạy drill restore thật PostgreSQL/age/rclone hoặc kiểm tra Google/100ms thật.
`backup-media-lock.integration.mjs` là bài PostgreSQL thật (không phải PGlite),
không nằm trong runner mặc định và không được tính là đã pass từ HIGH.
Backup có bộ check riêng ở `.github/workflows/g2g-backup-check.yml`; khi sửa backup,
phải chạy Linux isolated restore drill của workflow đó. Không dùng live DB cho drill.

HIGH còn chạy `npm audit --audit-level=high` cho web và backend. Audit không chứng
minh exploit; lỗi registry/network cũng là chưa hoàn thành, không phải zero CVE.
Backend có 2 dependency mức High ở baseline (audit 18/10/2026). Nhánh
`fix/g2g-backend-security-dependencies` nâng static/Nodemailer và thêm
`tests/backend-dependencies.test.mjs` vào HIGH/CI để kiểm tra thư viện thật:
static roots, Brotli, range, traversal và MIME/email access guards, không SMTP thật.
Xem bằng chứng theo candidate trong `ENGINEERING_AUDIT.md`; không suy main đã vá.
Không giấu baseline bằng allowlist rỗng hoặc `continue-on-error`.

## Bản đồ chọn owner tests

| Phạm vi | Kiểm thử bổ sung / điểm cần giữ |
| --- | --- |
| UI/theme/charts | `theme`, `badge-colors`, `monitor-chart`, `dashboard`, `disclosure-motion`, `name-confirm`; đây chủ yếu source/HTML và behavior doubles, không screenshot |
| Exam/part template | `goethe-*`, `telc-b1`, `fid`, `part-template-a1-listening`, `preview`, `gap-bank`; đọc spec đúng part trước |
| Score/result/publication | `gradebook`, `provisional-result`, `attempt-result`, `publication` + `publication.integration.mjs` |
| Attempt save/network | `test:sync`, `test:performance`, `exam-completion.integration.mjs`, `performance-http.integration.mjs`; deadline/conflict/offline/retry |
| Auth/access | `production-auth`, `security-preflight`, `backend-access.integration.mjs`; owner/admin/student negatives |
| Media/R2 | `test:r2`, `media-gc`, `copy-media`, `image-paste`; references, fallback, upload limits |
| Speaking/delete/archive | `speaking-lab`, `speaking-devices`, SQL `speaking-lab`/`speaking-archive`, DOM `speaking-phone`; retries, CSRF, Drive ownership |
| Backup/restore/deployment | `backup-*`, isolated restore workflow, Docker import closure `vps-backend`; do not run a real restore on production |

Tên ngắn trong bảng là `tests/<name>.test.mjs`. Một số file được import bởi suite
khác; không đếm số file là số test độc lập/coverage. Không tự chạy mọi `.mjs` bằng
glob: fixtures, benchmarks và integration có prerequisites khác nhau.

## Công cụ: lựa chọn tối giản

| Công cụ | Quyết định v1 | Lợi ích / chi phí / điều kiện |
| --- | --- | --- |
| Node assert + scripts hiện có | Giữ; thêm risk runner không dependency | hợp ESM/native JS; ít migration, không đổi assertion hiện tại |
| Vitest/Jest | Chưa thêm | trùng vai trò hiện có; chỉ cân nhắc khi test isolation/reporting cần hơn chi phí migration |
| Playwright | Đề xuất pilot sau khi cho phép browser | lấp khoảng trống browser/E2E/screenshots; browser binaries/OS/font/baseline có chi phí CI; không giả lập là đã có |
| axe-core | Ghép pilot Playwright sau phê duyệt | tìm role/name/contrast tự động; không thay keyboard và screen reader review |
| ESLint | Đề xuất scope file mới/touched sau baseline | semantic lint tốt hơn `node --check`, nhưng cần cấu hình browser/server globals; không ép sửa hàng loạt legacy |
| Prettier | Chưa thêm/autofix | code đang compact; bulk reformat làm diff nhiễu và tăng conflict, không giải quyết bug hành vi |
| npm audit | Đã thêm CI job và HIGH | miễn phí, dùng lockfile, không auto fix; blocker có triage, phụ thuộc registry |
| Secret scanning / gitleaks | Đề xuất rollout riêng | baseline/allowlist fixtures phải review; không in secret vào log, không khẳng định zero secrets từ grep |
| GitHub required checks | Cấu hình đề xuất, chưa thay setting repo | cần quyền owner và policy; YAML chỉ tạo status, không tự chặn merge |

## Bằng chứng và bàn giao

Ghi **đã kiểm chứng** (command + exit + môi trường), **chưa kiểm chứng**, **giả
định** và **đề xuất** thành các mục khác nhau. Kết quả local khác CI Node22/Ubuntu
phải nói rõ. Green test không xác nhận visual, WCAG AA, exploitability, độ ổn định
VPS hoặc khả năng phục hồi backup thật.

Không mở browser khi chưa được cho phép, không phát sinh chi phí external calls,
không sửa production qua một test. Nếu thiếu visual/E2E, báo phần còn thiếu; không
gọi toàn bộ task “UI verified”. Quy trình release/rollback nằm ở `ENGINEERING.md`.
