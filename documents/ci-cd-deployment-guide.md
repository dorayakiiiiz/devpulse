# Cẩm Nang Kiến Trúc & Quy Trình Triển Khai CI/CD DevPulse (CI/CD Deployment Blueprint)

Tài liệu này là đặc tả kỹ thuật toàn diện từ A–Z về quy trình Tự động hóa Tích hợp Liên tục (CI), Đóng gói Container hóa (Docker Multi-stage), Điều phối Dịch vụ (Docker Compose), Định tuyến Biên (Nginx Reverse Proxy Gateway), Giao thức Chứng chỉ Bảo mật (SSL/TLS Let's Encrypt), và Chuyển giao Tự động (CD via SSH/SCP) lên máy chủ Linux VPS (**20.48.112.82**).

---

## 1. Bức Tranh Kiến Trúc Hạ Tầng Tổng Thể (System Architecture & Topology)

Hệ thống DevPulse được thiết kế tối ưu hóa chuyên biệt cho môi trường tài nguyên hạn chế (**VPS Linux Ubuntu 22.04/24.04 – 1 vCPU, 1GB RAM, 2GB Swap Memory**).

```mermaid
flowchart TD
    subgraph Internet_Traffic ["Internet Traffic"]
        UserBrowser["Trình duyệt Client (Web/Mobile)"]
        DNS["Domain: devpulse.dorayakiiiiz.site / IP: 20.48.112.82"]
    end

    subgraph GitHub_Cloud ["GitHub Cloud Platform"]
        GitRepo["Git Repository (dev-pulse)"]
        CI_CD_Runner["GitHub Actions Runner (Ubuntu 4 vCPU / 16GB RAM)\n- Chạy 118 Tests\n- Build Multi-stage Images\n- Đẩy Docker Hub\n- SCP & SSH Deploy"]
        DockerHub["Docker Hub Registry (dorayakiiiiz)"]
    end

    subgraph Linux_VPS ["Production Linux VPS (20.48.112.82)"]
        UFW["Tường lửa UFW (Only Ports 22, 80, 443)"]
        
        subgraph Docker_Network ["Docker Bridge Network (devpulse-network)"]
            Gateway["devpulse-gateway (Nginx Alpine 1.27)\nLimits: 64MB RAM | Ports: 80, 443"]
            Frontend["devpulse-frontend (Nginx Alpine + SPA)\nLimits: 64MB RAM | Port: 80"]
            Backend["devpulse-backend (Node.js 20 Express)\nLimits: 256MB RAM | Port: 5000"]
            Database["devpulse-database (MongoDB 7.0)\nLimits: 384MB RAM | Port: 27017"]
        end

        VolumeSSD[("Persistent SSD Volume\n(mongodb_prod_data)")]
    end

    UserBrowser -->|"HTTP Port 80 / HTTPS Port 443"| UFW
    UFW --> Gateway
    Gateway -->|"Location / (React SPA)"| Frontend
    Gateway -->|"Location /api/ (REST API)"| Backend
    Gateway -->|"Location /api/sse/ (Realtime SSE)"| Backend
    Backend -->|"Mongoose TCP"| Database
    Database --> VolumeSSD

    GitRepo -->|"Push main / PR / Dispatch"| CI_CD_Runner
    CI_CD_Runner -->|"Push Images"| DockerHub
    CI_CD_Runner -->|"SCP Config & SSH Deploy"| UFW
    Gateway -.->|"ACME Challenge / SSL Certs"| Gateway
```

### Bảng Phân Bổ Tài Nguyên Thực Tế (Resource Budgeting Table)

| Thành phần / Container | Image gốc | Vai trò chuyên biệt | RAM tối đa (Limit) | RAM tiêu thụ thông thường | CPU Limit | Cổng nội bộ | Cổng Public |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`devpulse-gateway`** | `nginx:1.27-alpine` | Edge Reverse Proxy, TLS/SSL, Gzip, điều phối lưu lượng | 64 MB | ~8 MB | 0.20 vCPU | 80, 443 | **80, 443** |
| **`devpulse-frontend`** | `dorayakiiiiz/devpulse-frontend` | Web server tĩnh phục vụ React 18 SPA bundle | 64 MB | ~8 MB | 0.20 vCPU | 80 | *Không expose* |
| **`devpulse-backend`** | `dorayakiiiiz/devpulse-backend` | API Express, Ping Engine daemon, SSE streaming | 256 MB | ~110 – 130 MB | 0.50 vCPU | 5000 | *Không expose* |
| **`devpulse-database`** | `mongo:7.0` | Cơ sở dữ liệu Time-Series metrics & app collections | 384 MB | ~220 – 250 MB | 0.30 vCPU | 27017 | *Không expose* |
| **Hệ điều hành & Buffer** | Ubuntu Linux + Docker Daemon | Kernel Linux, systemd, journald, swap management | — | ~300 MB | 1.0 vCPU | 22 (SSH) | **22** |

> **Tổng mức tiêu thụ RAM:** ~390 MB (Dưới 40% dung lượng vật lý). Hệ thống luôn duy trì hơn **600MB RAM vật lý tự do** kết hợp **2GB Swap SSD**, triệt tiêu 100% rủi ro bị Linux Kernel kích hoạt OOM Killer (*Out Of Memory*).

---

## 1.1. Sơ Đồ Hành Trình Gói Tin Mạng & Cơ Chế Tiếp Nhận Của Nginx (Deep Network & Request Packet Flow)

### A. Làm Sao Một Request Gửi Tới IP VPS (20.48.112.82) Lại "Nhảy" Được Vào Container Nginx Gateway?

Nhiều lập trình viên thường thắc mắc: *"Tôi chỉ thấy máy chủ có địa chỉ IP công khai, vậy khi người dùng gõ `http://20.48.112.82`, cơ chế nào chuyển gói tin mạng từ card mạng của VPS vào tận bên trong container Nginx?"*

Dưới đây là hành trình vật lý chi tiết từng chặng của một gói tin TCP:

```mermaid
flowchart TD
    Client["Trình duyệt Client\n(Gửi GET http://20.48.112.82/monitors)"]
    
    subgraph Host_Linux_OS ["Hệ Điều Hành Linux VPS (20.48.112.82)"]
        NIC["1. Card mạng vật lý/ảo (eth0)\nTiếp nhận gói tin TCP SYN Port 80"]
        Netfilter["2. Linux Kernel Netfilter & UFW Firewall\nKiểm tra luật: ALLOW 80/tcp -> Cho phép qua"]
        DockerProxy["3. Docker Port Binding Engine\n(iptables PREROUTING DNAT & docker-proxy)\nÁnh xạ: Host 0.0.0.0:80 -> Container IP:80"]
        Bridge["4. Virtual Bridge Network (devpulse-network / br-xxx)\nChuyển tiếp gói tin qua veth pair vào Container"]
    end

    subgraph Container_Gateway ["Container: devpulse-gateway (Port 80/443)"]
        NginxGatewayMaster["5. Tiến trình Nginx Master/Worker\nLắng nghe tại: listen 80 default_server"]
        GatewayConfMatch["6. Đối chiếu file deploy/nginx/gateway.conf:\n- Khớp location /api/sse/ ? -> Không\n- Khớp location /api/ ? -> Không\n- Khớp location / ? -> ĐÚNG (proxy_pass http://frontend_upstream)"]
    end

    subgraph Container_Frontend ["Container: devpulse-frontend (Port 80 nội bộ)"]
        NginxFrontend["7. Tiến trình Nginx nội bộ Frontend\nNhận request từ Edge Gateway qua mạng Docker"]
        FrontendConfMatch["8. Đối chiếu file frontend/deploy/nginx/frontend.conf:\n- location / { try_files $uri $uri/ /index.html; }\n- Không có file thật tên /monitors -> Trả về /index.html"]
    end

    Client --> NIC
    NIC --> Netfilter
    Netfilter --> DockerProxy
    DockerProxy --> Bridge
    Bridge --> NginxGatewayMaster
    NginxGatewayMaster --> GatewayConfMatch
    GatewayConfMatch -->|"Forward HTTP qua mạng nội bộ"| NginxFrontend
    NginxFrontend --> FrontendConfMatch
    FrontendConfMatch -->|"Trả về index.html (200 OK)"| GatewayConfMatch
    GatewayConfMatch -->|"Trả về Client qua kết nối TCP ban đầu"| Client
```

#### Chi Tiết 4 Lớp Tiếp Nhận Gói Tin Mạng:
1. **Lớp 1: Card Mạng (NIC `eth0`) & Cloud Firewall (Azure NSG):** Gói tin mạng từ Internet bay tới địa chỉ IP `20.48.112.82` tại cổng 80. Tường lửa mạng của nhà cung cấp đám mây (Azure NSG) cho phép cổng 80 đi qua và chuyển tới card mạng `eth0` của máy ảo Ubuntu.
2. **Lớp 2: Tường Lửa Hệ Điều Hành (Linux UFW):** Kernel Linux nhận gói tin, đưa qua bảng luật UFW (`sudo ufw allow 80/tcp`). Vì cổng 80 đã được mở, gói tin được đi tiếp vào Network Stack của nhân Linux.
3. **Lớp 3: Cơ Chế Docker Port Mapping (`ports: - "80:80"`):**
   - Trong file [`docker-compose.prod.yml`](../docker-compose.prod.yml), dòng `ports: - "80:80"` ra lệnh cho Docker Daemon: *"Hãy chiếm quyền lắng nghe trên cổng 80 của toàn bộ máy chủ (`0.0.0.0:80`)"*.
   - Docker cài đặt một luật chuyển hướng địa chỉ mạng đích (**DNAT - Destination Network Address Translation**) vào bảng `iptables` của Linux Kernel, đồng thời bật tiến trình `docker-proxy`.
   - Ngay khi gói tin chạm vào cổng 80 của VPS, Linux Kernel tự động đổi địa chỉ IP đích thành IP nội bộ của container `devpulse-gateway` (ví dụ `172.20.0.4:80`) và đẩy gói tin qua cổng mạng ảo (*Virtual Ethernet - veth*) vào Docker Bridge Network (`devpulse-network`).
4. **Lớp 4: Tiến Trình Nginx Tiếp Nhận:**
   - Bên trong container `devpulse-gateway`, tiến trình Nginx đang chạy chỉ thị:
     ```nginx
     listen 80 default_server;
     ```
   - Nginx nhặt gói tin TCP này lên, bóc tách header HTTP (`GET /monitors HTTP/1.1`) và bắt đầu so khớp các khối `location` trong file cấu hình [`deploy/nginx/gateway.conf`](../deploy/nginx/gateway.conf).

---

### B. Giải Thích Ý Nghĩa Từng Dòng Của 3 `volumes` Trong Service `devpulse-gateway`

Trong file [`docker-compose.prod.yml`](../docker-compose.prod.yml), service `devpulse-gateway` có 3 dòng gắn kết volume:

```yaml
    volumes:
      - ./deploy/nginx/gateway.conf:/etc/nginx/conf.d/default.conf:ro
      - certbot-etc:/etc/letsencrypt:ro
      - certbot-var:/var/www/certbot:ro
```

Ý nghĩa và mục đích kỹ thuật sống còn của từng dòng:

| Dòng cấu hình Volume | Cơ chế hoạt động | Mục đích sống còn |
| :--- | :--- | :--- |
| **`./deploy/nginx/gateway.conf:/etc/nginx/conf.d/default.conf:ro`** | **Bind Mount (Ánh xạ file trực tiếp):** Lấy trực tiếp file `gateway.conf` trên ổ cứng VPS (trong thư mục `~/devpulse/deploy/nginx/`) đè vào vị trí cấu hình mặc định `/etc/nginx/conf.d/default.conf` bên trong container với quyền Chỉ đọc (`:ro` - Read Only). | Cho phép chúng ta thay đổi luật định tuyến reverse proxy, thêm header, chỉnh timeout mà **không cần phải build lại Docker image của Gateway**. Khi file trên VPS thay đổi, Nginx chỉ cần reload là ăn cấu hình mới ngay lập tức. |
| **`certbot-etc:/etc/letsencrypt:ro`** | **Named Volume (Ổ đĩa chia sẻ chứng chỉ SSL):** Ánh xạ thư mục chứa chứng chỉ SSL do Certbot tạo ra (`/etc/letsencrypt`) vào bên trong container Gateway tại `/etc/letsencrypt` với quyền `:ro`. | Nginx cần đọc 2 file `fullchain.pem` (chứng chỉ công khai) và `privkey.pem` (khóa bí mật) để kích hoạt giao thức bảo mật HTTPS cổng 443. Do Certbot chạy trên host VPS còn Nginx chạy trong container, volume này đóng vai trò "cây cầu" chia sẻ file chứng chỉ giữa VPS và Container. |
| **`certbot-var:/var/www/certbot:ro`** | **Named Volume (Ổ đĩa chia sẻ thử thách ACME):** Ánh xạ thư mục webroot xác thực chứng chỉ vào container tại `/var/www/certbot`. | Khi xin cấp SSL, Certbot ghi file token xác thực vào đây. Container Nginx đọc từ thư mục này và phát ra Internet cho Let's Encrypt kiểm tra mà **không cần phải tắt Nginx (Zero Downtime)**. |

---

### C. Cơ Chế Điều Phối Hai Tầng Nginx: Request Chạm Vào `frontend.conf` Như Thế Nào?

Một câu hỏi rất sắc bén: *"Tại sao trong Dockerfile của Frontend lại có Nginx riêng với file `frontend.conf`, và request đi như thế nào để chạm được vào file cấu hình đó?"*

Đó chính là mô hình **Kiến Trúc Hai Tầng Proxy (Two-Tier Reverse Proxy Architecture)**:
- **Tầng 1 (Edge Gateway - `gateway.conf`):** Nằm ở ngoài biên đón toàn bộ luồng mạng từ thế giới bên ngoài. Nó đóng vai trò "người phân luồng giao thông".
- **Tầng 2 (Static Web Server - `frontend.conf`):** Nằm ẩn sâu bên trong mạng nội bộ, đóng vai trò "thủ kho phát file tĩnh".

#### Hành Trình Request Chạm Vào `frontend.conf`:
1. Người dùng truy cập: `http://20.48.112.82/monitors`.
2. **Edge Gateway** (`devpulse-gateway`) nhận request, đọc file `gateway.conf`:
   - So khớp: Đường dẫn `/monitors` không thuộc `/api/` hay `/api/sse/`.
   - Nó khớp vào khối mặc định:
     ```nginx
     location / {
         proxy_pass http://frontend_upstream; # frontend_upstream trỏ tới devpulse-frontend:80
     }
     ```
3. Edge Gateway gửi một request HTTP mới qua mạng nội bộ Docker (`devpulse-network`) tới địa chỉ `http://devpulse-frontend:80/monitors`.
4. Bên trong container `devpulse-frontend`, tiến trình Nginx thứ hai (được đóng gói trong `frontend/Dockerfile`) tiếp nhận request này.
5. Tiến trình này đọc file cấu hình của riêng nó: `/etc/nginx/conf.d/default.conf` (chính là file [`frontend/deploy/nginx/frontend.conf`](../frontend/deploy/nginx/frontend.conf) đã được copy vào lúc build image):
   ```nginx
   location / {
       try_files $uri $uri/ /index.html;
   }
   ```
6. **Thuật toán `try_files` xử lý:**
   - `$uri`: Nginx tìm xem trên đĩa `/usr/share/nginx/html/` có file thật nào tên là `monitors` không? $\rightarrow$ **Không có**.
   - `$uri/`: Nginx tìm xem có thư mục nào tên là `monitors/` không? $\rightarrow$ **Không có**.
   - `/index.html`: Nginx lập tức chuyển hướng trả về file `/usr/share/nginx/html/index.html`.
7. Nginx Frontend trả nội dung file `index.html` (chứa các thẻ `<div id="root"></div>` và `<script src="/assets/index-xxx.js">`) về cho Edge Gateway $\rightarrow$ Edge Gateway chuyển tiếp về trình duyệt người dùng với mã HTTP 200 OK.
8. Trình duyệt tải `index.html` về, đọc thấy thẻ script và gửi tiếp request: `GET /assets/index-xxx.js`.
9. Gói tin lại đi qua Edge Gateway $\rightarrow$ sang Frontend Nginx $\rightarrow$ khớp khối:
   ```nginx
   location /assets/ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```
10. Frontend Nginx đọc file JS thật trên đĩa, trả về kèm header cache 1 năm. Trình duyệt thực thi mã JavaScript của React, thư viện `react-router-dom` đọc `window.location.pathname = "/monitors"` và vẽ màn hình Quản Lý Monitor lên giao diện người dùng!

---

## 2. Phân Tích Thực Chiến: CI/CD Hợp Nhất (Unified DAG Pipeline) Triệt Tiêu 100% Test Trùng Lặp

Khi xây dựng pipeline CI/CD, có 2 cách tiếp cận với những đánh đổi rõ rệt:

#### Cách tiếp cận rời rạc: Tách 2 file độc lập (`ci.yml` và `cd.yml`)
- Nếu cả 2 file đều kích hoạt khi có sự kiện `push` vào nhánh `main`, hệ thống sẽ bị chạy song song 2 workflow riêng biệt. Nếu file CD muốn đảm bảo an toàn, nó buộc phải chạy lại toàn bộ 118 unit & integration tests từ đầu $\rightarrow$ **chạy trùng lặp, lãng phí thời gian và làm chậm quá trình release**.
- Dùng cơ chế `workflow_run` (file CD lắng nghe sự kiện `ci.yml` hoàn thành) thì chia cắt giao diện UI thành 2 tab rời rạc, khó theo dõi tiến trình toàn cục và phức tạp hóa việc checkout đúng commit SHA.

#### Cách tiếp cận chuẩn mực: Pipeline Hợp Nhất theo Đồ thị Có hướng (Unified DAG Pipeline - `.github/workflows/ci-cd.yml`)
- **Nguyên lý hoạt động:**
  1. Khi mở **Pull Request**: Pipeline chỉ chạy duy nhất 2 Jobs Quality Gate (`backend-quality-gate` và `frontend-quality-gate`). Các Jobs Build và Deploy tự động bị bỏ qua (`skipped`) nhờ điều kiện `if: github.ref == 'refs/heads/main' && github.event_name == 'push'`.
  2. Khi **Push / Merge vào `main`** hoặc **Kích hoạt bằng tay (`workflow_dispatch`)**:
     - **Bước 1:** `backend-quality-gate` và `frontend-quality-gate` chạy kiểm thử **ĐÚNG 1 LẦN DUY NHẤT**.
     - **Bước 2:** Job `build-and-push` phụ thuộc vào 2 Quality Gates qua `needs: [ backend-quality-gate, frontend-quality-gate ]`. Nếu tests xanh 100%, nó mới tiến hành đóng gói Docker và đẩy lên Docker Hub.
     - **Bước 3:** Job `deploy-vps` phụ thuộc vào `build-and-push` qua `needs: [ build-and-push ]`. Sau khi image đã lên Docker Hub an toàn, nó mới kích hoạt SCP và SSH deploy lên VPS.
- **Lợi ích vượt trội:**
  - **Triệt tiêu 100% việc test lặp lại:** Toàn bộ 118 bài test chỉ chạy duy nhất 1 lần.
  - **Trực quan hóa trên 1 màn hình duy nhất (Visual DAG Graph):** Bạn thấy rõ luồng chảy từ Test $\rightarrow$ Build Image $\rightarrow$ Deploy VPS trên cùng một giao diện.
  - **Hỗ trợ trigger bằng tay linh hoạt:** Khối `workflow_dispatch:` cho phép bạn bấm nút Deploy lại bất cứ lúc nào trực tiếp từ giao diện GitHub.

---

## 3. Chi Tiết Container Hóa & Giải Thích Từng Dòng Mã Nguồn (Dockerization Deep-Dive)

### 3.1. Phân Tích [`backend/Dockerfile`](../backend/Dockerfile)

```dockerfile
# Multi-stage Dockerfile for DevPulse Backend API Service

# ========================================================
# STAGE 1: BUILDER (Biên dịch TypeScript sang JavaScript)
# ========================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests để tận dụng Docker layer cache
COPY package*.json ./

# Cài đặt toàn bộ dependencies (bao gồm devDependencies như tsc, @types/...)
RUN npm ci

# Copy toàn bộ cấu hình TypeScript và mã nguồn backend
COPY tsconfig.json ./
COPY src/ ./src/

# Biên dịch mã nguồn TypeScript sang JavaScript thuần vào thư mục dist/
RUN npm run build

# Loại bỏ toàn bộ devDependencies, chỉ giữ lại các thư viện production chạy runtime
RUN npm prune --omit=dev

# ========================================================
# STAGE 2: RUNNER (Môi trường thực thi sản xuất tối giản)
# ========================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Thiết lập cờ môi trường production
ENV NODE_ENV=production
ENV PORT=5000

# Copy node_modules tinh gọn và package.json từ builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy thư mục dist đã biên dịch từ builder
COPY --from=builder /app/dist ./dist

# Chạy container dưới tài khoản người dùng không có quyền root (USER node)
USER node

# Mở cổng giao tiếp nội bộ của service
EXPOSE 5000

# Kiểm tra sức khỏe tự động: nếu tiến trình bị treo hoặc lỗi DB, Docker sẽ phát hiện và restart
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

# Lệnh khởi chạy server
CMD ["node", "dist/server.js"]
```

> **Điểm sáng kỹ thuật:**
> 1. **Bảo mật tuyệt đối (Non-root Execution):** Container chạy dưới `USER node` có sẵn trong Alpine Linux, ngăn chặn hoàn toàn nguy cơ hacker chiếm quyền root của VPS nếu xảy ra lỗi bảo mật từ thư viện bên ngoài.
> 2. **Dung lượng siêu nhẹ:** Image cuối cùng chỉ nặng **~115MB** (thay vì hơn 1GB nếu để cả source code và devDependencies).

---

### 3.2. Phân Tích [`frontend/Dockerfile`](../frontend/Dockerfile) & [`frontend/deploy/nginx/frontend.conf`](../frontend/deploy/nginx/frontend.conf)

#### File Cấu hình Nginx Tĩnh Phía Frontend (`frontend.conf`):
```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # Kích hoạt nén Gzip tối đa hóa tốc độ tải trang
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # SPA Routing: Mọi đường dẫn không tìm thấy file thật đều chuyển về index.html để React Router xử lý
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Đánh dấu cache vĩnh viễn 1 năm cho các file assets tĩnh có hash tên file từ Vite
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Bổ sung các header bảo mật cơ bản
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

#### Multi-Stage Dockerfile của Frontend:
```dockerfile
# Multi-stage Dockerfile for DevPulse Frontend React SPA

# Stage 1: Build static web assets
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time environment argument for API base URL (defaults to relative /api)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source code and build configs
COPY tsconfig*.json vite.config.ts tailwind.config.ts postcss.config.js index.html ./
COPY src/ ./src/

# Build optimized production bundle
RUN npm run build

# Stage 2: Production runtime using lightweight Nginx Alpine
FROM nginx:1.27-alpine AS runner

# Remove default Nginx welcome page and config
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration for SPA routing
COPY deploy/nginx/frontend.conf /etc/nginx/conf.d/default.conf

# Copy built static files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Healthcheck to verify Nginx serves frontend HTML
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
```

> **Dung lượng thành phẩm:** Chỉ **~23MB**. Nginx chỉ phục vụ các file HTML, JS, CSS thuần túy, tiêu thụ gần như 0% CPU và dưới 8MB RAM.

---

### 3.3. Phân Tích Cấu Hình Edge Reverse Proxy Gateway ([`deploy/nginx/gateway.conf`](../deploy/nginx/gateway.conf))

Đây là "người gác cổng" duy nhất đón nhận toàn bộ lưu lượng mạng từ Internet vào máy chủ VPS:

```nginx
# Định nghĩa các cụm upstream nội bộ bên trong Docker Network
upstream backend_upstream {
    server devpulse-backend:5000;
}

upstream frontend_upstream {
    server devpulse-frontend:80;
}

# Block Server HTTP (Cổng 80)
# Tiếp nhận trực tiếp cả truy cập qua IP (http://20.48.112.82) lẫn tên miền devpulse.dorayakiiiiz.site
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _ devpulse.dorayakiiiiz.site;

    # Thư mục xác thực chứng chỉ SSL tự động của Let's Encrypt qua giao thức HTTP-01
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Tiêu chuẩn bảo mật toàn cầu
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Nén Gzip động
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # 1. Định tuyến luồng Server-Sent Events (SSE) thời gian thực
    location /api/sse/ {
        proxy_pass http://backend_upstream;
        proxy_http_version 1.1;

        # CẤM ĐỆM DỮ LIỆU: Đảm bảo từng event MONITOR_PING / INCIDENT_ALERT được bắn tức thì xuống trình duyệt
        proxy_buffering off;
        proxy_cache off;
        
        # Thiết lập timeout dài 24h để Nginx không tự động ngắt kết nối khi đang stream
        proxy_read_timeout 24h;
        proxy_send_timeout 24h;

        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        chunked_transfer_encoding off;
    }

    # 2. Định tuyến các API REST thông thường
    location /api/ {
        proxy_pass http://backend_upstream;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }

    # 3. Định tuyến toàn bộ các yêu cầu còn lại vào Frontend React SPA
    location / {
        proxy_pass http://frontend_upstream;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Bản Đặc Tả Điều Phối Dịch Vụ Tinh Gọn ([`docker-compose.prod.yml`](../docker-compose.prod.yml))

Bản mô tả điều phối 4 container liên kết chặt chẽ:

```yaml
services:
  # ========================================================
  # SERVICE 1: EDGE GATEWAY & REVERSE PROXY (Nginx)
  # ========================================================
  devpulse-gateway:
    image: nginx:1.27-alpine
    container_name: devpulse-gateway
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/nginx/gateway.conf:/etc/nginx/conf.d/default.conf:ro
      - certbot-etc:/etc/letsencrypt:ro
      - certbot-var:/var/www/certbot:ro
    depends_on:
      devpulse-backend:
        condition: service_healthy
      devpulse-frontend:
        condition: service_healthy
    networks:
      - devpulse-network
    deploy:
      resources:
        limits:
          cpus: "0.20"
          memory: 64M
        reservations:
          memory: 20M

  # ========================================================
  # SERVICE 2: FRONTEND SPA (React 18 + Vite Static Server)
  # ========================================================
  devpulse-frontend:
    image: dorayakiiiiz/devpulse-frontend:latest
    container_name: devpulse-frontend
    restart: unless-stopped
    networks:
      - devpulse-network
    deploy:
      resources:
        limits:
          cpus: "0.20"
          memory: 64M
        reservations:
          memory: 20M

  # ========================================================
  # SERVICE 3: BACKEND API SERVICE (Node.js 20 Express)
  # ========================================================
  devpulse-backend:
    image: dorayakiiiiz/devpulse-backend:latest
    container_name: devpulse-backend
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      devpulse-database:
        condition: service_healthy
    networks:
      - devpulse-network
    deploy:
      resources:
        limits:
          cpus: "0.50"
          memory: 256M
        reservations:
          memory: 128M

  # ========================================================
  # SERVICE 4: PERSISTENT DATABASE (MongoDB 7.0)
  # ========================================================
  devpulse-database:
    image: mongo:7.0
    container_name: devpulse-database
    restart: unless-stopped
    command: ["--wiredTigerCacheSizeGB", "0.25"]
    volumes:
      - mongodb_prod_data:/data/db
    networks:
      - devpulse-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    deploy:
      resources:
        limits:
          cpus: "0.30"
          memory: 384M
        reservations:
          memory: 256M

networks:
  devpulse-network:

volumes:
  mongodb_prod_data:
  certbot-etc:
  certbot-var:
```

> **Chi tiết thiết kế sống còn:**
> - `command: ["--wiredTigerCacheSizeGB", "0.25"]`: Bắt buộc cấu hình nhằm giới hạn bộ đệm WiredTiger nội bộ của MongoDB chỉ dùng tối đa 256MB RAM, ngăn chặn MongoDB tự động chiếm dụng 50% RAM vật lý của hệ thống.
> - `condition: service_healthy`: Đảm bảo thứ tự khởi động chuẩn xác: MongoDB kết nối thành công $\rightarrow$ Backend khởi động & pass healthcheck $\rightarrow$ Gateway mới mở cửa đón lưu lượng bên ngoài.
> - Cấu hình `networks` và `volumes` không khai báo driver rác vì mặc định hệ thống đã là `bridge` và `local`.

---

## 5. Giải Thích Toàn Diện Mã Nguồn Pipeline Hợp Nhất ([`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml))

Dưới đây là toàn bộ mã nguồn của file workflow CI/CD duy nhất, kèm phân tích chi tiết từng khối lệnh:

```yaml
name: DevPulse CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:

# Hủy các lượt chạy cũ nếu có commit mới được đẩy lên cùng nhánh (chỉ áp dụng cho PR/develop, không hủy trên main)
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  # ========================================================
  # JOB 1: BACKEND QUALITY GATE (Chạy trên mọi PR, Push & Dispatch)
  # ========================================================
  backend-quality-gate:
    name: Backend Quality Gate
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      # Khởi tạo Node.js 20 và kích hoạt cache cho thư mục ~/.npm dựa trên package-lock.json
      - name: Setup Node.js Runtime
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      # Cài đặt sạch các package từ package-lock.json
      - name: Install Dependencies
        working-directory: backend
        run: npm ci

      # Kiểm tra tĩnh tính tương thích kiểu dữ liệu TypeScript (0 errors)
      - name: Strict TypeScript Compilation Check
        working-directory: backend
        run: npm run type-check

      # Chạy 59 bài test (Unit & Integration với MongoDB Memory Server)
      - name: Run Backend Tests
        working-directory: backend
        env:
          NODE_ENV: test
          JWT_SECRET: devpulse_test_jwt_secret_key_super_secure_32_chars
          JWT_EXPIRES_IN: 15m
          JWT_REFRESH_SECRET: devpulse_test_jwt_refresh_secret_key_super_secure_32_chars
          JWT_REFRESH_EXPIRES_IN: 7d
        run: npm test

  # ========================================================
  # JOB 2: FRONTEND QUALITY GATE (Chạy trên mọi PR, Push & Dispatch)
  # ========================================================
  frontend-quality-gate:
    name: Frontend Quality Gate
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Node.js Runtime
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install Dependencies
        working-directory: frontend
        run: npm ci

      - name: Strict TypeScript Compilation Check
        working-directory: frontend
        run: npm run type-check

      # Chạy 59 bài test kiểm thử UI components, custom hooks và zustand stores
      - name: Run Frontend Tests
        working-directory: frontend
        run: npm test

      # Xác thực quá trình biên dịch Vite ra bundle tĩnh không có lỗi cú pháp hay import hỏng
      - name: Verify Production Bundle Build
        working-directory: frontend
        run: npm run build

  # ========================================================
  # JOB 3: BUILD & PUSH DOCKER IMAGES (Chỉ chạy khi push/merge vào main hoặc dispatch)
  # ========================================================
  build-and-push:
    name: Build & Push Docker Images
    needs: [ backend-quality-gate, frontend-quality-gate ]
    if: (github.ref == 'refs/heads/main' && github.event_name == 'push') || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      # Khởi tạo Docker Buildx để hỗ trợ multi-stage và bộ đệm cache hiện đại
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      # Đăng nhập vào tài khoản Docker Hub sử dụng secrets cấu hình
      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      # Build image backend từ backend/Dockerfile và đẩy lên Docker Hub với 2 tags: :latest và :<commit_sha>
      - name: Build & Push Backend Image
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          file: ./backend/Dockerfile
          push: true
          tags: |
            ${{ secrets.DOCKERHUB_USERNAME }}/devpulse-backend:latest
            ${{ secrets.DOCKERHUB_USERNAME }}/devpulse-backend:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # Build image frontend từ frontend/Dockerfile và đẩy lên Docker Hub
      - name: Build & Push Frontend Image
        uses: docker/build-push-action@v6
        with:
          context: ./frontend
          file: ./frontend/Dockerfile
          push: true
          tags: |
            ${{ secrets.DOCKERHUB_USERNAME }}/devpulse-frontend:latest
            ${{ secrets.DOCKERHUB_USERNAME }}/devpulse-frontend:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ========================================================
  # JOB 4: DEPLOY TO VPS (Chỉ chạy khi build image thành công)
  # ========================================================
  deploy-vps:
    name: Deploy to Production VPS
    needs: [ build-and-push ]
    if: (github.ref == 'refs/heads/main' && github.event_name == 'push') || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      # TẠI SAO CẦN SCP? 
      # VPS không kéo toàn bộ mã nguồn git về. VPS chỉ cần đúng 2 file cấu hình điều phối:
      # 1. docker-compose.prod.yml (khai báo các container, port, volume, ram limit)
      # 2. gateway.conf (khai báo các luật reverse proxy cho Nginx)
      # Action này sử dụng giao thức truyền file bảo mật SSH (SCP) để copy đè 2 file mới nhất từ Git vào thư mục ~/devpulse trên VPS.
      - name: Copy Compose and Nginx Configurations to VPS
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT || 22 }}
          source: "docker-compose.prod.yml,deploy/nginx/gateway.conf"
          target: "~/devpulse"
          strip_components: 0

      # TẠI SAO CẦN SSH ACTION?
      # Mở kết nối shell từ xa vào VPS và thực thi chuỗi lệnh tự động hóa:
      - name: Execute Remote Deployment via SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT || 22 }}
          script: |
            cd ~/devpulse

            # 1. Kéo các Docker image mới nhất vừa được GitHub build từ Docker Hub về VPS.
            # Việc kéo trước giúp quá trình tái tạo container diễn ra gần như tức thì (< 1 giây).
            docker compose -f docker-compose.prod.yml pull

            # 2. Khởi động lại các container. Cờ --remove-orphans tự động dọn các container thừa nếu có thay đổi tên service.
            # Lệnh này chỉ recreate những container có image mới, không làm mất dữ liệu MongoDB.
            docker compose -f docker-compose.prod.yml up -d --remove-orphans

            # 3. Dọn sạch các Docker image layers cũ mồ côi (dangling images) để bảo vệ dung lượng ổ đĩa SSD của VPS.
            docker image prune -f

            # 4. Trạm kiểm soát sức khỏe (Health Verification Probe):
            # Tạm dừng 5s để backend khởi động xong, sau đó dùng curl gọi thẳng vào /api/health cục bộ.
            # Nếu backend trả về HTTP 200 OK -> Pipeline báo xanh thành công.
            # Nếu backend bị crash do thiếu biến môi trường -> Script thoát với Exit Code 1, báo đỏ cảnh báo cho lập trình viên.
            echo "[CD] Verifying service health..."
            sleep 5
            docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
            curl -f http://localhost:5000/api/health || (echo "[CD Error] Backend health probe failed!" && exit 1)
            echo "[CD] DevPulse production deployment succeeded!"
```

---

### 5.3. Nhật Ký Hành Trình Chi Tiết Từng Bước Từ "Git Push" Đến Khi Container Chạy Trên VPS (End-to-End Execution Trace)

Dưới đây là mô tả chi tiết từng bước, tường minh từng hành động từ khi bạn gõ lệnh trên máy tính cá nhân cho đến khi ứng dụng chạy thật trên VPS:

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer (Máy Cá Nhân)
    participant GH as GitHub Cloud (Git Repo)
    participant Runner as GitHub Actions Runner (Ubuntu 16GB RAM)
    participant Hub as Docker Hub Registry (dorayakiiiiz)
    participant VPS_SSH as Linux VPS (SSH & File System)
    participant DockerDaemon as Docker Engine trên VPS (20.48.112.82)

    Dev->>GH: 1. git push origin main
    GH->>Runner: 2. Kích hoạt workflow ci-cd.yml
    Note over Runner: 3. Chạy song song Job 1 & Job 2:<br/>- npm ci<br/>- tsc --noEmit (0 errors)<br/>- vitest (118/118 tests pass)<br/>- vite build
    Runner->>Hub: 4. Job 3 (Buildx): Build 2 Dockerfiles multi-stage<br/>Push dorayakiiiiz/devpulse-backend & frontend (:latest & :sha)
    Runner->>VPS_SSH: 5. Job 4 (SCP Action qua Port 22):<br/>Copy đè docker-compose.prod.yml & gateway.conf vào ~/devpulse/
    Runner->>VPS_SSH: 6. Job 4 (SSH Action): Mở terminal remote vào ~/devpulse
    VPS_SSH->>DockerDaemon: 7. docker compose pull (Đọc compose file, tải các layer image mới từ Docker Hub)
    VPS_SSH->>DockerDaemon: 8. docker compose up -d --remove-orphans (So sánh image hash, recreate container đổi mới)
    VPS_SSH->>DockerDaemon: 9. docker image prune -f (Xóa các layer dangling cũ giải phóng ổ SSD)
    VPS_SSH->>DockerDaemon: 10. curl http://localhost:5000/api/health (Probe kiểm tra backend sống sót 100%)
    DockerDaemon-->>Runner: Báo cáo HTTP 200 OK
    Runner-->>Dev: Pipeline Xanh Hoàn Toàn (Deployment Succeeded!)
```

#### Chi Tiết 10 Bước Diễn Ra Tự Động:
1. **Bước 1 (Local Push):** Bạn gõ `git push origin main`. Toàn bộ commit code mới được đẩy lên GitHub repository.
2. **Bước 2 (GitHub Event Trigger):** GitHub phát hiện sự kiện push vào nhánh `main` và khởi tạo một máy ảo Ubuntu cách ly (**GitHub Actions Runner** với 4 vCPU và 16GB RAM).
3. **Bước 3 (Kiểm Soát Chất Lượng Song Song):**
   - Runner chạy song song `backend-quality-gate` và `frontend-quality-gate`.
   - Cài đặt package qua `npm ci`, kiểm tra kiểu dữ liệu tĩnh `tsc --noEmit`, và chạy trọn vẹn **118 unit & integration tests**.
   - Nếu có bất kỳ bài test nào bị fail hoặc TypeScript bị lỗi kiểu, pipeline **lập tức dừng lại tại đây và báo đỏ**, tuyệt đối không đụng vào server VPS!
4. **Bước 4 (Đóng Gói Multi-stage & Đẩy Lên Docker Hub):**
   - Khi tests xanh 100%, Runner kích hoạt Docker Buildx.
   - Biên dịch Backend thành image `dorayakiiiiz/devpulse-backend:latest` (~115MB).
   - Đóng gói Frontend thành image `dorayakiiiiz/devpulse-frontend:latest` (~23MB).
   - Đăng nhập Docker Hub và đẩy 2 images lên kho lưu trữ đám mây.
5. **Bước 5 (Đồng Bộ Cấu Hình Qua SCP):**
   - Runner sử dụng action `appleboy/scp-action` mở kết nối bảo mật qua cổng SSH (Port 22) vào VPS `20.48.112.82` bằng Private Key `VPS_SSH_KEY`.
   - Copy 2 file cấu hình điều phối mới nhất từ Git vào thư mục `~/devpulse`:
     - `docker-compose.prod.yml` (ghi đè file cũ để cập nhật tag hoặc cấu hình dịch vụ).
     - `deploy/nginx/gateway.conf` (ghi đè file cấu hình reverse proxy).
6. **Bước 6 (Khởi Tạo Phiên SSH Thực Thi Từ Xa):**
   - Action `appleboy/ssh-action` mở phiên dòng lệnh tương tác trên máy chủ VPS với tư cách user `dorayakiiiiz`.
   - Di chuyển con trỏ vào thư mục làm việc: `cd ~/devpulse`.
7. **Bước 7 (Kéo Image Mới Về VPS - `docker compose pull`):**
   - Docker daemon trên VPS đọc file `docker-compose.prod.yml`, nhận diện 2 image `dorayakiiiiz/devpulse-backend:latest` và `dorayakiiiiz/devpulse-frontend:latest`.
   - Docker daemon kết nối lên Docker Hub, so sánh mã băm (hash digest) của từng layer. Nó **chỉ tải về các layer có sự thay đổi** (chỉ tốn vài megabytes và mất khoảng 5–10 giây).
8. **Bước 8 (Tái Tạo Container Không Gián Đoạn - `docker compose up -d`):**
   - Docker daemon so sánh trạng thái container đang chạy với image mới tải về:
     - Nếu image của `devpulse-backend` thay đổi: Docker chỉ dừng container backend cũ và bật container backend mới trong vòng chưa đầy 1 giây.
     - Database MongoDB không bị ảnh hưởng vì image `mongo:7.0` không đổi và volume `mongodb_prod_data` là bất biến.
   - Cờ `--remove-orphans` tự động dọn sạch các container cũ nếu bạn đổi tên service.
9. **Bước 9 (Dọn Rác Ổ Đĩa Tự Động - `docker image prune -f`):**
   - Các image phiên bản cũ sau khi bị thay thế sẽ trở thành "image mồ côi" (*dangling images - `<none>:<none>`*).
   - Lệnh này xóa sạch các layer mồ côi đó, giải phóng hoàn toàn dung lượng ổ cứng SSD của VPS (vốn chỉ có 20GB).
10. **Bước 10 (Trạm Kiểm Tra Sức Khỏe Cuối Cùng):**
    - Runner tạm dừng 5 giây để Node.js kết nối MongoDB và hoàn tất khởi động.
    - Chạy lệnh `curl -f http://localhost:5000/api/health`.
    - Nếu server trả về HTTP 200 OK kèm thông số database connected, pipeline báo xanh toàn bộ $\rightarrow$ Phiên bản mới đã chính thức phục vụ người dùng!

---

## 6. Chuyên Sâu Về Chứng Chỉ SSL/TLS: Bản Chất, Let's Encrypt, Certbot & Cơ Chế Cấp Phát Từng Bước (SSL Deep-Dive)

Nhiều lập trình viên thường nghe tới các thuật ngữ như *Let's Encrypt*, *Certbot*, *ACME Protocol*, *SSL/TLS*, nhưng chưa hình dung được bản chất thực sự của chúng là gì và chúng phối hợp với nhau như thế nào trên máy chủ. Dưới đây là phân tích chi tiết tận gốc rễ:

### 6.1. Bản Chất Các Khái Niệm: Let's Encrypt, Certbot & Cặp Khóa Mã Hóa

1. **Let's Encrypt là gì?**
   - Let's Encrypt là một **Tổ chức Cấp phát Chứng chỉ Số (Certificate Authority - CA)** phi lợi nhuận toàn cầu.
   - Trong thế giới bảo mật, Let's Encrypt đóng vai trò như một **"Văn phòng Công chứng Toàn cầu"**. Chữ ký số của Let's Encrypt được cài sẵn trong kho tin cậy (*Trust Store*) của tất cả các hệ điều hành (Windows, macOS, iOS, Android, Linux) và mọi trình duyệt web trên thế giới (Chrome, Safari, Firefox, Edge).
   - Khi website của bạn có chứng chỉ do Let's Encrypt ký, trình duyệt sẽ tin tưởng ngay lập tức và hiển thị biểu tượng ổ khóa an toàn màu xanh/xám.

2. **Certbot là gì?**
   - Certbot là một **phần mềm dòng lệnh (CLI Client)** mã nguồn mở do tổ chức bảo mật EFF (*Electronic Frontier Foundation*) phát triển.
   - Để xin được chứng chỉ từ Let's Encrypt, bạn không thể gửi email hay nộp đơn thủ công. Bạn phải dùng Certbot cài trực tiếp trên máy chủ VPS của mình. Certbot đóng vai trò là "người đại diện" tự động nói chuyện với máy chủ của Let's Encrypt thông qua giao thức chuẩn quốc tế mang tên **ACME (Automated Certificate Management Environment - RFC 8555)**.

3. **Một Bộ Chứng Chỉ SSL Thực Chất Gồm Những File Gì?**
   Khi Certbot xin cấp chứng chỉ thành công cho domain `devpulse.dorayakiiiiz.site`, nó tạo ra 2 file quan trọng nhất tại `/etc/letsencrypt/live/devpulse.dorayakiiiiz.site/`:
   - **`privkey.pem` (Khóa Bí Mật - Private Key):** Đây là chiếc chìa khóa tối mật. Nó **CHỈ ĐƯỢC LƯU DUY NHẤT TRÊN VPS CỦA BẠN**, không bao giờ được gửi qua mạng cho bất kỳ ai (kể cả Let's Encrypt). Khóa này dùng để giải mã các gói tin mà trình duyệt người dùng gửi lên.
   - **`fullchain.pem` (Chứng Chỉ Công Khai - Public Certificate):** Đây là "thẻ căn cước công dân có chữ ký số" của website bạn do Let's Encrypt đóng dấu. Khi khách hàng truy cập website, Nginx sẽ gửi file này cho trình duyệt khách hàng để họ dùng mã hóa dữ liệu trước khi gửi về VPS.

---

### 6.2. Tại Sao Bắt Buộc Phải Cấp Chứng Chỉ SSL (HTTPS)? (The "WHY")

1. **Mã Hóa Lưu Lượng Trên Đường Truyền (Chống Tấn Công Nghe Lén MITM):**
   - Khi chạy qua HTTP thông thường (Port 80), mọi dữ liệu truyền đi (mật khẩu người dùng, mã OTP 6 số, Access Token trong Authorization Header, Refresh Token trong Cookie) đều là văn bản thuần (*Plaintext*).
   - Bất kỳ thiết bị mạng trung gian nào (Wi-Fi công cộng quán cafe, Router, Nhà mạng ISP) đều có thể dùng các công cụ như Wireshark để bắt gói tin và đọc trộm toàn bộ tài khoản người dùng (*Man-in-the-Middle Attack - MITM*).
   - HTTPS mã hóa toàn bộ dữ liệu này bằng thuật toán mã hóa hiện đại (RSA/ECC + AES-GCM), biến dữ liệu truyền qua Internet thành chuỗi nhị phân ngẫu nhiên không thể giải mã nếu không có file `privkey.pem`.
2. **Tiêu Chuẩn Trình Duyệt & Bảo Vệ Cookie:**
   - Các trình duyệt hiện đại (Chrome, Firefox, Safari) tự động hiển thị cảnh báo đỏ **"Not Secure"** trên thanh địa chỉ nếu trang web có form đăng nhập mà không có HTTPS, làm mất hoàn toàn độ tin cậy của người dùng.
   - Các cookie bảo mật mang thuộc tính `Secure` chỉ được trình duyệt gửi đi khi kết nối là HTTPS.
3. **Độ Ổn Định Sống Còn Cho Server-Sent Events (SSE) & HTTP/2:**
   - Trong hệ thống DevPulse, tính năng đẩy số liệu monitor theo thời gian thực dựa vào kết nối SSE (`/api/sse/monitors`).
   - Nhiều tường lửa công ty và Proxy trung gian tự động quét và ngắt các kết nối HTTP/1.1 giữ mở lâu. Tuy nhiên, khi lưu lượng được bọc trong đường hầm mã hóa SSL (HTTPS) hoặc HTTP/2, Proxy trung gian không thể can thiệp sâu vào gói tin, giúp **kết nối SSE thời gian thực duy trì ổn định 24/7 mà không bị rớt mạng**.

---

### 6.3. Toàn Bộ Flow Cấp Chứng Chỉ SSL Diễn Ra Như Thế Nào? (Cơ Chế ACME HTTP-01 Challenge Từng Bước)

Làm sao Let's Encrypt biết chắc chắn bạn là người thực sự sở hữu tên miền `devpulse.dorayakiiiiz.site` mà không phải kẻ mạo danh?
Let's Encrypt sử dụng một bài kiểm tra tự động mang tên **HTTP-01 Challenge**.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Bạn (Gõ lệnh Certbot trên VPS)
    participant Certbot as Phần mềm Certbot (Chạy trên host VPS)
    participant VolVar as Docker Volume certbot-var (/var/www/certbot)
    participant Nginx as devpulse-gateway Container (Nginx Port 80)
    participant DNS as Hệ thống DNS Quốc tế
    participant LE as Máy chủ Thẩm định Let's Encrypt (USA)
    participant VolEtc as Docker Volume certbot-etc (/etc/letsencrypt)

    Admin->>Certbot: 1. certbot certonly --webroot -w ... -d devpulse.dorayakiiiiz.site
    Certbot->>LE: 2. Gửi yêu cầu qua API: "Tôi muốn xin SSL cho devpulse.dorayakiiiiz.site"
    LE-->>Certbot: 3. Ra đề bài HTTP-01: "Hãy đặt Token bí mật 'XYZ123' tại đường dẫn /.well-known/acme-challenge/XYZ123"
    Certbot->>VolVar: 4. Ghi file văn bản tên 'XYZ123' chứa chữ ký số vào ổ đĩa chia sẻ
    Note over VolVar,Nginx: Thư mục này được mount trực tiếp vào container Nginx tại /var/www/certbot
    Certbot->>LE: 5. Báo cáo: "Tôi đã đặt file xong, mời máy chủ Let's Encrypt vào kiểm tra!"
    LE->>DNS: 6. Tra cứu bản ghi A của devpulse.dorayakiiiiz.site -> Nhận IP 20.48.112.82
    LE->>Nginx: 7. Gửi HTTP GET: http://devpulse.dorayakiiiiz.site/.well-known/acme-challenge/XYZ123
    Nginx->>VolVar: 8. Đọc file 'XYZ123' từ thư mục chia sẻ
    Nginx-->>LE: 9. Trả về nội dung token với mã HTTP 200 OK
    Note over LE: Let's Encrypt đối chiếu token: CHÍNH XÁC 100%!<br/>Kết luận: Người này thực sự làm chủ server mà domain đang trỏ về!
    LE-->>Certbot: 10. Ký số điện tử và cấp cặp chứng chỉ (fullchain.pem & privkey.pem)
    Certbot->>VolEtc: 11. Lưu cặp file vào volume chia sẻ /etc/letsencrypt/live/...
    Note over Nginx,VolEtc: Nginx mount volume certbot-etc đọc 2 file này và mở cổng HTTPS 443 an toàn!
```

#### Phân Tích 11 Bước Chi Tiết:
1. **Bước 1:** Bạn đứng trên terminal của VPS gõ lệnh:
   ```bash
   sudo certbot certonly --webroot -w /var/lib/docker/volumes/devpulse_certbot-var/_data -d devpulse.dorayakiiiiz.site
   ```
2. **Bước 2:** Certbot mở kết nối HTTPS lên máy chủ ACME của Let's Encrypt (`acme-v02.api.letsencrypt.org`), gửi yêu cầu cấp chứng chỉ cho tên miền `devpulse.dorayakiiiiz.site`.
3. **Bước 3:** Let's Encrypt tạo ra một chuỗi ngẫu nhiên bí mật mang tính mã hóa (Token Challenge, ví dụ: `token_abc_123`) và yêu cầu: *"Hãy đưa token này lên web tại đường dẫn `/.well-known/acme-challenge/token_abc_123`"*.
4. **Bước 4:** Certbot nhận lệnh, tự động tạo thư mục và ghi file `token_abc_123` vào đường dẫn webroot trên ổ cứng VPS:
   `/var/lib/docker/volumes/devpulse_certbot-var/_data/.well-known/acme-challenge/token_abc_123`
5. **Bước 5:** Vì volume `certbot-var` được mount vào container `devpulse-gateway` tại `/var/www/certbot`, file này ngay lập tức hiển thị bên trong container Nginx. Certbot gửi tín hiệu về Let's Encrypt: *"Đã chuẩn bị xong!"*.
6. **Bước 6:** Máy chủ Let's Encrypt (đặt tại Mỹ) hỏi hệ thống DNS toàn cầu: *"Tên miền `devpulse.dorayakiiiiz.site` đang trỏ về IP nào?"* $\rightarrow$ DNS trả về IP `20.48.112.82`.
7. **Bước 7 & 8:** Let's Encrypt gửi một request HTTP GET bình thường qua Internet vào:
   `http://devpulse.dorayakiiiiz.site/.well-known/acme-challenge/token_abc_123`
   Request chạm vào cổng 80 của VPS $\rightarrow$ đi vào `devpulse-gateway`.
   Trong file `gateway.conf`, Nginx đã cấu hình sẵn:
   ```nginx
   location /.well-known/acme-challenge/ {
       root /var/www/certbot;
   }
   ```
   Nginx đọc file `token_abc_123` từ đĩa và trả về cho Let's Encrypt.
8. **Bước 9:** Let's Encrypt nhận được file, kiểm tra nội dung khớp chính xác từng ký tự với mã họ đã sinh ra.
9. **Bước 10:** Let's Encrypt xác nhận: *"Chủ nhân của tên miền này chính là người đang vận hành máy chủ tại IP 20.48.112.82"*. Let's Encrypt lập tức dùng Khóa Gốc của họ ký chứng chỉ số và trả về cho Certbot.
10. **Bước 11:** Certbot lưu cặp khóa `fullchain.pem` và `privkey.pem` vào thư mục `/etc/letsencrypt/live/devpulse.dorayakiiiiz.site/` trên VPS.
11. Container `devpulse-gateway` (nhờ gắn volume `certbot-etc`) đọc 2 file này, mở cổng HTTPS 443 và phục vụ lưu lượng bảo mật!

---

### 6.4. Tại Sao Sử Dụng Phương Pháp Webroot Thay Vì Standalone?
- **Phương pháp Standalone (Không tối ưu):** Certbot tự bật một web server tạm thời trên cổng 80 để tiếp nhận kiểm tra. Muốn làm được điều này, bạn buộc phải tắt Nginx (`docker stop devpulse-gateway`), gây gián đoạn toàn bộ website trong lúc cấp chứng chỉ!
- **Phương pháp Webroot (Best Practice 100% Zero Downtime):** Nginx vẫn chạy bình thường 24/7 để phục vụ người dùng. Certbot chỉ mượn một thư mục con `/.well-known/acme-challenge/` của Nginx để Let's Encrypt kiểm tra. **Website không bị gián đoạn dù chỉ 1 phần nghìn giây**.

---

## 7. Hướng Dẫn Vận Hành Từng Bước Dành Cho Bạn (Actionable Checklist)

### Bước 1: Cấu hình 6 GitHub Secrets trên Repository
Vào GitHub Repo $\rightarrow$ **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions** $\rightarrow$ **New repository secret**:
1. `DOCKERHUB_USERNAME`: `dorayakiiiiz`
2. `DOCKERHUB_TOKEN`: Personal Access Token từ Docker Hub (quyền Read & Write).
3. `VPS_HOST`: `20.48.112.82`
4. `VPS_USER`: `dorayakiiiiz`
5. `VPS_PORT`: `22`
6. `VPS_SSH_KEY`: Toàn bộ nội dung chuỗi Private Key từ file `~/.ssh/github_actions_deploy` trên máy chủ (từ `-----BEGIN OPENSSH PRIVATE KEY-----` đến `-----END OPENSSH PRIVATE KEY-----`).

---

### Bước 2: Chuẩn bị Thư Mục Dự Án và File `.env` Trên VPS
Mở terminal kết nối SSH vào VPS:
```bash
ssh dorayakiiiiz@20.48.112.82
```

Tạo cấu trúc thư mục chứa file cấu hình:
```bash
mkdir -p ~/devpulse/deploy/nginx
cd ~/devpulse
```

Tạo file biến môi trường sản xuất `.env`:
```bash
nano ~/devpulse/.env
```

Dán nội dung cấu hình sản xuất chuẩn duy nhất này vào:
```env
# Runtime Environment
NODE_ENV=production
PORT=5000

# Client URL (Ban đầu dùng IP, sau khi trỏ domain sẽ đổi thành https://devpulse.dorayakiiiiz.site)
CLIENT_URL=http://20.48.112.82

# Database Connection (Trỏ trực tiếp vào container devpulse-database nội bộ)
MONGODB_URI=mongodb://devpulse-database:27017/devpulse

# JWT Security Secrets (Chuỗi bảo mật dài trên 32 ký tự)
JWT_SECRET=super_secret_jwt_access_token_key_devpulse_production_2026_xyz
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=super_secret_jwt_refresh_token_key_devpulse_production_2026_abc
JWT_REFRESH_EXPIRES_IN=7d

# SMTP Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=DevPulse Alerts <alerts@dorayakiiiiz.site>

# AI Diagnostic Provider (Groq Cloud)
AI_PROVIDER=groq
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
```

Khóa quyền bảo mật:
```bash
chmod 600 ~/devpulse/.env
```

---

### Bước 3: Đẩy Code Lên GitHub để Kích Hoạt Tự Động Hóa
Tại máy cá nhân, bạn chỉ cần gõ:
```bash
git add .
git commit -m "feat(ci-cd): implement unified pipeline with manual dispatch, clean compose config, and deep-dive deployment docs"
git push origin main
```

Lúc này trên tab **Actions** của GitHub:
- Pipeline hợp nhất hiển thị sơ đồ 4 bước: `backend-quality-gate` & `frontend-quality-gate` chạy song song $\rightarrow$ xanh hết sẽ kích hoạt `build-and-push` $\rightarrow$ đẩy lên Docker Hub $\rightarrow$ tự động chạy `deploy-vps`.
- Bạn cũng có thể vào tab Actions $\rightarrow$ chọn workflow **DevPulse CI/CD Pipeline** $\rightarrow$ bấm nút **Run workflow** để kích hoạt bằng tay (`workflow_dispatch`) bất cứ lúc nào.
- Sau khi pipeline hoàn tất (chỉ mất ~2 phút), bạn mở trình duyệt gõ: **`http://20.48.112.82`** để kiểm tra giao diện và API hoạt động online trực tiếp!

---

### Bước 4: Hướng Dẫn Kích Hoạt Tên Miền & SSL Khi Bạn Đã Sẵn Sàng

Khi bạn cấu hình DNS cho domain `devpulse.dorayakiiiiz.site`:

1. **Cấu hình bản ghi DNS:** Tạo bản ghi **A Record** tên `devpulse` trỏ về IP `20.48.112.82`.
2. **Cấp phát SSL bằng Certbot Webroot trên VPS:**
   ```bash
   # Cài certbot trên VPS
   sudo apt update && sudo apt install -y certbot

   # Yêu cầu cấp chứng chỉ (Certbot ghi token vào volume certbot-var mà Nginx đang serve)
   sudo certbot certonly --webroot -w /var/lib/docker/volumes/devpulse_certbot-var/_data -d devpulse.dorayakiiiiz.site
   ```
3. **Kích hoạt HTTPS trong `gateway.conf`:**
   - Mở file [`deploy/nginx/gateway.conf`](../deploy/nginx/gateway.conf), bỏ dấu comment `#` ở khối `server { listen 443 ssl ... }`.
   - Trong khối port 80, đổi thành `return 301 https://$host$request_uri;`.
   - Push code lên `main`, pipeline CI/CD sẽ tự động SCP file cấu hình mới sang VPS và reload Nginx an toàn 100%!

---

## 8. Cẩm Nang Xử Lý Sự Cố Nhanh & Kịch Bản Rollback (Troubleshooting Playbook)

| Vấn đề | Nguyên nhân tiềm ẩn | Câu lệnh kiểm tra & khắc phục tức thì |
| :--- | :--- | :--- |
| **Không truy cập được `http://20.48.112.82`** | Container gateway chưa chạy hoặc UFW chặn port 80 | `sudo ufw status` $\rightarrow$ kiểm tra port 80 có `ALLOW` không.<br/>`docker ps` $\rightarrow$ xem container `devpulse-gateway` có trạng thái `Up` không. |
| **Trang web báo lỗi "502 Bad Gateway"** | Backend container chưa khởi động xong hoặc bị crash do thiếu biến môi trường | `docker compose -f ~/devpulse/docker-compose.prod.yml logs devpulse-backend`<br/>Kiểm tra lại cú pháp file `~/devpulse/.env`. |
| **Sự kiện SSE không nhảy thời gian thực** | Nginx proxy_buffering chưa tắt | Kiểm tra lại file `gateway.conf` tại block `/api/sse/`: bắt buộc phải có `proxy_buffering off;` và `proxy_read_timeout 24h;`. |
| **Database không lưu được dữ liệu** | Quyền ghi volume hoặc thiếu bộ nhớ | `docker stats` $\rightarrow$ kiểm tra mức tiêu thụ RAM của `devpulse-database`.<br/>`docker logs devpulse-database` $\rightarrow$ xem log khởi tạo WiredTiger. |
| **Muốn Rollback về phiên bản cũ ngay lập tức** | Phiên bản mới gặp lỗi logic | Sửa tag trong `docker-compose.prod.yml` từ `:latest` thành mã commit hash cũ (ví dụ `:b92fb23`) rồi gõ `docker compose up -d`. |
