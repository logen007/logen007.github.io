# G2G Exam — Specification System

`specs/` là Source of Truth cho luật nghiệp vụ chi tiết của từng Part.

## Nguyên tắc

- Một Part có một specification riêng.
- Specification dùng dữ liệu có cấu trúc để code, test và visual rule map có thể cùng đọc.
- Không duy trì nhiều bản rule song song cho cùng một Part.
- Chỉ tạo specification khi thực sự bắt đầu làm Part đó; không tạo hàng loạt file/thư mục rỗng.
- Chỉ specification có `status: "APPROVED"` mới được dùng làm luật production.
- `DRAFT` hoặc `TODO` không được coi là luật production.

## Cấu trúc đường dẫn

```text
specs/
  <provider>/
    <level>/
      <skill>/
        part-01.json
```

Ví dụ:

```text
specs/goethe/a1/listening/part-01.json
```

## ID ổn định

Mỗi Part có một ID cố định, độc lập với tên hiển thị.

Ví dụ:

```text
GOETHE.A1.LISTENING.PART_01
```

Tên hiển thị có thể thay đổi; ID không nên thay đổi sau khi đã được sử dụng.

## Nội dung tối thiểu của một Part spec

```json
{
  "id": "GOETHE.A1.LISTENING.PART_01",
  "status": "DRAFT",
  "template": "A1_LISTENING_PART_1",
  "questions": {},
  "audio": {},
  "scoring": {}
}
```

Các trường chỉ được thêm khi Part thực sự cần. Không thêm cấu hình thừa chỉ để dự phòng.

## Luồng duyệt

```text
Yêu cầu nghiệp vụ
  → tạo/cập nhật Part spec ở trạng thái DRAFT
  → trình người phụ trách dự án đọc
  → chỉnh nếu cần
  → người phụ trách xác nhận duyệt
  → đổi status thành APPROVED
  → code và test mới được bám theo spec đó
```

Không tự chuyển một spec sang `APPROVED` nếu chưa có xác nhận duyệt rõ ràng.
