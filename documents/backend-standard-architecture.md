<!-- AGENT_DIRECTIVE: READ_ALLOWED -->
<!-- Options: [READ_ALLOWED | DO_NOT_READ] -->
<!-- Khi giá trị là DO_NOT_READ, các AI Agent tuyệt đối không được đọc hoặc tham chiếu file blueprint này để tránh gây nhiễu ngữ cảnh và bias -->

# Backend Standard Architecture Blueprint (MERN / PERN Stack)

Tài liệu chuẩn hóa kiến trúc backend Node.js / TypeScript theo mô hình **Layered Clean Architecture**, đóng vai trò là khuôn mẫu chuẩn (*Standard Template*) sẵn sàng tái sử dụng cho mọi dự án web hiện đại.

---

## 1. Architectural Philosophy and Design Principles

Kiến trúc tuân thủ nguyên tắc phân tách trách nhiệm (*Separation of Concerns*) và định hướng luồng thực thi một chiều nghiêm ngặt:

```
[HTTP Request]
      │
      ▼
[Routes / Middlewares]        (Routing, Auth Guard, Role Guard, Rate Limiting, Zod Validation)
      │
      ▼
[Controllers]                 (Parse inputs, Delegate to Services, Return standard HTTP response)
      │
      ▼
[Application Services]        (Business logic encapsulation, Domain rules, Integrations)
      │
      ▼
[Repositories / ORM]          (Data access abstraction, Database queries, Mongoose / Prisma)
      │
      ▼
[Database / Cache]            (MongoDB, PostgreSQL, In-Memory Cache, Redis)
```

### Nguyên tắc cốt lõi:
1. **Controller "mỏng", Service "dày":** Controller không chứa logic tính toán, không truy vấn trực tiếp cơ sở dữ liệu.
2. **Xử lý lỗi tập trung một cửa (Single Point of Error Handling):** Mọi lỗi từ validation, nghiệp vụ đến hệ thống đều được ném về middleware `errorHandler` duy nhất.
3. **Tuyệt đối an toàn kiểu dữ liệu (Strict Typing):** Không sử dụng `any`, xác thực chặt chẽ đầu vào bằng Zod và chuẩn hóa đầu ra qua `mapToDto`.
4. **Tách biệt App Configuration và Server Bootstrap:** Phân tách rõ ràng giữa `app.ts` (định nghĩa ứng dụng Express) và `server.ts` (kết nối hạ tầng và chạy mạng).

---

## 2. Directory Layout & Folder Breakdown

```text
backend/
├── src/
│   ├── config/              # Cấu hình môi trường (Zod env), kết nối Database, CORS
│   ├── controllers/         # Bộ điều hướng tiếp nhận request và gọi Service tương ứng
│   ├── middlewares/         # Middleware bảo mật, xác thực JWT, phân quyền Role, bắt lỗi, rate limit
│   ├── models/              # Định nghĩa Schema / Entity (Mongoose Models hoặc Prisma Schema)
│   ├── repositories/        # Tầng trừu tượng truy xuất dữ liệu (BaseRepository và các Entity Repositories)
│   ├── routes/              # Khai báo endpoint RESTful và gắn middleware
│   ├── schemas/             # Bộ quy tắc xác thực Zod (Validate Request Body, Query, Params)
│   ├── services/            # Chứa 100% logic nghiệp vụ cốt lõi, gửi email, hàng đợi ngầm
│   ├── types/               # Mở rộng kiểu dữ liệu TypeScript (Express Request context, DTOs)
│   ├── utils/               # Công cụ bổ trợ: response helper, appError, memory cache
│   ├── app.ts               # Khởi tạo Express app, gắn middlewares và root router
│   └── server.ts            # Entrypoint kết nối DB, lắng nghe cổng và xử lý Graceful Shutdown
├── .env                     # Biến môi trường cục bộ (tuyệt đối không commit)
├── .env.example             # File mẫu mô tả các biến môi trường cần thiết
├── Dockerfile               # Multi-stage build (Builder -> Runner tối giản trên Alpine)
├── tsconfig.json            # Cấu hình TypeScript Strict Mode (Target ES2022, NodeNext)
└── package.json
```

### Chi tiết vai trò từng thư mục:

| Thư mục | Trách nhiệm chính |
| :--- | :--- |
| **`config/`** | Xác thực biến môi trường thời điểm khởi động (`env.ts`), quản lý kết nối và ngắt kết nối cơ sở dữ liệu (`db.ts`), cấu hình CORS. |
| **`controllers/`** | Nhận `req`, bóc tách dữ liệu đã qua validate, gọi hàm tương ứng trong `services`, gửi kết quả qua `sendSuccess`. Bọc trong khối `try/catch` và đẩy lỗi qua `next(error)`. |
| **`middlewares/`** | Kiểm tra phiên đăng nhập (`authMiddleware.ts`), phân quyền vai trò (`roleMiddleware.ts`), bắt 404 (`notFoundHandler.ts`), xử lý lỗi tập trung (`errorHandler.ts`), validate Zod (`validateRequest.ts`), rate limit đa tầng (`rateLimitMiddleware.ts`). |
| **`models/`** | Khai báo cấu trúc bảng/collection, kiểu dữ liệu các cột/trường, indexes và TTL tự hủy. |
| **`repositories/`** | Đóng gói câu lệnh CRUD của ORM. Giúp tầng Service không phụ thuộc chặt vào một ORM cụ thể (dễ dàng đổi từ Mongoose sang Prisma hoặc Dapper nếu cần). |
| **`routes/`** | Ánh xạ HTTP Method và URL Path vào Controller, gắn chuỗi middleware kiểm tra quyền hạn. |
| **`schemas/`** | Viết Zod validation schemas cho từng request. |
| **`services/`** | Nơi diễn ra nghiệp vụ: băm mật khẩu, so sánh dữ liệu, tạo token, gửi email, gọi hàng đợi ngầm, tính toán chỉ số. |
| **`utils/`** | Các module độc lập: lớp lỗi `AppError`, hàm gửi JSON chuẩn `sendSuccess` / `sendError`, bộ nhớ đệm `memoryCache`. |

---

## 3. App vs. Server Separation Pattern

Việc tách rời `app.ts` và `server.ts` là tiêu chuẩn vàng của giới kiến trúc Node.js:

### 3.1. `src/app.ts` (Pure Application Instance)
* **Nhiệm vụ:** Chỉ chịu trách nhiệm khởi tạo Express instance, gắn các global middlewares (`cors`, `express.json`, `cookieParser`), gắn router `/api` và các middleware xử lý lỗi cuối pipeline.
* **Lợi ích:** File này **hoàn toàn không gọi lệnh `app.listen()`**. Nhờ vậy, khi viết Integration Test với thư viện `supertest`, test runner có thể import trực tiếp `createApp()` để gửi request ảo qua bộ nhớ máy tính mà không cần mở socket cổng mạng thật, loại bỏ hoàn toàn lỗi đụng độ port (`EADDRINUSE`).

```typescript
// src/app.ts
import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { corsOptions } from './config/cors.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(cors(corsOptions));

  app.use('/api', apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
```

### 3.2. `src/server.ts` (Runtime Bootstrap & Graceful Shutdown)
* **Nhiệm vụ:** Nạp biến môi trường, thiết lập kết nối cơ sở dữ liệu (`connectDatabase()`), gọi `createApp().listen()` và lắng nghe các tín hiệu ngắt của hệ điều hành (`SIGTERM`, `SIGINT`) để thực hiện **Graceful Shutdown** (đóng kết nối HTTP, đóng kết nối database sạch sẽ trước khi tiến trình tắt).

```typescript
// src/server.ts
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`[Server] Running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      console.log('[Server] HTTP listener closed.');
      await disconnectDatabase();
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[Server] Forceful shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('[Server] Fatal startup error:', error);
  process.exit(1);
});
```

---

## 4. Configuration & Security Hardening

### 4.1. Runtime Environment Validation (`src/config/env.ts`)
Thay vì gọi `process.env.JWT_SECRET` rải rác trong code (dễ gây crash lúc runtime nếu gõ sai chính tả hoặc quên điền `.env`), toàn bộ biến môi trường được **kiểm tra tính hợp lệ bằng Zod ngay khi ứng dụng vừa bật**:

```typescript
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Environment validation failed:', parsed.error.format());
  process.exit(1); // Ngăn server khởi động nếu thiếu biến cấu hình bắt buộc
}

