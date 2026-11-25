# Hệ thống giám sát và cảnh báo (Observability)

Thư mục này triển khai giám sát đầy đủ **Metrics – Logs – Traces – Alerting** cho Todo App và cụm EKS theo mô hình **2 Argo CD Application** để vừa gọn trên giao diện Argo CD vừa tách biệt giữa phần mềm cài đặt và cấu hình vận hành hằng ngày.

## Cấu trúc

~~~text
monitoring/
├── apps/                       # App of Apps con cho monitoring (sync bởi infra/apps/monitoring.yaml)
│   ├── kustomization.yaml
│   ├── monitoring-stack.yaml   # Application 1: Helm umbrella chart (wave 1)
│   └── monitoring-config.yaml  # Application 2: Kustomize thuần (wave 2)
├── stack/                      # Helm Umbrella Chart
│   ├── Chart.yaml              # kube-prometheus-stack, loki, tempo, alloy
│   └── values.yaml             # Cấu hình chung (retention, PVC ebs-sc, sidecar, Alloy pipeline)
├── config/                     # Phần cấu hình thay đổi hằng ngày
│   ├── scrape/                 # ServiceMonitor cho Todo backend
│   ├── alerts/                 # PrometheusRule, ConfigMap Loki rules, AlertmanagerConfig (email.tmpl nằm trong stack/values.yaml)
│   └── grafana/                # Datasource liên kết (Loki ↔ Tempo ↔ Prometheus) + Dashboard JSON
~~~

## Luồng dữ liệu

~~~text
Todo backend /metrics ──> Prometheus ──────────────────────┐
Pod logs ──> Grafana Alloy (DaemonSet) ──> Loki ───────────┼─> Grafana (nối Metric <-> Log <-> Trace)
Todo OTLP ──> Grafana Alloy (4317/4318) ─> Tempo ──────────┤
Prometheus & Loki rules ──> Alertmanager ──> Email (SMTP) ─┘
~~~

## Chuẩn bị trước khi sync trên EKS

1. **Sinh `Chart.lock` cho Umbrella Chart** (chạy 1 lần ở máy có `helm` rồi commit `monitoring/stack/Chart.lock` lên Git, không commit file `.tgz` trong `charts/`):

~~~bash
helm dependency update monitoring/stack
~~~

2. **Tạo Secret ngoài Git** trong Namespace `monitoring`:

~~~bash
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Mật khẩu đăng nhập Grafana
kubectl create secret generic grafana-admin -n monitoring \
  --from-literal=admin-user=admin \
  --from-literal=admin-password='REPLACE_WITH_A_STRONG_PASSWORD'

# App Password SMTP Gmail cho Alertmanager
kubectl create secret generic alertmanager-smtp -n monitoring \
  --from-literal=smtp-auth-password='REPLACE_WITH_GMAIL_APP_PASSWORD'
~~~

## Truy cập dashboard (giữ port-forward)

Dashboard chỉ mở cục bộ qua `kubectl port-forward` (không mở public Ingress). Kiểm tra tên Service trước nếu cần:

~~~powershell
kubectl get svc -n monitoring
~~~

Mở Grafana (`http://localhost:3000`, tài khoản lấy từ Secret `grafana-admin`):

~~~powershell
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
~~~

Mở Prometheus hoặc Alertmanager khi cần (mỗi lệnh một terminal riêng):

~~~powershell
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093
~~~

## Kiểm tra hoạt động và thử alert

1. Mở Grafana tại `http://localhost:3000`, chọn dashboard **Todo App Overview** hoặc **EKS Cluster Overview** và lọc theo `todo-dev` / `todo-prod`.
2. Kiểm tra Prometheus Targets để xác nhận `ServiceMonitor` `todo-backend` ở trạng thái `UP`.
3. Thử alert `TodoBackendUnavailable` trên môi trường dev:

~~~bash
kubectl -n todo-dev scale deployment/backend --replicas=0
~~~

Sau khoảng 2 phút, alert chuyển sang `Firing` trong Alertmanager và gửi email theo `monitoring/config/alerts/alertmanager-config.yaml`. Scale lại `--replicas=1` để nhận thông báo `Resolved`.

## Mở rộng sau (Kubecost / OpenCost)

- Khi cần **Dashboard Cost** theo từng Namespace (`todo-dev`, `todo-prod`, `monitoring`), Pod và EBS PVC trên EKS: thêm dependency **Kubecost** hoặc **OpenCost** vào `monitoring/stack/Chart.yaml`.
- Cấu hình **tái sử dụng Prometheus sẵn có** (`http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090`) và tắt Prometheus đi kèm của Kubecost/OpenCost để tiết kiệm RAM.
- Thêm file dashboard JSON tương ứng vào `monitoring/config/grafana/dashboards/` để Grafana sidecar tự nạp (dashboard-as-code).
- Kết hợp thêm **AWS Cost Explorer + AWS Budgets** để theo dõi các chi phí ngoài cluster (EKS Control Plane, NAT Gateway, ECR, S3).
