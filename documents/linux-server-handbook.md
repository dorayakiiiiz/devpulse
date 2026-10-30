# Linux Server Setup and Operations Handbook

Cẩm nang chuẩn hóa quy trình cấu hình, bảo mật, cài đặt môi trường và vận hành Linux VPS từ giai đoạn mới khởi tạo đến khi sẵn sàng tiếp nhận pipeline CI/CD tự động.

---

## 1. Initial SSH Access and Shell Verification

### 1.1. Connect via SSH
Kết nối từ máy trạm cá nhân vào máy chủ thông qua SSH Key hoặc tài khoản đã thiết lập trong quá trình tạo máy ảo:

```bash
# Kết nối sử dụng SSH Key
ssh -i /path/to/private_key user@<vps_ip>
# Ví dụ: ssh -i "E:\Internship\DevOps\Test\key\devpulse_key.pem" dorayakiiiiz@20.48.112.82

# Kết nối thông thường qua username và mật khẩu
ssh user@<vps_ip>
```

### 1.2. Verify Operating System and System Resources
Kiểm tra cấu hình phần cứng cơ bản của máy chủ sau khi đăng nhập thành công:

```bash
# Kiểm tra phiên bản hệ điều hành
lsb_release -a

# Kiểm tra số lượng CPU core
nproc

# Kiểm tra dung lượng RAM và Swap
free -h

# Kiểm tra dung lượng ổ đĩa SSD
df -h /
```

---

## 2. System Update and Package Housekeeping

### 2.1. Update Package Repositories
Đồng bộ danh sách package và nâng cấp toàn bộ các package hệ thống lên phiên bản mới nhất:

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2. Clean Outdated Packages and Cache
Xóa bỏ các package phụ thuộc cũ không còn sử dụng và dọn sạch bộ đệm APT để giải phóng dung lượng ổ đĩa:

```bash
# Xóa package phụ thuộc mồ côi
sudo apt autoremove -y

# Xóa các file cài đặt .deb đã tải về trong cache
sudo apt clean
sudo apt autoclean
```

---

## 3. Swap Space Configuration

Đối với các gói VPS dung lượng RAM từ 1GB đến 2GB, cấu hình 2GB Swap Memory trên ổ đĩa SSD là bắt buộc để ngăn ngừa lỗi sập tiến trình do cạn kiệt bộ nhớ vật lý (*Out Of Memory - OOM*).

### 3.1. Verify Existing Swap
Kiểm tra xem hệ thống đã có Swap hay chưa:

```bash
swapon --show
```
Nếu kết quả không xuất hiện dòng nào, tiến hành tạo mới theo các bước bên dưới.

### 3.2. Create and Activate 2GB Swap File
```bash
# Tạo file swap có kích thước 2GB
sudo fallocate -l 2G /swapfile

# Phân quyền chỉ cho phép root đọc và ghi
sudo chmod 600 /swapfile

# Định dạng file thành không gian swap
sudo mkswap /swapfile

# Kích hoạt swap
sudo swapon /swapfile

# Kiểm tra lại dung lượng
free -h
```

### 3.3. Persist Swap on System Reboot
Thêm cấu hình vào `/etc/fstab` để swap tự động kích hoạt mỗi khi server khởi động lại:

```bash
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3.4. Optimize Kernel Swappiness
Điều chỉnh tham số `vm.swappiness` về mức `10` để kernel chỉ dùng Swap khi RAM vật lý thực sự cạn kiệt, tránh suy giảm hiệu năng disk I/O:

```bash
# Thiết lập giá trị tạm thời
sudo sysctl vm.swappiness=10

# Thiết lập giá trị vĩnh viễn khi reboot
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
```

---

## 4. Security Hardening and Firewall Configuration

### 4.1. Azure / Cloud Provider Network Security Group (NSG)
Trước khi cấu hình tường lửa trên máy chủ, phải mở các cổng kết nối tại bảng điều khiển mạng của nhà cung cấp điện toán đám mây:
- **Port 22 (TCP):** SSH quản trị từ xa và GitHub Actions.
- **Port 80 (TCP):** HTTP nhận lưu lượng web và xác thực cấp chứng chỉ SSL Let's Encrypt.
- **Port 443 (TCP):** HTTPS mã hóa toàn bộ lưu lượng web production.

### 4.2. Configure UFW on Ubuntu
Kích hoạt tường lửa cục bộ UFW và chỉ mở đúng 3 cổng mạng tiêu chuẩn:

```bash
# Mặc định từ chối toàn bộ kết nối đi vào và cho phép kết nối đi ra
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Mở cổng kết nối
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Kích hoạt tường lửa
sudo ufw --force enable

# Kiểm tra trạng thái tường lửa
sudo ufw status verbose
```

---

## 5. Docker Engine and Docker Compose Installation

Cài đặt Docker Engine và Docker Compose plugin chính thức từ kho lưu trữ của Docker để đảm bảo độ ổn định và tính tương thích cao nhất.

### 5.1. Install Prerequisites
```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release
```

### 5.2. Add Docker Official GPG Key and Repository
```bash
# Tạo thư mục chứa key nếu chưa có
sudo install -m 0755 -d /etc/apt/keyrings

