# Engineering audit — 18/10/2026

Baseline: `a9059c34f31fc2f4b825e45ef1e6c08c2e662605`, app `1.3.207`.
Candidate: `feature/g2g-engineering-workflow-v1`. Audit source/local tests và
GitHub public metadata; không mở browser, truy cập VPS, đọc secret hay sửa dữ
liệu production. Không coi nguồn mẫu/APPROVED là chứng thực lại luật thi chính thức.

## Kết luận

Nền tảng native ESM + Fastify/PostgreSQL có nhiều phần tốt: domain dùng chung,
approved-spec loader, immutable attempt snapshots, queue/outbox, SQL integration
và build content-addressed. **Không có cơ sở đổi framework hoặc viết lại app.**

Khoảng trống lớn nằm ở điều phối chất lượng: CI chưa chạy PR ở baseline; timer
deploy độc lập CI; bằng chứng UI phần lớn là HTML/source assertion chứ không phải
rendered layout; test SQL có file stale chưa được CI chạy; dependency audit chưa
là gate. Codex có đủ component/token để làm UI tốt nhưng quy trình cũ chưa đủ để
tự chứng minh UI đẹp, đồng nhất light/dark và responsive sau mọi thay đổi.

## A. Architecture — đã kiểm tra source

| Phần | Điểm tốt | Rủi ro / hướng cải thiện |
| --- | --- | --- |
| Domain/spec | `src/domain`, `src/exam-specs`, `specs`; loader từ chối non-APPROVED, chống inheritance cycle | Giữ source of truth; không duplicate arithmetic trong views. Inventory 61 JSON đều APPROVED, không có nghĩa mọi level đã configured |
| UI composition | `src/views`, `src/ui`, per-part templates, shared icons/palette | `src/app.js` 1618 dòng ở baseline, vừa navigation vừa binding/runtime orchestration; tách owner khi có task cụ thể, không refactor toàn cục |
| Data/API | repositories/controllers; summary/detail scopes, request timeout, bounded identity caches | Có nhiều request helper theo feature; chỉ hợp nhất khi chứng minh duplication behavior. Cache/scope cần test stale response và failure, không thay detail bằng metadata |
| Persistence | `server/src/db.js` withTx/query; handler auth và snapshot/domain separation | JSONB schema cùng shared-module Docker COPY cần kiểm tra transitive imports; không chỉ chạy syntax hoặc mock SQL |
| Async | durable outbox, provider job lanes, Drive archive stable IDs/checksum, retry | Crash/network/late writes là high-risk; test provider doubles không chứng minh Drive/100ms thật |
| Errors/state | explicit loading/empty/error ở nhiều views; native timeouts và queue statuses | Có catch im lặng chủ đích (cache/best effort) lẫn public fallback; chưa có inventory correlation/error taxonomy. Không tự bật logging có PII/secrets |
| Duplication | `core.js` và `actions.js` là facade nhỏ, không còn một domain monolith ở đó | Dialog/custom overlay tồn tại nhiều pattern; component reuse tốt hơn cần state/focus contract, không chỉ chung CSS |

Các module được đọc/đối chiếu gồm `src/app.js`, repository API, core/domain
facades, spec loader/registry, UI styles/palette/dialogs, state/auth/index/db,
queue và test boundaries. Đây là audit đại diện theo owner, **không phải review
từng dòng mọi module hoặc phân tích coupling bằng công cụ chuyên dụng**.

## B. Design-system / UI/UX audit

Không đưa aesthetic score hoặc chứng nhận WCAG khi chưa render. Số đo lexical
ở baseline: `styles.css` 1553 dòng, 206 hex occurrences, 221 custom-property
declarations, 69 media queries; `enhancements.css` 269 dòng, 13 hex occurrences,
14 custom-property declarations, 11 media queries. Đây là số occurrence, **không
phải** số token duy nhất hoặc 219 lỗi hardcode: token definitions, SVG và semantic
exceptions cũng có hex hợp lệ.

