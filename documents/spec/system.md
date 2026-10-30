# Feature Spec: System Health Check and Admin Overview

- Module: System
- Người phụ trách: Fullstack Developer
- Ngày soạn: 2026-10-29
- Trạng thái: Draft

---

## 1. Business Objectives

Cung cấp điểm kết nối kiểm tra sức khỏe tự động phục vụ cơ chế tự giám sát và tự khởi động lại của Docker container trên máy chủ Linux VPS. Đồng thời, thiết lập điểm kết nối quản trị áp dụng cơ chế kiểm soát truy cập dựa trên vai trò để cung cấp số liệu tổng quan về tình trạng phần cứng, kích thước bộ đệm và trạng thái vận hành của toàn bộ nền tảng DevPulse cho tài khoản quản trị viên.

---

## 2. Scope

**Trong scope:**
- Cung cấp điểm kết nối công khai `GET /api/health` trả về trạng thái kết nối cơ sở dữ liệu MongoDB, mức tiêu thụ bộ nhớ heap và thời gian hoạt động liên tục của tiến trình máy chủ.
- Tích hợp kiểm tra định kỳ trong Dockerfile và Docker Compose để tự động đánh dấu trạng thái bộ chứa là khỏe mạnh hoặc gặp sự cố.
- Cung cấp điểm kết nối quản trị `GET /api/admin/overview` yêu cầu nghiêm ngặt vai trò `admin`.
- Tổng hợp số liệu thống kê vĩ mô: tổng số người dùng, tổng số mục tiêu theo dõi, số lượng mục tiêu đang hoạt động.
- Giám sát trạng thái bộ lập lịch và kích thước bộ đệm RAM hiện tại của mô-đun Ping Engine.
- Đo lường chi tiết mức độ sử dụng bộ nhớ RAM của tiến trình Node.js gồm heapUsed, heapTotal và rss.

**Ngoài scope:**
- Xây dựng giao diện quản trị đầy đủ để chỉnh sửa, phân quyền hoặc xóa tài khoản người dùng khác.
- Can thiệp hoặc cấu hình các thông số mạng ở tầng nhân của hệ điều hành Linux từ xa.
- Khởi động lại máy chủ hoặc xóa dữ liệu cơ sở dữ liệu từ giao diện web.

---

## 3. Permissions

| Role | Quyền |
| :--- | :--- |
| Anonymous User | Có quyền gọi điểm kết nối kiểm tra sức khỏe `/api/health` mà không cần xác thực. Bị từ chối khi gọi điểm kết nối quản trị. |
| Member | Có quyền gọi `/api/health`. Bị từ chối truy cập điểm kết nối `/api/admin/overview` với mã lỗi HTTP 403. |
| Admin | Toàn quyền truy xuất cả hai điểm kết nối kiểm tra sức khỏe và số liệu tổng quan hệ thống. |

---

## 4. Core Business Flows

### 4.1. Automated Health Check Flow
1. Trình giám sát bộ chứa của Docker gửi yêu cầu kiểm tra định kỳ mỗi 30 giây đến đường dẫn `/api/health`.
2. Dịch vụ máy chủ thực hiện lệnh kiểm tra kết nối nội bộ đến cơ sở dữ liệu MongoDB.
3. Đọc thông số thời gian hoạt động liên tục và mức tiêu thụ bộ nhớ từ môi trường thực thi Node.js.
4. Trường hợp cơ sở dữ liệu phản hồi tốt:
   - Máy chủ trả về mã HTTP 200 kèm nội dung xác nhận hệ thống khỏe mạnh.
   - Docker ghi nhận trạng thái bộ chứa là `healthy`.
5. Trường hợp mất kết nối cơ sở dữ liệu:
   - Máy chủ trả về mã HTTP 503 Service Unavailable.
   - Docker ghi nhận trạng thái bộ chứa là `unhealthy` và tự động kích hoạt khởi động lại bộ chứa nếu cấu hình chính sách tự phục hồi.

