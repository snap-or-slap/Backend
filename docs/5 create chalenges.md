Để đồng bộ với hệ thống **Challenges Hub** và phong cách thiết kế bạn đã có, màn hình **Create Challenge** cần được chia thành các bước (Step-by-step) hoặc một form liền mạch nhưng phân khu rõ ràng.

Dưới đây là mô tả chi tiết để bạn có thể vẽ UI hoặc gửi thẳng cho Backend thiết kế API/DB:

---

## Tên màn hình: **D-03 Create New Challenge**

### 1. Khu vực: Basic Information (Thông tin cơ bản)
* **Challenge Name (Input)**: Ô nhập tên thử thách (Ví dụ: "Chạy bộ mỗi sáng", "Học tiếng Anh").
* **Description (Textarea)**: Mô tả ngắn gọn mục tiêu để các thành viên khác hiểu.
* **Icon/Cover Image (Picker)**: Cho phép chọn một icon hoặc màu nền đại diện (phù hợp với các thẻ màu cam/nâu ở màn hình trước).

### 2. Khu vực: Schedule & Duration (Thời gian & Tần suất)
Dựa trên dữ liệu màn hình **D-02**, khu vực này cực kỳ quan trọng cho DB:
* **Duration (Dropdown/Number)**: Tổng số ngày diễn ra thử thách (Ví dụ: 7 ngày, 14 ngày, 30 ngày).
* **Frequency (Selection)**: Tần suất lặp lại.
    * *Daily* (Mỗi ngày).
    * *Custom* (Chọn các thứ trong tuần).
* **Start Date (Date Picker)**: Ngày bắt đầu chính thức (Sẽ chuyển từ trạng thái `Formation` sang `Active`).
* **Daily Reset Time (Time Picker)**: Giờ "chốt sổ" hàng ngày (Ví dụ: 10:00 PM). Đây là deadline để Backend kiểm tra xem user đã check-in chưa.

### 3. Khu vực: Squad Rules (Luật chơi nhóm)
* **Privacy (Toggle)**: 
    * *Public*: Ai cũng có thể tìm thấy và join.
    * *Private*: Chỉ những người có link hoặc được mời mới join được.
* **Member Limit (Number Input)**: Số lượng thành viên tối đa (Ví dụ: 4 người như trong thiết kế cũ).
* **Total Hearts (Steppers)**: Thiết lập số lượng "mạng" (tim) cho cả đội. Nếu tổng số lần vi phạm của cả đội vượt quá số này, Challenge sẽ là `Game Over`.

### 4. Khu vực: Visibility & Invitation (Mời bạn bè)
* **Search & Invite**: Một thanh search nhanh danh sách bạn bè (đã có ở màn hình Friend Hub) để gửi lời mời tham gia Squad ngay lập tức.

---

## Gợi ý UI Flow để đồng bộ
* **Màu sắc**: Sử dụng tông màu **Cam cháy (#C04000)** cho nút Primary Action ("Create Challenge") và các icon.
* **Typography**: Header sử dụng font không chân, bold, cỡ lớn tương tự màn hình "Log in" hay "Friends".
* **Input Style**: Ô nhập liệu có bo góc (Radius khoảng 12-16px) và viền mảnh, giống với form "Sign Up".

---

## Cấu trúc API/DB gửi Backend (Dành cho màn hình này)

**Endpoint:** `POST /api/v1/challenges`

**Payload ví dụ:**
```json
{
  "title": "5AM Warrior",
  "description": "Thử thách dậy sớm tập thể dục",
  "duration_days": 14,
  "start_at": "2026-04-20T05:00:00Z",
  "reset_time": "05:30:00",
  "total_hearts": 4,
  "max_members": 5,
  "is_private": false,
  "invited_user_ids": ["uuid-1", "uuid-2"]
}
```

---

## Câu hỏi hướng dẫn để bạn hoàn thiện UI:
Bạn muốn màn hình này là **một form dài cuộn trang** để người dùng điền một lèo, hay chia thành **3 bước (Next/Back)** để người dùng không bị ngợp thông tin?