| Nhóm kiểm tra | Bằng chứng hiện có | Chưa đủ / hành động |
| --- | --- | --- |
| Naming/ownership | `.nut`, `.truong`, `.icon-btn`; styles vs enhancements; shared icon module | Tên Việt/Anh và selector compact cùng tồn tại; ưu tiên rõ owner, không mass rename |
| Color/tokens | brand contrast functions, provider/level/status light/dark pairs, palette tests | CSS cascade/inline variable có thể override inheritance; static token match không chứng minh computed style của preview |
| Typography/spacing/layout | UI_STYLE quy định; shared control typography, mobile input rules | Long CSS lines/cascade và scoped overrides làm khó review; require responsive/state checklist, không thêm global override |
| Buttons/fields | hover/focus-visible/disabled, semantic/accessibility names ở nhiều controls | Loading/error states thuộc feature, chưa có component gallery đầy đủ; kiểm tra lại contrast/target/name khi sửa |
| Menus/tabs/modal | native details/dialog ở một số luồng, confirm overlay và role tabs | Không có automated browser focus/keyboard traversal cho mọi overlay; `role=dialog` không tự đảm bảo trap/return focus |
| Mobile/charts | scoped grids/table overflow; HTML axis tách khỏi scaled SVG | Không có screenshot matrix; tests source có thể green dù wrap/crop/overflow sai |
| Motion | reduced-motion, bounded result/theme/disclosure animations | New disclosure test có npm script riêng nhưng chưa trong CI baseline; đã nối vào CI candidate |
| Feedback/forms | outbox/error/retry tests, long-name and read-only-email assertions | Không thay visual/browser accessibility bằng lời báo “build đạt” |

Workflow v1 đã thêm một UI contract: tác vụ → hierarchy → component → state
matrix → mobile/theme/a11y → self-review → bằng chứng. Style/rubric vẫn ở owner
cũ. Visual regression miễn phí được thiết kế thành pilot có điều kiện, không cài
browser hoặc Figma trái preference của người dùng.

## C. Test coverage — loại bằng chứng, không phải phần trăm

Baseline có 113 file trong `tests/` (bao gồm fixtures/scripts, không phải 113 suite
độc lập). `npm test` gọi nhiều entry points và một số import suite khác.

| Loại | Hiện có | Khoảng trống |
| --- | --- | --- |
| Unit/domain | Node assert, timing, score, parsing, navigation, color contrast | Chưa đo line/branch coverage; không suy coverage từ số assertion |
| SQL/API integration | PGlite + Fastify inject, auth doubles, cookie/permission/privacy scenarios | Không thay PostgreSQL concurrency thực, external OAuth/SMTP/AI/Drive hoặc production |
| DOM/UI behavior | VM/doubles và jsdom speaking phone | Chưa browser engine, computed CSS/layout, real permissions/camera hoặc physical mobile |
| Visual regression | Không có Playwright config/baseline ở baseline | Pilot sau cho phép browser; human review ảnh và OS/font ổn định |
| Accessibility | accessible markup assertions, palette contrast, focus selectors | Không có axe/browser suite, screen-reader audit hoặc chứng minh WCAG AA |
| Security | production-auth/security-preflight, SQL ownership/CSRF, backup/OAuth tests | Nhiều static source assertions; chưa có threat-model/pentest và secret scanning được xác nhận |
| Performance | deduplication/payload/queue tests, isolated HTTP/SQL scenarios | Không phải load test VPS p95, memory/CPU budget hoặc capacity guarantee |
| Recovery | isolated recovery scripts/checks và tài liệu drill | Không xác nhận timer/Drive/current backup/restore thật trong nhiệm vụ này |

Một test SQL `publication.integration.mjs` không được CI baseline gọi và vẫn
cho phép sửa published content theo giả định cũ. Candidate sửa **chỉ test** để
khớp UI_STYLE/guard hiện hữu: reject 409 trước unpublish, cho sửa draft sau
unpublish, vẫn kiểm tra snapshot/privacy/version/republication. Không đổi product
code hoặc quy tắc xuất bản để “làm test xanh”.

