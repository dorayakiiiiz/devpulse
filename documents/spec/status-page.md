# Feature Spec: Public Status Page and Multi-Layer Caching

- Module: Status Page
- Người phụ trách: Fullstack Developer
- Ngày soạn: 2026-10-29
- Trạng thái: Implemented

---

## 1. Business Objectives

Cung cấp trang thông tin trạng thái công khai cho phép khách hàng và người dùng cuối theo dõi độ sẵn sàng và lịch sử hoạt động của các dịch vụ mà không cần đăng nhập tài khoản. Áp dụng kiến trúc bộ nhớ đệm 2 tầng để phục vụ lượng truy cập tăng vọt đột biến khi xảy ra sự cố gián đoạn dịch vụ mà không làm suy giảm hiệu năng cơ sở dữ liệu.

---

## 2. Scope

**Trong scope:**
- Cung cấp điểm kết nối công khai `GET /api/status/:slug` cho phép người dùng vãng lai truy xuất dữ liệu trạng thái.
- Tổng hợp trạng thái vận hành của toàn bộ các mục tiêu theo dõi công khai thuộc một tài khoản.
- Tính toán tỷ lệ phần trăm thời gian hoạt động trong 24 giờ gần nhất cho từng mục tiêu.
- Hiển thị danh sách các sự cố đang diễn ra và lịch sử sự cố đã được giải quyết trong 7 ngày gần nhất.
- Bộ nhớ đệm tầng 1: Lưu trữ dữ liệu tổng hợp trên bộ nhớ RAM thông qua `node-cache` với thời gian tồn tại 30 giây.
- Bộ nhớ đệm tầng 2: Thiết lập tiêu đề kiểm soát bộ nhớ đệm HTTP để máy chủ chuyển tiếp Nginx hoặc mạng phân phối nội dung lưu trữ tạm ở tầng biên.
- Cơ chế xóa bộ nhớ đệm chủ động khi hệ thống phát hiện sự cố mới hoặc khi dịch vụ phục hồi hoàn toàn.

**Ngoài scope:**
- Đăng ký nhận thông báo trạng thái qua tin nhắn SMS hoặc thư điện tử trực tiếp từ trang công khai.
- Cấu hình tên miền riêng tùy biến cho từng trang trạng thái trong giai đoạn hiện tại.
- Phân quyền xem trang trạng thái bằng mật khẩu bảo vệ riêng.

---

## 3. Permissions

| Role | Quyền |
| :--- | :--- |
| Anonymous User | Toàn quyền xem trang trạng thái công khai thông qua đường dẫn slug. |
| Member | Xem trang trạng thái công khai của chính mình hoặc của các tổ chức khác. |
| Admin | Toàn quyền xem trang trạng thái công khai. |

---

## 4. Core Business Flows

### 4.1. Public Status Page Retrieval Flow
1. Người dùng cuối truy cập đường dẫn `/status/:slug` trên trình duyệt web.
2. Ứng dụng gọi điểm kết nối `GET /api/status/:slug`.
3. Hệ thống kiểm tra khóa định tuyến trong bộ nhớ đệm RAM: `status_page:slug:${slug}` (TTL 24h).
   - Nếu trúng đệm: Lấy trực tiếp `userId` tương ứng mà không cần truy vấn database.
   - Nếu trượt đệm: Tra cứu `userRepository.findBySlug(slug)`, ghi đệm `userId` vào `status_page:slug:${slug}`.
4. Hệ thống kiểm tra dữ liệu trạng thái trong bộ nhớ đệm RAM: `status_page:data:${userId}` (TTL 30s).
   - Nếu trúng đệm: Trả về dữ liệu tức thì trong thời gian dưới 1 mili giây kèm tiêu đề `Cache-Control`.
   - Nếu trượt đệm:
     - Lấy danh sách các mục tiêu theo dõi đang kích hoạt kèm trạng thái hiện thời của `userId`.
     - Truy vấn lịch sử 5 sự cố gần nhất từ collection `incidents`.
     - Tính toán tỷ lệ hoạt động 24 giờ qua dựa trên số lượng lượt kiểm tra thành công.
     - Tổng hợp trạng thái toàn hệ thống: Hoạt động bình thường, Gián đoạn một phần hoặc Gián đoạn nghiêm trọng.
     - Lưu trữ dữ liệu tổng hợp vào `node-cache` với khóa `status_page:data:${userId}` (TTL 30s).
     - Trả về dữ liệu cho trình duyệt.

