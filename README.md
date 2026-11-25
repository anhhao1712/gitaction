# Môi trường Test Monorepo trên AWS Learner Lab (`anhhao1712/gitaction`)

Thư mục này gộp 3 repository (`todo-app-infra`, `todo-app-manifest`, `todo-app-src`) thành **một monorepo duy nhất** để chạy kiểm thử thực tế trên tài khoản **AWS Academy Learner Lab** (`425959969184`, region `us-east-1`) mà không làm thay đổi 3 repository gốc bên ngoài.

## Các điều chỉnh đã áp dụng cho Learner Lab

- **Hạ tầng (`todo-app-infra`):**
  - Đổi region sang `us-east-1` và dùng S3 bucket có sẵn `eks-project1-state-425959969184-1791478850` với state key riêng `todo-app-lab/...`.
  - Bật `use_existing_lab_role = true` để EKS Control Plane và Managed Node Group (`2 x t3.large`, `single_nat_gateway = true`) tái sử dụng `arn:aws:iam::425959969184:role/LabRole` thay vì tạo IAM Role/KMS Key/IRSA OIDC mới.
  - Vẫn giữ `aws-ebs-csi-driver` add-on (không gán `service_account_role_arn` để Pod dùng quyền `LabRole` từ node qua IMDSv2 hop limit = 2).
  - Tắt `module "github_oidc"` (`enable_github_oidc = false`).
- **GitOps (`todo-app-manifest`):**
  - Toàn bộ 8 file Argo CD trỏ về `https://github.com/anhhao1712/gitaction.git` (nhánh `main`, prefix `todo-app-manifest/...`).
  - `aws-load-balancer-controller` bỏ annotation IRSA, chuyển `region: us-east-1`, và chờ điền `vpcId`.
  - `ebs-sc` nâng cấp lên `gp3` + `encrypted: "true"`.
  - `alertmanager-config.yaml` chuyển email về `bahao171206@gmail.com` và định tuyến mặc định về receiver `"null"` để chặn spam cảnh báo `Watchdog`.
- **CI/CD (`.github/workflows/` & `todo-app-src/`):**
  - Gộp `ci.yml` và `validate-manifests.yml` ra gốc `.github/workflows/`.
  - `publish` chặn cả bước `lint` + `test` + `Trivy HIGH/CRITICAL`, dùng tạm 3 GitHub Secrets của Learner Lab thay cho OIDC.
  - Giữ nguyên **SonarQube Cloud** (dùng `todo-app-src/backend` & `todo-app-src/frontend` + LCOV coverage).

---

## Quy trình chạy test từng bước

### Bước 1: Push monorepo lên `anhhao1712/gitaction` (`main`)

> Kiểm tra kỹ thay đổi trước khi push vì lệnh push lên `main` sẽ cập nhật remote `anhhao1712/gitaction`.

```bash
git status
git add .
git commit -m "Setup monorepo test for AWS Learner Lab"
git push -u origin main
```

---

### Bước 2: Triển khai hạ tầng EKS + VPC + ECR bằng Terragrunt

Nạp thông tin phiên AWS Learner Lab hiện tại (lấy từ mục **AWS Details** trên giao diện Lab):

**PowerShell:**
```powershell
$env:AWS_ACCESS_KEY_ID     = "<AWS_ACCESS_KEY_ID>"
$env:AWS_SECRET_ACCESS_KEY = "<AWS_SECRET_ACCESS_KEY>"
$env:AWS_SESSION_TOKEN     = "<AWS_SESSION_TOKEN>"
$env:AWS_REGION            = "us-east-1"
```

**(Tùy chọn) Tạo trước bảng DynamoDB lock nếu chưa có** (hoặc để Terragrunt tự hỏi tạo khi `init`):
```bash
aws dynamodb create-table \
  --table-name todo-app-terraform-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

Chạy Terragrunt cho môi trường `dev` (cụm EKS test dùng chung cho cả namespace `todo-dev` và `todo-prod`):
```bash
cd todo-app-infra/live/dev
terragrunt init
terragrunt plan
terragrunt apply
```

Lưu lại `vpc_id` và URL ECR vừa tạo:
```bash
terragrunt output -raw vpc_id
terragrunt output -raw backend_ecr_url
terragrunt output -raw frontend_ecr_url
```

> Lưu ý: Không chạy `todo-app-infra/live/prod` trong bản test Lab vì `prod` tắt public endpoint mà chưa có Bastion/VPN.

---

### Bước 3: Cấu hình GitHub Secrets/Variables và chạy CI

Trên GitHub repository **`anhhao1712/gitaction` → Settings → Secrets and variables → Actions**:

**Repository Secrets:**
- `AWS_ACCESS_KEY_ID` *(cập nhật lại mỗi khi phiên Lab 4 giờ hết hạn)*
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`
- `SONAR_TOKEN`

**Repository Variables:**
- `AWS_REGION` = `us-east-1`
- `ECR_ENV` = `dev`
- `SONAR_PROJECT_KEY` = `<project-key-sonarcloud>`
- `SONAR_ORGANIZATION` = `<org-key-sonarcloud>`

Sau đó:
1. Vào tab **Actions** → chọn workflow **`CI and image release`** → chạy hoặc xem lần chạy mới nhất trên nhánh `main`.
2. Mở mục **Pipeline summary** (hoặc log job `Publish`) để lấy image tag dạng `sha-<full-commit-sha>` đã đẩy lên `todo-app-backend-dev` và `todo-app-frontend-dev`.

---

### Bước 4: Điền `vpcId` và `sha-<commit>` vào `todo-app-manifest`

