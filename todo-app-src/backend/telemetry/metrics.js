const crypto = require("crypto");
const mongoose = require("mongoose");
const promClient = require("prom-client");
const logger = require("./logger");

const INTERNAL_PROBE_PATHS = new Set(["/healthz", "/readyz", "/metrics"]);

let defaultMetricsInitialized = false;
function ensureDefaultMetrics() {
  if (!defaultMetricsInitialized) {
    promClient.collectDefaultMetrics();
    defaultMetricsInitialized = true;
  }
}

function getOrCreateCounter(config) {
  return (
    promClient.register.getSingleMetric(config.name) ||
    new promClient.Counter(config)
  );
}

function getOrCreateHistogram(config) {
  return (
    promClient.register.getSingleMetric(config.name) ||
    new promClient.Histogram(config)
  );
}

function getOrCreateGauge(config) {
  return (
    promClient.register.getSingleMetric(config.name) ||
    new promClient.Gauge(config)
  );
}

promClient.register.setContentType(promClient.openMetricsContentType);
ensureDefaultMetrics();

const httpRequestsTotal = getOrCreateCounter({
  name: "http_requests_total",
  help: "Total number of HTTP requests handled by todo-backend",
  labelNames: ["method", "route", "status_code"],
});

const httpRequestDurationSeconds = getOrCreateHistogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  enableExemplars: true,
});

const mongoUpGauge = getOrCreateGauge({
  name: "todo_mongodb_up",
  help:
    "Whether the backend MongoDB connection is ready (1 = connected, 0 = disconnected)",
});

function resolveIncomingRequestId(req) {
  const raw = req.headers["x-request-id"];
  if (typeof raw === "string") {
    const cleaned = raw.replace(/[\r\n]/g, "").trim();
    if (cleaned.length > 0 && cleaned.length <= 128) {
      return cleaned;
    }
  }
  return crypto.randomUUID();
}

function resolveRouteLabel(req) {
  if (req.route && req.route.path) {
    const rawRoute = `${req.baseUrl || ""}${req.route.path}`;
    if (rawRoute.length > 1 && rawRoute.endsWith("/")) {
      return rawRoute.slice(0, -1);
    }
    return rawRoute;
  }
  if (INTERNAL_PROBE_PATHS.has(req.path)) {
    return req.path;
  }
  return "unmatched";
}

function observabilityMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();
  const requestId = resolveIncomingRequestId(req);
  const { trace_id: traceId } = logger.getActiveTraceContext();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  if (traceId) {
    res.setHeader("X-Trace-Id", traceId);
  }

  res.on("finish", () => {
    const durationSeconds =
      Number(process.hrtime.bigint() - startTime) / 1_000_000_000;
    const durationMs = Math.round(durationSeconds * 1000 * 100) / 100;
    const route = resolveRouteLabel(req);
    const statusCode = String(res.statusCode);
    const isInternalProbe = INTERNAL_PROBE_PATHS.has(route);

    if (!isInternalProbe) {
      const labels = {
        method: req.method,
        route,
        status_code: statusCode,
      };
      httpRequestsTotal.inc(labels);
      httpRequestDurationSeconds.observe({
        labels,
        value: durationSeconds,
        exemplarLabels: traceId ? { trace_id: traceId } : {},
      });
    }

    let level = "info";
    if (isInternalProbe) {
      level = "debug";
    } else if (res.statusCode >= 500) {
      level = "error";
    } else if (res.statusCode >= 400) {
      level = "warn";
    }

    logger[level]("http_request", {
      request_id: requestId,
      method: req.method,
      route,
      status_code: res.statusCode,
      duration_ms: durationMs,
    });
  });

  next();
}

async function metricsHandler(req, res) {
  try {
    mongoUpGauge.set(mongoose.connection.readyState === 1 ? 1 : 0);
    res.set("Content-Type", promClient.register.contentType);
    const metrics = await promClient.register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error("Failed to collect Prometheus metrics", {
      request_id: req.requestId,
      error,
    });
    res.status(500).send("Error fetching metrics");
  }
}

module.exports = {
  metricsHandler,
  observabilityMiddleware,
};
