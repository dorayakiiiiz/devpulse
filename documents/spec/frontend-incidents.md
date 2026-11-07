# Feature Spec: Frontend Incidents Timeline and AI Post-Mortem Inspection

- Module: Frontend Incidents
- Người phụ trách: Fullstack Developer
- Ngày soạn: 2026-11-07
- Trạng thái: Approved

---

## 1. Mục tiêu nghiệp vụ

Cung cấp giao diện toàn diện cho người dùng theo dõi lịch sử sự cố gián đoạn dịch vụ (Incidents), phân tích nguyên nhân gốc rễ và kế hoạch khắc phục thông qua AI Post-Mortem chẩn đoán tự động, cùng khả năng đánh dấu xử lý sự cố thủ công và mở rộng dữ liệu lỗi kỹ thuật (Technical error data). Tái hiện chuẩn xác 100% ngôn ngữ thiết kế Retro Neo-Brutalism từ bản thiết kế Figma (`DevPulse-Figma`), kết nối trực tiếp với hệ thống Backend RESTful API và tuân thủ tuyệt đối Hợp đồng dữ liệu chuẩn tại `documents/data-contracts.md`.

---

## 2. Phạm vi

**Trong scope:**
- **Dòng thời gian sự cố (Incident Timeline - Cột trái):**
  - Chuyển đổi bộ lọc trạng thái: `ongoing` (sự cố đang diễn ra) và `resolved` (sự cố đã khắc phục) kèm số lượng bản ghi tương ứng.
  - Danh sách sự cố cuộn mượt (`retro-scrollbar`) hiển thị tên điểm giám sát, Badge trạng thái, thời điểm bắt đầu (`startedAt`), và thời lượng gián đoạn / thời điểm khắc phục (`resolvedAt`).
  - Lựa chọn sự cố đang xem (Active selection) với hiệu ứng nền nổi bật `bg-yellow-200 dark:bg-amber-200`.
- **Bảng chi tiết sự cố & Hành động khắc phục (Cột phải):**
  - Header trạng thái sự cố: Tên monitor, mã trạng thái HTTP (`HTTP 502`, `HTTP 500`...), mô tả lỗi, thời gian bắt đầu và thời gian phục hồi.
  - Nút hành động "Mark as resolved" dành riêng cho sự cố đang diễn ra (`ongoing`) để người dùng đánh dấu đã khắc phục thủ công qua `PATCH /api/incidents/:id/resolve`.
- **Khung chẩn đoán AI Post-Mortem:**
  - Header với biểu tượng Sparkle, thời điểm tạo chẩn đoán (`generatedAt`), nút "Regenerate" gọi `POST /api/incidents/:id/reanalyze` để yêu cầu AI phân tích lại dựa trên dữ liệu lỗi mới nhất.
  - 3 thẻ phân tích chuyên sâu:
    1. **Summary:** Tóm tắt diễn biến sự cố (`bg-retro-lilac dark:bg-[#58486e]`).
    2. **Root cause:** Nguyên nhân kỹ thuật gốc rễ (`bg-coral-soft dark:bg-[#663b43]`).
    3. **Action items:** Danh sách các biện pháp phòng ngừa và khắc phục (`bg-mint dark:bg-[#295b55]`).
  - Trạng thái chờ/chưa có AI Post-Mortem với thông báo rõ ràng và nút kích hoạt phân tích.
- **Khung Dữ liệu Lỗi Kỹ thuật (Technical Error Data Accordion):**
  - Khung mở rộng / thu gọn (collapsible accordion) hiển thị dữ liệu lỗi thô: HTTP status code, server headers, và response error message format kiểu terminal/code block.
- **Custom Hook `useIncidents` (`src/hooks/useIncidents.ts`):**
  - Quản lý tập trung toàn bộ state, filter, selection, và mutation lifecycle của incidents.

**Ngoài scope (không làm ở sprint này):**
- Gửi thông báo webhook bên thứ ba thủ công từ UI (được đảm nhiệm tự động bởi Ping Engine & Alerting service của Backend).

---

## 3. Phân quyền

| Role | Quyền |
| :--- | :--- |
| **Anonymous (Khách)** | Bị chặn bởi `ProtectedRoute`, chuyển hướng về `/auth`. |
| **Member** | Xem danh sách sự cố, xem chi tiết AI post-mortem, giải quyết sự cố (`resolve`) và yêu cầu phân tích lại (`reanalyze`) đối với các monitor thuộc quyền sở hữu của mình. |
| **Admin** | Có toàn bộ quyền hạn đối với sự cố cá nhân. |

---

## 4. Luồng nghiệp vụ chính (Happy Path)

### 4.1. Xem Dòng thời gian & Lọc Sự cố
1. Người dùng truy cập đường dẫn `/incidents`.
2. Hook `useIncidents` gửi `GET /api/incidents` lấy toàn bộ sự cố thuộc quyền sở hữu.
3. Người dùng chuyển đổi qua lại giữa tab `ongoing` và `resolved` để lọc danh sách.
4. Mặc định chọn sự cố đầu tiên trong danh sách lọc để hiển thị chi tiết bên cột phải.

### 4.2. Đánh dấu Sự cố đã Khắc phục (Manual Resolve)
1. Tại sự cố có trạng thái `ongoing`, người dùng bấm nút "Mark as resolved".
2. Hook gọi `incidentService.resolveIncident(id)`.
3. Backend cập nhật `status: 'resolved'`, ghi nhận `resolvedAt` và trả về `IncidentResponseDto`.
4. Frontend cập nhật trạng thái bản ghi trong state, hiển thị Toast "Incident was marked as resolved" và tự động chuyển giao diện về trạng thái resolved.

