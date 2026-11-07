# Feature Spec: Frontend Architecture, Global Layout, and Authentication Workflows

- Module: Frontend Core & Auth
- Người phụ trách: Fullstack Developer
- Ngày soạn: 2026-11-07
- Trạng thái: Approved

---

## 1. Mục tiêu nghiệp vụ

Xây dựng bộ khung Frontend hoàn chỉnh theo chuẩn mực Enterprise cho nền tảng DevPulse. Thiết lập cấu trúc thư mục phân tầng sạch (Clean Architecture), typed API Client với Interceptor tự động làm mới token ngầm (Silent Refresh via HttpOnly Cookie), quản lý trạng thái tập trung với Zustand, định tuyến với React Router DOM v7, hệ thống thông báo Toast phong cách Neo-Brutalism đồng bộ giao diện Figma, toàn bộ màn hình xác thực tài khoản (Đăng nhập, Đăng ký, Xác minh OTP email, Quên mật khẩu, Đặt lại mật khẩu), cùng với Layout điều hướng trung tâm (Sidebar, Header, Theme Toggle, User Account Modal/Trigger) và khung trang sẵn sàng cho các module chức năng tiếp theo.

---

## 2. Phạm vi

**Trong scope:**
- Khởi tạo kiến trúc thư mục chuẩn mực: `components/`, `layouts/`, `pages/`, `routes/`, `services/`, `stores/`, `types/`, `hooks/`, `lib/`.
- Thiết lập hệ thống Design System Neo-Brutalism qua Tailwind CSS kế thừa bảng màu, font chữ DM Sans, border và retro box-shadows từ Figma.
- Triển khai `apiClient` qua Axios với:
  - Request Interceptor: đính kèm `Authorization: Bearer <accessToken>`.
  - Response Interceptor: bắt lỗi `401 Unauthorized`, gọi `/api/auth/refresh-token`, duy trì hàng đợi Promise cho các request đồng thời, tự động retry khi cấp mới token thành công.
- Quản lý trạng thái xác thực qua `useAuthStore` (Zustand) và chế độ giao diện qua `useThemeStore` (Zustand, lưu LocalStorage).
- Toàn bộ luồng xác thực tại `/auth`: Đăng nhập, Đăng ký với điều hướng OTP, Gửi lại mã OTP đếm ngược 60s, Khôi phục mật khẩu 2 bước.
- Layout Dashboard chung tại `/`: Sidebar đầy đủ điều hướng (`Overview`, `Monitors`, `Incidents`, `System Admin`, `Public Status`), Header với trạng thái trực tiếp, theme switch, trang trí Retro Window Bar, và các khung trang placeholder chuẩn bị cho phát triển.
- Các Route Guards: `ProtectedRoute` (yêu cầu đăng nhập), `PublicRoute` (chặn người đã đăng nhập quay lại `/auth`).

**Ngoài scope (không làm ở sprint này):**
- Logic nghiệp vụ chi tiết của các trang Monitors CRUD, Incident AI resolution, Realtime SSE streaming subscriber (sẽ được phát triển ở các sprint chuyên biệt tiếp theo).

---

## 3. Phân quyền

| Role | Quyền |
| :--- | :--- |
| **Anonymous (Khách)** | Chỉ truy cập được `/auth` (Login, Register, Forgot Password, Verify OTP) và `/status/:slug` (Public Status Page). |
| **Member** | Truy cập toàn bộ Dashboard: `/`, `/monitors`, `/monitors/:id`, `/incidents`. Không có quyền truy cập `/admin`. |
| **Admin** | Truy cập toàn bộ tính năng bao gồm `/admin` (System Overview & Platform Health). |

---

## 4. Luồng nghiệp vụ chính (Happy Path)

