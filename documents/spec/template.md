# Feature Spec: [Tên tính năng]

- Module: [Tên module]
- Người phụ trách: [Tên thành viên]
- Ngày soạn: [YYYY-MM-DD]
- Trạng thái: [Draft / Reviewed / Approved]

---

## 1. Mục tiêu nghiệp vụ

[Mô tả ngắn gọn tính năng này giải quyết vấn đề gì, ai dùng, dùng trong tình huống nào.]

---

## 2. Phạm vi

**Trong scope:**
- [Liệt kê những gì sẽ làm]

**Ngoài scope (không làm ở sprint này):**
- [Liệt kê những gì tính năng này cố ý KHÔNG làm — ghi rõ để tránh scope creep]

---

## 3. Phân quyền

| Role | Quyền |
| :--- | :--- |

---

## 4. Luồng nghiệp vụ chính (Happy Path)

[Step-by-step, chỉ luồng thành công. Edge case để ở Mục 7.]

1. ...
2. ...
3. ...

---

## 5. API Contract

| Method | Endpoint | Auth (Roles) | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/[resource]` | [Roles] | [Mô tả] |
| POST | `/api/[resource]` | [Roles] | [Mô tả] |
| PUT | `/api/[resource]/{id}` | [Roles] | [Mô tả] |
| DELETE | `/api/[resource]/{id}` | [Roles] | [Mô tả] |

**Request / Response DTO:**

```csharp
// Request DTO
public class [Feature]Request
{
    // Fields
}

// Response DTO
public class [Feature]Response
{
    // Fields
}
```

**Status codes:**

| Code | Khi nào trả về |
| :--- | :--- |
| 200 / 201 | Thành công |
| 400 | Validation lỗi (thiếu field, sai định dạng) |
| 403 | Không đủ quyền |
| 404 | Không tìm thấy resource |
| 409 | Conflict (trùng dữ liệu, tồn kho không đủ, ...) |

---

## 6. Data

**Bảng DB liên quan:**

| Bảng | Thao tác | Ghi chú |
| :--- | :--- | :--- |
| `[Table]` | INSERT / UPDATE / SELECT | [Ghi chú nếu có] |

**Invariants (bất biến phải đúng sau khi tính năng chạy xong):**

- [Ví dụ: `StockQuantity >= 0` sau khi trừ kho]
- [Ví dụ: `TotalAmount = SubTotal - DiscountAmount`]

---

## 7. Errors & Edge Cases

| Điều kiện | Người dùng thấy gì | Hệ thống làm gì |
| :--- | :--- | :--- |
| [Điều kiện vi phạm] | [Thông báo lỗi cụ thể] | [HTTP status + rollback nếu cần] |
| Vượt quyền | "Bạn không có quyền thực hiện thao tác này" | 403 Forbidden |
| Field thiếu / sai format | [Thông báo validation] | 400 Bad Request |

---

## 8. UI / Màn hình

[Mô tả ngắn bố cục màn hình, các control chính.]

**States cần xử lý:**
- `Loading`: Hiện skeleton / ProgressRing khi đang gọi API.
- `Empty`: Hiện placeholder khi không có dữ liệu.
- `Error`: Hiện InfoBar lỗi khi API thất bại.

---

## 9. Constraints

- Không thêm NuGet package mới nếu chưa hỏi cả nhóm.
- Chạy được trên schema DB hiện tại (không tạo migration mới nếu không cần thiết).
- Không breaking change API endpoint đang được module khác dùng.
- [Ràng buộc riêng của tính năng này nếu có]

---

## 10. Acceptance Criteria

[Mỗi AC phải là điều kiện **kiểm tra được** — bấm vào, nhìn thấy, đo được.]

- **AC1:** ...
- **AC2:** ...
- **AC3:** Khi gọi API với role không đủ quyền → nhận HTTP 403.
- **AC4:** Khi nhập thiếu field bắt buộc → nhận HTTP 400 kèm thông báo rõ field nào sai.

---

## 11. Test Cases

| Scenario | Input | Expected |
| :--- | :--- | :--- |
| Happy path | [Input hợp lệ] | [Kết quả đúng] |
| Thiếu dữ liệu bắt buộc | [Input thiếu field] | 400 + validation error |
| Vượt quyền | Request từ role không đủ quyền | 403 Forbidden |
| [Edge case] | [Input đặc biệt] | [Expected output] |