1. Mở [todo-app-manifest/infra/apps/aws-load-balancer-controller.yaml](todo-app-manifest/infra/apps/aws-load-balancer-controller.yaml), thay `REPLACE_WITH_TERRAFORM_OUTPUT_VPC_ID` bằng `vpc_id` lấy ở Bước 2.
2. Mở [todo-app-manifest/applications/todo/overlays/dev/kustomization.yaml](todo-app-manifest/applications/todo/overlays/dev/kustomization.yaml), thay cả 2 giá trị `newTag: sha-0000000000000000000000000000000000000000` bằng `sha-<commit>` lấy ở Bước 3.
3. Commit và push lên nhánh `main`:

```bash
git add todo-app-manifest/infra/apps/aws-load-balancer-controller.yaml \
        todo-app-manifest/applications/todo/overlays/dev/kustomization.yaml
git commit -m "Configure Lab vpcId and dev image tags"
git push origin main
```

---

### Bước 5: Kết nối EKS, cài Argo CD, tạo Secret và Bootstrap GitOps

1. Kết nối `kubectl` tới cụm EKS:
```bash
aws eks update-kubeconfig --region us-east-1 --name todo-app-dev-eks
kubectl get nodes
```

2. Cài Argo CD vào namespace `argocd`:
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl rollout status deployment/argocd-server -n argocd --timeout=300s
```

3. Patch `argocd-cm` để bật health check cho `Application` (giúp các `sync-wave` đợi hạ tầng khỏe trước khi tạo app):

**PowerShell:**
```powershell
kubectl patch configmap argocd-cm -n argocd --type merge --patch '{"data":{"resource.customizations.health.argoproj.io_Application":"hs = {}\nhs.status = [=[Progressing]=]\nhs.message = [=[]=]\nif obj.status ~= nil then\n  if obj.status.health ~= nil then\n    hs.status = obj.status.health.status\n    if obj.status.health.message ~= nil then\n      hs.message = obj.status.health.message\n    end\n  end\nend\nreturn hs"}}'
```

4. Tạo trước 2 Secret ngoài Git trong namespace `monitoring` (dùng App Password của Gmail `bahao171206@gmail.com`):
```bash
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic grafana-admin -n monitoring \
  --from-literal=admin-user=admin \
  --from-literal=admin-password='<MAT_KHAU_GRAFANA_MANH>'

kubectl create secret generic alertmanager-smtp -n monitoring \
  --from-literal=smtp-auth-password='<GMAIL_APP_PASSWORD_16_KY_TU>'
```

5. Bootstrap toàn bộ hệ thống GitOps:
```bash
kubectl apply -f todo-app-manifest/bootstrap/root-app.yaml
```

Theo dõi trạng thái sync trên Argo CD UI (nếu cần):
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
kubectl port-forward svc/argocd-server -n argocd 8443:443
```

---

### Bước 6: Kiểm tra App, Observability và Promote sang Prod

1. **Kiểm tra ALB Ingress cho `todo-dev`:**
```bash
kubectl get ingress -n todo-dev -w
```
Khi thấy `ADDRESS` dạng `k8s-tododev-todo-xxxx.us-east-1.elb.amazonaws.com`, truy cập `http://<ADDRESS>` để test tạo/sửa/xóa Todo.

2. **Kiểm tra Grafana, Prometheus, Alertmanager:**
```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093
```
- Mở Grafana `http://localhost:3000` (user `admin`) → xem dashboard **Todo App Overview** và **EKS Cluster Overview**, kiểm tra Explore ở **Prometheus**, **Loki**, **Tempo** (liên kết `trace_id` Metric ↔ Log ↔ Trace).
- Thử Alertmanager bằng cách scale backend về 0 khoảng 2 phút:
```bash
kubectl -n todo-dev scale deployment/backend --replicas=0
```
Kiểm tra email tại `bahao171206@gmail.com`, sau đó scale lại `--replicas=1` (hoặc chờ Argo CD `selfHeal` tự phục hồi).

3. **Promote sang `todo-prod`:**
- Sau khi `todo-dev` chạy ổn, copy đúng 2 `newTag: sha-<commit>` vào [todo-app-manifest/applications/todo/overlays/prod/kustomization.yaml](todo-app-manifest/applications/todo/overlays/prod/kustomization.yaml), commit và push lên `main`.
- Vào Argo CD UI (hoặc CLI) bấm **Sync** thủ công cho Application `todo-prod`.

---

### Bước 7: Dọn dẹp an toàn sau khi test xong (tránh treo VPC / mất credit Lab)

**Bắt buộc xóa tài nguyên Kubernetes có tạo ALB/EBS trước khi `terragrunt destroy`:**
```bash
# 1. Xóa các Argo CD apps (lưu ý todo-prod có annotation Delete=false ở StatefulSet mongo nên xóa namespace sau cùng)
kubectl delete application root-app -n argocd
kubectl delete ingress --all -n todo-dev
kubectl delete ingress --all -n todo-prod
kubectl delete namespace todo-dev todo-prod monitoring argocd

# 2. Kiểm tra chắc chắn không còn Load Balancer nào bám VPC
aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[*].LoadBalancerName'

# 3. Hủy hạ tầng Terraform
cd todo-app-infra/live/dev
terragrunt destroy

# 4. Kiểm tra và xóa các EBS volume bị Retain (vì ebs-sc dùng reclaimPolicy: Retain)
aws ec2 describe-volumes --region us-east-1 --filters Name=status,Values=available --query 'Volumes[*].[VolumeId,Size,Tags]' --output table
```
