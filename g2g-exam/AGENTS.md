# G2G Exam — AI Working Rules

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

Quy tắc nghiệp vụ chính thức sẽ nằm trong:

    /specs/

Code phải tuân theo specification.

Nếu code và specification khác nhau:

    specification APPROVED được ưu tiên.

Nếu specification đang là DRAFT hoặc TODO:

    không được coi đó là quy tắc production.


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

Mỗi Part có thể có cấu trúc hoàn toàn khác nhau.

Không có Question Bank / Ngân hàng câu hỏi.

Question không tồn tại như một luồng nghiệp vụ độc lập với Exam. Giáo viên tạo và quản lý câu hỏi trực tiếp trong Part của đề thi.


## 5. Part Template

Không xây một editor khổng lồ cho toàn bộ hệ thống.

Mỗi dạng Part đặc biệt phải có module riêng khi cần.

Ví dụ:

    GOETHE.A1.LISTENING.PART_01

không được mặc định dùng cùng logic với:

    GOETHE.A1.LISTENING.PART_02


## 6. Quy tắc sửa code

Ưu tiên:

- module nhỏ;
- trách nhiệm rõ ràng;
- tránh duplicate;
- tránh hard-code theo vị trí;
- tránh file monolith;
- dùng registry/config thay cho nhiều if/else.

Không thêm logic nghiệp vụ Goethe/TELC trực tiếp vào app.js nếu có thể đặt trong spec hoặc part-template.

Không tạo lại Question Bank, picker câu hỏi dùng chung hoặc luồng tạo câu hỏi độc lập nếu không có yêu cầu mới được APPROVED.


## 7. Dữ liệu lịch sử

Không được làm hỏng dữ liệu thi cũ.

Nếu bài thi đã có học viên làm:

- không thay đổi cấu trúc làm thay đổi lịch sử;
- không thay câu hỏi cũ một cách phá vỡ kết quả;
- ưu tiên version mới.

Không reset production database nếu không có yêu cầu rõ ràng.


## 8. Xóa dữ liệu

Mặc định sử dụng soft delete / Trash.

Không xóa vĩnh viễn dữ liệu đang được tham chiếu.

Không xóa lịch sử thi hoặc kết quả học viên chỉ để dọn dữ liệu.


## 9. Media

Audio và ảnh phải được quản lý có kiểm soát.

Không xóa media đang được tham chiếu.

Media orphan chỉ được garbage collector xóa sau grace period.

Xóa file liên quan ngay sau khi Permanently Delete nếu file không còn bất kỳ tham chiếu hợp lệ nào.


## 10. Trước khi code

AI phải xác định:

- Provider
- Level
- Exam
- Skill
- Part
- specification tương ứng
- trạng thái specification

Nếu không xác định được thì không được tự suy đoán.


## 11. Sau khi code

Phải chạy:

- syntax check;
- automated tests liên quan;
- full G2G Exam test nếu thay đổi kiến trúc hoặc nghiệp vụ;
- đảm bảo mọi chức năng đều có ý nghĩa và sử dụng được.

Không merge vào main khi test fail.


## 12. Phạm vi thay đổi

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


## 13. Quy tắc khi yêu cầu chưa rõ

Không đoán.

Hãy chỉ ra chính xác phần còn thiếu và hỏi lại trước khi xây dựng.


## 14. Nguyên tắc ưu tiên

Thứ tự ưu tiên:

1. Dữ liệu và lịch sử học viên an toàn.
2. Specification đã APPROVED.
3. Automated tests.
4. Kiến trúc module hóa.
5. UI/UX.
6. Tối ưu thêm.