export const env = parsed.data;
```

### 4.2. CORS Configuration (Cross-Origin Resource Sharing)
Thiết lập CORS bảo vệ backend khỏi các website lạ truy cập tài nguyên:
* `origin`: Hỗ trợ danh sách trắng (*Whitelist*) nhiều domain (Local, Staging, Production).
* `credentials: true`: Bắt buộc để trình duyệt gửi kèm HttpOnly Cookie qua lại giữa client và API.

**Đánh giá thực tế trong kiến trúc (Nên viết chung trong `app.ts` hay tách file riêng?):**
* **Dự án nhỏ / cá nhân:** Viết trực tiếp `app.use(cors({ origin: env.CLIENT_URL, credentials: true }))` ngay bên trong `app.ts` là phổ biến và nhanh gọn nhất.
* **Dự án thực tế / chuẩn doanh nghiệp:** **Nên tách cấu hình ra file riêng `src/config/cors.ts`** (như code bên dưới). Lý do:
  1. Hỗ trợ Whitelist động nhiều domain (localhost dev, staging, production, preview link Vercel).
  2. Xử lý logic callback origin an toàn (cho phép mobile app, Postman, server-to-server không có header origin).
  3. Cấu hình chi tiết các header cho phép, HTTP methods, và thời gian cache preflight request (`maxAge`).
  4. Giữ cho file `app.ts` tinh gọn, chỉ đóng vai trò liên kết middleware mà không bị phình to bởi các object config dài dòng.

```typescript
// src/config/cors.ts
import cors from 'cors';

const allowedOrigins = [
  'http://localhost:5173',
  'https://yourdomain.com',
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Cho phép requests không có origin (mobile apps, Postman, server-to-server) hoặc nằm trong whitelist
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true, // Cho phép truyền tải HttpOnly Cookie
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // Cache preflight OPTIONS response trong 24 giờ
};

// Gắn vào express app: app.use(cors(corsOptions));
```

---

## 5. Centralized Error Handling & Middlewares Architecture

### 5.1. Mô hình luồng xử lý lỗi tập trung (Error Flow Architecture)

Hệ thống xử lý lỗi được thiết kế theo nguyên tắc **Single Point of Return** (một điểm trả kết quả lỗi duy nhất). Toàn bộ các loại lỗi phát sinh trong suốt vòng đời của một Request đều được điều hướng về `errorHandler` trung tâm qua cơ chế `next(error)`:

```
[Request] ──► [Zod Parse Error] ─────────┐
[Request] ──► [Service throws AppError] ─┼──► next(error) ──► [errorHandler] ──► sendError() ──► [JSON Response]
[Request] ──► [Route Not Found] ─────────┘
```

#### 🔄 Phân tích chi tiết vòng đời của Request và cơ chế `next(error)`:
1. **Bản chất cơ chế nhảy cóc của Express:**
   * Trong Express pipeline, các middleware và controller thông thường đều có chữ ký 3 tham số `(req, res, next)`. Khi gọi `next()`, Express tiếp tục chuyển quyền điều khiển sang middleware tiếp theo theo thứ tự đăng ký.
   * **Khi truyền tham số vào `next(error)`:** Express sẽ lập tức **ngắt toàn bộ luồng xử lý thông thường**, bỏ qua tất cả middleware, controller và router còn lại phía sau, và lập tức "nhảy cóc" xuống thẳng middleware cuối cùng có đúng 4 tham số `(err, req, res, next)` — chính là `errorHandler`.
2. **3 nhánh phát sinh lỗi hội tụ về `errorHandler`:**
   * **Nhánh 1 - Lỗi kiểm tra dữ liệu đầu vào (`Zod Parse Error`):** Tại middleware `validateRequest`, nếu body/query/params không thỏa mãn Zod schema, hàm ném `ZodError`. Khối `catch` đón lấy và chuyển tiếp sang `next(error)`. Express ngắt pipeline và nhảy thẳng xuống `errorHandler` mà không bao giờ thực thi Controller phía sau.
   * **Nhánh 2 - Lỗi nghiệp vụ chuyên biệt (`Service throws AppError`):** Khi logic nghiệp vụ thất bại (ví dụ: email đã đăng ký, mật khẩu không đúng, tài khoản chưa kích hoạt), Service chủ động `throw new AppError(message, statusCode)`. Controller bắt được lỗi này qua `try/catch` (hoặc async wrapper) và đẩy vào `next(error)`. Toàn bộ logic tiếp theo của Controller dừng lại, Express nhảy thẳng xuống `errorHandler`.
   * **Nhánh 3 - Lỗi không tìm thấy endpoint (`Route Not Found - 404`):** Nếu client gọi một URL không khớp với bất kỳ router nào, request sẽ trôi qua hết danh sách router và rơi vào `notFoundHandler` (được đặt ngay sau `app.use('/api', apiRoutes)`). Middleware này gọi `next(new AppError('Route not found', 404))` và Express đưa ngay lỗi xuống `errorHandler`.
3. **Triệt tiêu phân mảnh phản hồi lỗi:**
   * Controller và Service **tuyệt đối không tự gọi `res.status().json()` khi phát sinh lỗi**. Toàn bộ nhiệm vụ bóc tách mã trạng thái HTTP, chuẩn hóa payload JSON `{ success: false, error, details? }` và gửi phản hồi về client đều được quy tụ duy nhất tại `errorHandler` thông qua hàm `sendError()`.

### 5.2. Lớp lỗi nghiệp vụ (`src/utils/appError.ts`)
```typescript
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
```
* **Mục đích & Thiết kế:** `AppError` kế thừa class `Error` gốc của JavaScript và bổ sung thêm thuộc tính `statusCode` (mặc định là 400).
* **Độc lập kiến trúc tầng (Layer Decoupling):** Tầng Service thuần túy chỉ xử lý logic nghiệp vụ và hoàn toàn độc lập với đối tượng `Response` của Express. Khi có lỗi, Service chỉ cần `throw new AppError(...)`. Nhờ đó Service có thể tái sử dụng trong background worker, queue task hoặc script mà không bị ràng buộc vào HTTP framework.
* **Phân biệt loại lỗi:** Giúp `errorHandler` phân biệt rõ ràng giữa lỗi nghiệp vụ đã lường trước (Operational Errors - 400, 401, 403, 404, 409, 429) và lỗi hệ thống bất thường (Programmer Errors / Crash - 500).

### 5.3. Chuẩn hóa cấu trúc phản hồi (`src/utils/response.ts`)
Toàn bộ phản hồi HTTP trả về cho Client đều tuân theo đúng 1 khuôn mẫu JSON:

```typescript
import { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, message?: string, statusCode = 200): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function sendError(res: Response, error: string, statusCode = 400, details?: unknown): Response {
  return res.status(statusCode).json({
    success: false,
    error,
    ...(details !== undefined ? { details } : {}),
  });
}
```
* **Tính nhất quán của API Contract:** Frontend chỉ cần kiểm tra cờ `response.data.success` để xác định trạng thái request, giúp việc viết Axios Interceptors hoặc React Query custom hooks trở nên đơn giản và đồng nhất trên toàn bộ ứng dụng.
* **Quy tắc phân quyền gọi hàm:**
  * `sendSuccess`: Được gọi độc quyền tại các **Controller** khi nghiệp vụ hoàn tất thành công.
  * `sendError`: Được gọi độc quyền tại **`errorHandler`**. Không một Controller hay Middleware nào khác được phép trực tiếp gọi `sendError`, bảo đảm mọi lỗi đều đi qua trạm kiểm soát trung tâm.

### 5.4. Middleware kiểm tra đầu vào Zod (`src/middlewares/validateRequest.ts`)
Ủy thác toàn bộ lỗi validate sang `errorHandler` trung tâm qua `next(error)`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';

export function validateRequest(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      next(error); // Chuyển ZodError xuống errorHandler trung tâm
    }
  };
}
```
* **Bảo vệ toàn diện 3 tầng dữ liệu:** Kiểm tra đồng thời cả 3 nguồn dữ liệu người dùng gửi lên: `req.body` (JSON payload), `req.query` (URL query parameters), và `req.params` (Route parameters).
* **Ủy thác xử lý lỗi:** Khi schema không hợp lệ, `schema.parseAsync()` quăng `ZodError`. Middleware này không tự tiện format JSON trả về mà lập tức gọi `next(error)` để chuyển `ZodError` xuống cho `errorHandler` xử lý. Nhờ vậy, cấu trúc thông báo lỗi validation trên toàn hệ thống luôn thống nhất.

