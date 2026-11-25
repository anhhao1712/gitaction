const { context, propagation, trace } = require("@opentelemetry/api");
const {
  AsyncLocalStorageContextManager,
} = require("@opentelemetry/context-async-hooks");
const { W3CTraceContextPropagator } = require("@opentelemetry/core");
const {
  defaultResource,
  detectResources,
  resourceAttributesEnvDetector,
  resourceFromAttributes,
} = require("@opentelemetry/resources");
const {
  BatchSpanProcessor,
  TracerProvider,
} = require("@opentelemetry/sdk-trace");
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-http");
const { registerInstrumentations } = require("@opentelemetry/instrumentation");
const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");
const {
  ExpressInstrumentation,
} = require("@opentelemetry/instrumentation-express");
const {
  MongooseInstrumentation,
} = require("@opentelemetry/instrumentation-mongoose");

const IGNORED_TRACE_PATHS = new Set(["/healthz", "/readyz", "/metrics"]);

let tracerProvider = null;

function resolveTraceExporterUrl() {
  if (process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
    return process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  }
  const baseEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (baseEndpoint) {
    const trimmed = baseEndpoint.replace(/\/+$/, "");
    return trimmed.endsWith("/v1/traces") ? trimmed : `${trimmed}/v1/traces`;
  }
  return "http://localhost:4318/v1/traces";
}

function shouldDisableTracing() {
  return (
    process.env.NODE_ENV === "test" || process.env.OTEL_SDK_DISABLED === "true"
  );
}

function buildResource() {
  const serviceName = process.env.OTEL_SERVICE_NAME || "todo-backend";
  const environment =
    process.env.APP_ENV || process.env.NODE_ENV || "development";
  const envResource = detectResources({
    detectors: [resourceAttributesEnvDetector],
  });

  return defaultResource()
    .merge(envResource)
    .merge(
      resourceFromAttributes({
        "service.name": serviceName,
        "deployment.environment.name": environment,
      })
    );
}

function initTracing() {
  if (tracerProvider || shouldDisableTracing()) {
    return tracerProvider;
  }

  const resource = buildResource();

  const exporter = new OTLPTraceExporter({
    url: resolveTraceExporterUrl(),
  });

  tracerProvider = new TracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor({ exporter })],
  });

  const contextManager = new AsyncLocalStorageContextManager().enable();
  context.setGlobalContextManager(contextManager);
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(tracerProvider);

  registerInstrumentations({
    tracerProvider,
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) => {
          const path = (req.url || "").split("?")[0];
          return IGNORED_TRACE_PATHS.has(path);
        },
      }),
      new ExpressInstrumentation(),
      new MongooseInstrumentation(),
    ],
  });

  return tracerProvider;
}

async function shutdownTracing() {
  if (!tracerProvider) {
    return;
  }
  const provider = tracerProvider;
  tracerProvider = null;
  await provider.shutdown();
}

module.exports = {
  buildResource,
  initTracing,
  resolveTraceExporterUrl,
  shutdownTracing,
};