### 4.2. Cache Invalidation Flow
1. Khi có sự kiện thay đổi trạng thái monitor hoặc incident:
   - Tạo mới incident, cập nhật incident, hoặc giải quyết sự cố (`incidentService`).
   - Tạo mới, cập nhật, hoặc xóa monitor (`monitorService`).
2. Hệ thống gọi phương thức đồng bộ `statusPageService.invalidateCache(userId)` để xóa khóa `status_page:data:${userId}` trong RAM với **0 truy vấn database**.
3. Khi người dùng thay đổi slug hoặc xóa tài khoản (`userService`):
   - Hệ thống gọi `statusPageService.invalidateSlug(oldSlug)` để xóa con trỏ định tuyến.
   - Đồng thời gọi `statusPageService.invalidateCache(userId)` để xóa dữ liệu đệm cũ.
4. Yêu cầu truy cập kế tiếp sẽ tự động nạp lại dữ liệu mới nhất từ cơ sở dữ liệu và ghi đệm mới.

---

## 5. API Contract

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/status/:slug` | None | Lấy dữ liệu trang trạng thái công khai theo định danh slug |

**Request and Response Payloads:**

```typescript
// Public Monitor Item on Status Page
export interface PublicMonitorStatus {
  name: string;
  url: string;
  status: MonitorStatus;
  uptimePercentage24h: number;
  lastCheckedAt: string | null;
}

// Public Incident Summary on Status Page
export interface PublicIncidentItem {
  id: string;
  monitorName: string;
  status: 'ongoing' | 'resolved';
  startedAt: string;
  resolvedAt: string | null;
  errorMessage: string;
  aiSummary?: string;
}

