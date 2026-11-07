# Feature Spec: Frontend Monitors Management and Detail Telemetry

- Module: Frontend Monitors
- Người phụ trách: Fullstack Developer
- Ngày soạn: 2026-11-07
- Trạng thái: Approved

---

## 1. Mục tiêu nghiệp vụ

Xây dựng toàn diện giao diện và luồng xử lý người dùng cho phân hệ Quản lý Điểm Giám Sát (Monitors Management) và Chi Tiết Giám Sát Thời Gian Thực (Monitor Detail Telemetry) trên nền tảng DevPulse. Tái hiện chuẩn xác 100% ngôn ngữ thiết kế Retro Neo-Brutalism từ bản thiết kế Figma (`DevPulse-Figma`), kết nối trực tiếp với hệ thống Backend RESTful API và tuân thủ tuyệt đối Hợp đồng dữ liệu chuẩn tại `documents/data-contracts.md`.

---

## 2. Phạm vi

**Trong scope:**
- **Trang danh sách Monitors (`/monitors`):**
  - Hiển thị bảng danh sách monitor kèm trạng thái (`up`, `down`, `pending`, `paused`).
  - Thông tin URL, phương thức HTTP, chu kỳ kiểm tra (30s, 60s, 300s), thời gian kiểm tra gần nhất (relative time).
  - Tình trạng chứng chỉ SSL: hiển thị số ngày còn lại kèm mã màu cảnh báo hoặc nhãn "No SSL" / "Scan pending".
  - Thao tác nhanh tại từng dòng: Kích hoạt kiểm tra tức thì (Instant Ping có cooldown 15s), Bật/Tắt tạm dừng (Toggle Pause/Resume), Chỉnh sửa (Edit Modal), Xóa (Delete Confirmation Modal).
  - Thanh tổng kết trạng thái (Operational, Degraded, Paused, Pending) và phân trang chuẩn Retro (8 monitors/page).
- **Hộp thoại Modal Thiết lập Monitor (`MonitorModal`):**
  - Hỗ trợ tạo mới và chỉnh sửa monitor.
  - Nhập tên, URL (tự động validate URL format), chọn phương thức (GET, POST, HEAD), chọn chu kỳ kiểm tra (30s, 60s, 300s).
  - Quản lý danh sách Custom Request Headers động: thêm hàng, sửa key/value, xóa hàng.
- **Hộp thoại Modal Xác nhận Xóa (`DeleteMonitorModal`):**
  - Cảnh báo người dùng trước khi xóa vĩnh viễn, xác nhận gọi API xóa và dọn dẹp khỏi giao diện.
- **Trang Chi tiết Monitor (`/monitors/:id`):**
  - Nút quay lại danh sách (`Back to monitors`).
  - Header thông tin điểm giám sát: Tên, Badge trạng thái, Phương thức, URL, cụm nút tác vụ (Check now, Pause/Resume, Edit, Delete).
  - 3 thẻ thống kê Retro Stat: Thời gian kiểm tra gần nhất, Độ trễ gần nhất (Latency ms), Tỷ lệ sẵn sàng 24h (Uptime 24h).
  - Biểu đồ lịch sử độ trễ (Live Latency Chart) hỗ trợ chuyển đổi dải thời gian: `1h`, `24h`, `7d`.
  - Khung thông tin chứng chỉ SSL chi tiết: Nhà cấp phép (Issuer), Hạn định (Valid to), Thanh tiến trình trực quan số ngày còn lại (Time remaining).
  - Bảng danh sách kết quả kiểm tra gần nhất (Recent Pings Table): Timestamp, Trạng thái, Mã HTTP, Độ trễ, Thông điệp lỗi.
  - Danh sách sự cố lịch sử (Incident History) gắn liền với monitor này.

**Ngoài scope (không làm ở sprint này):**
- Cấu hình body JSON cho các HTTP request phức tạp (Backend hiện hỗ trợ header-based requests).
- Tích hợp biểu đồ Canvas WebGL nặng nề (sử dụng SVG Vector chuẩn mực theo thiết kế Figma để tối ưu hiệu năng).

---

## 3. Phân quyền

| Role | Quyền |
| :--- | :--- |
| **Anonymous (Khách)** | Bị chặn bởi `ProtectedRoute`, tự động chuyển hướng về trang `/auth`. |
| **Member** | Toàn quyền xem, tạo, cập nhật, bật/tắt, xóa và kiểm tra tức thì các monitors do chính tài khoản của mình sở hữu. |
| **Admin** | Có toàn bộ quyền hạn của Member đối với monitors cá nhân. |

---

## 4. Luồng nghiệp vụ chính (Happy Path)