`backup-media-lock.integration.mjs` dùng PostgreSQL thật, không PGlite. Không nằm
trong runner cô lập mặc định; phải chạy với PostgreSQL dùng riêng và phê duyệt
đúng môi trường, cùng Linux restore drill. Trong phát triển runner, lần gọi trên
localhost không có PostgreSQL đã ECONNREFUSED; không báo đã pass bài này.

## D. GitHub, release, SRE và security

Đã kiểm chứng từ source:

- `G2G Exam Check` baseline có push/workflow_dispatch, chưa có pull_request;
  `G2G Backup isolated checks` chỉ push nhánh backup cụ thể/manual.
- `server/auto-deploy.sh` fetch/reset deployment checkout rồi build/start app;
  syntax và health HTTP được kiểm tra nhưng không đợi GitHub status. Không có
  automatic rollback image/source; failed SHA được retry ở timer sau.
- Health route trả JSON `ok:false,database:false` nhưng HTTP mặc định vẫn 200;
  deploy probe chỉ dùng `r.ok`. Vì vậy có khả năng báo healthy dù DB lỗi.
  **Đây là kết luận từ hai code paths, không phải incident đã tái hiện trên VPS.**
- Version là `src/release.js`; `/api/version` không có commit SHA. Version đúng
  không đủ chứng minh đúng source/migration đang chạy.
- Docker multi-stage esbuild + locked dependencies; cần giữ closure shared imports.
- Secret encryption/server-only patterns và backup controls có test; chưa quét
  toàn Git history, kiểm tra deployment secrets, TLS hoặc settings production.
- Tài liệu backup có cả trạng thái candidate/đã có drill; chưa được đối chiếu
  hệ thống đang cài. Không coi tài liệu INSTALL/ACCEPTANCE là bằng chứng live.