# Tải GPG key chính thức của Docker
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Thêm kho lưu trữ Docker vào APT sources
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### 5.3. Install Docker Engine and Compose Plugin
```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 5.4. Enable Docker Service
Đảm bảo tiến trình Docker Daemon tự khởi chạy cùng hệ điều hành:

```bash
sudo systemctl enable docker
sudo systemctl start docker
```

---

## 6. Non-Root Permissions for Docker and CI/CD

Mặc định lệnh `docker` yêu cầu quyền `sudo`. Để GitHub Actions Runner có thể tự động chạy các tác vụ quản trị container mà không cần cấu hình mật khẩu sudo, phải thêm tài khoản người dùng hiện tại vào nhóm `docker`.

```bash
# Thêm user hiện tại vào nhóm docker
sudo usermod -aG docker $USER

# Áp dụng thay đổi quyền cho phiên làm việc hiện tại
newgrp docker

# Kiểm tra thực thi không cần sudo
docker ps
docker compose version
```

---

## 7. SSH Key Setup for GitHub Actions Automated Deployment

Để quy trình Continuous Deployment (CD) từ GitHub Actions có thể tự động kết nối và kéo phiên bản ứng dụng mới về máy chủ:

### 7.1. Generate Deployment Key Pair
Tạo một cặp SSH Key chuyên dụng riêng biệt cho tiến trình CI/CD:

```bash
ssh-keygen -t ed25519 -C "github-actions-cd-devpulse" -f ~/.ssh/github_actions_deploy -N ""
```

### 7.2. Authorize Public Key
Thêm public key vừa tạo vào danh sách các khóa được phép đăng nhập:

```bash
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### 7.3. Configure GitHub Repository Secrets
Đọc nội dung private key để đưa vào cấu hình CI/CD:

```bash
cat ~/.ssh/github_actions_deploy
```

Sao chép toàn bộ khối nội dung bắt đầu từ `-----BEGIN OPENSSH PRIVATE KEY-----` đến `-----END OPENSSH PRIVATE KEY-----` và thêm vào mục **Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions** của Git repository:
- `VPS_SSH_KEY`: Chuỗi nội dung private key vừa sao chép.
- `VPS_HOST`: Địa chỉ IP Public của máy chủ.
- `VPS_USER`: Tên tài khoản người dùng trên VPS (ví dụ: `dorayakiiiiz`).
- `VPS_PORT`: `22`.

---

## 8. Project Directory and Environment Configuration

Tạo sẵn cấu trúc thư mục chứa file điều phối container và biến môi trường sản xuất:

### 8.1. Create Workspace
```bash
mkdir -p ~/devpulse
cd ~/devpulse
```

### 8.2. Prepare Production Configuration Files
Thư mục dự án trên VPS chỉ cần duy trì hai tệp tin cấu hình tĩnh:

1. **`docker-compose.prod.yml`:** Bản mô tả triển khai gồm 3 containers (`devpulse-gateway`, `devpulse-backend`, `devpulse-database`).
2. **`.env`:** File lưu trữ toàn bộ các thông số bảo mật, mật khẩu cơ sở dữ liệu và API keys. Tuyệt đối không commit file này lên Git repository:

```bash
# Tạo file .env sản xuất trên máy chủ
nano ~/devpulse/.env
```

Phân quyền bảo mật cho file cấu hình môi trường:
```bash
chmod 600 ~/devpulse/.env
```

---

## 9. Automated Housekeeping and Maintenance

### 9.1. Docker Resource Cleanup
Khi GitHub Actions liên tục kéo các image mới về, các image phiên bản cũ sẽ chuyển sang trạng thái mồ côi (*dangling images*), gây tiêu hao dung lượng đĩa:

```bash
# Dọn dẹp images không sử dụng và container đã dừng
docker system prune -af --volumes=false
```

### 9.2. Systemd Journal Log Size Management
Mặc định hệ điều hành Linux ghi log không giới hạn dung lượng trong thư mục `/var/log/journal`. Giới hạn dung lượng tối đa cho file log hệ thống:

```bash
# Kiểm tra dung lượng log hiện tại
journalctl --disk-usage

# Giữ dung lượng log tối đa ở mức 100MB
sudo journalctl --vacuum-size=100M
```

Cấu hình giới hạn vĩnh viễn trong file `/etc/systemd/journald.conf`:
```bash
sudo sed -i 's/#SystemMaxUse=/SystemMaxUse=100M/' /etc/systemd/journald.conf
sudo systemctl restart systemd-journald
```

### 9.3. Automated Cleanup Cronjob
Thiết lập cronjob chạy vào 02:00 sáng Chủ Nhật hàng tuần để tự động dọn rác hệ thống và Docker images cũ:

```bash
# Mở bảng lập lịch cronjob của user
crontab -e
```

Thêm dòng sau vào cuối file:
```cron
0 2 * * 0 docker image prune -af > /dev/null 2>&1
```

---

## 10. Diagnostics and Troubleshooting Quick Reference

| Nhu cầu kiểm tra | Câu lệnh thực thi |
| :--- | :--- |
| **Theo dõi mức tiêu thụ RAM/CPU thời gian thực** | `htop` (hoặc `top`) |
| **Xem mức độ tiêu thụ tài nguyên của các container** | `docker stats` |
| **Xem log trực tiếp của backend service** | `docker compose logs -f devpulse-backend` |
| **Kiểm tra trạng thái container healthcheck** | `docker ps --format "table {{.Names}}\t{{.Status}}"` |
| **Kiểm tra kết nối health endpoint cục bộ** | `curl -i http://localhost:5000/api/health` |
| **Kiểm tra dung lượng các thư mục chiếm ổ cứng lớn nhất** | `sudo du -ahx / | sort -rh | head -n 20` |
| **Khởi động lại toàn bộ stack dịch vụ** | `cd ~/devpulse && docker compose down && docker compose up -d` |
| **Kiểm tra trạng thái tường lửa** | `sudo ufw status` |