### 5.5. Middleware xử lý lỗi trung tâm (`src/middlewares/errorHandler.ts`)
Là **nơi duy nhất trong backend** định dạng và trả về JSON mã lỗi:

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/appError.js';
import { sendError } from '../utils/response.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): Response {
  if (err instanceof ZodError) {
    return sendError(res, 'Validation error', 400, err.flatten().fieldErrors);
  }

  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode);
  }

  console.error('[Unhandled Server Error]', err);
  return sendError(res, err.message || 'Internal server error', 500);
}
```
* **Nhận diện Middleware Lỗi của Express:** Bắt buộc phải có đủ 4 tham số `(err, req, res, next)`. Nếu thiếu bất kỳ tham số nào (kể cả khi không dùng `next`), Express sẽ coi đó là middleware thông thường và bỏ qua khi có lỗi.
* **Cơ chế bóc tách và phân loại lỗi:**
  1. **Lỗi Zod (`err instanceof ZodError`):** Tự động bóc tách danh sách chi tiết các trường bị lỗi bằng `err.flatten().fieldErrors` (ví dụ: `{ email: ["Invalid email format"] }`) và trả về mã HTTP 400.
  2. **Lỗi Nghiệp vụ (`err instanceof AppError`):** Trả về đúng thông điệp `err.message` và mã trạng thái HTTP `err.statusCode` (400, 401, 403, 404, 409, 429) đã định nghĩa trong domain logic.
  3. **Lỗi Không lường trước (`Unhandled Error`):** Khi server gặp sự cố crash, mất kết nối DB hoặc lỗi cú pháp, ghi log đầy đủ stack trace ra terminal để lập trình viên điều tra, đồng thời trả về mã HTTP 500 kèm thông báo an toàn, ngăn chặn việc rò rỉ mã nguồn hoặc stack trace nhạy cảm ra ngoài client.

### 5.6. Middleware bảo vệ phiên đăng nhập (`src/middlewares/authMiddleware.ts`)
Kiểm tra Access Token ngắn hạn từ header `Authorization: Bearer <token>`, giải mã JWT và gán danh tính vào `req.user`:

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';
import { UserRole } from '../models/userModel.js';

interface JwtPayloadDecoded {
  id: string;
  role: UserRole;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    next(new AppError('Authentication token required', 401));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayloadDecoded;
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch {
    next(new AppError('Invalid or expired authentication token', 401));
  }
}

function extractBearerToken(authHeader?: string): string | undefined {
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return undefined;
}
```
* **Bảo mật tuyệt đối qua Memory Access Token:**
  - Xác thực nghiêm ngặt qua header `Authorization: Bearer <token>` do Client lưu trữ tạm trên RAM, hoàn toàn không đọc qua Cookie (vì Cookie được dành riêng độc quyền cho `refreshToken`).
* **Tuân thủ luồng Error Delegation:** Khi không có token hoặc token hết hạn / không hợp lệ, middleware gọi `next(new AppError(..., 401))` để đẩy sang `errorHandler`. Trả về 401 là tín hiệu tiêu chuẩn để Client Axios Interceptor tự động kích hoạt lời gọi `/api/auth/refresh-token` làm mới access token ngầm.
* **Gắn định danh người dùng (`req.user`):** Sau khi xác thực thành công, payload giải mã `{ id, role }` được gắn vào `req.user`, giúp các Controller phía sau dễ dàng truy xuất thông tin người dùng đang đăng nhập mà không cần truy vấn lại database.

### 5.7. Middleware phân quyền theo vai trò (`src/middlewares/roleMiddleware.ts`)
Sau khi request đã được `authenticate` định danh danh tính thành công, middleware `requireRole` đóng vai trò là chốt chặn ủy quyền (*Authorization Guard*) ngăn cấm các tài khoản không đủ thẩm quyền truy cập tài nguyên nhạy cảm:

```typescript
// src/middlewares/roleMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError.js';
import { UserRole } from '../models/userModel.js';

// Higher-order middleware factory linh hoạt nhận danh sách các role được phép truy cập
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Đảm bảo bắt buộc phải đi qua middleware authenticate trước đó
    if (!req.user) {
      next(new AppError('Authentication session required', 401));
      return;
    }

    // Kiểm tra vai trò của người dùng có nằm trong danh sách cấp phép hay không
    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError('Access forbidden: insufficient permissions', 403));
      return;
    }

    next();
  };
}

// Biến tiện ích dành riêng cho các tuyến đường quản trị viên (Admin only)
export const requireAdmin = requireRole('admin');
```

* **Quy tắc phân biệt mã trạng thái HTTP chuẩn mực (401 vs 403):**
  - **`401 Unauthorized`:** Dành riêng cho lỗi **Authentication (Xác thực danh tính)** — Người dùng chưa đăng nhập, gửi thiếu token hoặc token đã hết hạn.
  - **`403 Forbidden`:** Dành riêng cho lỗi **Authorization (Phân quyền truy cập)** — Người dùng đã xác thực danh tính hợp lệ (`req.user` tồn tại), nhưng vai trò hiện tại (ví dụ: `member`) không có thẩm quyền thực thi hành động này (chỉ dành cho `admin`).
* **Mẫu khai báo Router bảo vệ đa tầng (Route Declaration Pattern):**
  ```typescript
  import { Router } from 'express';
  import { authenticate } from '../middlewares/authMiddleware.js';
  import { requireRole, requireAdmin } from '../middlewares/roleMiddleware.js';

  const router = Router();

  // Tuyến đường yêu cầu đặc quyền Admin tối cao
  router.get('/admin/system-metrics', authenticate, requireAdmin, getMetrics);
  router.delete('/admin/users/:id', authenticate, requireAdmin, banUser);

  // Tuyến đường linh hoạt cấp phép cho nhiều nhóm vai trò
  router.get('/reports/summary', authenticate, requireRole('admin', 'member'), getSummary);
  ```

### 5.8. Middleware bắt tuyến đường không tồn tại (`src/middlewares/notFoundHandler.ts`)
Bắt các request 404 và ném về `errorHandler`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}
```
* **Vị trí chiến lược:** Được đặt ở cuối pipeline trong `src/app.ts`, ngay sau `app.use('/api', apiRoutes)` và ngay trước `app.use(errorHandler)`.
* **Nguyên lý:** Nếu một request gửi lên không khớp với bất kỳ route nào đã khai báo, nó sẽ trôi xuống đây. `notFoundHandler` tạo ra một `AppError` với mã 404 kèm thông tin HTTP Method và URL rồi đẩy vào `next(error)` để `errorHandler` định dạng JSON trả về chuẩn hóa.

### 5.9. Middleware giới hạn tần suất đa tầng (Multi-Layer Rate Limiting)
* **Tầng 1 (Chống spam theo IP):** Dùng `express-rate-limit` chặn dồn dập nhiều request từ cùng 1 địa chỉ IP:
  ```typescript
  import rateLimit from 'express-rate-limit';
  import { AppError } from '../utils/appError.js';

  export const otpIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 10,                   // Tối đa 10 requests
    handler: (_req, _res, next) => {
      next(new AppError('Too many requests from this IP, please try again after 15 minutes', 429));
    },
  });
  ```
  * *Giải thích:* Giới hạn số request tối đa trong khoảng thời gian cửa sổ trượt (ví dụ: tối đa 10 request / 15 phút từ 1 IP). Khi vượt ngưỡng, `handler` gọi `next(new AppError(..., 429))` để duy trì format JSON thống nhất qua `errorHandler`.
* **Tầng 2 (Cooldown theo Key trong Cache):** Áp dụng logic kiểm tra key trong cache (như `otp_cooldown:${email}` sống 60 giây) trước khi cho phép gọi thao tác tiếp theo.
  * *Giải thích:* Dùng `MemoryCacheService` hoặc Redis để kiểm tra key cooldown. Ngăn chặn người dùng spam gửi mã OTP dù họ đổi địa chỉ IP liên tục thông qua Proxy/VPN.

---

## 6. Data Access Layer & DTO Mapping

### 6.1. Generic Base Repository (`src/repositories/baseRepository.ts`)
Đóng gói các thao tác CRUD cơ bản để các repository chuyên biệt (`UserRepository`, `MonitorRepository`) kế thừa lại mà không phải viết lặp code:

```typescript
import { Model, Document, FilterQuery, UpdateQuery, QueryOptions } from 'mongoose';

