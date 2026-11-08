# DevPulse End-to-End Testing & CI Pipeline Specification Blueprint

Tài liệu này xác định toàn diện chiến lược kiểm thử tự động (Automated Testing Strategy), cấu trúc bộ test suite, danh mục test cases chi tiết từ A-Z, và quy trình kiểm soát chất lượng trong **Continuous Integration (CI)** pipeline cho toàn bộ hệ thống **DevPulse** (bao gồm Backend Node.js / TypeScript và Frontend React / Vite).

Tài liệu này được biên soạn đóng vai trò là **Đặc tả Kỹ thuật Chuẩn mực (Implementation Blueprint)** để bất kỳ AI Agent hoặc kỹ sư nào trong các phiên làm việc tiếp theo có thể đọc và sinh mã nguồn kiểm thử (`test code`) chính xác 100%, không bị sai lệch cấu trúc hay thiếu sót nghiệp vụ.

---

## 1. Triết Lý Kiểm Thử & Kim Tự Tháp Testing (Testing Pyramid)

Hệ thống áp dụng mô hình Kim tự tháp kiểm thử thực dụng (Pragmatic Testing Pyramid), tập trung tối đa nguồn lực vào những tầng mang lại tỷ lệ hoàn vốn kiểm thử cao nhất (*High ROI*), chạy nhanh, độc lập và bảo vệ chống hồi quy (*Anti-Regression*):

```
                     / \
                    /   \
                   / E2E \           (Tầng 3: Smoke Test / Healthcheck / Post-Deploy)
                  /-------\
                 /  INTEG  \         (Tầng 2: API Integration & DB Scoping / Supertest)
                /-----------\
               /    UNIT     \       (Tầng 1: Business Services / Utilities / Stores / Hooks)
              /---------------\
```

### Nguyên tắc bất biến (Non-Negotiable Testing Rules):
1. **Kiểm thử độc lập với Database thật (Zero External DB Dependency):**
   - Tuyệt đối không kết nối vào MongoDB Atlas hoặc MongoDB container dùng chung khi chạy CI.
   - Tầng Backend Integration Test sử dụng **`mongodb-memory-server`** (MongoDB in-memory chạy trực tiếp trên RAM của runner CI, khởi tạo lúc bắt đầu test và tự hủy khi test hoàn tất).
2. **Kiểm thử cách ly Third-Party Services (Deterministic Test Execution):**
   - Toàn bộ các dịch vụ bên ngoài (LLM AI APIs: Groq/Gemini, SMTP Email Server: Nodemailer, Network probes: Ping Fetch/SSL) bắt buộc phải được mock thông qua **Vitest Spies / Stubs** hoặc **Mock Service Worker (MSW)**. Các bài test phải chạy ổn định 100% trong môi trường offline không có internet.
3. **Bảo mật IDOR & Scoping là trọng tâm kiểm thử (OWASP Anti-Enumeration):**
   - Mọi endpoint có `:id` (Monitors, Incidents) bắt buộc phải có test case: User B cố tình đọc/sửa/xóa tài nguyên của User A.
   - Kết quả mong đợi bắt buộc phải là **`HTTP 404 Not Found`** (chứ không phải 403) để đảm bảo an toàn chống dò quét thực thể.
4. **Tốc độ thực thi CI dưới 3 phút (Fast Feedback Loop):**
   - Cả Backend và Frontend đều sử dụng **`Vitest`** làm test runner thống nhất để tận dụng kiến trúc multithreading / worker pools siêu nhanh của Node.js & Vite.

---

## 2. Công Nghệ & Thư Viện Kiểm Thử (Tech Stack & Tooling)

### 2.1. Backend Testing Stack
| Thư viện | Phiên bản khuyến nghị | Mục đích sử dụng |
| :--- | :--- | :--- |
| **`vitest`** | `^1.6.0` hoặc mới nhất | Test Runner chính, tương thích native với TypeScript và ESM. |
| **`supertest`** | `^7.0.0` | Gửi HTTP requests ảo trực tiếp vào Express `app` mà không cần lắng nghe port mạng thật. |
| **`@types/supertest`** | `^6.0.0` | Type definitions cho Supertest. |
| **`mongodb-memory-server`** | `^9.2.0` | Khởi tạo instance MongoDB in-memory trên RAM để kiểm thử query thật, compound indexes và transaction. |

