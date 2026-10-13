# Điểm tạm tính — APPROVED 2026-10-14

Áp dụng cho lượt thi đã nộp, đang chấm/chờ công bố ở mọi bộ đề. Không đổi rubric,
thang điểm hoặc quy tắc đạt/trượt của từng Provider/Level/Part.

- Giữ cấu trúc kết quả cũ: thống kê, điểm từng phần, biểu đồ và tab chi tiết.
- Trước/sau công bố dùng cùng thứ tự và nhóm kỹ năng ở Tổng quan và đầu tab.
  Cộng các bài theo scoringSkill; có điểm thiếu thì kỹ năng chờ điểm, không tính 0.
  Kỹ năng có gợi ý viết thì tổng kỹ năng mang nhãn tạm tính. Nói luôn giữ vị trí.
- Trắc nghiệm có kết quả chính xác ngay sau khi nộp, gồm điểm, đúng/sai và đáp án.
  Không gắn nhãn tạm tính hoặc màu tạm tính cho điểm tự chấm (kể cả form viết).
- Chỉ gợi ý điểm bài viết có AI chấm mới có badge “Tạm tính”, màu xanh xám riêng.
  Không tính tổng hoặc kết luận Đạt/Chưa đạt toàn bài trước khi giáo viên công bố.
- Không nhắc AI hay trạng thái AI trên giao diện học viên; thiếu điểm là “Chờ điểm”,
  không phải 0. Gợi ý lỗi, thiếu rubric hoặc chưa hoàn thành không tạo điểm giả.
- Cập nhật nhãn 2026-10-14: dùng badge xám bo tròn “Tạm tính”, thay cho
  “– điểm tạm tính” ở mọi điểm gợi ý và tổng có chứa điểm gợi ý.
  Màu progress dùng chung bảng màu theo mức điểm, kể cả điểm tạm tính.
- Chỉ chủ lượt thi được xem; không lộ rubric, nhận xét, điểm giáo viên
  chưa công bố. Không ghi gợi ý vào điểm chính thức hoặc đổi trạng thái lượt thi.
- Giáo viên vẫn chấm và công bố; sau đó giao diện dùng kết quả chính thức.
- TELC B1/B2 chuẩn: Tổng quan có hai khung Khối thi viết và Khối thi nói.
  Khối thi viết chứa Đọc, Ngữ pháp & từ vựng, Nghe, Viết; cộng theo scoringSkill.
  Tổng khối chỉ hiện khi đủ điểm; có điểm viết tạm tính thì tổng cũng tạm tính.
  Dùng mốc đạt từ specs/telc/scoring.js; không gắn đạt/trượt cho các phần con.
  Chỉ kết luận khối sau công bố. Các bài nhỏ giữ trong tab chi tiết.
- Không có điểm tạm tính cho lượt đang làm, bị hủy hoặc không hoàn thành.
- Khi đang xem, tải tiến độ gọn mỗi 15 giây nếu còn chờ gợi ý, mỗi 60 giây khi
  chờ giáo viên công bố; dừng khi ẩn tab/rời trang. Không tải lại bài làm mỗi nhịp.
