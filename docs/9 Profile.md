Bộ màn hình **Profile** là nơi tổng hợp toàn bộ thành quả của người dùng, đóng vai trò như một "tấm danh thiếp" trong cộng đồng SOS-App. Để đồng bộ, màn hình này sẽ nâng cấp từ màn hình Preview đã có, nhưng bổ sung thêm các tính năng quản lý cá nhân.

---

## 1. Màn hình H-01: Main Profile (Hồ sơ cá nhân)

Đây là màn hình người dùng thấy khi nhấn vào tab "Profile" trên thanh điều hướng.

* **Khu vực Định danh (Identity Section):**
  * **Avatar & Cover**: Ảnh đại diện hình tròn (có viền highlight nếu đang có Streak cao).
  * **User Info**: Hiển thị `Display Name`, `@username` và một dòng `Bio` ngắn.
  * **Edit Profile Button**: Nút chuyển sang màn hình chỉnh sửa thông tin.
* **Khu vực Chỉ số (Lifetime Stats):**
  * **Total Streaks**: Tổng số ngày hành động liên tục cao nhất.
  * **Challenges Finished**: Số lượng thử thách đã hoàn thành thành công.
  * **Success Rate**: Tỉ lệ hoàn thành trung bình (tính bằng %).
* **Khu vực Huy hiệu (Badges Cabinet):**
  * Hiển thị lưới các icon huy hiệu. Khi nhấn vào từng huy hiệu sẽ hiện popup giải thích ý nghĩa và ngày đạt được.
* **Khu vực Hoạt động (Activity Feed):**
  * Danh sách các hành động gần đây (VD: "You completed 5AM Wake Up", "You joined a new squad").

---

## 2. Màn hình H-02: Edit Profile (Chỉnh sửa hồ sơ)

Giao diện tương tự màn hình **B-07 (Complete Profile)** nhưng có thêm các tùy chọn chuyên sâu.

* **Thông tin thay đổi:**
  * `Avatar`: Upload ảnh mới.
  * `Display Name`: Thay đổi tên hiển thị.
  * `Bio`: Thêm mô tả cá nhân.
* **Account Settings (Cài đặt tài khoản):**
  * `Email`: Hiển thị email (thường là read-only hoặc cần xác thực để đổi).
  * `Password`: Nút dẫn đến luồng đổi mật khẩu.
  * `Privacy Toggle`: Tùy chọn cho phép người lạ tìm thấy mình qua username hay không.

---

## 3. Màn hình H-03: Settings & Support (Cài đặt chung)

Truy cập từ icon "bánh răng" trên màn hình Profile.

* **Preferences:**
  * `Notification Settings`: Bật/tắt thông báo nhắc nhở check-in, lời mời kết bạn.
  * `Theme`: Chế độ Sáng/Tối (Light/Dark mode).
* **Support:**
  * `Help Center`: Các câu hỏi thường gặp (FAQs).
  * `Privacy Policy` & `Terms of Service`: Các điều khoản pháp lý (từ màn hình B-06).
* **Danger Zone:**
  * `Logout`: Đăng xuất.
  * `Delete Account`: Xóa tài khoản vĩnh viễn (cần xác nhận qua email).

---

## 4. Mô tả cho Backend thiết kế DB & Logic

### Cập nhật bảng `Users` / `Profiles`

| Field | Type | Description |
| :--- | :--- | :--- |
| `bio` | Text | Giới thiệu ngắn. |
| `is_private` | Boolean | Trạng thái bảo mật hồ sơ. |
| `notification_prefs`| JSON | Lưu cấu hình bật/tắt các loại push notification. |

### Logic Backend quan trọng

1. **Stats Aggregation**: Backend cần một hàm tổng hợp dữ liệu (Aggregated Service) để tính toán `Success Rate` dựa trên lịch sử của tất cả các `challenges` mà user đã tham gia.
2. **Badge Logic**: Cần một hệ thống kiểm tra điều kiện (Trigger system). Ví dụ: Nếu `total_completed_challenges == 10` -> Tự động chèn một bản ghi vào bảng `UserBadges` với loại huy hiệu "Challenge Veteran".
3. **Avatar Storage**: Khi user đổi ảnh, Backend nên xóa ảnh cũ trên S3/Cloudinary để tiết kiệm bộ nhớ (hoặc lưu lịch sử nếu cần).

---

## 5. Gợi ý UI đồng bộ

* **Bố cục**: Giữ vững cấu trúc thẻ (Cards) bo góc như các màn hình trước. Khu vực Stats nên dùng các khối màu nâu/cam nhạt để nổi bật con số.
* **Trải nghiệm người dùng (UX)**:
  * Sử dụng hiệu ứng "Skeleton loading" khi đang tính toán các chỉ số stats.
  * Các huy hiệu chưa đạt được có thể hiển thị dạng màu xám (Grayscale) để kích thích user chinh phục.

Đây là bộ màn hình cuối cùng để khép lại vòng lặp của một người dùng trong app. Bạn có cần mình hỗ trợ viết tài liệu tổng hợp tất cả các bảng Database (Database Schema) từ đầu đến giờ không?