### 2.2. Frontend Testing Stack
| Thư viện | Phiên bản khuyến nghị | Mục đích sử dụng |
| :--- | :--- | :--- |
| **`vitest`** | `^1.6.0` hoặc mới nhất | Test Runner chính, dùng chung cấu hình và alias với `vite.config.ts`. |
| **`@testing-library/react`** | `^15.0.0` | Render components, mô phỏng tương tác người dùng (click, type, submit). |
| **`@testing-library/jest-dom`** | `^6.4.0` | Cung cấp matchers mở rộng (`toBeInTheDocument`, `toHaveClass`, `toBeDisabled`). |
| **`@testing-library/user-event`** | `^14.5.0` | Mô phỏng hành vi bàn phím, clipboard, chuột chính xác theo trình duyệt thực tế. |
| **`jsdom`** | `^24.0.0` | Giả lập môi trường DOM, window, document trên Node.js. |

---

## 3. Cấu Trúc Thư Mục Kiểm Thử (Directory Layout)

```text
dev-pulse/
├── backend/
│   ├── vitest.config.ts                 # Cấu hình Vitest backend, setupFiles, coverage
│   └── tests/
│       ├── setup.ts                     # Khởi tạo in-memory Mongo, cleanup collections, mock utilities
│       ├── helpers/
│       │   ├── authHelper.ts            # Helper tạo user giả, cấp JWT token và cookie
│       │   └── mockData.ts              # Payload mẫu cho monitors, incidents, metrics
│       ├── unit/
│       │   ├── sslChecker.test.ts       # Test phân tích TLS certificate & daysRemaining
│       │   ├── slug.test.ts             # Test chuẩn hóa slug regex [a-z0-9-]
│       │   ├── appError.test.ts         # Test centralized AppError mapping
│       │   ├── metricBuffer.test.ts     # Test RAM buffer batching 100 items / 5s flush
│       │   └── pingExecutor.test.ts     # Test HTTP probe execution & status code mapping
│       └── integration/
│           ├── auth.test.ts             # Test luồng Register, OTP Verify, Login, Refresh, Reset
│           ├── users.test.ts            # Test Profile CRUD, Password Change, Account Cascade Deletion
│           ├── monitors.test.ts         # Test Monitor CRUD, IDOR isolation, Instant Ping cooldown
│           ├── incidents.test.ts        # Test Incident state transitions, Resolve, Reanalyze
│           ├── statusPage.test.ts       # Test Public Status Page, 2-tier cache, 404 handling
│           └── system.test.ts           # Test /api/health Docker check & Admin metrics
│
├── frontend/
│   ├── vitest.config.ts                 # Cấu hình Vitest frontend (jsdom environment)
│   └── tests/
│       ├── setup.ts                     # Giả lập matchMedia, EventSource, ResizeObserver
│       ├── unit/
│       │   ├── lib/apiError.test.ts     # Test chuẩn hóa error extraction từ Axios
│       │   ├── lib/date.test.ts         # Test formatRelativeTime, formatDuration, formatDate
│       │   ├── stores/authStore.test.ts # Test Zustand auth session & RAM token isolation
│       │   ├── stores/toastStore.test.ts# Test Zustand toast queue & auto-dismiss timer
│       │   ├── stores/realtimeStore.test.ts # Test Pub/Sub subscription & socket idempotency
│       │   └── services/api.test.ts     # Test Axios interceptor, Bearer injection, 401 refresh queue
│       ├── hooks/
│       │   ├── useMonitors.test.ts      # Test fetch monitors, cooldown ticker, realtime delta
│       │   ├── useMonitorDetail.test.ts # Test load telemetry, SVG chart points, isDeletedRef
│       │   └── useIncidents.test.ts     # Test filtering ongoing/resolved, URL query sync
│       └── components/
│           ├── auth/OtpInput.test.tsx   # Test 6-digit typing, auto-focus next, paste clipboard
│           ├── common/Badge.test.tsx    # Test rendering UP, DOWN, PAUSED, PENDING, ONGOING
│           ├── monitors/MonitorModal.test.tsx # Test create/edit form, custom headers, click outside
│           ├── monitors/DeleteMonitorModal.test.tsx # Test delete confirmation, click outside
│           └── settings/AccountSettingsModal.test.tsx # Test switch subviews, click outside, reset on close
```