// GET /api/status/:slug - Response
export interface PublicStatusPageResponse {
  systemStatus: 'all_operational' | 'partial_outage' | 'major_outage';
  systemName: string;
  monitors: PublicMonitorStatus[];
  recentIncidents: PublicIncidentItem[];
  cachedAt: string;
}
```

**Status Codes:**

| Code | Khi nào trả về |
| :--- | :--- |
| 200 | Lấy dữ liệu trang trạng thái thành công |
| 404 | Không tìm thấy trang trạng thái theo mã slug cung cấp |

---

## 6. Data

**Collections liên quan:**

| Collection | Thao tác | Ghi chú |
| :--- | :--- | :--- |
| `users` | SELECT | Tra cứu thông tin định danh và tên hệ thống theo slug |
| `monitors` | SELECT | Lấy danh sách mục tiêu và trạng thái hiện tại |
| `incidents` | SELECT | Lấy các sự cố đang diễn ra hoặc đã xử lý trong 7 ngày |
| `ping_metrics` | AGGREGATE | Tính toán tỷ lệ hoạt động trong 24 giờ |

**Invariants:**
- Dữ liệu trả về cho người dùng công khai tuyệt đối không bao giờ chứa thông tin nhạy cảm như tiêu đề xác thực tùy chỉnh, chuỗi băm mật khẩu hoặc địa chỉ thư điện tử của chủ sở hữu.
- Trạng thái tổng thể hệ thống bắt buộc phản ánh chính xác trạng thái của các mục tiêu con: nếu toàn bộ đều up thì là `all_operational`, nếu có ít nhất một mục tiêu down thì là `partial_outage`, nếu toàn bộ đều down thì là `major_outage`.

---

## 7. Errors and Edge Cases

| Tình huống | Hiện tượng | Xử lý của hệ thống |
| :--- | :--- | :--- |
| Slug không tồn tại trong hệ thống | Không có dữ liệu người dùng | Trả về HTTP 404 Not Found |
| Lưu lượng truy cập tăng vọt khi hệ thống sập | Hàng ngàn yêu cầu gửi đến cùng lúc | Phục vụ trực tiếp từ bộ nhớ đệm RAM trong 30s, số lượng truy vấn database bằng 0 |
| Mục tiêu mới tạo chưa có số liệu kiểm tra | Chưa có lịch sử ping | Tỷ lệ hoạt động mặc định hiển thị 100% |
| Dữ liệu có sự cố nhưng đã giải quyết | Đã có resolvedAt | Hiển thị trong danh sách sự cố đã khắc phục |

---

## 8. User Interface

**Bố cục màn hình công khai:**
- Khung biểu ngữ trạng thái trên cùng: Khối màu xanh nổi bật với thông báo toàn bộ dịch vụ đang hoạt động bình thường, hoặc khối màu vàng/đỏ khi có sự cố.
- Danh sách các dịch vụ theo dõi: Thẻ hiển thị tên dịch vụ, nhãn trạng thái xanh/đỏ và chỉ số tỷ lệ hoạt động 24 giờ.
- Dòng thời gian sự cố: Khung ghi nhận các sự cố trong 7 ngày gần nhất kèm thời gian bắt đầu, thời gian phục hồi và tóm tắt nguyên nhân.

**States:**
- Loading: Hiển thị khung chờ tải dữ liệu ban đầu.
- Error: Hiển thị thông báo không tìm thấy trang trạng thái hoặc máy chủ bận.

---

## 9. Constraints

- Thời gian tồn tại của bộ nhớ đệm trên RAM là 30 giây.
- Tiêu đề phản hồi bắt buộc có: `Cache-Control: public, max-age=30, s-maxage=60`.
- Thời gian phản hồi khi trúng bộ nhớ đệm bắt buộc dưới 5 mili giây.
- Loại bỏ toàn bộ trường thông tin nội bộ trước khi trả dữ liệu về trình duyệt.

---

## 10. Acceptance Criteria

- **AC1:** Người dùng vãng lai truy cập được thông tin trạng thái qua đường dẫn slug mà không cần thông tin đăng nhập.
- **AC2:** Yêu cầu thứ hai gửi đến trong vòng 30 giây được phục vụ trực tiếp từ bộ nhớ đệm RAM mà không sinh ra truy vấn mới vào cơ sở dữ liệu.
- **AC3:** Tiêu đề phản hồi chứa đầy đủ thông số kiểm soát bộ nhớ đệm cho máy chủ chuyển tiếp.
- **AC4:** Khi có sự cố xảy ra làm thay đổi trạng thái mục tiêu, bộ nhớ đệm được làm mới chủ động ngay lập tức.
- **AC5:** Dữ liệu trả về tuyệt đối không làm lộ thông tin cấu hình nhạy cảm của người dùng.

---

## 11. Test Cases

| Scenario | Input | Expected Output |
| :--- | :--- | :--- |
| Truy cập trang trạng thái hợp lệ | Slug hợp lệ tồn tại trong hệ thống | HTTP 200 + dữ liệu trạng thái và danh sách mục tiêu |
| Truy cập với slug không tồn tại | Slug ngẫu nhiên không có trong database | HTTP 404 Not Found |
| Kiểm tra hiệu quả bộ nhớ đệm | Gửi 2 yêu cầu liên tiếp trong 5s | Yêu cầu thứ hai trả về dưới 5ms, dữ liệu cachedAt giữ nguyên |
| Kiểm tra tiêu đề bộ nhớ đệm | Kiểm tra headers của phản hồi | Có header Cache-Control: public, max-age=30 |
| Làm mới bộ nhớ đệm khi có sự cố | Kích hoạt sự cố cho monitor | Khóa cache bị xóa, yêu cầu tiếp theo sinh ra cachedAt mới |
| Xóa bộ nhớ đệm bởi Admin | POST endpoint xóa cache với role admin | HTTP 200 + cache bị làm rỗng |
| Xóa bộ nhớ đệm không có quyền | POST endpoint xóa cache bởi user thường | HTTP 403 Forbidden |

