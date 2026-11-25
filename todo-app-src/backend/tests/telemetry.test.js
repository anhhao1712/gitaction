const { spawnSync } = require("child_process");
const path = require("path");
const request = require("supertest");
const mongoose = require("mongoose");
const promClient = require("prom-client");

const { trace } = require("@opentelemetry/api");
const app = require("../server");
const logger = require("../telemetry/logger");
const {
  buildResource,
  initTracing,
  resolveTraceExporterUrl,
} = require("../telemetry/tracing");

describe("Observability instrumentation (Task 6.1)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it("GET /healthz returns 200 ok", async () => {
    const res = await request(app).get("/healthz");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      status: "ok",
      service: "todo-backend",
    });
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("GET /readyz returns 503 when disconnected and 200 when MongoDB is connected", async () => {
    const origDescriptor = Object.getOwnPropertyDescriptor(
      mongoose.connection,
      "readyState"
    );

    Object.defineProperty(mongoose.connection, "readyState", {
      configurable: true,
      get: () => 0,
    });
    const disconnectedRes = await request(app).get("/readyz");
    expect(disconnectedRes.statusCode).toBe(503);
    expect(disconnectedRes.body).toEqual({
      status: "not_ready",
      mongodb: "disconnected",
    });

    Object.defineProperty(mongoose.connection, "readyState", {
      configurable: true,
      get: () => 1,
    });
    const connectedRes = await request(app).get("/readyz");
    expect(connectedRes.statusCode).toBe(200);
    expect(connectedRes.body).toEqual({
      status: "ready",
      mongodb: "connected",
    });

    if (origDescriptor) {
      Object.defineProperty(mongoose.connection, "readyState", origDescriptor);
    }
  });

  it("records normalized HTTP metrics and exposes them on GET /metrics", async () => {
    const stdoutSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const stderrSpy = jest
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const res = await request(app)
      .put("/api/todos/not-a-valid-object-id")
      .set("X-Request-Id", "req-test-123")
      .set("Authorization", "Bearer super-secret-token")
      .set("Cookie", "session=abc");

    expect(res.statusCode).toBe(400);
    expect(res.headers["x-request-id"]).toBe("req-test-123");

    const metricsRes = await request(app).get("/metrics");
    expect(metricsRes.statusCode).toBe(200);
    expect(metricsRes.headers["content-type"]).toContain(
      "application/openmetrics-text"
    );
    expect(metricsRes.text).toContain("http_requests_total");
    expect(metricsRes.text).toContain("http_request_duration_seconds_bucket");
    expect(metricsRes.text).toContain("todo_mongodb_up");
    expect(metricsRes.text.trimEnd().endsWith("# EOF")).toBe(true);

    const httpCounter = promClient.register.getSingleMetric(
      "http_requests_total"
    );
    const counterData = await httpCounter.get();
    const putSample = counterData.values.find(
      (v) =>
        v.labels.method === "PUT" &&
        v.labels.route === "/api/todos/:todoId" &&
        v.labels.status_code === "400"
    );
    expect(putSample).toBeDefined();
    expect(putSample.value).toBeGreaterThanOrEqual(1);

    const logLines = [...stdoutSpy.mock.calls, ...stderrSpy.mock.calls]
      .map((args) => String(args[0]).trim())
      .filter(Boolean);
    expect(logLines.length).toBeGreaterThan(0);

    const accessLog = logLines
      .map((line) => JSON.parse(line))
      .find(
        (entry) =>
          entry.message === "http_request" &&
          entry.route === "/api/todos/:todoId"
      );
    expect(accessLog).toBeDefined();
    expect(accessLog.level).toBe("warn");
    expect(accessLog.request_id).toBe("req-test-123");
    expect(accessLog.status_code).toBe(400);
    expect(typeof accessLog.duration_ms).toBe("number");
    expect(JSON.stringify(accessLog)).not.toContain("super-secret-token");
    expect(JSON.stringify(accessLog)).not.toContain("session=abc");
  });

  it("emits OpenMetrics exemplars with active trace_id on duration histogram", async () => {
    const sampleTraceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    jest.spyOn(trace, "getActiveSpan").mockReturnValue({
      spanContext: () => ({
        traceId: sampleTraceId,
        spanId: "00f067aa0ba902b7",
        traceFlags: 1,
      }),
    });

    const res = await request(app).put("/api/todos/not-a-valid-object-id");
    expect(res.statusCode).toBe(400);
    expect(res.headers["x-trace-id"]).toBe(sampleTraceId);

    const metricsRes = await request(app).get("/metrics");
    expect(metricsRes.statusCode).toBe(200);
    expect(metricsRes.text).toContain(`# {trace_id="${sampleTraceId}"}`);
  });

  it("reads Kubernetes Downward API attributes from OTEL_RESOURCE_ATTRIBUTES", () => {
    process.env.OTEL_SERVICE_NAME = "todo-backend";
    process.env.APP_ENV = "dev";
    process.env.OTEL_RESOURCE_ATTRIBUTES =
      "k8s.namespace.name=todo-dev,k8s.pod.name=backend-123";

    const resource = buildResource();
    expect(resource.attributes["service.name"]).toBe("todo-backend");
    expect(resource.attributes["deployment.environment.name"]).toBe("dev");
    expect(resource.attributes["k8s.namespace.name"]).toBe("todo-dev");
    expect(resource.attributes["k8s.pod.name"]).toBe("backend-123");
  });

  it("logger filters by LOG_LEVEL and strips sensitive fields", () => {
    const stdoutSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    process.env.LOG_LEVEL = "warn";
    expect(logger.info("should-skip")).toBe(false);
    expect(
      logger.warn("should-emit", {
        request_id: "req-1",
        authorization: "Bearer secret",
        cookie: "sid=1",
        password: "123",
        headers: { x: 1 },
      })
    ).toBe(true);

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(parsed.level).toBe("warn");
    expect(parsed.request_id).toBe("req-1");
    expect(parsed.authorization).toBeUndefined();
    expect(parsed.cookie).toBeUndefined();
    expect(parsed.password).toBeUndefined();
    expect(parsed.headers).toBeUndefined();
  });

  it("resolves OTLP trace URL and skips tracing in test mode", () => {
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT =
      "http://alloy.monitoring.svc.cluster.local:4318";
    expect(resolveTraceExporterUrl()).toBe(
      "http://alloy.monitoring.svc.cluster.local:4318/v1/traces"
    );

    expect(initTracing()).toBeNull();
  });

  it("initializes and shuts down OpenTelemetry SDK 3.x cleanly when enabled", () => {
    const tracingModulePath = path.resolve(
      __dirname,
      "../telemetry/tracing.js"
    );
    const script = [
      `const { initTracing, shutdownTracing } = require(${JSON.stringify(
        tracingModulePath
      )});`,
      "const provider = initTracing();",
      "if (!provider) process.exit(2);",
      "shutdownTracing().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });",
    ].join("\n");

    const result = spawnSync(process.execPath, ["-e", script], {
      env: {
        ...process.env,
        NODE_ENV: "development",
        OTEL_SDK_DISABLED: "false",
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
  });

  it("config preserves caller PORT and MONGODB_URI and sets defaults only when unset", () => {
    process.env.NODE_ENV = "development";
    process.env.PORT = "3999";
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/LocalTodo";

    jest.isolateModules(() => {
      require("../config/config");
    });

    expect(process.env.PORT).toBe("3999");
    expect(process.env.MONGODB_URI).toBe("mongodb://127.0.0.1:27017/LocalTodo");

    delete process.env.PORT;
    delete process.env.MONGODB_URI;

    jest.isolateModules(() => {
      require("../config/config");
    });

    expect(process.env.PORT).toBe("3000");
    expect(process.env.MONGODB_URI).toBe("mongodb://mongo:27017/TodoApp");
  });

  it("graceful shutdown closes HTTP server, DB, and tracing in order once", async () => {
    const order = [];
    const server = {
      close: jest.fn((cb) => {
        order.push("server.close");
        cb();
      }),
    };
    const disconnectDb = jest.fn(async () => {
      order.push("db.disconnect");
    });
    const shutdownTracer = jest.fn(async () => {
      order.push("shutdownTracing");
    });
    const exit = jest.fn();

    const shutdown = app.createGracefulShutdown({
      server,
      disconnectDb,
      shutdownTracer,
      exit,
      timeoutMs: 1000,
    });

    await shutdown("SIGTERM");
    await shutdown("SIGINT");

    expect(order).toEqual(["server.close", "db.disconnect", "shutdownTracing"]);
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(disconnectDb).toHaveBeenCalledTimes(1);
    expect(shutdownTracer).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });
});
