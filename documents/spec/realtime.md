# Feature Spec: Real-Time Status Streaming via Server-Sent Events

- Module: Realtime
- Người phụ trách: Fullstack Developer
- Ngày soạn: 2026-10-29
- Trạng thái: Implemented

---

## 1. Business Objectives

Cung cấp kênh truyền phát dữ liệu một chiều từ máy chủ đến trình duyệt theo thời gian thực bằng công nghệ Server-Sent Events. Giúp Dashboard của người dùng tự động cập nhật biến động độ trễ mạng và thay đổi trạng thái hoạt động của các mục tiêu ngay sau mỗi lượt kiểm tra mà không cần gửi yêu cầu thăm dò liên tục hoặc tải lại trang web.

---

## 2. Scope

**Trong scope:**
- Khởi tạo và duy trì kết nối truyền phát Server-Sent Events qua điểm kết nối `GET /api/sse/monitors`.
- Xác thực quyền truy cập của người dùng qua Access Token (truyền qua query param `?token=` cho EventSource hoặc Bearer header) trước khi chấp nhận kết nối.
- Quản lý danh sách các kết nối đang hoạt động trong bộ nhớ RAM, phân nhóm theo `userId`.
- Tiếp nhận sự kiện nội bộ từ mô-đun Ping Engine và mô-đun Incidents.
- Lọc và truyền phát số liệu kiểm tra mới nhất đến đúng các kết nối thuộc quyền sở hữu của người dùng.
- Gửi tín hiệu giữ kết nối định kỳ mỗi 30 giây để ngăn chặn tình trạng ngắt kết nối do quá thời gian chờ từ trình duyệt hoặc máy chủ chuyển tiếp Nginx.
- Xử lý giải phóng tài nguyên bộ nhớ khi người dùng đóng trình duyệt hoặc mất kết nối mạng.

**Ngoài scope:**
- Giao tiếp hai chiều bằng giao thức WebSocket.
- Quản lý phiên kết nối phân tán trên nhiều máy chủ thông qua kênh thông điệp Redis Pub/Sub.
- Truyền phát dữ liệu số liệu cho người dùng vãng lai chưa xác thực.

---

## 3. Permissions

| Role | Quyền |
| :--- | :--- |
| Anonymous User | Không có quyền mở kết nối truyền phát thời gian thực nội bộ. |
| Member | Mở kết nối và chỉ tiếp nhận dữ liệu thời gian thực của các mục tiêu thuộc quyền sở hữu của chính mình. |
| Admin | Mở kết nối và có thể tiếp nhận thêm các sự kiện cảnh báo tài nguyên của toàn hệ thống. |

---

## 4. Core Business Flows

### 4.1. SSE Connection Establishment Flow
1. Trình duyệt khởi tạo đối tượng EventSource kết nối đến đường dẫn `/api/sse/monitors?token=<accessToken>` (hoặc gửi header `Authorization: Bearer <accessToken>`).
2. Middleware kiểm tra tính hợp lệ của Access Token. Nếu không hợp lệ hoặc thiếu token, trả về HTTP 401.
3. Máy chủ thiết lập các tiêu đề phản hồi:
   - `Content-Type: text/event-stream`
   - `Cache-Control: no-cache`
   - `Connection: keep-alive`
   - `X-Accel-Buffering: no`
4. Máy chủ đăng ký đối tượng phản hồi vào danh sách kết nối đang hoạt động tương ứng với `userId`.
5. Máy chủ gửi thông điệp mở đầu báo hiệu kết nối thành công.

### 4.2. Metric Event Broadcasting Flow
1. Mô-đun Ping Engine hoàn tất lượt kiểm tra và phát sự kiện nội bộ `PING_COMPLETED`.
2. Dịch vụ truyền phát nhận sự kiện và trích xuất `userId` của mục tiêu kiểm tra.
3. Dịch vụ tra cứu danh sách các kết nối của `userId` đó trong bộ nhớ RAM.
4. Định dạng dữ liệu thành khối văn bản chuẩn Server-Sent Events và ghi trực tiếp vào luồng dữ liệu của các kết nối tìm thấy.
5. Giao diện người dùng nhận sự kiện, giải mã nội dung JSON và cập nhật biểu đồ độ trễ.

### 4.3. Heartbeat and Connection Termination Flow
1. Bộ định thời gian nội bộ chạy mỗi 30 giây gửi một dòng chú thích giữ kết nối đến toàn bộ các máy khách đang mở.
2. Khi người dùng đóng tab hoặc đường truyền mạng gián đoạn, sự kiện `close` của yêu cầu được kích hoạt trên máy chủ.
3. Máy chủ xóa đối tượng phản hồi khỏi danh sách kết nối tương ứng với `userId` để ngăn ngừa rò rỉ bộ nhớ.

---

## 5. API Contract

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/sse/monitors` | Member | Khởi tạo kết nối truyền phát dữ liệu thời gian thực |

**Stream Event Formats:**

Mỗi gói tin truyền tải tuân thủ nghiêm ngặt định dạng văn bản Server-Sent Events chuẩn:

```text
event: [tên sự kiện]
data: [chuỗi json dữ liệu]

```

**Payload Types:**

```typescript
// Initial Connection Success Event
export interface SseConnectedEvent {
  type: 'CONNECTED';
  userId: string;
  connectedAt: string;
}

// Live Metric Update Event with event name MONITOR_PING
export interface SseMonitorPingEvent {
  type: 'MONITOR_PING';
  monitorId: string;
  statusCode: number;
  latency: number;
  isUp: boolean;
  timestamp: string;
  error?: string;
}

