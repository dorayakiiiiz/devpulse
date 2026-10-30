# Feature Spec: Monitor Management and SSL Tracking

- Module: Monitors
- Người phụ trách: Fullstack Developer
- Ngày soạn: 2026-10-29
- Trạng thái: Draft

---

## 1. Business Objectives

Cung cấp khả năng quản lý cấu hình các mục tiêu giám sát cho người dùng nền tảng DevPulse. Hỗ trợ thiết lập thông số kết nối mạng, chu kỳ kiểm tra định kỳ và tự động kiểm tra thời hạn chứng chỉ bảo mật SSL nhằm phát hiện nguy cơ hết hạn chứng chỉ trước khi gây gián đoạn dịch vụ.

---

## 2. Scope

**Trong scope:**
- Tạo mới cấu hình mục tiêu giám sát gồm tên gợi nhớ, URL, HTTP method, headers tùy chỉnh và chu kỳ kiểm tra.
- Xem danh sách mục tiêu thuộc quyền sở hữu của người dùng kèm trạng thái mới nhất.
- Xem chi tiết thông số cấu hình và thông tin chứng chỉ SSL của một mục tiêu.
- Cập nhật thông số cấu hình của mục tiêu đã tạo.
- Bật hoặc tạm dừng hoạt động kiểm tra định kỳ của một mục tiêu.
- Xóa mục tiêu giám sát khỏi hệ thống.
- Kích hoạt kiểm tra tức thì một mục tiêu theo dõi theo yêu cầu của người dùng kèm cơ chế cooldown chống lạm dụng.
- Tự động quét và phân tích thông tin chứng chỉ SSL cho các URL sử dụng giao thức HTTPS.

**Ngoài scope:**
- Giám sát qua giao thức ICMP Ping hoặc cổng TCP socket thô.
- Cấu hình request body phức tạp cho các truy vấn GraphQL hoặc form dữ liệu nhị phân.
- Cấu hình phân nhóm mục tiêu theo dự án hoặc thẻ gắn nhãn.

---

## 3. Permissions

| Role | Quyền |
| :--- | :--- |
| Anonymous User | Không có quyền truy cập các endpoint quản lý mục tiêu. |
| Member | Toàn quyền tạo, xem, sửa, bật tắt, xóa và kích hoạt kiểm tra tức thì các mục tiêu do chính tài khoản của mình tạo ra. |
| Admin | Toàn quyền quản lý mục tiêu cá nhân và có quyền tra cứu mục tiêu trên toàn hệ thống qua các endpoint quản trị riêng. |

---

## 4. Core Business Flows

### 4.1. Create Monitor Flow
1. Người dùng gửi yêu cầu tạo mục tiêu với các thông số: tên, URL, method, headers và interval.
2. Hệ thống kiểm tra tính hợp lệ của dữ liệu: định dạng URL bắt buộc thuộc giao thức `http` hoặc `https`, interval chỉ nhận giá trị 30, 60 hoặc 300 giây.
3. Nếu URL sử dụng giao thức `https`, hệ thống thực hiện bắt tay TLS để quét thông tin chứng chỉ SSL gồm đơn vị cấp phát, ngày hết hạn và số ngày còn lại.
4. Hệ thống lưu bản ghi mới vào collection `monitors` với `userId` lấy từ phiên đăng nhập hiện thời và trạng thái khởi tạo là `pending`.
5. Hệ thống trả về thông tin mục tiêu vừa tạo với mã HTTP 201.

