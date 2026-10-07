# G2G Exam — Approved Decisions

> File này chỉ lưu các quyết định quan trọng đã được duyệt, không lặp lại rule đã nằm ở `AGENTS.md`, `ARCHITECTURE.md`, `OPERATIONS.md` hoặc `specs/`.

## Nguyên tắc của file này

- Chỉ ghi quyết định có ảnh hưởng lớn đến cấu trúc hoặc cách vận hành hệ thống.
- Không ghi những thứ hệ thống không có, trừ khi đó là một quyết định loại bỏ cần lưu lịch sử.
- Không chép lại chi tiết nghiệp vụ của từng kỳ thi/Part; phần đó thuộc `specs/`.
- Không chép lại quy tắc làm việc của AI/Developer; phần đó thuộc `AGENTS.md`.
- Không chép lại hướng dẫn vận hành server/media; phần đó thuộc `OPERATIONS.md`.
- Một quy tắc chỉ nên có một Source of Truth. Nơi khác chỉ tham chiếu, không copy lại.
- Quyết định mới phải được người phụ trách dự án đọc và duyệt trước khi chuyển sang `APPROVED`.

---

## DEC-001 — Cấu trúc nghiệp vụ của đề thi

**Status:** APPROVED  
**Date:** 2026-10-07

Luồng nghiệp vụ chính của giáo viên khi xây dựng đề:

```text
Teacher
  → Exam
    → Skill
      → Part
        → Question
```

Provider và Level là metadata/cấu hình xác định loại đề trước khi đi vào cấu trúc Exam.

Các chức năng tạo/chỉnh câu hỏi phải nằm trong ngữ cảnh của Part tương ứng.

---

## DEC-002 — Kiến trúc module hóa và tái sử dụng

**Status:** APPROVED  
**Date:** 2026-10-07

Hệ thống phải được chia thành các module có trách nhiệm rõ ràng.

Nguyên tắc:

- Một module chỉ nên chịu trách nhiệm cho một nhóm chức năng rõ ràng.
- Logic dùng chung phải tách thành shared module/helper/config để tái sử dụng.
- Không copy cùng một rule hoặc cùng một đoạn logic sang nhiều nơi.
- Không để nhiều module cùng sở hữu một loại dữ liệu hoặc một rule nghiệp vụ.
- Các Part chỉ tách module riêng khi chúng thực sự có hành vi khác nhau.
- Những phần giống nhau giữa các Part phải dùng chung component/service/validator thay vì nhân bản code.
- Ưu tiên registry/config/composition hơn chuỗi `if/else` lớn và file monolith.

Mục tiêu là thay đổi một chức năng ở đúng một nơi mà không phải sửa cùng một logic tại nhiều file.

---

## DEC-003 — Specification đã duyệt là nguồn nghiệp vụ chính thức

**Status:** APPROVED  
**Date:** 2026-10-07

Chi tiết nghiệp vụ của từng Provider / Level / Skill / Part nằm trong `specs/`.

Chỉ specification có trạng thái `APPROVED` mới được dùng làm luật production.

Code và test phải tham chiếu cùng một specification thay vì tự duy trì các bản rule riêng biệt.

---

## DEC-004 — Mô hình lưu Specification

**Status:** APPROVED  
**Date:** 2026-10-07

Mỗi Part có một specification riêng dưới `specs/<provider>/<level>/<skill>/part-XX.json`.

Specification dùng dữ liệu có cấu trúc để code, test và visual rule map có thể cùng đọc từ một Source of Truth.

Chỉ tạo spec khi thực sự bắt đầu làm Part đó; không tạo hàng loạt file hoặc thư mục rỗng để dự phòng.