GitHub public read-only API ngày 18/10/2026 trả branch main `protected:false` và
HEAD vẫn đúng baseline. Không kiểm tra org/repository rulesets hoặc bypass quyền,
nên **chưa kết luận toàn bộ repository không có policy**. CI baseline ở commit đó
[đã success](https://github.com/logen007/logen007.github.io/actions/runs/39095661054),
nhưng chưa chạy bộ gate mới của candidate.

### Dependency audit đã chạy

`npm audit --json` trên hai lock trees (registry snapshot 18/10/2026):

- Web: exit 0, tổng 0 advisory tại thời điểm chạy; không phải bảo đảm không lỗ hổng.
- Backend: exit 1, 2 package mức High: `@fastify/static` locked 8.3.0 và
  `nodemailer` locked 7.0.13. Báo cáo fixAvailable chỉ tới major mới; không tự nâng
  hoặc chạy audit fix. Cần triage reachability và compatibility trước release.
- Ví dụ advisory: [Fastify static non-canonical path bypass](https://github.com/advisories/GHSA-8pvw-jcv7-9cmj),
  [Nodemailer SMTP envelope injection](https://github.com/advisories/GHSA-c7w3-x93f-qmm8).
  Advisory không chứng minh endpoint G2G thực tế exploitable; chưa pentest.

## E. Ưu tiên và trạng thái

Audit code/UX/UI tiếp theo: [báo cáo ngày 18/10/2026](CODE_UX_UI_AUDIT_2026-10-18.md).
Báo cáo này phân biệt source audit, automated regressions và local-browser proof;
không thay baseline lịch sử dưới đây hoặc tự suy là đã phát hành.

### Chuẩn bị phát hành 1.3.208 — owner duyệt 18/10/2026

PR #10 đã merge vào nhánh workflow; CI Node 22 Ubuntu của PR #9 tại head
9154c57 đạt `check` và `dependency-audit` (run 39102947222). Owner đã tạo ruleset
Protect main: active/default main, PR approvals 0, strict required checks
`check` + `dependency-audit` (GitHub Actions), chặn xóa và force push.
Owner sau đó cho phép phát hành 1.3.208 qua main tự deploy dù SSH timeout.
Public health trước release: ok/database true, version 1.3.207. Chưa xác minh
backup gần nhất hoặc deploy SHA trên VPS; không tuyên bố có bằng chứng này.
Theo dõi public health + version sau merge, không thay hạ tầng/deploy script.
Các phần candidate/baseline bên dưới là lịch sử trước phê duyệt phát hành này.

### Candidate vá dependency — 18/10/2026

Nhánh `fix/g2g-backend-security-dependencies` dựa trên workflow v1; chưa merge
main, không tăng version hoặc deploy. Nâng `@fastify/static` 8.3.0 → **10.1.6**
và `nodemailer` 7.0.13 → **10.1.2**, pin phiên bản và cập nhật lockfile.
Nguồn upstream: [static releases](https://github.com/fastify/fastify-static/releases/tag/v10.1.6),
[Nodemailer release](https://github.com/nodemailer/nodemailer/releases/tag/v10.1.2).

- Owner: static registration trong `server/src/index.js`; email qua
  `server/src/mail.js`. Không thay API, SMTP settings, secret encryption,
  database/schema, business rules hoặc dữ liệu. Provider/level/skill/part: N/A.
- Node >=22 hiện hữu đáp ứng engines của dependency tree mới. Nodemailer đổi
  packaging sang ESM/CJS exports; ứng dụng dùng public `import 'nodemailer'`,
  không private `lib/` paths. Static vẫn tương thích Fastify 5; case/path guard
  nghiêm ngặt hơn. Kiểm tra cả hai root/prefix hiện dùng.
- Regression thực: Brotli, range, missing file, traversal không lộ sentinel,
  MIME text/HTML/buffer attachment, envelope/reply-to và chặn file/URL attachments.
  Không kết nối SMTP/OAuth/Drive/AI thật. HTTP/SQL integration kiểm tra app routes
  với DB cô lập; không chứng minh cấu hình SMTP/VPS thực tế.
- Forward: review và gate trên branch trước khi cho phép phát hành riêng.
  Rollback code: revert commit dependency cùng lockfile, `npm ci --prefix server
  --ignore-scripts`, chạy gate; bản cũ có advisory nên rollback chỉ là phục hồi
  tương thích, không được coi đã an toàn. Không có migration dữ liệu; mixed
  version không đổi contract. Không thực hiện rollback hoặc deploy trong task này.
- GitHub đọc lại: main chưa protected, repository rulesets trả danh sách rỗng;
  connector báo quyền admin nhưng không có thao tác sửa branch policy. Chưa bật
  required checks, không mở browser hoặc lấy token từ credential để lách giới hạn.
- Self-review PR #9: đã đối chiếu runner, CI read-only/PR trigger, release probe
  và publication fixtures. Không đổi luật sản phẩm để làm test xanh; security
  baseline vẫn chặn PR #9 cho tới khi mang bản vá vào candidate đó. Đây không
  phải independent approval; giữ draft, không merge.
- Kiểm chứng local macOS Node 26.5.0: `npm run quality -- --risk high` đạt
  **33/33**, gồm build, SQL/DOM/HTTP cô lập và hai audit exit 0 (0 vulnerability
  tại registry snapshot 18/10/2026). Dùng PGlite 0.5.8/jsdom 26.1.0 ở temp runtime,
  TMPDIR cô lập; không browser/SMTP thật/production. Node 22 Ubuntu chờ CI,
  không suy kết quả local là bằng chứng production hoặc release approval.

| Ưu tiên | Cải tiến | Trạng thái candidate |
| --- | --- | --- |
| P1 security | Dependency audit/triage, cập nhật có kiểm thử riêng | Đã thêm audit gate; 2 backend High vẫn là blocker, chưa upgrade |
| P1 release | PR checks trước main tự deploy | Đã thêm PR trigger, read-only CI token, timeout/concurrency và PR template; chưa sửa setting/ruleset hoặc timer |
| P1 SRE | Probe semantic health + exact version | Đã thêm tool read-only + regression; chưa nối vào auto-deploy (cần review thay đổi deploy riêng) |
| P1 UI | Design/self-review/state + mobile/theme acceptance | Đã chuẩn hóa trong ENGINEERING; browser/visual pilot chờ cho phép |
| P1 QA | Gate theo rủi ro và test prerequisite/fail-fast | Đã triển khai runner, test runner và nối workflow/disclosure/performance check vào CI candidate |
| P2 QA | Đồng bộ test SQL publication với approved behavior | Đã sửa fixture/assertion, không sửa sản phẩm; thêm vào HIGH |
| P2 architecture | Giảm app.js/cascade coupling từng phần | Backlog khi task liên quan; không mass refactor |
| P2 ops | Required checks, secret scanning, backup drill theo PR | Đề xuất owner policy/rollout riêng; chưa bật settings/dịch vụ |
| P3 tools | Scoped ESLint, optional Playwright/axe | Đã đánh giá; chưa thêm dependencies/browser |

Không tạo ENGINEERING/QUALITY/UX/RELEASE file chồng nội dung: ENGINEERING sở hữu
process/UX/release, QUALITY_GATES sở hữu commands/evidence, UI_STYLE giữ style,
MAINTENANCE giữ owner map; file này chỉ giữ audit baseline/backlog.

## F. Kiểm chứng candidate

- Baseline `npm test`, standalone disclosure và performance regression: đã pass
  trên local Node 26.5.0/macOS. CI dùng Node22/Ubuntu; không đồng nhất môi trường.
- `test:workflow` đã kiểm tra risk parser, path validation, fail-fast/no silent
  skip, missing runtime, child database-env isolation, semantic health/version
  probe, wrong version/HTTP/invalid JSON và CI contract bằng doubles.
- LOW đã chạy toàn bộ 11 bước và pass, gồm build. YAML được parse kiểm tra syntax
  bằng Ruby Psych; đây không phải chứng minh GitHub đã chạy workflow candidate.
- SQL publication đã pass sau khi sửa test stale theo rule hiện hữu.
- HIGH đã chạy thực tế: 31/32 bước pass, gồm syntax, suite hiện hữu, UI contracts,
  SQL/HTTP/DOM integration, build và web audit. Bước cuối backend dependency audit
  exit 1 vì hai package High ở baseline. **Toàn HIGH chưa đạt; không đủ điều kiện
  phát hành**. Không bỏ gate hoặc sửa runtime/dependency để che cảnh báo.
- Chưa kiểm chứng: rendered UI/browser E2E/axe, GitHub candidate run trước push,
  VPS/Drive/OAuth/100ms thật, production rollback/restore, secret history và
  advisory exploitability. Không sửa product runtime, spec, schema, lockfile,
  app version hoặc deploy script.

## Nguồn nghiên cứu cho đề xuất công cụ

- [Node test runner](https://nodejs.org/download/release/v22.17.0/docs/api/test.html):
  native runner đã stable; không cần Vitest chỉ để chạy JavaScript ESM.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) và
  [CI](https://playwright.dev/docs/ci): screenshot baseline cần môi trường ổn định.
- [axe-core](https://github.com/dequelabs/axe-core): automation bổ trợ, không phải
  audit mọi vấn đề accessibility.
- [ESLint flat config](https://eslint.org/docs/latest/use/configure/configuration-files):
  có thể scope files/globals thay vì bulk reformat toàn repo.
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
  và [required-check caveats](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks):
  required policy khác workflow; job name phải rõ, path-filter có thể bỏ trigger.
- [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/): audit-level quyết
  định failure threshold; không dùng automatic major fix cho nhiệm vụ này.
- [GitHub secret scanning](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning):
  cân nhắc khả năng tài khoản/repo trước khi khẳng định đã bật coverage.