### 4.1. Tạo mới Monitor (Create Monitor)
1. Người dùng bấm nút "+ Add monitor" hoặc "New monitor" trên Header.
2. Hộp thoại `MonitorModal` mở ra với tiêu đề "Create a monitor".
3. Nhập Tên, URL, Method, Interval và các headers tùy chọn (nếu có).
4. Bấm "Start monitoring" $\rightarrow$ Gửi `POST /api/monitors` với payload chuẩn `CreateMonitorPayload`.
5. Backend trả về `HTTP 201 Created` kèm `MonitorResponseDto`.
6. Frontend đóng modal, thêm monitor vào danh sách, hiển thị thông báo Toast thành công.

### 4.2. Bật/Tắt Trạng thái Hoạt động (Toggle Monitor Active)
1. Tại dòng monitor hoặc trang chi tiết, người dùng bấm nút Pause/Resume.
2. Gửi `PATCH /api/monitors/:id/toggle`.
3. Backend cập nhật `isActive`, chuyển đổi trạng thái giữa `paused` và `pending` và trả về `MonitorResponseDto`.
4. Frontend cập nhật dòng tương ứng và hiển thị Toast thông báo trạng thái mới.

### 4.3. Kích hoạt Kiểm tra Tức thì (Instant Ping)
1. Người dùng bấm nút "Ping now" hoặc "Check now".
2. Bắt đầu bộ đếm đếm ngược Cooldown 15 giây chống spam.
3. Gửi `POST /api/monitors/:id/ping`.
4. Backend thực hiện ping trực tiếp và trả về `InstantPingResponseDto` (chứa `statusCode`, `latency`, `isUp`).
5. Frontend hiển thị Toast thông báo kết quả độ trễ và cập nhật chỉ số hiển thị.

### 4.4. Xem Chi tiết Monitor & Dải Thời gian Độ trễ (View Detail & Metric Ranges)
1. Bấm vào tên monitor trên bảng danh sách $\rightarrow$ Chuyển hướng đến `/monitors/:id`.
2. Component thực hiện song song:
   - `monitorService.getMonitorById(id)` lấy cấu hình và SSL info.
   - `monitorService.getMetrics(id, { range: '1h' })` lấy danh sách điểm dữ liệu và bảng Recent pings.
   - `monitorService.getMonitorIncidents(id)` lấy lịch sử sự cố.
3. Khi người dùng bấm chuyển đổi tab dải thời gian `1h` $\rightarrow$ `24h` $\rightarrow$ `7d`:
   - Gửi request `monitorService.getMetrics(id, { range })`.
   - Cập nhật biểu đồ SVG và danh sách pings tương ứng.

---

## 5. API Contract & Data Types

Tuân thủ 100% theo [`documents/data-contracts.md`](../data-contracts.md).

### 5.1. Endpoints Sử dụng

| Method | Endpoint | Request Payload | Response Data | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/monitors` | None | `MonitorResponseDto[]` | Lấy danh sách monitors của user |
| `POST` | `/api/monitors` | `CreateMonitorPayload` | `MonitorResponseDto` | Tạo mới monitor |
| `GET` | `/api/monitors/:id` | None | `MonitorResponseDto` | Lấy chi tiết monitor theo ID |
| `PUT` | `/api/monitors/:id` | `UpdateMonitorPayload` | `MonitorResponseDto` | Cập nhật cấu hình monitor |
| `PATCH` | `/api/monitors/:id/toggle` | None | `MonitorResponseDto` | Bật / tắt monitor |
| `POST` | `/api/monitors/:id/ping` | None | `InstantPingResponseDto` | Kích hoạt instant ping |
| `DELETE` | `/api/monitors/:id` | None | `null` | Xóa monitor |
| `GET` | `/api/monitors/:id/metrics` | Query: `range`, `limit` | `MonitorMetricDto[]` | Lấy lịch sử metrics |
| `GET` | `/api/monitors/:id/incidents`| None | `IncidentResponseDto[]` | Lấy danh sách sự cố |

### 5.2. Data Models (Strict TypeScript)

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
  interval: number;
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
  statusCode: number;
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

---

## 6. Dữ liệu & Bất biến (Data & Invariants)

1. **Single Source of Truth:**
   - Dữ liệu monitor hiển thị trực tiếp từ `MonitorResponseDto`, không sinh thêm các trường ảo hoặc fallback lỏng lẻo (`item.sslDays || item.sslInfo?.daysRemaining` bị cấm hoàn toàn).
2. **SSL State Invariant:**
   - Nếu `url` bắt đầu bằng `http://` $\rightarrow$ Hiển thị nhãn "No SSL".
   - Nếu `url` bắt đầu bằng `https://` và chưa có dữ liệu `sslInfo` $\rightarrow$ Hiển thị nhãn "Scan pending".
   - Nếu có `sslInfo` $\rightarrow$ Hiển thị chuẩn xác `${sslInfo.daysRemaining} days` và hạn dùng `${sslInfo.validTo}`.
