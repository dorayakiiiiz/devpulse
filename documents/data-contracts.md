# DevPulse End-to-End Data Contracts & Communication Specification

Tài liệu này được trích xuất trực tiếp 100% từ mã nguồn Backend thực tế tại [`backend/src/routes/`](backend/src/routes/), [`backend/src/controllers/`](backend/src/controllers/), [`backend/src/schemas/`](backend/src/schemas/), và [`backend/src/services/`](backend/src/services/).

Tài liệu này là **Single Source of Truth (Nguồn chân lý duy nhất)** cho toàn bộ hợp đồng API, đường dẫn endpoint, kiểu tham số (params, query, body), cấu trúc dữ liệu trả về và cơ chế xử lý lỗi.

---

## 1. NGUYÊN TẮC BẤT BIẾN (NON-NEGOTIABLE PRINCIPLES)

1. **Tuyệt đối cấm Mock Bias từ Figma:**
   - Mã nguồn trong Figma (`DevPulse-Figma`) chỉ là bản phác thảo giao diện tĩnh, chứa mock data cục bộ không khớp với backend thực tế (ví dụ: Figma mock dùng `id: number`, `sslDays: 28`, `lastChecked: "12s ago"`).
   - **Tất cả các tầng Frontend (Types, Services, Stores, Pages, Components)** BẮT BUỘC phải tuân thủ 100% các interface và tên trường được chuẩn hóa trong tài liệu này. Không được lấy bất kỳ tên biến hay kiểu dữ liệu nào từ mã Figma.

2. **Xóa bỏ triệt để Fallback & Code nước đôi (Zero Fallback Bloat):**
   - **Nghiêm cấm viết code kiểu phòng thủ nước đôi:**
     - ❌ `item.sslDays || item.sslInfo?.daysRemaining`
     - ❌ `item.url || item.monitorUrl`
     - ❌ `item.id || item._id`
     - ❌ `response.data?.message || response.data?.error`
   - Hệ thống chỉ chấp nhận đúng **1 kiểu dữ liệu duy nhất** đã được định nghĩa. Mọi dòng code phải truy xuất trực tiếp vào trường dữ liệu chuẩn.

3. **Tuân thủ đúng 100% tên Route và Method của Backend:**
   - ❌ Tuyệt đối không đoán mò URL (Ví dụ: backend là `/verify-email`, cấm gọi `/verify-email-otp`; backend là `/resend-verification`, cấm gọi `/resend-email-otp`).
   - ❌ Tuyệt đối không đoán mò query params (Ví dụ: query của metrics là `range`, cấm truyền `timeRange`).
   - ❌ Tuyệt đối không đoán mò action endpoints (Ví dụ: reanalyze là `POST /:id/reanalyze`, cấm gọi `/ai-analyze`).

4. **Chuẩn phong bì phản hồi API (API Response Envelope):**
   - **Thành công (`sendSuccess`):** HTTP 200 hoặc 201
     ```json
     {
       "success": true,
       "message": "Optional description",
       "data": { ... }
     }
     ```
   - **Thất bại (`sendError`):** HTTP 400, 401, 403, 404, 429, 500
     ```json
     {
       "success": false,
       "error": "Error message string",
       "details": { ... }
     }
     ```
     > **Quy định Frontend bắt buộc:** Đọc lỗi từ trường **`error`** (`axiosErr.response?.data?.error`), chi tiết lỗi validation từ **`details`** (`axiosErr.response?.data?.details`). KHÔNG ĐƯỢC đọc trường `message` cho error responses.

5. **Nghiêm cấm Mock Data Bias từ Figma & Fallback Bloat:**
   - Figma (`DevPulse-Figma`) chỉ là nguồn tham khảo thuần túy cho giao diện UI thị giác.
   - Toàn bộ kiểu dữ liệu, interface và tên trường BẮT BUỘC lấy chính xác từ tài liệu này. Cấm code nước đôi `a || b` hoặc `? :` để dự phòng các trường không tồn tại.

---

## 2. MODULE: AUTHENTICATION (`/api/auth`)

Định nghĩa tại: [`routes/authRoutes.ts`](backend/src/routes/authRoutes.ts), [`controllers/authController.ts`](backend/src/controllers/authController.ts), [`schemas/authSchemas.ts`](backend/src/schemas/authSchemas.ts).