export abstract class BaseRepository<T extends Document> {
  constructor(protected readonly model: Model<T>) {}

  async findOne(filter: FilterQuery<T>, options?: QueryOptions): Promise<T | null> {
    return this.model.findOne(filter, null, options).exec();
  }

  async findById(id: string, options?: QueryOptions): Promise<T | null> {
    return this.model.findById(id, null, options).exec();
  }

  async find(filter: FilterQuery<T>, options?: QueryOptions): Promise<T[]> {
    return this.model.find(filter, null, options).exec();
  }

  async create(doc: Partial<T>): Promise<T> {
    return this.model.create(doc);
  }

  async updateById(id: string, update: UpdateQuery<T>, options?: QueryOptions): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, update, { new: true, ...options }).exec();
  }

  async deleteById(id: string): Promise<T | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }
}

// Ví dụ triển khai UserRepository chuyên biệt (src/repositories/userRepository.ts)
export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return this.findOne({ email: email.toLowerCase().trim() });
  }

  // Tăng tokenVersion để vô hiệu hóa tất cả các phiên đăng nhập cũ
  async incrementTokenVersion(userId: string): Promise<IUser | null> {
    return this.updateById(userId, { $inc: { tokenVersion: 1 } });
  }
}
```

### 6.2. Mẫu thiết kế `mapToDto` (Data Transfer Object)
Tuyệt đối không trả nguyên bản MongoDB Document (chứa `passwordHash`, `__v`) về phía Client:

```typescript
private mapToDto(user: IUser): AuthUserDto {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt.toISOString(),
  };
}
```
* **Lợi ích:** 
  * Bảo mật: Không bao giờ vô tình để lộ hash mật khẩu hay token nội bộ.
  * Ổn định API Contract: Nếu database đổi tên cột, ta chỉ cần đổi mapping tại hàm này mà frontend không bị ảnh hưởng.

### 6.3. Cô lập tài nguyên & Phòng chống IDOR: Database Scoping Pattern

Trong các ứng dụng web thực tế, việc quản lý quyền sở hữu dữ liệu (*Resource Ownership & Authorization*) được phân chia thành 2 nhóm bản chất dữ liệu hoàn toàn khác biệt:

#### A. Phân biệt 2 nhóm tài nguyên trong hệ thống:

| Đặc điểm | Nhóm 1: Tài nguyên chủ thể (Self-Entities) | Nhóm 2: Tài nguyên con độc lập (Sub-Resources) |
| :--- | :--- | :--- |
| **Ví dụ endpoint** | `/api/users/profile`, `/api/users/change-password` | `/api/monitors/:id`, `/api/orders/:id`, `/api/posts/:id` |
| **Tham số URL** | **Hoàn toàn không có tham số `/:id` trên URL**. | **Chứa tham số `/:id` trên URL**. |
| **Bản chất định danh** | ID lấy trực tiếp từ JWT Token đã được xác thực (`req.user.id`). | `:id` là **Khóa chính của tài nguyên trong database** (`monitors._id`), hoàn toàn không phải `userId`. |
| **Nguy cơ bảo mật** | **Không có nguy cơ IDOR**. Người dùng chỉ có thể tự cập nhật dữ liệu của chính mình. | **Nguy cơ IDOR / BOLA rất cao** (OWASP API Top 1): User A có thể gửi request thao tác vào ID của User B. |
| **Cơ chế xử lý** | Truy vấn thẳng theo khóa chính `findById(userId)`. Không cần bất kỳ bước check quyền sở hữu nào. | **Bắt buộc áp dụng Database Scoping** để cô lập truy vấn tại tầng cơ sở dữ liệu. |

#### B. Chiến lược chuẩn mực: Database Scoping (Tenant / User Isolation)

Thay vì viết code thủ công kiểm tra xem tài nguyên có tồn tại không rồi mới so sánh quyền (dễ gây lặp code và rò rỉ mã lỗi `403`), hệ thống chuẩn SaaS **luôn luôn kẹp chặt `userId` vào điều kiện truy vấn database**:

1. **Nguyên tắc truy vấn kẹp User ID:**
   * Mọi câu query tìm kiếm, cập nhật, xóa trên tài nguyên con bắt buộc phải có điều kiện kép: `{ _id: resourceId, userId: currentUserId }`.
   * Được đóng gói thành phương thức chuyên biệt trong Repository:
     ```typescript
     // src/repositories/monitorRepository.ts
     export class MonitorRepository extends BaseRepository<IMonitor> {
       async findByIdAndUser(id: string, userId: string): Promise<IMonitor | null> {
         return this.model.findOne({
           _id: new Types.ObjectId(id),
           userId: new Types.ObjectId(userId),
         }).exec();
       }

       // Cập nhật trực tiếp 1 query duy nhất (Atomic Update)
       async updateByIdAndUser(id: string, userId: string, update: UpdateQuery<IMonitor>): Promise<IMonitor | null> {
         return this.model.findOneAndUpdate(
           { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
           update,
           { new: true }
         ).exec();
       }

       // Xóa trực tiếp 1 query duy nhất (Atomic Delete)
       async deleteByIdAndUser(id: string, userId: string): Promise<IMonitor | null> {
         return this.model.findOneAndDelete({
           _id: new Types.ObjectId(id),
           userId: new Types.ObjectId(userId),
         }).exec();
       }
     }
     ```

2. **Quy tắc phản hồi lỗi: Trả về `HTTP 404 Not Found` (OWASP Anti-Enumeration):**
   * Nếu câu lệnh query kẹp `userId` trả về `null`, hệ thống **luôn luôn ném lỗi `HTTP 404 Not Found`**:
     ```typescript
     // src/services/monitorService.ts
     async getMonitorById(userId: string, monitorId: string): Promise<MonitorResponseDto> {
       const monitor = await monitorRepository.findByIdAndUser(monitorId, userId);
       if (!monitor) {
         throw new AppError('Monitor not found', 404);
       }
       return this.mapToDto(monitor);
     }
     ```
   * **Tại sao không trả về `HTTP 403 Forbidden`?**
     * Nếu trả về `403`, hệ thống vô tình xác nhận với kẻ tấn công: *"ID này có tồn tại trong database, chỉ là bạn không có quyền xem"*. Tin tặc có thể dùng script quét vét cạn (brute-force ID) để phát hiện toàn bộ các ID hợp lệ của hệ thống (lỗ hổng Resource Enumeration).
     * Khi trả về `404`, hệ thống hoàn toàn che giấu thông tin: *"Tài nguyên này không hề tồn tại trong không gian dữ liệu của bạn"*.

3. **Tối ưu hóa hiệu năng và vòng đời Document:**
   * Khi cập nhật hoặc chuyển trạng thái, hệ thống sử dụng chính instance document đã được scoped để thay đổi trường dữ liệu và gọi `await doc.save()`:
     ```typescript
     async toggleMonitor(userId: string, monitorId: string): Promise<MonitorResponseDto> {
       const monitor = await monitorRepository.findByIdAndUser(monitorId, userId);
       if (!monitor) {
         throw new AppError('Monitor not found', 404);
       }

       monitor.isActive = !monitor.isActive;
       monitor.status = monitor.isActive ? 'pending' : 'paused';
       await monitor.save();

       return this.mapToDto(monitor);
     }
     ```
   * **Lợi ích:** Tiết kiệm 50% số câu truy vấn (chỉ tốn đúng 1 câu SELECT scoped và 1 câu UPDATE theo compound index `{ _id: 1, userId: 1 }`), đồng thời kích hoạt đầy đủ Mongoose hooks/validation và giữ cho Service layer hoàn toàn sạch sẽ, không có bất kỳ logic kiểm tra quyền lặp lại nào.

4. **Kết hợp linh hoạt giữa các phương thức thao tác dữ liệu:**
   * **Với thao tác Xóa (Delete):** Không cần quan tâm dữ liệu cũ, gọi thẳng `deleteByIdAndUser(id, userId)` qua lệnh nguyên tử `findOneAndDelete`. Tiết kiệm bộ nhớ RAM vì không cần nạp Document lên Node.js trước khi xóa (1 câu query duy nhất).
   * **Với thao tác Sửa đơn giản (Direct / Atomic Update):** Khi chỉ cập nhật các trường độc lập (ví dụ: đổi tên, cập nhật ghi chú, tăng giảm số đếm `$inc`) mà không cần so sánh dữ liệu cũ hay kích hoạt side-effect phức tạp, gọi thẳng `updateByIdAndUser(id, userId, updatePayload)` qua `findOneAndUpdate`. Chỉ tốn đúng **1 câu query duy nhất** và trả về document mới ngay lập tức mà không cần nạp document lên trước.
   * **Với thao tác Sửa phức tạp (Conditional / State-dependent Update):** Dùng `findByIdAndUser` bốc Document lên RAM khi cần so sánh dữ liệu cũ với dữ liệu mới (ví dụ: phát hiện URL thay đổi để kích hoạt quét lại SSL, đảo cờ `isActive = !isActive`), sau đó gọi `doc.save()`.

---

## 7. Authentication & Account Management Blueprint

Bộ tính năng nền tảng dùng chung cho mọi dự án web thương mại và doanh nghiệp:

### 7.1. Kiến trúc Dual Token (Access Token trên RAM + Refresh Token trong HttpOnly Cookie)

Hệ thống áp dụng mô hình **Dual Token kết hợp Token Rotation và Token Version Invalidation**:

```
[Client (RAM)] ────► [Authorization: Bearer <accessToken> (15m)] ────► [Protected API Route]
     ▲                                                                           │ (401 Expired)
     │                                                                           ▼
[Client (RAM)] ◄─── [POST /api/auth/refresh-token] ◄── [Cookie: refreshToken (7d)] ──┘
                      (Verify tokenVersion & Rotate Token Pair)
```

* **Access Token (Ngắn hạn - 15 phút):**
  * Lưu trữ hoàn toàn trên **bộ nhớ tạm (RAM)** của ứng dụng Client (React/Vue/Mobile state).
  * Gửi kèm qua header `Authorization: Bearer <accessToken>` cho mỗi request được bảo vệ.
  * *Lợi ích:* Kể cả khi trang web bị tấn công XSS, tin tặc không thể tìm thấy token trong `localStorage`, và token trong RAM cũng sẽ tự động hết hạn sau 15 phút.
* **Refresh Token (Dài hạn - 7 ngày):**
  * Lưu trữ trong **HttpOnly Cookie** với các cờ bảo vệ nghiêm ngặt:
    ```typescript
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,                               // Chống JavaScript/XSS đọc trộm
      secure: env.NODE_ENV === 'production',        // Chỉ truyền qua HTTPS trên production
      sameSite: 'strict',                           // Chống tấn công CSRF
      path: '/',                                    // Khả dụng trên toàn bộ API
      maxAge: 7 * 24 * 60 * 60 * 1000,              // 7 ngày
    });
    ```
* **Cơ chế Token Rotation:** Mỗi khi Client gọi endpoint `/api/auth/refresh-token`, Backend không chỉ cấp Access Token mới mà còn **sinh Refresh Token mới và ghi đè cookie** để liên tục làm mới vòng đời phiên làm việc.
* **Cơ chế Token Version Invalidation (Thu hồi phiên tức thì):**
  * Model `User` lưu thêm trường `tokenVersion: number` (mặc định = 0).
  * Refresh Token nhúng payload `{ id: userId, tokenVersion }`.
  * **Khi nào `tokenVersion` được sử dụng và gọi tới?**
    * `tokenVersion` được kiểm tra **mỗi khi Client gọi endpoint `/api/auth/refresh-token`** để đối chiếu với database.
    * `tokenVersion` **chỉ được tăng lên (`+1`)** trong các trường hợp cần thu hồi quyền truy cập khẩn cấp:
      1. Người dùng đổi mật khẩu (`changePassword`) hoặc khôi phục mật khẩu (`resetPassword`).
      2. Người dùng chọn tính năng "Đăng xuất khỏi tất cả các thiết bị" (Logout All Devices).
      3. Quản trị viên (Admin) chủ động khóa/vô hiệu hóa tài khoản của người dùng.
    * Khi `tokenVersion` tăng lên, mọi Refresh Token cũ mang phiên bản trước đó sẽ lập tức bị lệch và bị từ chối với mã HTTP 401.

### 7.2. Danh sách toàn bộ các phương thức Auth cần triển khai (`AuthService` & `AuthController`)

| Phương thức | Luồng xử lý chi tiết | Mã trả về |
| :--- | :--- | :--- |
| **`register(data)`** | 1. Chuẩn hóa email lowercase.<br>2. Kiểm tra nếu email đã tồn tại và `isVerified === true` $\rightarrow$ ném lỗi 409.<br>3. Kiểm tra cooldown 60s trong cache $\rightarrow$ nếu vi phạm ném lỗi 429.<br>4. Băm mật khẩu bằng bcrypt (salt 10).<br>5. Nếu tài khoản chưa verify thì cập nhật lại thông tin; nếu chưa có thì tạo mới với `isVerified: false`, `tokenVersion: 0`.<br>6. Sinh mã OTP 6 số ngẫu nhiên, băm bcrypt, upsert vào `otp_codes` (TTL 300s).<br>7. Lưu cooldown 60s vào cache và đẩy tác vụ gửi email OTP vào hàng đợi ngầm.<br>8. Trả về thông báo yêu cầu nhập mã OTP xác thực. | `201 Created` |
| **`verifyEmail(data)`** | 1. Chuẩn hóa email, kiểm tra xem có đang bị khóa 1 giờ trong cache không (`otp_lockout`) $\rightarrow$ ném lỗi 429.<br>2. Tìm user trong DB $\rightarrow$ nếu không có báo 404, nếu đã verify báo 400.<br>3. Tìm bản ghi OTP trong DB $\rightarrow$ nếu không thấy báo 400.<br>4. So khớp mã OTP bằng bcrypt $\rightarrow$ nếu sai tăng `attempts` thêm 1. Nếu `nextAttempts >= 5` $\rightarrow$ xóa OTP, đặt khóa 1 giờ trong cache và ném lỗi 429.<br>5. Nếu đúng $\rightarrow$ gọi `userRepository.markVerified()`, xóa bản ghi OTP.<br>6. Ký cặp token (`accessToken` 15m, `refreshToken` 7d kèm `tokenVersion`), set HttpOnly Cookie `refreshToken` và trả về `{ user, accessToken }` trong response body. | `200 OK` |
| **`resendVerificationOtp(email)`** | 1. Kiểm tra khóa 1 giờ và cooldown 60s trong cache $\rightarrow$ nếu vi phạm ném lỗi 429.<br>2. Tìm user trong DB $\rightarrow$ nếu không thấy báo 404, nếu đã verify báo 400.<br>3. Sinh OTP 6 số mới, băm bcrypt, upsert vào `otp_codes` (TTL 300s).<br>4. Ghi nhận cooldown 60s và đẩy tác vụ gửi email OTP vào hàng đợi ngầm. | `200 OK` |
| **`login(data)`** | 1. Chuẩn hóa email, tìm user trong DB $\rightarrow$ nếu không thấy báo 401.<br>2. So khớp mật khẩu bằng bcrypt $\rightarrow$ nếu sai báo 401.<br>3. Kiểm tra cờ `isVerified` $\rightarrow$ nếu false ném lỗi 403 yêu cầu kích hoạt tài khoản.<br>4. Ký cặp token (`accessToken` 15m, `refreshToken` 7d kèm `tokenVersion`), set HttpOnly Cookie `refreshToken` và trả về `{ user, accessToken }` trong response body. | `200 OK` |
| **`refreshAccessToken()`** | 1. Đọc cookie `refreshToken` từ request $\rightarrow$ nếu thiếu báo 401.<br>2. Giải mã và kiểm tra chữ ký `JWT_REFRESH_SECRET` (bọc try/catch phạm vi verify) $\rightarrow$ nếu lỗi báo 401.<br>3. Tìm user theo `decoded.id` $\rightarrow$ nếu không thấy báo 401, nếu chưa verify báo 403.<br>4. So khớp `decoded.tokenVersion === user.tokenVersion` $\rightarrow$ nếu lệch báo 401 (phiên đã bị thu hồi).<br>5. Thực thi Token Rotation: Sinh cặp token mới, ghi đè cookie `refreshToken` và trả về `{ user, accessToken }`. | `200 OK` |
| **`logout()`** | 1. Gọi `res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions)`.<br>2. Trả về thông báo đăng xuất thành công. | `200 OK` |
| **`getCurrentUser(userId)`** | 1. Nhận `req.user.id` từ middleware `authenticate` (sau khi verify Bearer token).<br>2. Tìm user trong DB $\rightarrow$ nếu không thấy báo 401.<br>3. Trả về user DTO qua `mapToDto`. | `200 OK` |
| **`requestPasswordReset(email)`** | 1. Chuẩn hóa email, kiểm tra khóa 1 giờ và cooldown 60s $\rightarrow$ nếu vi phạm ném lỗi 429.<br>2. Tìm user trong DB $\rightarrow$ nếu không thấy báo thẳng 404 (Fail Fast).<br>3. Sinh mã OTP 6 số, băm bcrypt, upsert vào `otp_codes` (TTL 300s).<br>4. Ghi nhận cooldown 60s vào cache và đẩy tác vụ gửi email OTP vào hàng đợi ngầm. | `200 OK` |
| **`resetPassword(data)`** | 1. Kiểm tra khóa 1 giờ trong cache $\rightarrow$ nếu vi phạm ném lỗi 429.<br>2. Tìm user trong DB $\rightarrow$ nếu không thấy báo 404 (Fail Fast).<br>3. Tìm bản ghi OTP trong DB $\rightarrow$ nếu không thấy báo 400.<br>4. So khớp mã OTP bằng bcrypt $\rightarrow$ nếu sai tăng `attempts` thêm 1. Nếu `nextAttempts >= 5` $\rightarrow$ xóa OTP, đặt khóa 1 giờ trong cache và ném lỗi 429.<br>5. Băm mật khẩu mới bằng bcrypt (salt 10).<br>6. Cập nhật `passwordHash` mới, **tăng `tokenVersion` lên 1** (`incrementTokenVersion`) để vô hiệu hóa toàn bộ refresh token cũ trên mọi thiết bị, xóa bản ghi OTP và trả về thông báo thành công. | `200 OK` |

### 7.3. Danh sách toàn bộ các phương thức User Management (`UserService` & `UserController`)

| Phương thức | Luồng xử lý chi tiết | Mã trả về |
| :--- | :--- | :--- |
| **`getUserProfile(userId)`** | 1. Tìm user theo `userId` $\rightarrow$ nếu không thấy báo 404.<br>2. Trả về thông tin hồ sơ tài khoản qua `mapToDto`. | `200 OK` |
| **`updateProfile(userId, data)`** | 1. Validate `name` từ 2 đến 50 ký tự.<br>2. Gọi `userRepository.updateName(userId, name)`.<br>3. Trả về thông tin hồ sơ đã cập nhật. | `200 OK` |
| **`changePassword(userId, data)`** | 1. Tìm user theo `userId` $\rightarrow$ nếu không thấy báo 404.<br>2. So khớp `currentPassword` với `passwordHash` bằng bcrypt $\rightarrow$ nếu sai báo lỗi 400.<br>3. Băm `newPassword` bằng bcrypt (salt 10).<br>4. Cập nhật `passwordHash` mới vào DB.<br>5. **Gọi `userRepository.incrementTokenVersion(userId)`** để vô hiệu hóa toàn bộ Refresh Token cũ trên tất cả các thiết bị. | `200 OK` |
| **`deleteAccount(userId, password)`** | 1. Tìm user theo `userId` $\rightarrow$ nếu không thấy báo 404.<br>2. So khớp `password` xác nhận với `passwordHash` bằng bcrypt $\rightarrow$ nếu sai báo lỗi 400.<br>3. Xóa bản ghi user trong DB.<br>4. Xóa cookie `refreshToken` tại trình duyệt để hủy phiên đăng nhập tức thì. | `200 OK` |

---

### 7.4. Lộ trình nâng cấp: Từ Token Version lên Bảng Refresh Token hoặc Redis

Giải pháp `tokenVersion` là phương án cực kỳ tinh gọn, hiệu quả cao cho dự án vừa và nhỏ vì không phát sinh thêm collection. Tuy nhiên, khi sản phẩm phát triển lên quy mô Enterprise và cần tính năng **Quản lý đa thiết bị (Active Sessions list - xem danh sách thiết bị đang đăng nhập, IP, trình duyệt)** hoặc **Phát hiện tái sử dụng Token (Reuse Detection)**, ta nâng cấp theo 1 trong 2 giải pháp sau:

#### 🚀 Tùy chọn 1: Lưu Bảng `refresh_tokens` trong MongoDB (Chuẩn Stateful Session)

Tạo collection `refresh_tokens` có đánh TTL Index tự động dọn rác và lưu thông tin thiết bị:

```typescript
// src/models/refreshTokenModel.ts
import { Schema, model, Document, Types } from 'mongoose';