### 4.1 Luồng Đăng nhập (Sign In)
1. Người dùng truy cập `/auth` (chế độ Login).
2. Nhập Email và Password, bấm "Sign in to workspace".
3. `authService.login()` gửi `POST /api/auth/login`.
4. Backend trả về `{ success: true, data: { user, accessToken } }` và set cookie `refreshToken`.
5. Frontend lưu `user` và `accessToken` vào `useAuthStore`, hiển thị Toast thành công và tự động chuyển hướng về `/`.

### 4.2 Luồng Đăng ký & Kích hoạt tài khoản (Register & OTP Verification)
1. Người dùng chọn tab "Create account" tại `/auth`.
2. Nhập Name, Email, Password, bấm "Create workspace".
3. Frontend gọi `POST /api/auth/register`, backend khởi tạo tài khoản và gửi mã OTP 6 số qua email.
4. Form chuyển sang bước xác minh OTP (`step = 'otp'`), bắt đầu đếm ngược 60 giây.
5. Người dùng nhập 6 chữ số OTP, frontend tự động gọi `POST /api/auth/verify-email`.
6. Backend kích hoạt tài khoản và cấp phát token; Frontend cập nhật `useAuthStore` và chuyển hướng vào Dashboard.

### 4.3 Luồng Khôi phục mật khẩu (Password Recovery)
1. Người dùng chọn "Forgot password?" tại `/auth`.
2. Nhập email, bấm "Send recovery code".
3. Frontend gọi `POST /api/auth/forgot-password`. Backend gửi OTP khôi phục.
4. Form chuyển sang bước OTP + Mật khẩu mới. Người dùng nhập OTP, mật khẩu mới và xác nhận mật khẩu.
5. Bấm "Reset password", frontend gọi `POST /api/auth/reset-password`.
6. Thông báo thành công hiển thị, form tự động quay về chế độ đăng nhập.

---

## 5. API Contract

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/login` | None | Đăng nhập tài khoản |
| POST | `/api/auth/register` | None | Đăng ký tài khoản |
| POST | `/api/auth/verify-email` | None | Xác minh OTP kích hoạt tài khoản |
| POST | `/api/auth/resend-verification` | None | Gửi lại mã OTP đăng ký |
| POST | `/api/auth/forgot-password` | None | Yêu cầu OTP khôi phục mật khẩu |
| POST | `/api/auth/reset-password` | None | Đặt lại mật khẩu với OTP |
| POST | `/api/auth/refresh-token` | Cookie | Cấp mới access token từ refresh cookie |
| POST | `/api/auth/logout` | Bearer Token | Đăng xuất và xóa session cookie |
| GET | `/api/auth/me` | Bearer Token | Lấy thông tin tài khoản hiện tại |

**TypeScript Client Interfaces:**

```typescript
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  slug: string;
  role: 'member' | 'admin';
  isVerified: boolean;
  createdAt: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: Record<string, string[]>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
