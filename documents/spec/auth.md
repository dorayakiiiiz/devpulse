# Feature Spec: Authentication and Account Management

- Module: Auth
- Người phụ trách: Fullstack Developer
- Ngày soạn: 2026-10-29
- Trạng thái: Approved

---

## 1. Business Objectives

Cung cấp cơ chế xác thực và quản lý tài khoản an toàn cho nền tảng DevPulse theo mô hình **Dual Token (Access Token + Refresh Token)**. Hệ thống kết hợp Access Token ngắn hạn (15 phút) lưu trong bộ nhớ RAM của Client để gửi qua header `Authorization: Bearer` cùng Refresh Token dài hạn (7 ngày) lưu trong HttpOnly Cookie để xoay vòng token (Token Rotation). Thiết kế này loại bỏ hoàn toàn nguy cơ rò rỉ token qua XSS đồng thời triệt tiêu rủi ro tấn công CSRF, ngăn chặn lạm dụng gửi thư rác OTP bằng cơ chế bảo vệ 2 tầng và hỗ trợ phân quyền người dùng theo vai trò.

---

## 2. Scope

**Trong scope:**
- Đăng ký tài khoản mới và gửi mã OTP xác thực email.
- Xác thực mã OTP để kích hoạt tài khoản, cấp phát Access Token trong response body và Refresh Token trong HttpOnly Cookie.
- Gửi lại mã OTP xác thực kích hoạt tài khoản.
- Đăng nhập xác thực, cấp phát Access Token trong response body và Refresh Token trong HttpOnly Cookie.
- Làm mới Access Token (`/api/auth/refresh-token`) từ Refresh Token Cookie với cơ chế xoay vòng Refresh Token (Token Rotation).
- Đăng xuất và xóa bỏ Refresh Token Cookie tại trình duyệt.
- Lấy thông tin tài khoản hiện tại từ phiên đăng nhập.
- Yêu cầu mã OTP qua email để khôi phục mật khẩu.
- Áp dụng rate limiting theo IP cho xác thực (`authLimiter`: tối đa 20 yêu cầu / 15 phút cho `/register` và `/login`) và cho yêu cầu OTP (`otpIpLimiter`: tối đa 10 yêu cầu / 15 phút, kèm cooldown 60 giây theo email).
- Xác thực mã OTP và cập nhật mật khẩu mới.

**Ngoài scope:**
- Đăng nhập bằng bên thứ ba như Google hoặc GitHub OAuth.
- Xác thực hai yếu tố qua ứng dụng Authenticator.
- Thay đổi địa chỉ email tài khoản.

---

## 3. Permissions

| Role | Quyền |
| :--- | :--- |
| Anonymous User | Gọi các endpoint đăng ký, đăng nhập, yêu cầu OTP và đặt lại mật khẩu. |
| Member | Đăng xuất và xem thông tin tài khoản của chính mình. |
| Admin | Toàn quyền sử dụng các tính năng xác thực như Member. |

---

## 4. Core Business Flows

### 4.1. Registration, Verification and Login Flow
1. Người dùng nhập họ tên (`name`), email và mật khẩu tại giao diện đăng ký.
2. Hệ thống kiểm tra tính hợp lệ của dữ liệu đầu vào (`name` từ 2-50 ký tự, email đúng định dạng, mật khẩu tối thiểu 8 ký tự).
3. Nếu email đã đăng ký và đã xác thực, trả về HTTP 409. Nếu chưa xác thực, cập nhật lại thông tin đăng ký mới. Nếu chưa tồn tại, tạo bản ghi trong collection `users` với `isVerified: false`.
4. Hệ thống sinh mã OTP ngẫu nhiên 6 chữ số, băm bcrypt và lưu vào collection `otp_codes` với thời gian sống 300 giây, đồng thời đẩy tác vụ gửi email OTP xác thực vào In-Memory Task Queue.
5. Người dùng nhập email và mã OTP tại endpoint `/api/auth/verify-email`. Khi mã hợp lệ, hệ thống cập nhật `isVerified: true`, xóa mã OTP và phát hành cặp token:
   - **Access Token:** Ký JWT thời hạn 15 phút, trả về trong response body JSON để Client lưu giữ trên bộ nhớ tạm (RAM).
   - **Refresh Token:** Ký JWT thời hạn 7 ngày, gắn vào Cookie `refreshToken` với cờ `HttpOnly`, `SameSite: strict`, `path: '/'`.
