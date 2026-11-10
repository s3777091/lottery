# Triển khai và bảo mật trên VM (36.50.27.142)

## Cập nhật code

Chạy trên VM (SSH bằng key, server không nhận mật khẩu):

```bash
cd /opt/lottery && git pull && npm ci && npm run build && systemctl restart lottery
```

Build bằng root là bình thường: mỗi lần khởi động, service tự trả quyền ghi `data/` và `.next/cache` cho user `lottery`.

## Thành phần

| Thành phần | Ở đâu |
|---|---|
| Code | `/opt/lottery` (clone từ GitHub) |
| Video 2K | `/opt/lottery-media` |
| Cấu hình, mật khẩu DB | `/etc/lottery/lottery.env` (root, quyền 600) |
| Service | `/etc/systemd/system/lottery.service`, chạy `next start` ở `127.0.0.1:3210` |
| HTTPS | Caddy: `/etc/caddy/sites/lottery.caddy` → `lottery.protexa.cloud` |
| Database | xem [supabase.md](supabase.md) |

## Bảo vệ trong app

- **Đăng nhập** bằng Supabase Auth. Mọi trang, API và video đều cần đăng nhập. Cookie phiên `httpOnly`, `Secure`, `SameSite=Lax`.
- **Đoán mật khẩu**: sai 10 lần mỗi IP hoặc 5 lần mỗi email trong 15 phút thì tạm khóa 15 phút (`login:blocked` trong `audit_log`).
- **Giả mạo request từ trang khác (CSRF)**: mọi request ghi dữ liệu phải đến từ chính trang này (kiểm tra `Origin` / `Sec-Fetch-Site`).
- **Giới hạn dữ liệu**: tối đa 5 MB mỗi request, 20 000 người mỗi danh sách.
- **Security header**: CSP (chỉ tải tài nguyên từ chính trang, không `eval`), HSTS, cấm nhúng iframe, `nosniff`, `noindex`.
  Video và hiệu ứng chỉ được lưu cache trong trình duyệt (`private`).
- **Nhật ký**: đăng nhập, quay, xoá, reset, đổi danh sách, xuất file → bảng `audit_log`.

## Bảo vệ của service (systemd)

App chạy bằng user hệ thống `lottery` (không có shell, không phải root):

- Chỉ ghi được `/opt/lottery/data` và `/opt/lottery/.next/cache`. Toàn bộ hệ thống còn lại là chỉ đọc.
- Không đọc được `/etc/lottery/lottery.env` (systemd đọc thay rồi truyền biến môi trường) và thư mục home.
- Không có capability, không leo quyền được (`NoNewPrivileges`), `/tmp` riêng, không truy cập thiết bị.
- `systemd-analyze security lottery` → 3.0 OK.

Bản service cũ (chạy root) được lưu ở `/root/lottery.service.before-hardening`.

## Bảo vệ của server

- SSH chỉ nhận key, không nhận mật khẩu (`/etc/ssh/sshd_config.d/00-key-only.conf`).
- fail2ban: sai SSH 5 lần trong 10 phút → chặn 1 giờ, tái phạm thì chặn lâu hơn, tối đa 1 tuần.
  Gỡ chặn nhầm: `fail2ban-client set sshd unbanip <IP>`.
