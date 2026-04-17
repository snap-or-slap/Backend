Bộ màn hình này tập trung vào **User Profile Preview** (Xem trước hồ sơ) với các trạng thái quan hệ khác nhau (Bạn bè, Người lạ, Squadmate). Để backend thiết kế DB hiệu quả, cần chú trọng vào việc lưu trữ chỉ số thành tích (stats) và huy hiệu (badges).

Dưới đây là mô tả chi tiết:

---

## 1. Các thực thể bổ sung (Entities)

Ngoài bảng `Users` và `Friendships` đã có, backend cần thêm:

* **Challenges**: Lưu thông tin các thử thách (tên, mô tả).
* **UserChallenges**: Bảng trung gian lưu việc user tham gia challenge, streak hiện tại, và tiến độ.
* **Badges**: Danh mục các huy hiệu (Early Adopter, Squad MVP, v.v.).
* **UserBadges**: Lưu các huy hiệu mà user đã đạt được.
* **Activities**: Lưu vết các hoạt động gần đây (Lastest Activities).

---

## 2. Chi tiết từng màn hình

### Màn hình C-05: Add / Search Friends

* **Search**: Tìm kiếm theo `username`.
* **Item card**: Hiển thị `avatar`, `display_name`, và số lượng `mutual friends`.
* **Action**: Nút "Add friend" sẽ tạo một bản ghi mới vào bảng `friend_requests` với trạng thái `pending`.

### Màn hình C-05: Friend Profile (Đã là bạn bè)

Đây là màn hình hiển thị đầy đủ chỉ số nhất:

* **Current Streak**: Lấy từ bảng `UserChallenges` (tổng hợp hoặc của challenge nổi bật nhất).
* **Challenges Joined**: Count số lượng challenge user đã tham gia.
* **Completion Rate**: Tỷ lệ hoàn thành (Số lần check-in thành công / Tổng số lần yêu cầu).
* **Badges List**: Danh sách các icon huy hiệu user sở hữu.
* **Lastest Activities**: Truy vấn các hành động gần nhất từ bảng `Activities`.

### Màn hình C-06: Identity Preview (Người lạ - Non-friend)

* **Trạng thái**: Hiển thị tag "Not Friend".
* **Security Logic**: Ẩn toàn bộ thông tin cá nhân (stats, badges, activities).
* **Warning Box**: Hiển thị cảnh báo "Be careful with stranger!" nếu search ra từ username chính xác tuyệt đối.

### Màn hình C-06: Squadmate Preview (Bạn cùng đội nhưng chưa là bạn bè)

* **Shared Challenge**: Backend cần tìm điểm chung (Shared Context). Hiển thị thông tin challenge mà cả hai cùng tham gia (ví dụ: "5AM Wake Up").
* **Current Progress**: Hiển thị tiến độ của người đó trong challenge chung này.
* **Co-squadmates**: Hiển thị avatar của những người khác cùng trong squad đó.
* **Privacy**: "Limited information" - Vẫn ẩn Activities feed cho đến khi kết bạn.

---

## 3. Gợi ý cấu trúc bảng bổ sung

### Bảng `badges` & `user_badges`

| Field | Type | Description |
| :--- | :--- | :--- |
| `badge_id` | UUID | ID của huy hiệu. |
| `name` | String | Tên huy hiệu (Speed Demon, v.v.). |
| `icon_url` | String | Link ảnh huy hiệu. |
| `user_id` | UUID | ID người sở hữu (Foreign Key). |

### Bảng `user_stats` (Có thể dùng View hoặc Table riêng để tối ưu performance)

| Field | Type | Description |
| :--- | :--- | :--- |
| `user_id` | UUID | Foreign Key. |
| `total_streaks` | Integer | Tổng streak cao nhất hoặc tích lũy. |
| `challenges_count`| Integer | Tổng số thử thách tham gia. |
| `completion_rate` | Float | Tỉ lệ % hoàn thành. |

---

## 4. Logic Backend quan trọng

1. **Privacy Layer**: Backend phải có logic kiểm tra quan hệ (`is_friend`) trước khi trả về data. Nếu `is_friend = false`, tự động null các trường `activities`, `stats` trừ khi họ là `squadmate`.
2. **Shared Context Logic**: Khi xem một profile người lạ, API cần check xem `current_user` và `target_user` có chung `challenge_id` nào không để trả về dữ liệu cho màn hình **Squadmate Preview**.
3. **Streak Calculation**: Logic tính toán streak cần chạy hàng ngày để cập nhật con số (ví dụ: 24) chính xác dựa trên lịch sử check-in.

Màn hình này cho thấy app có yếu tố **Gamification** rất cao. Backend cần chuẩn bị các Service để tính toán các chỉ số (Completion Rate, Streak) một cách Real-time hoặc theo Job hàng ngày.

Bạn có muốn mình tổng hợp lại thành một file tài liệu nghiệp vụ (SRS) ngắn gọn cho bên Backend không?