6. Nếu đăng nhập (`/api/auth/login`): Hệ thống đối chiếu mật khẩu băm và kiểm tra cờ `isVerified`. Nếu tài khoản chưa xác thực email, trả về HTTP 403. Khi hợp lệ, hệ thống cấp phát cặp Access Token (trong body JSON) và Refresh Token (trong HttpOnly Cookie).

### 4.2. Token Refresh Flow (Token Rotation & Token Version Invalidation)
1. Khi Access Token trong RAM của Client hết hạn (hoặc sau mỗi 15 phút), Client gửi request `POST /api/auth/refresh-token` (trình duyệt tự động đính kèm cookie `refreshToken`).
2. Hệ thống giải mã và xác thực chữ ký của Refresh Token bằng `JWT_REFRESH_SECRET`. Nếu thiếu token, sai chữ ký hoặc token hết hạn, trả về HTTP 401 yêu cầu đăng nhập lại.
3. Hệ thống tìm kiếm user trong database theo `userId`. Nếu user không tồn tại hoặc chưa xác thực, trả về HTTP 401 hoặc 403.
4. **Kiểm tra tính hợp lệ qua `tokenVersion`:** Hệ thống so khớp `decoded.tokenVersion === user.tokenVersion`. Nếu không khớp (phiên đã bị thu hồi do đổi mật khẩu), trả về HTTP 401 (Invalid or revoked refresh token).
5. Hệ thống áp dụng cơ chế **Token Rotation**:
   - Sinh Access Token mới (15 phút) và trả về trong response body.
   - Sinh Refresh Token mới (7 ngày, đính kèm `user.tokenVersion` hiện tại) và ghi đè vào HttpOnly Cookie `refreshToken` để gia hạn phiên làm việc an toàn.

### 4.3. Password Reset & Credentials Change Flow
1. Người dùng nhập email yêu cầu khôi phục mật khẩu. Hệ thống kiểm tra nếu email không tồn tại trong database thì trả về HTTP 404.
2. Hệ thống kiểm tra trạng thái khóa tạm thời 1 giờ do nhập sai quá 5 lần. Nếu đang bị khóa, trả về HTTP 429.
3. Hệ thống kiểm tra rate limit theo IP. Nếu vượt quá 10 requests trong 15 phút, trả về HTTP 429.
4. Hệ thống kiểm tra cooldown trên bộ nhớ tạm. Nếu yêu cầu gửi lại trước 60 giây, trả về HTTP 429.
5. Nếu hợp lệ: Hệ thống sinh mã OTP ngẫu nhiên gồm 6 chữ số, băm mã và thực hiện atomic upsert vào collection `otp_codes` với thời gian sống 300 giây.
6. Hệ thống ghi nhận cooldown 60 giây trên bộ nhớ tạm và đẩy tác vụ gửi email OTP vào In-Memory Task Queue chạy ngầm với cơ chế thử lại tối đa 3 lần, trả về kết quả thành công ngay lập tức cho người dùng.
7. Người dùng nhập email, mã OTP 6 chữ số và mật khẩu mới.
8. Hệ thống kiểm tra sự tồn tại của user trước (Fail Fast, nếu không tồn tại trả về 404).
9. Hệ thống đối chiếu mã OTP băm. Nếu nhập sai đạt 5 lần, hệ thống xóa OTP, thiết lập khóa tạm thời 1 giờ trên bộ nhớ tạm và trả về HTTP 429.
10. Nếu hợp lệ: Hệ thống cập nhật mật khẩu mới băm bcrypt, **tự động tăng `tokenVersion` lên 1** (`$inc: { tokenVersion: 1 }`) để thu hồi toàn bộ Refresh Token cũ trên mọi thiết bị, đồng thời xóa bản ghi OTP.

