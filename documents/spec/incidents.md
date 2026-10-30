# Feature Spec: Incident Detection, AI Post-Mortem, and Alert Notification

- Module: Incidents
- Người phụ trách: Fullstack Developer
- Ngày soạn: 2026-10-29
- Trạng thái: Draft

---

## 1. Business Objectives

Tự động phát hiện và quản lý vòng đời các sự cố gián đoạn dịch vụ của mục tiêu theo dõi. Tích hợp Generative AI đóng vai trò kỹ sư vận hành hệ thống để tự động phân tích dữ liệu lỗi thô, chẩn đoán nguyên nhân gốc rễ và đề xuất phương án khắc phục, đồng thời kích hoạt cảnh báo tức thời qua thư điện tử đến người quản trị mà không làm nghẽn luồng xử lý chính của ứng dụng.

---

## 2. Scope

**Trong scope:**
- Tự động khởi tạo bản ghi sự cố với trạng thái `ongoing` khi mục tiêu kiểm tra được xác nhận gặp lỗi mạng, mã lỗi HTTP 4xx, 5xx hoặc quá thời gian chờ kết nối sau lượt thử lại.
- Thu thập dữ liệu lỗi thô bao gồm HTTP status code, response headers, response body và nội dung lỗi kết nối.
- Tự động gọi LLM API của Groq hoặc OpenAI để sinh báo cáo phân tích sự cố gồm tóm tắt hiện tượng, nguyên nhân gốc rễ và các hành động khắc phục đề xuất.
- Thực thi tác vụ gửi thư điện tử cảnh báo đính kèm nội dung phân tích từ trí tuệ nhân tạo đến chủ sở hữu mục tiêu thông qua dịch vụ SMTP trong luồng xử lý nền.
- Tự động cập nhật thời điểm phục hồi và chuyển trạng thái sự cố sang `resolved` khi mục tiêu hoạt động bình thường trở lại.
- Cung cấp điểm kết nối xem danh sách và chi tiết các sự cố thuộc sở hữu của người dùng.
- Phát sự kiện nội bộ để cập nhật giao diện Dashboard qua Server-Sent Events và làm mới bộ nhớ đệm trang trạng thái công khai.

**Ngoài scope:**
- Gửi cảnh báo sự cố qua tin nhắn SMS hoặc cuộc gọi tự động.
- Tự động thực thi các đoạn mã sửa lỗi can thiệp trực tiếp vào máy chủ mục tiêu của khách hàng.
- Tích hợp hệ thống phân ca trực tổng đài sự cố phức tạp.

---

## 3. Permissions

| Role | Quyền |
| :--- | :--- |
| Anonymous User | Không có quyền truy cập trực tiếp vào các điểm kết nối quản lý sự cố nội bộ. |
| Member | Xem danh sách sự cố và nội dung báo cáo phân tích thuộc các mục tiêu do chính mình tạo ra. |
| Admin | Toàn quyền tra cứu và xem báo cáo sự cố của toàn bộ người dùng trên hệ thống. |
| System Scheduler | Tác vụ nội bộ tự động tạo, cập nhật trạng thái và kích hoạt phân tích sự cố. |

---

## 4. Core Business Flows

### 4.1. Incident Detection and AI Analysis Flow
1. Mô-đun Ping Engine hoàn tất lượt kiểm tra và xác nhận mục tiêu thất bại `isUp: false` sau khi đã thử lại.
2. Dịch vụ sự cố kiểm tra trong collection `incidents` xem mục tiêu này đã có sự cố nào đang ở trạng thái `ongoing` hay chưa.
3. Nếu chưa có:
   - Tạo bản ghi mới trong `incidents` với `status: 'ongoing'`, `startedAt` là thời điểm hiện tại và lưu trữ toàn bộ dữ liệu lỗi thô trong `errorDetails`.
   - Bắn sự kiện nội bộ `INCIDENT_ALERT` để đẩy thông báo lên Dashboard thời gian thực và xóa khóa bộ nhớ đệm trang trạng thái công khai.
   - Đẩy tác vụ phân tích trí tuệ nhân tạo và tác vụ gửi thư điện tử vào In-Memory Task Queue xử lý ngầm.
