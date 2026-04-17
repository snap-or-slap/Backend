
Để thiết kế cơ sở dữ liệu (DB) cho luồng Authentication và Onboarding này, phía Backend cần nắm rõ các trường dữ liệu và logic nghiệp vụ từ 4 màn hình.

Dưới đây là mô tả chi tiết để bạn gửi cho team Backend:

1. Tổng quan thực thể (Entities)
Dựa trên giao diện, chúng ta cần tối thiểu các bảng sau:

Users: Lưu trữ thông tin định danh và đăng nhập.

Profiles: Lưu trữ thông tin hiển thị (có thể gộp chung vào bảng Users nếu hệ thống nhỏ).

UserPermissions: Lưu trữ trạng thái cấp quyền của người dùng (tùy chọn, thường dùng để tracking).

1. Chi tiết từng màn hình
Màn hình B-06: Sign In (Đăng nhập)
Người dùng có hai phương thức xác thực:

Email/Password: Cần xử lý so khớp email và password_hash.

Social Login (Google): Cần lưu trữ google_id hoặc provider_id để định danh.

Màn hình B-06: Sign Up (Đăng ký)
Đây là nơi thu thập dữ liệu khởi tạo cho bảng Users.

Email: string, unique, bắt buộc.

Password: string (Backend phải hash trước khi lưu).

User Name: string, unique, từ 4-20 ký tự (chỉ bao gồm chữ, số, gạch dưới).

Terms Agreement: boolean, lưu vết người dùng đã đồng ý điều khoản.

Màn hình B-07: Complete Profile (Hoàn thiện hồ sơ)
Cập nhật thông tin vào bảng Profiles hoặc Users:

Avatar (Upload photo): string (Lưu URL ảnh sau khi upload lên S3/Cloudinary).

Display Name: string, tên hiển thị thực tế của người dùng (khác với Username định danh).

Logic: Cho phép "Skip photo" (bỏ qua bước ảnh nhưng vẫn lưu Display Name).

Màn hình B-08: Permission Hub (Cấp quyền)
Theo dõi trạng thái quyền của người dùng trên thiết bị (thường lưu ở Local Client, nhưng Backend có thể cần để gửi Push Notifications).

Notifications: boolean (Trạng thái cho phép gửi thông báo).

Camera: boolean.

Photos: boolean.

1. Gợi ý cấu trúc bảng (Database Schema)
Field Type Constraints Description
id UUID/BigInt Primary Key ID duy nhất của user.
email String Unique, Not Null Email đăng nhập.
password_hash String  Mật khẩu đã mã hóa.
username String Unique, Not Null Tên định danh (4-20 chars).
display_name String  Tên hiển thị trên ứng dụng.
avatar_url String Nullable Link ảnh đại diện.
provider Enum 'local', 'google' Nguồn đăng ký.
is_active Boolean Default: true Trạng thái tài khoản.
created_at Timestamp  Thời điểm đăng ký.
2. Các điểm cần lưu ý cho Backend
Validation: Username phải check trùng (Is unique) ngay khi người dùng đang nhập.

Confirm Password: Frontend sẽ check khớp, nhưng Backend cần đảm bảo dữ liệu gửi lên là nhất quán.

Social Login: Nếu người dùng chọn Google, cần quy trình tạo tài khoản tự động nếu email đó chưa tồn tại trong hệ thống.

Security: Cần cung cấp API "Forgot password" (đã thấy link trên màn hình Sign In).

Bạn có muốn mình bổ sung thêm về các API Endpoint cần thiết dựa trên các màn hình này không?
