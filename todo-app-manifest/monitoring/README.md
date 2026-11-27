# Hệ thống giám sát và cảnh báo (Observability)

Thư mục này triển khai giám sát đầy đủ **Metrics – Logs – Traces – Alerting – FinOps Cost** cho Todo App và cụm EKS theo mô hình **Argo CD Applications** để vừa gọn trên giao diện Argo CD vừa tách biệt giữa phần mềm cài đặt và cấu hình vận hành hằng ngày.

## Cấu trúc

~~~text
monitoring/
├── apps/                       # App of Apps con cho monitoring (sync bởi infra/apps/monitoring.yaml)
│   ├── kustomization.yaml
│   ├── monitoring-stack.yaml   # Application 1: Helm umbrella chart (wave 1)
│   ├── monitoring-config.yaml  # Application 2: Kustomize thuần (wave 2)
│   └── kubecost.yaml           # Application 3: Kubecost cost-analyzer v2.8.7 (wave 2)
├── stack/                      # Helm Umbrella Chart
│   ├── Chart.yaml              # kube-prometheus-stack, loki, tempo, alloy
│   └── values.yaml             # Cấu hình chung (retention, PVC ebs-sc, sidecar, Alloy pipeline)
├── config/                     # Phần cấu hình thay đổi hằng ngày
│   ├── scrape/                 # PodMonitor cho Todo backend
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

Mở Prometheus, Alertmanager hoặc Kubecost UI (`http://localhost:9091`) khi cần (mỗi lệnh một terminal riêng):

~~~powershell
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093
kubectl port-forward -n monitoring svc/kubecost-cost-analyzer 9091:9090
~~~

## Kiểm tra hoạt động và thử alert

1. Mở Grafana tại `http://localhost:3000`, chọn dashboard **Todo App Overview** hoặc **EKS Cluster Overview** và lọc theo `todo-dev` / `todo-prod`.
2. Kiểm tra Prometheus Targets để xác nhận `PodMonitor` `todo-backend` ở trạng thái `UP`.
3. Thử alert `TodoBackendUnavailable` trên môi trường dev:

~~~bash
kubectl -n todo-dev scale deployment/backend --replicas=0
~~~

Sau khoảng 2 phút, alert chuyển sang `Firing` trong Alertmanager và gửi email theo `monitoring/config/alerts/alertmanager-config.yaml`. Scale lại `--replicas=1` để nhận thông báo `Resolved`. (Có thể thử thêm alert `TodoMongoDBDisconnected` bằng `kubectl -n todo-dev scale statefulset/mongo --replicas=0` và scale lại `--replicas=1` sau khi test.)

## Giám sát chi phí (Kubecost + Cost Dashboard)

- **Kubecost (`cost-analyzer` v2.8.7)** được triển khai qua Argo CD Application `monitoring/apps/kubecost.yaml` (sync-wave `2`), sử dụng chung `kube-prometheus-stack-prometheus` sẵn có (`http://kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090`) và tắt Prometheus/Grafana đi kèm để tiết kiệm tài nguyên.
- **Grafana Cost Dashboard**: file `monitoring/config/grafana/dashboards/cost-overview.json` tự động nạp vào Grafana trong thư mục **Cost** với tên **EKS Cost Overview (Kubecost)** (tổng chi phí giờ/tháng, chi phí theo Namespace/Node/Pod, chi phí EBS PVC, Idle/Efficiency và Rightsizing).
- **Kubecost Web UI**: chạy `kubectl port-forward -n monitoring svc/kubecost-cost-analyzer 9091:9090` rồi mở `http://localhost:9091`.
- **Lưu ý trên AWS Academy Learner Lab**: Kubecost tính chi phí tài nguyên trong cụm EKS (EC2 Compute, RAM, EBS PV) hoàn toàn tự động qua **AWS Public On-Demand Pricing** (`us-east-1`), không cần quyền IAM hay Billing. Riêng tích hợp **AWS CUR / Cost Explorer** để đối soát chi phí ngoài cluster (NAT Gateway, ECR, S3) là phần tùy chọn và thường bị giới hạn quyền Billing trên tài khoản Learner Lab.
