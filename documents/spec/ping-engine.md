# Feature Spec: Ping Engine, Concurrency Control, and Metric Batching

- Module: Ping Engine
- Người phụ trách: Fullstack Developer
- Ngày soạn: 2026-10-29
- Trạng thái: Draft

---

## 1. Business Objectives

Tự động hóa việc kiểm tra tính sẵn sàng của các mục tiêu theo dõi theo chu kỳ cấu hình sẵn. Kiểm soát tải mạng và tài nguyên máy chủ thông qua cơ chế giới hạn concurrency, đo lường latency chính xác và áp dụng in-memory buffer gom nhóm kết quả kiểm tra trước khi ghi vào MongoDB Time-Series nhằm cắt giảm hơn 90% áp lực disk I/O.

---

## 2. Scope

**Trong scope:**
- Tự động nạp danh sách các mục tiêu đang kích hoạt từ database vào bộ lập lịch `node-cron`.
- Phân nhóm chu kỳ kiểm tra theo 3 mốc: 30 giây, 60 giây và 300 giây.
- Giới hạn concurrency tối đa 5 requests chạy đồng thời qua `p-limit` kèm pacing delay 100ms.
- Thực thi HTTP hoặc HTTPS request, đo lường response time từ khi gửi request đến khi nhận byte đầu tiên từ target server.
- Phân loại trạng thái: 2xx là up, 3xx là redirect, 4xx hoặc 5xx hoặc timeout là down.
- Thu thập kết quả vào RAM buffer tạm thời.
- Tự động xả RAM buffer bằng một lệnh `bulkWrite` duy nhất xuống collection `ping_metrics` khi đạt đủ 100 items hoặc sau mỗi chu kỳ 5 giây.
- Cập nhật trường `status` và `lastCheckedAt` trên collection `monitors`.
- Bắn sự kiện nội bộ qua EventEmitter để module Realtime và module Incidents tiêu thụ.
- Tự động thử lại 1 lần sau 2 giây khi lượt kiểm tra đầu tiên gặp lỗi để xác nhận sự cố trước khi công bố trạng thái down.
- Xử lý graceful shutdown để xả hết RAM buffer trước khi tiến trình kết thúc.

**Ngoài scope:**
- Kiểm tra kết nối qua cổng raw TCP socket hoặc lệnh ICMP ping.
- Tự động thử lại nhiều hơn 1 lần hoặc áp dụng thuật toán lùi thời gian cấp số nhân phức tạp.
- Cấu hình số lượng concurrency động theo tài nguyên phần cứng.

---

## 3. Permissions

| Role | Quyền |
| :--- | :--- |
| System Scheduler | Tác vụ nội bộ tự động thực thi chu kỳ kiểm tra và ghi dữ liệu hàng loạt. |
| Member | Không có quyền tương tác trực tiếp với engine, chỉ kích hoạt gián tiếp qua việc tạo monitor. |
| Admin | Quyền gọi endpoint kích hoạt cưỡng chế xả tức thì RAM buffer hoặc xem trạng thái engine. |

---

## 4. Core Business Flows

### 4.1. Scheduled Ping Execution Flow
1. Bộ lập lịch `node-cron` kích hoạt mỗi chu kỳ dựa trên cấu hình interval. Nếu chu kỳ trước của interval đó vẫn đang xử lý, hệ thống bỏ qua chu kỳ hiện tại để tránh tích tụ tác vụ khi các mục tiêu phản hồi chậm.
2. Hệ thống truy vấn danh sách các monitors có `isActive: true` tương ứng với interval đó.
3. Danh sách mục tiêu được đưa vào execution pool được kiểm soát bởi `p-limit` với giới hạn tối đa 5 requests đồng thời.
4. Mỗi task ping thực thi:
   - Ghi nhận mốc thời gian bắt đầu.
   - Gửi HTTP request đến target URL với timeout tối đa 10 giây.
   - Ghi nhận mốc thời gian nhận phản hồi để tính latency.
   - Nếu request đầu tiên thất bại do lỗi mạng, timeout hoặc nhận mã lỗi 4xx hoặc 5xx: hệ thống tạm hoãn 2 giây và tự động thử lại thêm 1 lần duy nhất.
   - Xác định `isUp: true` nếu status code thuộc dải 2xx hoặc 3xx sau lượt kiểm tra hoặc sau lượt thử lại, ngược lại xác định `isUp: false` khi cả hai lần đều thất bại.
