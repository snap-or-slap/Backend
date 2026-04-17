Bộ màn hình **Challenges Hub** này là "trái tim" của ứng dụng, yêu cầu Backend thiết kế một hệ thống quản lý trạng thái thử thách (State Management) và logic thời gian (Scheduling) rất chặt chẽ.

Dưới đây là mô tả chi tiết cho bên làm Backend thiết kế DB:

---

## 1. Các thực thể chính (Entities)

* **Challenges**: Định nghĩa cấu trúc một thử thách (Tên, thời gian, tần suất).
* **Squads/ChallengeGroups**: Lưu trữ nhóm người cùng tham gia một thử thách.
* **ChallengeMembers**: Bảng trung gian lưu trạng thái của từng user trong thử thách (số tim còn lại, vị trí hiện tại).
* **Checkins/Logs**: Lưu lịch sử thực hiện hàng ngày của user.

---

## 2. Chi tiết 3 trạng thái của Challenge

### Màn hình D-02: Challenges in Formation (Giai đoạn chuẩn bị)

Đây là các thử thách đã tạo nhưng chưa bắt đầu (đang chờ đủ người hoặc đến ngày Start date).

* **Trạng thái (Status)**: `Formation`.
* **Duration & Start Date**: Khoảng thời gian diễn ra (VD: 7 days) và ngày bắt đầu chính thức.
* **Loop**: Tần suất lặp lại (VD: mỗi 1 ngày).
* **Reset time**: Thời điểm chốt sổ hàng ngày (VD: 10:00 PM).
* **Heart System**: Số lượng "mạng" (tim) tối đa cho cả đội (VD: 4 total).
* **Slots**: Số lượng thành viên đã tham gia trên tổng số (VD: 2/4 joined).

### Màn hình D-01: Active Challenges (Đang diễn ra)

Quản lý các thử thách user đang thực hiện thực tế.

* **Trạng thái (Status)**: `Active`.
* **Step Counter**: Tiến độ hiện tại (VD: Step 6 of 14).
* **Health Status (Risk Tracking)**:
  * `On track`: Đang thực hiện tốt.
  * `Danger`: Có thành viên bỏ lỡ hoặc sắp hết thời gian reset mà chưa check-in.
* **Daily Reset**: Cần logic đếm ngược dựa trên `Reset time`.

### Màn hình D-01: Challenge History (Lịch sử)

Thống kê tổng quát và danh sách các thử thách đã kết thúc.

* **Lifetime Stats**:
  * `Success Rate`: Tổng số step thành công / tổng số step của tất cả các challenge.
  * `Streaks`: Số ngày hoạt động liên tục lớn nhất hiện tại.
* **Phân loại kết quả (Finish Status)**:
  * `Success`: Hoàn thành 100% các bước.
  * `Game Over`: Thất bại (hết tim trước khi hoàn thành).
  * `Cancelled`: Hủy giữa chừng.

---

## 3. Gợi ý cấu trúc bảng (Database Schema)

### Bảng `challenges`

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | PK. |
| `title` | String | Tên thử thách. |
| `total_steps` | Integer | Tổng số bước cần vượt qua (VD: 14). |
| `total_hearts`| Integer | Số tim tối đa (VD: 4). |
| `start_at` | Timestamp | Ngày giờ bắt đầu. |
| `reset_at` | Time | Giờ reset hàng ngày. |
| `status` | Enum | `formation`, `active`, `completed`, `failed`, `cancelled`. |

### Bảng `challenge_members`

| Field | Type | Description |
| :--- | :--- | :--- |
| `challenge_id`| UUID | FK. |
| `user_id` | UUID | FK. |
| `current_step`| Integer | Bước hiện tại của user đó. |
| `hearts_left` | Integer | Số tim còn lại của cá nhân/đội. |

---

## 4. Logic Backend cần xử lý

1. **Hệ thống Heart (Tim)**: Khi một user không check-in đúng giờ (`reset_at`), Backend phải tự động trừ 1 `heart` của Squad. Nếu `hearts_left == 0`, chuyển trạng thái challenge sang `Game Over`.
2. **Logic Step Update**: Sau mỗi chu kỳ reset, nếu check-in thành công, `current_step` tăng lên 1.
3. **Cron Jobs**:
    * Job quét lúc đến giờ `reset_at` để chốt kết quả ngày.
    * Job chuyển trạng thái từ `Formation` sang `Active` khi đến `start_at`.
4. **Tính toán Success Rate**: Cần một hàm tổng hợp dữ liệu từ lịch sử để trả về con số % ở màn hình History.

Màn hình này cho thấy ứng dụng của bạn có cơ chế "sinh tồn" nhóm (Shared hearts). Backend cần đặc biệt lưu ý xử lý **Race Condition** khi nhiều người cùng check-in hoặc cùng làm mất tim một lúc.

Bạn có cần mình viết kỹ hơn về logic xử lý "Trừ tim" khi có người fail không?
