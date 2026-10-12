# G2G Exam — AI Working Rules

Giao diện dùng quy chuẩn đã chốt trong `docs/UI_STYLE.md`. Khi sửa UI, đọc tài liệu
này và dùng token/component chung; không chồng thêm các lớp style toàn site.

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

Phải chạy:

- syntax check;
- automated tests liên quan;
- full G2G Exam test nếu thay đổi kiến trúc hoặc nghiệp vụ;
- kiểm tra không tạo duplicate logic/rule mới;
- đảm bảo mọi chức năng đều có ý nghĩa và sử dụng được.

Không merge vào main khi test fail.


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


## 12. Quy tắc khi yêu cầu chưa rõ

Không đoán.

Hãy chỉ ra chính xác phần còn thiếu và hỏi lại trước khi xây dựng.


## 13. Nguyên tắc ưu tiên

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

Xác nhận thêm ngày 2026-10-12: người dùng yêu cầu đẩy cả bản Cài đặt trước và
bản dashboard/feedback lên main. Không hỏi lại xác nhận cho các bước triển khai
thông thường đã được cho phép; vẫn tuân thủ giới hạn an toàn và quyền hệ thống.

Người dùng đã cho phép commit và deploy các thay đổi thuộc yêu cầu của họ
(xác nhận ngày 2026-10-11). Sau khi kiểm thử đạt, chủ động commit và push lên
main để triển khai website, không cần hỏi lại cho từng lần.
Chỉ đưa thay đổi thuộc phạm vi công việc vào commit; không gộp thay đổi không
liên quan của người dùng. Quyền này không bao gồm xóa dữ liệu, phá hủy lịch sử
Git hoặc bỏ qua kiểm thử và các yêu cầu an toàn.
