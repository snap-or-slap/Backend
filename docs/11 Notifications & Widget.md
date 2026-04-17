Để hoàn thiện hệ thống, bộ màn hình **Section J — Notifications & Widget** sẽ đóng vai trò giữ chân người dùng (Retention) và đưa các thông báo quan trọng ra ngoài màn hình chính của điện thoại.

---

## 1. Màn hình J-01: Notification Center (Trung tâm thông báo)

Truy cập từ icon chuông ở góc trên bên phải của các màn hình chính.

* **Phân loại thông báo (Notification Categories):**
  * **Social**: Lời mời kết bạn, chấp nhận kết bạn, nhắc tên (mention) trong bình luận.
  * **Challenge**: Lời mời vào Squad, thông báo bắt đầu thử thách, nhắc nhở "Sắp đến giờ reset".
  * **System**: Thông báo đạt huy hiệu mới, cập nhật phiên bản, hoặc cảnh báo bảo mật.
* **Giao diện:**
  * Danh sách các thông báo theo thứ tự thời gian (Mới nhất ở trên).
  * Các thông báo chưa đọc sẽ có chấm đỏ hoặc nền màu cam nhạt (đồng bộ với UI chính).
  * Tính năng "Mark all as read" để xóa nhanh dấu hiệu thông báo.

---

## 2. Section J-02: Widgets (Màn hình ngoài ứng dụng)

Thiết kế các Widget để người dùng theo dõi nhanh mà không cần mở app.

* **Widget Nhỏ (Small - 2x2):**
  * Hiển thị Streak hiện tại và đếm ngược giờ Reset của thử thách quan trọng nhất.
* **Widget Trung bình (Medium - 4x2):**
  * Hiển thị tiến độ của 2-3 Active Challenges.
  * Trạng thái "Health" (Số tim còn lại) của Squad hiện tại.
* **Widget Lớn (Large - 4x4):**
  * Danh sách check-in của các thành viên trong Squad hôm nay (ai đã làm, ai chưa).
  * Nút "Quick Check-in" để mở thẳng camera trong app.

---

## 3. Mô tả cho Backend thiết kế DB & Logic

### Bảng `notifications`

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | PK. |
| `user_id` | UUID | Người nhận thông báo. |
| `type` | Enum | `friend_request`, `challenge_invite`, `daily_reminder`, `badge_earned`. |
| `metadata` | JSON | Lưu ID liên quan (VD: `challenge_id`, `sender_id`) để điều hướng khi nhấn vào. |
| `is_read` | Boolean | Trạng thái đã đọc. |
| `created_at` | Timestamp | Thời điểm bắn thông báo. |

### Logic Backend quan trọng

1. **Push Notification Trigger**:
    * Backend cần tích hợp với Firebase Cloud Messaging (FCM) hoặc Apple Push Notification service (APNs).
    * **Logic Nhắc nhở**: Một Job chạy trước giờ `reset_time` khoảng 1 tiếng, quét những ai chưa check-in để bắn push: *"Nhanh lên! Chỉ còn 60 phút để cứu 1 trái tim của đội!"*
2. **Widget Data Provider**:
    * Backend cần cung cấp một API cực nhẹ (Lightweight API) để Widget lấy dữ liệu nhanh mà không cần load toàn bộ thông tin profile. API này chỉ nên trả về các con số cần thiết (Streaks, Tim, Countdown).
3. **Real-time Update**:
    * Sử dụng WebSockets hoặc Socket.io để cập nhật "chấm đỏ" thông báo ngay lập tức khi có sự kiện mới mà không cần user phải reload app.

---

## 4. Gợi ý UI đồng bộ

* **Notification Card**: Sử dụng icon bo tròn nhỏ bên trái mỗi thông báo để phân biệt loại (VD: Hình tim cho thử thách, hình người cho kết bạn).
* **Widget Style**: Bo góc cực đại (Radius 28-30px theo chuẩn iOS/Android), sử dụng màu nền Cam cháy đặc trưng của SOS-App để nổi bật trên màn hình Home của người dùng.

---

## Tổng kết toàn bộ hệ thống (Hệ quản trị DB)

Đến đây, bạn đã có một bộ đặc tả đầy đủ cho Backend bao gồm các cụm bảng chính:

1. **Auth & User**: Quản lý tài khoản và profile.
2. **Social & Friends**: Quản lý mối quan hệ và tìm kiếm.
3. **Challenge & Squad**: "Trái tim" của app với logic trạng thái phức tạp.
4. **Check-in & Proof**: Lưu trữ bằng chứng và hình ảnh.
5. **Gamification**: Huy hiệu, Streaks và bảng xếp hạng.
6. **Engagement**: Thông báo và Widget.

Bạn đã sẵn sàng để chuyển sang bước **Viết tài liệu API (API Documentation)** cho từng màn hình chưa, hay bạn muốn tôi tổng hợp lại toàn bộ sơ đồ bảng Database (ERD) cuối cùng?
