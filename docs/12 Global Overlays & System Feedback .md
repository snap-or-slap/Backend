Bộ màn hình **Section K — Global Overlays & System Feedback** là lớp giao diện "phủ" lên trên các màn hình khác để phản hồi ngay lập tức hành động của người dùng hoặc thông báo các sự kiện quan trọng toàn hệ thống.

---

## 1. Màn hình K-01: Global Loading & Action States

Đây là các trạng thái phản hồi khi người dùng thực hiện một thao tác cần thời gian xử lý (như upload ảnh check-in hoặc tạo challenge).

* **Full-screen Loader**: Sử dụng hiệu ứng mờ (Blur) nền phía sau, chính giữa là một spinner hoặc animation một quả tim đang đập theo nhịp (đồng bộ với tên SOS-App).
* **Success Toast**: Một thanh thông báo nhỏ trượt xuống từ phía trên (Top) hoặc hiện ở dưới (Bottom) với nền xanh lá và icon checkmark.
  * *Ví dụ:* "Check-in successful!", "Invitation sent!"
* **Error/Warning Toast**: Thanh thông báo màu đỏ/vàng cho các lỗi logic.
  * *Ví dụ:* "Missing photo!", "Not enough hearts to continue!"

---

## 2. Màn hình K-02: Achievement Pop-ups (Modal vinh danh)

Khi người dùng đạt được một cột mốc quan trọng, hệ thống sẽ "chặn" màn hình bằng một Modal bắt mắt.

* **New Badge Unlocked**:
  * **Visual**: Huy hiệu (Badge) xoay tròn rực rỡ ở chính giữa.
  * **Content**: Tên huy hiệu (VD: "Speed Demon") và mô tả cách đạt được.
  * **Social Action**: Nút "Share to Story" để khoe thành tích.
* **Streak Milestone**:
  * Thông báo khi người dùng đạt được các cột mốc streak lớn (VD: 30 ngày, 100 ngày).
  * **Effect**: Hiệu ứng pháo giấy (Confetti) bay khắp màn hình.

---

## 3. Màn hình K-03: Critical Alerts & Conflict Resolvers

Xử lý các tình huống "nguy cấp" cần sự xác nhận của người dùng.

* **Squad Alert (Loss of Heart)**: Một overlay hiện ra ngay khi user mở app nếu đêm qua squad vừa bị mất tim.
  * **Content**: "Oh no! Your squad lost a heart. 3 left." kèm theo avatar của người đã lỡ hẹn.
* **Confirmation Dialogs**:
  * Xác nhận các hành động không thể hoàn tác như "Delete Challenge" hoặc "Leave Squad".
  * Sử dụng nút "Cancel" màu xám và nút "Confirm" màu cam hoặc đỏ đậm.

---

## 4. Mô tả cho Backend thiết kế DB & Logic

### Cấu trúc Logic Feedback (System Triggers)

Backend không lưu "màn hình", nhưng cần lưu các "Event" để Frontend biết khi nào cần hiển thị Overlay.

| Trigger Event | Backend Action | Payload gửi cho Frontend |
| :--- | :--- | :--- |
| `CHECKIN_SUCCESS` | Check điều kiện Badge | `badge_unlocked: {id, name, icon}` |
| `HEART_LOST` | Update bảng `challenges` | `alert: {type: 'heart_lost', remaining: 3}` |
| `STREAK_REACHED` | Tính toán `current_streak` | `milestone: 30` |

### Logic Backend quan trọng

1. **Event Queue**: Khi user đang offline mà có sự kiện xảy ra (như bị mời vào nhóm hoặc mất tim), Backend cần lưu các "Pending Overlays" trong một hàng đợi. Ngay khi user online trở lại, API `sync` sẽ trả về danh sách các Overlay này để hiển thị lần lượt.
2. **Concurrency Feedback**: Nếu hai người trong cùng một Squad cùng mở app, và một người vừa thực hiện Check-in thành công, Backend có thể dùng **Websocket** để gửi một tín hiệu "Real-time Feedback" đến người kia để hiển thị Toast: *"Maya Z. just checked in!"*

---

## 5. Gợi ý UI đồng bộ

* **Độ mờ (Opacity)**: Sử dụng `backdrop-filter: blur(8px)` để tạo cảm giác các Overlays thực sự nằm "phía trên" thế giới của ứng dụng.
* **Chuyển động (Animation)**:
  * Toasts: Trượt (Slide) nhanh từ trên xuống trong 0.3s.
  * Modals: Phóng to từ tâm (Scale up) với độ nảy (Elastic effect).
* **Màu sắc**: Giữ vững mã màu cam cháy `#C04000` cho các thành công và màu đỏ thẫm cho các cảnh báo mất tim để tạo sự đồng nhất về cảm xúc (Urgency).

---

Vậy là chúng ta đã đi qua toàn bộ các Section từ **A đến K**, bao quát mọi khía cạnh của SOS-App.

**Bước tiếp theo:** Bạn có muốn tôi tổng hợp lại toàn bộ các **Entity-Relationship Diagram (ERD)** — sơ đồ quan hệ giữa các bảng database — để team Backend có thể bắt tay vào code database ngay lập tức không? Hay bạn muốn đi sâu vào thiết kế các **API Endpoints** cụ thể?