### 4.2. Update or Toggle Pause/Resume Monitor Flow
1. Người dùng gửi yêu cầu cập nhật thông số hoặc chuyển đổi trạng thái tạm dừng / kích hoạt lại (`isActive`).
2. Hệ thống tra cứu bản ghi theo `_id` kèm điều kiện `userId` của người dùng.
3. Nếu là thao tác chuyển đổi trạng thái (Pause / Resume qua endpoint toggle):
   - **Tạm dừng (Pause):** Khi `isActive` chuyển thành `false`, hệ thống cập nhật `status = 'paused'`. Scheduler sẽ loại bỏ monitor khỏi chu kỳ kiểm tra, không thực hiện ping, không ghi metric và không tạo sự cố (incident) hay gửi email thông báo.
   - **Kích hoạt lại (Resume):** Khi `isActive` chuyển thành `true`, hệ thống cập nhật `status = 'pending'`. Scheduler sẽ tự động nạp lại monitor vào lượt ping kế tiếp để xác định lại trạng thái `up` hoặc `down`.
4. Nếu là thao tác cập nhật cấu hình thông số (name, URL, headers, interval): Hệ thống kiểm tra hợp lệ và cập nhật các trường tương ứng.
5. Hệ thống trả về dữ liệu mục tiêu sau cập nhật với mã HTTP 200.

### 4.3. Delete Monitor Flow
1. Người dùng gửi yêu cầu xóa mục tiêu theo định danh `_id`.
2. Hệ thống kiểm tra quyền sở hữu bản ghi dựa trên `userId`.
3. Nếu hợp lệ: Hệ thống xóa bản ghi khỏi collection `monitors`.
4. Hệ thống trả về thông báo xóa thành công với mã HTTP 200.

### 4.4. Trigger Instant Ping Flow
1. Người dùng bấm nút yêu cầu kiểm tra tức thì cho một mục tiêu trên giao diện.
2. Hệ thống kiểm tra quyền sở hữu mục tiêu dựa trên `userId`.
3. Hệ thống kiểm tra khóa cooldown `ping_cooldown:${id}` trong `node-cache`:
   - Nếu khóa đang tồn tại: Hệ thống từ chối yêu cầu và trả về mã HTTP 429 kèm thông báo thời gian cần chờ.
   - Nếu khóa chưa tồn tại: Hệ thống thiết lập khóa với thời gian sống 15 giây.
4. Hệ thống kiểm tra giới hạn tần suất tài khoản: tối đa 10 requests trong 1 phút cho mỗi người dùng.
5. Hệ thống chuyển tiếp yêu cầu đến Ping Engine để thực thi một lượt kiểm tra ngay lập tức.
6. Trả về kết quả đo lường độ trễ và trạng thái mới nhất cho người dùng với mã HTTP 200.

---

## 5. API Contract

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/monitors` | Member | Lấy danh sách mục tiêu của user hiện tại |
| POST | `/api/monitors` | Member | Tạo mục tiêu giám sát mới |
| GET | `/api/monitors/:id` | Member | Lấy thông tin chi tiết một mục tiêu |
| PUT | `/api/monitors/:id` | Member | Cập nhật cấu hình một mục tiêu |
| PATCH | `/api/monitors/:id/toggle` | Member | Tạm dừng (Pause) hoặc kích hoạt lại (Resume) monitor |
| POST | `/api/monitors/:id/ping` | Member | Kích hoạt kiểm tra tức thì một mục tiêu |
| DELETE | `/api/monitors/:id` | Member | Xóa mục tiêu giám sát |

**Request and Response Payloads:**

```typescript
// Common SSL Information Structure
export interface SslInfo {
  issuer: string;
  validTo: string;
  daysRemaining: number;
  lastCheckedAt: string;
}

// POST /api/monitors - Request
export interface CreateMonitorRequest {
  name: string;
  url: string;
  method?: 'GET' | 'POST' | 'HEAD';
  headers?: Record<string, string>;
  interval: 30 | 60 | 300;
}

// PUT /api/monitors/:id - Request
export interface UpdateMonitorRequest {
  name?: string;
  url?: string;
  method?: 'GET' | 'POST' | 'HEAD';
  headers?: Record<string, string>;
  interval?: 30 | 60 | 300;
}

// Monitor Item Response
export interface MonitorResponse {
  id: string;
  userId: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  headers: Record<string, string>;
  interval: number;
  isActive: boolean;
  status: 'up' | 'down' | 'pending' | 'paused';
  lastCheckedAt: string | null;
  sslInfo?: SslInfo;
  createdAt: string;
  updatedAt: string;
}