---

## 4. Đặc Tả Chi Tiết Test Suites: Backend (Testing Specs)

### 4.1. Global Test Setup (`backend/tests/setup.ts`)
- **Khởi tạo:**
  ```typescript
  import { MongoMemoryServer } from 'mongodb-memory-server';
  import mongoose from 'mongoose';
  import { beforeAll, afterAll, beforeEach, vi } from 'vitest';

  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Xóa sạch dữ liệu giữa các bài test để đảm bảo tính cô lập 100%
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
    vi.clearAllMocks();
  });
  ```

---

### 4.2. Danh Mục Unit Tests Backend (`backend/tests/unit/`)

#### 1. `sslChecker.test.ts` (Kiểm tra TLS Certificate Inspector)
- **Mục tiêu:** Kiểm tra hàm `checkSslCertificate(url: string)` tại `backend/src/utils/sslChecker.ts`.
- **Test Cases:**
  1. `should return null if url protocol is http://`: URL không bảo mật không quét SSL.
  2. `should extract valid issuer and calculate daysRemaining for valid https target`: Trả về đúng `issuer`, `validTo` ISO format, và `daysRemaining > 0`.
  3. `should handle connection timeout gracefully`: Target treo hoặc chặn port 443 trả về timeout mà không làm crash tiến trình.
  4. `should handle self-signed or invalid certificate`: Bắt lỗi `DEPTH_ZERO_SELF_SIGNED_CERT` và trả về `daysRemaining <= 0` hoặc throw AppError tương ứng.

#### 2. `slug.test.ts` (Chuẩn hóa Workspace Slug)
- **Mục tiêu:** Kiểm tra tiện ích tạo và chuẩn hóa slug tại `backend/src/utils/slug.ts`.
- **Test Cases:**
  1. `should convert uppercase and whitespace into lowercase hyphenated slug`: `"Acme Production"` $\rightarrow$ `"acme-production"`.
  2. `should strip special characters and accented characters`: `"Alex Phạm @ 2026!"` $\rightarrow$ `"alex-pham-2026"`.
  3. `should enforce minimum length and handle duplicate collision fallback`.

#### 3. `metricBuffer.test.ts` (Đệm RAM Metric Buffer & Batch Ingestion)
- **Mục tiêu:** Kiểm tra `MetricBuffer` tại `backend/src/services/metricBuffer.ts`.
- **Test Cases:**
  1. `should hold metrics in RAM when size is below threshold (100 items)`: `bufferSize` tăng dần, chưa kích hoạt `bulkWrite`.
  2. `should automatically flush when buffer reaches 100 items`: Kích hoạt `pingMetricRepository.bulkCreate()`, `bufferSize` reset về 0.
  3. `should flush on periodic timer (5 seconds) even if buffer has < 100 items`.
  4. `should handle bulkWrite failure without crashing server and retain unwritten metrics`.