export interface IRefreshToken extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL Index: MongoDB tự động xóa document khi đến thời điểm expiresAt
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model<IRefreshToken>('RefreshToken', refreshTokenSchema, 'refresh_tokens');
```

```typescript
// src/repositories/refreshTokenRepository.ts
import crypto from 'crypto';
import { BaseRepository } from './baseRepository.js';
import { IRefreshToken, RefreshTokenModel } from '../models/refreshTokenModel.js';

export class RefreshTokenRepository extends BaseRepository<IRefreshToken> {
  constructor() {
    super(RefreshTokenModel);
  }

  // Băm token SHA-256 trước khi lưu để bảo mật DB
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async createToken(userId: string, token: string, ttlDays = 7, userAgent?: string, ipAddress?: string): Promise<IRefreshToken> {
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    return this.create({
      userId: userId as any,
      tokenHash: this.hashToken(token),
      userAgent,
      ipAddress,
      expiresAt,
    });
  }

  async findValidToken(token: string): Promise<IRefreshToken | null> {
    const tokenHash = this.hashToken(token);
    return this.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  }

  async deleteToken(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await this.model.deleteOne({ tokenHash }).exec();
  }

  async deleteAllUserTokens(userId: string): Promise<void> {
    await this.model.deleteMany({ userId }).exec();
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
```

* **Ưu điểm của Bảng Refresh Token:**
  1. Cho phép hiển thị danh sách các máy đang đăng nhập (`find({ userId })`) kèm IP và tên trình duyệt.
  2. Hỗ trợ nút "Đăng xuất khỏi thiết bị này" (`deleteToken`) hoặc "Đăng xuất khỏi mọi thiết bị" (`deleteAllUserTokens`).
  3. Tự động dọn rác 100% nhờ MongoDB TTL Index.

---

#### ⚡ Tùy chọn 2: Quản lý Refresh Token trên Redis (Tốc độ tối đa < 1ms)

Đối với hệ thống hàng trăm ngàn lượt người dùng trực tuyến, lưu Refresh Token trên Redis giúp giảm tải hoàn toàn cho database chính:

```typescript
// src/services/redisTokenService.ts
import Redis from 'ioredis';
import { env } from '../config/env.js';

export class RedisTokenService {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  // Lưu refresh token vào Redis với TTL 7 ngày (604800 giây)
  async saveRefreshToken(userId: string, tokenId: string, ttlSeconds = 7 * 86400): Promise<void> {
    const key = `refresh_token:${userId}:${tokenId}`;
    await this.redis.set(key, 'valid', 'EX', ttlSeconds);
  }

  // Kiểm tra tính hợp lệ của Refresh Token
  async isTokenValid(userId: string, tokenId: string): Promise<boolean> {
    const key = `refresh_token:${userId}:${tokenId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  // Xóa 1 refresh token cụ thể (Đăng xuất thiết bị hiện tại)
  async revokeToken(userId: string, tokenId: string): Promise<void> {
    const key = `refresh_token:${userId}:${tokenId}`;
    await this.redis.del(key);
  }

  // Xóa toàn bộ token của User (Đăng xuất khỏi tất cả các thiết bị)
  async revokeAllUserSessions(userId: string): Promise<void> {
    const pattern = `refresh_token:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

export const redisTokenService = new RedisTokenService();
```

---

## 8. Caching Strategies: In-Memory vs. Distributed Cache

### 8.1. In-Memory Cache với Node-Cache (Đã cài đặt)
* **Ưu điểm:** Cực kỳ nhẹ, đọc dữ liệu từ chính RAM tiến trình Node.js với độ trễ siêu tốc (**< 1ms**), không tốn chi phí round-trip qua mạng, không tốn tài nguyên cài đặt server ngoài.
* **Phù hợp:** Ứng dụng chạy trên 1 VPS đơn lẻ, quy mô vừa và nhỏ.

#### 🛡️ Triển khai đầy đủ lớp `MemoryCacheService` chống Cache Stampede:

```typescript
// src/utils/cache.ts
import NodeCache from 'node-cache';

export class MemoryCacheService {
  private readonly cache: NodeCache;
  private readonly pendingPromises = new Map<string, Promise<unknown>>();

  constructor(defaultTtlSeconds = 30, checkPeriodSeconds = 60) {
    this.cache = new NodeCache({
      stdTTL: defaultTtlSeconds,
      checkperiod: checkPeriodSeconds,
    });
  }

  // Đọc dữ liệu từ cache
  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  // Kiểm tra sự tồn tại của key
  has(key: string): boolean {
    return this.cache.has(key);
  }

  // Lưu dữ liệu vào cache với thời gian sống TTL tùy chọn
  set<T>(key: string, value: T, ttlSeconds?: number): boolean {
    return ttlSeconds !== undefined ? this.cache.set(key, value, ttlSeconds) : this.cache.set(key, value);
  }

  // Xóa một hoặc nhiều key khỏi cache
  del(key: string | string[]): number {
    return this.cache.del(key);
  }

  // Xóa sạch toàn bộ bộ nhớ đệm
  flush(): void {
    this.cache.flushAll();
    this.pendingPromises.clear();
  }

  // Lấy dữ liệu từ cache hoặc thực thi hàm nạp dữ liệu với cơ chế khử trùng lặp (Anti-Stampede)
  async getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Tái sử dụng Promise đang chạy nếu có request khác đang chờ kết quả cùng key
    const inFlight = this.pendingPromises.get(key) as Promise<T> | undefined;
    if (inFlight) {
      return inFlight;
    }

    const executionPromise = (async () => {
      try {
        const result = await fetchFn();
        this.set(key, result, ttlSeconds);
        return result;
      } finally {
        this.pendingPromises.delete(key);
      }
    })();

    this.pendingPromises.set(key, executionPromise);
    return executionPromise;
  }
}

export const memoryCache = new MemoryCacheService();
```

### 8.2. Khi nào nên nâng cấp lên Distributed Cache (Redis)?
Khi ứng dụng mở rộng chạy trên **nhiều container / nhiều server VPS chạy song song (Horizontal Scaling)**:
* Lúc này RAM của mỗi server là độc lập. Người dùng đăng nhập ở Server A nhưng gửi request tiếp theo chạm vào Server B thì Server B không có cache $\rightarrow$ Bắt buộc phải dựng **Redis Cache tập trung** để toàn bộ cụm server cùng truy xuất chung một kho RAM.

```typescript
// Mẫu code nếu chuyển đổi sang Redis (ioredis)
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL!);

export async function getOrSetRedis<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds = 60): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const freshData = await fetchFn();
  await redis.set(key, JSON.stringify(freshData), 'EX', ttlSeconds);
  return freshData;
}
```

---

## 9. Asynchronous Task Processing: In-Memory vs. Distributed Message Queues

Gửi email qua giao thức SMTP hoặc gọi LLM AI API là các tác vụ mạng tốn từ 2 đến 10 giây. **Tuyệt đối không được thực thi đồng bộ làm nghẽn luồng API chính**.

### 9.1. In-Memory Task Queue với `async.queue` (Đang triển khai)
* **Cơ chế:** Quản lý hàng đợi và nhóm worker chạy ngầm ngay trên Event Loop của Node.js.
* **Concurrency Control = 2:** Cố định chỉ cho phép tối đa 2 kết nối gửi mail cùng lúc, chống cạn kiệt socket mạng của máy chủ.
* **Exponential Backoff Retry:** Tự động thử lại tối đa 3 lần với khoảng cách chờ giãn dần (2s, 4s, 8s).
* **Phù hợp:** Ứng dụng chạy trên 1 VPS, lượng email dưới vài ngàn thư mỗi ngày, giúp tiết kiệm 100MB RAM do không cần cài Redis.

```typescript
// src/services/emailService.ts
this.queue = async.queue<EmailTask>(async (task) => {
  await this.processWithRetry(task);
}, 2); // Concurrency = 2
```

### 9.2. Khi nào cần nâng cấp lên Distributed Queue (BullMQ / RabbitMQ)?

| Tiêu chí | In-Memory Task Queue (`async.queue`) | BullMQ (Redis) / RabbitMQ |
| :--- | :--- | :--- |
| **Tính bền vững dữ liệu** | Kém: Khi server crash hoặc deploy code mới, các job đang xếp hàng trong RAM sẽ bị mất. | Tuyệt đối: Job được ghi vào đĩa của Redis/RabbitMQ. Server có sập thì khi bật lại vẫn chạy tiếp. |
| **Khả năng mở rộng** | Chỉ chạy nội bộ trong 1 tiến trình Node.js duy nhất. | Phân tán: Có thể dựng 10 server Worker riêng biệt chuyên rút job từ Redis về xử lý tải nặng. |
| **Tính năng cao cấp** | Retry đơn giản, giới hạn luồng cơ bản. | Delay job, Cron repeatable job, Dead-letter queue (hàng đợi thư chết), Web UI Dashboard giám sát. |
| **Ngữ cảnh sử dụng** | Gửi OTP, email kích hoạt tài khoản, thông báo sự cố trong SaaS vừa và nhỏ. | Hệ thống bán vé Flash Sale (**TicketBox**), hệ thống thanh toán ngân hàng, xử lý video nặng. |

---

---

## 10. Realtime Event Streaming Architecture: Server-Sent Events (SSE) vs. WebSockets

Trong các hệ thống giám sát hạ tầng (APM / Uptime Monitoring), dữ liệu cần được đẩy tức thời (Push) từ máy chủ xuống trình duyệt (ví dụ: kết quả ping thời gian thực, cảnh báo sự cố sập web, phân tích nguyên nhân sự cố AI). Việc lựa chọn giao thức truyền tin thời gian thực đóng vai trò sống còn đối với hiệu năng hệ thống, đặc biệt trong môi trường máy chủ hạn chế tài nguyên (VPS 1 vCPU, 1GB RAM).

### 10.1. So sánh chi tiết kỹ thuật: SSE vs. WebSockets vs. Short Polling

| Tiêu chí | Server-Sent Events (SSE) | WebSockets (WS) | Short Polling (HTTP GET định kỳ) |
| :--- | :--- | :--- | :--- |
| **Chiều truyền tin** | **Một chiều (Unidirectional):** Server $\rightarrow$ Client | **Hai chiều (Bidirectional):** Server $\longleftrightarrow$ Client | Giả lập (Client liên tục kéo dữ liệu) |
| **Giao thức mạng** | Chuẩn **HTTP/1.1** hoặc **HTTP/2** thuần túy | Chuyển đổi giao thức riêng (TCP Upgrade qua `ws://` hoặc `wss://`) | HTTP/1.1 hoặc HTTP/2 tiêu chuẩn |
| **Mức chiếm dụng RAM (VPS 1GB)** | **Cực thấp:** Tái sử dụng HTTP connection pool, không cần buffer frame nhị phân | **Cao:** Duy trì socket TCP hai chiều, thư viện ngoài (`ws`, `socket.io`) tốn RAM | **Cao đột biến:** Bão HTTP handshake gây tắc nghẽn CPU và Socket |
| **Tự động kết nối lại** | **Tự động tích hợp sẵn:** Trình duyệt (`EventSource`) tự động retry khi mất mạng | **Phải tự code:** Phải tự quản lý timer reconnect và exponential backoff | Tự chạy theo `setInterval` |
| **Vượt tường lửa & Nginx Proxy** | **100% thân thiện:** Đi qua Port 80/443 tiêu chuẩn, không bị chặn bởi corporate proxy | Phải cấu hình Nginx riêng (`proxy_set_header Upgrade $http_upgrade`) | Thân thiện |
| **Ngữ cảnh sử dụng tối ưu** | **Dashboard giám sát, Live log streaming, AI Chatbot token streaming, Thông báo đẩy** | Chat 2 chiều thời gian thực (Messenger), Game online nhiều người chơi | Polling dự phòng khi các giao thức khác bị chặn |

