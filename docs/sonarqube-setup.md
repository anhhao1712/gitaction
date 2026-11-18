# SonarQube Cloud trong CI

Workflow dùng SonarQube Cloud trên GitHub hosted runner. Không cần Docker, self hosted runner, `SONAR_MODE` hoặc `SONAR_HOST_URL`.

1. Trong [SonarQube Cloud](https://sonarcloud.io), tạo organization và import repository này. Chọn phân tích bằng CI; tắt Automatic Analysis nếu đang bật.
2. Trong GitHub repository, mở **Settings → Secrets and variables → Actions → Variables** và tạo `SONAR_ORGANIZATION` (organization key) cùng `SONAR_PROJECT_KEY` (project key).
3. Tạo analysis token trong SonarQube Cloud, rồi lưu token vào GitHub **Actions → Secrets** với tên `SONAR_TOKEN`. Không ghi token vào mã nguồn hoặc chat.
4. Chạy workflow. Test backend và frontend tạo LCOV; job SonarQube Cloud tải cả hai báo cáo và chờ Quality Gate. Chỉ khi các kiểm tra đạt thì job đẩy image lên ECR mới chạy.

Đường dẫn LCOV được khai báo trong `sonar.javascript.lcov.reportPaths`. Nếu một báo cáo coverage không được tạo hoặc thiếu mã nguồn tương ứng, job Sonar sẽ báo lỗi rõ ràng.