```

---

## 6. Data

- **Frontend State (Zustand in-memory):**
  - `authStore`: `user`, `accessToken`, `isAuthenticated`, `isInitializing`.
  - `themeStore`: `theme` ('light' | 'dark', đồng bộ hóa qua LocalStorage).
- **Trình duyệt (Browser Storage / Cookie):**
  - `HttpOnly Cookie`: `refreshToken` (Quản lý tự động bởi trình duyệt, frontend không đọc trực tiếp nhằm triệt tiêu rủi ro XSS).
  - `localStorage`: Khóa `devpulse_theme` ('light' hoặc 'dark').

---

## 7. Errors & Edge Cases

| Điều kiện | Người dùng thấy gì | Hệ thống làm gì |
| :--- | :--- | :--- |
| Email chưa xác minh khi login | Toast cảnh báo màu vàng | Tự động chuyển form sang bước nhập OTP và gửi mã mới |
| Nhập sai OTP | Toast báo lỗi "Verification code is invalid or expired" | Giữ nguyên form OTP để nhập lại |
| Quá 5 lần nhập sai OTP | Toast báo lỗi bị khóa 1 giờ | Khóa nút submit theo phản hồi 429 từ Backend |
| Access Token hết hạn (15p) | Không bị gián đoạn màn hình | Axios Interceptor âm thầm gọi `/api/auth/refresh-token` và retry request |
| Refresh Token hết hạn hoặc bị thu hồi | Tự động chuyển về `/auth` | Xóa `authStore`, yêu cầu đăng nhập lại |

---

## 8. UI / Màn hình

- **Phong cách thị giác:** Neo-Brutalism kết hợp Retro-Modern lấy cảm hứng 100% từ Figma (`DevPulse-Figma`), đường viền sắc nét `border-2 border-zinc-950`, bóng đổ cứng `shadow-[4px_4px_0_#18181b]`, thanh cửa sổ RetroWindowBar với 3 nút tròn màu sắc.
- **Màn hình Auth (`/auth`):**
  - Khung chia 2 cột: Cột trái retro lilac mang thương hiệu DevPulse, logo, số liệu uptime 99.99%; Cột phải nền cream cho form đăng nhập / đăng ký / OTP.
  - Hỗ trợ nhập 6 số OTP tự động nhảy focus ô tiếp theo và hỗ trợ dán (paste) chuỗi 6 ký tự.
- **Màn hình Dashboard Layout (`/`):**
  - Sidebar cố định bên trái (thu gọn trên mobile) với logo, các mục điều hướng chính, thẻ người dùng góc dưới kèm nút sao chép link trang trạng thái công khai.
  - Header trên cùng hiển thị tiêu đề trang, live stream pulsing badge, nút chuyển theme Dark/Light.
  - Khu vực nội dung chính scroll mượt mà với thanh cuộn retro scrollbar.

---

## 9. Constraints

- 100% tiếng Anh cho toàn bộ mã nguồn, interface, comments, commit messages.
- Nghiêm cấm sao chép mock state/data từ Figma; xây dựng logic nghiệp vụ thực tế độc lập kết nối API thật.
- Không code nước đôi, không phòng thủ thừa thãi khi dữ liệu đã được backend định nghĩa tường minh.
- Phải vượt qua type-check (`tsc --noEmit`) và build (`vite build`) với 0 lỗi.

---

## 10. Acceptance Criteria

- **AC1:** Người dùng đăng ký tài khoản mới $\rightarrow$ nhận OTP email $\rightarrow$ nhập OTP thành công $\rightarrow$ đăng nhập tự động vào Dashboard.
- **AC2:** Người dùng đăng nhập tài khoản hợp lệ $\rightarrow$ lưu session $\rightarrow$ chuyển hướng vào Dashboard.
- **AC3:** Khi reload trang, hệ thống tự động phục hồi phiên đăng nhập qua `authService.getMe()` hoặc silent refresh token mà không làm người dùng bị văng ra.
- **AC4:** Khi access token hết hạn, request API tiếp theo tự động lấy token mới và tiếp tục thực thi không báo lỗi.
- **AC5:** Điều hướng Sidebar chuyển trang tức thì qua React Router DOM; nút Toggle Theme chuyển đổi mượt mà giữa Dark và Light mode.

---

## 11. Test Cases

| Scenario | Input | Expected |
| :--- | :--- | :--- |
| Happy path login | Email + Password đúng | Toast "Signed in", lưu session, chuyển hướng về `/` |
| Login sai mật khẩu | Email đúng, Password sai | Toast lỗi "Invalid email or password", giữ nguyên form |
| Verify OTP hợp lệ | 6 chữ số OTP chính xác | Kích hoạt tài khoản, chuyển hướng về Dashboard |
| Refresh token âm thầm | Access token hết hạn khi gọi API | Interceptor gọi `/api/auth/refresh-token` thành công, retry request gốc |
| Logout | Bấm nút đăng xuất ở Sidebar footer | Gọi `/api/auth/logout`, xóa state, chuyển hướng về `/auth` |