3. **Interval Constraints:**
   - Chỉ chấp nhận 3 giá trị chu kỳ kiểm tra hợp lệ: `30` (Every 30 sec), `60` (Every 60 sec), `300` (Every 5 min).

---

## 7. Xử lý Lỗi & Trường hợp Biên (Errors & Edge Cases)

| Trường hợp | Phản hồi giao diện | Hành vi hệ thống |
| :--- | :--- | :--- |
| **Không tìm thấy Monitor (404)** | Toast lỗi "Monitor not found", tự động quay về `/monitors`. | Điều hướng người dùng về màn hình danh sách. |
| **Lỗi Validation URL không hợp lệ** | Báo lỗi validation dưới ô input hoặc Toast. | Ngăn form submit, thông báo định dạng URL bắt buộc bắt đầu bằng `http://` hoặc `https://`. |
| **Monitor bị xóa khi đang xem chi tiết** | Hiển thị thông báo Toast, điều hướng về `/monitors`. | Cleanup state, tránh memory leak. |
| **Instant Ping gặp lỗi kết nối** | Toast cảnh báo lỗi (màu vàng/đỏ) kèm thời gian phản hồi hoặc error string. | Reset trạng thái loading, giữ cooldown 15s. |
| **Danh sách rỗng (Empty State)** | Hiển thị bảng trống sạch sẽ hoặc hướng dẫn bấm nút "+ Add monitor". | Không gây vỡ layout hay lỗi phân trang (page count tối thiểu = 1). |

---

## 8. Tiêu chuẩn Phi chức năng & Giao diện (UI/UX Standards)

1. **Đồng nhất 100% Giao diện Figma (`DevPulse-Figma`):**
   - Theme Retro Neo-Brutalism: Đường viền đậm `border-2 border-zinc-950 dark:border-[#737c91]`, đổ bóng cứng `shadow-[4px_4px_0_#18181b] dark:shadow-[4px_4px_0_#090b10]`.
   - Bảng màu: Nền `bg-cream dark:bg-retro-night`, nút nhấn `bg-coral`, `bg-yellow-300`, `bg-mint`, thẻ `bg-retro-blue`, `bg-retro-lilac`.
   - Thanh Retro Window Bar (`RetroWindowBar`) với 3 chấm tròn cổ điển.
2. **Không có Emoji:**
   - 100% sử dụng vector icon chuẩn từ thư viện `lucide-react` (`Plus`, `Activity`, `Shield`, `Play`, `Pause`, `Clock`, `Trash2`, `Edit3`, `ArrowLeft`, `ChevronLeft`, `ChevronRight`).
3. **100% Tiếng Anh:**
   - Toàn bộ nhãn, thông báo, tiêu đề, mã nguồn và comment đều bằng tiếng Anh.

---

## 9. Phân rã Component (Component Breakdown)

```
src/
├── components/
│   ├── common/
│   │   ├── Stat.tsx                  (Thẻ thống kê thông số retro)
│   ├── monitors/
│   │   ├── MonitorModal.tsx          (Modal tạo / chỉnh sửa monitor)
│   │   ├── DeleteMonitorModal.tsx    (Modal xác nhận xóa monitor)
│   │   └── LatencyChart.tsx          (Biểu đồ SVG Live Latency)
├── pages/
│   └── monitors/
│       ├── MonitorsPage.tsx          (Trang danh sách monitors & actions)
│       └── MonitorDetailPage.tsx     (Trang chi tiết monitor & telemetry)
```

---

## 10. Open Questions
*Không có. Hợp đồng API và thiết kế UI đã hoàn toàn rõ ràng.*

---

## 11. Checklist Kiểm thử & Nghiệm thu (Verification Checklist)

- [ ] Tạo mới monitor với URL HTTPS và Header tùy chọn thành công.
- [ ] Bật / Tắt tạm dừng (Toggle Pause/Resume) cập nhật badge ngay lập tức.
- [ ] Kích hoạt Instant Ping hiển thị cooldown 15s và Toast thông báo độ trễ.
- [ ] Cập nhật thông số monitor thành công.
- [ ] Xóa monitor hiển thị modal xác nhận và xóa khỏi danh sách.
- [ ] Xem chi tiết monitor hiển thị đúng 3 thẻ Stat, biểu đồ Latency, SSL Certificate và Lịch sử Sự cố.
- [ ] Chuyển đổi dải thời gian biểu đồ (1h / 24h / 7d) gọi đúng API với query param `range`.
- [ ] Chạy `npm.cmd run type-check` và `npm.cmd run build` đạt **0 errors**.