4. Tác vụ nền gửi dữ liệu lỗi thô đến LLM API kèm câu lệnh định hướng chuyên gia vận hành hệ thống.
5. Mô hình ngôn ngữ trả về kết quả định dạng JSON gồm tóm tắt hiện tượng, nguyên nhân tiềm tàng và các đầu việc cần làm.
6. Hệ thống cập nhật kết quả vào trường `aiPostMortem` của bản ghi sự cố.
7. Hệ thống định dạng nội dung thư điện tử và thực thi gửi cảnh báo qua cổng SMTP đến người quản trị mục tiêu.

### 4.2. Incident Resolution Flow
1. Mô-đun Ping Engine kiểm tra mục tiêu đạt kết quả thành công `isUp: true`.
2. Dịch vụ sự cố kiểm tra và phát hiện có bản ghi sự cố đang ở trạng thái `ongoing` của mục tiêu đó.
3. Hệ thống cập nhật bản ghi: thiết lập `status: 'resolved'` và ghi nhận mốc thời gian phục hồi `resolvedAt`.
4. Kích hoạt tác vụ nền gửi thư điện tử thông báo dịch vụ đã hoạt động bình thường trở lại kèm thời lượng gián đoạn.
5. Bắn sự kiện nội bộ báo hiệu sự cố đã kết thúc để giao diện đổi màu biểu tượng sang xanh và làm mới bộ nhớ đệm trang trạng thái.

---

## 5. API Contract

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/incidents` | Member | Lấy danh sách các sự cố của người dùng hiện tại |
| GET | `/api/incidents/:id` | Member | Xem chi tiết một sự cố kèm báo cáo phân tích |
| GET | `/api/monitors/:monitorId/incidents` | Member | Lấy lịch sử sự cố của một mục tiêu cụ thể |

**Request and Response Payloads:**

```typescript
// AI Post-Mortem Structure
export interface AiPostMortem {
  summary: string;
  rootCause: string;
  actionItems: string[];
  generatedAt: string;
}

// Raw Error Dump Structure
export interface ErrorDetails {
  statusCode: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  errorMessage: string;
}