> **Quyết định kiến trúc:** Với bài toán của DevPulse (chỉ cần đẩy trạng thái ping và cảnh báo sự cố một chiều từ máy chủ xuống Dashboard), **Server-Sent Events (SSE) là sự lựa chọn số 1 về mặt kỹ thuật**, giúp tiết kiệm tài nguyên bộ nhớ tối đa và hoạt động mượt mà qua các lớp Nginx reverse proxy.

---

### 10.2. Giải quyết rào cản xác thực của Native Browser `EventSource`

API chuẩn `window.EventSource` của trình duyệt **hoàn toàn không hỗ trợ gắn custom HTTP headers** (như `Authorization: Bearer <token>`). Do đó, middleware xác thực [`src/middlewares/authMiddleware.ts`](src/middlewares/authMiddleware.ts) phải hỗ trợ bóc tách Access Token linh hoạt từ cả Header lẫn Query Parameter:

```typescript
// Trích đoạn src/middlewares/authMiddleware.ts
function extractToken(req: Request): string | null {
  // 1. Kiểm tra Authorization header thông thường (Bearer <token>)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 2. Dự phòng: Kiểm tra Query Parameter (?token=...) chuyên biệt cho EventSource
  if (req.query && typeof req.query.token === 'string') {
    return req.query.token;
  }

  return null;
}
```