---

## 5. API Contract

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/register` | None | Đăng ký tài khoản và gửi mã OTP xác thực email |
| POST | `/api/auth/verify-email` | None | Xác thực OTP, kích hoạt tài khoản, trả về Access Token trong body và gắn Refresh Token vào HttpOnly Cookie |
| POST | `/api/auth/resend-verification` | None | Gửi lại mã OTP kích hoạt tài khoản |
| POST | `/api/auth/login` | None | Đăng nhập tài khoản, trả về Access Token trong body và gắn Refresh Token vào HttpOnly Cookie |
| POST | `/api/auth/refresh-token` | Refresh Cookie | Làm mới Access Token và xoay vòng Refresh Token Cookie |
| POST | `/api/auth/logout` | None / Public | Đăng xuất và xóa bỏ Refresh Token Cookie |
| GET | `/api/auth/me` | Bearer Token | Lấy thông tin user hiện tại qua `Authorization: Bearer <accessToken>` |
| POST | `/api/auth/forgot-password` | None | Yêu cầu gửi mã OTP đặt lại mật khẩu |
| POST | `/api/auth/reset-password` | None | Xác thực OTP và đổi mật khẩu mới |

**Request and Response Payloads:**

```typescript
// POST /api/auth/register - Request
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

// POST /api/auth/verify-email - Request
export interface VerifyEmailRequest {
  email: string;
  otp: string;
}

// POST /api/auth/resend-verification - Request
export interface ResendVerificationRequest {
  email: string;
}

// POST /api/auth/login - Request
export interface LoginRequest {
  email: string;
  password: string;
}

// Authentication Session Response (returned on verify-email, login, refresh-token)
export interface AuthSessionResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: 'member' | 'admin';
    isVerified: boolean;
    createdAt: string;
  };
  accessToken: string;
}

// POST /api/auth/forgot-password - Request
export interface ForgotPasswordRequest {
  email: string;
}

// POST /api/auth/reset-password - Request
export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

