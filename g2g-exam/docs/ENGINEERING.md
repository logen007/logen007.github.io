# G2G Engineering Workflow v1

Áp dụng cho Codex và người phát triển. Đây là quy trình làm việc, không phải
specification thi hoặc quyền tự động thay đổi production.

## Nguồn sự thật và cách tìm module

- `AGENTS.md`: điều phối và giới hạn an toàn.
- `specs/README.md`, specification **APPROVED** và loader `src/exam-specs/`:
  luật thi. Đọc đúng provider/level/skill/part bị tác động; không suy luận từ đề khác.
- `docs/UI_STYLE.md`: phong cách và hành vi UI đã được duyệt. Không lập bảng màu
  hoặc danh sách kích thước thứ hai trong tài liệu này.
- `docs/MAINTENANCE.md`: bản đồ module nghiệp vụ; mở rộng owner thay vì copy logic.
- `docs/QUALITY_GATES.md`: mức rủi ro, lệnh kiểm thử, giới hạn bằng chứng.
- `docs/ENGINEERING_AUDIT.md`: hiện trạng, vấn đề có bằng chứng và backlog ưu tiên.
- `docs/disaster-recovery/RESTORE.md`: quy trình khôi phục dữ liệu; không thay bằng
  thao tác rollback source code.

Không ghi đè thay đổi của người khác, đổi framework, thêm dịch vụ hoặc dependency
chỉ để hợp sở thích. Quy tắc nghiệp vụ, quyền truy cập và dữ liệu production là
ranh giới cứng, kể cả khi UI/UX được ưu tiên cao.

## Chu trình cho mỗi yêu cầu

1. **Understand.** Đọc request mới nhất, status/diff, tài liệu và owner liên quan.
   Ghi nhận mục tiêu, điều kiện đạt, phần không đổi, rủi ro và dependency.
   Nếu không đụng luật thi, ghi N/A thay vì tự gán provider/part. Chỉ hỏi khi thiếu
   quyết định nghiệp vụ, quyền, chi phí hoặc phạm vi phá hủy thật sự.
2. **Design.** Với UI: xác định tác vụ chính, số bước, hierarchy, component tái dùng,
   responsive, trạng thái và keyboard trước khi viết CSS. Với API: xác định auth,
   dữ liệu tối thiểu, timeout, retry/idempotency và lỗi. Việc nhỏ làm ngắn gọn trong
   working notes, không tạo PRD hoặc abstraction không cần thiết.
3. **Implement.** Làm trên feature branch, sửa đúng owner, giữ public contract,
   snapshot và dữ liệu đang nhập. Thêm regression tái hiện vấn đề khi khả thi.
   Không dùng style override chồng lên override để né tìm nguyên nhân.
4. **Self review.** Đọc diff cuối cùng, không chỉ đoạn vừa viết: đơn giản hóa được
   không; có duplicate, edge case, leak dữ liệu, quyền sai, race hoặc module bị
   ảnh hưởng không? Tách kết quả tự review khỏi review độc lập của người khác.
5. **Automated test.** Chọn gate theo rủi ro trong `QUALITY_GATES.md`, bổ sung test
   theo owner. Chạy thật và giữ exit status. Không gọi source-string assertion là
   E2E, screenshot, kiểm tra accessibility toàn diện hoặc browser rendering.
6. **Quality gate.** Chỉ gọi đủ điều kiện phát hành khi test/build bắt buộc đạt,
   không có blocker security/specification, UI checklist được đáp ứng, có rollback
   khả thi và các phần chưa kiểm chứng được nêu rõ. “Automated gate passed” không
   tự động có nghĩa “UI đẹp” hoặc “production an toàn”.
7. **Delivery.** Tóm tắt thay đổi, file chính, lệnh/kết quả, chưa kiểm chứng, rủi ro,
   branch/commit/PR và trạng thái deploy. Không nói “đã lên web” từ một commit local.

## UI/UX design contract

Trước khi sửa, tự trả lời: người dùng đến đây làm gì, hành động ưu tiên là gì,
có thể giảm thao tác nào mà không mất ý nghĩa/quyền kiểm soát, và lỗi phải phục hồi
thế nào? Giữ tác vụ chính rõ hơn trang trí. Không thêm animation chỉ vì có thể.