#### 4. `pingExecutor.test.ts` (Thực thi Request Kiểm Tra Mạng & RFC Status Mapping)
- **Mục tiêu:** Kiểm tra `executeSingleProbe` tại `backend/src/services/pingExecutor.ts`.
- **Test Cases:**
  1. `should record accurate latency and return isUp = true for HTTP 200`: Trả về latency thực tế tính bằng milliseconds.
  2. `should map network ENOTFOUND / ECONNREFUSED to HTTP 502 Bad Gateway`: Lỗi DNS hoặc từ chối kết nối ánh xạ sang 502.
  3. `should map network ETIMEDOUT to HTTP 504 Gateway Timeout`: Timeout socket ánh xạ sang 504.
  4. `should map TLS/SSL handshake failure to HTTP 526`: Chứng chỉ lỗi ánh xạ sang 526.
  5. `should perform fast retest (wait 2s and retry once) when first probe fails`: Đảm bảo chỉ khi lần 2 vẫn lỗi mới kết luận `isUp = false`.

---

### 4.3. Danh Mục Integration Tests Backend (`backend/tests/integration/`)

#### 1. `auth.test.ts` (Xác Thực, Phiên Làm Việc & Rate Limiting)
- **Mục tiêu:** Kiểm thử toàn diện API `/api/auth` qua `supertest(app)`.
- **Test Cases:**
  1. `POST /api/auth/register`:
     - Trả về `201 Created` và payload `{ success: true, data: { email } }` khi thông tin hợp lệ.
     - Trả về `400 Bad Request` nếu email trùng lặp hoặc password ngắn hơn 8 ký tự.
     - Kiểm tra mã OTP được tạo và lưu vào collection `otp_codes` với TTL.
  2. `POST /api/auth/verify-email`:
     - Trả về `200 OK` kèm `accessToken` (JWT) và thiết lập Set-Cookie `refreshToken` (HttpOnly).
     - User được cập nhật cờ `isVerified: true`.
     - Trả về `400 Bad Request` nếu mã OTP sai hoặc đã hết hạn.
  3. `POST /api/auth/login`:
     - Trả về `200 OK` kèm `accessToken` và cookie `refreshToken` khi credentials đúng.
     - Trả về `403 Forbidden` kèm thông báo bắt buộc verify nếu tài khoản chưa xác thực email.
     - Trả về `401 Unauthorized` nếu sai mật khẩu.
     - Trả về `429 Too Many Requests` khi đăng nhập sai quá 5 lần liên tiếp (Rate limit IP/Account).
  4. `POST /api/auth/refresh-token`:
     - Đọc cookie `refreshToken`, trả về `accessToken` mới và xoay vòng (rotate) cookie `refreshToken` mới.
     - Trả về `401 Unauthorized` nếu không có cookie hoặc cookie bị giả mạo.
  5. `POST /api/auth/logout`:
     - Trả về `200 OK` và xóa cookie `refreshToken` (`maxAge: 0`).
  6. `POST /api/auth/forgot-password` & `POST /api/auth/reset-password`:
     - Tạo mã OTP reset mật khẩu và gửi qua queue.
     - Reset mật khẩu thành công khi OTP đúng, mật khẩu cũ bị thay thế bằng hash bcrypt mới.

#### 2. `users.test.ts` (Quản Lý Hồ Sơ & Bảo Mật Cascade)
- **Mục tiêu:** Kiểm thử `/api/users`.
- **Test Cases:**
  1. `GET /api/users/profile`: Trả về thông tin user tương ứng với `Bearer token`.
  2. `PUT /api/users/profile`: Cập nhật `name` và `slug`, đảm bảo slug duy nhất không bị trùng.
  3. `PUT /api/users/change-password`: Đổi mật khẩu thành công khi cung cấp đúng mật khẩu hiện tại; trả về `400` nếu mật khẩu cũ sai.
  4. `DELETE /api/users/account`:
     - Xác thực mật khẩu trước khi xóa.
     - Thực hiện **Cascade Delete**: Xóa user, xóa toàn bộ monitors thuộc sở hữu của user, xóa các incidents và metrics liên quan.
     - Xóa cookie đăng nhập.