### 4.2. Admin Overview Retrieval Flow
1. Người dùng đăng nhập bằng tài khoản mang vai trò `admin` và truy cập trang tổng quan hệ thống.
2. Giao diện gửi yêu cầu đến điểm kết nối `GET /api/admin/overview`.
3. Middleware xác thực kiểm tra tính hợp lệ của JWT trong Cookie. Nếu không có hoặc không hợp lệ, trả về HTTP 401.
4. Middleware phân quyền kiểm tra vai trò người dùng `req.user.role === 'admin'`. Nếu là `member`, lập tức từ chối với mã HTTP 403.
5. Hệ thống thực thi các câu lệnh đếm dữ liệu song song nhằm tối ưu thời gian phản hồi:
   - Đếm tổng số tài khoản trong collection `users`.
   - Đếm tổng số mục tiêu và số mục tiêu có `isActive: true` trong collection `monitors`.
   - Lấy kích thước bộ đệm RAM hiện tại và thời điểm xả dữ liệu gần nhất từ dịch vụ Ping Engine.
   - Lấy các chỉ số bộ nhớ từ môi trường thực thi.
6. Hệ thống đóng gói toàn bộ dữ liệu vào cấu trúc phản hồi chuẩn và gửi về cho trình duyệt.

---

## 5. API Contract

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/health` | None | Kiểm tra sức khỏe hệ thống và kết nối database |
| GET | `/api/admin/overview` | Admin | Lấy thông số vận hành tổng thể của toàn hệ thống |

**Request and Response Payloads:**

```typescript
// GET /api/health - Response
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
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

