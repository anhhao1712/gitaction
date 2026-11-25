# SonarQube Cloud trong CI

Workflow dùng SonarQube Cloud trên GitHub hosted runner. Không cần Docker, self hosted runner, `SONAR_MODE` hoặc `SONAR_HOST_URL`.

1. Trong [SonarQube Cloud](https://sonarcloud.io), tạo organization và import repository này. Chọn phân tích bằng CI; tắt Automatic Analysis nếu đang bật.
2. Trong GitHub repository, mở **Settings → Secrets and variables → Actions → Variables** và tạo `SONAR_ORGANIZATION` (organization key) cùng `SONAR_PROJECT_KEY` (project key).
3. Tạo analysis token trong SonarQube Cloud, rồi lưu token vào GitHub **Actions → Secrets** với tên `SONAR_TOKEN`. Không ghi token vào mã nguồn hoặc chat.
4. Chạy workflow. Test backend và frontend tạo LCOV; job SonarQube Cloud tải cả hai báo cáo, gửi phân tích và ghi trạng thái Quality Gate vào phần GitHub Actions Summary mà **không chặn** bước đẩy image lên ECR (Test và Trivy là hai gate bắt buộc cho `publish`). Nếu sau này muốn siết chặt Quality Gate on New Code ở bước Pull Request, chỉ cần sửa `continue-on-error: ${{ github.event_name != 'pull_request' }}` trong job `sonarqube`.

Đường dẫn LCOV được khai báo trong `sonar.javascript.lcov.reportPaths`. Nếu một báo cáo coverage không được tạo hoặc thiếu mã nguồn tương ứng, job Sonar sẽ báo lỗi rõ ràng.