// POST /api/monitors/:id/ping - Response
export interface InstantPingResponse {
  monitorId: string;
  statusCode: number;
  latency: number;
  isUp: boolean;
  checkedAt: string;
  error?: string;
}
```

**Status Codes:**

| Code | Khi nào trả về |
| :--- | :--- |
| 200 | Lấy danh sách, xem chi tiết, cập nhật hoặc xóa mục tiêu thành công |
| 201 | Tạo mới mục tiêu giám sát thành công |
| 400 | Định dạng URL không hợp lệ hoặc chu kỳ kiểm tra nằm ngoài danh sách cho phép |
| 401 | Thiếu phiên đăng nhập hợp lệ |
| 403 | Thao tác trên mục tiêu thuộc quyền sở hữu của người dùng khác |
| 404 | Không tìm thấy mục tiêu theo mã định danh cung cấp |
| 429 | Gọi kiểm tra tức thì khi chưa hết thời gian cooldown 15 giây hoặc vượt quá giới hạn tần suất |

---

## 6. Data

**Collections liên quan:**

| Collection | Thao tác | Ghi chú |
| :--- | :--- | :--- |
| `monitors` | INSERT, SELECT, UPDATE, DELETE | Quản lý vòng đời cấu hình theo dõi |

**Invariants:**
- Mọi thao tác truy vấn và biến đổi dữ liệu trên `monitors` bắt buộc phải chứa điều kiện lọc `userId` để bảo vệ cô lập dữ liệu người dùng.
- Giá trị trường `interval` chỉ chấp nhận một trong ba số nguyên cố định là 30, 60 hoặc 300.
- Đường dẫn `url` phải bắt đầu bằng tiền tố `http://` hoặc `https://`.
- Trường `daysRemaining` trong `sslInfo` phải là số nguyên tính từ ngày hiện tại đến mốc `validTo`.

---

## 7. Errors and Edge Cases

| Điều kiện | Người dùng thấy gì | Hệ thống xử lý |
| :--- | :--- | :--- |
| URL không đúng định dạng mạng | Định dạng URL không hợp lệ | Trả về HTTP 400 |
| Interval khác 30, 60, 300 | Chu kỳ kiểm tra chỉ nhận 30, 60 hoặc 300 giây | Trả về HTTP 400 |
| Sửa mục tiêu của user khác | Bạn không có quyền chỉnh sửa mục tiêu này | Trả về HTTP 403 |
| ID mục tiêu không tồn tại | Không tìm thấy mục tiêu theo dõi | Trả về HTTP 404 |
| URL https có chứng chỉ SSL lỗi | Mục tiêu được tạo kèm cảnh báo chứng chỉ không hợp lệ | Ghi nhận lỗi chứng chỉ vào `sslInfo` và trả về HTTP 201 |
| Mục tiêu bị tạm dừng | Trạng thái hiển thị paused | Không đưa mục tiêu vào vòng lặp ping định kỳ |
| Bấm kiểm tra tức thì liên tiếp dưới 15s | Vui lòng đợi 15 giây trước khi thực hiện lần kiểm tra tiếp theo | Trả về HTTP 429 Too Many Requests |

---

## 8. User Interface

**Bố cục màn hình:**
- Danh sách mục tiêu: Màn hình Dashboard hiển thị danh sách dạng bảng hoặc dạng thẻ gồm tên, URL, nhãn trạng thái up/down/pending, chu kỳ kiểm tra, biểu tượng cảnh báo chứng chỉ SSL và các nút thao tác.
- Nút kiểm tra tức thì: Khi bấm, nút lập tức chuyển sang trạng thái vô hiệu hóa kèm bộ đếm ngược 15 giây và chỉ kích hoạt trở lại khi đếm về 0.
- Modal Tạo và Chỉnh sửa: Form nhập tên, đường dẫn URL, menu chọn HTTP method, trình soạn thảo custom headers và nút chọn chu kỳ kiểm tra.
- Hộp thoại xác nhận xóa: Modal cảnh báo trước khi xóa vĩnh viễn cấu hình mục tiêu.

