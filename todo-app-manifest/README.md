# GitOps manifest cho Todo App

Repository này lưu trạng thái Kubernetes mong muốn cho Todo App và các dịch vụ dùng chung trên EKS. Monitoring được cài bằng Helm chart. Cloudflare ExternalDNS là phần mở rộng tùy chọn và hiện chưa được đưa vào danh sách Kustomize đang sync vì dự án chưa có domain.

## Cấu trúc và Application tree

~~~text
bootstrap/root-app.yaml
  └── apps/
      ├── k8s-infra ──> infra/apps/
      │                  ├── StorageClass ebs-sc
      │                  ├── aws-load-balancer-controller (Helm)
      │                  └── monitoring ──> monitoring/apps/
      │                                      ├── monitoring-stack (Helm Umbrella: kube-prometheus-stack, loki, tempo, alloy)
      │                                      └── monitoring-config (Kustomize: ServiceMonitor, rules, AlertmanagerConfig, Grafana)
      ├── todo-dev ───> applications/todo/overlays/dev
      └── todo-prod ──> applications/todo/overlays/prod
~~~

Trên giao diện Argo CD sẽ có tám Application đang hoạt động: `root-app`, `k8s-infra`, `todo-dev`, `todo-prod`, `aws-load-balancer-controller`, `monitoring`, `monitoring-stack` và `monitoring-config`. AppProject là ranh giới phân quyền của Argo CD, không phải Application. File `cloudflare-dns` đã được chuẩn bị nhưng chưa được khai báo trong `infra/apps/kustomization.yaml` nên chưa được sync.

## Todo App và ConfigMap

Hai overlay dev và prod dùng chung applications/todo/base/, nhưng chọn Namespace, số replica và image tag riêng. Ingress chưa khai báo hostname; có thể truy cập ứng dụng bằng hostname của ALB sau khi AWS Load Balancer Controller tạo Load Balancer. Chưa cần domain riêng.

Mỗi overlay tạo một ConfigMap tên `todo-backend-config` với `PORT`, `APP_ENV`, `LOG_LEVEL` (`debug` ở dev, `info` ở prod), `MONGODB_URI`, `OTEL_SERVICE_NAME` và `OTEL_EXPORTER_OTLP_ENDPOINT` riêng. Kustomize thêm hash vào tên ConfigMap và cập nhật tham chiếu trong Deployment; khi cấu hình thay đổi, Pod backend sẽ tự rollout lại. Container `backend` bật `securityContext` chạy non-root (`runAsUser: 1000`). Overlay `prod` bổ sung thêm `PodDisruptionBudget` (`backend-pdb`, `frontend-pdb`), tăng tài nguyên backend, cấp `20Gi` cho MongoDB và gắn annotation `argocd.argoproj.io/sync-options: Prune=false,Delete=false` để tránh Argo CD xóa nhầm dữ liệu khi prune.

Các image tag toàn số 0 hiện chỉ là placeholder. CI publish image vào cặp ECR repo `todo-app-backend-dev` và `todo-app-frontend-dev` (khớp với `todo-app-infra/lives/dev`) với tag dạng `sha-<full-git-commit>`, nhưng chưa tự cập nhật repository GitOps này. Hai overlay dev và prod đã dùng `newName` trỏ tới `-dev` để promote cùng một `sha-<commit>` trên cùng cluster (nếu sau này triển khai `lives/prod` riêng thì đổi `newName` ở `overlays/prod` sang `-prod`). Trước khi sync, hãy thay tag của backend và frontend ở dev bằng tag đã tồn tại trong ECR. Sau khi kiểm tra dev, dùng chính hai tag đó để promote sang prod.

Backend sử dụng HTTP probe (`readinessProbe: /readyz`, `livenessProbe: /healthz`) và frontend sử dụng HTTP probe `/healthz`. Workflow [`.github/workflows/validate.yml`](.github/workflows/validate.yml) kiểm tra `kubectl kustomize` và JSON dashboard cho mỗi PR/push lên `main`.

## Dịch vụ được quản lý bằng Helm

- infra/apps/aws-load-balancer-controller.yaml cài AWS Load Balancer Controller chart phiên bản 1.14.0. Helm chart tạo ServiceAccount aws-load-balancer-controller và gắn annotation IRSA.
- infra/apps/monitoring.yaml trỏ tới `monitoring/apps/`, tách hệ thống quan sát thành **2 Application**:
  - `monitoring-stack` (`monitoring/stack/`): Helm Umbrella Chart gom `kube-prometheus-stack` (93.6.0), `loki` (21.4.3), `tempo` (3.2.1) và `alloy` (1.16.0). Prometheus, Alertmanager, Loki và Tempo lưu dữ liệu trên `ebs-sc`; Grafana đọc thông tin đăng nhập từ Secret có sẵn.
  - `monitoring-config` (`monitoring/config/`): Kustomize thuần chứa `ServiceMonitor`, `PrometheusRule`, ConfigMap Loki rules, `AlertmanagerConfig` (template email được đóng gói sẵn trong `monitoring/stack/values.yaml` qua `alertmanager.templateFiles`), Grafana datasources (liên kết Metric–Log–Trace) và dashboards.
