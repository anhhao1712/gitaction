# SonarQube: thử trên máy cá nhân, chuyển sang Cloud sau

Workflow dùng cùng một job `SonarQube` cho hai chế độ. Chuyển chế độ bằng GitHub Actions Variables và Secret; không cần sửa YAML lần nữa.

## Thử SonarQube trên máy Windows

1. Cài Docker Desktop từ trang chính thức của Docker và khởi động Docker Engine. Trên máy hiện tại chưa tìm thấy lệnh `docker` trong PATH, nên chưa thể chạy server ở đây.
2. Trong PowerShell, chạy SonarQube Community để thử nghiệm:

   ```powershell
   docker run -d --name todo-sonarqube -p 127.0.0.1:9000:9000 `
     -v todo-sonar-data:/opt/sonarqube/data `
     -v todo-sonar-logs:/opt/sonarqube/logs `
     -v todo-sonar-extensions:/opt/sonarqube/extensions `
     sonarqube:lts-community
   ```

   Mở `http://localhost:9000`. Lần khởi động đầu có thể mất vài phút. Đăng nhập ban đầu bằng `admin` / `admin` rồi đổi mật khẩu theo màn hình. Cấu hình container một mình như trên chỉ dành cho thử nghiệm; để vận hành lâu dài cần PostgreSQL và sao lưu.
3. Trong SonarQube, tạo project thủ công cho repo này. Ghi lại **Project Key** và tạo **project analysis token**. Token chỉ hiện đầy đủ khi tạo; không gửi token qua chat hoặc commit vào Git.
4. Trong GitHub repo `phuocan803/todo-app-src`, người có quyền quản trị mở **Settings → Actions → Runners → New self-hosted runner**, chọn **Windows x64** rồi chạy các lệnh cài runner mà GitHub hiển thị trên chính máy này. Gắn thêm nhãn `sonar-local` và khởi động runner. Không chia sẻ runner registration token.
5. Trong **Settings → Secrets and variables → Actions**, tạo:

   | Loại | Tên | Giá trị |
   | --- | --- | --- |
   | Variable | `SONAR_MODE` | `local` |
   | Variable | `SONAR_HOST_URL` | `http://localhost:9000` |
   | Variable | `SONAR_PROJECT_KEY` | Project Key vừa tạo trên server cá nhân |
   | Secret | `SONAR_TOKEN` | Project analysis token của server cá nhân |

   `SONAR_ORGANIZATION` không cần trong chế độ local. Chạy lại workflow **CI and image release**. Job Sonar chạy trên runner có nhãn `sonar-local`; các job còn lại vẫn chạy trên runner của GitHub. Để tránh chạy mã từ pull request lạ trên máy cá nhân, job Sonar local chỉ chạy khi push `main` hoặc chạy thủ công.

## Chuyển sang SonarQube Cloud

Sau khi import repo vào SonarQube Cloud và tạo token Cloud, chỉ thay các giá trị trong GitHub:

| Loại | Tên | Giá trị mới |
| --- | --- | --- |
| Variable | `SONAR_MODE` | `cloud` |
| Variable | `SONAR_ORGANIZATION` | Organization Key trên Cloud |
| Variable | `SONAR_PROJECT_KEY` | Project Key trên Cloud |
| Secret | `SONAR_TOKEN` | Token mới của Cloud |

Trong chế độ Cloud, job Sonar tự chuyển sang `ubuntu-latest` và dùng `https://sonarcloud.io`; `SONAR_HOST_URL` local được bỏ qua. Không cần đổi code, Docker image hoặc AWS Secrets. Bước đẩy ECR vẫn chỉ chạy sau khi các job kiểm tra và Sonar Quality Gate đạt.