// Standard Message Response
export interface MessageResponse {
  message: string;
}
```

**Status Codes:**

| Code | Khi nào trả về |
| :--- | :--- |
| 200 | Xử lý thành công các thao tác đăng nhập, đăng xuất, lấy thông tin, khôi phục mật khẩu |
| 201 | Đăng ký tài khoản mới thành công |
| 400 | Dữ liệu đầu vào không hợp lệ hoặc mã OTP sai |
| 401 | Email hoặc mật khẩu không chính xác, thiếu/hết hạn Access Token hoặc Refresh Token |
| 403 | Tài khoản chưa xác thực email khi cố gắng đăng nhập |
| 404 | Địa chỉ email yêu cầu đặt lại mật khẩu không tồn tại trên hệ thống |
| 409 | Địa chỉ email đã được đăng ký trước đó |
| 429 | Vượt quá giới hạn tần suất theo IP, chưa hết thời gian cooldown 60 giây hoặc đang bị khóa 1 giờ do nhập sai OTP quá 5 lần |

---

## 6. Data

**Collections liên quan:**

| Collection | Thao tác | Ghi chú |
| :--- | :--- | :--- |
| `users` | INSERT, SELECT, UPDATE | Quản lý thông tin user, mật khẩu băm, vai trò và trường `tokenVersion` (Number, default 0) để kiểm soát thu hồi phiên |
| `otp_codes` | UPSERT, SELECT, DELETE | Quản lý mã OTP tự hủy qua TTL index 300 giây |

**Invariants:**
- Email trong `users` là duy nhất và luôn viết thường.
- Mật khẩu lưu trữ luôn ở dạng băm bcrypt, không lưu trữ mật khẩu gốc.
- `tokenVersion` luôn tăng thêm 1 khi đổi mật khẩu hoặc đặt lại mật khẩu để hủy bỏ toàn bộ phiên làm việc cũ.
- Bản ghi trong `otp_codes` luôn tự động bị xóa sau 300 giây kể từ thời điểm tạo.
- Mỗi email chỉ tồn tại tối đa 1 bản ghi OTP còn hiệu lực tại một thời điểm.

---

## 7. Errors and Edge Cases

| Điều kiện | Người dùng thấy gì | Hệ thống xử lý |
| :--- | :--- | :--- |
| Email đăng ký đã tồn tại | Email đã được sử dụng | Trả về HTTP 409 |
| Sai thông tin đăng nhập | Email hoặc mật khẩu không chính xác | Trả về HTTP 401 |
| Gửi OTP quá nhanh dưới 60s | Vui lòng đợi 60 giây trước khi yêu cầu lại mã | Trả về HTTP 429 |
| IP gửi quá 10 request OTP trong 15m | Quá nhiều yêu cầu, vui lòng thử lại sau | Trả về HTTP 429 |
| OTP sai hoặc hết hạn 5m | Mã xác thực không chính xác hoặc đã hết hạn | Trả về HTTP 400 |
| Nhập sai OTP quá 5 lần | Quá số lần thử, tạm thời khóa đặt lại mật khẩu trong 1 giờ | Xóa OTP, thiết lập khóa 1 giờ trên bộ nhớ tạm và trả về HTTP 429 |
| Email yêu cầu OTP không tồn tại | Email không tồn tại trên hệ thống | Trả về HTTP 404 |
| Đang trong thời gian khóa 1 giờ | Quá nhiều lần thử sai, tính năng đặt lại mật khẩu tạm thời bị khóa trong 1 giờ | Trả về HTTP 429 |
| Access Token hết hạn hoặc sai chữ ký | Phiên đăng nhập không hợp lệ hoặc đã hết hạn | Trả về HTTP 401 (kích hoạt client gọi refresh token) |
| Refresh Token bị thiếu hoặc hết hạn | Phiên làm việc đã kết thúc | Trả về HTTP 401 (chuyển hướng client về màn hình login) |
| Refresh Token có `tokenVersion` cũ | Phiên làm việc đã bị thu hồi | Trả về HTTP 401 (chuyển hướng client về màn hình login) |

---

## 8. User Interface

**Bố cục màn hình:**
- Màn hình Đăng nhập và Đăng ký: Khung thẻ chính giữa màn hình với form gồm email, password, nút gửi và nút chuyển đổi qua lại.
- Luồng Quên mật khẩu: Modal hoặc màn hình riêng tiếp nhận email, hiển thị đếm ngược cooldown 60 giây và form nhập OTP kèm mật khẩu mới.

**States:**
- Loading: Nút bấm hiển thị trạng thái đang xử lý và vô hiệu hóa thao tác click.
- Error: Hiển thị thông báo lỗi nổi bật ngay dưới trường nhập liệu hoặc trên đầu form.
- Success: Chuyển hướng người dùng vào Dashboard hoặc thông báo đổi mật khẩu thành công.

---

## 9. Constraints

- Triển khai mô hình **Dual Token kết hợp Token Version**:
  - **Access Token:** Ký JWT với `JWT_SECRET`, thời hạn sống ngắn (15 phút), lưu trên bộ nhớ RAM của ứng dụng client và gửi kèm qua header `Authorization: Bearer <accessToken>`.
  - **Refresh Token:** Ký JWT với `JWT_REFRESH_SECRET`, thời hạn sống dài (7 ngày), nhúng payload `{ id: userId, tokenVersion }`, lưu trong HttpOnly Cookie với các cờ `httpOnly = true`, `sameSite = 'strict'`, `path = '/'`, và `secure = true` trên production.
  - Áp dụng cơ chế **Token Rotation & Instant Revocation**: Mỗi khi gọi `/api/auth/refresh-token`, hệ thống xác thực `decoded.tokenVersion === user.tokenVersion` trước khi phát hành cặp token mới. Khi đổi mật khẩu thành công, trường `tokenVersion` trong database tự động tăng thêm 1, vô hiệu hóa ngay tức thì toàn bộ Refresh Token cũ trên tất cả các thiết bị.
- Thuật toán băm mật khẩu sử dụng `bcrypt` với cost factor tối thiểu là 10.
- Khóa bí mật ký JWT được nạp từ biến môi trường `JWT_SECRET` và `JWT_REFRESH_SECRET`, tuyệt đối không lưu cứng trong mã nguồn.
- Giới hạn tần suất được thực thi qua `express-rate-limit` cho IP và `node-cache` cho cooldown email.
- Tác vụ gửi email OTP được đẩy vào In-Memory Task Queue chạy ngầm với cơ chế thử lại tối đa 3 lần, không chặn thời gian phản hồi của endpoint quên mật khẩu.

---

## 10. Acceptance Criteria

- **AC1:** Đăng ký thành công trả về HTTP 201 và gửi OTP kích hoạt qua email; xác thực thành công qua `/api/auth/verify-email` chuyển trạng thái `isVerified: true`, trả về `accessToken` trong JSON response và ghi cookie `refreshToken`.
- **AC2:** Đăng nhập thành công trả về HTTP 200 kèm `accessToken` trong JSON response và ghi cookie `refreshToken`.
- **AC3:** Endpoint `GET /api/auth/me` xác thực qua header `Authorization: Bearer <accessToken>`, trả về profile user hoặc HTTP 401 khi token thiếu/hết hạn.
- **AC4:** Endpoint `POST /api/auth/refresh-token` đọc Refresh Token từ cookie, so khớp `tokenVersion` với database, cấp Access Token mới và xoay vòng Refresh Token Cookie mới.
- **AC5:** Khi người dùng đổi mật khẩu hoặc đặt lại mật khẩu qua OTP, trường `tokenVersion` tăng thêm 1 và toàn bộ Refresh Token cũ trước đó bị từ chối với HTTP 401.
- **AC6:** Khi gọi yêu cầu OTP lần thứ hai trong vòng 60 giây, hệ thống trả về HTTP 429.
- **AC7:** Khi nhập đúng email, OTP và mật khẩu mới, hệ thống đổi mật khẩu thành công và vô hiệu hóa ngay mã OTP cũ.
- **AC8:** Đăng xuất xóa bỏ cookie `refreshToken` tại trình duyệt.

---

## 11. Test Cases

| Scenario | Input | Expected Output |
| :--- | :--- | :--- |
| Đăng ký thành công | Email hợp lệ, mật khẩu đủ độ dài | HTTP 201 + nhận email OTP xác thực |
| Xác thực kích hoạt email đúng OTP | Email, mã OTP 6 số chính xác | HTTP 200 + { user, accessToken } + Cookie refreshToken |
| Đăng ký trùng email đã xác thực | Email đã có trong database và đã kích hoạt | HTTP 409 Conflict |
| Đăng nhập tài khoản chưa kích hoạt | Email và mật khẩu đúng nhưng chưa verify | HTTP 403 Forbidden |
| Đăng nhập mật khẩu đúng | Email đã kích hoạt và mật khẩu chính xác | HTTP 200 + { user, accessToken } + Cookie refreshToken |
| Đăng nhập sai mật khẩu | Email đúng, mật khẩu sai | HTTP 401 Unauthorized |
| Làm mới token với Refresh Cookie hợp lệ | Cookie refreshToken còn hạn | HTTP 200 + { user, accessToken } + Cookie refreshToken mới |
| Làm mới token khi không có cookie | Không gửi cookie | HTTP 401 Unauthorized |
| Yêu cầu OTP lần đầu | Email đã đăng ký | HTTP 200 + nhận email OTP |
| Yêu cầu OTP trong cooldown | Email yêu cầu lại sau 20s | HTTP 429 Too Many Requests |
| Reset password với OTP đúng | Email, OTP đúng, mật khẩu mới hợp lệ | HTTP 200 + mật khẩu mới có hiệu lực |
| Reset password với OTP hết hạn | Email, OTP quá 5 phút | HTTP 400 Bad Request |
| Truy cập me khi không truyền Bearer token | Header không có Bearer token | HTTP 401 Unauthorized |