- infra/apps/cloudflare.yaml chuẩn bị ExternalDNS chart phiên bản 1.24.0. Chỉ bật khi đã có domain: cập nhật domainFilters, bỏ placeholder, thêm file vào infra/apps/kustomization.yaml và tạo Secret Cloudflare trong Namespace external-dns.

Argo CD dùng Helm để render chart rồi quản lý vòng đời các resource đó. Không cài cùng một chart thêm lần nữa bằng lệnh helm install. Trước khi sync `monitoring-stack` lần đầu, chạy `helm dependency update monitoring/stack` và commit `Chart.lock`.

## Cấu trúc Observability

Xem chi tiết kiến trúc, lệnh `kubectl port-forward` và các bước kiểm tra tại [monitoring/README.md](monitoring/README.md).

## Terraform và Secret cần chuẩn bị

Terraform trong repository todo-app-infra2 bật OIDC/IRSA cho EKS, tạo IAM role cho EBS CSI Driver và cài EKS add-on aws-ebs-csi-driver. Terraform cũng tạo IAM role cùng policy cho AWS Load Balancer Controller.

Sau terraform apply, lấy role ARN bằng lệnh sau rồi điền vào annotation eks.amazonaws.com/role-arn trong infra/apps/aws-load-balancer-controller.yaml:

~~~bash
terraform output -raw aws_load_balancer_controller_role_arn
~~~

Trước khi sync monitoring, tạo Secret `grafana-admin` và `alertmanager-smtp` ngoài Git. Ví dụ:

~~~bash
kubectl create namespace monitoring
kubectl create secret generic grafana-admin -n monitoring \
  --from-literal=admin-user=admin \
  --from-literal=admin-password='REPLACE_WITH_A_STRONG_PASSWORD'
kubectl create secret generic alertmanager-smtp -n monitoring \
  --from-literal=smtp-auth-password='REPLACE_WITH_GMAIL_APP_PASSWORD'
~~~

Nếu bật Cloudflare, tạo Namespace external-dns và Secret cloudflare-api-key với key apiKey. Không commit giá trị credential vào Git.

Terraform hiện chỉ tạo một EKS cluster. Vì vậy dev và prod dùng Namespace khác nhau, mỗi môi trường có MongoDB và EBS volume riêng trong cùng cluster. Cách ly này không tương đương với việc dùng hai cluster riêng.

## Sync wave và bootstrap lần đầu

Các manifest đặt Application hạ tầng trước Todo. Bên trong hạ tầng, StorageClass và AWS Load Balancer Controller được sync trước monitoring. Để App-of-Apps chờ Application con khỏe giữa các sync wave, cần khôi phục health check cho Application trong argocd-cm trước khi bootstrap. Lệnh PowerShell sau chỉ thêm cấu hình cần thiết và giữ lại các mục data khác trong ConfigMap:

~~~powershell
kubectl patch configmap argocd-cm -n argocd --type merge --patch '{"data":{"resource.customizations.health.argoproj.io_Application":"hs = {}\nhs.status = [=[Progressing]=]\nhs.message = [=[]=]\nif obj.status ~= nil then\n  if obj.status.health ~= nil then\n    hs.status = obj.status.health.status\n    if obj.status.health.message ~= nil then\n      hs.message = obj.status.health.message\n    end\n  end\nend\nreturn hs"}}'
~~~

Nếu Argo CD được cài và quản lý bằng Helm hoặc Operator, hãy thêm health customization này vào cấu hình cài đặt đó thay vì patch trực tiếp argocd-cm. Sau khi health check hoạt động, root Application sẽ chờ Application hạ tầng khỏe rồi mới tạo các Application Todo.

Sau khi Argo CD đã cài trong Namespace argocd, AWS prerequisites và role ARN đã sẵn sàng, image tag thật đã được điền và Secret Grafana đã được tạo, bootstrap bằng lệnh:

~~~bash
kubectl apply -f bootstrap/root-app.yaml
~~~

Application todo-app cũ đang theo dõi k8s-manifests/ và cũng khai báo ebs-sc. Hãy lên kế hoạch chuyển đổi rồi mới ngừng Application cũ; automated prune có thể xóa resource cũ khi đường dẫn đó không còn. Sao lưu hoặc di chuyển dữ liệu MongoDB cần giữ lại. StatefulSet mới tạo PVC mới và không tự nhập dữ liệu từ PVC cũ.

ebs-sc dùng reclaimPolicy: Retain. Khi xóa PVC, EBS volume vẫn được giữ lại và có thể tiếp tục phát sinh chi phí. Chỉ xóa volume đã Retain sau khi xác nhận không còn cần dữ liệu.