// GET /api/admin/overview - Response
export interface AdminOverviewResponse {
  counts: {
    totalUsers: number;
    totalMonitors: number;
    activeMonitors: number;
    ongoingIncidents: number;
  };
  pingEngine: {
    bufferSize: number;
    lastFlushAt: string;
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

**Status Codes:**

| Code | Khi nào trả về |
| :--- | :--- |
| 200 | Hệ thống hoạt động bình thường hoặc lấy dữ liệu quản trị thành công |
| 401 | Gọi điểm kết nối quản trị khi chưa đăng nhập |
| 403 | Gọi điểm kết nối quản trị bởi người dùng mang vai trò member |
| 503 | Cơ sở dữ liệu bị ngắt kết nối khi kiểm tra sức khỏe |

---

## 6. Data

**Collections liên quan:**

| Collection | Thao tác | Ghi chú |
| :--- | :--- | :--- |
| `users` | COUNT | Đếm tổng số lượng người dùng trong hệ thống |
| `monitors` | COUNT | Đếm tổng số mục tiêu và số mục tiêu đang kích hoạt |
| `incidents` | COUNT | Đếm số lượng sự cố chưa được giải quyết |

**Invariants:**
- Điểm kết nối `/api/health` tuyệt đối không thực hiện các câu truy vấn cơ sở dữ liệu phức tạp hoặc ghi dữ liệu, đảm bảo thời gian phản hồi luôn dưới 20 mili giây.
- Điểm kết nối `/api/admin/overview` bắt buộc phải được bảo vệ bởi cả hai lớp middleware xác thực danh tính và kiểm tra vai trò quản trị viên.

---

## 7. Errors and Edge Cases

| Tình huống | Hiện tượng | Xử lý của hệ thống |
| :--- | :--- | :--- |
| Cơ sở dữ liệu MongoDB bị sập đột ngột | Mất kết nối database | Điểm kết nối `/api/health` trả về HTTP 503 kèm thông báo lỗi kết nối |
| Tài khoản member cố tình gọi API admin | Vi phạm phân quyền | Middleware phân quyền chặn ngay lập tức và trả về HTTP 403 Forbidden |
| Gọi API admin nhưng không đính kèm Cookie | Chưa đăng nhập | Middleware xác thực chặn và trả về HTTP 401 Unauthorized |
| Quá trình đếm số lượng bản ghi bị chậm | Cơ sở dữ liệu quá tải | Áp dụng câu lệnh đếm ước lượng dựa trên metadata nếu số lượng tài liệu vượt ngưỡng lớn |

---

## 8. User Interface

**Giao diện điểm kết nối kiểm tra sức khỏe:**
- Không có giao diện người dùng, trả về dữ liệu định dạng JSON thuần túy phục vụ trình giám sát tự động của Docker và máy chủ chuyển tiếp.

**Giao diện hiển thị số liệu quản trị:**
- Xuất hiện trên thanh điều hướng hoặc góc phải Dashboard khi người dùng đăng nhập bằng tài khoản có vai trò `admin`.
- Khối hiển thị dạng lưới gồm 4 thẻ chỉ số chính:
  - Thẻ 1: Tổng số tài khoản người dùng đăng ký.
  - Thẻ 2: Số lượng mục tiêu theo dõi đang chạy trên tổng số mục tiêu.
  - Thẻ 3: Số lượng bản ghi metric đang nằm trên bộ nhớ đệm RAM.
  - Thẻ 4: Dung lượng bộ nhớ RAM mà máy chủ đang tiêu thụ.

**States:**
- Loading: Hiển thị khung chờ tải các thẻ số liệu thống kê.
- Error: Thông báo từ chối truy cập khi tài khoản không phải là quản trị viên.

---

## 9. Constraints

- Điểm kết nối `/api/health` không được đặt sau bất kỳ middleware xác thực nào để bộ kiểm tra của Docker có thể gọi trực tiếp từ mạng nội bộ.
- Dữ liệu đo đạc bộ nhớ phải được chuyển đổi sẵn sang đơn vị Megabytes trước khi trả về để giao diện dễ dàng hiển thị.
- Thời gian thực thi toàn bộ điểm kết nối `/api/admin/overview` không vượt quá 100 mili giây.

---

## 10. Acceptance Criteria

- **AC1:** Điểm kết nối `GET /api/health` trả về mã HTTP 200 kèm trạng thái kết nối cơ sở dữ liệu khi hệ thống hoạt động bình thường.
- **AC2:** Khi ngắt kết nối cơ sở dữ liệu, điểm kết nối `GET /api/health` trả về mã HTTP 503 để Docker nhận diện trạng thái lỗi.
- **AC3:** Điểm kết nối `GET /api/admin/overview` trả về mã HTTP 200 kèm đầy đủ các chỉ số thống kê khi gọi bởi tài khoản có vai trò `admin`.
- **AC4:** Khi gọi `GET /api/admin/overview` bởi tài khoản có vai trò `member`, hệ thống từ chối với mã HTTP 403.
- **AC5:** Khi gọi `GET /api/admin/overview` mà không có Cookie xác thực, hệ thống từ chối với mã HTTP 401.

---

## 11. Test Cases

| Scenario | Input | Expected Output |
| :--- | :--- | :--- |
| Kiểm tra sức khỏe bình thường | Gọi GET `/api/health` khi database kết nối tốt | HTTP 200 + status: 'ok' + database: 'connected' |
| Kiểm tra sức khỏe khi mất database | Gọi GET `/api/health` khi MongoDB bị tắt | HTTP 503 Service Unavailable + database: 'disconnected' |
| Admin lấy dữ liệu tổng quan | Gọi GET `/api/admin/overview` với vai trò admin | HTTP 200 + đầy đủ cấu trúc dữ liệu counts, memory, pingEngine |
| Member gọi API của admin | Gọi GET `/api/admin/overview` với vai trò member | HTTP 403 Forbidden |
| Người dùng vãng lai gọi API admin | Gọi GET `/api/admin/overview` không có Cookie | HTTP 401 Unauthorized |
| Đo lường thời gian phản hồi healthcheck | Gửi yêu cầu kiểm tra sức khỏe | Thời gian xử lý phản hồi dưới 20 mili giây |