#### 3. `monitors.test.ts` (Quản Lý Monitor & Bảo Mật IDOR)
- **Mục tiêu:** Kiểm thử `/api/monitors`.
- **Test Cases:**
  1. `POST /api/monitors`: Tạo monitor mới thành công (interval: 30, 60, hoặc 300; method: GET, POST, HEAD; headers).
  2. `GET /api/monitors`: Chỉ trả về danh sách monitors thuộc quyền sở hữu của user hiện tại.
  3. **IDOR Security Test (Quan trọng nhất):**
     - User A tạo monitor `monitor_A`.
     - User B gửi request `GET /api/monitors/:id_A`, `PUT /api/monitors/:id_A`, hoặc `DELETE /api/monitors/:id_A`.
     - **Kết quả bắt buộc:** Trả về **`HTTP 404 Not Found`** (Anti-Enumeration), tuyệt đối không để lộ dữ liệu của User A.
  4. `PATCH /api/monitors/:id/toggle`: Đổi trạng thái giữa `paused` và `active`.
  5. `POST /api/monitors/:id/ping`:
     - Kích hoạt kiểm tra tức thì, trả về status code, latency, isUp.
     - Gửi request lần 2 ngay lập tức $\rightarrow$ Trả về `429 Too Many Requests` (hoặc thông báo Cooldown 15s còn hiệu lực).
  6. `GET /api/monitors/:id/metrics?range=1h|24h|7d`: Trả về mảng metrics lịch sử theo đúng khoảng thời gian quy định.

#### 4. `incidents.test.ts` (Vòng Đời Sự Cố & AI Post-Mortem)
- **Mục tiêu:** Kiểm thử `/api/incidents`.
- **Test Cases:**
  1. `GET /api/incidents`: Trả về danh sách incidents của user, hỗ trợ filter `status=ongoing|resolved`.
  2. `PATCH /api/incidents/:id/resolve`: Đánh dấu sự cố đã được khắc phục thủ công, cập nhật `resolvedAt`.
  3. `POST /api/incidents/:id/reanalyze`: Kích hoạt AI service chẩn đoán lại lỗi, cập nhật trường `aiPostMortem: { summary, rootCause, actionItems }`.
  4. **IDOR Isolation:** User B không thể xem hoặc resolve incident của User A $\rightarrow$ Trả về `404 Not Found`.

#### 5. `statusPage.test.ts` (Trang Trạng Thái Công Khai & Bộ Nhớ Đệm)
- **Mục tiêu:** Kiểm thử `/api/status/:slug`.
- **Test Cases:**
  1. `GET /api/status/:slug`: Truy cập công khai không cần token (Anonymous). Trả về danh sách monitors, 28 pings gần nhất, uptime 24h và incidents 7 ngày.
  2. `Cache Hit Verification`: Lần gọi thứ 2 trong vòng 30s trả về dữ liệu từ `memoryCache` với trường `cachedAt` không đổi (0 query database).
  3. `404 Not Found Handling`: Truy cập slug không tồn tại trả về `404 Not Found` chuẩn envelope.

#### 6. `system.test.ts` (Docker Healthcheck & Quản Trị Hệ Thống)
- **Mục tiêu:** Kiểm thử `/api/health` và `/api/admin`.
- **Test Cases:**
  1. `GET /api/health`: Endpoint công khai cho Docker daemon. Trả về `200 OK`, `{ status: "ok", database: { status: "connected" }, memory: { ... } }`.
  2. `GET /api/admin/overview`:
     - Member thường gọi $\rightarrow$ Trả về `403 Forbidden`.
     - Admin gọi $\rightarrow$ Trả về `200 OK` kèm số lượng tổng `totalUsers`, `totalMonitors`, `bufferSize`.
  3. `POST /api/admin/ping-engine/flush`: Admin gọi cưỡng chế xả buffer RAM $\rightarrow$ Trả về `flushedCount` và làm rỗng buffer.

---

## 5. Đặc Tả Chi Tiết Test Suites: Frontend (Testing Specs)

### 5.1. Global Test Setup (`frontend/tests/setup.ts`)
```typescript
import '@testing-library/jest-dom';
import { beforeAll, afterEach, vi } from 'vitest';

// Giả lập window.matchMedia cho ThemeToggle (Dark/Light)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Giả lập Native Browser EventSource cho SSE tests
class MockEventSource {
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string) {
    this.url = url;
    setTimeout(() => this.onopen?.(), 10);
  }
  close() {
    this.readyState = 2;
  }
}
// @ts-expect-error Mocking global EventSource
global.EventSource = MockEventSource;

afterEach(() => {
  vi.clearAllMocks();
});
```

