# G2G Exam — AI Working Rules

Chat mới bắt đầu từ `../README.md` ở Git root: tìm checkout, kết nối hiện có,
thứ tự tài liệu và trạng thái branch/PR. Không suy quyền truy cập từ tài liệu.

## Engineering workflow — đọc trước khi triển khai

- `docs/ENGINEERING.md`: Understand → Design → Implement → Self review → Test →
  Quality gate → Delivery; owner và UI/UX checklist, feature branch/release/rollback.
- `docs/QUALITY_GATES.md`: chọn LOW/MEDIUM/HIGH theo ảnh hưởng, lệnh chạy thực tế
  và giới hạn bằng chứng. Không báo đã kiểm thử nếu chỉ đọc code hoặc in test plan.
- `docs/MAINTENANCE.md`: tìm module chịu trách nhiệm; `docs/UI_STYLE.md`: UI đã duyệt;
  `specs/README.md` và APPROVED specs: luật thi. Không copy quy tắc sang tài liệu mới.
- Mặc định làm trên feature branch, tự kiểm tra và chuẩn bị thay đổi cho review.
  Request cấm deploy/audit-only luôn ưu tiên hơn quyền deploy thường lệ ở mục 15.
  Workflow v1 ban đầu audit-only. Ngày 18/10/2026 owner đã cho phép phát hành
  1.3.208 qua PR/main sau gate; không sửa dữ liệu hoặc hạ tầng production.
  SSH timeout: owner chấp thuận theo dõi public health/version, không suy đã
  xác minh backup hoặc deploy SHA từ VPS. Request mới nhất luôn quyết định scope.
- Chỉ hỏi khi repository không giải quyết được quyết định quan trọng về nghiệp vụ,
  chi phí, quyền truy cập hoặc rủi ro cao; thay đổi nhỏ không cần tài liệu/confirm dư.

Giao diện dùng quy chuẩn đã chốt trong `docs/UI_STYLE.md`. Khi sửa UI, đọc tài liệu
này và dùng token/component chung; không chồng thêm các lớp style toàn site.

Rule floating: tại mọi bố cục nhiều cột, toàn bộ nội dung trong mỗi cột phải
được gom thành một khối và di chuyển cùng nhau; không floating riêng từng phần
trong cùng cột. Chi tiết trình bày theo `docs/UI_STYLE.md`.

## Security review với Cloudflare security-audit

