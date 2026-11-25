const { isSpanContextValid, trace } = require("@opentelemetry/api");

const LEVEL_WEIGHT = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY_PATTERN = /^(authorization|cookie|set-cookie|password|passwd|secret|token|api[-_]?key|headers)$/i;

function getConfiguredLevelWeight() {
  const configured = String(process.env.LOG_LEVEL || "info")
    .trim()
    .toLowerCase();
  return LEVEL_WEIGHT[configured] ?? LEVEL_WEIGHT.info;
}

function getActiveTraceContext() {
  const span = trace.getActiveSpan();
  if (!span) {
    return {};
  }
  const spanContext = span.spanContext();
  if (!spanContext || !isSpanContextValid(spanContext)) {
    return {};
  }
  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
  };
}

function sanitizeValue(value, seen) {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    const cleaned = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        continue;
      }
      if (nested !== undefined) {
        cleaned[key] = sanitizeValue(nested, seen);
      }
    }
    seen.delete(value);
    return cleaned;
  }
  return value;
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== "object") {
    return {};
  }
  return sanitizeValue(meta, new WeakSet());
}

function writeLog(level, message, meta = {}) {
  const weight = LEVEL_WEIGHT[level] ?? LEVEL_WEIGHT.info;
  if (weight < getConfiguredLevelWeight()) {
    return false;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.OTEL_SERVICE_NAME || "todo-backend",
    env: process.env.APP_ENV || process.env.NODE_ENV || "development",
    message,
    ...getActiveTraceContext(),
    ...sanitizeMeta(meta),
  };

  const line = `${JSON.stringify(entry)}\n`;
  if (level === "error") {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
  return true;
}

module.exports = {
  debug: (message, meta) => writeLog("debug", message, meta),
  info: (message, meta) => writeLog("info", message, meta),
  warn: (message, meta) => writeLog("warn", message, meta),
  error: (message, meta) => writeLog("error", message, meta),
  getActiveTraceContext,
  sanitizeMeta,
};