### 4.3. Yêu cầu Phân tích lại Nguyên nhân AI (Regenerate AI Post-Mortem)
1. Người dùng bấm nút "Regenerate" tại khung AI post-mortem.
2. Nút chuyển sang trạng thái loading "Analyzing...".
3. Hook gọi `incidentService.reanalyzeIncident(id)`.
4. Backend đẩy tác vụ vào hàng đợi AI queue và trả về `IncidentResponseDto` với phân tích AI cập nhật.
5. Frontend cập nhật lại 3 thẻ Summary, Root Cause, Action Items và hiển thị Toast "The AI post-mortem was regenerated using the latest error data."

---

## 5. API Contract & Data Types

Tuân thủ 100% theo [`documents/data-contracts.md`](../data-contracts.md).

### 5.1. Endpoints

| Method | Endpoint | Params / Query | Response Data | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/incidents` | Query: `status?`, `monitorId?`, `limit?`, `skip?` | `IncidentResponseDto[]` | Danh sách sự cố |
| `GET` | `/api/incidents/:id` | Param: `id` | `IncidentResponseDto` | Chi tiết sự cố |
| `PATCH` | `/api/incidents/:id/resolve` | Param: `id` | `IncidentResponseDto` | Đánh dấu đã giải quyết |
| `POST` | `/api/incidents/:id/reanalyze` | Param: `id` | `IncidentResponseDto` | Yêu cầu AI phân tích lại |

### 5.2. Data Models (Strict TypeScript)

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

---

## 6. Dữ liệu & Bất biến (Data & Invariants)

1. **Single Source of Truth:**
   - Dữ liệu hiển thị trực tiếp từ `IncidentResponseDto`. Tuyệt đối cấm code nước đôi `item.monitor || item.monitorName`. Trường chuẩn duy nhất là `monitorName` và `monitorUrl`.
2. **AI Post-Mortem Integrity:**
   - Trường `aiPostMortem` là optional (`AiPostMortemDto | undefined`). Khi chưa có dữ liệu, hiển thị khung placeholder sạch sẽ kèm nút kích hoạt chẩn đoán; không sinh rác hoặc crash component.
3. **HTTP Code Representation:**
   - Mã HTTP được lấy trực tiếp từ `errorDetails.statusCode` (nếu không có mặc định 500).

---

## 7. Xử lý Lỗi & Trường hợp Biên (Errors & Edge Cases)

| Trường hợp | Phản hồi giao diện | Hành vi hệ thống |
| :--- | :--- | :--- |
| **Không có sự cố nào (Empty State)** | Hiển thị thông báo "No ongoing incidents" hoặc "No resolved incidents" tương ứng với tab. | Giữ nguyên bố cục trang, ẩn khung chi tiết hoặc hiển thị hướng dẫn. |
| **Lỗi mạng khi gọi Resolve** | Toast thông báo lỗi API chi tiết, giữ nguyên trạng thái `ongoing`. | Rollback state, cho phép thử lại. |
| **AI Service tạm thời bận / Timeout** | Toast cảnh báo lỗi khi bấm Regenerate. | Hủy loading state, giữ nguyên phân tích cũ (nếu có). |

---

## 8. Tiêu chuẩn Giao diện & Kiến trúc (UI/UX & Architecture)

1. **Đồng nhất 100% Giao diện Figma (`DevPulse-Figma`):**
   - Theme Retro Neo-Brutalism: Đường viền đậm `border-2 border-zinc-950 dark:border-[#737c91]`, `shadow-[5px_5px_0_#18181b]`.
   - Bảng màu: Khung sự cố `bg-retro-blue`, thẻ AI Summary `bg-retro-lilac`, Root Cause `bg-coral-soft`, Action Items `bg-mint`.
2. **Không có Emoji:**
   - 100% sử dụng vector icon chuẩn từ `lucide-react` (`Sparkles`, `Check`, `ChevronRight`, `ChevronDown`, `Clock`, `AlertTriangle`).
3. **100% Tiếng Anh:**
   - Toàn bộ nhãn, thông báo, tiêu đề, mã nguồn và comment đều bằng tiếng Anh.

---

## 9. Phân rã Component (Component Breakdown)

```
src/
├── hooks/
│   └── useIncidents.ts           (Custom hook quản lý incidents state & mutations)
├── pages/
│   └── incidents/
│       └── IncidentsPage.tsx     (Trang chính Incidents timeline & AI post-mortem)
```

---

## 10. Open Questions
*Không có. Hợp đồng API và thiết kế UI đã hoàn toàn rõ ràng.*

---

## 11. Checklist Kiểm thử & Nghiệm thu (Verification Checklist)

- [ ] Lấy danh sách sự cố và lọc chính xác theo `ongoing` và `resolved`.
- [ ] Chọn sự cố hiển thị đúng thông tin chi tiết và dữ liệu AI Post-Mortem bên phải.
- [ ] Bấm "Mark as resolved" cập nhật trạng thái sự cố sang `resolved` và cập nhật danh sách.
- [ ] Bấm "Regenerate" gọi `POST /api/incidents/:id/reanalyze` cập nhật phân tích AI.
- [ ] Mở rộng / thu gọn Accordion Technical error data hiển thị đúng mã lỗi và header.
- [ ] Chạy `npm.cmd run type-check` và `npm.cmd run build` đạt **0 errors**.