5. Đẩy đối tượng metric vừa tạo vào RAM buffer.
6. Phát sự kiện nội bộ `PING_COMPLETED` kèm dữ liệu kết quả kiểm tra.

### 4.2. Metric Buffer Flush Flow
1. Hệ thống giám sát kích thước RAM buffer. Khi số lượng đạt 100 items HOẶC bộ định thời gian 5 giây kích hoạt:
2. Hệ thống lấy toàn bộ items hiện có trong buffer ra một mảng xử lý riêng và làm rỗng buffer.
3. Thực thi một lệnh `bulkWrite` duy nhất chèn toàn bộ mảng metrics vào collection `ping_metrics`.
4. Cập nhật đồng loạt các bản ghi trong `monitors` với giá trị `status` và `lastCheckedAt` mới nhất.

### 4.3. Graceful Shutdown Flow
1. Khi máy chủ nhận tín hiệu kết thúc tiến trình SIGTERM hoặc SIGINT:
2. Bộ lập lịch tạm dừng tiếp nhận lượt kiểm tra mới.
3. Hệ thống kiểm tra RAM buffer, nếu còn dữ liệu sẽ lập tức thực thi lệnh `bulkWrite` lưu toàn bộ xuống MongoDB.
4. Đóng kết nối database an toàn và tiến trình kết thúc.

---

## 5. API Contract

Mô-đun chủ yếu chạy ngầm, cung cấp các endpoint quản trị chẩn đoán:

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| POST | `/api/admin/ping-engine/flush` | Admin | Cưỡng chế xả dữ liệu từ RAM buffer xuống database |
| GET | `/api/admin/ping-engine/status` | Admin | Xem trạng thái kích thước buffer và số lượng active monitors |

**Request and Response Payloads:**

```typescript
// Ping Metric Record Structure in Buffer
export interface PingMetricItem {
  timestamp: Date;
  monitorId: string;
  statusCode: number;
  latency: number;
  isUp: boolean;
  error?: string;
}

// Internal Event Payload emitted after each ping
export interface PingCompletedEvent {
  monitorId: string;
  userId: string;
  statusCode: number;
  latency: number;
  isUp: boolean;
  timestamp: string;
  error?: string;
}

// GET /api/admin/ping-engine/status - Response
export interface PingEngineStatusResponse {
  activeMonitorsCount: number;
  bufferSize: number;
  lastFlushAt: string | null;
  concurrencyLimit: number;
  isRunning: boolean;
}
```

**Status Codes:**

| Code | Khi nào trả về |
| :--- | :--- |
| 200 | Kích hoạt xả buffer thành công hoặc lấy trạng thái engine thành công |
| 401 | Thiếu phiên đăng nhập hợp lệ |
| 403 | Người dùng không mang vai trò admin |

---

## 6. Data

**Collections liên quan:**

| Collection | Thao tác | Ghi chú |
| :--- | :--- | :--- |
| `monitors` | SELECT, UPDATE | Lấy danh sách kiểm tra, cập nhật trạng thái mới nhất |
| `ping_metrics` | BULK_INSERT | Lưu trữ chuỗi thời gian kết quả kiểm tra |

**Invariants:**
- Mọi bản ghi metric lưu vào `ping_metrics` bắt buộc phải có `monitorId` hợp lệ và `timestamp` chính xác.
- Khi ứng dụng tắt bình thường, không có dữ liệu nào trong RAM buffer bị mất.
- Concurrency thực tế tại mọi thời điểm không vượt quá ngưỡng 5 requests song song.

---

## 7. Errors and Edge Cases