| Thành phần | Owner để tái sử dụng | Điều cần tự kiểm tra |
| --- | --- | --- |
| Button/icon/field | `styles.css`, `src/ui/icons.js` | hierarchy, name, focus, disabled/loading, touch target |
| Brand và semantic colors | `src/settings/palette.js`, token trong `styles.css` | cặp sáng/tối; selected khác keyboard focus |
| Modal/confirmation | `src/views/modals.js`, `src/ui/confirm.js` | name, Escape, tab order, focus trở về trigger, lỗi không mất input |
| Menu/tab/filter | `src/ui/layout.js`, `src/settings/tabs.js`, view owner | URL/history, selected/filter reset, keyboard, label còn ý nghĩa |
| Accordion | `src/ui/disclosure-motion.js`, native details | cả mở/đóng, đảo chiều, nội dung động, reduced motion |
| Tables/cards/charts | `src/views/`, tokens và layout hiện có | long text, no-data/error, trục chữ không bị scale, overflow cục bộ |
| Async/save/feedback | controller/repository của tác vụ | không double submit, giữ draft, retry rõ, không giả thành công |

Không cần tạo component JS cho mọi wrapper. Extract khi giảm trùng lặp hoặc làm
rõ ownership; không làm thư viện UI mới song song với `.nut`, `.truong`, `.icon-btn`.

Owner preference (19 October 2026): prioritize fast, scoped edits; owner handles
visual acceptance. For LOW-risk text-only changes, skip browser/screenshot matrices,
repeat audits and redundant local full suites. Run only changed-file syntax and
the nearest regression locally; required CI tests/build still gate the exact
candidate before release. This preference does not waive security or higher-risk
checks, or authorize bypassing protected checks. State when visuals were not reviewed.

Với thành phần bị thay đổi, kiểm tra hoặc đánh dấu N/A có lý do cho **default,
hover, focus-visible, active, selected, disabled, loading, empty, error, success**.
Selected là trạng thái nghiệp vụ; focus-visible dành cho bàn phím. Tuân thủ quy
tắc lựa chọn và màu trong `UI_STYLE.md`, không dùng outer ring để báo selected.

### Tiêu chí UI trước bàn giao

- Tác vụ chính có thứ bậc rõ, không có nhãn/thao tác dư và không làm mất ngữ cảnh.
- Token/component chung, typography và spacing theo `UI_STYLE.md`; không màu
  brand thay cho trạng thái semantic. Preview phải theo color mode đang hiển thị.
- Xét ít nhất 320/390/768/1440px, cả sáng/tối, tên dài và số liệu lớn. Đây là
  **ma trận cần xét**, không phải tuyên bố đã render các kích thước đó.
- Không tràn trang, crop nội dung thi, chữ méo, nút chồng nhau hoặc zoom input
  ngoài ý muốn; giữ pinch zoom và touch target.
- Keyboard có đường đi hợp lý, accessible name, feedback/lỗi có thể nhận biết
  ngoài màu; focus không bị mất sau mở/đóng hoặc cập nhật bất đồng bộ.
- Chuyển động có mục đích, có reduced-motion; không rebuild bài thi khi đổi theme.
- Không mở browser, kể cả headless, khi chưa được người dùng cho phép. Nếu chưa
  kiểm tra trực quan, ghi rõ và không tự chấp nhận baseline ảnh.

### Visual regression miễn phí — đề xuất có điều kiện

Playwright + screenshot assertion + axe-core có thể chạy local/GitHub Actions,
không cần SaaS hoặc Figma. Chưa cài và chưa chạy browser trong bản workflow v1.
Sau khi được phép: ưu tiên preview fixture tổng quan/settings/result và một luồng
exam, dùng dữ liệu tổng hợp, chặn Google/AI/Drive/SMTP thật, cùng OS/browser/font,
chờ font và dữ liệu, cố định thời gian/mask dữ liệu động, tắt motion trong ảnh.
Lưu ảnh expected/actual/diff khi fail; người review duyệt baseline, không tự
`--update-snapshots` để làm CI xanh. Ảnh đẹp không thay test hành vi hoặc WCAG.

## Branch, review và phát hành

`feature/<task>` → implementation → gates → self review/PR review → quyết định
merge → main → VPS auto-deploy → health/version + critical-flow verification.