**States:**
- Loading: Hiển thị khung chờ khi tải danh sách mục tiêu từ máy chủ.
- Empty: Hiển thị thông báo chưa có mục tiêu nào và nút tạo mục tiêu đầu tiên khi danh sách rỗng.
- Error: Hiển thị thanh thông báo lỗi khi không thể nạp danh sách hoặc thao tác cập nhật thất bại.

---

## 9. Constraints

- Chỉ chấp nhận các mục tiêu sử dụng giao thức web tiêu chuẩn HTTP và HTTPS.
- Không cho phép người dùng tùy ý cấu hình chu kỳ kiểm tra nhỏ hơn 30 giây nhằm bảo vệ tài nguyên mạng của máy chủ.
- Cơ chế quét chứng chỉ SSL tự động đặt thời gian chờ tối đa 5 giây để tránh treo tiến trình.
- Áp dụng thời gian cooldown 15 giây cho mỗi mục tiêu và giới hạn tối đa 10 lượt kiểm tra tức thì mỗi phút cho mỗi tài khoản.

---

## 10. Acceptance Criteria

- **AC1:** Tạo mục tiêu mới với đầy đủ thông số hợp lệ trả về HTTP 201 và lưu trữ chính xác thông tin trong MongoDB.
- **AC2:** Nếu URL thuộc giao thức HTTPS, hệ thống tự động trích xuất thông tin chứng chỉ SSL và tính toán số ngày còn lại.
- **AC3:** Người dùng chỉ xem và thao tác được trên các mục tiêu do chính mình tạo ra, không truy cập được mục tiêu của người dùng khác.
- **AC4:** Khi chuyển trạng thái `isActive` từ bật sang tắt, trường `isActive` cập nhật thành false và hệ thống trả về HTTP 200.
- **AC5:** Xóa mục tiêu thành công loại bỏ hoàn toàn bản ghi khỏi database và trả về HTTP 200.
- **AC6:** Người dùng có thể kích hoạt kiểm tra tức thì mục tiêu của mình qua endpoint ping và nhận về kết quả đo lường mới nhất; các yêu cầu gửi lại trong vòng 15 giây bị từ chối với mã HTTP 429.

---

## 11. Test Cases

| Scenario | Input | Expected Output |
| :--- | :--- | :--- |
| Tạo monitor https hợp lệ | URL https, interval 60 | HTTP 201 + thông tin monitor và sslInfo |
| Tạo monitor với interval sai | URL hợp lệ, interval 45 | HTTP 400 Bad Request |
| Tạo monitor với URL sai định dạng | Chuỗi text không phải URL | HTTP 400 Bad Request |
| Lấy danh sách monitors của user | Request có session của user A | HTTP 200 + mảng monitors của user A |
| Sửa monitor của user khác | ID của user B gửi bởi user A | HTTP 403 Forbidden |
| Bật tắt monitor thành công | PATCH toggle monitor ID hợp lệ | HTTP 200 + isActive bị đảo giá trị |
| Kích hoạt kiểm tra tức thì | POST `/api/monitors/:id/ping` của chính mình | HTTP 200 + kết quả đo lường latency mới nhất |
| Kích hoạt kiểm tra trong cooldown | Gọi ping liên tiếp 2 lần trong 5s | HTTP 429 Too Many Requests |
| Kích hoạt kiểm tra monitor người khác | POST `/api/monitors/:id/ping` của user B | HTTP 403 Forbidden |
| Xóa monitor thành công | DELETE monitor ID hợp lệ | HTTP 200 + bản ghi bị xóa khỏi database |
| Xóa monitor không tồn tại | DELETE ID ngẫu nhiên không có trong DB | HTTP 404 Not Found |

