Đây là mô tả chi tiết cho bộ màn hình **Active Challenge & Check-in**. Đây là giai đoạn quan trọng nhất của ứng dụng, nơi người dùng thực hiện các hành động hàng ngày và hệ thống ghi nhận kết quả.

---

## 1. Màn hình F-01: Active Challenge Detail (Chi tiết thử thách đang chạy)

Màn hình này hiển thị khi người dùng nhấn vào một thử thách ở trạng thái `Active`.

* **Khu vực Trạng thái Đội (Squad Status):**
  * **Progress Bar**: Thanh tiến độ chung của cả đội (Ví dụ: "Day 6 of 14").
  * **Squad Health**: Hiển thị số Tim còn lại của cả đội dưới dạng các icon tim (VD: ❤️❤️❤️🤍 - còn 3/4 tim).
  * **Member Grid**: Danh sách avatar thành viên. Mỗi avatar sẽ có một trạng thái:
    * *Checked-in*: Có viền xanh lá hoặc icon tích xanh.
    * *Pending*: Viền mờ hoặc icon đồng hồ (chưa check-in hôm nay).
    * *Failed*: Icon dấu X đỏ (nếu họ đã làm mất tim của đội trong ngày hôm trước).
* **Khu vực Nội dung chính:**
  * **Countdown Timer**: Thời gian còn lại cho đến giờ Reset tiếp theo (VD: "Ends in 04:20:15").
  * **Instruction**: Câu lệnh hoặc yêu cầu của ngày hôm nay (VD: "Take a photo of your running shoes").
* **Hành động (Actions):**
  * **Main Button: Check-in**: Nút to, màu Cam cháy ở dưới cùng để mở camera/upload minh chứng.
  * **Nudge Friends**: Nút "Nhắc nhở" đối với những thành viên chưa check-in.

---

## 2. Màn hình F-02: Check-in Action (Thực hiện Check-in)

Màn hình này xuất hiện sau khi nhấn nút "Check-in".

* **Camera Interface/Upload**:
  * Giao diện chụp ảnh trực tiếp hoặc chọn ảnh từ thư viện (tùy thuộc vào thiết lập permissions đã làm ở màn hình B-08).
  * **Overlay**: Có thể có watermark ghi ngày giờ và tên Challenge đè lên ảnh để đảm bảo tính xác thực.
* **Caption (Input)**: Ô nhập văn bản ngắn để người dùng chia sẻ cảm nghĩ về lần check-in này.
* **Confirmation**: Nút "Submit" để gửi minh chứng lên hệ thống.

---

## 3. Màn hình F-03: Check-in Success & Daily Feedback

Sau khi submit thành công:

* **Success Animation**: Hiệu ứng chúc mừng (congratulations).
* **Daily Streak Update**: Hiển thị số ngày liên tiếp user đã hoàn thành (VD: "You've reached a 12-day streak!").
* **Next Goal Preview**: Thông báo về bước tiếp theo của ngày mai.

---

## 4. Logic Backend & Thiết kế DB (Đồng bộ hệ thống)

Phía Backend cần một cấu trúc lưu trữ nhật ký (logs) cực kỳ chính xác:

### Bảng `checkins` (Lưu bằng chứng thực hiện)

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | PK. |
| `challenge_id`| UUID | FK. |
| `user_id` | UUID | FK. |
| `evidence_url`| String | Link ảnh lưu trên storage (S3/Cloudinary). |
| `caption` | Text | Nội dung người dùng viết. |
| `created_at` | Timestamp | Thời điểm thực hiện (dùng để so với `reset_time`). |

### Logic nghiệp vụ quan trọng

1. **Validation Window**: Backend chỉ chấp nhận check-in trong khoảng thời gian từ sau giờ `reset_time` hôm qua đến trước giờ `reset_time` hôm nay.
2. **Heart Deduction (Trừ tim)**:
    * Tại thời điểm `reset_time`, hệ thống quét tất cả thành viên trong Squad.
    * Nếu bất kỳ ai chưa có bản ghi trong bảng `checkins` cho chu kỳ đó -> Trừ 1 `hearts_left` trong bảng `challenges`.
    * Gửi thông báo: "Squad lost a heart because [User A] missed their goal."
3. **Step Increment**: Nếu ít nhất một người check-in hoặc tùy theo luật (thường là tất cả phải hoàn thành), `current_step` của challenge sẽ tăng lên.
4. **Streak Protection**: Nếu đội mất tim nhưng vẫn chưa Game Over, chuỗi Streak của những người đã check-in vẫn được giữ nguyên hay bị reset? (Thường là reset streak đội nhưng giữ cá nhân).

---

## 5. Gợi ý UI đồng bộ

* **Gamification**: Sử dụng thanh tiến độ dạng bậc thang hoặc con đường để thể hiện sự tiến lên mỗi ngày.
* **Màu sắc trạng thái**:
  * **Xanh lá**: An toàn, đã check-in.
  * **Vàng/Cam**: Cảnh báo sắp hết giờ.
  * **Đỏ**: Nguy hiểm, sắp mất tim hoặc đã mất tim.

Bộ màn hình này tạo ra áp lực tích cực cho người dùng. Bạn có muốn tôi bổ sung thêm màn hình **"Game Over"** (Khi hết tim) và màn hình **"Challenge Completed"** (Khi về đích) để hoàn tất luồng không?
