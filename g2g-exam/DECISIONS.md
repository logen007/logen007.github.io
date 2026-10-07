# G2G Exam — Decisions Pending Review

> Đây là bản nháp để người phụ trách dự án đọc và duyệt trước.
>
> KHÔNG coi nội dung trong file này là quyết định chính thức cho đến khi người phụ trách dự án xác nhận duyệt.
>
> Chỉ sau khi được duyệt mới đổi từng mục sang `APPROVED` và cho phép AI/Developer dùng làm Source of Truth.

## Cách dùng

- Mỗi quyết định mới phải được trình người phụ trách dự án đọc trước.
- Trước khi được duyệt, trạng thái phải là `PENDING REVIEW` hoặc `DRAFT`.
- Không được tự đổi sang `APPROVED`.
- Sau khi người phụ trách dự án xác nhận duyệt, mới được commit trạng thái `APPROVED`.
- `AGENTS.md` quy định cách AI làm việc; `DECISIONS.md` lưu các quyết định đã duyệt; `specs/` mô tả chi tiết từng kỳ thi/Part.

---

## DEC-001 — Không có Ngân hàng câu hỏi

**Status:** PENDING REVIEW  
**Date:** 2026-10-07

G2G Exam **không có Question Bank / Ngân hàng câu hỏi độc lập**.

Câu hỏi chỉ được tạo và quản lý trong ngữ cảnh của một đề thi:

```text
Exam
  → Skill
    → Part
      → Question
```

Không xây lại màn hình Question Bank, picker chọn câu từ kho, hoặc workflow tạo câu hỏi độc lập ngoài đề thi.

---

## DEC-002 — Workflow chính của Giáo viên

**Status:** PENDING REVIEW  
**Date:** 2026-10-07

Giáo viên có hai nhóm công việc chính:

```text
Teacher
  → Tạo & quản lý đề thi
  → Chấm bài
```

Trong luồng tạo đề:

```text
Provider
  → Level
    → Exam / Config
      → Skill
        → Part
          → Questions
```

Câu hỏi được tạo trực tiếp trong Part của đề thi.

---

## DEC-003 — Mỗi Part có thể có template riêng

**Status:** PENDING REVIEW  
**Date:** 2026-10-07

Không giả định các Part cùng một kỹ năng có cùng cấu trúc.

Ví dụ:

```text
GOETHE.A1.LISTENING.PART_01
```

không mặc định dùng cùng logic với:

```text
GOETHE.A1.LISTENING.PART_02
```

Mỗi Part có thể có editor, validation, media policy, scoring và student experience riêng.

---

## DEC-004 — Không tự suy đoán luật thi

**Status:** PENDING REVIEW  
**Date:** 2026-10-07

Nếu Provider / Level / Skill / Part chưa có specification ở trạng thái `APPROVED` thì không được tự nghĩ ra:

- số câu;
- thời gian;
- điểm;
- loại đáp án;
- audio behavior;
- cách chấm;
- cấu trúc UI đặc thù.

Phải chờ specification được duyệt.

---

## DEC-005 — Specification đã APPROVED là nguồn nghiệp vụ chính thức

**Status:** PENDING REVIEW  
**Date:** 2026-10-07

Luật nghiệp vụ chi tiết nằm trong `specs/`.

Khi một specification đã `APPROVED`, code và test phải tuân theo specification đó.

Specification `DRAFT` hoặc `TODO` không được coi là luật production.

---

## DEC-006 — Điểm thuộc từng câu hỏi

**Status:** PENDING REVIEW  
**Date:** 2026-10-07

Điểm được lưu ở từng Question.

`defaultQuestionScore` chỉ là giá trị mặc định khi tạo câu mới hoặc khi giáo viên chủ động áp dụng hàng loạt.

Giáo viên có thể chỉnh điểm riêng từng câu khi template cho phép.

Tổng điểm được tính từ tổng điểm các câu.

---

## DEC-007 — Bảo toàn lịch sử thi

**Status:** PENDING REVIEW  
**Date:** 2026-10-07

Không được làm hỏng kết quả hoặc lịch sử học viên đã phát sinh.

Khi dữ liệu đã được dùng trong lượt thi production:

- không reset database để giải quyết lỗi phát triển;
- không sửa cấu trúc cũ theo cách làm thay đổi ý nghĩa kết quả đã lưu;
- ưu tiên versioning/migration an toàn khi cần thay đổi lớn.

---

## DEC-008 — Xóa dữ liệu theo Trash / Soft Delete

**Status:** PENDING REVIEW  
**Date:** 2026-10-07

Xóa thông thường phải đi qua Trash / soft delete.

Không xóa vĩnh viễn dữ liệu còn đang được tham chiếu hoặc cần cho lịch sử thi.

Master Admin chịu trách nhiệm các thao tác quản trị Trash và xóa vĩnh viễn khi an toàn.

---

## DEC-009 — Media phải có vòng đời dọn rác

**Status:** PENDING REVIEW  
**Date:** 2026-10-07

Audio và ảnh không được để tích tụ vô hạn trên server.

- Media đang được tham chiếu không được xóa.
- Media orphan được garbage collector xử lý sau grace period.
- Khi một đối tượng được Permanently Delete và file không còn bất kỳ tham chiếu nào, file liên quan có thể được xóa theo policy dọn rác.

---

## DEC-010 — AI/Developer chỉ sửa phạm vi tối thiểu cần thiết

**Status:** PENDING REVIEW  
**Date:** 2026-10-07

Khi yêu cầu chỉ liên quan một Part, không tự ý thay đổi các Part/kỳ thi khác nếu không có dependency thực sự.

Mọi thay đổi nghiệp vụ hoặc kiến trúc phải có test phù hợp trước khi đưa vào `main`.