### 2.1 Data Interfaces
```typescript
export type UserRole = 'member' | 'admin';

export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  slug: string;
  role: UserRole;
  isVerified: boolean;
  createdAt: string;
}

export interface AuthSessionResult {
  user: AuthUserDto;
  accessToken: string;
}
```

### 2.2 Endpoints Table
| Method | Exact Endpoint | Request Payload | Success Response (`data`) | Chi tiết |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | `{ name: string, email: string, password: string }` | `{ email: string }` | HTTP 201 Created |
| `POST` | `/api/auth/verify-email` | `{ email: string, otp: string }` | `AuthSessionResult` | HTTP 200 OK, Set cookie `refreshToken` |
| `POST` | `/api/auth/resend-verification` | `{ email: string }` | `null` | HTTP 200 OK, message: "Verification code has been resent to your email" |
| `POST` | `/api/auth/login` | `{ email: string, password: string }` | `AuthSessionResult` | HTTP 200 OK, Set cookie `refreshToken` |
| `POST` | `/api/auth/refresh-token` | None (reads HttpOnly Cookie) | `AuthSessionResult` | HTTP 200 OK, Rotates refresh token |
| `POST` | `/api/auth/logout` | None | `null` | HTTP 200 OK, Clears refresh cookie |
| `GET` | `/api/auth/me` | Header `Authorization: Bearer <token>` | `AuthUserDto` | HTTP 200 OK |
| `POST` | `/api/auth/forgot-password` | `{ email: string }` | `null` | HTTP 200 OK, message: "Verification code sent to your email" |
| `POST` | `/api/auth/reset-password` | `{ email: string, otp: string, newPassword: string }` | `null` | HTTP 200 OK, message: "Password has been reset successfully" |

---

## 3. MODULE: USER PROFILE (`/api/users`)

Định nghĩa tại: [`routes/userRoutes.ts`](backend/src/routes/userRoutes.ts), [`controllers/userController.ts`](backend/src/controllers/userController.ts), [`schemas/userSchemas.ts`](backend/src/schemas/userSchemas.ts).

Yêu cầu Header: `Authorization: Bearer <accessToken>`.

### 3.1 Endpoints Table
| Method | Exact Endpoint | Request Payload | Success Response (`data`) | Chi tiết |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/users/profile` | None | `AuthUserDto` | HTTP 200 OK |
| `PUT` | `/api/users/profile` | `{ name?: string, slug?: string }` | `AuthUserDto` | HTTP 200 OK (Method là **PUT**) |
| `PUT` | `/api/users/change-password` | `{ currentPassword: string, newPassword: string }` | `null` | HTTP 200 OK (Endpoint là **/change-password**) |
| `DELETE` | `/api/users/account` | `{ password: string }` | `null` | HTTP 200 OK, Cascade delete user & clear cookie |

---

## 4. MODULE: MONITORS (`/api/monitors`)

Định nghĩa tại: [`routes/monitorRoutes.ts`](backend/src/routes/monitorRoutes.ts), [`controllers/monitorController.ts`](backend/src/controllers/monitorController.ts), [`schemas/monitorSchemas.ts`](backend/src/schemas/monitorSchemas.ts).

Yêu cầu Header: `Authorization: Bearer <accessToken>`.

### 4.1 Data Interfaces
```typescript
export type MonitorStatus = 'up' | 'down' | 'pending' | 'paused';
export type HttpMethod = 'GET' | 'POST' | 'HEAD';

export interface SslInfoDto {
  issuer: string;
  validTo: string;
  daysRemaining: number;
  lastCheckedAt: string;
}

