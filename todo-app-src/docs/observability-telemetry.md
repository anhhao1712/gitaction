# Tài liệu Telemetry Todo App (Task 6.1 → Task 6.2)

Tài liệu mô tả hợp đồng dữ liệu quan sát mà `todo-app-src` phát ra để `todo-app-manifest` (Prometheus, Grafana Alloy, Loki, Tempo) thu thập và hiển thị.

## 1. Endpoints sức khỏe và metrics (Backend `:3000`)

| Endpoint | Mục đích | Phản hồi |
| --- | --- | --- |
| `GET /healthz` | Liveness probe cho Kubernetes | `200` `{"status":"ok","service":"todo-backend"}` |
| `GET /readyz` | Readiness probe kiểm tra kết nối MongoDB | `200` khi `readyState === 1`; `503` khi mất kết nối |
| `GET /metrics` | Prometheus scrape endpoint (`ServiceMonitor` port `http`) | OpenMetrics format (`application/openmetrics-text`, có Exemplar `trace_id`) |

Frontend Nginx (`:3000`) cũng cung cấp `GET /healthz` (`200 ok`) cho probes và chuyển tiếp `X-Request-Id`, `traceparent`, `tracestate` qua `/api`.

## 2. Prometheus Metrics

- **Metrics mặc định Node.js** (`collectDefaultMetrics()`): `nodejs_heap_size_used_bytes`, `nodejs_eventloop_lag_seconds`, `process_cpu_seconds_total`, v.v.
- **`http_requests_total`** *(Counter)* — labels: `method`, `route`, `status_code`.
- **`http_request_duration_seconds`** *(Histogram)* — labels: `method`, `route`, `status_code` (`buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]`), xuất dạng **OpenMetrics** kèm **Exemplar `trace_id`** để nhảy trực tiếp sang Tempo từ Grafana.
- **`todo_mongodb_up`** *(Gauge)* — `1` khi MongoDB đang kết nối, `0` khi ngắt.

*(Lưu ý: `route` sử dụng template Express như `/api/todos/:todoId` hoặc `unmatched`, không đưa ID động vào label; `/healthz`, `/readyz`, `/metrics` không tính vào HTTP RED metrics để tránh nhiễu số liệu.)*

## 3. Structured JSON Logs (`stdout` / `stderr`)

- Biến `LOG_LEVEL` hỗ trợ: `debug`, `info` (mặc định), `warn`, `error`.
- Mỗi dòng log là 1 JSON object:
  ```json
  {
    "timestamp": "2026-11-21T18:30:00.000Z",
    "level": "info",
    "service": "todo-backend",
    "env": "dev",
    "message": "http_request",
    "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
    "span_id": "00f067aa0ba902b7",
    "request_id": "c7a1f4c2-...",
    "method": "POST",
    "route": "/api/todos",
    "status_code": 200,
    "duration_ms": 14.2
  }
  ```
- Tự động loại bỏ các trường nhạy cảm (`authorization`, `cookie`, `set-cookie`, `password`, `secret`, `token`, `headers`).

## 4. OpenTelemetry Tracing (OTLP HTTP)

- Backend dùng `@opentelemetry/sdk-trace`, `@opentelemetry/exporter-trace-otlp-http` và instrumentation cho `http`, `express`, `mongoose`.
- Frontend Axios tự gắn header `X-Request-Id` và W3C `traceparent` cho mỗi request qua Nginx `/api` → Backend → MongoDB.
- Biến môi trường cấu hình trong Kustomize ConfigMap & Downward API:
  - `OTEL_SERVICE_NAME=todo-backend`
  - `OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy.monitoring.svc.cluster.local:4318`
  - `OTEL_RESOURCE_ATTRIBUTES=k8s.namespace.name=$(K8S_NAMESPACE),k8s.pod.name=$(K8S_POD_NAME)` (để Grafana liên kết ngược Tempo → Loki theo `namespace` và `app`)
  - `OTEL_SDK_DISABLED=true` (chỉ đặt khi muốn tắt tracing, mặc định bật trừ `NODE_ENV=test`).

## 5. Kiểm tra nhanh ở local

```bash
cd backend
npm test -- --runInBand --ci
```
