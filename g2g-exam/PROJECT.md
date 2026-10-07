# G2G Exam System

> Bản đồ tổng thể của hệ thống G2G Exam.

---

## 1. System Map

```mermaid
flowchart TD

    G2G["G2G EXAM"]

    G2G --> GOETHE["GOETHE"]
    G2G --> TELC["TELC"]

    GOETHE --> GA1["A1"]
    GOETHE --> GA2["A2"]
    GOETHE --> GB1["B1"]
    GOETHE --> GB2["B2"]

    TELC --> TB1["B1"]
    TELC --> TB2["B2"]
    TELC --> TC1["C1"]
    TELC --> TC2["C2"]

    GA1 --> GA1L["Nghe"]
    GA1 --> GA1R["Đọc"]
    GA1 --> GA1W["Viết"]
    GA1 --> GA1S["Nói"]

    GA1L --> GA1L1["Bài 1"]
    GA1L --> GA1L2["Bài 2"]
    GA1L --> GA1L3["Bài 3"]

    GA1R --> GA1R1["Bài 1"]
    GA1R --> GA1R2["Bài 2"]
    GA1R --> GA1R3["Bài 3"]

    GA1W --> GA1W1["Bài 1"]
    GA1W --> GA1W2["Bài 2"]
```

---

## 2. Vai trò người dùng

```mermaid
flowchart LR

    USER["Người dùng"]

    USER --> STUDENT["Học viên"]
    USER --> TEACHER["Giáo viên"]
    USER --> MASTER["Master Admin"]

    STUDENT --> TAKE["Làm bài thi"]
    STUDENT --> RESULTS["Xem kết quả"]

    TEACHER --> QUESTIONS["Tạo câu hỏi"]
    TEACHER --> EXAMS["Tạo đề"]
    TEACHER --> GRADING["Chấm bài"]

    MASTER --> USERS["Quản lý người dùng"]
    MASTER --> TRASH["Thùng rác"]
    MASTER --> SETTINGS["Cài đặt hệ thống"]
```

---

## 3. Cấu trúc một đề thi

```mermaid
flowchart TD

    PROVIDER["Hệ thi"]
    PROVIDER --> LEVEL["Trình độ"]
    LEVEL --> EXAM["Đề thi"]
    EXAM --> SKILL["Kỹ năng"]
    SKILL --> PART["Bài / Part"]
    PART --> TEMPLATE["Part Template"]
    TEMPLATE --> QUESTION["Câu hỏi"]
    QUESTION --> ANSWER["Đáp án"]
    QUESTION --> MEDIA["Audio / Hình ảnh"]
    QUESTION --> SCORE["Điểm"]
```

---

## 4. Luồng xây dựng chức năng

```mermaid
flowchart LR

    IDEA["Yêu cầu"]
    IDEA --> SPEC["Specification"]
    SPEC --> APPROVE{"Approved?"}

    APPROVE -->|Không| REVIEW["Chỉnh lại"]
    REVIEW --> SPEC

    APPROVE -->|Có| CODE["Build"]
    CODE --> TEST["Automated Test"]
    TEST --> PASS{"Pass?"}

    PASS -->|Không| CODE
    PASS -->|Có| MAIN["Main"]
    MAIN --> DEPLOY["Deploy"]
```

---

## 5. Source of Truth

Thứ tự ưu tiên:

1. `AGENTS.md` — luật làm việc cho AI.
2. `specs/` — quy tắc nghiệp vụ đã được duyệt.
3. `DECISIONS.md` — các quyết định kiến trúc/nghiệp vụ đã chốt.
4. `ARCHITECTURE.md` — cấu trúc kỹ thuật.
5. Code.
6. Tests.

Specification có trạng thái `APPROVED` là nguồn quy tắc nghiệp vụ chính thức.

---

## 6. Quy tắc phát triển

Không tự suy đoán cấu trúc đề thi.

Mỗi cấu trúc:

    Provider → Level → Skill → Part

có thể có template riêng.

Ví dụ:

    GOETHE.A1.LISTENING.PART_01

không mặc định giống:

    GOETHE.A1.LISTENING.PART_02

---

## 7. Trạng thái Specification

- ⚪ TODO — chưa định nghĩa.
- 🟡 DRAFT — đang xây dựng.
- 🟢 APPROVED — đã chốt, được phép build.
- 🔴 INVALID — có lỗi hoặc thiếu rule.
- 🔒 LOCKED — đã có dữ liệu production cần bảo toàn.