| Điều kiện | Hành vi của hệ thống | Dữ liệu lưu trữ |
| :--- | :--- | :--- |
| Target server quá 10s không phản hồi | Ngắt kết nối do timeout | `statusCode: 408`, `latency: 10000`, `isUp: false`, `error: 'ETIMEDOUT'` |
| Tên miền target không phân giải được | Bắt lỗi phân giải DNS | `statusCode: 0`, `latency: 0`, `isUp: false`, `error: 'ENOTFOUND'` |
| Target từ chối kết nối cổng mạng | Bắt lỗi từ chối kết nối | `statusCode: 0`, `latency: 0`, `isUp: false`, `error: 'ECONNREFUSED'` |
| MongoDB ngắt kết nối khi đang bulkWrite | Nhét lại dữ liệu vào buffer với giới hạn trần 5000 bản ghi (cắt bỏ phần cũ nhất nếu vượt trần để chống OOM) và thử lại ở chu kỳ xả kế tiếp | Giữ tối đa 5000 bản ghi gần nhất trên RAM |
| Số lượng monitors cần ping vượt quá 100 | Hàng chờ `p-limit` điều tiết tuần tự với nhịp nghỉ 100ms | Không làm nghẽn socket mạng của máy chủ |

---

## 8. User Interface

Mô-đun không có giao diện tương tác riêng cho người dùng cuối. Kết quả đo lường được chuyển tiếp để hiển thị tại:
- Biểu đồ latency và huy hiệu trạng thái tại Dashboard người dùng.
- Thẻ thông số trạng thái engine tại trang quản trị dành riêng cho Admin.

---

## 9. Constraints

- Giới hạn concurrency cố định ở mức 5 requests đồng thời.
- Pacing delay giữa các đợt bắn request là 100ms.
- Timeout kết nối HTTP tối đa là 10 giây cho mỗi lượt kiểm tra.
- Ngưỡng kích hoạt xả RAM buffer là 100 bản ghi hoặc 5 giây.
- Thao tác ghi xuống MongoDB bắt buộc dùng `bulkWrite` với chế độ `ordered: false` để một bản ghi lỗi không làm gián đoạn toàn bộ đợt ghi.

---

## 10. Acceptance Criteria

- **AC1:** Bộ lập lịch kích hoạt định kỳ đúng các mốc thời gian 30 giây, 60 giây và 300 giây.
- **AC2:** Số lượng requests ping đồng thời không bao giờ vượt quá 5 tại cùng một thời điểm.
- **AC3:** Khi RAM buffer tích lũy đủ 100 items hoặc sau 5 giây, dữ liệu được ghi xuống `ping_metrics` qua một câu lệnh `bulkWrite` duy nhất.
- **AC4:** Khi target server gặp sự cố mạng hoặc trả về mã lỗi 4xx hoặc 5xx, hệ thống tự động thử lại 1 lần sau 2 giây; nếu vẫn thất bại mới chính thức ghi nhận trạng thái `isUp: false` kèm thông tin lỗi.
- **AC5:** Khi nhận tín hiệu SIGTERM, hệ thống xả toàn bộ dữ liệu còn lại trong RAM buffer trước khi tiến trình tắt hoàn toàn.

---

## 11. Test Cases

| Scenario | Input | Expected Output |
| :--- | :--- | :--- |
| Ping target thành công mã 200 | Target server phản hồi HTTP 200 trong 50ms | Metric có `isUp: true`, `latency: 50`, `statusCode: 200` |
| Thử lại khi ping lỗi lần đầu | Lần 1 lỗi 500, thử lại sau 2s trả về 200 | Lượt kiểm tra tính là thành công, metric có `isUp: true` |
| Thử lại vẫn thất bại | Cả lần 1 và lần thử lại đều trả về 500 | Metric có `isUp: false`, `statusCode: 500` |
| Ping target bị timeout sau khi thử lại | Cả hai lần đều không phản hồi sau 10s | Metric có `isUp: false`, `error: 'ETIMEDOUT'` |
| Xả buffer theo số lượng | Đẩy đủ 100 items vào RAM buffer | `bulkWrite` được gọi ngay lập tức, buffer làm rỗng |
| Xả buffer theo thời gian | Đẩy 10 items vào buffer, không thêm dữ liệu mới | Sau 5 giây, `bulkWrite` được gọi chèn 10 items |
| Giới hạn concurrency | 20 monitors đến hạn kiểm tra cùng lúc | Tối đa 5 requests chạy đồng thời, các task còn lại xếp hàng |
| Cưỡng chế xả buffer bởi Admin | POST `/api/admin/ping-engine/flush` với role admin | HTTP 200, buffer rỗng, metrics ghi vào MongoDB |
| User thường gọi API flush | POST `/api/admin/ping-engine/flush` với role member | HTTP 403 Forbidden |