---

### 10.3. Bộ điều hướng luồng dữ liệu SSE (`src/controllers/sseController.ts`)

Endpoint `GET /api/sse/monitors` thiết lập kết nối streaming liên tục với các headers đặc biệt:

```typescript
import { Request, Response } from 'express';
import { realtimeService, SseConnectedEvent } from '../services/realtimeService.js';

// Establish persistent Server-Sent Events stream for authenticated client
export function subscribeMonitors(req: Request, res: Response): void {
  const userId = req.user!.id;

  // 1. Thiết lập các HTTP Headers bắt buộc cho chuẩn SSE W3C
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  
  // 2. Vô hiệu hóa tính năng đệm của Nginx Reverse Proxy (Bắt buộc)
  res.setHeader('X-Accel-Buffering', 'no');

  // 3. Giữ kết nối socket mở vô hạn, không bị timeout bởi Node.js HTTP server
  req.socket.setKeepAlive(true);
  req.socket.setTimeout(0);

  // 4. Xả ngay headers ban đầu về trình duyệt để hoàn tất bắt tay (Handshake)
  res.flushHeaders();

  // 5. Đăng ký Response stream vào Connection Pool quản lý trên RAM
  realtimeService.addConnection(userId, res);

  // 6. Gửi sự kiện mở đầu xác nhận kết nối thành công
  const initialPayload: SseConnectedEvent = {
    type: 'CONNECTED',
    userId,
    connectedAt: new Date().toISOString(),
  };
  res.write(`event: CONNECTED\ndata: ${JSON.stringify(initialPayload)}\n\n`);

  // 7. Lắng nghe sự kiện ngắt kết nối khi người dùng tắt tab để dọn dẹp RAM O(1)
  req.on('close', () => {
    realtimeService.removeConnection(userId, res);
  });
}
```