---

### 5.2. Danh Mục Unit Tests Frontend (`frontend/tests/unit/`)

#### 1. `lib/apiError.test.ts`
- **Test Cases:**
  1. `should extract validation details string if details object is provided`: Bóc tách `{ details: { email: ['Invalid email format'] } }` thành `"Invalid email format"`.
  2. `should extract error property from API response envelope`: Bóc tách `{ error: "Monitor not found" }` thành `"Monitor not found"`.
  3. `should return network error message when ERR_NETWORK occurs`: Bắt mã lỗi kết nối máy chủ không phản hồi.
  4. `should fallback to generic error message for unknown objects`.

#### 2. `lib/date.test.ts`
- **Test Cases:**
  1. `formatRelativeTime`:
     - Thời gian cách < 60s $\rightarrow$ `"Just now"`.
     - Thời gian cách 5 phút $\rightarrow$ `"5 min ago"`.
     - Thời gian cách 3 giờ $\rightarrow$ `"3h ago"`.
     - `null` hoặc `undefined` $\rightarrow$ `"Never"`.
  2. `formatDuration`:
     - Độ lệch 45s $\rightarrow$ `"45s"`.
     - Độ lệch 15 phút $\rightarrow$ `"15 min"`.
     - Độ lệch 2 giờ 10 phút $\rightarrow$ `"2h 10m"`.

#### 3. `stores/authStore.test.ts`
- **Test Cases:**
  1. `should initialize with user: null and accessToken: null in RAM`.
  2. `should set authentication state correctly via setAuth(user, token)`.
  3. `should clear memory completely upon clearAuth()`.

#### 4. `stores/toastStore.test.ts`
- **Test Cases:**
  1. `should add toast item with unique ID and title when toast.success() or toast.error() is called`.
  2. `should automatically remove toast item after 3200ms timeout`.
  3. `should support manual removal via removeToast(id)`.

#### 5. `stores/realtimeStore.test.ts`
- **Test Cases:**
  1. `should manage SSE connection idempotently`: Không tạo socket mới nếu cùng URL và token.
  2. `should fan-out MONITOR_PING event to all registered pingSubscribers without updating global store state`.
  3. `should dispatch imperative system toast when INCIDENT_ALERT is received`.
  4. `should clean up subscriber when returned unsub function is invoked`.

#### 6. `services/api.test.ts` (Axios Interceptors & Silent Token Rotation)
- **Test Cases:**
  1. `should inject Authorization: Bearer <token> into headers from authStore`.
  2. `should intercept 401 error, pause concurrent requests into failedQueue, call /auth/refresh-token, and retry original request`.
  3. `should mark originalRequest._retry = true immediately to prevent infinite 401 loops`.
  4. `should reject all queued requests and clear authStore when refresh token fails`.

---

### 5.3. Danh Mục Component & Hook Tests Frontend (`frontend/tests/components/` & `tests/hooks/`)

#### 1. `components/auth/OtpInput.test.tsx`
- **Test Cases:**
  1. `should render 6 input boxes with inputMode="numeric"`.
  2. `should automatically focus the next input box when a digit is entered`.
  3. `should move focus to previous input box when Backspace is pressed on empty box`.
  4. `should populate all 6 boxes simultaneously when a 6-digit code is pasted from clipboard`.

#### 2. `components/common/Badge.test.tsx`
- **Test Cases:**
  1. `should display exact uppercase label 'UP' when status is 'up'`.
  2. `should display exact uppercase label 'DOWN' when status is 'down'`.
  3. `should display 'PAUSED', 'PENDING', 'ONGOING', 'RESOLVED' with corresponding retro theme colors`.