export interface MonitorResponseDto {
  id: string;
  userId: string;
  name: string;
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  interval: number; // 30, 60, hoặc 300 giây
  isActive: boolean;
  status: MonitorStatus;
  lastCheckedAt: string | null;
  sslInfo?: SslInfoDto;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorMetricDto {
  id: string;
  monitorId: string;
  timestamp: string;
  statusCode: number; // Mã HTTP chuẩn (200..599). Với lỗi network/gateway: 502 (DNS ENOTFOUND / ECONNREFUSED), 504 (ETIMEDOUT), 526 (SSL/TLS)
  latency: number;
  isUp: boolean;
  error: string | null;
}

export interface InstantPingResponseDto {
  monitorId: string;
  statusCode: number;
  latency: number;
  isUp: boolean;
  checkedAt: string;
  error?: string;
}
```

### 4.2 Endpoints Table
| Method | Exact Endpoint | Query / Body Params | Success Response (`data`) | Chi tiết |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/monitors` | None | `MonitorResponseDto[]` | Danh sách monitors của user |
| `POST` | `/api/monitors` | Body: `{ name: string, url: string, method?: 'GET'\|'POST'\|'HEAD', headers?: Record<string, string>, interval: 30 \| 60 \| 300 }` | `MonitorResponseDto` | HTTP 201 Created |
| `GET` | `/api/monitors/:id` | Param: `id` (24 hex characters) | `MonitorResponseDto` | Chi tiết monitor |
| `GET` | `/api/monitors/:id/metrics` | Query: `range?: '1h' \| '24h' \| '7d'`, `limit?: number` | `MonitorMetricDto[]` | **Query param là `range`**, KHÔNG PHẢI `timeRange` |
| `GET` | `/api/monitors/:id/incidents` | Param: `id` | `IncidentResponseDto[]` | Danh sách sự cố của monitor này |
| `PUT` | `/api/monitors/:id` | Body: `{ name?: string, url?: string, method?: 'GET'\|'POST'\|'HEAD', headers?: Record<string, string>, interval?: 30 \| 60 \| 300 }` | `MonitorResponseDto` | Cập nhật cấu hình |
| `PATCH` | `/api/monitors/:id/toggle` | Param: `id` | `MonitorResponseDto` | Bật / tắt monitor |
| `POST` | `/api/monitors/:id/ping` | Param: `id` | `InstantPingResponseDto` | Kích hoạt kiểm tra tức thì |
| `DELETE` | `/api/monitors/:id` | Param: `id` | `null` | Xóa monitor |

---

## 5. MODULE: INCIDENTS (`/api/incidents`)

Định nghĩa tại: [`routes/incidentRoutes.ts`](backend/src/routes/incidentRoutes.ts), [`controllers/incidentController.ts`](backend/src/controllers/incidentController.ts), [`schemas/incidentSchemas.ts`](backend/src/schemas/incidentSchemas.ts).

Yêu cầu Header: `Authorization: Bearer <accessToken>`.

### 5.1 Data Interfaces
```typescript
export type IncidentStatus = 'ongoing' | 'resolved';

export interface IncidentErrorDetails {
  statusCode: number;
  errorMessage: string;
  responseBody: string;
  responseHeaders: Record<string, string>;
}

export interface AiPostMortemDto {
  summary: string;
  rootCause: string;
  actionItems: string[];
  generatedAt: string;
}

export interface IncidentResponseDto {
  id: string;
  monitorId: string;
  monitorName: string;
  monitorUrl: string;
  status: IncidentStatus;
  startedAt: string;
  resolvedAt: string | null;
  errorDetails: IncidentErrorDetails;
  aiPostMortem?: AiPostMortemDto;
  createdAt: string;
  updatedAt: string;
}
```

### 5.2 Endpoints Table
| Method | Exact Endpoint | Query / Body Params | Success Response (`data`) | Chi tiết |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/incidents` | Query: `status?: 'ongoing' \| 'resolved'`, `monitorId?: string`, `limit?: number`, `skip?: number` | `IncidentResponseDto[]` | Danh sách sự cố của user |
| `GET` | `/api/incidents/:id` | Param: `id` (24 hex characters) | `IncidentResponseDto` | Chi tiết sự cố |
| `PATCH` | `/api/incidents/:id/resolve` | Param: `id` | `IncidentResponseDto` | Đánh dấu sự cố đã khắc phục thủ công |
| `POST` | `/api/incidents/:id/reanalyze` | Param: `id` | `IncidentResponseDto` | **Endpoint là `/:id/reanalyze`**, KHÔNG PHẢI `ai-analyze` |

---

## 6. MODULE: PUBLIC STATUS PAGE (`/api/status`)

Định nghĩa tại: [`routes/statusPageRoutes.ts`](backend/src/routes/statusPageRoutes.ts), [`controllers/statusPageController.ts`](backend/src/controllers/statusPageController.ts), [`services/statusPageService.ts`](backend/src/services/statusPageService.ts).

Không yêu cầu xác thực (Anonymous Public Access).

### 6.1 Data Interfaces
```typescript
export interface PublicMonitorStatus {
  name: string;
  url: string;
  status: MonitorStatus;
  uptimePercentage24h: number;
  lastCheckedAt: string | null;
  recentPings: Array<{
    isUp: boolean;
    latency: number;
    timestamp: string;
  }>;
}

export interface PublicIncidentItem {
  id: string;
  monitorName: string;
  status: 'ongoing' | 'resolved';
  startedAt: string;
  resolvedAt: string | null;
  errorMessage: string;
  aiSummary?: string;
}

export interface PublicStatusPageResponse {
  systemStatus: 'all_operational' | 'partial_outage' | 'major_outage';
  systemName: string;
  monitors: PublicMonitorStatus[];
  recentIncidents: PublicIncidentItem[];
  cachedAt: string;
}
```

### 6.2 Endpoint Table
| Method | Exact Endpoint | Params | Success Response (`data`) | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/status/:slug` | Param: `slug` | `PublicStatusPageResponse` | Cache 2-Tier in-memory 30s |

---

## 7. MODULE: SYSTEM HEALTH & ADMIN (`/api/health`, `/api/admin`)

Định nghĩa tại: [`routes/healthRoutes.ts`](backend/src/routes/healthRoutes.ts), [`routes/adminRoutes.ts`](backend/src/routes/adminRoutes.ts).

### 7.1 Data Interfaces
```typescript
export interface SystemHealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  database: {
    status: 'connected' | 'disconnected';
    pingMs: number;
  };
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
}

export interface PingEngineStatus {
  activeMonitorsCount: number;
  bufferSize: number;
  lastFlushAt: string | null;
  concurrencyLimit: number;
  isRunning: boolean;
}

export interface AdminOverviewResponse {
  counts: {
    totalUsers: number;
    totalMonitors: number;
    activeMonitors: number;
    ongoingIncidents: number;
  };
  pingEngine: {
    bufferSize: number;
    lastFlushAt: string | null;
    concurrencyLimit: number;
  };
  systemMemory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
  serverUptimeSeconds: number;
}
```

### 7.2 Endpoints Table
| Method | Exact Endpoint | Auth (Role) | Response Format | Chi tiết |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Trả về trực tiếp `SystemHealthResponse` | KHÔNG bọc qua `sendSuccess` |
| `GET` | `/api/admin/overview` | Admin only | `{ success: true, data: AdminOverviewResponse }` | Thống kê macro admin |
| `GET` | `/api/admin/ping-engine/status` | Admin only | `{ success: true, data: PingEngineStatus }` | Chẩn đoán scheduler & buffer |
| `POST` | `/api/admin/ping-engine/flush` | Admin only | `{ success: true, data: { flushedCount: number } }` | **Endpoint là `/ping-engine/flush`** |

---

## 8. MODULE: REALTIME SSE (`/api/sse`)

Định nghĩa tại: [`routes/sseRoutes.ts`](backend/src/routes/sseRoutes.ts), [`routes/index.ts`](backend/src/routes/index.ts).

### 8.1 Data Interfaces
```typescript
export interface SseConnectedEvent {
  type: 'CONNECTED';
  userId: string;
  connectedAt: string;
}

export interface SseMonitorPingEvent {
  type: 'MONITOR_PING';
  monitorId: string;
  statusCode: number;
  latency: number;
  isUp: boolean;
  timestamp: string;
  error?: string;
}

export interface SseIncidentAlertEvent {
  type: 'INCIDENT_ALERT';
  incidentId: string;
  monitorId: string;
  status: 'ongoing' | 'resolved';
  startedAt: string;
  resolvedAt?: string;
  errorMessage?: string;
  aiPostMortem?: AiPostMortemDto;
}
```

### 8.2 Endpoint Table
| Method | Exact Endpoint | Auth | Response Stream |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sse/monitors` | Query: `?token=<accessToken>` hoặc Header Bearer | `text/event-stream` (Heartbeat 30s) |