#### 🔄 Giải thích chi tiết các cờ kỹ thuật:
- **`X-Accel-Buffering: no`:** Báo cho Nginx không được tích lũy dữ liệu vào bộ đệm (buffer) mà phải đẩy từng frame tức thì về trình duyệt người dùng.
- **`res.flushHeaders()`:** Gửi ngay lập tức status code `HTTP 200 OK` và headers về client. Nếu không gọi hàm này, trình duyệt sẽ bị treo ở trạng thái Pending cho đến khi có dòng dữ liệu đầu tiên được ghi.
- **`req.socket.setTimeout(0)`:** Vô hiệu hóa socket timeout mặc định (thường là 120s trong Node.js) để duy trì kênh truyền phát mở liên tục nhiều giờ.

---

### 10.4. Quản lý Bể chứa Kết nối trên RAM & Heartbeat Timer (`src/services/realtimeService.ts`)

Lớp `RealtimeService` quản lý toàn bộ các client đang kết nối trên bộ nhớ RAM bằng cấu trúc dữ liệu `Map<string, Set<Response>>`:

```typescript
import { Response } from 'express';
import { eventBus, PingCompletedEvent, IncidentAlertEvent } from '../utils/eventBus.js';

export class RealtimeService {
  // Ánh xạ userId -> Tập hợp các kết nối Response (1 user có thể mở nhiều tab trình duyệt cùng lúc)
  private connections: Map<string, Set<Response>> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs = 30000; // Định kỳ 30 giây

  constructor() {
    this.registerEventBusListeners();
    this.startHeartbeat();
  }

  // Đăng ký nhận sự kiện từ Event Bus nội bộ của hệ thống
  private registerEventBusListeners(): void {
    eventBus.onPingCompleted((payload: PingCompletedEvent) => {
      this.broadcastMonitorPing(payload);
    });

    eventBus.onIncidentAlert((payload: IncidentAlertEvent) => {
      this.broadcastIncidentAlert(payload);
    });
  }

  // Thêm kết nối mới vào Connection Pool
  addConnection(userId: string, res: Response): void {
    let clientSet = this.connections.get(userId);
    if (!clientSet) {
      clientSet = new Set<Response>();
      this.connections.set(userId, clientSet);
    }
    clientSet.add(res);
  }

  // Xóa kết nối khi client ngắt và giải phóng Set rỗng để chống rò rỉ RAM (Memory Leak)
  removeConnection(userId: string, res: Response): void {
    const clientSet = this.connections.get(userId);
    if (!clientSet) return;

    clientSet.delete(res);
    if (clientSet.size === 0) {
      this.connections.delete(userId);
    }
  }

  // Bắn sự kiện Ping Metric tức thời xuống toàn bộ tab của User sở hữu Monitor đó
  broadcastMonitorPing(payload: PingCompletedEvent): void {
    const clientSet = this.connections.get(payload.userId);
    if (!clientSet || clientSet.size === 0) return;

    const eventString = `event: MONITOR_PING\ndata: ${JSON.stringify(payload)}\n\n`;
    clientSet.forEach((res) => res.write(eventString));
  }

  // Định kỳ gửi comment heartbeat chống Nginx 504 Gateway Timeout
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      // Chuẩn W3C SSE: Dòng bắt đầu bằng dấu hai chấm (:) là Comment, trình duyệt sẽ tự động bỏ qua
      const heartbeatComment = ': heartbeat\n\n';
      this.connections.forEach((clientSet) => {
        clientSet.forEach((res) => res.write(heartbeatComment));
      });
    }, this.heartbeatIntervalMs);

    this.heartbeatTimer.unref(); // Không chặn tiến trình Node.js thoát khi tắt server
  }
}

export const realtimeService = new RealtimeService();
```

#### 🛡️ Cơ chế Heartbeat Comment (`: heartbeat\n\n`):
Nginx và các Cloud Load Balancer (AWS ALB, Cloudflare) thường có cấu hình `proxy_read_timeout` mặc định là **60 giây**. Nếu trong 60 giây mà server không phát sinh sự kiện nào, Nginx sẽ tự động ngắt kết nối và trả về lỗi `HTTP 504 Gateway Timeout`.

Bằng cách gửi định kỳ mỗi 30 giây một chuỗi comment `: heartbeat\n\n`, luồng socket mạng luôn phát sinh byte truyền nhận để giữ kết nối sống (Keep-Alive), trong khi trình duyệt hoàn toàn phớt lờ dòng comment này mà không kích hoạt bất kỳ handler JavaScript thừa thãi nào.

---

## 11. Reusable Project Bootstrap Checklist

Khi bắt đầu một dự án Backend mới theo khuôn mẫu này, hãy thực hiện theo thứ tự:

1. **Khởi tạo môi trường:** Cấu hình `tsconfig.json` (Strict Mode), `.gitignore`, `.env.example`.
2. **Khai báo `config/env.ts`:** Dùng Zod định nghĩa toàn bộ biến môi trường cần thiết ngay từ ngày đầu.
3. **Cài đặt xử lý lỗi:** Tạo `appError.ts`, `response.ts`, `validateRequest.ts` và `errorHandler.ts`.
4. **Tách biệt `app.ts` và `server.ts`:** Gắn router, cors, cookie-parser và graceful shutdown.
5. **Dựng tầng Data Access:** Tạo `BaseRepository<T>` cho ORM được chọn.
6. **Xây dựng module Auth & User:** Tận dụng lại 100% logic JWT HttpOnly Cookie, OTP 2 tầng, lockout 1 giờ và `mapToDto`.
7. **Đóng gói Docker:** Viết Dockerfile multi-stage production và `docker-compose.yml` cho database local.
