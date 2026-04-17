Đây là mô tả chi tiết cho bộ màn hình **Invitation & Formation**. Đây là giai đoạn "trung gian" sau khi một Challenge được tạo nhưng chưa bắt đầu, tập trung vào việc lôi kéo người tham gia và xác nhận sự sẵn sàng.

---

## 1. Màn hình E-01: Challenge Invitation (Dành cho người được mời)

Màn hình này xuất hiện khi một User nhận được thông báo mời tham gia từ bạn bè.

* **Thông tin hiển thị:**
  * **Sender Info**: Avatar và tên người gửi lời mời (Ví dụ: "Maya Z. invited you").
  * **Challenge Card**: Hiển thị tóm tắt (Tên challenge, Duration, Start Date, Reset Time).
  * **Squad Status**: Hiển thị danh sách avatar những người đã chấp nhận tham gia trước đó (Ví dụ: 2/4 slots filled).
  * **Rule Summary**: Hiển thị số lượng Tim (Hearts) và mức độ cam kết.
* **Hành động (Actions):**
  * **Accept**: Chuyển user vào màn hình Formation.
  * **Decline**: Từ chối và đóng màn hình.
  * **View Details**: Xem chi tiết mô tả về thử thách này.

---

## 2. Màn hình E-02: Formation Hub (Giai đoạn chờ)

Đây là màn hình mà chủ phòng (Host) và các thành viên đã join sẽ thấy để chuẩn bị.

* **Danh sách thành viên (Squad Members):**
  * Liệt kê danh sách các slot. Slot nào đã có người thì hiện Avatar + Username. Slot trống hiện biểu tượng dấu cộng `(+)` để mời thêm.
  * **Ready Status**: Mỗi thành viên có một nút gạt hoặc trạng thái "Ready". Challenge chỉ có thể bắt đầu khi 100% thành viên "Ready".
* **Trạng thái chuẩn bị:**
  * **Countdown**: Đồng hồ đếm ngược đến giờ **Start Date**.
  * **Readiness Bar**: Thanh tiến độ hiển thị tỉ lệ người đã sẵn sàng (Ví dụ: "3/4 members ready").
* **Hành động (Actions):**
  * **Invite More**: Mở danh sách bạn bè để gửi thêm lời mời (nếu còn slot).
  * **Leave Squad**: Thoát khỏi nhóm trước khi challenge bắt đầu.
  * **Edit Settings** (Chỉ dành cho Host): Chỉnh sửa lại Reset Time hoặc số lượng Tim trước khi bắt đầu.

---

## 3. Logic Backend & Thiết kế DB (Đồng bộ hệ thống)

Phía Backend cần xử lý các trạng thái chuyển đổi phức tạp ở giai đoạn này:

### Cập nhật bảng `friend_invitations` (Nếu cần tách biệt) hoặc dùng `challenge_members`

| Field | Type | Description |
| :--- | :--- | :--- |
| `status` | Enum | `invited`, `accepted`, `declined`. |
| `is_ready` | Boolean | Đánh dấu user đã sẵn sàng bắt đầu chưa. |
| `role` | Enum | `host` (người tạo), `member` (người tham gia). |

### Các Logic nghiệp vụ quan trọng

1. **Auto-Cancel**: Nếu đến `start_at` mà số lượng thành viên tối thiểu không đủ (ví dụ dưới 2 người), hệ thống tự động hủy Challenge và thông báo cho mọi người.
2. **Lock Mechanism**: Khi Challenge chuyển từ `Formation` sang `Active`, Backend phải "khóa" các thay đổi về cấu hình (không cho sửa số Tim, không cho thêm người).
3. **Notification Trigger**:
    * Gửi Push cho Host khi có người Accept.
    * Gửi Push "Reminder" cho các thành viên chưa bấm "Ready" khi còn 1 tiếng đến giờ Start.

---

## 4. Gợi ý UI đồng bộ

* **Hình ảnh**: Sử dụng các slot trống dạng nét đứt (dashed border) cho các thành viên chưa join để tạo cảm giác "đang chờ lấp đầy".
* **Hiệu ứng**: Khi một người bấm "Ready", avatar của họ có thể có một viền xanh hoặc biểu tượng checkmark nhỏ.
* **Thông báo**: Một banner nhỏ ở phía trên màn hình nhắc nhở: *"Challenge starts in 02:45:00. Make sure everyone is ready!"*

Bộ màn hình này sẽ giúp user cảm thấy có tính kết nối xã hội và trách nhiệm với nhóm ngay cả khi thử thách chưa thực sự bắt đầu. Bạn có muốn tôi liệt kê các trường hợp lỗi (Edge cases) mà Backend cần xử lý ở bước này không?