// Incident Item Response
export interface IncidentResponse {
  id: string;
  monitorId: string;
  monitorName: string;
  status: 'ongoing' | 'resolved';
  startedAt: string;
  resolvedAt: string | null;
  errorDetails: ErrorDetails;
  aiPostMortem?: AiPostMortem;
  createdAt: string;
  updatedAt: string;
}
```

**Status Codes:**

| Code | Khi nào trả về |
| :--- | :--- |
| 200 | Lấy danh sách hoặc xem chi tiết sự cố thành công |
| 401 | Thiếu phiên đăng nhập hợp lệ |
| 403 | Thao tác trên sự cố thuộc quyền sở hữu của người dùng khác |
| 404 | Không tìm thấy bản ghi sự cố theo mã định danh cung cấp |

---

## 6. Data

**Collections liên quan:**

| Collection | Thao tác | Ghi chú |
| :--- | :--- | :--- |
| `incidents` | INSERT, SELECT, UPDATE | Quản lý vòng đời sự cố và lưu trữ báo cáo phân tích |
| `monitors` | SELECT | Lấy tên mục tiêu và thông tin chủ sở hữu |
| `users` | SELECT | Lấy địa chỉ thư điện tử nhận thông báo cảnh báo |

**Invariants:**
- Tại một thời điểm, mỗi mục tiêu chỉ tồn tại tối đa duy nhất một bản ghi sự cố ở trạng thái `ongoing`.
- Mốc thời gian phục hồi `resolvedAt` bắt buộc phải lớn hơn mốc thời gian bắt đầu sự cố `startedAt`.
- Bản ghi sự cố không bị xóa tự động theo chu kỳ 7 ngày như số liệu kiểm tra thô, giúp duy trì lịch sử vận hành lâu dài cho người dùng.

---

## 7. Errors and Edge Cases

| Tình huống | Hiện tượng | Xử lý của hệ thống |
| :--- | :--- | :--- |
| LLM API bị quá tải hoặc lỗi mạng | Gọi AI thất bại | Ghi nhật ký lỗi, lưu sự cố với `aiPostMortem: null`, vẫn gửi email cảnh báo kèm dữ liệu lỗi thô |
| Cổng gửi thư SMTP gặp trục trặc | Gửi thư thất bại | Thực hiện thử lại tối đa 3 lần trong luồng nền, không làm gián đoạn luồng chính |
| Mục tiêu gặp lỗi chập chờn liên tục | Trạng thái đổi liên tục | Chỉ cập nhật mốc kiểm tra, không gửi email cảnh báo dồn dập gây phiền nhiễu |
| Dữ liệu phản hồi lỗi chứa mã độc | Response body độc hại | Khử trùng chuỗi văn bản trước khi đưa vào câu lệnh gọi AI và lưu trữ cơ sở dữ liệu |

---

## 8. User Interface

**Bố cục màn hình sự cố:**
- Danh sách sự cố: Bảng hiển thị tên mục tiêu, trạng thái đang diễn ra hoặc đã giải quyết, mốc thời gian bắt đầu, thời lượng gián đoạn và nút xem chi tiết.
- Khung chi tiết sự cố:
  - Khối tổng quan: Thời gian bắt đầu, thời gian kết thúc, tổng số phút dịch vụ ngừng hoạt động.
  - Khối báo cáo AI: Hiển thị nổi bật 3 thẻ gồm Tóm tắt sự cố, Nguyên nhân cốt lõi và Danh sách hành động khuyến nghị.
  - Khối dữ liệu kỹ thuật: Thẻ có thể thu gọn hiển thị mã trạng thái HTTP, các trường tiêu đề mạng và nội dung phản hồi lỗi nguyên bản.

**States:**
- Loading: Hiển thị khung chờ khi tải dữ liệu chi tiết sự cố hoặc khi hệ thống đang trong tiến trình chờ kết quả phân tích AI.
- Error: Thông báo không tìm thấy sự cố hoặc bạn không có quyền truy cập.

---

## 9. Constraints

- Toàn bộ tác vụ gọi LLM API và gửi thư điện tử bắt buộc phải thực thi bất đồng bộ qua In-Memory Task Queue với giới hạn concurrency tối đa 2 tác vụ song song và cơ chế thử lại tối đa 3 lần cho thư điện tử, tuyệt đối không chặn phản hồi của các yêu cầu API khác.
- Thời gian chờ tối đa khi gọi dịch vụ trí tuệ nhân tạo là 15 giây.
- Kết quả phân tích từ mô hình ngôn ngữ bắt buộc phải được yêu cầu trả về theo cấu trúc đối tượng JSON hợp lệ.

---

## 10. Acceptance Criteria

- **AC1:** Khi mục tiêu kiểm tra được xác nhận gặp lỗi sau lượt thử lại, hệ thống tạo mới bản ghi sự cố với trạng thái `ongoing` trong MongoDB.
- **AC2:** Báo cáo phân tích từ trí tuệ nhân tạo được sinh tự động và gắn kết vào bản ghi sự cố trong vòng 15 giây kể từ khi phát hiện lỗi.
- **AC3:** Thư điện tử cảnh báo được gửi thành công đến địa chỉ của chủ sở hữu mục tiêu kèm theo nội dung phân tích sự cố.
- **AC4:** Khi mục tiêu kiểm tra hoạt động bình thường trở lại, sự cố tự động cập nhật sang trạng thái `resolved` kèm mốc thời gian kết thúc.
- **AC5:** Người dùng chỉ xem được các sự cố thuộc về mục tiêu của mình, cố tình truy cập sự cố của người khác nhận mã HTTP 403.

---

## 11. Test Cases

| Scenario | Input | Expected Output |
| :--- | :--- | :--- |
| Phát hiện sự cố mới | Target chuyển từ Up sang Down | Tạo bản ghi incident mới với `status: 'ongoing'` |
| Sự cố đang diễn ra tiếp tục lỗi | Target tiếp tục Down ở lượt kiểm tra sau | Không tạo bản ghi mới, duy trì sự cố đang mở |
| Gọi AI sinh báo cáo thành công | Dữ liệu lỗi thô hợp lệ gửi đến LLM | Trường `aiPostMortem` có đủ summary, rootCause, actionItems |
| LLM API gặp sự cố timeout | LLM không phản hồi sau 15s | Sự cố vẫn được tạo, `aiPostMortem` để trống, email gửi kèm lỗi thô |
| Phục hồi sự cố thành công | Target chuyển từ Down sang Up | Cập nhật `status: 'resolved'`, ghi nhận `resolvedAt` |
| Xem chi tiết sự cố của chính mình | Yêu cầu xem incident hợp lệ | HTTP 200 + đầy đủ thông tin sự cố và phân tích |
| Xem sự cố của người dùng khác | Yêu cầu xem incident của user khác | HTTP 403 Forbidden |