#### 3. `components/monitors/MonitorModal.test.tsx` & `DeleteMonitorModal.test.tsx`
- **Test Cases:**
  1. `should pre-populate form fields when monitor prop is provided (Edit mode)`.
  2. `should allow adding and removing dynamic custom header rows`.
  3. `should close modal when user clicks on the backdrop outside the dialog box`.
  4. `should NOT close modal when user clicks inside the dialog form content`.

#### 4. `components/settings/AccountSettingsModal.test.tsx`
- **Test Cases:**
  1. `should switch between 'profile', 'password', and 'delete' views seamlessly`.
  2. `should close modal upon clicking outside backdrop`.
  3. `should automatically reset activeView to 'profile' and clear password fields when modal is closed`.

#### 5. `hooks/useMonitors.test.ts`
- **Test Cases:**
  1. `should fetch and return monitor targets list on mount`.
  2. `should start 15s countdown timer when instantPing() is invoked and tick down every second`.
  3. `should update single monitor status reactively when SseMonitorPingEvent is emitted`.

#### 6. `hooks/useMonitorDetail.test.ts`
- **Test Cases:**
  1. `should compute SVG chart points coordinates accurately from metrics list`.
  2. `should set isDeletedRef.current = true upon deleteMonitor to prevent post-unmount network fetches and false 404 toasts`.

---

## 6. Định Hướng Thiết Kế CI Pipeline

Quy trình CI trên GitHub Actions sẽ đảm nhận vai trò Quality Gate độc lập cho cả Backend và Frontend:
- **Backend Quality Gate:** Kiểm tra biên dịch TypeScript (`type-check`), chạy toàn bộ test suite Unit & Integration (`npm test`) trên runner Ubuntu cách ly.
- **Frontend Quality Gate:** Kiểm tra type-checking (`type-check`), chạy toàn bộ test suite Component & Hook (`npm test`), và xác thực build đóng gói sản phẩm (`npm run build`).
- Cấu hình file workflow cụ thể sẽ được thiết kế riêng biệt theo kiến trúc CI/CD thực tế của hệ thống.

---

## 7. Scripts Khai Báo trong `package.json`

Khi triển khai mã nguồn kiểm thử, các scripts sau bắt buộc phải được khai báo trong `package.json` của từng phân hệ:

### Phía Backend (`backend/package.json`):
```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Phía Frontend (`frontend/package.json`):
```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

---

## 8. Lộ Trình Triển Khai Thực Chiến (Execution Roadmap)

Khi bước vào giai đoạn code kiểm thử ở các phiên tiếp theo, bạn chỉ cần yêu cầu AI thực hiện lần lượt theo các bước sau:

1. **Giai đoạn 1 (Backend Test Scaffolding):**
   - Cài đặt `vitest`, `supertest`, `@types/supertest`, `mongodb-memory-server` vào `backend`.
   - Tạo `vitest.config.ts` và `tests/setup.ts`.
2. **Giai đoạn 2 (Backend Core Tests Implementation):**
   - Viết các Unit tests (`sslChecker`, `metricBuffer`, `slug`, `pingExecutor`).
   - Viết các Integration tests theo luồng nghiệp vụ (`auth.test.ts`, `monitors.test.ts`, `incidents.test.ts`, `statusPage.test.ts`, `system.test.ts`).
   - Xác thực: Chạy `npm run test` trên Backend đạt **100% Passed**.
3. **Giai đoạn 3 (Frontend Test Scaffolding & Implementation):**
   - Cài đặt `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom` vào `frontend`.
   - Tạo `vitest.config.ts` và `tests/setup.ts`.
   - Viết tests cho `lib/apiError`, `lib/date`, `apiClient` refresh queue, `OtpInput`, `Badge`, và các Modals.
   - Xác thực: Chạy `npm run test` trên Frontend đạt **100% Passed**.
4. **Giai đoạn 4 (GitHub Actions CI Activation):**
   - Tạo file `.github/workflows/ci.yml`.
   - Push code lên GitHub và kiểm tra toàn bộ Quality Gates chạy xanh trên GitHub Actions tab.