Owner yêu cầu tích hợp. Dùng skill `security-audit` từ
[repository chính thức Cloudflare](https://github.com/cloudflare/security-audit-skill),
đường dẫn upstream `skills/security-audit`; bản đã cài được ghim tại commit
`c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` trong `~/.codex/skills/security-audit`.
Máy khác dùng skill-installer để cài đúng nguồn/ref này; không tải hoặc chạy mã
cài đặt ngẫu nhiên. Không coi skill là công cụ runtime hay một check CI tự chạy.

- Với thay đổi auth/quyền, dữ liệu học viên, upload, AI/tool, secret, webhook,
  dependency hoặc triển khai: dùng guidance mode để review đúng phần thay đổi
  và các trust boundary liên quan. Chỉnh sửa giao diện/text nhỏ không cần audit
  toàn bộ và vẫn theo luồng gọn ở mục 11.1.
- Full audit sáu giai đoạn chỉ chạy khi owner yêu cầu audit codebase đầy đủ hoặc
  báo cáo audit. Khi đó làm theo SKILL.md và các tài liệu upstream, bao gồm
  verifier độc lập, coverage ledger và validator; không tự suy đã audit xong
  chỉ vì đã cài skill. Lưu báo cáo riêng ngoài repository, không commit finding
  chưa công bố vào repository công khai.
- Kiểm tra source mặc định chỉ đọc. Không thử trên VPS, dịch vụ thật hoặc dữ liệu
  học viên. Việc cài/tích hợp không cấp quyền chạy test/build local; mục 10 vẫn
  áp dụng. Kiểm chứng động cần quyền phù hợp và môi trường cô lập đúng yêu cầu
  của skill; thiếu điều kiện thì ghi `needs_validation`, không nâng thành confirmed.
- Findings cần bằng chứng đường đi dữ liệu và ảnh hưởng thực tế; phân biệt
  `confirmed`, `needs_validation`, `rejected`. Skill bổ sung cho CI hiện hữu,
  không thay thế kiểm thử, không bypass gate và không bảo đảm hết lỗ hổng.

## 1. Mục tiêu

G2G Exam là hệ thống thi thử tiếng Đức.

Hệ thống hỗ trợ:

- Goethe: A1, A2, B1, B2
- TELC: B1, B2, C1, C2

Các vai trò chính:

- Student
- Teacher
- Master Admin


## 2. Nguyên tắc quan trọng nhất

KHÔNG tự suy đoán quy tắc của Goethe hoặc TELC.

Nếu một Level / Skill / Part chưa có specification được APPROVED:

- Không tự nghĩ ra cấu trúc.
- Không copy cấu trúc của Part khác.
- Không giả định hai Part giống nhau.
- Không tự quyết định số câu, thời gian, điểm, audio hoặc cách chấm.

Phải hỏi hoặc chờ specification được duyệt.


## 3. Source of Truth

Quy tắc nghiệp vụ chính thức nằm trong:

    /specs/

Code phải tuân theo specification.

Nếu code và specification khác nhau:

    specification APPROVED được ưu tiên.

Nếu specification đang là DRAFT hoặc TODO:

    không được coi đó là quy tắc production.

Một rule chỉ nên có một Source of Truth. Không copy cùng một rule sang nhiều file; nơi khác chỉ tham chiếu khi cần.


## 4. Cấu trúc bài thi

Cấu trúc chuẩn:

    Provider
      → Level
        → Exam
          → Skill
            → Part
              → Part Template
                → Questions

Ví dụ:

    GOETHE
      → A1
        → Exam
          → LISTENING
            → PART 01
              → Questions

Mỗi Part có thể có cấu trúc khác nhau nếu specification yêu cầu.


## 5. Part Template

Không xây một editor khổng lồ cho toàn bộ hệ thống.

Mỗi Part chỉ có module riêng khi hành vi của nó thực sự khác.

Những phần giống nhau giữa nhiều Part phải tái sử dụng shared component/service/validator/config thay vì nhân bản code.

Ví dụ:

    GOETHE.A1.LISTENING.PART_01

có thể khác:

    GOETHE.A1.LISTENING.PART_02

nhưng phần dùng chung giữa chúng phải được tách và tái sử dụng.


## 6. Quy tắc kiến trúc và sửa code

Bắt buộc ưu tiên kiến trúc module hóa:

- module nhỏ và có trách nhiệm rõ ràng;
- một chức năng/rule chỉ có một nơi sở hữu chính;
- logic dùng chung phải tách thành shared module/helper/service/config;
- tránh duplicate code và duplicate business rule;
- tránh module chồng chéo trách nhiệm;
- tránh hard-code theo vị trí;
- tránh file monolith;
- ưu tiên registry/config/composition hơn chuỗi if/else lớn;
- không tạo abstraction hoặc module mới nếu nó không làm giảm trùng lặp hay làm rõ trách nhiệm.

Khi thêm chức năng mới, trước tiên phải kiểm tra xem đã có module phù hợp để mở rộng hay chưa.

Không thêm logic nghiệp vụ Goethe/TELC trực tiếp vào app.js nếu có thể đặt trong spec, controller, service hoặc part-template phù hợp.

Mục tiêu: một thay đổi nghiệp vụ chỉ cần sửa ở ít nơi nhất có thể, lý tưởng là một Source of Truth + các test liên quan.


## 7. Xóa dữ liệu

Mặc định sử dụng soft delete / Trash.

Không xóa vĩnh viễn dữ liệu đang được tham chiếu.


## 8. Media

Audio và ảnh phải được quản lý có kiểm soát.

Không xóa media đang được tham chiếu.

Media orphan chỉ được garbage collector xóa sau grace period.

Xóa file liên quan ngay sau khi Permanently Delete nếu file không còn bất kỳ tham chiếu hợp lệ nào.


## 9. Trước khi code

AI phải xác định:

- Provider
- Level
- Exam
- Skill
- Part
- specification tương ứng
- trạng thái specification
- module đang sở hữu chức năng cần sửa
- phần nào đã có thể tái sử dụng

Nếu không xác định được thì không được tự suy đoán.


## 10. Sau khi code

Owner cập nhật ngày 23/10/2026: không tự chạy test, syntax gate hoặc build local
trừ khi người dùng yêu cầu. Sửa đúng phạm vi, tự đọc lại diff và ưu tiên đưa bản
cập nhật lên ngay qua quy trình PR đã được cho phép.

Các kiểm tra bắt buộc trên GitHub vẫn là điều kiện merge: chờ đúng candidate
đạt, không tắt/bypass check, không bật auto-merge hoặc dùng main để thử việc.
Kiểm thử và build do CI thực hiện không cần chạy lặp lại local. Nếu thiếu bằng
chứng an toàn cần thiết cho thay đổi rủi ro cao mà CI không bao phủ, báo rõ phần
còn thiếu và xin hướng xử lý thay vì tự bỏ qua. Không báo đã test khi chưa chạy.


## 11. Phạm vi thay đổi

Khi người dùng yêu cầu sửa một Part:

chỉ sửa phạm vi tối thiểu cần thiết.

Ví dụ yêu cầu:

    Goethe A1 → Nghe → Bài 2

không được tự ý sửa:

    Goethe A1 → Nghe → Bài 1
    Goethe A2
    TELC
    Student grading

trừ khi dependency thực sự yêu cầu.

## 11.1. Tốc độ thực hiện (người dùng duyệt 2026-10-12)

- Khoanh đúng phạm vi, ưu tiên mở rộng module đang sở hữu chức năng và tái sử
  dụng module đã có; không rà soát hoặc refactor lan rộng khi không cần cho yêu
  cầu hay dependency thực sự.
- Không thực hiện thao tác lặp hoặc kiểm tra ngoài phạm vi chỉ để “cho chắc”.
  Khi có blocker, báo sớm với bằng chứng; không hứa thời gian hoàn thành khi
  không có cơ sở.
- Áp dụng quy tắc mới nhất ở Mục 10: không tự chạy kiểm thử/build local, kể cả
  cho tài liệu quy trình. Giữ các gate CI bắt buộc và không merge khi chúng lỗi.
- Owner nhắc lại 23/10/2026: chỉnh sửa nhỏ dùng luồng gọn — tìm đúng owner,
  sửa tối thiểu, đọc diff + `git diff --check`, rồi commit/PR và merge ngay khi
  CI bắt buộc đạt. Không thêm kế hoạch/tài liệu riêng, nghiên cứu, refactor,
  kiểm tra lặp hoặc mở rộng tính năng ngoài yêu cầu. Không kiểm tra VPS/version
  sau phát hành khi chưa được yêu cầu. Chỉ thêm bước khi có rủi ro cụ thể hoặc
  dependency thực sự; báo ngắn gọn lý do, không dùng “cho chắc” để kéo dài việc.


## 12. Quy tắc khi yêu cầu chưa rõ

Không đoán.

Hãy chỉ ra chính xác phần còn thiếu và hỏi lại trước khi xây dựng.


## 13. Nguyên tắc ưu tiên

Rule được duyệt 13/10/2026: số câu là thứ tự liên tục của toàn đề thi, không
đếm lại theo bài hoặc kỹ năng. Dùng chung quy tắc ở editor, bài thi, xem trước,
kết quả/chấm bài và mọi thông báo lỗi. Ví dụ không chiếm số; mọi bài viết, kể cả
phần chỉ có một câu, đều hiện nhãn theo thứ tự chung (owner cập nhật 23/10/2026). Không đổi số trong nội dung tác giả
đã nhập hoặc mã định danh dữ liệu.

Mọi khung đề bài dùng chung cấu trúc: nội dung, tải ảnh, max-width ảnh có đơn vị
px và tooltip; chỉ bài nghe có tải audio. Có nút lên, xuống, ×, +; không có
dropdown vị trí. Lên/xuống di chuyển cả khung và media qua câu hoặc khung bên
cạnh. Đoạn điền khuyết/bảng ngang liền khối di chuyển nguyên khối.

Thứ tự ưu tiên:

1. Specification đã APPROVED.
2. Không trùng lặp/chồng chéo Source of Truth.
3. Automated tests.
4. Kiến trúc module hóa.
5. UI/UX.
6. Tối ưu thêm.

## 14. Quy tắc tải dữ liệu (người dùng duyệt 2026-10-12)

- Danh sách chỉ tải metadata/thống kê cần hiển thị; không tải kèm nội dung câu hỏi,
  media, đáp án, câu trả lời hoặc snapshot bài làm.
- Chỉ tải chi tiết khi mở nghiệp vụ cần dữ liệu đó. Không dùng dữ liệu danh sách
  thiếu trường để ghi đè bản đầy đủ. Kiểm tra phân quyền ở máy chủ cho mỗi luồng.
- Phiên bản dữ liệu phải phản ánh nội dung, không dùng thời gian của mỗi request.
  Dữ liệu không đổi: trả phản hồi có điều kiện, không cập nhật state/vẽ lại trang.
- Không để polling chồng request, ghi đè thao tác mới bằng response cũ, hoặc chạy
  khi tab ẩn. Tái sử dụng luồng tải đang chạy; không tải toàn bộ dữ liệu chỉ để lọc.
- Kiểm thử tải lần đầu, URL trực tiếp/F5, đổi trang, lưu đề, bài thi đang làm,
  quyền truy cập và dữ liệu lớn trước khi triển khai thay đổi luồng tải.

## 15. Commit và triển khai

Phiên bản được đặt tại `src/release.js`. Mỗi bản cập nhật sau
phải tăng phiên bản theo major.minor.patch; mặc định tăng patch cho sửa nhỏ.
Owner đổi quy tắc ngày 22/10/2026: bắt đầu từ 1.4.0, mỗi thành phần là số nguyên
từ 0 đến tối đa 10 (bao gồm 10). Sau patch 10, tăng minor và đặt patch về 0:
1.4.10 → 1.5.0; sau minor 10: 1.10.10 → 2.0.0. Không dùng .11 hoặc .252.
Nếu major đã là 10 và cần chuyển tiếp, hỏi owner thay vì tự vượt giới hạn.
Thông báo cập nhật chỉ hiện khi máy chủ báo phiên bản khác, và chỉ tải lại
ở màn hình an toàn; không ngắt editor, chấm bài hoặc bài thi đang làm.

Xác nhận thêm ngày 2026-10-12: người dùng yêu cầu đẩy cả bản Cài đặt trước và
bản dashboard/feedback lên main. Không hỏi lại xác nhận cho các bước triển khai
thông thường đã được cho phép; vẫn tuân thủ giới hạn an toàn và quyền hệ thống.

Người dùng đã cho phép commit và deploy các thay đổi thuộc yêu cầu của họ
(xác nhận ngày 2026-10-11). Sau khi kiểm thử đạt, chủ động commit và push lên
main để triển khai website, không cần hỏi lại cho từng lần.
Chỉ đưa thay đổi thuộc phạm vi công việc vào commit; không gộp thay đổi không
liên quan của người dùng. Quyền này không bao gồm xóa dữ liệu, phá hủy lịch sử
Git hoặc bỏ qua kiểm thử và các yêu cầu an toàn.
