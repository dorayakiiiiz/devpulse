# Database Design - DevPulse

## 1. Database Architecture Overview

Hệ thống sử dụng MongoDB phiên bản 7.0 hoặc mới hơn chạy trong Docker container. MongoDB được lựa chọn nhằm tối ưu hóa việc lưu trữ ping logs dạng Time-Series, lưu trữ dynamic error bodies từ các HTTP responses và tận dụng TTL index để database tự động dọn rác mà không cần viết cronjob.

Database bao gồm 5 collections:
- `users`: Quản lý tài khoản, authentication và role phân quyền.
- `monitors`: Cấu hình các target endpoints cần ping định kỳ.
- `ping_metrics`: Time-Series collection lưu trữ kết quả và latency từng lượt ping.
- `incidents`: Lịch sử các đợt downtime và AI post-mortem report.
- `otp_codes`: Lưu trữ mã OTP tạm thời phục vụ luồng reset password.

---

## 2. Collection Schemas

### 2.1. Collection: users

Collection quản lý user identity và RBAC role trong hệ thống.

```json
{
  "_id": "ObjectId",
  "name": "String",
  "email": "String",
  "passwordHash": "String",
  "role": "String",
  "isVerified": "Boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Yes | Primary key của document. |
| `name` | String | Yes | Tên hiển thị của người dùng (2 - 50 ký tự). |
| `email` | String | Yes | Email duy nhất dùng để đăng nhập. |
| `passwordHash` | String | Yes | Password hash được băm bằng bcrypt. |
| `role` | String | Yes | Role phân quyền, thuộc enum cố định gồm member hoặc admin, mặc định là member. |
| `isVerified` | Boolean | Yes | Trạng thái xác thực tài khoản qua email OTP, mặc định là false. |
| `createdAt` | Date | Yes | Timestamp tạo tài khoản. |
| `updatedAt` | Date | Yes | Timestamp cập nhật thông tin tài khoản gần nhất. |

**Validation Constraints:**
- `role`: Kiểu String, enum gồm `member` và `admin`, default là `member`.
- `isVerified`: Kiểu Boolean, default là `false`.

**Indexes:**
- `{ email: 1 }`: Unique index phục vụ query đăng nhập và ngăn chặn duplicate email.

---

### 2.2. Collection: monitors

Collection lưu trữ cấu hình các endpoints được tạo bởi users.

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "name": "String",
  "url": "String",
  "method": "String",
  "headers": "Object",
  "interval": "Number",
  "isActive": "Boolean",
  "status": "String",
  "lastCheckedAt": "Date",
  "sslInfo": {
    "issuer": "String",
    "validTo": "Date",
    "daysRemaining": "Number",
    "lastCheckedAt": "Date"
  },
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Yes | Primary key của document. |
| `userId` | ObjectId | Yes | Foreign key tham chiếu đến `_id` của collection `users`. |
| `name` | String | Yes | Tên gợi nhớ của monitor. |
| `url` | String | Yes | Target URL cần theo dõi uptime. |
| `method` | String | Yes | HTTP method, hỗ trợ GET, POST hoặc HEAD. |
| `headers` | Object | No | Key-value pairs của custom HTTP request headers. |
| `interval` | Number | Yes | Chu kỳ ping tính bằng giây, nhận các giá trị 30, 60 hoặc 300. |
| `isActive` | Boolean | Yes | Flag kích hoạt (true) hoặc tạm dừng (false - pause) tiến trình ping định kỳ monitor này. |
| `status` | String | Yes | Trạng thái hiện tại của monitor, nhận giá trị up, down, pending hoặc paused (khi tạm dừng monitor). |
| `lastCheckedAt` | Date | No | Timestamp của lượt ping gần nhất. |
| `sslInfo` | Object | No | Embedded document chứa thông tin SSL certificate. |
| `createdAt` | Date | Yes | Timestamp tạo monitor. |
| `updatedAt` | Date | Yes | Timestamp cập nhật monitor. |

**Indexes:**
- `{ userId: 1 }`: Index query danh sách monitors theo user.
- `{ isActive: 1, interval: 1 }`: Compound index phục vụ scheduler query các active monitors theo interval.

---

### 2.3. Collection: ping_metrics

Time-Series collection chuyên biệt lưu trữ high-throughput ping logs.

**Time-Series Configuration:**
- `timeField`: `timestamp`
- `metaField`: `monitorId`
- `granularity`: `seconds`

```json
{
  "_id": "ObjectId",
  "timestamp": "Date",
  "monitorId": "ObjectId",
  "statusCode": "Number",
  "latency": "Number",
  "isUp": "Boolean",
  "error": "String"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Yes | Primary key tự sinh của document. |
| `timestamp` | Date | Yes | Timestamp hoàn tất lượt ping. |
| `monitorId` | ObjectId | Yes | Foreign key tham chiếu đến `_id` của `monitors`. |
| `statusCode` | Number | Yes | HTTP response status code nhận về từ target server. |
| `latency` | Number | Yes | Response time tính bằng mili giây. |
| `isUp` | Boolean | Yes | Boolean flag đánh giá target đang up hay down. |
| `error` | String | No | Error message vắn tắt nếu request gặp network failure hoặc timeout. |

**Indexes:**
- `{ monitorId: 1, timestamp: -1 }`: Compound index tối ưu query vẽ latency chart trên dashboard.
- `{ timestamp: 1 }`: TTL index với cấu hình `expireAfterSeconds: 604800` tương đương 7 ngày để database tự purge records cũ.

---

### 2.4. Collection: incidents

Collection ghi nhận lịch sử các lần downtime và AI incident post-mortem analysis.

```json
{
  "_id": "ObjectId",
  "monitorId": "ObjectId",
  "status": "String",
  "startedAt": "Date",
  "resolvedAt": "Date",
  "errorDetails": {
    "statusCode": "Number",
    "responseHeaders": "Object",
    "responseBody": "String",
    "errorMessage": "String"
  },
  "aiPostMortem": {
    "summary": "String",
    "rootCause": "String",
    "actionItems": ["String"],
    "generatedAt": "Date"
  },
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Yes | Primary key của document. |
| `monitorId` | ObjectId | Yes | Foreign key tham chiếu đến monitor gặp sự cố trong `monitors`. |
| `status` | String | Yes | Trạng thái sự cố, nhận giá trị ongoing hoặc resolved. |
| `startedAt` | Date | Yes | Timestamp bắt đầu ghi nhận sự cố. |
| `resolvedAt` | Date | No | Timestamp monitor phục hồi hoạt động bình thường. |
| `errorDetails` | Object | Yes | Raw error dump thu thập được từ failed ping request. |
| `aiPostMortem` | Object | No | Incident report được sinh tự động từ LLM API. |
| `createdAt` | Date | Yes | Timestamp tạo incident record. |
| `updatedAt` | Date | Yes | Timestamp cập nhật incident. |

**Indexes:**
- `{ monitorId: 1, startedAt: -1 }`: Compound index tra cứu incident timeline của monitor.
- `{ status: 1 }`: Query nhanh các ongoing incidents để kiểm tra điều kiện recovery.

---

### 2.5. Collection: otp_codes

Collection lưu trữ OTP tạm thời dùng cho quy trình kích hoạt tài khoản và password recovery.

```json
{
  "_id": "ObjectId",
  "email": "String",
  "codeHash": "String",
  "attempts": "Number",
  "createdAt": "Date"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Yes | Primary key của document. |
| `email` | String | Yes | Email yêu cầu xác thực hoặc reset password. |
| `codeHash` | String | Yes | Hash của mã OTP 6 chữ số để chống rò rỉ dữ liệu. |
| `attempts` | Number | Yes | Số lần nhập sai mã, tối đa 5 lần trước khi block. |
| `createdAt` | Date | Yes | Timestamp phát hành OTP. |

**Indexes:**
- `{ email: 1 }`: Index tra cứu OTP record theo email.
- `{ createdAt: 1 }`: TTL index với cấu hình `expireAfterSeconds: 300` tương đương 5 phút để MongoDB tự động xóa OTP hết hạn.

---

## 3. Data Retention and Storage Policies

- **Auto-purge qua MongoDB TTL Index:**
  - Collection `otp_codes` được cấu hình TTL index 300 giây. Khi hết hạn, background thread của MongoDB tự động xóa document mà không tốn tài nguyên của Node.js backend.
  - Collection `ping_metrics` được cấu hình TTL index 604800 giây, tương đương thời hạn lưu trữ 7 ngày. Giúp giải phóng disk storage tự động, tránh nguy cơ đầy ổ cứng VPS.
- **Tối ưu hóa nén dữ liệu Time-Series:**
  - MongoDB Time-Series Collection sử dụng columnar compression, gom các documents cùng time bucket lại để nén, giảm thiểu 70% đến 80% dung lượng đĩa so với standard collections thông thường.

---

## 4. Storage Sizing Estimation

Ước tính dung lượng lưu trữ trên VPS với kịch bản giám sát 50 monitors hoạt động liên tục:
- **Tần suất ghi:** Mỗi monitor ping trung bình mỗi 30 giây, tương đương 100 ping records mỗi phút.
- **Số lượng records mỗi ngày:** 100 records nhân 60 phút nhân 24 giờ đạt khoảng 144.000 records mỗi ngày.
- **Số lượng records trong 7 ngày retention:** Đạt xấp xỉ 1.008.000 records.
- **Kích thước trung bình một record sau khi nén Time-Series:** Khoảng 30 bytes.
- **Dung lượng raw data thực tế cho 7 ngày:** Khoảng 30MB.
- **Dung lượng indexes đi kèm:** Khoảng 20MB.
- **Tổng disk storage ước tính:** Dưới 100MB cho toàn bộ database sau một tuần hoạt động, đảm bảo an toàn tuyệt đối cho các gói VPS có ổ cứng SSD 20GB đến 25GB.

---

## 5. Write and Read Optimization Patterns

- **High-Write Batching Buffer:** Backend không gọi `db.create()` sau mỗi lượt ping. Ping metrics được push vào RAM buffer và flush định kỳ xuống MongoDB bằng một lệnh `bulkWrite` duy nhất sau mỗi 100 items hoặc 5 giây, giảm thiểu hơn 90% disk I/O.
- **Atomic Upsert cho OTP:** Khi user yêu cầu OTP mới, backend sử dụng `findOneAndUpdate` với cờ `upsert: true` để ghi đè mã OTP mới trong một atomic operation duy nhất, chống race condition.
- **Tách biệt High-Write và High-Read Collections:** Cấu hình monitors và user credentials có tần suất read cao nhưng write cực thấp, được tách biệt hoàn toàn với collection `ping_metrics` có tần suất write liên tục.
