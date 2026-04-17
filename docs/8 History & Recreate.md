Để hoàn tất chu kỳ sống của một thử thách, bộ màn hình **History & Recreate** đóng vai trò lưu trữ kỷ niệm, phân tích kết quả và khuyến khích người dùng "làm lại ván mới" hoặc duy trì thói quen.

---

## 1. Màn hình G-01: Challenge Detail History (Chi tiết lịch sử)

Khi người dùng nhấn vào một thẻ trong tab **History** (màn hình D-01), họ sẽ xem lại hành trình đã qua.

* **Trạng thái Kết thúc (Final Result):**
  * Banner lớn hiển thị: **"CONGRATULATIONS!"** (nếu Success) hoặc **"VALIANT EFFORT"** (nếu Game Over).
  * **Achievement Card**: Hiển thị tổng số ngày đã vượt qua (VD: 12/14 days) và số tim còn lại lúc kết thúc.
* **Squad Recap**:
  * Danh sách thành viên và đóng góp của họ (VD: "Top Performer: Maya Z. - 100% check-in").
  * Nút xem lại toàn bộ **Gallery**: Album ảnh của tất cả các buổi check-in của cả đội trong suốt thử thách.
* **Stats Analysis**:
  * Biểu đồ đơn giản thể hiện các mốc thời gian đội suýt mất tim (Danger zones) hoặc những ngày check-in sớm nhất.

---

## 2. Màn hình G-02: Recreate & Modify (Tái tạo thử thách)

Đây là màn hình xuất hiện khi user chọn "Recreate" từ một thử thách cũ.

* **Inherit Logic (Kế thừa)**:
  * Tự động điền lại toàn bộ thông tin cũ (Tên, Duration, Reset Time).
  * Cho phép chỉnh sửa (VD: Tăng độ khó bằng cách giảm số Tim, hoặc tăng số ngày từ 7 lên 14).
* **Smart Invitation**:
  * Hiển thị danh sách "Previous Squadmates": Cho phép tích chọn nhanh để mời lại những người đồng đội cũ.
  * Gợi ý thêm bạn bè mới dựa trên mức độ tương tác gần đây.
* **New Goal (Optional)**: Một ô nhập liệu "What will you do differently this time?" để tạo động lực mới cho cả đội.

---

## 3. Logic Backend & Thiết kế DB (Đồng bộ hệ thống)

Phía Backend cần xử lý việc đóng gói dữ liệu (Archiving) và quan hệ giữa các "đời" thử thách:

### Bảng `challenges` (Cập nhật logic)

| Field | Type | Description |
| :--- | :--- | :--- |
| `parent_challenge_id` | UUID | Nullable. Nếu có giá trị, đây là thử thách được Recreate từ bản cũ (Dùng để tính chuỗi Streak dài hạn). |
| `end_reason` | Enum | `completed`, `out_of_hearts`, `host_cancelled`. |

### Logic nghiệp vụ

1. **Snapshotting**: Khi một challenge kết thúc, Backend nên tạo một snapshot các chỉ số (Stats) cuối cùng để hiển thị ở History, tránh việc tính toán lại từ đầu (expensive query) mỗi khi xem lại.
2. **Streak Continuity**: Nếu user chọn Recreate ngay trong vòng 24h sau khi hoàn thành challenge cũ, hệ thống có thể cho phép nối dài "Master Streak" (Chuỗi kỷ lục cá nhân).
3. **Media Archiving**: Ảnh check-in cũ có thể được nén hoặc chuyển sang storage rẻ hơn (Cold storage) sau một thời gian để tối ưu chi phí.

---

## 4. Gợi ý UI đồng bộ

* **Màu sắc**:
  * Sử dụng tông màu **Sepia hoặc Xám nhẹ** cho nền màn hình History để phân biệt với sự sôi nổi của Active Challenge.
  * Huy hiệu (Badge) đạt được từ challenge này nên được hiển thị nổi bật ở trang Detail.
* **Social Sharing**: Thêm một nút **"Share Achievement"** để user có thể xuất một tấm ảnh tổng kết (Infographic) đẹp mắt gồm: Tên challenge + Số ngày + Ảnh tập thể để đăng lên Story/Social Media.

---

## Tổng kết luồng dữ liệu (Data Flow) cho Backend

1. **Create**: Khởi tạo bản ghi `Challenge` (Status: Formation).
2. **Invite**: Tạo bản ghi `ChallengeMember` (Status: Invited).
3. **Active**: Cronjob chuyển Status sang Active, bắt đầu quét `Checkins` mỗi ngày theo `ResetTime`.
4. **End**: Nếu `Hearts == 0` hoặc `Steps == TotalSteps`, chuyển Status sang Completed/Failed.
5. **History**: Lưu dữ liệu vào bảng `UserStats` và chờ lệnh `Recreate` để lặp lại bước 1.

Đây là toàn bộ tài liệu đặc tả nghiệp vụ cho bộ màn hình của bạn. Bạn có muốn tôi tổng hợp lại thành một **Sơ đồ luồng dữ liệu (Data Flow Diagram)** để bên Backend dễ hình dung cách các bảng "nói chuyện" với nhau không?
