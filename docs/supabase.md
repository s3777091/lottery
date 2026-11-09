# Đăng nhập Supabase và database `lottery`

## Tổng quan

| Thành phần | Ở đâu | Dùng chung với Jetsona? |
|---|---|---|
| Đăng nhập | Supabase Auth (GoTrue) của Jetsona, gọi qua Kong `http://127.0.0.1:18000` | **Có** – cùng danh sách tài khoản. Tạo / xóa / đổi mật khẩu trong Studio: https://supabase.protexa.cloud → Authentication → Users |
| Dữ liệu riêng của lottery | Database **`lottery`** trong container `supabase-db` (Postgres của Supabase) | **Không** – database riêng, role riêng |
| Danh sách người chơi (thử / thật), kết quả, màn chiếu, cài đặt | Database `lottery`: bảng `app_state`, `datasets` | Không |

App **không** tạo bảng, không sửa dữ liệu nào trong database `postgres` của Jetsona. Việc duy nhất xảy ra ở phía Jetsona
khi đăng nhập là GoTrue tự ghi phiên đăng nhập (`auth.sessions`, `auth.refresh_tokens`) như mọi app dùng Supabase Auth.

Ai có tài khoản trong Supabase Auth đều đăng nhập được. Muốn giới hạn, đặt `LOTTERY_ALLOWED_EMAILS=a@x.com,b@y.com`
trong `/etc/lottery/lottery.env` rồi `systemctl restart lottery`.

## Những gì đã tạo trên VM

1. **Role Postgres `lottery_app`** (cluster-wide): `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE`. Không có quyền trên bảng nào của Jetsona.
2. **Database `lottery`**, owner `lottery_app` (định nghĩa ở [db/schema.sql](../db/schema.sql)):
   - `app_state` – 1 dòng: danh sách đang dùng (`mode` = `test` / `real`), cài đặt (`settings`: hiệu ứng, kịch bản từng lượt,
     tỷ lệ phòng ban, nội dung thẻ, bật/tắt nhãn "CHẾ ĐỘ THỬ"), lệnh màn chiếu (`command`), `version`.
   - `datasets` – 2 dòng, `test` (danh sách thử) và `real` (danh sách thật do người dùng upload). Mỗi dòng có
     `people`, `source_file`, `winners`, `excluded` (vắng mặt), `draw_count`. Kết quả của hai danh sách tách riêng.
   - View chỉ để đọc: `people_view`, `winners_view` (tách JSON thành từng dòng để truy vấn SQL).
   - `admins` – mỗi tài khoản đã đăng nhập vào lottery: `user_id` (id Supabase Auth), `email`, `first_login_at`, `last_login_at`, `login_count`.
   - `audit_log` – nhật ký thao tác: `login`, `login:failed`, `logout`, `draw` (kèm tên người trúng), `action:*` (vắng mặt, xoá, reset), `state:update`, `export`.
3. **Container `lottery-db-proxy`** (image `alpine/socat`, `--restart unless-stopped`, nhãn `purpose=lottery`):
   chuyển tiếp `127.0.0.1:25432` → `supabase-db:15432` trong mạng Docker `supabase_default`.
   Cần vì cổng `127.0.0.1:15432` trên VM là pooler Supavisor (chỉ phục vụ database của Jetsona) và Docker chặn kết nối
   thẳng từ VM vào container. Không sửa docker-compose hay `.env` của Jetsona.
4. **File cấu hình** `/etc/lottery/lottery.env` (quyền 600): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL` (chứa mật khẩu `lottery_app`).
   Được nạp bởi `/etc/systemd/system/lottery.service` (`EnvironmentFile=`).

## Xem dữ liệu

```bash
docker exec -it supabase-db psql -U supabase_admin -d lottery
```

```sql
select email, login_count, last_login_at from admins order by last_login_at desc;
select at, email, action, detail from audit_log order by at desc limit 50;
select mode, count(*) from people_view group by mode;            -- số người mỗi danh sách
select * from winners_view where mode = 'real' order by won_at;  -- kết quả danh sách thật
select mode, settings from app_state;                            -- danh sách đang dùng + cài đặt
```

(Studio chỉ hiển thị database `postgres`, nên database `lottery` xem bằng psql như trên.)

Lần đầu app chạy với database rỗng, nó tự nhập `/opt/lottery/data/state.json` (nếu có) làm **danh sách thử**.
Sau đó file này không được dùng nữa (giữ lại làm bản sao lưu). Sửa tay trong database thì chạy `systemctl restart lottery`
để app đọc lại.

## Xoá hoàn toàn dữ liệu lottery khỏi Supabase

Chạy trên VM. Các lệnh này chỉ đụng tới database `lottery` và role `lottery_app`, không ảnh hưởng Jetsona.

```bash
# 1. Dừng app để đóng kết nối tới database
systemctl stop lottery

# 2. Xoá database và role
docker exec -i supabase-db psql -U supabase_admin -d postgres -c "DROP DATABASE IF EXISTS lottery WITH (FORCE);"
docker exec -i supabase-db psql -U supabase_admin -d postgres -c "DROP ROLE IF EXISTS lottery_app;"
docker rm -f lottery-db-proxy
docker image rm alpine/socat   # tuỳ chọn

# 3. Bỏ DATABASE_URL khỏi cấu hình (app quay về lưu trong data/state.json và không ghi log)
sed -i '/^DATABASE_URL=/d' /etc/lottery/lottery.env
systemctl start lottery
```

Muốn gỡ luôn đăng nhập Supabase: xoá `SUPABASE_URL` và `SUPABASE_ANON_KEY` khỏi `/etc/lottery/lottery.env` — khi đó app
trả lỗi 503 cho tới khi cấu hình lại (cố ý, để không vô tình mở trang cho mọi người).

Tài khoản đã tạo trong Supabase Auth cho lottery (nếu có) xoá trong Studio → Authentication → Users.

## Tạo lại database (sau khi xoá, hoặc trên máy khác)

```bash
PW=$(openssl rand -hex 24)
docker exec -i supabase-db psql -U supabase_admin -d postgres -c "CREATE ROLE lottery_app LOGIN PASSWORD '$PW' NOSUPERUSER NOCREATEDB NOCREATEROLE;"
docker exec -i supabase-db psql -U supabase_admin -d postgres -c "CREATE DATABASE lottery OWNER lottery_app;"
docker exec -i supabase-db psql -U supabase_admin -d lottery -c "REVOKE ALL ON DATABASE lottery FROM PUBLIC; ALTER SCHEMA public OWNER TO lottery_app; REVOKE ALL ON SCHEMA public FROM PUBLIC;"
docker exec -i -e PGPASSWORD="$PW" supabase-db psql -h 127.0.0.1 -U lottery_app -d lottery < /opt/lottery/db/schema.sql
docker run -d --name lottery-db-proxy --restart unless-stopped --network supabase_default -p 127.0.0.1:25432:5432   --label purpose=lottery alpine/socat:latest TCP-LISTEN:5432,fork,reuseaddr TCP:supabase-db:15432
echo "DATABASE_URL=postgres://lottery_app:$PW@127.0.0.1:25432/lottery" >> /etc/lottery/lottery.env
systemctl restart lottery
```