// Live Incident Alert Event with event name INCIDENT_ALERT
export interface SseIncidentAlertEvent {
  type: 'INCIDENT_ALERT';
  monitorId: string;
  status: 'ongoing' | 'resolved';
  startedAt: string;
  resolvedAt?: string;
  summary?: string;
}
```

**Status Codes:**

| Code | Khi nào trả về |
| :--- | :--- |
| 200 | Thiết lập kết nối luồng một chiều thành công và duy trì mở liên tục |
| 401 | Thiếu phiên đăng nhập hoặc Access Token không hợp lệ |

---

## 6. Data

**Lưu trữ trạng thái kết nối:**
- Dữ liệu kết nối không lưu trữ vào cơ sở dữ liệu MongoDB mà được quản lý thuần túy trên bộ nhớ RAM bằng cấu trúc: `Map<string, Set<Response>>` trong đó khóa là `userId` và giá trị là tập hợp các luồng phản hồi HTTP đang mở.

**Invariants:**
- Một tài khoản người dùng có thể mở đồng thời nhiều kết nối từ các thẻ trình duyệt khác nhau.
- Mọi kết nối bị đóng bắt buộc phải được loại bỏ hoàn toàn khỏi cấu trúc dữ liệu trên bộ nhớ để tránh tích lũy đối tượng gây cạn kiệt RAM.
- Dữ liệu sự kiện của người dùng A tuyệt đối không bao giờ bị phát nhầm sang kết nối của người dùng B.

---

## 7. Errors and Edge Cases

| Tình huống | Hiện tượng | Xử lý của hệ thống |
| :--- | :--- | :--- |
| Client tắt trình duyệt đột ngột | Luồng socket mạng bị ngắt | Bắt sự kiện `close` và xóa kết nối khỏi danh sách trên RAM |
| Nginx tự động đóng kết nối quá hạn | Kết nối bị ngắt sau 60s | Thiết lập cấu hình Nginx `proxy_read_timeout 24h` và gửi heartbeat mỗi 30s |
| Mạng người dùng chập chờn | Trình duyệt mất kết nối tạm thời | EventSource phía client tự động gửi lại yêu cầu kết nối sau vài giây |
| Máy chủ khởi động lại | Toàn bộ kết nối bị đứt | Client tự động thiết lập lại kết nối khi máy chủ hoạt động trở lại |

---

## 8. User Interface

**Chỉ báo trạng thái kết nối trên Dashboard:**
- Trạng thái kết nối thành công: Hiển thị chấm tròn xanh kèm nhãn thông báo hệ thống đang truyền dữ liệu trực tiếp.
- Trạng thái đang kết nối lại: Hiển thị chấm tròn vàng khi phát hiện mất kết nối tạm thời.
- Trạng thái mất kết nối: Hiển thị chấm tròn đỏ khi máy chủ không phản hồi.

**Hành vi cập nhật:**
- Điểm dữ liệu độ trễ mới được thêm trực tiếp vào đuôi biểu đồ dạng sóng mà không làm tải lại toàn bộ đồ thị.
- Huy hiệu trạng thái của mục tiêu tự động đổi màu xanh khi hoạt động bình thường hoặc màu đỏ khi gặp sự cố.

---

## 9. Constraints

- Tiêu đề phản hồi bắt buộc phải có `Content-Type: text/event-stream` và `Cache-Control: no-cache`.
- Phải thiết lập tiêu đề `X-Accel-Buffering: no` để máy chủ chuyển tiếp Nginx không đệm dữ liệu trước khi gửi tới trình duyệt.
- Tần suất gửi tín hiệu giữ kết nối định kỳ được cố định ở mức 30 giây một lần.
- Không sử dụng thư viện bên ngoài phức tạp, triển khai dựa trên đối tượng Response tiêu chuẩn của Express.

---

## 10. Acceptance Criteria

- **AC1:** Khi người dùng đã đăng nhập gọi `GET /api/sse/monitors`, máy chủ giữ kết nối mở với mã HTTP 200 và tiêu đề `text/event-stream`.
- **AC2:** Khi gọi endpoint mà không có token xác thực hợp lệ, máy chủ từ chối kết nối ngay lập tức với mã HTTP 401.
- **AC3:** Khi một mục tiêu hoàn thành lượt kiểm tra, dữ liệu được truyền phát tới đúng các cửa sổ trình duyệt của người dùng sở hữu mục tiêu đó trong vòng dưới 100 mili giây.
- **AC4:** Khi đóng thẻ trình duyệt, máy chủ phát hiện sự kiện đóng kết nối và giải phóng đối tượng phản hồi khỏi bộ nhớ RAM.
- **AC5:** Tín hiệu giữ kết nối được truyền đi đều đặn mỗi 30 giây để duy trì đường truyền không bị ngắt.

---

## 11. Test Cases

| Scenario | Input | Expected Output |
| :--- | :--- | :--- |
| Kết nối SSE thành công | Request có Access Token hợp lệ | HTTP 200 + headers text/event-stream + kết nối duy trì mở |
| Kết nối thiếu xác thực | Request không chứa token xác thực | HTTP 401 Unauthorized |
| Truyền phát kết quả kiểm tra | Bắn sự kiện nội bộ PING_COMPLETED cho user A | Client của user A nhận event MONITOR_PING đúng định dạng |
| Cách ly dữ liệu người dùng | Bắn sự kiện PING_COMPLETED cho user A | Client của user B không nhận được sự kiện đó |
| Gửi tín hiệu giữ kết nối | Duy trì kết nối không có dữ liệu mới trong 30s | Nhận dòng chú thích heartbeat định kỳ |
| Dọn dẹp kết nối khi ngắt | Client chủ động đóng kết nối mạng | Kết nối được xóa khỏi Map trên RAM, không rò rỉ bộ nhớ |
