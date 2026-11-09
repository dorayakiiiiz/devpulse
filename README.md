# DevPulse

DevPulse là nền tảng giám sát uptime và hiệu năng hệ thống theo thời gian thực. Hệ thống hỗ trợ kiểm tra định kỳ các giao thức mạng, ghi nhận sự cố, phân tích nguyên nhân bằng trí tuệ nhân tạo và xuất bản trang trạng thái dịch vụ ra bên ngoài.

---

## Features

- **Multi-Protocol Monitoring:** Kiểm tra uptime qua HTTP, HTTPS, ICMP Ping, TCP Port và DNS Query với chu kỳ cấu hình linh hoạt.
- **SSL Certificate Monitoring:** Theo dõi thời hạn chứng chỉ SSL và tự động cảnh báo trước ngày hết hạn.
- **Realtime Updates:** Cập nhật trạng thái và biểu đồ latency tức thì qua Server-Sent Events.
- **Automated Incident Management:** Tự động phát hiện downtime, tạo incident và ghi nhận timeline xử lý sự cố.
- **AI-Powered Root Cause Analysis:** Tích hợp LLM phân tích log lỗi và đề xuất nguyên nhân gốc rễ của sự cố.
- **Public Status Page:** Xuất bản trang trạng thái dịch vụ cho người dùng bên ngoài theo dõi độ khả dụng.
- **Authentication & Security:** Bảo vệ hệ thống bằng Two-Factor Authentication, JWT Access/Refresh Token và Role-Based Access Control.
- **System Administration:** Giám sát tài nguyên máy chủ gồm CPU, Memory, Disk, Event Loop và quản trị cấu hình hệ thống.

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, Lucide React.
- **Backend:** Node.js 20, Express, TypeScript, Mongoose, Vitest.
- **Database:** MongoDB 7.0.
- **Reverse Proxy & Gateway:** Nginx 1.27 Alpine.
- **DevOps & Infrastructure:** Docker, Docker Compose, GitHub Actions, Ubuntu Linux VPS.

---

## Project Structure

```text
dev-pulse/
├── .github/
│   └── workflows/
│       └── ci-cd.yml             # GitHub Actions pipeline
├── backend/
│   ├── src/
│   │   ├── config/               # Cấu hình môi trường và database
│   │   ├── controllers/          # Request handlers
│   │   ├── middlewares/          # Authentication, validation, error handler
│   │   ├── models/               # Mongoose schemas
│   │   ├── routes/               # API route definitions
│   │   ├── services/             # Core business logic và Ping Engine
│   │   └── types/                # TypeScript type definitions
│   ├── tests/                    # Unit tests và integration tests
│   ├── Dockerfile                # Multi-stage Docker build
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/           # UI components tái sử dụng
│   │   ├── pages/                # Views và routing screens
│   │   ├── services/             # Axios API client
│   │   ├── stores/               # Zustand global state
│   │   └── types/                # Frontend contracts
│   ├── tests/                    # Component tests và store tests
│   ├── deploy/nginx/             # Nginx configuration cho SPA container
│   ├── Dockerfile                # Multi-stage Docker build
│   └── package.json
├── deploy/
│   └── nginx/
│       └── gateway.conf          # Edge Gateway reverse proxy configuration
├── documents/                    # Toàn bộ tài liệu kiến trúc và hướng dẫn
├── docker-compose.yml            # Local development orchestration
└── docker-compose.prod.yml       # Production deployment orchestration
```

---

## Getting Started

### Prerequisites

- Node.js 20 trở lên
- npm 10 trở lên
- Docker Engine và Docker Compose

### Local Development

1. **Khởi chạy cơ sở dữ liệu MongoDB:**
   ```bash
   docker run -d --name devpulse-mongo -p 27017:27017 -v mongo_data:/data/db mongo:7.0
   ```

2. **Cài đặt và chạy Backend:**
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npm run dev
   ```
   Backend API lắng nghe tại `http://localhost:5000`.

3. **Cài đặt và chạy Frontend:**
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```
   Frontend Vite dev server lắng nghe tại `http://localhost:5173`.

### Running Tests

- **Backend Test Suite:** 59 tests
  ```bash
  cd backend
  npm test
  ```

- **Frontend Test Suite:** 59 tests
  ```bash
  cd frontend
  npm test
  ```

- **Strict TypeScript Type Check:**
  ```bash
  npm --prefix backend run type-check
  npm --prefix frontend run type-check
  ```

### Running with Docker Compose

Để chạy toàn bộ hệ sinh thái cục bộ trong môi trường container:
```bash
docker compose up --build -d
```

---

## CI/CD Pipeline & Deployment

Hệ thống triển khai tự động hóa thông qua GitHub Actions theo quy trình:

```text
git push origin main
         │
         ▼
┌───────────────────────────────────────────────┐
│              Quality Gate Job                 │
│  - Backend: npm ci -> type-check -> 59 tests  │
│  - Frontend: npm ci -> type-check -> 59 tests │
│  - Bundle: Frontend production build          │
└──────────────────────┬────────────────────────┘
                       │ Pass
                       ▼
┌───────────────────────────────────────────────┐
│             Build & Push Job                  │
│  - Build multi-stage Docker images            │
│  - Push image tags lên Docker Hub             │
└──────────────────────┬────────────────────────┘
                       │ Pass
                       ▼
┌───────────────────────────────────────────────┐
│               Deploy VPS Job                  │
│  - SCP docker-compose.prod.yml & gateway.conf │
│  - SSH vào VPS kéo image mới nhất             │
│  - docker compose up -d với zero downtime     │
│  - Health probe qua Nginx Gateway             │
└───────────────────────────────────────────────┘
```

### Production Access

- **Public IP:** `http://20.48.112.82`
- **Domain:** `http://devpulse.dorayakiiiiz.site`
- **Health Check Endpoint:** `http://20.48.112.82/api/health`

---

## Environment Variables

### Backend Environment

| Variable | Description | Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Môi trường thực thi | `development` / `production` |
| `PORT` | Cổng HTTP lắng nghe của Express | `5000` |
| `MONGODB_URI` | Chuỗi kết nối MongoDB | `mongodb://localhost:27017/devpulse` |
| `JWT_SECRET` | Khóa ký Access Token | Chuỗi bí mật tối thiểu 32 ký tự |
| `JWT_EXPIRES_IN` | Thời gian sống Access Token | `15m` |
| `JWT_REFRESH_SECRET` | Khóa ký Refresh Token | Chuỗi bí mật tối thiểu 32 ký tự |
| `JWT_REFRESH_EXPIRES_IN` | Thời gian sống Refresh Token | `7d` |

### Frontend Environment

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_URL` | Đường dẫn gốc gọi API Backend | `/api` |