- Check dirty tree trước checkout; không reset/stash thay đổi không thuộc tác vụ.
- Commit intent rõ (`fix`, `feat`, `docs`, `test`, `ci`, `chore`), nhỏ và coherent.
  Không gộp cải tiến ngoài phạm vi. Workflow/docs-only không tăng `src/release.js`.
- PR dùng `.github/pull_request_template.md`. Không coi tự review là independent
  approval. Không merge khi gate lỗi; không bật auto-merge để né review.
- `main` được VPS poll mặc định mỗi khoảng 20 giây theo script hiện có. Push main
  là một hành động phát hành, không phải chỗ thử CI. CI và timer hiện chưa liên
  kết: test fail trên main không ngăn timer lấy commit đó.
- Khi request chỉ audit/chuẩn bị duyệt hoặc cấm deploy: dừng ở feature branch;
  không merge/push main, không đổi timer, không tăng version, không gọi VPS.
- Branch protection/required checks phải được owner phê duyệt và cấu hình ở
  GitHub; YAML không tự bật được policy. Đề nghị yêu cầu `check` và
  `dependency-audit`, không bypass. Owner đã bật ruleset `Protect main` ngày
  18/10/2026: required checks `check` và `dependency-audit` từ GitHub Actions,
  strict up-to-date, PR với 0 approvals, chặn xóa/force push. Đây là trạng thái
  đã đọc lại qua API; phải kiểm tra lại khi phát hành, không suy từ YAML.
- Khi được phép phát hành sản phẩm: tăng patch theo `AGENTS.md`, kiểm tra gates
  trên exact candidate SHA và tình trạng backup, rồi mới merge/push theo quyền.
- Sau deploy, dùng `npm run verify:release -- <origin> <version>` **chỉ khi được
  phép kiểm tra môi trường đó**. Tool chỉ GET, kiểm tra HTTP + JSON health DB +
  version, không chứng minh login, UI, media, email hoặc đúng Git SHA. Đối chiếu
  SHA trong deploy state/log; không suy từ version string là đủ.
- Từ 1.3.209, auto-deploy dùng cùng probe trong container và expected version
  đọc từ checkout. Chỉ ghi deployed-sha khi HTTP + JSON health/database/backend
  và version cùng đạt; timeout/mismatch giữ last-good SHA và retry hữu hạn.
  Script được timer đọc từ checkout ở lần gọi tiếp theo; không suy lần triển
  khai mang chính bản sửa này đã chạy script mới. Không sửa timer/hạ tầng.

### Rollback và khi phát hành lỗi

1. Dừng phát hành tiếp; ghi candidate/last-good SHA, migration và triệu chứng.
2. Với code tương thích schema: chuẩn bị revert commit trên branch, chạy gate,
   review và merge khi được cho phép. Không dùng force-push/reset main; timer sẽ
   triển khai revert qua luồng bình thường.
3. Khẩn cấp cần chạy image/source cũ: operator có quyền phải kiểm soát timer
   trước, nếu không timer có thể deploy lại main lỗi. Đây là đề xuất vận hành,
   không phải quyền tự chạy lệnh systemd hoặc Docker trong tác vụ audit.
4. Migration không tương thích không được rollback source mù quáng. Dùng kế
   hoạch forward-fix hoặc restore cô lập theo tài liệu disaster recovery, có
   phê duyệt dữ liệu/traffic. Không ghi đè live DB hoặc xóa volume.
5. Kiểm tra lại semantic health/version, luồng trọng yếu và lỗi còn lại; không
   ghi “rollback đã được chứng minh” nếu mới đọc script hoặc chạy mocks.

## Cải tiến liên tục mà không phình tài liệu

Sau một regression: ghi reproduction, owner, thiếu test nào và thêm test tại owner.
Nếu thành quy tắc UI lâu dài, cập nhật đúng mục `UI_STYLE.md`; nếu đổi gate, sửa
`QUALITY_GATES.md` và runner/test cùng lúc. Không tạo bản sao rubric hoặc checklist
cho mỗi task. Đề xuất cải tiến phát hiện ngoài phạm vi với ưu tiên/bằng chứng,
không tự mở rộng thành refactor. Định kỳ xem: bug UI lặp lại, flaky tests, thời gian
gate, test không được chạy, dependency alerts và kết quả restore drill. Chưa có
baseline số liệu thì không đưa mục tiêu phần trăm hoặc “quality score” giả.
